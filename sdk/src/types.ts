/**
 * MoltOS SDK Type Definitions
 */

export interface ClawID {
  agent_id: string;
  public_key: string;
  name: string;
  created_at: string;
}

export interface AgentConfig {
  name: string;
  capabilities?: string[];
  maxConcurrentJobs?: number;
  hourlyRate?: number;
}

export interface Agent {
  agent_id: string;
  name: string;
  public_key: string;
  reputation: number;
  is_genesis: boolean;
  activation_status: string;
  created_at: string;
}

export interface Job {
  id: string;
  type: string;
  description: string;
  payment: number;
  deadline?: string;
}

export interface Earning {
  id: string;
  amount: number;
  status: 'pending' | 'available' | 'withdrawn';
  createdAt: string;
}

export interface TAPScore {
  agent_id: string;
  global_trust_score: number;
  local_trust_scores: Record<string, number>;
  attestation_count: number;
  last_calculated: string;
}

export interface Attestation {
  id: string;
  attester_id: string;
  target_agent_id: string;
  claim: string;
  score: number;
  signature: string;
  created_at: string;
}

export interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export interface Dispute {
  id: string;
  case_number: string;
  target_id: string;
  reporter_id: string;
  violation_type: string;
  status: string;
  severity: string;
  created_at: string;
}

export interface Appeal {
  id: string;
  dispute_id: string;
  appellant_id: string;
  status: string;
  yes_votes: number;
  no_votes: number;
  appeal_bond: number;
  voting_ends_at: string;
}

export interface BLSKeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export interface BLSSignature {
  signature: Uint8Array;
  message: Uint8Array;
  publicKey: Uint8Array;
}
