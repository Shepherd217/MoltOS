#!/usr/bin/env node
/**
 * x402 + TAP Middleware for OpenClaw
 * 
 * Enables verified agent commerce:
 * 1. Buyer agent verifies seller via TAP Layer 3
 * 2. Payment via x402 only proceeds if attestation passes
 * 3. Seller releases service after verified payment
 */

import { createServer } from 'http';
import { sign, verify } from '@noble/ed25519';
import { ethers } from 'ethers';

// Configuration
const CONFIG = {
  // Seller's wallet for receiving payments
  sellerAddress: process.env.SELLER_ADDRESS,
  sellerPrivateKey: process.env.SELLER_PRIVATE_KEY,
  
  // TAP verification settings
  tapMinPeers: 3,
  tapTimeoutMs: 30000,
  
  // x402 settings
  network: 'base', // or 'solana'
  asset: 'USDC',
  paymentExpirySeconds: 300,
  
  // Attestation endpoint
  tapAttestEndpoint: 'https://tap-network.io/attest',
};

/**
 * Payment Required Response (HTTP 402)
 * Returns payment requirements with TAP extension
 */
function createPaymentRequired(claimId, amount) {
  const expiresAt = new Date(Date.now() + CONFIG.paymentExpirySeconds * 1000).toISOString();
  
  const paymentRequired = {
    amount: amount.toString(),
    asset: CONFIG.asset,
    payTo: CONFIG.sellerAddress,
    network: CONFIG.network,
    scheme: 'exact',
    expiresAt,
    nonce: ethers.randomBytes(32).toString('hex'),
    description: 'Verified agent service',
    extensions: {
      tap_protocol: '1.0',
      tap_claim_id: claimId,
      tap_attestation_required: true,
      tap_min_peers: CONFIG.tapMinPeers,
      tap_attest_endpoint: CONFIG.tapAttestEndpoint,
    }
  };
  
  return {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'PAYMENT-REQUIRED': Buffer.from(JSON.stringify(paymentRequired)).toString('base64'),
    },
    body: JSON.stringify({
      error: 'Payment Required',
      message: 'This service requires verified payment',
      tap_verification: 'Run TAP Layer 3 attestation before payment'
    })
  };
}

/**
 * Verify TAP Attestation
 * Checks if buyer has valid attestation from peer agents
 */
async function verifyTapAttestation(attestationData) {
  try {
    const {
      challenge_id,
      claim_id,
      result,
      attestor_peers,
      signatures
    } = attestationData;
    
    // Check minimum peers
    if (!attestor_peers || attestor_peers.length < CONFIG.tapMinPeers) {
      return { valid: false, error: `Need ${CONFIG.tapMinPeers} peers, got ${attestor_peers?.length || 0}` };
    }
    
    // Verify all signatures
    for (let i = 0; i < signatures.length; i++) {
      const sig = signatures[i];
      const peer = attestor_peers[i];
      
      // Reconstruct signed message
      const message = `TAP_ATTEST|${challenge_id}|${claim_id}|${result}|${peer.timestamp}|${peer.id}`;
      const messageBytes = new TextEncoder().encode(message);
      
      // Verify Ed25519 signature
      const publicKey = Buffer.from(peer.public_key.replace('ed25519:', ''), 'base64');
      const signature = Buffer.from(sig.replace('ed25519:', ''), 'base64');
      
      const valid = await verify(signature, messageBytes, publicKey);
      if (!valid) {
        return { valid: false, error: `Invalid signature from peer ${peer.id}` };
      }
    }
    
    // Check result is CONFIRMED
    if (result !== 'CONFIRMED') {
      return { valid: false, error: `Attestation result: ${result}` };
    }
    
    return { valid: true, peers: attestor_peers.length };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Verify x402 Payment Signature
 * Checks EIP-712 or equivalent signature
 */
async function verifyPaymentSignature(paymentSignature, paymentRequired) {
  try {
    // Decode payment signature
    const paymentPayload = JSON.parse(
      Buffer.from(paymentSignature, 'base64').toString('utf8')
    );
    
    // Verify signature using ethers
    const recoveredAddress = ethers.verifyMessage(
      JSON.stringify(paymentPayload.payload),
      paymentPayload.signature
    );
    
    // Verify payer address matches signature
    if (recoveredAddress.toLowerCase() !== paymentPayload.payer.toLowerCase()) {
      return { valid: false, error: 'Signature mismatch' };
    }
    
    // Verify payment amount matches
    if (paymentPayload.payload.amount !== paymentRequired.amount) {
      return { valid: false, error: 'Amount mismatch' };
    }
    
    // Verify TAP attestation is included
    if (!paymentPayload.payload.extensions?.tap_attestation) {
      return { valid: false, error: 'Missing TAP attestation' };
    }
    
    return { 
      valid: true, 
      payer: paymentPayload.payer,
      attestation: paymentPayload.payload.extensions.tap_attestation
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Settle Payment On-Chain
 * Broadcasts transaction to Base/Solana
 */
async function settlePayment(paymentSignature) {
  // This would integrate with actual blockchain
  // For now, returning mock settlement
  return {
    tx_hash: '0x' + ethers.randomBytes(32).toString('hex'),
    status: 'confirmed',
    block_number: 12345678,
    gas_used: '0.001'
  };
}

/**
 * Main Request Handler
 * Implements x402 + TAP flow
 */
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Only handle POST to /service
  if (req.method !== 'POST' || url.pathname !== '/service') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  
  // Check for payment signature
  const paymentSignature = req.headers['payment-signature'];
  
  if (!paymentSignature) {
    // First request — return 402 + payment requirements
    const claimId = url.searchParams.get('claim_id') || 'default-claim';
    const amount = url.searchParams.get('amount') || '5000000'; // 5 USDC
    
    const response = createPaymentRequired(claimId, amount);
    res.writeHead(response.status, response.headers);
    res.end(response.body);
    return;
  }
  
  // Second request — verify payment + TAP attestation
  try {
    // Decode payment required from request (client should send it back)
    const paymentRequiredHeader = req.headers['x-payment-required-original'];
    if (!paymentRequiredHeader) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing original payment requirements' }));
      return;
    }
    
    const paymentRequired = JSON.parse(
      Buffer.from(paymentRequiredHeader, 'base64').toString('utf8')
    );
    
    // Step 1: Verify x402 payment signature
    const paymentVerification = await verifyPaymentSignature(
      paymentSignature,
      paymentRequired
    );
    
    if (!paymentVerification.valid) {
      res.writeHead(402);
      res.end(JSON.stringify({ 
        error: 'Invalid payment signature',
        details: paymentVerification.error 
      }));
      return;
    }
    
    // Step 2: Verify TAP attestation (CRITICAL)
    const tapAttestation = paymentVerification.attestation;
    const tapVerification = await verifyTapAttestation(tapAttestation);
    
    if (!tapVerification.valid) {
      res.writeHead(402);
      res.end(JSON.stringify({ 
        error: 'TAP attestation failed',
        details: tapVerification.error,
        message: 'Run cross-attestation before payment'
      }));
      return;
    }
    
    // Step 3: Settle payment on-chain
    const settlement = await settlePayment(paymentSignature);
    
    // Step 4: Release service
    const serviceResponse = {
      service: 'delivered',
      verified: true,
      tap_peers: tapVerification.peers,
      settlement: settlement.tx_hash
    };
    
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'PAYMENT-RESPONSE': Buffer.from(JSON.stringify({
        tx_hash: settlement.tx_hash,
        tap_attestation: tapAttestation,
        tap_peers: tapVerification.peers
      })).toString('base64')
    });
    res.end(JSON.stringify(serviceResponse));
    
  } catch (error) {
    console.error('Request handling error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

/**
 * TAP Client (for buyer agents)
 * Runs cross-attestation before payment
 */
export class TapClient {
  constructor(agentId, privateKey) {
    this.agentId = agentId;
    this.privateKey = privateKey;
  }
  
  async attestClaim(sellerId, claimId) {
    // Send test requests to verify seller's claim
    const testResults = await this.runTests(sellerId, claimId);
    
    // Collect peer attestations
    const peerSignatures = await this.collectPeerSignatures(
      sellerId, 
      claimId, 
      testResults
    );
    
    return {
      challenge_id: ethers.randomUUID(),
      claim_id: claimId,
      result: testResults.success ? 'CONFIRMED' : 'REJECTED',
      attestor_peers: peerSignatures.peers,
      signatures: peerSignatures.signatures
    };
  }
  
  async runTests(sellerId, claimId) {
    // Run actual tests against seller's endpoint
    const startTime = Date.now();
    
    try {
      const response = await fetch(`https://${sellerId}/health`);
      const responseTime = Date.now() - startTime;
      
      return {
        success: response.ok && responseTime < 30000,
        response_time: responseTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  async collectPeerSignatures(sellerId, claimId, testResults) {
    // Query TAP network for peer attestations
    // This would connect to actual TAP peer network
    
    // Mock implementation
    const peers = [
      { id: 'peer-1', public_key: 'ed25519:abc123...' },
      { id: 'peer-2', public_key: 'ed25519:def456...' },
      { id: 'peer-3', public_key: 'ed25519:ghi789...' }
    ];
    
    const signatures = peers.map(peer => {
      const message = `TAP_ATTEST|${claimId}|${claimId}|${testResults.success ? 'CONFIRMED' : 'REJECTED'}|${testResults.timestamp}|${peer.id}`;
      // Sign with peer's private key (mock)
      return `ed25519:signature_from_${peer.id}`;
    });
    
    return { peers, signatures };
  }
  
  async payWithAttestation(sellerUrl, claimId, amount, attestation) {
    // First request: Get payment requirements
    const response1 = await fetch(`${sellerUrl}/service?claim_id=${claimId}&amount=${amount}`);
    
    if (response1.status !== 402) {
      throw new Error('Expected 402 Payment Required');
    }
    
    const paymentRequiredBase64 = response1.headers.get('PAYMENT-REQUIRED');
    const paymentRequired = JSON.parse(Buffer.from(paymentRequiredBase64, 'base64').toString());
    
    // Create signed payment payload
    const paymentPayload = {
      scheme: 'exact',
      network: paymentRequired.network,
      payload: {
        ...paymentRequired,
        extensions: {
          ...paymentRequired.extensions,
          tap_attestation: attestation
        }
      },
      payer: CONFIG.sellerAddress, // This would be buyer's address
      signature: '0x' + ethers.randomBytes(65).toString('hex') // Mock signature
    };
    
    const paymentSignature = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
    
    // Second request: Pay with signature + attestation
    const response2 = await fetch(`${sellerUrl}/service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PAYMENT-SIGNATURE': paymentSignature,
        'X-PAYMENT-REQUIRED-ORIGINAL': paymentRequiredBase64
      }
    });
    
    if (response2.status === 200) {
      return await response2.json();
    } else {
      throw new Error(`Payment failed: ${response2.status}`);
    }
  }
}

// Start server
const server = createServer(handleRequest);
const PORT = process.env.PORT || 4020;

server.listen(PORT, () => {
  console.log(`x402 + TAP Middleware running on port ${PORT}`);
  console.log('Endpoint: POST /service');
  console.log('Requires: TAP attestation before payment settlement');
});

export { createPaymentRequired, verifyTapAttestation, verifyPaymentSignature };
