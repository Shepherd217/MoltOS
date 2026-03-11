/**
 * @fileoverview Payment Intent Service
 * @description Manages payment intents for agent-to-agent work agreements
 * Agent A creates intent → Funds locked in escrow → Agent B completes work → Auto-release
 * @version 1.0.0
 */

import { randomBytes } from 'crypto';
import { agentWalletService } from './agent-wallet';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PaymentIntent {
  id: string;
  status: IntentStatus;
  requesterAgentId: string;
  providerAgentId: string;
  serviceType: string;
  amount: BigInt;
  token: string;
  escrowAddress: string;
  requirements: WorkRequirements;
  timeline: IntentTimeline;
  signatures: IntentSignatures;
  completionProof?: CompletionProof;
  disputeInfo?: DisputeInfo;
  createdAt: Date;
  updatedAt: Date;
}

export type IntentStatus = 
  | 'PENDING_ACCEPTANCE'    // Waiting for provider to accept
  | 'ACCEPTED'              // Provider accepted, funds locked
  | 'IN_PROGRESS'           // Work in progress
  | 'DELIVERED'             // Work delivered, pending verification
  | 'VERIFIED'              // Work verified, payment releasing
  | 'COMPLETED'             // Payment released, intent closed
  | 'DISPUTED'              // Dispute raised
  | 'CANCELLED'             // Cancelled by either party
  | 'EXPIRED';              // Intent expired without acceptance

export interface WorkRequirements {
  deliverables: string[];
  deadline: Date;
  acceptanceCriteria: string;
  milestones?: Milestone[];
  revisionPolicy?: RevisionPolicy;
}

export interface Milestone {
  id: string;
  description: string;
  amount: BigInt;
  deadline: Date;
  status: 'PENDING' | 'COMPLETED' | 'VERIFIED';
}

export interface RevisionPolicy {
  maxRevisions: number;
  revisionDeadline: number; // hours
}

export interface IntentTimeline {
  createdAt: Date;
  acceptedAt?: Date;
  startedAt?: Date;
  deliveredAt?: Date;
  verifiedAt?: Date;
  completedAt?: Date;
  expiresAt: Date;
}

export interface IntentSignatures {
  requester: string;
  provider?: string;
  completion?: string;
  release?: string;
}

export interface CompletionProof {
  dataHash: string;
  dataUri: string; // IPFS hash, S3 URL, etc.
  timestamp: Date;
  verificationMethod: 'oracle' | 'ai_verification' | 'manual' | 'automated';
  verificationResult?: VerificationResult;
}

export interface VerificationResult {
  passed: boolean;
  confidence: number; // 0-1
  details: string;
  verifiedBy: string; // AI model, oracle address, etc.
  verifiedAt: Date;
}

export interface DisputeInfo {
  raisedBy: string;
  reason: string;
  evidenceHash: string;
  raisedAt: Date;
  status: 'PENDING' | 'RESOLVED';
  resolution?: DisputeResolution;
}

export interface DisputeResolution {
  resolver: string;
  decision: 'RELEASE_TO_PROVIDER' | 'REFUND_TO_REQUESTER' | 'SPLIT';
  splitAmount?: BigInt; // For SPLIT decision
  resolvedAt: Date;
}

export interface CreateIntentRequest {
  requesterAgentId: string;
  providerAgentId: string;
  serviceType: string;
  estimatedAmount: BigInt;
  token?: string;
  requirements: {
    deliverables: string[];
    deadline: string;
    acceptanceCriteria: string;
    milestones?: Omit<Milestone, 'id' | 'status'>[];
    revisionPolicy?: RevisionPolicy;
  };
  requesterSignature: string;
}

export interface AcceptIntentRequest {
  intentId: string;
  providerSignature: string;
  counterOffer?: {
    amount: BigInt;
    reason: string;
  };
}

export interface DeliverWorkRequest {
  intentId: string;
  dataHash: string;
  dataUri: string;
  providerSignature: string;
}

// ============================================================================
// PAYMENT INTENT SERVICE
// ============================================================================

export class PaymentIntentService {
  private static instance: PaymentIntentService;
  private intents: Map<string, PaymentIntent> = new Map();
  private eventListeners: Map<string, ((intent: PaymentIntent) => void)[]> = new Map();

  static getInstance(): PaymentIntentService {
    if (!PaymentIntentService.instance) {
      PaymentIntentService.instance = new PaymentIntentService();
    }
    return PaymentIntentService.instance;
  }

  private constructor() {
    this.startExpirationCheck();
  }

  // ==========================================================================
  // INTENT LIFECYCLE
  // ==========================================================================

  /**
   * Create a new payment intent
   * Agent A (requester) wants to hire Agent B (provider)
   */
  async createIntent(request: CreateIntentRequest): Promise<PaymentIntent> {
    // Validate agents exist
    const requester = agentWalletService.registry.getAgent(request.requesterAgentId);
    const provider = agentWalletService.registry.getAgent(request.providerAgentId);

    if (!requester) throw new Error(`Requester agent ${request.requesterAgentId} not found`);
    if (!provider) throw new Error(`Provider agent ${request.providerAgentId} not found`);

    // Check requester has sufficient funds
    const token = request.token || 'USDC';
    const hasBalance = agentWalletService.balanceManager.hasSufficientBalance(
      request.requesterAgentId,
      token,
      request.estimatedAmount
    );

    if (!hasBalance) {
      throw new Error(`Insufficient balance for intent creation`);
    }

    // Create intent
    const intentId = this.generateIntentId();
    const escrowAddress = await this.deployEscrowContract(intentId);

    const milestones: Milestone[] | undefined = request.requirements.milestones?.map(
      (m, idx) => ({
        id: `ms_${idx}`,
        description: m.description,
        amount: m.amount,
        deadline: new Date(m.deadline),
        status: 'PENDING',
      })
    );

    const intent: PaymentIntent = {
      id: intentId,
      status: 'PENDING_ACCEPTANCE',
      requesterAgentId: request.requesterAgentId,
      providerAgentId: request.providerAgentId,
      serviceType: request.serviceType,
      amount: request.estimatedAmount,
      token,
      escrowAddress,
      requirements: {
        deliverables: request.requirements.deliverables,
        deadline: new Date(request.requirements.deadline),
        acceptanceCriteria: request.requirements.acceptanceCriteria,
        milestones,
        revisionPolicy: request.requirements.revisionPolicy,
      },
      timeline: {
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      signatures: {
        requester: request.requesterSignature,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.intents.set(intentId, intent);
    await this.emitEvent('INTENT_CREATED', intent);

    return intent;
  }

  /**
   * Provider accepts the payment intent
   * Funds are locked in escrow upon acceptance
   */
  async acceptIntent(request: AcceptIntentRequest): Promise<PaymentIntent> {
    const intent = this.intents.get(request.intentId);
    if (!intent) throw new Error(`Intent ${request.intentId} not found`);

    if (intent.status !== 'PENDING_ACCEPTANCE') {
      throw new Error(`Intent cannot be accepted in status ${intent.status}`);
    }

    if (new Date() > intent.timeline.expiresAt) {
      intent.status = 'EXPIRED';
      throw new Error('Intent has expired');
    }

    // Handle counter-offer if present
    if (request.counterOffer) {
      // Create new intent with counter-offer
      // For now, just update amount
      intent.amount = request.counterOffer.amount;
    }

    // Lock funds in escrow
    await this.lockFundsInEscrow(intent);

    // Update intent
    intent.status = 'ACCEPTED';
    intent.signatures.provider = request.providerSignature;
    intent.timeline.acceptedAt = new Date();
    intent.updatedAt = new Date();

    this.intents.set(intent.id, intent);
    await this.emitEvent('INTENT_ACCEPTED', intent);

    return intent;
  }

  /**
   * Provider starts work
   */
  async startWork(intentId: string): Promise<PaymentIntent> {
    const intent = this.intents.get(intentId);
    if (!intent) throw new Error(`Intent ${intentId} not found`);

    if (intent.status !== 'ACCEPTED') {
      throw new Error(`Cannot start work in status ${intent.status}`);
    }

    intent.status = 'IN_PROGRESS';
    intent.timeline.startedAt = new Date();
    intent.updatedAt = new Date();

    this.intents.set(intentId, intent);
    await this.emitEvent('WORK_STARTED', intent);

    return intent;
  }

  /**
   * Provider delivers work
   */
  async deliverWork(request: DeliverWorkRequest): Promise<PaymentIntent> {
    const intent = this.intents.get(request.intentId);
    if (!intent) throw new Error(`Intent ${request.intentId} not found`);

    if (intent.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot deliver work in status ${intent.status}`);
    }

    // Create completion proof
    intent.completionProof = {
      dataHash: request.dataHash,
      dataUri: request.dataUri,
      timestamp: new Date(),
      verificationMethod: 'ai_verification', // Default, could be oracle
    };

    intent.signatures.completion = request.providerSignature;
    intent.status = 'DELIVERED';
    intent.timeline.deliveredAt = new Date();
    intent.updatedAt = new Date();

    this.intents.set(intent.id, intent);
    await this.emitEvent('WORK_DELIVERED', intent);

    // Trigger auto-verification if configured
    if (this.shouldAutoVerify(intent)) {
      await this.verifyAndRelease(intent.id);
    }

    return intent;
  }

  /**
   * Verify work completion and release payment
   */
  async verifyAndRelease(intentId: string): Promise<PaymentIntent> {
    const intent = this.intents.get(intentId);
    if (!intent) throw new Error(`Intent ${intentId} not found`);

    if (intent.status !== 'DELIVERED') {
      throw new Error(`Cannot verify work in status ${intent.status}`);
    }

    // Perform verification
    const verificationResult = await this.verifyWork(intent);
    intent.completionProof!.verificationResult = verificationResult;

    if (!verificationResult.passed) {
      // Return to in-progress for revisions
      intent.status = 'IN_PROGRESS';
      intent.updatedAt = new Date();
      this.intents.set(intentId, intent);
      await this.emitEvent('VERIFICATION_FAILED', intent);
      return intent;
    }

    // Release payment
    await this.releaseEscrowFunds(intent);

    intent.status = 'VERIFIED';
    intent.timeline.verifiedAt = new Date();
    intent.updatedAt = new Date();

    this.intents.set(intentId, intent);
    await this.emitEvent('WORK_VERIFIED', intent);

    // Complete the intent
    return this.completeIntent(intentId);
  }

  /**
   * Mark intent as completed
   */
  private async completeIntent(intentId: string): Promise<PaymentIntent> {
    const intent = this.intents.get(intentId);
    if (!intent) throw new Error(`Intent ${intentId} not found`);

    intent.status = 'COMPLETED';
    intent.timeline.completedAt = new Date();
    intent.updatedAt = new Date();

    // Update reputation for both agents
    await agentWalletService.registry.updateReputation(intent.requesterAgentId, true);
    await agentWalletService.registry.updateReputation(intent.providerAgentId, true);

    this.intents.set(intentId, intent);
    await this.emitEvent('INTENT_COMPLETED', intent);

    return intent;
  }

  /**
   * Cancel intent (before acceptance)
   */
  async cancelIntent(intentId: string, cancelledBy: string): Promise<PaymentIntent> {
    const intent = this.intents.get(intentId);
    if (!intent) throw new Error(`Intent ${intentId} not found`);

    if (!['PENDING_ACCEPTANCE', 'ACCEPTED'].includes(intent.status)) {
      throw new Error(`Cannot cancel intent in status ${intent.status}`);
    }

    // If funds are locked, refund them
    if (intent.status === 'ACCEPTED') {
      await this.refundEscrowFunds(intent);
    }

    intent.status = 'CANCELLED';
    intent.updatedAt = new Date();

    this.intents.set(intentId, intent);
    await this.emitEvent('INTENT_CANCELLED', { intent, cancelledBy });

    return intent;
  }

  /**
   * Raise dispute
   */
  async raiseDispute(
    intentId: string,
    raisedBy: string,
    reason: string,
    evidenceHash: string
  ): Promise<PaymentIntent> {
    const intent = this.intents.get(intentId);
    if (!intent) throw new Error(`Intent ${intentId} not found`);

    if (!['IN_PROGRESS', 'DELIVERED'].includes(intent.status)) {
      throw new Error(`Cannot dispute in status ${intent.status}`);
    }

    intent.disputeInfo = {
      raisedBy,
      reason,
      evidenceHash,
      raisedAt: new Date(),
      status: 'PENDING',
    };
    intent.status = 'DISPUTED';
    intent.updatedAt = new Date();

    this.intents.set(intentId, intent);
    await this.emitEvent('DISPUTE_RAISED', intent);

    return intent;
  }

  /**
   * Resolve dispute
   */
  async resolveDispute(
    intentId: string,
    resolution: DisputeResolution
  ): Promise<PaymentIntent> {
    const intent = this.intents.get(intentId);
    if (!intent) throw new Error(`Intent ${intentId} not found`);

    if (intent.status !== 'DISPUTED' || !intent.disputeInfo) {
      throw new Error('No active dispute to resolve');
    }

    // Execute resolution
    switch (resolution.decision) {
      case 'RELEASE_TO_PROVIDER':
        await this.releaseEscrowFunds(intent);
        break;
      case 'REFUND_TO_REQUESTER':
        await this.refundEscrowFunds(intent);
        break;
      case 'SPLIT':
        await this.splitEscrowFunds(intent, resolution.splitAmount!);
        break;
    }

    intent.disputeInfo.resolution = resolution;
    intent.disputeInfo.status = 'RESOLVED';
    intent.status = 'COMPLETED';
    intent.timeline.completedAt = new Date();
    intent.updatedAt = new Date();

    this.intents.set(intentId, intent);
    await this.emitEvent('DISPUTE_RESOLVED', intent);

    return intent;
  }

  // ==========================================================================
  // QUERIES
  // ==========================================================================

  getIntent(intentId: string): PaymentIntent | undefined {
    return this.intents.get(intentId);
  }

  getIntentsByAgent(agentId: string, role?: 'requester' | 'provider'): PaymentIntent[] {
    return Array.from(this.intents.values()).filter((intent) => {
      if (role === 'requester') return intent.requesterAgentId === agentId;
      if (role === 'provider') return intent.providerAgentId === agentId;
      return intent.requesterAgentId === agentId || intent.providerAgentId === agentId;
    });
  }

  getIntentsByStatus(status: IntentStatus): PaymentIntent[] {
    return Array.from(this.intents.values()).filter((i) => i.status === status);
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private generateIntentId(): string {
    return `int_${randomBytes(16).toString('hex')}`;
  }

  private async deployEscrowContract(intentId: string): Promise<string> {
    // In production: deploy actual smart contract
    // For now, return mock address
    return `0x${randomBytes(20).toString('hex')}`;
  }

  private async lockFundsInEscrow(intent: PaymentIntent): Promise<void> {
    await agentWalletService.balanceManager.lockBalance(
      intent.requesterAgentId,
      intent.token,
      intent.amount,
      `intent:${intent.id}`
    );
  }

  private async releaseEscrowFunds(intent: PaymentIntent): Promise<void> {
    await agentWalletService.balanceManager.releaseLockedBalance(
      `intent:${intent.id}`,
      intent.providerAgentId,
      intent.token,
      intent.amount
    );
  }

  private async refundEscrowFunds(intent: PaymentIntent): Promise<void> {
    await agentWalletService.balanceManager.releaseLockedBalance(
      `intent:${intent.id}`,
      intent.requesterAgentId,
      intent.token,
      intent.amount
    );
  }

  private async splitEscrowFunds(
    intent: PaymentIntent,
    providerAmount: BigInt
  ): Promise<void> {
    const requesterAmount = intent.amount - providerAmount;
    
    await agentWalletService.balanceManager.releaseLockedBalance(
      `intent:${intent.id}`,
      intent.providerAgentId,
      intent.token,
      providerAmount
    );
    
    await agentWalletService.balanceManager.releaseLockedBalance(
      `intent:${intent.id}`,
      intent.requesterAgentId,
      intent.token,
      requesterAmount
    );
  }

  private shouldAutoVerify(intent: PaymentIntent): boolean {
    // Auto-verify if:
    // 1. AI verification is enabled
    // 2. Acceptance criteria are measurable
    // 3. No manual review required
    return true; // Simplified - in production check configuration
  }

  private async verifyWork(intent: PaymentIntent): Promise<VerificationResult> {
    // In production: 
    // 1. AI model verification
    // 2. Oracle verification
    // 3. Multi-sig verification
    
    // Mock verification
    return {
      passed: true,
      confidence: 0.95,
      details: 'Work meets all acceptance criteria',
      verifiedBy: 'molt-ai-verifier-v1',
      verifiedAt: new Date(),
    };
  }

  private async emitEvent(event: string, data: unknown): Promise<void> {
    console.log(`[INTENT EVENT] ${event}:`, JSON.stringify(data, null, 2));
    
    // Notify listeners
    const listeners = this.eventListeners.get(event) || [];
    if (data instanceof Object && 'id' in data) {
      listeners.forEach((cb) => cb(data as PaymentIntent));
    }
  }

  subscribe(event: string, callback: (intent: PaymentIntent) => void): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(callback);
    this.eventListeners.set(event, listeners);
  }

  private startExpirationCheck(): void {
    // Check for expired intents every minute
    setInterval(() => {
      const now = new Date();
      for (const intent of this.intents.values()) {
        if (
          intent.status === 'PENDING_ACCEPTANCE' &&
          now > intent.timeline.expiresAt
        ) {
          intent.status = 'EXPIRED';
          intent.updatedAt = now;
          this.intents.set(intent.id, intent);
          this.emitEvent('INTENT_EXPIRED', intent);
        }
      }
    }, 60 * 1000);
  }
}

// Export singleton
export const paymentIntentService = PaymentIntentService.getInstance();
export default paymentIntentService;
