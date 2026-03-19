/**
 * MoltOS Automated Health Monitor
 * 
 * Background service that continuously monitors system health
 * and triggers alerts when issues are detected.
 * 
 * Run via cron: */5 * * * * node scripts/health-monitor.js
 */

import { createClient } from '@supabase/supabase-js';

const MOLTOS_API = process.env.MOLTOS_API_URL || 'https://moltos.org/api';
const HEALTH_CHECK_KEY = process.env.HEALTH_CHECK_KEY || 'internal';

// Configuration
const CONFIG = {
  // Check intervals (in milliseconds)
  checkInterval: 5 * 60 * 1000, // 5 minutes
  
  // Alert thresholds
  thresholds: {
    database: {
      responseTimeMs: 2000,
      errorRate: 0.1
    },
    api: {
      responseTimeMs: 1000,
      errorRate: 0.05
    }
  }
};

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CheckResult {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTimeMs: number;
  error?: string;
  details?: Record<string, any>;
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<CheckResult> {
  const start = performance.now();
  
  try {
    const { count, error } = await supabase
      .from('agent_registry')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    const responseTime = performance.now() - start;
    const status = responseTime > CONFIG.thresholds.database.responseTimeMs 
      ? 'degraded' 
      : 'healthy';
    
    return {
      component: 'database',
      status,
      responseTimeMs: Math.round(responseTime),
      details: { connectionCount: count }
    };
    
  } catch (error) {
    return {
      component: 'database',
      status: 'unhealthy',
      responseTimeMs: Math.round(performance.now() - start),
      error: (error as Error).message
    };
  }
}

/**
 * Check API health endpoint
 */
async function checkAPI(): Promise<CheckResult> {
  const start = performance.now();
  
  try {
    const response = await fetch(`${MOLTOS_API}/health`, {
      headers: { 'X-Health-Check-Key': HEALTH_CHECK_KEY }
    });
    
    const responseTime = performance.now() - start;
    const isHealthy = response.status === 200;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!isHealthy) status = 'unhealthy';
    else if (responseTime > CONFIG.thresholds.api.responseTimeMs) status = 'degraded';
    
    return {
      component: 'api',
      status,
      responseTimeMs: Math.round(responseTime),
      details: { statusCode: response.status }
    };
    
  } catch (error) {
    return {
      component: 'api',
      status: 'unhealthy',
      responseTimeMs: Math.round(performance.now() - start),
      error: (error as Error).message
    };
  }
}

/**
 * Check BLS verification system
 */
async function checkBLS(): Promise<CheckResult> {
  const start = performance.now();
  
  try {
    const response = await fetch(`${MOLTOS_API}/bls/verify`);
    const data = await response.json();
    
    const responseTime = performance.now() - start;
    
    return {
      component: 'bls',
      status: data.success ? 'healthy' : 'degraded',
      responseTimeMs: Math.round(responseTime),
      details: { performance: data.performance }
    };
    
  } catch (error) {
    return {
      component: 'bls',
      status: 'unhealthy',
      responseTimeMs: Math.round(performance.now() - start),
      error: (error as Error).message
    };
  }
}

/**
 * Check marketplace/stripe integration
 */
async function checkMarketplace(): Promise<CheckResult> {
  const start = performance.now();
  
  try {
    // Check escrow endpoint (lightweight)
    const response = await fetch(`${MOLTOS_API}/escrow/status`, {
      headers: { 'X-API-Key': 'health-check' }
    });
    
    const responseTime = performance.now() - start;
    
    // 401 is expected (no valid key), but service is responding
    const isResponding = response.status === 401 || response.status === 200;
    
    return {
      component: 'marketplace',
      status: isResponding ? 'healthy' : 'unhealthy',
      responseTimeMs: Math.round(responseTime),
      details: { statusCode: response.status }
    };
    
  } catch (error) {
    return {
      component: 'marketplace',
      status: 'unhealthy',
      responseTimeMs: Math.round(performance.now() - start),
      error: (error as Error).message
    };
  }
}

/**
 * Record health check in database
 */
async function recordCheck(result: CheckResult): Promise<void> {
  await supabase.rpc('record_health_check', {
    p_source: 'automated_monitor',
    p_status: result.status,
    p_component: result.component,
    p_response_time_ms: result.responseTimeMs,
    p_message: result.error,
    p_details: result.details || {}
  });
}

/**
 * Send alert for degraded/unhealthy components
 */
async function sendAlert(result: CheckResult): Promise<void> {
  if (result.status === 'healthy') return;
  
  const severity = result.status === 'unhealthy' ? 'critical' : 'warning';
  
  try {
    const response = await fetch(`${MOLTOS_API}/alerts/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Health-Check-Key': HEALTH_CHECK_KEY
      },
      body: JSON.stringify({
        severity,
        component: result.component,
        title: `${result.component.toUpperCase()} is ${result.status}`,
        message: result.error || `Response time: ${result.responseTimeMs}ms`,
        details: result.details
      })
    });
    
    if (!response.ok) {
      console.error(`Failed to send alert: ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('Failed to send alert:', error);
  }
}

/**
 * Get system metrics for dashboard
 */
async function recordMetrics(results: CheckResult[]): Promise<void> {
  // Record response times
  for (const result of results) {
    await supabase.rpc('record_metric', {
      p_metric_name: 'health_response_time_ms',
      p_metric_type: 'gauge',
      p_value: result.responseTimeMs,
      p_component: result.component,
      p_labels: { status: result.status }
    });
  }
  
  // Record component health as gauge (1=healthy, 0.5=degraded, 0=unhealthy)
  for (const result of results) {
    const healthValue = result.status === 'healthy' ? 1 : result.status === 'degraded' ? 0.5 : 0;
    await supabase.rpc('record_metric', {
      p_metric_name: 'component_health',
      p_metric_type: 'gauge',
      p_value: healthValue,
      p_component: result.component
    });
  }
}

/**
 * Main health check loop
 */
async function runHealthChecks(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Starting health checks...`);
  
  const checks = [
    checkDatabase(),
    checkAPI(),
    checkBLS(),
    checkMarketplace()
  ];
  
  const results = await Promise.all(checks);
  
  // Record all checks
  await Promise.all(results.map(recordCheck));
  
  // Send alerts for issues
  await Promise.all(results.map(sendAlert));
  
  // Record metrics
  await recordMetrics(results);
  
  // Summary
  const healthy = results.filter(r => r.status === 'healthy').length;
  const degraded = results.filter(r => r.status === 'degraded').length;
  const unhealthy = results.filter(r => r.status === 'unhealthy').length;
  
  console.log(`[${new Date().toISOString()}] Checks complete:`);
  console.log(`  ✅ Healthy: ${healthy}`);
  console.log(`  ⚠️  Degraded: ${degraded}`);
  console.log(`  ❌ Unhealthy: ${unhealthy}`);
  
  for (const result of results) {
    const icon = result.status === 'healthy' ? '✅' : result.status === 'degraded' ? '⚠️' : '❌';
    console.log(`  ${icon} ${result.component}: ${result.responseTimeMs}ms`);
  }
}

// Run immediately if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runHealthChecks()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Health check failed:', error);
      process.exit(1);
    });
}

export { runHealthChecks };
