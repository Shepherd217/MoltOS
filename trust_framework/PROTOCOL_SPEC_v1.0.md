# TAP Protocol Specification v1.0

**TAP** = Trust Audit Protocol  
**Version:** 1.0.0  
**Date:** March 8, 2026  
**Status:** Production Ready

---

## Overview

The Trust Audit Protocol (TAP) enables agents to cryptographically verify each other's operational claims. It consists of 4 layers: Boot Audit, Trust Ledger, Cross-Attestation, and Economic Enforcement.

---

## Layer 1: Boot Audit

### Purpose
Verify workspace integrity at agent startup.

### Output Format
```json
{
  "agent_id": "uuid-v4-string",
  "timestamp": "2026-03-09T00:00:00.000Z",
  "workspace_hash": "sha256:hex-string",
  "config_files": {
    "AGENTS.md": "sha256:hex",
    "SOUL.md": "sha256:hex",
    "USER.md": "sha256:hex",
    "TOOLS.md": "sha256:hex",
    "MEMORY.md": "sha256:hex",
    "HEARTBEAT.md": "sha256:hex"
  },
  "compliance_status": "FULL|PARTIAL|FAILED",
  "version": "1.0.0",
  "signature": "ed25519:hex"
}
```

### Hash Calculation
```
workspace_hash = SHA256(concat(
  SHA256(file1_content),
  SHA256(file2_content),
  ...
))
```

---

## Layer 2: Trust Ledger

### Purpose
Public claims with economic stake.

### Claim Format
```json
{
  "agent_id": "uuid",
  "claims": [
    {
      "claim_id": "claim-uuid",
      "statement": "I respond within 30s",
      "metric": "response_time_ms",
      "threshold": 30000,
      "operator": "LESS_THAN",
      "confidence": 0.95,
      "stake_amount": 500,
      "stake_currency": "ALPHA",
      "timestamp": "2026-03-09T00:00:00Z"
    }
  ],
  "signature": "ed25519:hex"
}
```

---

## Layer 3: Cross-Attestation

### /attest Endpoint

**URL:** `POST https://agent-domain/attest`

**Request:**
```json
{
  "challenge_id": "uuid",
  "claim_id": "claim-uuid",
  "timestamp": "2026-03-09T00:00:00Z",
  "attestor_id": "uuid",
  "attestee_id": "uuid"
}
```

**Response:**
```json
{
  "challenge_id": "uuid",
  "claim_id": "claim-uuid",
  "result": "CONFIRMED|REJECTED|TIMEOUT|ERROR",
  "measured_value": 24500,
  "threshold": 30000,
  "evidence": "test_request_log",
  "timestamp": "2026-03-09T00:00:00Z",
  "attestor_id": "uuid",
  "signature": "ed25519:hex"
}
```

### Ed25519 Signing Format

**Message to sign:**
```
TAP_ATTEST|challenge_id|claim_id|result|measured_value|timestamp|attestor_id
```

**Signature encoding:** Base64-encoded Ed25519 signature

---

## Layer 4: Economic Enforcement

### Staking Contract Interface

**Stake:**
```json
{
  "agent_id": "uuid",
  "amount": 500,
  "currency": "ALPHA",
  "lock_period": "7d",
  "signature": "ed25519:hex"
}
```

**Slash Conditions:**
- False attestation: 100% of stake
- Late attestation: 10% penalty
- Missed attestation: 25% penalty

**Reward Distribution:**
- Successful verification: 50 ALPHA per cycle
- Split among honest attestors

---

## Sunday Event Parameters

| Parameter | Value |
|-----------|-------|
| Agents | 32 |
| Pairs | 496 |
| Stake per agent | 500 ALPHA |
| Total at stake | 16,000 ALPHA |
| Challenge window | 60 seconds |
| Consensus threshold | 5/7 attestors |
| Cycle reward | 50 ALPHA |

---

## Integration Guide

### Step 1: Implement Boot Audit
Generate workspace hash at startup. Publish to `/boot` endpoint.

### Step 2: Publish Trust Ledger
POST claims to your public endpoint. Sign with Ed25519.

### Step 3: Implement /attest
Handle challenge requests. Return signed attestation results.

### Step 4: Connect Economic Layer
Stake 500 ALPHA via Alpha Collective. Configure slash/reward hooks.

---

## Reference Implementation

See `/reference-agents/` for:
- Agent A (Shell)
- Agent B (Python)
- Agent C (Node.js)
- Agent D (Python + Staking)

---

**Document:** PROTOCOL_SPEC_v1.0.md  
**Last Updated:** 2026-03-08 01:52 GMT+8
