-- Migration: Phase 5 - Appeal System & Reputation Recovery
-- Date: March 19, 2026
-- Description: Appeals, recovery mechanisms, automated enforcement

-- ============================================
-- Step 1: Create appeals table
-- ============================================

CREATE TABLE IF NOT EXISTS appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to original dispute/slash
    dispute_id UUID REFERENCES dispute_cases(id),
    slash_event_id UUID REFERENCES slash_events(id),
    
    -- Who is appealing
    appellant_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
    
    -- Appeal details
    grounds TEXT NOT NULL, -- Reason for appeal
    new_evidence TEXT, -- CID or description of new evidence
    
    -- Bond (must stake to appeal)
    appeal_bond INTEGER NOT NULL DEFAULT 200,
    
    -- Timeline
    appeal_window_closes TIMESTAMPTZ NOT NULL, -- 7 days from original decision
    filed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Voting (community governance)
    voting_ends_at TIMESTAMPTZ,
    yes_votes INTEGER DEFAULT 0,
    no_votes INTEGER DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'voting', 'accepted', 'rejected', 'expired')),
    
    -- Resolution
    resolution_reason TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT REFERENCES agent_registry(agent_id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appeals_dispute ON appeals(dispute_id);
CREATE INDEX IF NOT EXISTS idx_appeals_appellant ON appeals(appellant_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);
CREATE INDEX IF NOT EXISTS idx_appeals_window ON appeals(appeal_window_closes);

-- Enable RLS
ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 2: Create appeal_votes table
-- ============================================

CREATE TABLE IF NOT EXISTS appeal_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appeal_id UUID NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
    voter_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
    vote_type TEXT NOT NULL CHECK (vote_type IN ('yes', 'no')),
    vote_weight INTEGER NOT NULL, -- Based on TAP score
    
    UNIQUE(appeal_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_appeal_votes_appeal ON appeal_votes(appeal_id);
CREATE INDEX IF NOT EXISTS idx_appeal_votes_voter ON appeal_votes(voter_id);

ALTER TABLE appeal_votes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 3: Create reputation_recovery tracking
-- ============================================

CREATE TABLE IF NOT EXISTS reputation_recovery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
    
    -- Recovery progress
    target_reputation INTEGER NOT NULL, -- Goal
    current_reputation INTEGER NOT NULL, -- Current
    
    -- Recovery mechanism
    recovery_type TEXT NOT NULL CHECK (recovery_type IN ('good_behavior', 'service_contribution', 'community_service')),
    
    -- Progress tracking
    good_behavior_days INTEGER DEFAULT 0, -- Days without violations
    contributions_completed INTEGER DEFAULT 0,
    contributions_required INTEGER DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
    
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Recovery path expires
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_agent ON reputation_recovery(agent_id);
CREATE INDEX IF NOT EXISTS idx_recovery_status ON reputation_recovery(status);

ALTER TABLE reputation_recovery ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 4: Create automated_enforcement_log
-- ============================================

CREATE TABLE IF NOT EXISTS automated_enforcement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- What triggered it
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('honeypot', 'anomaly_score', 'rapid_pattern', 'collusion_detected')),
    trigger_source TEXT NOT NULL, -- honeypot_id or agent_id
    
    -- What action was taken
    action_taken TEXT NOT NULL CHECK (action_taken IN ('dispute_filed', 'warned', 'suspended', 'slashed']),
    
    -- Related records
    dispute_id UUID REFERENCES dispute_cases(id),
    anomaly_id UUID REFERENCES anomaly_events(id),
    
    -- Automation details
    confidence_score DECIMAL(3,2) NOT NULL, -- 0-1
    auto_executed BOOLEAN DEFAULT false, -- If action was auto-executed or queued for review
    
    -- Human override
    reviewed_by TEXT REFERENCES agent_registry(agent_id),
    review_notes TEXT,
    overridden BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auto_enforcement_trigger ON automated_enforcement(trigger_type);
CREATE INDEX IF NOT EXISTS idx_auto_enforcement_action ON automated_enforcement(action_taken);
CREATE INDEX IF NOT EXISTS idx_auto_enforcement_created ON automated_enforcement(created_at DESC);

ALTER TABLE automated_enforcement ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 5: Function to auto-file dispute from honeypot trigger
-- ============================================

CREATE OR REPLACE FUNCTION auto_file_honeypot_dispute(
    p_honeypot_id UUID,
    p_triggered_by TEXT,
    p_evidence JSONB
) RETURNS UUID AS $$
DECLARE
    v_dispute_id UUID;
    v_honeypot RECORD;
BEGIN
    -- Get honeypot info
    SELECT * INTO v_honeypot FROM honeypot_agents WHERE id = p_honeypot_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Create dispute (filed by "system")
    INSERT INTO dispute_cases (
        target_id,
        target_type,
        reporter_id,
        reason,
        evidence_cid,
        bond_amount,
        status,
        created_at
    ) VALUES (
        p_triggered_by,
        'agent',
        'system_automated',
        'Honeypot triggered: ' || v_honeypot.bait_type,
        p_evidence::TEXT,
        0, -- System doesn't need bond
        'pending',
        NOW()
    )
    RETURNING id INTO v_dispute_id;
    
    -- Log the automated enforcement
    INSERT INTO automated_enforcement (
        trigger_type,
        trigger_source,
        action_taken,
        dispute_id,
        confidence_score,
        auto_executed,
        created_at
    ) VALUES (
        'honeypot',
        p_honeypot_id,
        'dispute_filed',
        v_dispute_id,
        1.0,
        true,
        NOW()
    );
    
    RETURN v_dispute_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 6: Function to calculate reputation recovery
-- ============================================

CREATE OR REPLACE FUNCTION calculate_daily_recovery(
    p_agent_id TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_recovery RECORD;
    v_daily_gain INTEGER := 0;
    v_new_behavior_days INTEGER;
BEGIN
    -- Get active recovery
    SELECT * INTO v_recovery
    FROM reputation_recovery
    WHERE agent_id = p_agent_id
    AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Base recovery: 5 points per day of good behavior
    v_daily_gain := 5;
    
    -- Check if agent had any violations today
    IF EXISTS (
        SELECT 1 FROM slash_events
        WHERE target_id = p_agent_id
        AND created_at > CURRENT_DATE
    ) THEN
        v_daily_gain := 0; -- No recovery if slashed today
    END IF;
    
    -- Bonus for contributions
    IF v_recovery.contributions_completed > 0 THEN
        v_daily_gain := v_daily_gain + (v_recovery.contributions_completed * 10);
    END IF;
    
    -- Update recovery progress
    UPDATE reputation_recovery
    SET 
        good_behavior_days = good_behavior_days + 1,
        current_reputation = LEAST(current_reputation + v_daily_gain, target_reputation),
        updated_at = NOW()
    WHERE id = v_recovery.id;
    
    -- Check if recovery complete
    UPDATE reputation_recovery
    SET 
        status = 'completed',
        completed_at = NOW()
    WHERE id = v_recovery.id
    AND current_reputation >= target_reputation;
    
    -- Also update agent_registry
    UPDATE agent_registry
    SET reputation = LEAST(reputation + v_daily_gain, v_recovery.target_reputation)
    WHERE agent_id = p_agent_id;
    
    RETURN v_daily_gain;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 7: Function to process appeal voting
-- ============================================

CREATE OR REPLACE FUNCTION cast_appeal_vote(
    p_appeal_id UUID,
    p_voter_id TEXT,
    p_vote_type TEXT -- 'yes' or 'no'
) RETURNS BOOLEAN AS $$
DECLARE
    v_voter_rep INTEGER;
    v_appeal_status TEXT;
BEGIN
    -- Check appeal is open for voting
    SELECT status INTO v_appeal_status
    FROM appeals WHERE id = p_appeal_id;
    
    IF v_appeal_status NOT IN ('pending', 'voting') THEN
        RETURN false;
    END IF;
    
    -- Get voter reputation
    SELECT reputation INTO v_voter_rep
    FROM agent_registry
    WHERE agent_id = p_voter_id
    AND activation_status = 'active';
    
    IF v_voter_rep IS NULL OR v_voter_rep < 100 THEN
        RETURN false; -- Need 100+ rep to vote
    END IF;
    
    -- Record vote
    INSERT INTO appeal_votes (appeal_id, voter_id, vote_type, vote_weight)
    VALUES (p_appeal_id, p_voter_id, p_vote_type, v_voter_rep)
    ON CONFLICT (appeal_id, voter_id) 
    DO UPDATE SET vote_type = p_vote_type, vote_weight = v_voter_rep;
    
    -- Update appeal vote counts
    IF p_vote_type = 'yes' THEN
        UPDATE appeals SET yes_votes = yes_votes + v_voter_rep WHERE id = p_appeal_id;
    ELSE
        UPDATE appeals SET no_votes = no_votes + v_voter_rep WHERE id = p_appeal_id;
    END IF;
    
    -- Change status to voting if first vote
    UPDATE appeals SET status = 'voting' WHERE id = p_appeal_id AND status = 'pending';
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 8: Update wot_config with appeal parameters
-- ============================================

ALTER TABLE wot_config 
ADD COLUMN IF NOT EXISTS appeal_window_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS appeal_bond_amount INTEGER DEFAULT 200,
ADD COLUMN IF NOT EXISTS appeal_voting_period_days INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS appeal_threshold_percent INTEGER DEFAULT 60; -- 60% yes votes to overturn

-- ============================================
-- Migration Complete
-- ============================================
