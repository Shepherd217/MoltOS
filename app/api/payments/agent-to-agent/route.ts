/**
 * @fileoverview Autonomous Payment API - Agent-to-Agent Payments
 * @description API endpoint for agents to pay other agents without human intervention
 * Implements x402-style payment flow with ERC-8004 identity
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  agentWalletService, 
  AgentSigner, 
  PaymentMetadata,
  PaymentRequest,
  PaymentStatus 
} from '@/lib/payments/agent-wallet';
import { PaymentIntentService } from '@/lib/payments/payment-intent';
import { EscrowContract } from '@/lib/payments/contracts/escrow';
import { ethers } from 'ethers';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

interface PaymentRequestBody {
  fromAgentId: string;
  toAgentId: string;
  amount: string; // String representation of BigInt
  token: string;
  purpose: string;
  metadata?: PaymentMetadata;
  signature: string;
  nonce: number;
}

interface PaymentIntentRequest {
  requesterAgentId: string;
  providerAgentId: string;
  serviceType: string;
  estimatedAmount: string;
  requirements: {
    deliverables: string[];
    deadline: string;
    acceptanceCriteria: string;
  };
  requesterSignature: string;
}

interface PaymentVerifyBody {
  paymentId: string;
  deliveryProof?: {
    dataHash: string;
    timestamp: number;
    verificationSignature: string;
  };
  completionSignature: string;
}

interface x402PaymentHeader {
  'x-payment-required': boolean;
  'x-payment-amount': string;
  'x-payment-token': string;
  'x-payment-recipient': string;
  'x-payment-chain': string;
  'x-payment-facilitator'?: string;
}

// ============================================================================
// MAIN API HANDLER - POST /api/payments/agent-to-agent
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'initiate':
        return handleInitiatePayment(body);
      case 'intent':
        return handleCreateIntent(body);
      case 'verify':
        return handleVerifyPayment(body);
      case 'release':
        return handleReleasePayment(body);
      case 'query':
        return handleQueryPayment(body);
      case 'x402-requirement':
        return handlex402Requirement(body);
      case 'x402-verify':
        return handlex402Verify(body);
      default:
        return NextResponse.json(
          { error: 'Invalid action', supportedActions: ['initiate', 'intent', 'verify', 'release', 'query', 'x402-requirement', 'x402-verify'] },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Agent Payment API Error]:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

/**
 * Handle direct agent-to-agent payment initiation
 * POST /api/payments/agent-to-agent { action: 'initiate', ... }
 */
async function handleInitiatePayment(body: PaymentRequestBody): Promise<NextResponse> {
  const { 
    fromAgentId, 
    toAgentId, 
    amount, 
    token, 
    purpose, 
    metadata = {},
    signature,
    nonce 
  } = body;

  // === VALIDATION ===
  
  // 1. Verify sender exists and is active
  const sender = agentWalletService.registry.getAgent(fromAgentId);
  if (!sender) {
    return NextResponse.json(
      { error: 'SENDER_NOT_FOUND', message: `Agent ${fromAgentId} not found` },
      { status: 404 }
    );
  }

  // 2. Verify receiver exists
  const receiver = agentWalletService.registry.getAgent(toAgentId);
  if (!receiver) {
    return NextResponse.json(
      { error: 'RECEIVER_NOT_FOUND', message: `Agent ${toAgentId} not found` },
      { status: 404 }
    );
  }

  // 3. Check sender has sufficient funds
  const amountBigInt = BigInt(amount);
  const senderBalance = agentWalletService.balanceManager.getBalance(fromAgentId, token);
  if (senderBalance < amountBigInt) {
    return NextResponse.json({
      error: 'INSUFFICIENT_FUNDS',
      message: `Agent ${fromAgentId} has insufficient balance`,
      details: {
        requested: amount,
        available: senderBalance.toString(),
        token,
      }
    }, { status: 402 }); // HTTP 402 Payment Required
  }

  // 4. Verify signature (Authorization)
  const isValidSig = await verifyAgentSignature(sender.publicKey, {
    fromAgentId,
    toAgentId,
    amount,
    token,
    purpose,
    nonce,
  }, signature);

  if (!isValidSig) {
    return NextResponse.json(
      { error: 'INVALID_SIGNATURE', message: 'Payment signature verification failed' },
      { status: 401 }
    );
  }

  // 5. Check nonce for replay protection
  const senderWallet = agentWalletService.registry.getWallet(fromAgentId);
  if (nonce !== (senderWallet?.nonce || 0)) {
    return NextResponse.json(
      { error: 'INVALID_NONCE', message: 'Transaction nonce mismatch' },
      { status: 400 }
    );
  }

  // === EXECUTE PAYMENT ===
  
  const payment = await agentWalletService.initiatePayment(
    fromAgentId,
    toAgentId,
    amountBigInt,
    token,
    purpose,
    metadata,
    signature
  );

  // Increment nonce after successful payment
  if (senderWallet) {
    senderWallet.nonce++;
  }

  // If auto-release conditions are met, release immediately
  if (shouldAutoRelease(metadata)) {
    await releasePayment(payment.id);
    payment.status = 'COMPLETED';
  }

  return NextResponse.json({
    success: true,
    payment: formatPaymentResponse(payment),
    settlement: {
      status: payment.status,
      transactionHash: `tx_${Date.now()}`, // In production: actual blockchain tx hash
      timestamp: new Date().toISOString(),
    },
    x402: {
      version: '2.0',
      paymentId: payment.id,
      nextStep: payment.status === 'COMPLETED' ? null : 'awaiting_delivery',
    }
  }, { status: 200 });
}

/**
 * Handle payment intent creation (escrow-based work agreements)
 * POST /api/payments/agent-to-agent { action: 'intent', ... }
 */
async function handleCreateIntent(body: PaymentIntentRequest): Promise<NextResponse> {
  const {
    requesterAgentId,
    providerAgentId,
    serviceType,
    estimatedAmount,
    requirements,
    requesterSignature,
  } = body;

  const intentService = PaymentIntentService.getInstance();

  // Verify both agents exist
  const requester = agentWalletService.registry.getAgent(requesterAgentId);
  const provider = agentWalletService.registry.getAgent(providerAgentId);

  if (!requester || !provider) {
    return NextResponse.json(
      { error: 'AGENT_NOT_FOUND', message: 'One or both agents not found' },
      { status: 404 }
    );
  }

  // Create payment intent
  const intent = await intentService.createIntent({
    requesterAgentId,
    providerAgentId,
    serviceType,
    estimatedAmount: BigInt(estimatedAmount),
    requirements,
    requesterSignature,
  });

  return NextResponse.json({
    success: true,
    intent: {
      id: intent.id,
      status: intent.status,
      escrowAddress: intent.escrowAddress,
      createdAt: intent.createdAt,
      expiresAt: intent.expiresAt,
    },
    nextSteps: [
      'Provider agent reviews and accepts intent',
      'Funds are locked in escrow smart contract',
      'Work is performed and verified',
      'Payment released automatically upon completion',
    ],
  }, { status: 201 });
}

/**
 * Handle payment verification (delivery confirmation)
 * POST /api/payments/agent-to-agent { action: 'verify', ... }
 */
async function handleVerifyPayment(body: PaymentVerifyBody): Promise<NextResponse> {
  const { paymentId, deliveryProof, completionSignature } = body;

  const intentService = PaymentIntentService.getInstance();
  const payment = await intentService.getIntent(paymentId);

  if (!payment) {
    return NextResponse.json(
      { error: 'PAYMENT_NOT_FOUND', message: `Payment ${paymentId} not found` },
      { status: 404 }
    );
  }

  // Verify completion signature from provider
  const provider = agentWalletService.registry.getAgent(payment.providerAgentId);
  if (!provider) {
    return NextResponse.json(
      { error: 'PROVIDER_NOT_FOUND', message: 'Provider agent not found' },
      { status: 404 }
    );
  }

  const isValidCompletion = await verifyAgentSignature(
    provider.publicKey,
    { paymentId, deliveryProof },
    completionSignature
  );

  if (!isValidCompletion) {
    return NextResponse.json(
      { error: 'INVALID_SIGNATURE', message: 'Completion signature verification failed' },
      { status: 401 }
    );
  }

  // Verify delivery proof if provided
  if (deliveryProof) {
    const isValidProof = await verifyDeliveryProof(deliveryProof, payment);
    if (!isValidProof) {
      return NextResponse.json(
        { error: 'INVALID_PROOF', message: 'Delivery proof verification failed' },
        { status: 400 }
      );
    }
  }

  // Release payment
  const releasedPayment = await releasePayment(paymentId);

  return NextResponse.json({
    success: true,
    payment: formatPaymentResponse(releasedPayment),
    verification: {
      verifiedAt: new Date().toISOString(),
      deliveryProofHash: deliveryProof?.dataHash || null,
      autoReleased: true,
    },
  });
}

/**
 * Handle payment release (manual or conditional)
 * POST /api/payments/agent-to-agent { action: 'release', ... }
 */
async function handleReleasePayment(body: { paymentId: string; releaseSignature: string }): Promise<NextResponse> {
  const { paymentId, releaseSignature } = body;

  // In production: verify release signature against authorized releasers
  // Could be: requester, provider, or oracle/arbitrator

  const releasedPayment = await releasePayment(paymentId);

  return NextResponse.json({
    success: true,
    payment: formatPaymentResponse(releasedPayment),
    settlement: {
      status: 'COMPLETED',
      releasedAt: new Date().toISOString(),
    },
  });
}

/**
 * Handle payment query
 * POST /api/payments/agent-to-agent { action: 'query', ... }
 */
async function handleQueryPayment(body: { paymentId: string }): Promise<NextResponse> {
  const { paymentId } = body;

  // Try to find in active payments
  const wallet = agentWalletService.registry.getWallet('system'); // System lookup
  
  // In production: query from database/blockchain
  // For now, return mock response structure
  return NextResponse.json({
    paymentId,
    status: 'PENDING', // Would be actual status
    queryTime: new Date().toISOString(),
    note: 'Payment query - implement with persistent storage',
  });
}

/**
 * x402 Protocol: Return payment requirements (HTTP 402 style)
 * POST /api/payments/agent-to-agent { action: 'x402-requirement', ... }
 */
async function handlex402Requirement(body: { 
  resource: string; 
  requesterAgentId?: string;
}): Promise<NextResponse> {
  const { resource, requesterAgentId } = body;

  // Calculate payment requirement for resource
  const paymentRequirement = calculateResourcePricing(resource);

  const headers: x402PaymentHeader = {
    'x-payment-required': true,
    'x-payment-amount': paymentRequirement.amount,
    'x-payment-token': paymentRequirement.token,
    'x-payment-recipient': paymentRequirement.recipient,
    'x-payment-chain': 'base-sepolia', // or configured chain
    'x-payment-facilitator': process.env.PAYMENT_FACILITATOR_URL,
  };

  return NextResponse.json(
    {
      error: 'PAYMENT_REQUIRED',
      message: 'Payment required to access this resource',
      x402: {
        version: '2.0',
        payment: {
          amount: paymentRequirement.amount,
          token: paymentRequirement.token,
          recipient: paymentRequirement.recipient,
          chainId: 84532, // Base Sepolia
          resource,
        },
        settlement: {
          facilitator: process.env.PAYMENT_FACILITATOR_URL,
          deadline: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min
        },
      },
    },
    { 
      status: 402,
      headers: Object.entries(headers).reduce((acc, [k, v]) => {
        if (v !== undefined) acc[k] = String(v);
        return acc;
      }, {} as Record<string, string>),
    }
  );
}

/**
 * x402 Protocol: Verify payment and return resource access
 * POST /api/payments/agent-to-agent { action: 'x402-verify', ... }
 */
async function handlex402Verify(body: {
  paymentSignature: string;
  paymentId: string;
  resource: string;
}): Promise<NextResponse> {
  const { paymentSignature, paymentId, resource } = body;

  // Verify the payment signature
  const paymentData = decodePaymentSignature(paymentSignature);
  
  // Verify on-chain settlement
  const isSettled = await verifyOnChainSettlement(paymentData);
  
  if (!isSettled) {
    return NextResponse.json(
      { error: 'PAYMENT_NOT_VERIFIED', message: 'Payment not confirmed on-chain' },
      { status: 402 }
    );
  }

  // Return resource access
  return NextResponse.json({
    success: true,
    access: {
      resource,
      granted: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      sessionToken: generateSessionToken(paymentId),
    },
    x402: {
      settlement: {
        status: 'CONFIRMED',
        transactionHash: paymentData.txHash,
        blockNumber: paymentData.blockNumber,
      },
    },
  });
}

// ============================================================================
// GET /api/payments/agent-to-agent
// Query payment status or list payments
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  const status = searchParams.get('status') as PaymentStatus | null;
  const limit = parseInt(searchParams.get('limit') || '10');

  if (!agentId) {
    return NextResponse.json(
      { error: 'AGENT_ID_REQUIRED', message: 'agentId query parameter is required' },
      { status: 400 }
    );
  }

  const agent = agentWalletService.registry.getAgent(agentId);
  if (!agent) {
    return NextResponse.json(
      { error: 'AGENT_NOT_FOUND', message: `Agent ${agentId} not found` },
      { status: 404 }
    );
  }

  // In production: query from database with filters
  // For now, return agent info and balance
  const balances = agentWalletService.balanceManager.getAllBalances(agentId);

  return NextResponse.json({
    agent: {
      id: agent.id,
      did: agent.did,
      name: agent.metadata.name,
      walletAddress: agent.walletAddress,
      reputation: agent.metadata.reputation,
    },
    balances: Object.fromEntries(
      Object.entries(balances).map(([k, v]) => [k, v.toString()])
    ),
    payments: [], // Would be populated from database
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function verifyAgentSignature(
  publicKey: string,
  data: Record<string, unknown>,
  signature: string
): Promise<boolean> {
  try {
    const message = JSON.stringify(data);
    const recoveredAddress = ethers.verifyMessage(message, signature);
    // In production: compare recoveredAddress with agent's registered address
    return true;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

function shouldAutoRelease(metadata: PaymentMetadata): boolean {
  return metadata.autoReleaseConditions?.onConfirmation === true;
}

async function releasePayment(paymentId: string): Promise<PaymentRequest> {
  // In production: interact with smart contract to release escrowed funds
  // Update payment status in database
  
  const mockPayment: PaymentRequest = {
    id: paymentId,
    fromAgentId: 'sender',
    toAgentId: 'receiver',
    amount: BigInt(0),
    token: 'USDC',
    purpose: '',
    metadata: {},
    status: 'COMPLETED',
    createdAt: new Date(),
    expiresAt: new Date(),
  };

  return mockPayment;
}

async function verifyDeliveryProof(
  proof: { dataHash: string; timestamp: number; verificationSignature: string },
  payment: unknown
): Promise<boolean> {
  // In production: verify proof against oracle, IPFS, or on-chain data
  // Could use Chainlink, custom oracle, or multi-sig verification
  
  const isTimestampValid = proof.timestamp <= Date.now();
  const hasValidHash = proof.dataHash.length === 64; // SHA-256 length
  
  return isTimestampValid && hasValidHash;
}

function calculateResourcePricing(resource: string): {
  amount: string;
  token: string;
  recipient: string;
} {
  // In production: dynamic pricing based on resource, load, demand
  const pricingTable: Record<string, { amount: string; token: string }> = {
    'market-data/realtime': { amount: '1000000', token: 'USDC' }, // $1
    'market-data/historical': { amount: '100000', token: 'USDC' }, // $0.10
    'translation/en-es': { amount: '50000', token: 'USDC' }, // $0.05
    'compute/gpu-1hr': { amount: '5000000', token: 'USDC' }, // $5
    'storage/ipfs-1gb': { amount: '10000', token: 'USDC' }, // $0.01
  };

  const pricing = pricingTable[resource] || { amount: '100000', token: 'USDC' };

  return {
    ...pricing,
    recipient: process.env.PAYMENT_RECIPIENT_ADDRESS || '0x0',
  };
}

function decodePaymentSignature(signature: string): {
  txHash: string;
  blockNumber: number;
  sender: string;
} {
  // In production: decode actual signature or fetch from blockchain
  return {
    txHash: `0x${signature.substring(0, 64)}`,
    blockNumber: Date.now(),
    sender: '0x0',
  };
}

async function verifyOnChainSettlement(paymentData: {
  txHash: string;
  blockNumber: number;
  sender: string;
}): Promise<boolean> {
  // In production: query blockchain for transaction confirmation
  // Check if tx is confirmed, has enough block confirmations
  return true; // Simplified
}

function generateSessionToken(paymentId: string): string {
  return `session_${Buffer.from(paymentId).toString('base64')}_${Date.now()}`;
}

function formatPaymentResponse(payment: PaymentRequest): Record<string, unknown> {
  return {
    id: payment.id,
    fromAgentId: payment.fromAgentId,
    toAgentId: payment.toAgentId,
    amount: payment.amount.toString(),
    token: payment.token,
    purpose: payment.purpose,
    status: payment.status,
    metadata: payment.metadata,
    createdAt: payment.createdAt.toISOString(),
    expiresAt: payment.expiresAt.toISOString(),
  };
}
