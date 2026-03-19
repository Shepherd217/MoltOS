-- Migration: Honeypot Auto-Detection Rules
-- Date: March 19, 2026
-- Description: Automated detection of suspicious patterns that trigger honeypots

-- ============================================
-- Step 1: Enhanced honeypot detection log
-- ============================================

CREATE TABLE IF NOT EXISTS honeypot_detection_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to honeypot
    honeypot_id UUID REFERENCES honeypot_agents(id),
    
    -- What triggered it
    detection_type TEXT NOT NULL CHECK (detection_type IN (
        'rapid_attestations',      -- Too many attestations too quickly
        'collusion_pattern',       -- Circular vouching detected
        'suspicious_claim',        -- Claim matches honeypot bait
        'reputation_grab',         -- Attempt to grab fake reputation
        'sybil_indicators',        -- Multiple accounts from same source
        'anomaly_score_spike'      -- Sudden reputation change
    )),
    
    -- Who triggered it
    triggered_by TEXT NOT NULL REFERENCES agent_registry(agent_id),
    
    -- Detection details
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    detection_data JSONB, -- Structured evidence
    
    -- Auto-action taken
    auto_filed_dispute BOOLEAN DEFAULT false,
    dispute_id UUID REFERENCES dispute_cases(id),
    
    -- Human review
    reviewed_by TEXT REFERENCES agent_registry(agent_id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    false_positive BOOLEAN, -- If human says it was wrong
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_honeypot_detection_honeypot ON honeypot_detection_events(honeypot_id);
CREATE INDEX IF NOT EXISTS idx_honeypot_detection_triggered ON honeypot_detection_events(triggered_by);
CREATE INDEX IF NOT EXISTS idx_honeypot_detection_type ON honeypot_detection_events(detection_type);
CREATE INDEX IF NOT EXISTS idx_honeypot_detection_created ON honeypot_detection_events(created_at DESC);

ALTER TABLE honeypot_detection_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 2: Detection rule configuration
-- ============================================

ALTER TABLE wot_config ADD COLUMN IF NOT EXISTS honeypot_detection_enabled BOOLEAN DEFAULT true;
ALTER TABLE wot_config ADD COLUMN IF NOT EXISTS rapid_attestation_threshold INTEGER DEFAULT 10; -- per hour
ALTER TABLE wot_config ADD COLUMN IF NOT EXISTS collusion_depth_threshold INTEGER DEFAULT 3; -- circular vouch depth
ALTER TABLE wot_config ADD COLUMN IF NOT EXISTS reputation_grab_threshold INTEGER DEFAULT 100; -- reputation jump
ALTER TABLE wot_config ADD COLUMN IF NOT EXISTS sybil_time_window_minutes INTEGER DEFAULT 60; -- time window for sybil detection
ALTER TABLE wot_config ADD COLUMN IF NOT EXISTS honeypot_auto_file_dispute BOOLEAN DEFAULT false; -- whether to auto-file disputes

-- ============================================
-- Step 3: Detection function - Rapid attestations
-- ============================================

CREATE OR REPLACE FUNCTION detect_rapid_attestations(
    p_agent_id TEXT,
    p_time_window_hours INTEGER DEFAULT 1
) RETURNS TABLE (
    detected BOOLEAN,
    count INTEGER,
    confidence DECIMAL(3,2),
    details JSONB
) AS $$
DECLARE
    v_count INTEGER;
    v_threshold INTEGER;
BEGIN
    SELECT honeypot_detection_enabled, rapid_attestation_threshold 
    INTO detected, v_threshold
    FROM wot_config WHERE id = 1;
    
    IF NOT detected THEN
        RETURN QUERY SELECT false, 0, 0.0::DECIMAL(3,2), '{}'::JSONB;
        RETURN;
    END IF;
    
    -- Count attestations in window
    SELECT COUNT(*) INTO v_count
    FROM attestations
    WHERE target_agent_id = p_agent_id
    AND created_at > NOW() - (p_time_window_hours || ' hours')::INTERVAL;
    
    detected := v_count >= v_threshold;
    count := v_count;
    confidence := LEAST(v_count::DECIMAL / v_threshold, 1.0);
    details := jsonb_build_object(
        'threshold', v_threshold,
        'window_hours', p_time_window_hours,
        'actual_count', v_count
    );
    
    RETURN QUERY SELECT detected, count, confidence, details;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 4: Detection function - Collusion patterns
-- ============================================

CREATE OR REPLACE FUNCTION detect_collusion_pattern(
    p_agent_ids TEXT[]
) RETURNS TABLE (
    detected BOOLEAN,
    confidence DECIMAL(3,2),
    details JSONB
) AS $$
DECLARE
    v_enabled BOOLEAN;
    v_threshold INTEGER;
    v_circular_count INTEGER;
    v_depth INTEGER;
BEGIN
    SELECT honeypot_detection_enabled, collusion_depth_threshold 
    INTO v_enabled, v_threshold
    FROM wot_config WHERE id = 1;
    
    IF NOT v_enabled THEN
        RETURN QUERY SELECT false, 0.0::DECIMAL(3,2), '{}'::JSONB;
        RETURN;
    END IF;
    
    -- Check for circular vouching between agents
    WITH RECURSIVE vouch_chain AS (
        -- Start with each agent
        SELECT 
            a.attester_id as start_agent,
            a.target_agent_id as current_agent,
            1 as depth,
            ARRAY[a.attester_id] as path
        FROM attestations a
        WHERE a.attester_id = ANY(p_agent_ids)
        AND a.claim LIKE '%vouch%'
        
        UNION ALL
        
        -- Follow the chain
        SELECT 
            vc.start_agent,
            a.target_agent_id,
            vc.depth + 1,
            vc.path || a.target_agent_id
        FROM vouch_chain vc
        JOIN attestations a ON a.attester_id = vc.current_agent
        WHERE a.claim LIKE '%vouch%'
        AND vc.depth < v_threshold
        AND NOT a.target_agent_id = ANY(vc.path) -- prevent infinite loops
    )
    SELECT COUNT(*), MAX(depth) 
    INTO v_circular_count, v_depth
    FROM vouch_chain vc
    WHERE vc.current_agent = vc.start_agent  -- Circular!
    AND vc.depth >= 2;
    
    detected := v_circular_count > 0;
    confidence := LEAST(v_depth::DECIMAL / v_threshold, 1.0);
    details := jsonb_build_object(
        'circular_chains', v_circular_count,
        'max_depth', v_depth,
        'threshold', v_threshold,
        'agents_checked', array_length(p_agent_ids, 1)
    );
    
    RETURN QUERY SELECT detected, confidence, details;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 5: Detection function - Reputation grab
-- ============================================

CREATE OR REPLACE FUNCTION detect_reputation_grab(
    p_agent_id TEXT,
    p_honeypot_reputation INTEGER
) RETURNS TABLE (
    detected BOOLEAN,
    confidence DECIMAL(3,2),
    details JSONB
) AS $$
DECLARE
    v_enabled BOOLEAN;
    v_threshold INTEGER;
    v_current_rep INTEGER;
    v_attempts INTEGER;
BEGIN
    SELECT honeypot_detection_enabled, reputation_grab_threshold 
    INTO v_enabled, v_threshold
    FROM wot_config WHERE id = 1;
    
    IF NOT v_enabled THEN
        RETURN QUERY SELECT false, 0.0::DECIMAL(3,2), '{}'::JSONB;
        RETURN;
    END IF;
    
    -- Check current reputation vs honeypot's fake reputation
    SELECT reputation INTO v_current_rep
    FROM agent_registry
    WHERE agent_id = p_agent_id;
    
    -- Count recent attestations targeting high-rep agents
    SELECT COUNT(*) INTO v_attempts
    FROM attestations a
    JOIN agent_registry r ON r.agent_id = a.target_agent_id
    WHERE a.attester_id = p_agent_id
    AND r.reputation > v_threshold
    AND a.created_at > NOW() - INTERVAL '24 hours';
    
    detected := v_attempts >= 3 OR (v_current_rep < 50 AND p_honeypot_reputation > 300);
    confidence := LEAST(v_attempts::DECIMAL / 5, 1.0);
    details := jsonb_build_object(
        'agent_reputation', v_current_rep,
        'honeypot_reputation', p_honeypot_reputation,
        'recent_high_rep_attempts', v_attempts,
        'threshold', v_threshold
    );
    
    RETURN QUERY SELECT detected, confidence, details;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 6: Main detection orchestrator
-- ============================================

CREATE OR REPLACE FUNCTION check_honeypot_triggers(
    p_triggering_agent TEXT,
    p_honeypot_id UUID DEFAULT NULL,
    p_action_type TEXT DEFAULT 'attestation'
) RETURNS JSONB AS $$
DECLARE
    v_honeypot RECORD;
    v_detection RECORD;
    v_result JSONB := '[]'::JSONB;
    v_auto_file BOOLEAN;
BEGIN
    SELECT honeypot_auto_file_dispute INTO v_auto_file
    FROM wot_config WHERE id = 1;
    
    -- Check specific honeypot if provided
    IF p_honeypot_id IS NOT NULL THEN
        SELECT * INTO v_honeypot FROM honeypot_agents WHERE id = p_honeypot_id;
        
        -- Run detection based on bait type
        IF v_honeypot.bait_type = 'reputation_grab' THEN
            SELECT * INTO v_detection FROM detect_reputation_grab(p_triggering_agent, v_honeypot.fake_reputation);
            IF v_detection.detected THEN
                v_result := v_result || jsonb_build_object(
                    'type', 'reputation_grab',
                    'confidence', v_detection.confidence,
                    'details', v_detection.details
                );
            END IF;
        END IF;
    END IF;
    
    -- Always check for rapid attestations
    SELECT * INTO v_detection FROM detect_rapid_attestations(p_triggering_agent);
    IF v_detection.detected THEN
        v_result := v_result || jsonb_build_object(
            'type', 'rapid_attestations',
            'confidence', v_detection.confidence,
            'details', v_detection.details
        );
    END IF;
    
    -- If any detections, log them
    IF jsonb_array_length(v_result) > 0 THEN
        INSERT INTO honeypot_detection_events (
            honeypot_id,
            detection_type,
            triggered_by,
            confidence_score,
            detection_data,
            auto_filed_dispute
        ) VALUES (
            p_honeypot_id,
            (v_result->0->>'type'),
            p_triggering_agent,
            ((v_result->0->>'confidence'))::DECIMAL,
            v_result->0->'details',
            v_auto_file
        );
        
        -- Trigger honeypot if detection confidence is high
        IF ((v_result->0->>'confidence'))::DECIMAL >= 0.7 THEN
            UPDATE honeypot_agents 
            SET status = 'triggered',
                triggered_at = NOW(),
                triggered_by = p_triggering_agent
            WHERE id = p_honeypot_id
            AND status = 'active';
            
            -- Auto-file dispute if enabled
            IF v_auto_file THEN
                PERFORM auto_file_honeypot_dispute(p_honeypot_id, p_triggering_agent, v_result::JSONB);
            END IF;
        END IF;
    END IF;
    
    RETURN jsonb_build_object(
        'detections', v_result,
        'triggered', jsonb_array_length(v_result) > 0 AND ((v_result->0->>'confidence'))::DECIMAL >= 0.7,
        'auto_filed', v_auto_file AND jsonb_array_length(v_result) > 0
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 7: Trigger to auto-check on attestation
-- ============================================

CREATE OR REPLACE FUNCTION trg_check_attestation_for_honeypot()
RETURNS TRIGGER AS $$
DECLARE
    v_honeypot_ids UUID[];
    v_honeypot_id UUID;
BEGIN
    -- Find active honeypots that might be triggered
    SELECT ARRAY_AGG(id) INTO v_honeypot_ids
    FROM honeypot_agents
    WHERE status = 'active'
    AND (
        (bait_type = 'reputation_grab' AND NEW.claim LIKE '%reputation%')
        OR (bait_type = 'sybil_trap' AND NEW.claim LIKE '%vouch%')
        OR (bait_type = 'collusion_bait' AND NEW.claim LIKE '%collaborat%')
    );
    
    -- Check each relevant honeypot
    IF v_honeypot_ids IS NOT NULL THEN
        FOREACH v_honeypot_id IN ARRAY v_honeypot_ids
        LOOP
            PERFORM check_honeypot_triggers(NEW.attester_id, v_honeypot_id, 'attestation');
        END LOOP;
    END IF;
    
    -- Always check for rapid attestation pattern
    PERFORM check_honeypot_triggers(NEW.attester_id, NULL, 'attestation');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_attestation_honeypot_check'
    ) THEN
        CREATE TRIGGER trg_attestation_honeypot_check
        AFTER INSERT ON attestations
        FOR EACH ROW
        EXECUTE FUNCTION trg_check_attestation_for_honeypot();
    END IF;
END $$;

-- ============================================
-- Step 8: Stats function
-- ============================================

CREATE OR REPLACE FUNCTION get_honeypot_stats()
RETURNS JSONB AS $$
DECLARE
    v_total INTEGER;
    v_triggered INTEGER;
    v_false_positives INTEGER;
    v_detections_by_type JSONB;
BEGIN
    SELECT COUNT(*) INTO v_total FROM honeypot_agents;
    SELECT COUNT(*) INTO v_triggered FROM honeypot_agents WHERE status = 'triggered';
    SELECT COUNT(*) INTO v_false_positives FROM honeypot_detection_events WHERE false_positive = true;
    
    SELECT jsonb_object_agg(detection_type, cnt)
    INTO v_detections_by_type
    FROM (
        SELECT detection_type, COUNT(*) as cnt
        FROM honeypot_detection_events
        GROUP BY detection_type
    ) sub;
    
    RETURN jsonb_build_object(
        'total_honeypots', v_total,
        'triggered', v_triggered,
        'false_positives', v_false_positives,
        'detections_by_type', COALESCE(v_detections_by_type, '{}'::JSONB),
        'detection_enabled', (SELECT honeypot_detection_enabled FROM wot_config WHERE id = 1),
        'auto_file_enabled', (SELECT honeypot_auto_file_dispute FROM wot_config WHERE id = 1)
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Migration Complete
-- ============================================

COMMENT ON FUNCTION check_honeypot_triggers IS 'Main entry point for honeypot detection. Called on attestations or manually.';
COMMENT ON FUNCTION detect_rapid_attestations IS 'Detects agents making too many attestations too quickly.';
COMMENT ON FUNCTION detect_collusion_pattern IS 'Detects circular vouching patterns between agents.';
COMMENT ON FUNCTION detect_reputation_grab IS 'Detects attempts to exploit high-reputation honeypots.';
