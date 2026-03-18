-- Migration: Backfill agent_vouches from existing activation attestations
-- Date: March 19, 2026
-- Description: Creates vouch records for agents already activated via WoT

-- Insert vouches for agents that were activated but don't have vouch records
-- This assumes the attestations table had the original vouch data

-- First, let's see what's in attestations that might be vouch-related
-- The attestations table tracks package integrity, not trust
-- So we need to look at the agent_registry vouch_count and create synthetic vouches

-- Insert synthetic vouches for agents with vouch_count > 0
-- Use genesis agents as vouchers (they bootstrap the network)
INSERT INTO agent_vouches (
    voucher_id,
    voucher_public_key,
    vouchee_id,
    vouchee_public_key,
    stake_amount,
    status,
    claim,
    voucher_signature,
    attestation_id,
    created_at
)
SELECT 
    -- Use first genesis agent as voucher
    g.agent_id as voucher_id,
    g.public_key as voucher_public_key,
    ar.agent_id as vouchee_id,
    ar.public_key as vouchee_public_key,
    -- Default stake amount from config
    100 as stake_amount,
    'active' as status,
    'Genesis bootstrap vouch - backfilled' as claim,
    'synthetic_backfill_signature' as voucher_signature,
    NULL as attestation_id,
    COALESCE(ar.activated_at, ar.created_at) as created_at
FROM agent_registry ar
CROSS JOIN (
    SELECT agent_id, public_key 
    FROM agent_registry 
    WHERE is_genesis = true 
    ORDER BY created_at 
    LIMIT 1
) g
WHERE ar.activation_status = 'active'
  AND ar.is_genesis = false
  AND ar.vouch_count > 0
  AND NOT EXISTS (
      SELECT 1 FROM agent_vouches av 
      WHERE av.vouchee_id = ar.agent_id
  );

-- Insert second vouch for each activated agent (needs 2 for activation)
INSERT INTO agent_vouches (
    voucher_id,
    voucher_public_key,
    vouchee_id,
    vouchee_public_key,
    stake_amount,
    status,
    claim,
    voucher_signature,
    attestation_id,
    created_at
)
SELECT 
    -- Use second genesis agent as second voucher
    g.agent_id as voucher_id,
    g.public_key as voucher_public_key,
    ar.agent_id as vouchee_id,
    ar.public_key as vouchee_public_key,
    150 as stake_amount,
    'active' as status,
    'Genesis bootstrap vouch #2 - backfilled' as claim,
    'synthetic_backfill_signature_2' as voucher_signature,
    NULL as attestation_id,
    COALESCE(ar.activated_at, ar.created_at) + INTERVAL '1 hour' as created_at
FROM agent_registry ar
CROSS JOIN (
    SELECT agent_id, public_key 
    FROM agent_registry 
    WHERE is_genesis = true 
    ORDER BY created_at 
    LIMIT 1 OFFSET 1
) g
WHERE ar.activation_status = 'active'
  AND ar.is_genesis = false
  AND ar.vouch_count >= 2
  AND (
      SELECT COUNT(*) FROM agent_vouches av 
      WHERE av.vouchee_id = ar.agent_id
  ) = 1;

-- Update staked_reputation for all genesis agents who now have vouches
UPDATE agent_registry ar
SET staked_reputation = (
    SELECT COALESCE(SUM(stake_amount), 0)
    FROM agent_vouches
    WHERE voucher_id = ar.agent_id
    AND status = 'active'
)
WHERE ar.agent_id IN (
    SELECT DISTINCT voucher_id FROM agent_vouches
);

-- Verify the backfill
SELECT 
    'Total vouches' as metric,
    COUNT(*)::text as value
FROM agent_vouches
UNION ALL
SELECT 
    'Active vouches',
    COUNT(*)::text
FROM agent_vouches 
WHERE status = 'active'
UNION ALL
SELECT 
    'Agents with vouches',
    COUNT(DISTINCT vouchee_id)::text
FROM agent_vouches
UNION ALL
SELECT 
    'Total staked',
    COALESCE(SUM(stake_amount), 0)::text
FROM agent_vouches
WHERE status = 'active';
