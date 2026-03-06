#!/usr/bin/env node
/**
 * Example: Buyer Agent using x402 + TAP
 * 
 * This agent:
 * 1. Discovers a service
 * 2. Runs TAP attestation on the seller
 * 3. Pays via x402 with attestation proof
 * 4. Receives verified service + SAR receipt
 */

import fetch from 'node-fetch';
import { ethers } from 'ethers';

// Configuration
const BUYER_CONFIG = {
  agentId: 'my-buyer-agent',
  privateKey: process.env.BUYER_PRIVATE_KEY,
  walletAddress: process.env.BUYER_ADDRESS,
};

const SELLER_CONFIG = {
  url: process.env.SELLER_URL || 'http://localhost:4020',
  claimId: 'fast-api-response',
  expectedThreshold: 30000, // 30 seconds
};

/**
 * TAP Client — Run cross-attestation before payment
 */
class TapClient {
  constructor(agentId, privateKey) {
    this.agentId = agentId;
    this.privateKey = privateKey;
    this.wallet = new ethers.Wallet(privateKey);
  }

  async attestClaim(sellerUrl, claimId, options = {}) {
    console.log(`🔍 Running TAP attestation...`);
    console.log(`   Seller: ${sellerUrl}`);
    console.log(`   Claim: ${claimId}`);
    console.log(`   Threshold: ${options.threshold}ms\n`);

    // Mock peer network (in production: actual TAP peer discovery)
    const peerAgents = [
      { id: 'tap-peer-1', endpoint: `${sellerUrl}/health`, publicKey: 'ed25519:abc123' },
      { id: 'tap-peer-2', endpoint: `${sellerUrl}/health`, publicKey: 'ed25519:def456' },
      { id: 'tap-peer-3', endpoint: `${sellerUrl}/health`, publicKey: 'ed25519:ghi789' },
      { id: 'tap-peer-4', endpoint: `${sellerUrl}/health`, publicKey: 'ed25519:jkl012' },
      { id: 'tap-peer-5', endpoint: `${sellerUrl}/health`, publicKey: 'ed25519:mno345' },
    ];

    const results = [];
    
    for (const peer of peerAgents) {
      try {
        const startTime = Date.now();
        
        // Send test request
        const response = await fetch(peer.endpoint);
        const responseTime = Date.now() - startTime;
        
        const success = response.ok && responseTime < options.threshold;
        
        // Mock peer signature
        const attestationData = {
          peerId: peer.id,
          claim: claimId,
          result: success ? 'CONFIRMED' : 'REJECTED',
          responseTime,
          timestamp: new Date().toISOString(),
        };
        
        results.push({
          peer: peer.id,
          publicKey: peer.publicKey,
          result: attestationData.result,
          responseTime,
          signature: `ed25519:signature_from_${peer.id}_${Date.now()}`,
          timestamp: attestationData.timestamp,
        });
        
        console.log(`   ${peer.id}: ${success ? '✅' : '❌'} ${responseTime}ms`);
        
      } catch (error) {
        console.error(`   ${peer.id}: ❌ ${error.message}`);
        results.push({
          peer: peer.id,
          result: 'ERROR',
          error: error.message,
        });
      }
    }

    const confirmed = results.filter(r => r.result === 'CONFIRMED').length;
    const passRate = confirmed / results.length;
    const passed = passRate >= 0.8 && confirmed >= 3;

    console.log(`\n📊 Attestation Results:`);
    console.log(`   Confirmed: ${confirmed}/${results.length} peers`);
    console.log(`   Pass rate: ${(passRate * 100).toFixed(1)}%`);
    console.log(`   Status: ${passed ? '✅ PASSED' : '❌ FAILED'}\n`);

    return {
      challenge_id: ethers.id(Date.now().toString()),
      claim_id: claimId,
      result: passed ? 'CONFIRMED' : 'REJECTED',
      attestor_peers: results.filter(r => r.result === 'CONFIRMED'),
      signatures: results.filter(r => r.signature).map(r => r.signature),
      pass_rate: passRate,
    };
  }

  async payWithAttestation(sellerUrl, claimId, amount, attestation) {
    console.log(`💰 Initiating x402 payment...`);
    console.log(`   Amount: ${amount / 1_000_000} USDC`);
    console.log(`   Seller: ${sellerUrl}\n`);

    // Step 1: Get payment requirements
    console.log(`Step 1: Getting payment requirements...`);
    const response1 = await fetch(`${sellerUrl}/agent-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'test-task',
        claim: claimId,
      }),
    });

    if (response1.status !== 402) {
      throw new Error(`Expected 402, got ${response1.status}`);
    }

    const paymentRequiredBase64 = response1.headers.get('PAYMENT-REQUIRED');
    const paymentRequired = JSON.parse(
      Buffer.from(paymentRequiredBase64, 'base64').toString()
    );

    console.log(`   ✅ Payment required: ${paymentRequired.amount} ${paymentRequired.asset}`);
    console.log(`   ✅ TAP required: ${paymentRequired.extensions?.tap_attestation_required}\n`);

    // Step 2: Create signed payment payload
    console.log(`Step 2: Signing payment with attestation...`);
    
    const paymentPayload = {
      scheme: 'exact',
      network: paymentRequired.network,
      payload: {
        ...paymentRequired,
        extensions: {
          ...paymentRequired.extensions,
          tap_attestation: attestation,
        },
      },
      payer: this.wallet.address,
      signature: await this.wallet.signMessage(
        JSON.stringify({
          ...paymentRequired,
          nonce: paymentRequired.nonce,
        })
      ),
    };

    const paymentSignature = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

    console.log(`   ✅ Payment signed by ${this.wallet.address.substring(0, 20)}...`);
    console.log(`   ✅ Attestation included: ${attestation.challenge_id.substring(0, 20)}...\n`);

    // Step 3: Send payment
    console.log(`Step 3: Sending payment with attestation...`);
    const response2 = await fetch(`${sellerUrl}/agent-task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PAYMENT-SIGNATURE': paymentSignature,
        'X-PAYMENT-REQUIRED-ORIGINAL': paymentRequiredBase64,
      },
      body: JSON.stringify({
        task: 'test-task',
        claim: claimId,
      }),
    });

    if (response2.status === 200) {
      const result = await response2.json();
      console.log(`   ✅ Payment successful!\n`);
      return result;
    } else if (response2.status === 402) {
      const error = await response2.json();
      throw new Error(`TAP attestation failed: ${error.details?.passRate}% pass rate`);
    } else {
      throw new Error(`Payment failed: ${response2.status}`);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  x402 + TAP Buyer Agent Example');
  console.log('═══════════════════════════════════════════════════\n');

  if (!BUYER_CONFIG.privateKey) {
    console.error('❌ Error: Set BUYER_PRIVATE_KEY environment variable');
    process.exit(1);
  }

  // Initialize client
  const client = new TapClient(BUYER_CONFIG.agentId, BUYER_CONFIG.privateKey);

  try {
    // Step 1: Attest seller's claim
    const attestation = await client.attestClaim(
      SELLER_CONFIG.url,
      SELLER_CONFIG.claimId,
      { threshold: SELLER_CONFIG.expectedThreshold }
    );

    if (attestation.result !== 'CONFIRMED') {
      console.error('❌ Attestation failed. Cannot proceed with payment.');
      process.exit(1);
    }

    // Step 2: Pay with attestation
    const service = await client.payWithAttestation(
      SELLER_CONFIG.url,
      SELLER_CONFIG.claimId,
      1000000, // 1 USDC
      attestation
    );

    // Success!
    console.log('═══════════════════════════════════════════════════');
    console.log('  ✅ VERIFIED AGENTCOMMERCE COMPLETE');
    console.log('═══════════════════════════════════════════════════\n');
    
    console.log('Payment:');
    console.log(`  Amount: 1 USDC`);
    console.log(`  Settlement: ${service.settlement?.x402_tx_hash?.substring(0, 30)}...`);
    console.log(`  Status: ${service.settlement?.x402_settled ? '✅ Settled' : '⏳ Pending'}`);
    
    console.log('\nVerification:');
    console.log(`  TAP Attested: ${service.verification?.tap_attested ? '✅' : '❌'}`);
    console.log(`  Peers Verified: ${service.verification?.tap_peers}`);
    console.log(`  Pass Rate: ${(service.verification?.tap_pass_rate * 100).toFixed(1)}%`);
    console.log(`  Attestation Hash: ${service.verification?.tap_attestation_hash?.substring(0, 30)}...`);
    
    console.log('\nService:');
    console.log(`  Status: ${service.success ? '✅ Delivered' : '❌ Failed'}`);
    console.log(`  Result: ${service.result?.output || 'N/A'}`);
    
    console.log('\nReceipt (SAR):');
    console.log(`  Timestamp: ${service.receipt?.timestamp}`);
    console.log(`  Verdict: ${service.receipt?.sar?.verdict}`);
    console.log(`  Confidence: ${service.receipt?.sar?.confidence}`);
    
    console.log('\n🦞 End-to-end verified transaction complete!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { TapClient, main };
