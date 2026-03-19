/**
 * BLS12-381 Signature Operations
 * 
 * Uses @noble/curves for cryptographic operations.
 * BLS12-381 is the standard for blockchain applications (Ethereum 2.0, etc.)
 * 
 * Features:
 * - Key generation (private key → public key)
 * - Single signature signing/verification
 * - Signature aggregation (add multiple signatures into one)
 * - Batch verification (verify aggregated signature)
 * 
 * Performance target: Verify 1000 attestations in <100ms
 */

import { bls12_381 } from '@noble/curves/bls12-381';
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';

export interface BLSKeyPair {
  privateKey: Uint8Array;  // 32 bytes
  publicKey: Uint8Array;   // 96 bytes (G2 point)
}

export interface BLSSignature {
  signature: Uint8Array;   // 96 bytes (G1 point)
  message: Uint8Array;     // arbitrary length
  publicKey: Uint8Array;   // 96 bytes
}

/**
 * Generate a new BLS key pair
 * @returns Key pair with 32-byte private key and 96-byte public key
 */
export function generateKeyPair(): BLSKeyPair {
  const privateKey = bls12_381.utils.randomPrivateKey();
  const publicKey = bls12_381.getPublicKey(privateKey);
  
  return {
    privateKey,
    publicKey
  };
}

/**
 * Sign a message with a private key
 * @param message - Message to sign (string or bytes)
 * @param privateKey - 32-byte private key
 * @returns 96-byte signature
 */
export function sign(message: string | Uint8Array, privateKey: Uint8Array): Uint8Array {
  const messageBytes = typeof message === 'string' 
    ? new TextEncoder().encode(message) 
    : message;
  
  return bls12_381.sign(messageBytes, privateKey);
}

/**
 * Verify a single BLS signature
 * @param message - Original message
 * @param signature - 96-byte signature
 * @param publicKey - 96-byte public key
 * @returns True if valid
 */
export function verify(
  message: string | Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): boolean {
  try {
    const messageBytes = typeof message === 'string'
      ? new TextEncoder().encode(message)
      : message;
    
    return bls12_381.verify(signature, messageBytes, publicKey);
  } catch (error) {
    console.error('BLS verification error:', error);
    return false;
  }
}

/**
 * Aggregate multiple signatures into one
 * @param signatures - Array of 96-byte signatures
 * @returns Single 96-byte aggregate signature
 */
export function aggregateSignatures(signatures: Uint8Array[]): Uint8Array {
  if (signatures.length === 0) {
    throw new Error('Cannot aggregate empty signature array');
  }
  if (signatures.length === 1) {
    return signatures[0];
  }
  
  return bls12_381.aggregateSignatures(signatures);
}

/**
 * Aggregate multiple public keys into one
 * @param publicKeys - Array of 96-byte public keys
 * @returns Single 96-byte aggregate public key
 */
export function aggregatePublicKeys(publicKeys: Uint8Array[]): Uint8Array {
  if (publicKeys.length === 0) {
    throw new Error('Cannot aggregate empty public key array');
  }
  if (publicKeys.length === 1) {
    return publicKeys[0];
  }
  
  return bls12_381.aggregatePublicKeys(publicKeys);
}

/**
 * Verify an aggregated signature
 * 
 * This is the key BLS feature: verify N signatures with ONE pairing operation.
 * Performance: O(1) pairings regardless of N signers.
 * 
 * @param messages - Array of messages (one per signer)
 * @param aggregateSignature - Single 96-byte aggregate signature
 * @param publicKeys - Array of 96-byte public keys (one per message)
 * @returns True if all signatures are valid
 */
export function verifyAggregate(
  messages: (string | Uint8Array)[],
  aggregateSignature: Uint8Array,
  publicKeys: Uint8Array[]
): boolean {
  try {
    if (messages.length !== publicKeys.length) {
      throw new Error('Message count must match public key count');
    }
    
    const messageBytes = messages.map(m => 
      typeof m === 'string' ? new TextEncoder().encode(m) : m
    );
    
    return bls12_381.verifyBatch(aggregateSignature, messageBytes, publicKeys);
  } catch (error) {
    console.error('BLS aggregate verification error:', error);
    return false;
  }
}

/**
 * Verify multiple signatures efficiently (batch verification)
 * 
 * This is slightly different from aggregate verification - each signature
 * is on the same message but from different signers. Useful for attestations
 * where many agents attest to the same claim.
 * 
 * @param message - Single message that all signed
 * @param aggregateSignature - Single 96-byte aggregate signature
 * @param publicKeys - Array of 96-byte public keys
 * @returns True if valid
 */
export function verifyMultiple(
  message: string | Uint8Array,
  aggregateSignature: Uint8Array,
  publicKeys: Uint8Array[]
): boolean {
  try {
    const messageBytes = typeof message === 'string'
      ? new TextEncoder().encode(message)
      : message;
    
    // Create array of same message for each public key
    const messages = Array(publicKeys.length).fill(messageBytes);
    
    return bls12_381.verifyBatch(aggregateSignature, messages, publicKeys);
  } catch (error) {
    console.error('BLS multiple verification error:', error);
    return false;
  }
}

// Convenience functions for hex string handling

export function signHex(message: string, privateKeyHex: string): string {
  const privateKey = hexToBytes(privateKeyHex);
  const signature = sign(message, privateKey);
  return bytesToHex(signature);
}

export function verifyHex(
  message: string,
  signatureHex: string,
  publicKeyHex: string
): boolean {
  const signature = hexToBytes(signatureHex);
  const publicKey = hexToBytes(publicKeyHex);
  return verify(message, signature, publicKey);
}

export function aggregateSignaturesHex(signaturesHex: string[]): string {
  const signatures = signaturesHex.map(hexToBytes);
  const aggregate = aggregateSignatures(signatures);
  return bytesToHex(aggregate);
}

export function verifyAggregateHex(
  messages: string[],
  aggregateSignatureHex: string,
  publicKeysHex: string[]
): boolean {
  const aggregateSignature = hexToBytes(aggregateSignatureHex);
  const publicKeys = publicKeysHex.map(hexToBytes);
  return verifyAggregate(messages, aggregateSignature, publicKeys);
}

/**
 * Benchmark BLS operations
 * @returns Performance metrics
 */
export async function benchmark(): Promise<{
  keygenTime: number;
  signTime: number;
  verifyTime: number;
  aggregateTime: number;
  batchVerifyTime: number;
  batchSize: number;
}> {
  const batchSize = 100;
  
  // Key generation
  const keygenStart = performance.now();
  const keypairs = Array.from({ length: batchSize }, () => generateKeyPair());
  const keygenTime = performance.now() - keygenStart;
  
  // Signing
  const message = 'benchmark message';
  const signStart = performance.now();
  const signatures = keypairs.map(kp => sign(message, kp.privateKey));
  const signTime = performance.now() - signStart;
  
  // Individual verification
  const verifyStart = performance.now();
  for (let i = 0; i < batchSize; i++) {
    verify(message, signatures[i], keypairs[i].publicKey);
  }
  const verifyTime = performance.now() - verifyStart;
  
  // Aggregation
  const aggregateStart = performance.now();
  const aggregateSig = aggregateSignatures(signatures);
  const aggregateTime = performance.now() - aggregateStart;
  
  // Batch verification (the key optimization)
  const publicKeys = keypairs.map(kp => kp.publicKey);
  const messages = Array(batchSize).fill(message);
  const batchStart = performance.now();
  verifyMultiple(message, aggregateSig, publicKeys);
  const batchVerifyTime = performance.now() - batchStart;
  
  return {
    keygenTime,
    signTime,
    verifyTime,
    aggregateTime,
    batchVerifyTime,
    batchSize
  };
}
