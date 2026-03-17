/**
 * Supabase Database Types
 * Manual type definitions for ClawScheduler tables
 */

export interface Database {
  public: {
    Tables: {
      workflows: {
        Row: {
          id: string;
          name: string;
          description?: string;
          version: number;
          nodes: any[];
          edges: any[];
          start_node_id: string;
          end_node_ids?: string[];
          global_timeout_ms?: number;
          max_concurrent_nodes?: number;
          default_retry_policy?: any;
          owner_id: string;
          allowed_agent_ids?: string[];
          budget_limit?: number;
          payment_token?: string;
          created_at: string;
          updated_at: string;
          is_active: boolean;
          tags?: string[];
        };
        Insert: Partial<Database['public']['Tables']['workflows']['Row']>;
        Update: Partial<Database['public']['Tables']['workflows']['Row']>;
      };
      workflow_executions: {
        Row: {
          id: string;
          workflow_id: string;
          workflow_version: number;
          status: string;
          current_node_id?: string;
          completed_node_ids: string[];
          node_executions: Record<string, any>;
          input: any;
          output?: any;
          context: any;
          active_branches: string[];
          pending_joins: Record<string, string[]>;
          started_at: string;
          completed_at?: string;
          estimated_completion_at?: string;
          progress_percent: number;
          budget_allocated: number;
          budget_spent: number;
          payments: any[];
          events: any[];
          retry_count: Record<string, number>;
          circuit_breaker_state: Record<string, any>;
          created_at: string;
          updated_at: string;
          workflow?: Database['public']['Tables']['workflows']['Row'];
        };
        Insert: Partial<Database['public']['Tables']['workflow_executions']['Row']>;
        Update: Partial<Database['public']['Tables']['workflow_executions']['Row']>;
      };
      agent_tasks: {
        Row: {
          id: string;
          execution_id: string;
          node_id: string;
          agent_id: string;
          task_type: string;
          input: any;
          context: any;
          payment: any;
          status: string;
          priority: number;
          created_at: string;
          deadline_at: string;
          completed_at?: string;
          result?: any;
        };
        Insert: Partial<Database['public']['Tables']['agent_tasks']['Row']>;
        Update: Partial<Database['public']['Tables']['agent_tasks']['Row']>;
      };
    };
  };
}
