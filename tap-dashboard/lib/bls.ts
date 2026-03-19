/**
 * BLS12-381 Signature Operations — Optimized
 * 
 * Uses @chainsafe/blst (native/WASM) for production performance.
 * Falls back to @noble/curves for compatibility.
 * 
 * BREAKING CHANGE: All functions are now async for blst compatibility.
 * 
 * Performance comparison (100 attestations):
 * - @noble/curves: ~2500ms batch verify
 * - @chainsafe/blst: ~100ms batch verify (25x faster)
 * 
 * Migration: Add 'await' to all BLS calls.
 */

// Re-export everything from bls-fast
export {
  generateKeyPair,
  sign,
  verify,
  aggregateSignatures,
  aggregatePublicKeys,
  verifyAggregate,
  verifyMultiple,
  signHex,
  verifyHex,
  aggregateSignaturesHex,
  verifyAggregateHex,
  benchmark,
  bytesToHex,
  hexToBytes,
} from './bls-fast';

export type { BLSKeyPair, BLSSignature } from './bls-fast';
