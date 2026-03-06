#!/usr/bin/env node
/**
 * Example: Buyer Agent using x402 + TAP
 * 
 * This agent:
 * 1. Discovers a service
 * 2. Runs TAP attestation on the seller
 * 3. Pays via x402 with attestation proof
 * 4. Receives verified service
 */

import { TapClient } from './x402-tap-middleware.js';

// Configuration
const BUYER_CONFIG = {
  agentId: 'my-buyer-agent',
  privateKey: process.env.BUYER_PRIVATE_KEY,
  walletAddress: process.env.BUYER_ADDRESS
};

const SELLER_CONFIG = {
  url: 'https://seller-agent.example.com',
  claimId: 'fast-api-response',
  expectedThreshold: 30000 // 30 seconds
};

async function main() {
  console.log('🦞 x402 + TAP Buyer Agent Example\n');
  
  // Initialize TAP client
  const client = new TapClient(BUYER_CONFIG.agentId, BUYER_CONFIG.privateKey);
  
  console.log('Step 1: Running TAP attestation...');
  console.log(`  Seller: ${SELLER_CONFIG.url}`);
  console.log(`  Claim: ${SELLER_CONFIG.claimId}`);
  console.log(`  Threshold: ${SELLER_CONFIG.expectedThreshold}ms\n`);
  
  try {
    // Run TAP Layer 3 attestation
    const attestation = await client.attestClaim(
      SELLER_CONFIG.url,
      SELLER_CONFIG.claimId,
      { threshold: SELLER_CONFIG.expectedThreshold }
    );
    
    console.log('✅ Attestation complete!');
    console.log(`  Result: ${attestation.result}`);
    console.log(`  Peers: ${attestation.attestor_peers.length}`);
    console.log(`  Challenge ID: ${attestation.challenge_id}\n`);
    
    if (attestation.result !== 'CONFIRMED') {
      console.error('❌ Attestation failed. Not proceeding with payment.');
      process.exit(1);
    }
    
    console.log('Step 2: Paying with attestation...');
    console.log('  Amount: 5 USDC');
    console.log('  Network: Base\n');
    
    // Pay with attestation
    const service = await client.payWithAttestation(
      SELLER_CONFIG.url,
      SELLER_CONFIG.claimId,
      5000000, // 5 USDC (6 decimals)
      attestation
    );
    
    console.log('✅ Payment successful!');
    console.log(`  Service: ${service.service}`);
    console.log(`  Verified: ${service.verified}`);
    console.log(`  Settlement: ${service.settlement}`);
    console.log(`  TAP Peers: ${service.tap_peers}\n`);
    
    console.log('🎉 Verified AgentCommerce complete!');
    console.log('   Payment: 5 USDC');
    console.log('   Verification: TAP Layer 3 (cross-attestation)');
    console.log('   Settlement: On-chain (Base)');
    console.log('   Service: Delivered\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
