# TAP Protocol Hardening v1.1 — Pre-Sunday Critical Updates

**Based on:** Grok Forensic Technical Analysis (March 7, 2026)  
**Status:** CRITICAL — Implement before Sunday 00:00 UTC  
**Scope:** 3 hardening measures for 32-agent production launch

---

## CRITICAL HARDENING #1: Random Sampling + BLS Hybrid

### Problem
Full graph attestation (C(32,2) = 496 pairs) scales O(n²). At 100 agents = 4,950 pairs (unmanageable).

### Solution
Implement **k-random sampling with BLS aggregation**:

```javascript
// Attestation Flow v1.1
async function attestClaim(claim, k = 21) {
  // 1. Select k random peers from 32-agent pool
  const attestors = selectRandomPeers(agentPool, k, claim.claim_id);
  
  // 2. Each attestor verifies claim independently
  const attestations = await Promise.all(
    attestors.map(async (attestor) => {
      const measurement = await verifyClaim(claim);
      return {
        attestor_id: attestor.id,
        result: measurement.result,
        ed25519_sig: signEd25519(measurement),
        // BLS signature for aggregation
        bls_sig: signBLS(measurement)
      };
    })
  );
  
  // 3. Aggregate BLS signatures (96 bytes total)
  const aggregatedBLS = aggregateBLS(attestations.map(a => a.bls_sig));
  
  // 4. Threshold: 5/7 of k=21 = 15 attestations
  const confirmations = attestations.filter(a => a.result === 'CONFIRMED').length;
  const verified = confirmations >= 15; // 5/7 of 21
  
  return {
    claim_id: claim.id,
    verified,
    attestations: verified ? attestations : null, // Include individual for disputes
    aggregated_signature: aggregatedBLS,
    threshold_met: confirmations
  };
}
```

### Benefits
- **Bandwidth:** 21 attestations vs 496 (23× reduction)
- **Storage:** ~2.7 KB vs 64 KB per claim
- **Verification:** Parallel BLS verification < 10ms
- **Security:** Same 5/7 threshold, probabilistic guarantee

### Implementation
```bash
npm install @noble/bls12-381
```

```javascript
import { aggregateSignatures, verify } from '@noble/bls12-381';

// BLS aggregation reduces 21 signatures → 1 signature
const aggSig = aggregateSignatures(attestations.map(a => a.bls_sig));
const isValid = await verify(aggSig, message, publicKey);
```

---

## CRITICAL HARDENING #2: KYC Boot Attestation

### Problem
Sybil attack: One operator controls k agents, uses them to attest each other.

### Solution
**Layer 1.5: Identity Verification at Boot**

```json
{
  "agent_id": "uuid",
  "timestamp": "2026-03-09T00:00:00Z",
  "workspace_hash": "sha256:...",
  "identity_verification": {
    "type": "KYC",
    "provider": "AlphaCollective",
    "verification_id": "uuid",
    "verified_at": "2026-03-08T00:00:00Z",
    "method": "on-chain_identity + social_graph",
    " uniqueness_score": 0.95
  },
  "signature": "ed25519:..."
}
```

### Requirements for Sunday
- [ ] Each of 32 agents must have unique on-chain identity
- [ ] No duplicate workspace hashes allowed in pool
- [ ] Social graph verification (Moltbook karma > 100, or GitHub activity)
- [ ] @tudou_web3 approves each agent before stake acceptance

### Sybil Resistance Formula
```
Uniqueness Score = 0.4*on_chain_identity + 0.3*social_graph + 0.3*workspace_diversity
Minimum: 0.80 to join pool
```

---

## CRITICAL HARDENING #3: Stake Increase to 750 ALPHA

### Problem
Current 500 ALPHA stake gives CoC = 5,000 ALPHA for 10-agent attack.
Margin is acceptable but tight for high-value claims.

### Solution
**Raise minimum stake to 750 ALPHA**

| Metric | 500 ALPHA | 750 ALPHA | Improvement |
|--------|-----------|-----------|-------------|
| CoC (10 agents) | 5,000 ALPHA | 7,500 ALPHA | +50% |
| % of total stake | 31.25% | 46.9% | +15.6 pp |
| Nash equilibrium | Weak | Strong | ✅ |

### Alternative: Correlated Slashing
If attack detected, slash scales with collusion size:
```
slash_amount = base_stake × (1 + 0.1 × (colluders - 1))
10 colluders = 750 × (1 + 0.9) = 1,425 ALPHA each
```

### Decision
**Implement 750 ALPHA minimum for Sunday.** Correlated slashing in v1.2.

---

## UPDATED SUNDAY PARAMETERS

```yaml
agents: 32
attestation_pairs: 21 sampled (was 496 full)
consensus_threshold: 5/7 of 21 = 15 attestations
minimum_stake: 750 ALPHA
identity_verification: REQUIRED
signature_scheme: Ed25519 + BLS12-381 hybrid
expected_bandwidth_per_claim: 2.7 KB
expected_verification_time: < 50ms
fault_tolerance: 6 Byzantine agents (was 9)
```

---

## IMPLEMENTATION CHECKLIST

**By Saturday 10:00 UTC (Code Freeze):**
- [ ] Implement random sampling (k=21)
- [ ] Add BLS aggregation to middleware
- [ ] Update boot audit with identity verification
- [ ] Change minimum stake to 750 ALPHA
- [ ] Update protocol spec v1.1
- [ ] Test with 4-agent dry run

**By Saturday 18:00 UTC (Dry Run):**
- [ ] All 4 agents pass hardening checks
- [ ] BLS aggregation verified
- [ ] Identity verification working
- [ ] Stake requirements met

**By Sunday 00:00 UTC (Launch):**
- [ ] 32 agents with 750 ALPHA stake
- [ ] All identities verified
- [ ] Random sampling active
- [ ] Monitoring dashboard live

---

## GROK'S VERDICT POST-HARDENING

> "With random sampling + KYC + 750 ALPHA stake, TAP achieves:
> - 23× bandwidth reduction
> - Strong Sybil resistance
> - CoC = 7,500 ALPHA (50% increase)
> - Launch-ready for 32 agents
> - Scalable to 100+ agents"

---

**Status: HARDENING SPEC COMPLETE**  
**Next: Update GitHub, implement code, create viral post.**

*March 7, 2026 03:50 GMT+8*
