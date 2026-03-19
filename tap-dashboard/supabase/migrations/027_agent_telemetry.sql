-- Migration: Agent Telemetry System
-- Date: March 19, 2026
-- Description: Real-time agent telemetry for observability and trust scoring

-- ============================================
-- Agent Telemetry Data
-- ============================================

CREATE TABLE IF NOT EXISTS agent_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id) ON DELETE CASCADE,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    window_duration_seconds INTEGER NOT NULL DEFAULT 300,
    tasks_attempted INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    avg_task_duration_ms INTEGER,
    cpu_percent DECIMAL(5,2),
    memory_mb INTEGER,
    network_requests INTEGER DEFAULT 0,
    network_errors INTEGER DEFAULT 0,
    custom_metrics JSONB DEFAULT '{}',
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'agent',
    CONSTRAINT valid_window CHECK (window_end > window_start)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_agent_id ON agent_telemetry(agent_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_window ON agent_telemetry(window_start DESC, window_end DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_agent_window ON agent_telemetry(agent_id, window_start DESC);

-- ============================================
-- Agent Telemetry Aggregates (Daily Summary)
-- ============================================

CREATE TABLE IF NOT EXISTS agent_telemetry_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_tasks_attempted INTEGER DEFAULT 0,
    total_tasks_completed INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4),
    avg_task_duration_ms INTEGER,
    avg_cpu_percent DECIMAL(5,2),
    peak_memory_mb INTEGER,
    total_network_requests INTEGER DEFAULT 0,
    network_error_rate DECIMAL(5,4),
    net_attestation_score INTEGER DEFAULT 0,
    reliability_score DECIMAL(5,4),
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, date)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_daily_agent ON agent_telemetry_daily(agent_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_daily_date ON agent_telemetry_daily(date DESC);

-- ============================================
-- Telemetry-Enhanced TAP Score View
-- ============================================

CREATE OR REPLACE VIEW tap_score_with_telemetry AS
SELECT 
    ts.agent_id,
    ts.tap_score,
    ts.tier,
    ts.last_calculated_at,
    atd.success_rate AS telemetry_success_rate,
    atd.reliability_score AS telemetry_reliability,
    atd.net_attestation_score AS telemetry_net_attestations,
    atd.date AS telemetry_date,
    (
        (ts.tap_score * 0.6) + 
        (COALESCE(atd.reliability_score, 0.5) * 100 * 0.3) +
        (COALESCE(atd.success_rate, 0.5) * 100 * 0.1)
    )::INTEGER AS composite_score
FROM tap_scores ts
LEFT JOIN agent_telemetry_daily atd ON ts.agent_id = atd.agent_id
    AND atd.date = CURRENT_DATE;

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
) RETURNS UUID
LANGUAGE plpgsql
AS '
DECLARE
    v_telemetry_id UUID;
BEGIN
    INSERT INTO agent_telemetry (
        agent_id, window_start, window_end, window_duration_seconds,
        tasks_attempted, tasks_completed, tasks_failed, avg_task_duration_ms,
        cpu_percent, memory_mb, network_requests, network_errors, custom_metrics
    ) VALUES (
        p_agent_id, p_window_start, p_window_end,
        EXTRACT(EPOCH FROM (p_window_end - p_window_start))::INTEGER,
        p_tasks_attempted, p_tasks_completed, p_tasks_failed, p_avg_task_duration_ms,
        p_cpu_percent, p_memory_mb, p_network_requests, p_network_errors, p_custom_metrics
    ) RETURNING id INTO v_telemetry_id;
    
    RETURN v_telemetry_id;
END;
';

-- ============================================
-- Function: Get Agent Telemetry Summary
-- ============================================

CREATE OR REPLACE FUNCTION get_agent_telemetry_summary(
    p_agent_id TEXT,
    p_days INTEGER DEFAULT 7
) RETURNS JSONB
LANGUAGE plpgsql
AS '
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        ''agent_id'', p_agent_id,
        ''period_days'', p_days,
        ''summary'', jsonb_build_object(
            ''total_tasks_attempted'', COALESCE(SUM(total_tasks_attempted), 0),
            ''total_tasks_completed'', COALESCE(SUM(total_tasks_completed), 0),
            ''overall_success_rate'', CASE 
                WHEN SUM(total_tasks_attempted) > 0 
                THEN ROUND(SUM(total_tasks_completed)::DECIMAL / SUM(total_tasks_attempted), 4)
                ELSE 0.5
            END,
            ''avg_reliability'', ROUND(AVG(reliability_score), 4),
            ''peak_memory_mb'', MAX(peak_memory_mb),
            ''total_network_requests'', COALESCE(SUM(total_network_requests), 0)
        ),
        ''daily_breakdown'', (
            SELECT jsonb_agg(jsonb_build_object(
                ''date'', date,
                ''success_rate'', success_rate,
                ''reliability'', reliability_score,
                ''tasks_completed'', total_tasks_completed,
                ''net_attestations'', net_attestation_score
            ) ORDER BY date DESC)
            FROM agent_telemetry_daily
            WHERE agent_id = p_agent_id
            AND date >= CURRENT_DATE - (p_days || '' days'')::INTERVAL
        )
    )
    INTO v_result
    FROM agent_telemetry_daily
    WHERE agent_id = p_agent_id
    AND date >= CURRENT_DATE - (p_days || '' days'')::INTERVAL;
    
    RETURN COALESCE(v_result, jsonb_build_object(
        ''agent_id'', p_agent_id,
        ''period_days'', p_days,
        ''summary'', NULL,
        ''daily_breakdown'', ''[]''::JSONB
    ));
END;
';

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
)
LANGUAGE plpgsql
AS '
BEGIN
    RETURN QUERY
    SELECT 
        tst.agent_id,
        ar.name,
        tst.composite_score,
        tst.tap_score,
        tst.telemetry_reliability AS reliability,
        tst.telemetry_success_rate AS success_rate,
        atd.total_tasks_completed AS total_tasks
    FROM tap_score_with_telemetry tst
    JOIN agent_registry ar ON tst.agent_id = ar.agent_id
    LEFT JOIN agent_telemetry_daily atd ON tst.agent_id = atd.agent_id AND atd.date = CURRENT_DATE
    WHERE COALESCE(atd.total_tasks_completed, 0) >= p_min_tasks
    ORDER BY tst.composite_score DESC
    LIMIT p_limit;
END;
';

-- ============================================
-- Enable RLS
-- ============================================

ALTER TABLE agent_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_telemetry_daily ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Migration Complete
-- ============================================

COMMENT ON TABLE agent_telemetry IS 'Real-time performance and resource metrics from agents';
COMMENT ON TABLE agent_telemetry_daily IS 'Daily aggregated telemetry for scoring and analytics';
COMMENT ON VIEW tap_score_with_telemetry IS 'TAP scores enhanced with telemetry-derived reliability metrics';
COMMENT ON FUNCTION submit_agent_telemetry IS 'Submit a telemetry window from an agent';
COMMENT ON FUNCTION get_agent_telemetry_summary IS 'Get telemetry summary with daily breakdown';
