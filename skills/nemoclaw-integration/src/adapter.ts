import { EventEmitter } from 'events';
import { execSync } from 'child_process';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface AdapterHealth {
  healthy: boolean;
  runtime?: string;
  version?: string;
  issues?: string[];
  features?: string[];
}

export interface SandboxConfig {
  landlock: boolean;
  seccomp: boolean;
  networkNamespaces: boolean;
  allowedPaths?: string[];
  blockedSyscalls?: string[];
}

export interface InferenceRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  privacy?: 'local-only' | 'cloud-allowed';
}

export interface InferenceResult {
  text: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  local: boolean;
}

export interface EvidenceEvent {
  type: string;
  timestamp: Date;
  agentId: string;
  action: string;
  result: 'success' | 'failure';
  metadata?: Record<string, any>;
}

/**
 * NemoClaw Runtime Adapter
 * Bridges MoltOS with NVIDIA's secure runtime
 */
export class NemoClawAdapter extends EventEmitter {
  private initialized = false;
  private config: SandboxConfig | null = null;
  private evidenceQueue: EvidenceEvent[] = [];
  
  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Check NemoClaw availability
    if (!await this.isAvailable()) {
      throw new Error('NemoClaw not available');
    }
    
    // Load or create sandbox config
    this.config = await this.loadSandboxConfig();
    
    // Set up evidence directory
    const evidenceDir = join(homedir(), '.moltos', 'evidence');
    await mkdir(evidenceDir, { recursive: true });
    
    // Start evidence flush interval
    setInterval(() => this.flushEvidence(), 5000);
    
    this.initialized = true;
    this.emit('initialized');
  }
  
  /**
   * Shutdown the adapter
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    
    // Flush remaining evidence
    await this.flushEvidence();
    
    this.initialized = false;
    this.emit('shutdown');
  }
  
  /**
   * Check if NemoClaw is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      execSync('which nemoclaw', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<AdapterHealth> {
    const health: AdapterHealth = {
      healthy: false,
      issues: [],
      features: []
    };
    
    if (!this.initialized) {
      health.issues!.push('Adapter not initialized');
      return health;
    }
    
    try {
      const version = execSync('nemoclaw --version', { encoding: 'utf8' });
      health.version = version.trim();
      health.runtime = 'NemoClaw';
      
      // Check features
      if (this.config?.landlock) {
        health.features!.push('landlock');
      }
      if (this.config?.seccomp) {
        health.features!.push('seccomp');
      }
      if (this.config?.networkNamespaces) {
        health.features!.push('network-isolation');
      }
      
      health.healthy = true;
    } catch (error) {
      health.issues!.push(`Health check failed: ${error}`);
    }
    
    return health;
  }
  
  /**
   * Create a sandboxed environment for an agent
   */
  async createSandbox(agentId: string): Promise<string> {
    const sandboxPath = join(homedir(), '.moltos', 'sandboxes', agentId);
    await mkdir(sandboxPath, { recursive: true });
    
    // Create OpenShell blueprint
    const blueprint = {
      version: '1.0',
      agent: agentId,
      sandbox: {
        landlock: this.config?.landlock ?? true,
        seccomp: this.config?.seccomp ?? true,
        network: this.config?.networkNamespaces ? 'isolated' : 'host'
      },
      filesystem: {
        readOnly: ['/usr', '/lib'],
        readWrite: [sandboxPath],
        blocked: ['/etc/passwd', '/etc/shadow']
      }
    };
    
    const blueprintPath = join(sandboxPath, 'blueprint.json');
    await writeFile(blueprintPath, JSON.stringify(blueprint, null, 2));
    
    return sandboxPath;
  }
  
  /**
   * Route inference request (local vs cloud)
   */
  async routeInference(request: InferenceRequest): Promise<InferenceResult> {
    const startTime = Date.now();
    
    // Check if local Nemotron can handle it
    const useLocal = await this.shouldUseLocalInference(request);
    
    if (useLocal) {
      return this.executeLocalInference(request, startTime);
    } else {
      return this.executeCloudInference(request, startTime);
    }
  }
  
  /**
   * Submit evidence to Arbitra
   */
  async submitEvidence(event: EvidenceEvent): Promise<void> {
    // Queue evidence for batch submission
    this.evidenceQueue.push(event);
    
    // Immediate flush if queue gets large
    if (this.evidenceQueue.length >= 10) {
      await this.flushEvidence();
    }
  }
  
  /**
   * Convert NemoClaw policy to ClawForge governance
   */
  async policyToGovernance(policyPath: string): Promise<Record<string, any>> {
    const content = await readFile(policyPath, 'utf8');
    const { parse } = await import('yaml');
    const policy = parse(content);
    
    // Convert to ClawForge proposal format
    return {
      type: 'governance_proposal',
      title: `Import: ${policy.name || 'NemoClaw Policy'}`,
      description: policy.description || 'Imported from NemoClaw',
      rules: policy.rules?.map((rule: any) => ({
        condition: rule.condition,
        action: rule.action,
        severity: rule.severity || 'medium'
      })) || [],
      source: 'nemoclaw',
      importedAt: new Date().toISOString()
    };
  }
  
  // Private methods
  
  private async loadSandboxConfig(): Promise<SandboxConfig> {
    const configPath = join(homedir(), '.moltos', 'sandbox.config.json');
    
    if (existsSync(configPath)) {
      const content = await readFile(configPath, 'utf8');
      return JSON.parse(content);
    }
    
    // Default config
    return {
      landlock: true,
      seccomp: true,
      networkNamespaces: true,
      allowedPaths: ['/tmp', '/var/tmp'],
      blockedSyscalls: ['execve', 'fork', 'clone']
    };
  }
  
  private async shouldUseLocalInference(request: InferenceRequest): Promise<boolean> {
    // Privacy requirement forces local
    if (request.privacy === 'local-only') {
      return true;
    }
    
    // Check if Nemotron is available
    try {
      execSync('nemoclaw model status nemotron-3-super:8b', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  
  private async executeLocalInference(
    request: InferenceRequest, 
    startTime: number
  ): Promise<InferenceResult> {
    // Call Nemotron via NemoClaw
    const result = execSync(
      `nemoclaw inference run nemotron-3-super:8b "${request.prompt}"`,
      { encoding: 'utf8' }
    );
    
    return {
      text: result.trim(),
      model: 'nemotron-3-super:8b',
      tokensUsed: this.estimateTokens(request.prompt, result),
      latencyMs: Date.now() - startTime,
      local: true
    };
  }
  
  private async executeCloudInference(
    request: InferenceRequest,
    startTime: number
  ): Promise<InferenceResult> {
    // Route to cloud provider
    // This would integrate with MoltOS cloud inference
    throw new Error('Cloud inference not yet implemented');
  }
  
  private estimateTokens(input: string, output: string): number {
    // Rough estimation: ~4 chars per token
    return Math.ceil((input.length + output.length) / 4);
  }
  
  private async flushEvidence(): Promise<void> {
    if (this.evidenceQueue.length === 0) return;
    
    const batch = [...this.evidenceQueue];
    this.evidenceQueue = [];
    
    // Write to evidence log
    const evidencePath = join(homedir(), '.moltos', 'evidence', `batch-${Date.now()}.json`);
    await writeFile(evidencePath, JSON.stringify(batch, null, 2));
    
    // TODO: Submit to Arbitra TAP contract
    this.emit('evidence:flushed', batch.length);
  }
}
