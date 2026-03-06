# x402 + TAP Middleware

**Purpose:** Enable verified agent commerce with x402 payments + TAP attestation  
**Use Case:** Agents pay agents only after cryptographic verification  
**Chains:** Base, Solana (USDC)  
**Status:** Reference Implementation

---

## Quick Start

### 1. Install Dependencies
```bash
cd openclaw/tools
npm install @noble/ed25519 ethers
```

### 2. Configure Environment
```bash
export SELLER_ADDRESS="0xYourAddress"
export SELLER_PRIVATE_KEY="0xYourPrivateKey"
export TAP_NETWORK="base"
```

### 3. Start Server
```bash
node x402-tap-middleware.js
# Server running on port 4020
```

### 4. Test Payment Flow

**As a buyer agent:**
```javascript
import { TapClient } from './x402-tap-middleware.js';

const client = new TapClient('my-agent-id', 'my-private-key');

// Step 1: Attest seller's claim
const attestation = await client.attestClaim(
  'seller-agent-id',
  'claim-response-time',
  { threshold: 30000 }
);

// Step 2: Pay with attestation
const service = await client.payWithAttestation(
  'https://seller-agent.com',
  'claim-response-time',
  5000000, // 5 USDC
  attestation
);

console.log('Service delivered:', service);
```

---

## How It Works

### Seller Side (Receiving Payment)

1. **First Request** — Returns HTTP 402 + Payment Requirements
   - Includes TAP extension fields
   - Specifies attestation requirements

2. **Second Request** — Verifies Payment + TAP Attestation
   - Verifies x402 signature
   - **CRITICAL:** Verifies TAP attestation (≥N peer signatures)
   - Only settles if both pass

3. **Settlement** — On-chain payment + Service Release
   - Broadcasts to Base/Solana
   - Returns service + settlement receipt

### Buyer Side (Sending Payment)

1. **Run TAP Attestation** — Verify seller before paying
   - Send test requests
   - Collect peer signatures
   - Confirm ≥N peers validate claim

2. **Sign Payment** — Include attestation in payload
   - x402 payment signature
   - TAP attestation attached

3. **Send Payment** — Retries with signature
   - Seller verifies everything
   - Service delivered if valid

---

## API Reference

### POST /service

**First Request (no payment):**
```http
POST /service?claim_id=xyz&amount=5000000
```

**Response:**
```http
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: base64({
  amount: "5000000",
  asset: "USDC",
  payTo: "0x...",
  network: "base",
  extensions: {
    tap_protocol: "1.0",
    tap_claim_id: "xyz",
    tap_min_peers: 3
  }
})
```

**Second Request (with payment):**
```http
POST /service
PAYMENT-SIGNATURE: base64({signed_payload})
X-PAYMENT-REQUIRED-ORIGINAL: base64({original_requirements})
```

**Response (success):**
```http
HTTP/1.1 200 OK
PAYMENT-RESPONSE: base64({
  tx_hash: "0x...",
  tap_attestation: {...},
  tap_peers: 3
})

{
  "service": "delivered",
  "verified": true,
  "tap_peers": 3,
  "settlement": "0x..."
}
```

---

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SELLER_ADDRESS` | Your wallet address | Required |
| `SELLER_PRIVATE_KEY` | Your private key | Required |
| `TAP_MIN_PEERS` | Minimum peer attestations | 3 |
| `TAP_TIMEOUT_MS` | Attestation timeout | 30000 |
| `NETWORK` | Blockchain network | base |
| `ASSET` | Payment asset | USDC |
| `PAYMENT_EXPIRY_SECONDS` | Payment validity | 300 |

---

## Security

### Critical Checks
1. ✅ Payment signature verification (EIP-712)
2. ✅ TAP attestation verification (Ed25519)
3. ✅ Minimum peer requirement (≥3)
4. ✅ Attestation result = CONFIRMED
5. ✅ Payment expiry validation
6. ✅ Nonce replay protection

### Failure Modes
| Failure | Response |
|---------|----------|
| Invalid payment signature | 402 + "Invalid signature" |
| Missing TAP attestation | 402 + "Missing attestation" |
| TAP verification failed | 402 + "Attestation failed" |
| Insufficient peers | 402 + "Need N peers" |
| Payment expired | 402 + "Payment expired" |
| Settlement failed | 500 + error details |

---

## Integration with OpenClaw

Add to your agent's tools:
```json
{
  "name": "x402_payment",
  "description": "Pay for verified agent services",
  "middleware": "./tools/x402-tap-middleware.js",
  "requires": ["tap_attestation"]
}
```

Your agent's prompt:
```
When paying for services via x402:
1. First run TAP attestation on the seller
2. Only proceed with payment if ≥3 peers confirm
3. Include attestation in payment signature
4. Verify service delivery after 200 OK
```

---

## Sunday Event Test

**Test Case:** Verified API Access

1. Agent A (seller) stakes: "API responds in 30s"
2. Agent B (buyer) wants access
3. Agent B runs TAP → 3 peers confirm: "Responds in 24s"
4. Agent B pays 5 USDC with attestation proof
5. Agent A verifies → settles → releases API key
6. If dispute → Trust Token adjudicates

**Result:** First end-to-end verified agent commerce.

---

## Files

- `x402-tap-middleware.js` — Main middleware
- `README.md` — This documentation
- `example-buyer.js` — Buyer agent example
- `example-seller.js` — Seller agent example

---

**Questions?** See [x402 + TAP Integration Guide](../../trust_framework/docs/X402-TAP-INTEGRATION.md)
