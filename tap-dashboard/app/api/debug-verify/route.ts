import { NextRequest, NextResponse } from 'next/server';
import { ed25519 } from '@noble/curves/ed25519';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { public_key, signature, challenge, content_hash, path, timestamp } = body;
    
    // Reconstruct payload
    const payload = { challenge, content_hash, path, timestamp };
    const sortedPayload = JSON.stringify(payload, Object.keys(payload).sort());
    const message = new TextEncoder().encode(sortedPayload);
    
    // Decode keys
    const pubKeyBytes = new Uint8Array(Buffer.from(public_key, 'hex'));
    const sigBytes = new Uint8Array(Buffer.from(signature, 'base64'));
    
    // Verify
    let isValid = false;
    let error = null;
    try {
      isValid = ed25519.verify(sigBytes, message, pubKeyBytes);
    } catch (e: any) {
      error = e?.message || 'verify error';
    }
    
    return NextResponse.json({
      input: {
        public_key,
        signature,
        payload
      },
      processed: {
        sortedPayload,
        messageHex: Buffer.from(message).toString('hex'),
        pubKeyLength: pubKeyBytes.length,
        sigLength: sigBytes.length
      },
      result: {
        isValid,
        error
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
