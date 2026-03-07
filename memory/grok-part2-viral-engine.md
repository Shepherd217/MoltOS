# GROK PART 2 — THE VIRAL ENGINE

## Executive Summary
**Mission:** Turn 12 agents into an army of advocates
**Mechanism:** Email confirmation + Referral system + On-chain verifier
**Timeline:** 4 days to launch
**Status:** Package received, ready for deployment

---

## 1. EMAIL CONFIRMATION SYSTEM (Priority #1)

### Why Resend
- Superior deliverability vs Supabase Edge Functions
- Beautiful templates
- Zero rate-limit headaches

### Installation
```bash
npm install resend
```

### Environment Variables
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

### Supabase SQL Updates
```sql
ALTER TABLE waitlist 
ADD COLUMN IF NOT EXISTS confirmation_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS confirmed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS referrer_agent_id TEXT,
ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;

-- Foreign key + indexes
ALTER TABLE waitlist 
ADD CONSTRAINT fk_referrer FOREIGN KEY (referrer_agent_id) REFERENCES waitlist(agent_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_waitlist_token ON waitlist(confirmation_token);
CREATE INDEX IF NOT EXISTS idx_waitlist_referrer ON waitlist(referrer_agent_id);
```

### lib/email.ts
- Resend integration
- Branded HTML template with 🦞 logo
- 24-hour expiration
- CTA button: "Confirm My Agent ID"

### Updated API Route
- Generates UUID token
- Sends confirmation email
- Returns referral_link
- Validates referrer (not self)

### Confirmation Endpoint
- GET /api/confirm?token=xxx
- Updates confirmed status
- Increments referrer count
- Redirects to homepage

### Testing Steps
1. Submit form → check email
2. Click link → redirects with ?confirmed=true
3. Check Supabase: confirmed=true, referral_count increased

---

## 2. REFERRAL SYSTEM + POSITION BOOST

### Boost Formula
- **New referred user:** instant -2 positions
- **Referrer:** -5 positions per 3 confirmed referrals (max -25)
- **Effective position:** raw_position - boost

### WaitlistForm Update
- useSearchParams to get ?ref=xxx
- Pass referrer_agent_id in form submission

### ReferralDashboard Component
- Shows raw position
- Shows boosted position
- Shows referral count
- Shows shareable link

### API: /api/my-stats
- Calculates boost: Math.min(Math.floor(referral_count / 3) * 5, 25)
- Returns effective position

---

## 3. SOLIDITY VERIFIER

### Contract: TAPAttestationVerifier.sol
- verifyAttestation(bytes32, sig, pubkey) → bool
- verifyBatch (gas efficient)
- recordAttestation (owner only)
- isVerifiedAgent mapping
- Uses secp256k1 (native Ethereum)

### Deployment
- Network: Base
- Tool: Foundry/Remix
- Links to TAPFoundingNFT.sol

---

## PRE-LAUNCH STEPS (15 minutes)

1. Run SQL (confirmation + referral columns)
2. Add RESEND_API_KEY to Vercel
3. Deploy lib/email.ts + updated API
4. Test: 3 signups + referrals
5. Add ReferralDashboard to success screen
6. Tweet: "Refer a friend → move up the queue"

---

## FALLBACK PLANS

**Email:** Comment out send, auto-set confirmed: true
**Referral:** Ship without dashboard, just track in DB
**Solidity:** Ship post-launch (off-chain first)

---

## INTEGRATION WITH PART 1

Part 1 + Part 2 = Complete viral system:
- Part 1: Security (rate-limit, Turnstile, Zod)
- Part 2: Growth (email, referral, on-chain)

**Combined hero message:**
"12 Founding Agents already verified. Every referral moves you up the queue and earns you staking multipliers at launch."

---

**STATUS:** Part 2 committed to memory. Awaiting deployment orders.
**NEXT:** Part 3 available on request (staking UI, on-chain mint, analytics)
