-- Migration: Appeal Resolution Automation
-- Date: March 19, 2026
-- Description: Auto-resolve appeals when voting ends, restore reputation on success

-- ============================================
-- Step 1: Function to process appeal resolution
-- ============================================

CREATE OR REPLACE FUNCTION process_appeal_resolution(
    p_appeal_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_appeal RECORD;
    v_config RECORD;
    v_total_votes INTEGER;
    v_yes_percent INTEGER;
    v_dispute RECORD;
    v_slash RECORD;
    v_result JSONB;
BEGIN
    -- Get appeal details
    SELECT * INTO v_appeal
    FROM appeals WHERE id = p_appeal_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Appeal not found');
    END IF;
    
    -- Only process if in voting status
    IF v_appeal.status != 'voting' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Appeal not in voting status', 'status', v_appeal.status);
    END IF;
    
    -- Get config
    SELECT * INTO v_config FROM wot_config WHERE id = 1;
    
    -- Calculate vote percentages
    v_total_votes := v_appeal.yes_votes + v_appeal.no_votes;
    
    IF v_total_votes = 0 THEN
        -- No votes cast, appeal expires without resolution
        UPDATE appeals SET 
            status = 'expired',
            resolved_at = NOW(),
            resolution_reason = 'No votes cast'
        WHERE id = p_appeal_id;
        
        -- Return bond
        UPDATE agent_registry 
        SET staked_reputation = staked_reputation - v_appeal.appeal_bond
        WHERE agent_id = v_appeal.appellant_id;
        
        RETURN jsonb_build_object(
            'success', true, 
            'result', 'expired',
            'reason', 'No votes cast',
            'bond_returned', v_appeal.appeal_bond
        );
    END IF;
    
    v_yes_percent := (v_appeal.yes_votes * 100) / v_total_votes;
    
    -- Check if meets threshold (default 60%)
    IF v_yes_percent >= COALESCE(v_config.appeal_threshold_percent, 60) THEN
        -- APPEAL ACCEPTED - Overturn the decision
        
        -- Get original dispute or slash
        IF v_appeal.dispute_id IS NOT NULL THEN
            SELECT * INTO v_dispute FROM dispute_cases WHERE id = v_appeal.dispute_id;
        ELSIF v_appeal.slash_event_id IS NOT NULL THEN
            SELECT * INTO v_slash FROM slash_events WHERE id = v_appeal.slash_event_id;
        END IF;
        
        -- Restore reputation if it was a slash
        IF v_slash IS NOT NULL THEN
            UPDATE agent_registry 
            SET reputation = reputation + v_slash.reputation_deducted
            WHERE agent_id = v_slash.target_id;
        END IF;
        
        -- Mark dispute as overturned if applicable
        IF v_dispute IS NOT NULL THEN
            UPDATE dispute_cases 
            SET status = 'overturned_on_appeal',
                resolved_at = NOW()
            WHERE id = v_appeal.dispute_id;
        END IF;
        
        -- Mark appeal as accepted
        UPDATE appeals SET 
            status = 'accepted',
            resolved_at = NOW(),
            resolution_reason = format('Appeal accepted: %s%% yes votes (threshold: %s%%)', v_yes_percent, COALESCE(v_config.appeal_threshold_percent, 60))
        WHERE id = p_appeal_id;
        
        -- Return bond with bonus for successful appeal
        UPDATE agent_registry 
        SET staked_reputation = staked_reputation - v_appeal.appeal_bond,
            reputation = reputation + 50  -- Bonus for successful appeal
        WHERE agent_id = v_appeal.appellant_id;
        
        v_result := jsonb_build_object(
            'success', true,
            'result', 'accepted',
            'yes_percent', v_yes_percent,
            'threshold', COALESCE(v_config.appeal_threshold_percent, 60),
            'total_votes', v_total_votes,
            'bond_returned', v_appeal.appeal_bond,
            'reputation_restored', COALESCE(v_slash.reputation_deducted, 0),
            'appeal_bonus', 50
        );
        
    ELSE
        -- APPEAL REJECTED - Uphold original decision
        
        UPDATE appeals SET 
            status = 'rejected',
            resolved_at = NOW(),
            resolution_reason = format('Appeal rejected: %s%% yes votes (threshold: %s%%)', v_yes_percent, COALESCE(v_config.appeal_threshold_percent, 60))
        WHERE id = p_appeal_id;
        
        -- Bond is NOT returned (forfeit for failed appeal)
        -- But unstake it so it's not locked forever
        UPDATE agent_registry 
        SET staked_reputation = staked_reputation - v_appeal.appeal_bond
        WHERE agent_id = v_appeal.appellant_id;
        
        v_result := jsonb_build_object(
            'success', true,
            'result', 'rejected',
            'yes_percent', v_yes_percent,
            'threshold', COALESCE(v_config.appeal_threshold_percent, 60),
            'total_votes', v_total_votes,
            'bond_forfeited', v_appeal.appeal_bond
        );
    END IF;
    
    RETURN v_result;
    
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 2: Function to check and auto-close expired appeals
-- ============================================

CREATE OR REPLACE FUNCTION close_expired_appeals()
RETURNS INTEGER AS $$
DECLARE
    v_appeal RECORD;
    v_count INTEGER := 0;
    v_config RECORD;
BEGIN
    SELECT * INTO v_config FROM wot_config WHERE id = 1;
    
    -- Find appeals past voting period
    FOR v_appeal IN 
        SELECT * FROM appeals 
        WHERE status = 'voting'
        AND voting_ends_at < NOW()
    LOOP
        PERFORM process_appeal_resolution(v_appeal.id);
        v_count := v_count + 1;
    END LOOP;
    
    -- Also expire appeals past window that never entered voting
    UPDATE appeals SET 
        status = 'expired',
        resolved_at = NOW(),
        resolution_reason = 'Appeal window expired without entering voting'
    WHERE status = 'pending'
    AND appeal_window_closes < NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 3: Trigger to start voting period on first vote
-- ============================================

CREATE OR REPLACE FUNCTION start_appeal_voting()
RETURNS TRIGGER AS $$
DECLARE
    v_config RECORD;
BEGIN
    -- Only if this is the first vote (transition from pending to voting)
    IF (SELECT status FROM appeals WHERE id = NEW.appeal_id) = 'pending' THEN
        SELECT * INTO v_config FROM wot_config WHERE id = 1;
        
        UPDATE appeals SET 
            status = 'voting',
            voting_ends_at = NOW() + (COALESCE(v_config.appeal_voting_period_days, 3) || ' days')::INTERVAL
        WHERE id = NEW.appeal_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists to avoid error
DROP TRIGGER IF EXISTS trg_start_appeal_voting ON appeal_votes;

CREATE TRIGGER trg_start_appeal_voting
    AFTER INSERT ON appeal_votes
    FOR EACH ROW
    EXECUTE FUNCTION start_appeal_voting();

-- ============================================
-- Step 4: API function for manual appeal resolution
-- ============================================

CREATE OR REPLACE FUNCTION resolve_appeal_manually(
    p_appeal_id UUID,
    p_resolver_id TEXT,
    p_force_result TEXT -- 'accept', 'reject', or 'auto' (use vote count)
) RETURNS JSONB AS $$
DECLARE
    v_appeal RECORD;
    v_resolver_rep INTEGER;
    v_result JSONB;
BEGIN
    -- Verify resolver is genesis or high reputation
    SELECT reputation, is_genesis INTO v_resolver_rep
    FROM agent_registry WHERE agent_id = p_resolver_id;
    
    IF v_resolver_rep IS NULL OR (NOT is_genesis AND v_resolver_rep < 5000) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: need genesis or 5000+ reputation');
    END IF;
    
    -- Get appeal
    SELECT * INTO v_appeal FROM appeals WHERE id = p_appeal_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Appeal not found');
    END IF;
    
    IF p_force_result = 'auto' THEN
        -- Use normal vote processing
        v_result := process_appeal_resolution(p_appeal_id);
    ELSE
        -- Force specific result
        UPDATE appeals SET 
            status = p_force_result || 'ed',
            resolved_at = NOW(),
            resolution_reason = format('Manually %s by %s', p_force_result, p_resolver_id),
            resolved_by = p_resolver_id
        WHERE id = p_appeal_id;
        
        v_result := jsonb_build_object(
            'success', true,
            'result', p_force_result || 'ed',
            'manual_override', true,
            'resolver', p_resolver_id
        );
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Migration Complete
-- ============================================

COMMENT ON FUNCTION process_appeal_resolution IS 'Automatically resolves an appeal based on vote counts. Restores reputation and returns bond if accepted.';
COMMENT ON FUNCTION close_expired_appeals IS 'Closes all appeals past their voting period. Called by cron or scheduled job.';
COMMENT ON FUNCTION resolve_appeal_manually IS 'Allows genesis/high-rep agents to manually resolve appeals in exceptional cases.';
