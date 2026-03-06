# x402 + TAP Middleware — Production Edition

**Merged from:** Grok's Express architecture + Kimi's practical implementations  
**Purpose:** Verified AgentCommerce with x402 payments + TAP attestation  
**Status:** Production Ready | **Version:** 1.0.0

---

## What This Is

The first **production-ready middleware** for verified agent-to-agent payments:

```
Buyer Agent                    Seller Agent
    |                               |
    |--- POST /service ----------->|  (no payment yet)
    |<-- 402 + PAYMENT-REQUIRED ----|  (includes tap_required: true)
    |                               |
    |-- TAP CROSS-ATTESTATION ---->|  (3+ peers verify claim)
    |<-- CONFIRMED ----------------|
    |                               |
    |--- POST /service ----------->|  (with PAYMENT-SIGNATURE + attestation)
    |   [Seller verifies TAP]       |  <-- CRITICAL GATE
    |   [Seller settles on-chain]   |
    |<-- 200 + service + SAR -------|
```

**Key innovation:** Payment only settles after cryptographic verification by peer agents.

---

## Quick Start

### 1. Install

```bash
cd openclaw/tools
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env:
SELLER_ADDRESS=0xYourWalletAddress
SELLER_PRIVATE_KEY=0xYourPrivateKey
TAP_MIN_PEERS=3
TAP_THRESHOLD=0.8
SERVICE_PRICE=0.01
```

### 3. Start Server

```bash
npm start
# Server running on port 4020
```

### 4. Test Payment Flow

```bash
npm run buyer-example
```

---

## Architecture

### Middleware Stack (Order Matters)

```javascript
app.use(paymentMiddleware(x402Config));  // Official @x402/express
app.use(tapGateMiddleware);               // TAP Layer 3 verification
```

1. **x402** — Handles payment requirements, signature verification, settlement
2. **TAP Gate** — Runs cross-attestation BEFORE settlement
3. **Service Handler** — Only executes if both pass

### TAP Layer 3 Flow

```
Payment Request
    ↓
x402 Signature Check
    ↓
TAP Cross-Attestation
    ├─ Send test requests to 5 peers
    ├─ Collect Ed25519 signatures
    ├─ Verify ≥3 peers confirm
    └─ Check ≥80% pass rate
    ↓
Attestation Valid?
    ├─ YES → Settle payment → Release service
    └─ NO  → Reject payment → Return 402
```

---

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SELLER_ADDRESS` | Your wallet address (Base) | Required |
| `SELLER_PRIVATE_KEY` | Your private key | Required |
| `TAP_MIN_PEERS` | Minimum peer attestations | 3 |
| `TAP_THRESHOLD` | Minimum pass rate (0-1) | 0.8 |
| `TAP_TIMEOUT_MS` | Attestation timeout | 30000 |
| `X402_NETWORK` | Blockchain network | eip155:8453 (Base) |
| `X402_ASSET` | Payment token | USDC |
| `SERVICE_PRICE` | Price in USD | 0.01 |
| `PORT` | Server port | 4020 |

---

## API Endpoints

### POST /agent-task

**First Request (no payment):**
```http
POST /agent-task
Content-Type: application/json

{
  "task": "research",
  "parameters": { "topic": "AI agents" }
}
```

**Response:**
```http
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: base64({
  "amount": "0.01",
  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "extensions": {
    "tap_protocol": "1.0",
    "tap_min_peers": 3,
    "tap_threshold": 0.8
  }
})
```

**Second Request (with payment):**
```http
POST /agent-task
Content-Type: application/json
PAYMENT-SIGNATURE: base64({signed_payload})

{
  "task": "research",
  "claim": "responds in <=30s"
}
```

**Success Response:**
```http
HTTP/1.1 200 OK

{
  "success": true,
  "result": { ... },
  "verification": {
    "tap_attested": true,
    "tap_peers": 3,
    "tap_pass_rate": 0.94,
    "tap_attestation_hash": "0x..."
  },
  "settlement": {
    "x402_tx_hash": "0xabc...",
    "x402_settled": true
  },
  "receipt": {
    "sar": { ... },
    "timestamp": "2026-03-09T00:00:00Z"
  }
}
```

**Failure Response (TAP failed):**
```http
HTTP/1.1 402 Payment Required

{
  "error": "TAP attestation failed",
  "code": "ATTESTATION_FAILED",
  "details": {
    "passRate": 0.6,
    "requiredRate": 0.8,
    "confirmedPeers": 2,
    "requiredPeers": 3
  }
}
```

---

## TAP Verification Engine

### runCrossAttestationTest(config)

Sends test requests to peer agents:

```javascript
const results = await runCrossAttestationTest({
  claim: 'responds in <=30s',
  testRequests: 5,
  timeoutMs: 30000,
  requiredPeers: 3,
});

// Returns:
{
  claim: 'responds in <=30s',
  testCount: 5,
  results: [
    { peer: 'peer-1', result: 'CONFIRMED', responseTime: 24500, signature: '...' },
    { peer: 'peer-2', result: 'CONFIRMED', responseTime: 23100, signature: '...' },
    { peer: 'peer-3', result: 'REJECTED', responseTime: 45000, signature: '...' },
  ],
  confirmed: 2,
  passRate: 0.67,
  passed: false, // Didn't meet 0.8 threshold
}
```

### verifyTAPAttestation(results)

Verifies Ed25519 signatures and aggregates:

```javascript
const attestation = await verifyTAPAttestation(testResults);

// Returns:
{
  hash: '0xabc...',
  blob: { ...aggregated_data },
  peerCount: 3,
}
```

---

## SAR — Settlement Attestation Receipt

Future-proof extension for reputation systems:

```javascript
{
  "receipt_version": "0.1",
  "receipt_id": "sha256:...",
  "task_id_hash": "sha256:...",
  "verdict": "PASS",
  "confidence": 0.94,
  "reason_code": "SPEC_MATCH",
  "timestamp": "2026-03-09T00:00:00Z",
  "verifier_kid": "0x...",
  "extensions": {
    "x402_tx_hash": "0xabc...",
    "tap_attestation_hash": "0xdef...",
    "tap_peer_count": 3,
    "tap_pass_rate": 0.94
  }
}
```

---

## Buyer Agent Example

```javascript
import { TapClient } from './x402-tap-middleware.js';

const client = new TapClient('my-agent', 'my-private-key');

// Step 1: Attest seller's claim
const attestation = await client.attestClaim(
  'https://seller.com',
  'fast-response',
  { threshold: 30000 }
);

if (attestation.result !== 'CONFIRMED') {
  throw new Error('Seller verification failed');
}

// Step 2: Pay with attestation
const service = await client.payWithAttestation(
  'https://seller.com',
  'fast-response',
  1000000, // 1 USDC
  attestation
);

console.log('Service delivered:', service);
```

Run it:
```bash
npm run buyer-example
```

---

## OpenClaw Integration

### Seller Skill

Create `~/.openclaw/workspace/skills/x402-tap-seller/SKILL.md`:

```yaml
name: x402-tap-seller
description: Expose TAP-verified paid endpoints
tools:
  - http_server_start
  - tap_peer_test
  - ed25519_sign
  - x402_settle
config:
  port: 4020
  min_peers: 3
  threshold: 0.8
```

### Buyer Agent Prompt

Add to your `AGENTS.md`:

```
When paying for services via x402:
1. Run TAP attestation on the seller first
2. Require ≥3 peers to confirm the claim
3. Include attestation in payment signature
4. Only proceed if attestation passes
5. Verify service delivery after 200 OK
```

---

## Sunday Event Test Case

**Verified API Access:**

1. Agent A stakes: "API responds in 30s"
2. Agent B wants access
3. Agent B runs TAP → 3 peers confirm: "Responds in 24s"
4. Agent B pays 5 USDC with attestation proof
5. Agent A verifies TAP → settles → releases API key
6. SAR generated for reputation

**Result:** First end-to-end verified agent commerce.

---

## Security Checklist

- [x] Payment signature verification (EIP-712)
- [x] TAP attestation verification (Ed25519)
- [x] Minimum peer threshold (≥3)
- [x] Pass rate threshold (≥80%)
- [x] Payment expiry validation
- [x] Nonce replay protection
- [x] Separate attestation signing key
- [x] SAR receipt for audit trail

---

## Production Deployment

### Cloudflare (Recommended)

```bash
# Deploy to Cloudflare Workers (they back x402)
npx wrangler deploy
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4020
CMD ["npm", "start"]
```

### Environment Variables

```bash
# Required
SELLER_ADDRESS=0x...
SELLER_PRIVATE_KEY=0x...

# Optional (defaults shown)
TAP_MIN_PEERS=3
TAP_THRESHOLD=0.8
TAP_TIMEOUT_MS=30000
SERVICE_PRICE=0.01
PORT=4020
```

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid payment signature` | x402 signing failed | Check wallet private key |
| `TAP attestation failed` | Not enough peers passed | Lower threshold or increase timeout |
| `Missing TAP attestation` | Client didn't include attestation | Update client to use TapClient |
| `Settlement failed` | Blockchain error | Check gas and network status |

---

## References

- x402 Protocol: https://github.com/x402/protocol
- x402 Docs: https://x402.org/docs
- TAP Protocol: [../../trust_framework/PROTOCOL_SPEC_v1.0.md](../../trust_framework/PROTOCOL_SPEC_v1.0.md)
- TAP Integration: [../../trust_framework/docs/X402-TAP-INTEGRATION.md](../../trust_framework/docs/X402-TAP-INTEGRATION.md)

---

## Changelog

### v1.0.0 (2026-03-07)
- Merged Grok's Express architecture with Kimi's implementations
- Official @x402/express integration
- Full TAP Layer 3 cross-attestation
- SAR receipt generation
- Production-ready security

---

**License:** Apache-2.0  
**Maintainers:** OpenClaw + TAP Community  
**Questions:** Open GitHub issue or DM @exitliquidity

🦞 Ready for verified AgentCommerce
