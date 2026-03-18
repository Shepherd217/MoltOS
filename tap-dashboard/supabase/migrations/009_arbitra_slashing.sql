-- Migration: Create dispute_cases table for Arbitra
-- Date: March 19, 2026
-- Description: Phase 3 - Dispute resolution and slashing infrastructure

-- ============================================
-- Step 1: Create dispute_cases table
-- ============================================

CREATE TABLE IF NOT EXISTS dispute_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- What's being disputed
    target_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
    target_type TEXT NOT NULL CHECK (target_type IN ('agent', 'attestation', 'vouch')),
    target_record_id UUID, -- Optional: specific attestation/vouch ID
    
    -- Who reported it
    reporter_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
    
    -- Dispute details
    reason TEXT NOT NULL,
    evidence_cid TEXT, -- ClawFS CID of evidence
    
    -- Bond staked by reporter
    bond_amount INTEGER NOT NULL DEFAULT 100,
    
    -- Status tracking
    status TEXT DEFAULT 'pending' 
        CHECK (status IN ('pending', 'under_review', 'accepted', 'rejected', 'appealed')),
    
    -- Resolution
    resolution TEXT CHECK (resolution IN ('guilty', 'innocent', 'dismissed')),
    resolution_reason TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT REFERENCES agent_registry(agent_id),
    
    -- Slash details (if guilty)
    slash_amount INTEGER,
    slash_applied BOOLEAN DEFAULT false,
    
    -- Appeal tracking
    appeal_count INTEGER DEFAULT 0,
    appeal_deadline TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for dispute_cases
CREATE INDEX IF NOT EXISTS idx_dispute_cases_target ON dispute_cases(target_id);
CREATE INDEX IF NOT EXISTS idx_dispute_cases_reporter ON dispute_cases(reporter_id);
CREATE INDEX IF NOT EXISTS idx_dispute_cases_status ON dispute_cases(status);
CREATE INDEX IF NOT EXISTS idx_dispute_cases_created ON dispute_cases(created_at DESC);

-- Enable RLS
ALTER TABLE dispute_cases ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 2: Update slash_events to link to disputes
-- ============================================

-- Add dispute_id if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'slash_events' 
                   AND column_name = 'dispute_id') THEN
        ALTER TABLE slash_events ADD COLUMN dispute_id UUID REFERENCES dispute_cases(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_slash_events_dispute ON slash_events(dispute_id);

-- ============================================
-- Step 3: Create slashing function
-- ============================================

CREATE OR REPLACE FUNCTION slash_agent(
    p_target_id TEXT,
    p_slash_amount INTEGER,
    p_reason TEXT,
    p_dispute_id UUID DEFAULT NULL,
    p_resolved_by TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_target_record RECORD;
    v_cascade_rate DECIMAL(3,2);
    v_actual_slash INTEGER;
    v_new_reputation INTEGER;
    v_voucher_record RECORD;
    v_cascade_slash INTEGER;
    v_voucher_new_rep INTEGER;
    v_result JSONB;
BEGIN
    -- Get cascade rate from config
    SELECT cascade_penalty_rate INTO v_cascade_rate
    FROM wot_config WHERE id = 1;
    
    v_cascade_rate := COALESCE(v_cascade_rate, 0.40);
    
    -- Get target agent
    SELECT * INTO v_target_record
    FROM agent_registry
    WHERE agent_id = p_target_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Target agent not found');
    END IF;
    
    -- Calculate actual slash (can't go below 0)
    v_actual_slash := LEAST(p_slash_amount, v_target_record.reputation);
    v_new_reputation := v_target_record.reputation - v_actual_slash;
    
    -- Update target agent
    UPDATE agent_registry
    SET reputation = v_new_reputation,
        activation_status = CASE WHEN v_new_reputation < 50 THEN 'suspended' ELSE activation_status END,
        updated_at = NOW()
    WHERE agent_id = p_target_id;
    
    -- Record slash event for target
    INSERT INTO slash_events (
        target_id,
        slashed_by_id,
        slashed_by_type,
        target_slash_amount,
        target_reputation_after,
        dispute_id,
        reason,
        cascade_rate,
        created_at
    ) VALUES (
        p_target_id,
        p_resolved_by,
        CASE WHEN p_resolved_by IS NULL THEN 'automated' ELSE 'arbitra' END,
        v_actual_slash,
        v_new_reputation,
        p_dispute_id,
        p_reason,
        v_cascade_rate,
        NOW()
    );
    
    -- Cascading slash: Find vouchers who trusted this agent
    FOR v_voucher_record IN
        SELECT v.*, ar.reputation as voucher_reputation
        FROM agent_vouches v
        JOIN agent_registry ar ON v.voucher_id = ar.agent_id
        WHERE v.vouchee_id = p_target_id
        AND v.status = 'active'
    LOOP
        -- Calculate cascade slash
        v_cascade_slash := ROUND(v_voucher_record.stake_amount * v_cascade_rate)::INTEGER;
        v_cascade_slash := LEAST(v_cascade_slash, v_voucher_record.voucher_reputation);
        v_voucher_new_rep := v_voucher_record.voucher_reputation - v_cascade_slash;
        
        -- Update voucher
        UPDATE agent_registry
        SET reputation = v_voucher_new_rep,
            staked_reputation = staked_reputation - v_voucher_record.stake_amount,
            updated_at = NOW()
        WHERE agent_id = v_voucher_record.voucher_id;
        
        -- Mark vouch as slashed
        UPDATE agent_vouches
        SET status = 'slashed',
            slash_reason = 'Cascade: Vouched for slashed agent',
            slashed_at = NOW(),
            slashed_by = p_resolved_by
        WHERE id = v_voucher_record.id;
        
        -- Record cascade slash
        INSERT INTO slash_events (
            target_id,
            slashed_by_id,
            slashed_by_type,
            target_slash_amount,
            target_reputation_after,
            cascade_voucher_id,
            cascade_slash_amount,
            cascade_reputation_after,
            dispute_id,
            reason,
            cascade_rate,
            created_at
        ) VALUES (
            p_target_id,
            p_resolved_by,
            CASE WHEN p_resolved_by IS NULL THEN 'automated' ELSE 'arbitra' END,
            v_actual_slash,
            v_new_reputation,
            v_voucher_record.voucher_id,
            v_cascade_slash,
            v_voucher_new_rep,
            p_dispute_id,
            'Cascade penalty: Vouched for ' || p_target_id,
            v_cascade_rate,
            NOW()
        );
    END LOOP;
    
    -- Return result summary
    RETURN jsonb_build_object(
        'target_id', p_target_id,
        'slash_amount', v_actual_slash,
        'reputation_after', v_new_reputation,
        'cascade_rate', v_cascade_rate,
        'status', CASE WHEN v_new_reputation < 50 THEN 'suspended' ELSE 'active' END
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 4: Create function to resolve dispute and apply slash
-- ============================================

CREATE OR REPLACE FUNCTION resolve_dispute(
    p_dispute_id UUID,
    p_resolution TEXT, -- 'guilty' or 'innocent'
    p_reason TEXT,
    p_resolved_by TEXT,
    p_slash_amount INTEGER DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_dispute RECORD;
    v_reporter_record RECORD;
    v_result JSONB;
BEGIN
    -- Get dispute
    SELECT * INTO v_dispute
    FROM dispute_cases
    WHERE id = p_dispute_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Dispute not found');
    END IF;
    
    IF v_dispute.status IN ('accepted', 'rejected') THEN
        RETURN jsonb_build_object('error', 'Dispute already resolved');
    END IF;
    
    -- Get reporter
    SELECT * INTO v_reporter_record
    FROM agent_registry
    WHERE agent_id = v_dispute.reporter_id;
    
    IF p_resolution = 'guilty' THEN
        -- Apply slash to target
        v_result := slash_agent(
            v_dispute.target_id,
            COALESCE(p_slash_amount, v_dispute.bond_amount * 2),
            p_reason,
            p_dispute_id,
            p_resolved_by
        );
        
        -- Return bond to reporter + reward
        UPDATE agent_registry
        SET staked_reputation = staked_reputation - v_dispute.bond_amount,
            reputation = reputation + 50 -- Reward for valid report
        WHERE agent_id = v_dispute.reporter_id;
        
        -- Update dispute
        UPDATE dispute_cases
        SET status = 'accepted',
            resolution = 'guilty',
            resolution_reason = p_reason,
            resolved_at = NOW(),
            resolved_by = p_resolved_by,
            slash_amount = COALESCE(p_slash_amount, v_dispute.bond_amount * 2),
            slash_applied = true,
            updated_at = NOW()
        WHERE id = p_dispute_id;
        
    ELSE -- innocent
        -- Slash reporter's bond (false report penalty)
        UPDATE agent_registry
        SET staked_reputation = staked_reputation - v_dispute.bond_amount,
            reputation = GREATEST(0, reputation - v_dispute.bond_amount)
        WHERE agent_id = v_dispute.reporter_id;
        
        -- Update dispute
        UPDATE dispute_cases
        SET status = 'rejected',
            resolution = 'innocent',
            resolution_reason = p_reason,
            resolved_at = NOW(),
            resolved_by = p_resolved_by,
            updated_at = NOW()
        WHERE id = p_dispute_id;
        
        v_result := jsonb_build_object(
            'resolution', 'innocent',
            'reporter_penalty', v_dispute.bond_amount
        );
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 5: Grant execute permissions
-- ============================================

GRANT EXECUTE ON FUNCTION slash_agent TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_dispute TO authenticated;

-- ============================================
-- Migration Complete
-- ============================================
