/**
 * Agent Telemetry API
 * 
 * POST /api/telemetry/submit — Agents report their metrics
 * GET /api/telemetry — Retrieve telemetry for an agent
 * GET /api/telemetry/leaderboard — Top performers by telemetry
 * 
 * Inspired by NVIDIA NeMo Agent Toolkit's observability,
 * but designed for trust scoring, not just debugging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy Supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase not configured');
    supabase = createClient(url, key);
  }
  return supabase;
}

interface TelemetryPayload {
  agent_id: string;
  window_start: string; // ISO timestamp
  window_end: string;
  tasks?: {
    attempted: number;
    completed: number;
    failed: number;
    avg_duration_ms?: number;
    p95_duration_ms?: number;
    p99_duration_ms?: number;
  };
  resources?: {
    cpu_percent?: number;
    memory_mb?: number;
  };
  network?: {
    requests: number;
    errors: number;
  };
  custom?: Record<string, number | string | boolean>;
}

interface TelemetryResponse {
  success: boolean;
  telemetry_id?: string;
  composite_score?: number;
  message?: string;
}

/**
 * POST /api/telemetry/submit
 * Agents report their telemetry data
 */
export async function POST(request: NextRequest) {
  try {
    const body: TelemetryPayload = await request.json();
    
    // Validate required fields
    if (!body.agent_id || !body.window_start || !body.window_end) {
      return NextResponse.json({
        success: false,
        error: 'agent_id, window_start, and window_end required'
      }, { status: 400 });
    }
    
    // Verify agent exists
    const { data: agent, error: agentError } = await getSupabase()
      .from('agent_registry')
      .select('agent_id, name')
      .eq('agent_id', body.agent_id)
      .single();
    
    if (agentError || !agent) {
      return NextResponse.json({
        success: false,
        error: 'Agent not found'
      }, { status: 404 });
    }
    
    // Submit telemetry via RPC
    const { data: telemetryId, error: telemetryError } = await getSupabase()
      .rpc('submit_agent_telemetry', {
        p_agent_id: body.agent_id,
        p_window_start: body.window_start,
        p_window_end: body.window_end,
        p_tasks_attempted: body.tasks?.attempted || 0,
        p_tasks_completed: body.tasks?.completed || 0,
        p_tasks_failed: body.tasks?.failed || 0,
        p_avg_task_duration_ms: body.tasks?.avg_duration_ms,
        p_cpu_percent: body.resources?.cpu_percent,
        p_memory_mb: body.resources?.memory_mb,
        p_network_requests: body.network?.requests || 0,
        p_network_errors: body.network?.errors || 0,
        p_custom_metrics: body.custom || {}
      });
    
    if (telemetryError) throw telemetryError;
    
    // Get updated composite score
    const { data: scoreData } = await getSupabase()
      .from('tap_score_with_telemetry')
      .select('composite_score')
      .eq('agent_id', body.agent_id)
      .single();
    
    const response: TelemetryResponse = {
      success: true,
      telemetry_id: telemetryId,
      composite_score: scoreData?.composite_score
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[Telemetry] Submit failed:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}

/**
 * GET /api/telemetry
 * Get telemetry summary for an agent
 * 
 * Query:
 *   agent_id: required
 *   days: number of days to include (default 7, max 30)
 *   include_windows: include raw telemetry windows (default false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const days = Math.min(parseInt(searchParams.get('days') || '7'), 30);
    const includeWindows = searchParams.get('include_windows') === 'true';
    
    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'agent_id required'
      }, { status: 400 });
    }
    
    // Get summary via RPC
    const { data: summary, error: summaryError } = await getSupabase()
      .rpc('get_agent_telemetry_summary', {
        p_agent_id: agentId,
        p_days: days
      });
    
    if (summaryError) throw summaryError;
    
    const response: any = {
      success: true,
      summary: summary
    };
    
    // Include raw windows if requested
    if (includeWindows) {
      const { data: windows, error: windowsError } = await getSupabase()
        .from('agent_telemetry')
        .select('*')
        .eq('agent_id', agentId)
        .gte('window_start', new Date(Date.now() - days * 86400000).toISOString())
        .order('window_start', { ascending: false })
        .limit(100);
      
      if (!windowsError) {
        response.windows = windows;
      }
    }
    
    // Include current TAP score with telemetry
    const { data: scoreData } = await getSupabase()
      .from('tap_score_with_telemetry')
      .select('*')
      .eq('agent_id', agentId)
      .single();
    
    if (scoreData) {
      response.current_score = {
        tap_score: scoreData.global_score,
        composite_score: scoreData.composite_score,
        reliability: scoreData.telemetry_reliability,
        success_rate: scoreData.telemetry_success_rate
      };
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[Telemetry] Get failed:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
