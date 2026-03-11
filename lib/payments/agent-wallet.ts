/**
 * Agent Wallet Service (Stripe-Only)
 * @description Manages agent identity and Stripe Connect accounts
 * @version 2.0.0 - Stripe Connect Only
 */

import { randomBytes } from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface AgentIdentity {
  id: string;
  did: string;
  stripeAccountId?: string;
  metadata: AgentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMetadata {
  name: string;
  description: string;
  capabilities: string[];
  reputation: ReputationScore;
  tags: string[];
}

export interface ReputationScore {
  score: number; // 0-100
  totalTransactions: number;
  successfulTransactions: number;
  disputeRate: number;
  lastUpdated: Date;
}

export interface PaymentRequest {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  amount: number; // cents
  currency: string;
  purpose: string;
  metadata: PaymentMetadata;
  status: PaymentStatus;
  stripePaymentIntentId?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface PaymentMetadata {
  serviceType: string;
  requestId?: string;
  taskId?: string;
  autoReleaseConditions?: AutoReleaseConditions;
}

export interface AutoReleaseConditions {
  onConfirmation: boolean;
  onDeliveryProof: boolean;
}

export type PaymentStatus = 
  | 'PENDING'
  | 'AUTHORIZED'
  | 'ESCROWED'
  | 'COMPLETED'
  | 'FAILED'
  | 'DISPUTED'
  | 'REFUNDED';

// ============================================================================
// AGENT REGISTRY
// ============================================================================

class AgentRegistry {
  private agents: Map<string, AgentIdentity> = new Map();
  private didToAgent: Map<string, string> = new Map();

  /**
   * Register a new agent in the system
   */
  async registerAgent(
    name: string,
    description: string,
    capabilities: string[]
  ): Promise<AgentIdentity> {
    const id = this.generateAgentId();
    
    const identity: AgentIdentity = {
      id,
      did: `did:molt:${id}`,
      metadata: {
        name,
        description,
        capabilities,
        reputation: {
          score: 50, // Start neutral
          totalTransactions: 0,
          successfulTransactions: 0,
          disputeRate: 0,
          lastUpdated: new Date(),
        },
        tags: capabilities,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.agents.set(id, identity);
    this.didToAgent.set(identity.did, id);

    await this.emitEvent('AGENT_REGISTERED', {
      agentId: id,
      did: identity.did,
      timestamp: new Date().toISOString(),
    });

    return identity;
  }

  /**
   * Link Stripe Connect account to agent
   */
  async linkStripeAccount(agentId: string, stripeAccountId: string): Promise<AgentIdentity> {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    agent.stripeAccountId = stripeAccountId;
    agent.updatedAt = new Date();

    await this.emitEvent('STRIPE_ACCOUNT_LINKED', {
      agentId,
      stripeAccountId,
      timestamp: new Date().toISOString(),
    });

    return agent;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentIdentity | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get agent by DID
   */
  getAgentByDID(did: string): AgentIdentity | undefined {
    const agentId = this.didToAgent.get(did);
    return agentId ? this.agents.get(agentId) : undefined;
  }

  /**
   * Get agent by Stripe account ID
   */
  getAgentByStripeAccount(stripeAccountId: string): AgentIdentity | undefined {
    return Array.from(this.agents.values()).find(
      (agent) => agent.stripeAccountId === stripeAccountId
    );
  }

  /**
   * Update agent reputation
   */
  async updateReputation(
    agentId: string,
    transactionSuccess: boolean
  ): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    const rep = agent.metadata.reputation;
    rep.totalTransactions++;
    if (transactionSuccess) {
      rep.successfulTransactions++;
    }
    
    // Calculate new score with decay
    const successRate = rep.successfulTransactions / rep.totalTransactions;
    const ageFactor = Math.min(1, rep.totalTransactions / 100);
    rep.score = Math.round(50 + (successRate - 0.5) * 50 * ageFactor);
    rep.lastUpdated = new Date();

    agent.updatedAt = new Date();
  }

  /**
   * List all active agents
   */
  listActiveAgents(): AgentIdentity[] {
    return Array.from(this.agents.values());
  }

  /**
   * Find agents by capability
   */
  findAgentsByCapability(capability: string): AgentIdentity[] {
    return this.listActiveAgents().filter((agent) =>
      agent.metadata.capabilities.includes(capability)
    );
  }

  private generateAgentId(): string {
    return `ag_${randomBytes(8).toString('hex')}`;
  }

  private async emitEvent(event: string, data: unknown): Promise<void> {
    console.log(`[EVENT] ${event}:`, JSON.stringify(data, null, 2));
  }
}

// ============================================================================
// MAIN EXPORT - AgentWalletService
// ============================================================================

export class AgentWalletService {
  public registry: AgentRegistry;

  constructor() {
    this.registry = new AgentRegistry();
  }

  /**
   * Initialize a new agent
   */
  async createAgent(
    name: string,
    description: string,
    capabilities: string[]
  ): Promise<AgentIdentity> {
    return this.registry.registerAgent(name, description, capabilities);
  }

  /**
   * Link Stripe Connect account
   */
  async linkStripeConnect(
    agentId: string,
    stripeAccountId: string
  ): Promise<AgentIdentity> {
    return this.registry.linkStripeAccount(agentId, stripeAccountId);
  }
}

// Singleton instance
export const agentWalletService = new AgentWalletService();
export default agentWalletService;
