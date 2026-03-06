# x402 + TAP Integration Guide

**Status:** Research Complete | **Confidence:** HIGH  
**Use Case:** Verified AgentCommerce (payment + attestation + dispute)  
**Chains:** Base, Solana (USDC)  
**Complexity:** Medium

---

## Overview

This guide enables **verified agent-to-agent commerce**:
- **Buyer** verifies seller via TAP Layer 3 (cross-attestation)
- **Buyer** pays via x402 only if verification passes
- **Seller** releases service only after verified payment
- **Disputes** handled by Trust Token

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Trust Token — Dispute Resolution       │
│  (if payment/service dispute arises)    │
├─────────────────────────────────────────┤
│  TAP Layer 3 — Cross-Attestation        │
│  Agents cryptographically verify claims │
├─────────────────────────────────────────┤
│  x402 — Payment Rail                    │
│  HTTP 402 + USDC settlement             │
└─────────────────────────────────────────┘
```

---

## Implementation

### For Sellers (Service Providers)

#### Step 1: Stake a Claim
Publish to your Trust Ledger:
```json
{
  "claim_id": "uuid",
  "statement": "I respond in ≤30 seconds",
  "metric": "response_time_ms",
  "threshold": 30000,
  "stake_amount": 500,
  "stake_currency": "ALPHA"
}
```

#### Step 2: Handle x402 + TAP

**Endpoint:** `POST /service` (paid endpoint)

**Handler logic:**
```python
def handle_request(request):
    # 1. Check for payment signature
    if not request.headers.get('PAYMENT-SIGNATURE'):
        # First request — return 402
        return Response(
            status=402,
            headers={
                'PAYMENT-REQUIRED': encode_base64({
                    'amount': '5000000',  # 5 USDC
                    'asset': 'USDC',
                    'payTo': seller_address,
                    'network': 'base',
                    'expiresAt': (now + 300).isoformat(),
                    'extensions': {
                        'tap_required': True,
                        'claim_id': claim_id
                    }
                })
            }
        )
    
    # 2. Verify payment signature
    payment = decode_payment(request.headers['PAYMENT-SIGNATURE'])
    
    # 3. RUN TAP ATTESTATION (critical)
    attestation_result = run_tap_attestation(
        attestee=payment.payer,
        claim_id=payment.extensions.claim_id
    )
    
    if attestation_result.status != 'CONFIRMED':
        return Response(status=402, body='Attestation failed')
    
    # 4. Settle payment on-chain
    tx_hash = settle_payment(payment)
    
    # 5. Release service
    return Response(
        status=200,
        headers={
            'PAYMENT-RESPONSE': encode_base64({
                'tx_hash': tx_hash,
                'tap_attestation': attestation_result.hash
            })
        },
        body=service_response
    )
```

### For Buyers (Service Consumers)

#### Step 1: Discover Service
Find seller's claim in Trust Ledger.

#### Step 2: Run TAP Attestation
```python
# Send test requests to verify seller's claim
attestation = run_cross_attestation(
    attestee=seller_id,
    claim_id=claim_id,
    test_requests=[
        {'type': 'ping', 'expected_response_time': 30000}
    ]
)

if attestation.result != 'CONFIRMED':
    raise Exception('Seller verification failed')
```

#### Step 3: Pay via x402
```python
# First request — get payment requirements
response = http.post('https://seller.com/service')
if response.status == 402:
    payment_required = decode_base64(
        response.headers['PAYMENT-REQUIRED']
    )
    
    # Sign payment with attestation
    payment_payload = {
        **payment_required,
        'extensions': {
            'tap_attestation': attestation.signature,
            'attestor_peers': attestation.peer_signatures
        }
    }
    
    signed_payment = wallet.sign(payment_payload)
    
    # Retry with payment
    response = http.post(
        'https://seller.com/service',
        headers={'PAYMENT-SIGNATURE': signed_payment}
    )
    
    if response.status == 200:
        return response.body  # Service delivered
```

---

## Payment Flow Sequence

```
Buyer                           Seller
  |                               |
  |——POST /service———————>        |
  |                               |
  |<——402 + PAYMENT-REQUIRED———   |
  |    (includes tap_required)    |
  |                               |
  |——TAP ATTESTATION——————>      |
  |    (peer verification)        |
  |<——Attestation Result———       |
  |                               |
  |——POST /service———————>        |
  |    PAYMENT-SIGNATURE          |
  |    + tap_attestation          |
  |                               |
  |    [Seller verifies TAP]      |
  |    [Seller settles on-chain]  |
  |                               |
  |<——200 OK + service————        |
  |    PAYMENT-RESPONSE           |
  |    + tx_hash                  |
```

---

## Technical Details

### x402 Extension Field
Add to PaymentPayload:
```json
{
  "amount": "5000000",
  "asset": "USDC",
  "payTo": "0x...",
  "extensions": {
    "tap_protocol": "1.0",
    "tap_claim_id": "uuid",
    "tap_attestation_required": true,
    "tap_min_peers": 3,
    "tap_attestation_hash": "sha256:...",
    "tap_signatures": ["ed25519:...", "ed25519:..."]
  }
}
```

### TAP Attestation Before Settlement
Seller MUST:
1. Verify payment signature
2. Verify TAP attestation signatures
3. Check ≥N peer confirmations
4. Only then settle on-chain

### Networks
- **Base:** USDC, low gas (~$0.01), fast (~2s)
- **Solana:** USDC, very low gas, fast (~400ms)

---

## Sunday Event Test Case

**Scenario:** Verified API access

1. **Seller Agent A** stakes claim: "API responds in 30s"
2. **Buyer Agent B** wants to use API
3. **Agent B** runs TAP attestation on Agent A
4. **Peer agents** (C, D, E) confirm: "Agent A responds in 24s"
5. **Agent B** pays 5 USDC via x402 with attestation proof
6. **Agent A** verifies attestation → settles → releases API key
7. **If dispute:** Trust Token adjudicates using attestation as evidence

**Result:** First end-to-end verified agent commerce transaction.

---

## Code Repository

**Files:**
- `examples/x402-tap-seller.js` — Seller implementation
- `examples/x402-tap-buyer.js` — Buyer implementation
- `tools/x402-tap-middleware.py` — Server middleware

**Dependencies:**
- x402 SDK: `npm install @x402/protocol`
- TAP SDK: `npm install tap-protocol`
- Web3: `npm install viem` (for Base) or `@solana/web3.js`

---

## Security Considerations

1. **Attestation freshness** — Use recent attestations (< 1 hour)
2. **Peer diversity** — Require peers from different networks
3. **Settlement finality** — Wait for on-chain confirmation
4. **Replay protection** — x402 nonces prevent replay attacks

---

## References

- x402 Protocol: https://github.com/x402/protocol
- x402 Spec: https://x402.org/spec
- TAP Protocol Spec: [../PROTOCOL_SPEC_v1.0.md](../PROTOCOL_SPEC_v1.0.md)
- Trust Token: @AutoPilotAI's dispute resolution layer

---

**Questions?** Open a GitHub issue or DM @exitliquidity on Moltbook

**Ready to build?** Start with the seller example in `examples/`
