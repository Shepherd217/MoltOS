/**
 * @fileoverview Agent Wallet Service
 * @description Core wallet management system for AI agents in MoltOS
 * Each agent gets a wallet address, can hold balances, and initiate payments
 * @version 1.0.0
 */

import { ethers } from 'ethers';
import { createHash, randomBytes } from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface AgentIdentity {
  id: string;
  did: string; // Decentralized Identifier (ERC-8004 compatible)
  walletAddress: string;
  publicKey: string;
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

export interface AgentWallet {
  identity: AgentIdentity;
  balances: Record<string, BigInt>; // tokenAddress => balance
  allowances: Record<string, Record<string, BigInt>>; // token => spender => amount
  nonce: number;
  isActive: boolean;
}

export interface PaymentRequest {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  amount: BigInt;
  token: string; // USDC, ETH, etc.
  purpose: string;
  metadata: PaymentMetadata;
  status: PaymentStatus;
  createdAt: Date;
  expiresAt: Date;
}

export interface PaymentMetadata {
  serviceType: string;
  requestId?: string;
  dataHash?: string;
  deliveryTerms?: DeliveryTerms;
  autoReleaseConditions?: AutoReleaseConditions;
}

export interface DeliveryTerms {
  deadline: Date;
  deliverables: string[];
  acceptanceCriteria: string;
}

export interface AutoReleaseConditions {
  onConfirmation: boolean;
  onDeliveryProof: boolean;
  oracleVerification?: string;
}

export type PaymentStatus = 
  | 'PENDING'
  | 'AUTHORIZED'
  | 'ESCROWED'
  | 'COMPLETED'
  | 'FAILED'
  | 'DISPUTED'
  | 'REFUNDED';

export interface SignedPayment {
  payment: PaymentRequest;
  signature: string;
  hash: string;
  timestamp: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPPORTED_TOKENS: Record<string, TokenConfig> = {
  USDC: {
    address: '0xA0b86a33E6441e0A421e56E4773C3C4b0Db7E5e0',
    decimals: 6,
    symbol: 'USDC',
    name: 'USD Coin',
    isStablecoin: true,
  },
  ETH: {
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    symbol: 'ETH',
    name: 'Ethereum',
    isStablecoin: false,
  },
  MOLT: {
    address: '0x1234567890123456789012345678901234567890',
    decimals: 18,
    symbol: 'MOLT',
    name: 'MoltOS Token',
    isStablecoin: false,
  },
};

interface TokenConfig {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  isStablecoin: boolean;
}

// ============================================================================
// AGENT REGISTRY
// ============================================================================

class AgentRegistry {
  private agents: Map<string, AgentIdentity> = new Map();
  private wallets: Map<string, AgentWallet> = new Map();
  private didToAgent: Map<string, string> = new Map();
  private addressToAgent: Map<string, string> = new Map();

  /**
   * Register a new agent in the system
   */
  async registerAgent(
    name: string,
    description: string,
    capabilities: string[],
    initialPublicKey?: string
  ): Promise<AgentIdentity> {
    const id = this.generateAgentId();
    const wallet = this.generateAgentWallet();
    
    const identity: AgentIdentity = {
      id,
      did: `did:molt:${id}`,
      walletAddress: wallet.address,
      publicKey: initialPublicKey || wallet.publicKey,
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

    const agentWallet: AgentWallet = {
      identity,
      balances: {},
      allowances: {},
      nonce: 0,
      isActive: true,
    };

    // Store in registry
    this.agents.set(id, identity);
    this.wallets.set(id, agentWallet);
    this.didToAgent.set(identity.did, id);
    this.addressToAgent.set(wallet.address, id);

    // Emit registration event
    await this.emitEvent('AGENT_REGISTERED', {
      agentId: id,
      did: identity.did,
      walletAddress: wallet.address,
      timestamp: new Date().toISOString(),
    });

    return identity;
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
   * Get agent by wallet address
   */
  getAgentByAddress(address: string): AgentIdentity | undefined {
    const agentId = this.addressToAgent.get(address.toLowerCase());
    return agentId ? this.agents.get(agentId) : undefined;
  }

  /**
   * Get agent wallet
   */
  getWallet(agentId: string): AgentWallet | undefined {
    return this.wallets.get(agentId);
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
    const ageFactor = Math.min(1, rep.totalTransactions / 100); // Full weight at 100 txns
    rep.score = Math.round(50 + (successRate - 0.5) * 50 * ageFactor);
    rep.lastUpdated = new Date();

    agent.updatedAt = new Date();
  }

  /**
   * Deactivate an agent
   */
  async deactivateAgent(agentId: string): Promise<void> {
    const wallet = this.wallets.get(agentId);
    if (wallet) {
      wallet.isActive = false;
    }
  }

  /**
   * List all active agents
   */
  listActiveAgents(): AgentIdentity[] {
    return Array.from(this.agents.values()).filter(
      (agent) => this.wallets.get(agent.id)?.isActive
    );
  }

  /**
   * Find agents by capability
   */
  findAgentsByCapability(capability: string): AgentIdentity[] {
    return this.listActiveAgents().filter((agent) =>
      agent.metadata.capabilities.includes(capability)
    );
  }

  // Private helpers
  private generateAgentId(): string {
    return `ag_${randomBytes(16).toString('hex').substring(0, 16)}`;
  }

  private generateAgentWallet(): { address: string; privateKey: string; publicKey: string } {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
    };
  }

  private async emitEvent(event: string, data: unknown): Promise<void> {
    // In production, this would emit to event bus
    console.log(`[EVENT] ${event}:`, JSON.stringify(data, null, 2));
  }
}

// ============================================================================
// BALANCE MANAGER
// ============================================================================

class BalanceManager {
  constructor(private registry: AgentRegistry) {}

  /**
   * Get agent balance for a specific token
   */
  getBalance(agentId: string, token: string): BigInt {
    const wallet = this.registry.getWallet(agentId);
    if (!wallet) throw new Error(`Wallet not found for agent ${agentId}`);
    return wallet.balances[token] || BigInt(0);
  }

  /**
   * Credit balance to agent
   */
  async credit(agentId: string, token: string, amount: BigInt): Promise<void> {
    const wallet = this.registry.getWallet(agentId);
    if (!wallet) throw new Error(`Wallet not found for agent ${agentId}`);

    const currentBalance = wallet.balances[token] || BigInt(0);
    wallet.balances[token] = currentBalance + amount;

    await this.emitEvent('BALANCE_CREDITED', {
      agentId,
      token,
      amount: amount.toString(),
      newBalance: wallet.balances[token].toString(),
    });
  }

  /**
   * Debit balance from agent
   */
  async debit(agentId: string, token: string, amount: BigInt): Promise<void> {
    const wallet = this.registry.getWallet(agentId);
    if (!wallet) throw new Error(`Wallet not found for agent ${agentId}`);

    const currentBalance = wallet.balances[token] || BigInt(0);
    if (currentBalance < amount) {
      throw new Error(`Insufficient balance: ${currentBalance} < ${amount}`);
    }

    wallet.balances[token] = currentBalance - amount;

    await this.emitEvent('BALANCE_DEBITED', {
      agentId,
      token,
      amount: amount.toString(),
      newBalance: wallet.balances[token].toString(),
    });
  }

  /**
   * Check if agent has sufficient balance
   */
  hasSufficientBalance(agentId: string, token: string, amount: BigInt): boolean {
    return this.getBalance(agentId, token) >= amount;
  }

  /**
   * Get all balances for an agent
   */
  getAllBalances(agentId: string): Record<string, BigInt> {
    const wallet = this.registry.getWallet(agentId);
    if (!wallet) throw new Error(`Wallet not found for agent ${agentId}`);
    return { ...wallet.balances };
  }

  /**
   * Lock balance for escrow
   */
  async lockBalance(
    agentId: string,
    token: string,
    amount: BigInt,
    purpose: string
  ): Promise<string> {
    const lockId = `lock_${randomBytes(8).toString('hex')}`;
    
    await this.debit(agentId, token, amount);
    
    await this.emitEvent('BALANCE_LOCKED', {
      lockId,
      agentId,
      token,
      amount: amount.toString(),
      purpose,
    });

    return lockId;
  }

  /**
   * Release locked balance
   */
  async releaseLockedBalance(
    lockId: string,
    toAgentId: string,
    token: string,
    amount: BigInt
  ): Promise<void> {
    await this.credit(toAgentId, token, amount);
    
    await this.emitEvent('BALANCE_RELEASED', {
      lockId,
      toAgentId,
      token,
      amount: amount.toString(),
    });
  }

  private async emitEvent(event: string, data: unknown): Promise<void> {
    console.log(`[EVENT] ${event}:`, JSON.stringify(data));
  }
}

// ============================================================================
// PAYMENT AUTHORIZER
// ============================================================================

class PaymentAuthorizer {
  constructor(
    private registry: AgentRegistry,
    private balanceManager: BalanceManager
  ) {}

  /**
   * Authorize a payment from one agent to another
   */
  async authorizePayment(
    fromAgentId: string,
    toAgentId: string,
    amount: BigInt,
    token: string,
    purpose: string,
    metadata: PaymentMetadata,
    signature: string
  ): Promise<PaymentRequest> {
    // Validate agents exist
    const fromAgent = this.registry.getAgent(fromAgentId);
    const toAgent = this.registry.getAgent(toAgentId);
    
    if (!fromAgent) throw new Error(`Sender agent ${fromAgentId} not found`);
    if (!toAgent) throw new Error(`Receiver agent ${toAgentId} not found`);
    if (!this.registry.getWallet(fromAgentId)?.isActive) {
      throw new Error(`Sender agent ${fromAgentId} is not active`);
    }

    // Validate signature
    const isValidSignature = await this.verifySignature(
      fromAgent.publicKey,
      { fromAgentId, toAgentId, amount: amount.toString(), token, purpose },
      signature
    );
    
    if (!isValidSignature) {
      throw new Error('Invalid payment signature');
    }

    // Check balance
    if (!this.balanceManager.hasSufficientBalance(fromAgentId, token, amount)) {
      throw new Error('Insufficient balance for payment');
    }

    // Create payment request
    const payment: PaymentRequest = {
      id: `pay_${randomBytes(16).toString('hex')}`,
      fromAgentId,
      toAgentId,
      amount,
      token,
      purpose,
      metadata,
      status: 'AUTHORIZED',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    // Lock funds
    await this.balanceManager.lockBalance(
      fromAgentId,
      token,
      amount,
      `payment:${payment.id}`
    );
    payment.status = 'ESCROWED';

    await this.emitEvent('PAYMENT_AUTHORIZED', {
      paymentId: payment.id,
      fromAgentId,
      toAgentId,
      amount: amount.toString(),
      token,
    });

    return payment;
  }

  /**
   * Verify payment signature
   */
  private async verifySignature(
    publicKey: string,
    data: Record<string, unknown>,
    signature: string
  ): Promise<boolean> {
    try {
      const message = JSON.stringify(data);
      const recoveredAddress = ethers.verifyMessage(message, signature);
      // In production, compare with agent's registered address
      return true; // Simplified for demo
    } catch {
      return false;
    }
  }

  private async emitEvent(event: string, data: unknown): Promise<void> {
    console.log(`[EVENT] ${event}:`, JSON.stringify(data));
  }
}

// ============================================================================
// AGENT SIGNER
// ============================================================================

export class AgentSigner {
  /**
   * Sign a payment request with agent's private key
   * In production, this would use secure key management (HSM, KMS, etc.)
   */
  static async signPayment(
    privateKey: string,
    paymentData: {
      toAgentId: string;
      amount: string;
      token: string;
      purpose: string;
      nonce: number;
    }
  ): Promise<string> {
    const wallet = new ethers.Wallet(privateKey);
    const message = JSON.stringify(paymentData);
    return await wallet.signMessage(message);
  }

  /**
   * Create payment hash for verification
   */
  static createPaymentHash(payment: Omit<PaymentRequest, 'id' | 'status'>): string {
    const data = JSON.stringify({
      fromAgentId: payment.fromAgentId,
      toAgentId: payment.toAgentId,
      amount: payment.amount.toString(),
      token: payment.token,
      purpose: payment.purpose,
      timestamp: payment.createdAt.toISOString(),
    });
    return createHash('sha256').update(data).digest('hex');
  }
}

// ============================================================================
// MAIN EXPORT - AgentWalletService
// ============================================================================

export class AgentWalletService {
  public registry: AgentRegistry;
  public balanceManager: BalanceManager;
  public authorizer: PaymentAuthorizer;

  constructor() {
    this.registry = new AgentRegistry();
    this.balanceManager = new BalanceManager(this.registry);
    this.authorizer = new PaymentAuthorizer(this.registry, this.balanceManager);
  }

  /**
   * Initialize a new agent with wallet
   */
  async createAgent(
    name: string,
    description: string,
    capabilities: string[]
  ): Promise<AgentIdentity> {
    return this.registry.registerAgent(name, description, capabilities);
  }

  /**
   * Initiate payment between agents
   */
  async initiatePayment(
    fromAgentId: string,
    toAgentId: string,
    amount: BigInt,
    token: string,
    purpose: string,
    metadata: PaymentMetadata,
    signature: string
  ): Promise<PaymentRequest> {
    return this.authorizer.authorizePayment(
      fromAgentId,
      toAgentId,
      amount,
      token,
      purpose,
      metadata,
      signature
    );
  }

  /**
   * Get supported tokens
   */
  getSupportedTokens(): typeof SUPPORTED_TOKENS {
    return SUPPORTED_TOKENS;
  }
}

// Singleton instance
export const agentWalletService = new AgentWalletService();
export default agentWalletService;
