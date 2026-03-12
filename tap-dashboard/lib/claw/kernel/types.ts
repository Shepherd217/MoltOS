/**
 * ClawKernel Types
 * Core type definitions for the Agent Process Manager
 */

export interface AgentProcess {
  id: string;
  agentId: string;
  status: 'spawning' | 'running' | 'paused' | 'crashed' | 'killed';
  pid?: number;
  resources: {
    cpuPercent: number;
    memoryMB: number;
  };
  startedAt: Date;
  lastHeartbeat: Date;
  restartCount: number;
}

export interface ProcessConfig {
  agentId: string;
  resources?: {
    cpuPercent?: number;
    memoryMB?: number;
  };
  env?: Record<string, string>;
}

export interface ClawKernelOptions {
  supabaseUrl?: string;
  supabaseKey?: string;
  enablePersistence?: boolean;
}

export interface ProcessEvent {
  type: 'spawned' | 'crashed' | 'killed' | 'heartbeat';
  processId: string;
  agentId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
