-- Migration: Agent Telemetry System
-- Date: March 19, 2026
-- Description: Real-time agent telemetry for observability and trust scoring

-- ============================================
-- Agent Telemetry Data
-- ============================================

CREATE TABLE IF NOT EXISTS agent_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Agent reference
    agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id) ON DELETE CASCADE,
    
    -- Telemetry window
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    window_duration_seconds INTEGER NOT NULL DEFAULT 300, -- 5 min default
    
    -- Performance metrics
    tasks_attempted INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    avg_task_duration_ms INTEGER,
    p95_task_duration_ms INTEGER,
    p99_task_duration_ms INTEGER,
    
    -- Resource metrics
    cpu_percent DECIMAL(5,2),
    memory_mb INTEGER,
    network_requests INTEGER DEFAULT 0,
    network_errors INTEGER DEFAULT 0,
    
    -- Quality metrics
    attestation_count INTEGER DEFAULT 0,
    positive_attestations INTEGER DEFAULT 0,
    negative_attestations INTEGER DEFAULT 0,
    
    -- Reliability
    uptime_seconds INTEGER DEFAULT 0,
    restarts INTEGER DEFAULT 0,
    
    -- Custom metrics (agent-defined)
    custom_metrics JSONB DEFAULT '{}',
    
    -- Metadata
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'agent', -- 'agent', 'health_monitor', 'external'
    
    -- Index for efficient queries
    CONSTRAINT valid_window CHECK (window_end > window_start)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_telemetry_agent_id ON agent_telemetry(agent_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_window ON agent_telemetry(window_start DESC, window_end DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_reported ON agent_telemetry(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_agent_window ON agent_telemetry(agent_id, window_start DESC);

-- Time-series optimized: partition by week for high-volume deployments
-- CREATE TABLE agent_telemetry_2025_03 PARTITION OF agent_telemetry
--     FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- ============================================
-- Agent Telemetry Aggregates (Daily Summary)
-- ============================================

CREATE TABLE IF NOT EXISTS agent_telemetry_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Aggregated performance
    total_tasks_attempted INTEGER DEFAULT 0,
    total_tasks_completed INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4), -- 0.0 to 1.0
    avg_task_duration_ms INTEGER,
    
    -- Aggregated resources
    avg_cpu_percent DECIMAL(5,2),
    peak_memory_mb INTEGER,
    total_network_requests INTEGER DEFAULT 0,
    network_error_rate DECIMAL(5,4),
    
    -- Aggregated quality
    net_attestation_score INTEGER DEFAULT 0, -- positive - negative
    
    -- Reliability score (derived)
    reliability_score DECIMAL(5,4), -- 0.0 to 1.0
    
    -- Calculated at
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one summary per agent per day
    UNIQUE(agent_id, date)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_daily_agent ON agent_telemetry_daily(agent_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_daily_date ON agent_telemetry_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_daily_reliability ON agent_telemetry_daily(reliability_score DESC);

-- ============================================
-- Telemetry-Enhanced TAP Score View
-- ============================================

CREATE OR REPLACE VIEW tap_score_with_telemetry AS
SELECT 
    ts.agent_id,
    ts.global_score,
    ts.local_trust,
    ts.rank,
    ts.percentile,
    ts.total_vouches,
    ts.updated_at,
    -- Latest telemetry
    atd.success_rate AS telemetry_success_rate,
    atd.reliability_score AS telemetry_reliability,
    atd.net_attestation_score AS telemetry_net_attestations,
    atd.date AS telemetry_date,
    -- Composite score (TAP + telemetry)
    (
        (ts.global_score * 0.6) + 
        (COALESCE(atd.reliability_score, 0.5) * 100 * 0.3) +
        (COALESCE(atd.success_rate, 0.5) * 100 * 0.1)
    )::INTEGER AS composite_score
FROM tap_scores ts
LEFT JOIN agent_telemetry_daily atd ON ts.agent_id = atd.agent_id
    AND atd.date = CURRENT_DATE
    AND atd.calculated_at = (
        SELECT MAX(calculated_at) 
        FROM agent_telemetry_daily 
        WHERE agent_id = ts.agent_id AND date = CURRENT_DATE
    );

-- ============================================
-- Function: Submit Telemetry
-- ============================================

CREATE OR REPLACE FUNCTION submit_agent_telemetry(
    p_agent_id TEXT,
    p_window_start TIMESTAMPTZ,
    p_window_end TIMESTAMPTZ,
    p_tasks_attempted INTEGER DEFAULT 0,
    p_tasks_completed INTEGER DEFAULT 0,
    p_tasks_failed INTEGER DEFAULT 0,
    p_avg_task_duration_ms INTEGER DEFAULT NULL,
    p_cpu_percent DECIMAL DEFAULT NULL,
    p_memory_mb INTEGER DEFAULT NULL,
    p_network_requests INTEGER DEFAULT 0,
    p_network_errors INTEGER DEFAULT 0,
    p_custom_metrics JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_telemetry_id UUID;
    v_window_duration INTEGER;
BEGIN
    -- Calculate window duration
    v_window_duration := EXTRACT(EPOCH FROM (p_window_end - p_window_start))::INTEGER;
    
    -- Insert telemetry record
    INSERT INTO agent_telemetry (
        agent_id,
        window_start,
        window_end,
        window_duration_seconds,
        tasks_attempted,
        tasks_completed,
        tasks_failed,
        avg_task_duration_ms,
        cpu_percent,
        memory_mb,
        network_requests,
        network_errors,
        custom_metrics,
        source
    ) VALUES (
        p_agent_id,
        p_window_start,
        p_window_end,
        v_window_duration,
        p_tasks_attempted,
        p_tasks_completed,
        p_tasks_failed,
        p_avg_task_duration_ms,
        p_cpu_percent,
        p_memory_mb,
        p_network_requests,
        p_network_errors,
        p_custom_metrics,
        'agent'
    ) RETURNING id INTO v_telemetry_id;
    
    -- Update daily aggregates
    PERFORM calculate_telemetry_daily(p_agent_id, CURRENT_DATE);
    
    RETURN v_telemetry_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Calculate Daily Telemetry Aggregates
-- ============================================

CREATE OR REPLACE FUNCTION calculate_telemetry_daily(
    p_agent_id TEXT,
    p_date DATE
) RETURNS VOID AS $$
DECLARE
    v_success_rate DECIMAL(5,4);
    v_reliability DECIMAL(5,4);
    v_net_attestations INTEGER;
BEGIN
    -- Calculate success rate from telemetry
    SELECT 
        CASE 
            WHEN SUM(tasks_attempted) > 0 
            THEN SUM(tasks_completed)::DECIMAL / SUM(tasks_attempted)
            ELSE 0.5
        END
    INTO v_success_rate
    FROM agent_telemetry
    WHERE agent_id = p_agent_id
    AND window_start::DATE = p_date;
    
    -- Calculate reliability (based on uptime vs restarts)
    SELECT 
        CASE 
            WHEN SUM(uptime_seconds + restarts * 300) > 0 
            THEN SUM(uptime_seconds)::DECIMAL / SUM(uptime_seconds + restarts * 300)
            ELSE 0.5
        END
    INTO v_reliability
    FROM agent_telemetry
    WHERE agent_id = p_agent_id
    AND window_start::DATE = p_date;
    
    -- Get net attestations from attestations table
    SELECT 
        COUNT(*) FILTER (WHERE score > 0) - COUNT(*) FILTER (WHERE score < 0)
    INTO v_net_attestations
    FROM attestations
    WHERE target_agent_id = p_agent_id
    AND created_at::DATE = p_date;
    
    -- Upsert daily aggregate
    INSERT INTO agent_telemetry_daily (
        agent_id,
        date,
        total_tasks_attempted,
        total_tasks_completed,
        success_rate,
        avg_task_duration_ms,
        avg_cpu_percent,
        peak_memory_mb,
        total_network_requests,
        reliability_score,
        net_attestation_score
    )
    SELECT 
        p_agent_id,
        p_date,
        COALESCE(SUM(tasks_attempted), 0),
        COALESCE(SUM(tasks_completed), 0),
        v_success_rate,
        AVG(avg_task_duration_ms)::INTEGER,
        AVG(cpu_percent)::DECIMAL(5,2),
        MAX(memory_mb),
        COALESCE(SUM(network_requests), 0),
        v_reliability,
        v_net_attestations
    FROM agent_telemetry
    WHERE agent_id = p_agent_id
    AND window_start::DATE = p_date
    ON CONFLICT (agent_id, date) DO UPDATE SET
        total_tasks_attempted = EXCLUDED.total_tasks_attempted,
        total_tasks_completed = EXCLUDED.total_tasks_completed,
        success_rate = EXCLUDED.success_rate,
        avg_task_duration_ms = EXCLUDED.avg_task_duration_ms,
        avg_cpu_percent = EXCLUDED.avg_cpu_percent,
        peak_memory_mb = EXCLUDED.peak_memory_mb,
        total_network_requests = EXCLUDED.total_network_requests,
        reliability_score = EXCLUDED.reliability_score,
        net_attestation_score = EXCLUDED.net_attestation_score,
        calculated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Get Agent Telemetry Summary
-- ============================================

CREATE OR REPLACE FUNCTION get_agent_telemetry_summary(
    p_agent_id TEXT,
    p_days INTEGER DEFAULT 7
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'agent_id', p_agent_id,
        'period_days', p_days,
        'summary', jsonb_build_object(
            'total_tasks_attempted', COALESCE(SUM(total_tasks_attempted), 0),
            'total_tasks_completed', COALESCE(SUM(total_tasks_completed), 0),
            'overall_success_rate', CASE 
                WHEN SUM(total_tasks_attempted) > 0 
                THEN ROUND(SUM(total_tasks_completed)::DECIMAL / SUM(total_tasks_attempted), 4)
                ELSE 0.5
            END,
            'avg_reliability', ROUND(AVG(reliability_score), 4),
            'peak_memory_mb', MAX(peak_memory_mb),
            'total_network_requests', COALESCE(SUM(total_network_requests), 0)
        ),
        'daily_breakdown', (
            SELECT jsonb_agg(jsonb_build_object(
                'date', date,
                'success_rate', success_rate,
                'reliability', reliability_score,
                'tasks_completed', total_tasks_completed,
                'net_attestations', net_attestation_score
            ) ORDER BY date DESC)
            FROM agent_telemetry_daily
            WHERE agent_id = p_agent_id
            AND date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
        )
    )
    INTO v_result
    FROM agent_telemetry_daily
    WHERE agent_id = p_agent_id
    AND date >= CURRENT_DATE - (p_days || ' days')::INTERVAL;
    
    RETURN COALESCE(v_result, jsonb_build_object(
        'agent_id', p_agent_id,
        'period_days', p_days,
        'summary', NULL,
        'daily_breakdown', '[]'::JSONB
    ));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Get Top Performers by Telemetry
-- ============================================

CREATE OR REPLACE FUNCTION get_top_performers_by_telemetry(
    p_limit INTEGER DEFAULT 10,
    p_min_tasks INTEGER DEFAULT 10
) RETURNS TABLE (
    agent_id TEXT,
    name TEXT,
    composite_score INTEGER,
    tap_score INTEGER,
    reliability DECIMAL(5,4),
    success_rate DECIMAL(5,4),
    total_tasks INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tst.agent_id,
        ar.name,
        tst.composite_score,
        tst.global_score AS tap_score,
        tst.telemetry_reliability AS reliability,
        tst.telemetry_success_rate AS success_rate,
        atd.total_tasks_completed AS total_tasks
    FROM tap_score_with_telemetry tst
    JOIN agent_registry ar ON tst.agent_id = ar.agent_id
    LEFT JOIN agent_telemetry_daily atd ON tst.agent_id = atd.agent_id
        AND atd.date = CURRENT_DATE
    WHERE atd.total_tasks_completed >= p_min_tasks
    ORDER BY tst.composite_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Cleanup Function
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_telemetry(
    p_days INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM agent_telemetry
    WHERE window_start < NOW() - (p_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE agent_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_telemetry_daily ENABLE ROW LEVEL SECURITY;

-- Agents can see their own telemetry
CREATE POLICY agent_telemetry_own ON agent_telemetry
    FOR SELECT USING (agent_id = current_setting('app.current_agent_id', true));

-- Public can see aggregated daily stats
CREATE POLICY agent_telemetry_daily_public ON agent_telemetry_daily
    FOR SELECT USING (true);

-- ============================================
-- Migration Complete
-- ============================================

COMMENT ON TABLE agent_telemetry IS 'Real-time performance and resource metrics from agents';
COMMENT ON TABLE agent_telemetry_daily IS 'Daily aggregated telemetry for scoring and analytics';
COMMENT ON VIEW tap_score_with_telemetry IS 'TAP scores enhanced with telemetry-derived reliability metrics';
COMMENT ON FUNCTION submit_agent_telemetry IS 'Submit a telemetry window from an agent';
COMMENT ON FUNCTION get_agent_telemetry_summary IS 'Get telemetry summary with daily breakdown';
