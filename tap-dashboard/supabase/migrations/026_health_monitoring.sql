-- Migration: Health Monitoring and Alerting Infrastructure
-- Date: March 19, 2026
-- Description: Database tables for health checks, metrics, and alerting

-- ============================================
-- Health Events Log
-- ============================================

CREATE TABLE IF NOT EXISTS health_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event source and type
    source TEXT NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'check',
    
    -- Status
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
    
    -- Message and details
    message TEXT,
    details JSONB,
    
    -- Component that reported the event
    component TEXT,
    response_time_ms INTEGER,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Index for time-series queries
    CONSTRAINT valid_event_type CHECK (event_type IN ('check', 'alert', 'recovery', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_health_events_source ON health_events(source);
CREATE INDEX IF NOT EXISTS idx_health_events_status ON health_events(status);
CREATE INDEX IF NOT EXISTS idx_health_events_component ON health_events(component);
CREATE INDEX IF NOT EXISTS idx_health_events_created ON health_events(created_at DESC);

-- Partition by time for large-scale deployments
-- CREATE TABLE health_events_2025_03 PARTITION OF health_events
--     FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- ============================================
-- Alert History
-- ============================================

CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Alert classification
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
    component TEXT NOT NULL,
    
    -- Alert content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    
    -- Delivery status
    discord_sent BOOLEAN DEFAULT false,
    pagerduty_sent BOOLEAN DEFAULT false,
    email_sent BOOLEAN DEFAULT false,
    
    -- Resolution tracking
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    resolution_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_severity ON alert_history(severity);
CREATE INDEX IF NOT EXISTS idx_alert_history_component ON alert_history(component);
CREATE INDEX IF NOT EXISTS idx_alert_history_created ON alert_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_resolved ON alert_history(resolved_at) WHERE resolved_at IS NULL;

-- ============================================
-- System Metrics (Time Series)
-- ============================================

CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Metric identification
    metric_name TEXT NOT NULL,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('counter', 'gauge', 'histogram')),
    
    -- Value
    value DOUBLE PRECISION NOT NULL,
    
    -- Labels/tags for filtering
    labels JSONB DEFAULT '{}',
    
    -- Source
    component TEXT,
    host TEXT,
    
    -- Timestamp with nanosecond precision for high-frequency metrics
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_component ON system_metrics(component);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_time ON system_metrics(metric_name, timestamp DESC);

-- ============================================
-- Automated Backup Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS backup_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Backup identification
    backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'incremental', 'schema')),
    
    -- Status
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    
    -- Storage details
    storage_provider TEXT NOT NULL, -- 's3', 'gcs', 'azure', 'local'
    storage_path TEXT NOT NULL,
    storage_region TEXT,
    
    -- Size information
    size_bytes BIGINT,
    table_count INTEGER,
    row_count_estimate BIGINT,
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- Error tracking
    error_message TEXT,
    
    -- Verification
    checksum TEXT,
    verified_at TIMESTAMPTZ,
    verification_status TEXT CHECK (verification_status IN ('pending', 'verified', 'failed')),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_history_type ON backup_history(backup_type);
CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(status);
CREATE INDEX IF NOT EXISTS idx_backup_history_started ON backup_history(started_at DESC);

-- ============================================
-- Function: Record Health Check
-- ============================================

CREATE OR REPLACE FUNCTION record_health_check(
    p_source TEXT,
    p_status TEXT,
    p_component TEXT,
    p_response_time_ms INTEGER,
    p_message TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO health_events (
        source,
        event_type,
        status,
        component,
        response_time_ms,
        message,
        details
    ) VALUES (
        p_source,
        'check',
        p_status,
        p_component,
        p_response_time_ms,
        p_message,
        p_details
    ) RETURNING id INTO v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Trigger Alert
-- ============================================

CREATE OR REPLACE FUNCTION trigger_alert(
    p_severity TEXT,
    p_component TEXT,
    p_title TEXT,
    p_message TEXT,
    p_details JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_alert_id UUID;
    v_last_alert_time TIMESTAMPTZ;
    v_cooldown_seconds INTEGER := 300; -- 5 minute cooldown
BEGIN
    -- Check cooldown
    SELECT created_at INTO v_last_alert_time
    FROM alert_history
    WHERE component = p_component
    AND severity = p_severity
    AND created_at > NOW() - (v_cooldown_seconds || ' seconds')::INTERVAL
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_last_alert_time IS NOT NULL THEN
        -- Alert throttled
        RETURN NULL;
    END IF;
    
    -- Insert alert
    INSERT INTO alert_history (
        severity,
        component,
        title,
        message,
        details
    ) VALUES (
        p_severity,
        p_component,
        p_title,
        p_message,
        p_details
    ) RETURNING id INTO v_alert_id;
    
    RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Resolve Alert
-- ============================================

CREATE OR REPLACE FUNCTION resolve_alert(
    p_alert_id UUID,
    p_resolved_by TEXT,
    p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE alert_history SET
        resolved_at = NOW(),
        resolved_by = p_resolved_by,
        resolution_notes = p_notes
    WHERE id = p_alert_id
    AND resolved_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Record System Metric
-- ============================================

CREATE OR REPLACE FUNCTION record_metric(
    p_metric_name TEXT,
    p_metric_type TEXT,
    p_value DOUBLE PRECISION,
    p_component TEXT DEFAULT NULL,
    p_labels JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_metric_id UUID;
BEGIN
    INSERT INTO system_metrics (
        metric_name,
        metric_type,
        value,
        component,
        labels,
        host
    ) VALUES (
        p_metric_name,
        p_metric_type,
        p_value,
        p_component,
        p_labels,
        inet_server_addr()::TEXT
    ) RETURNING id INTO v_metric_id;
    
    RETURN v_metric_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Get Health Summary
-- ============================================

CREATE OR REPLACE FUNCTION get_health_summary(
    p_hours INTEGER DEFAULT 24
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'period_hours', p_hours,
        'checks', jsonb_build_object(
            'total', COUNT(*),
            'healthy', COUNT(*) FILTER (WHERE status = 'healthy'),
            'degraded', COUNT(*) FILTER (WHERE status = 'degraded'),
            'unhealthy', COUNT(*) FILTER (WHERE status = 'unhealthy')
        ),
        'alerts', jsonb_build_object(
            'total', (SELECT COUNT(*) FROM alert_history WHERE created_at > NOW() - (p_hours || ' hours')::INTERVAL),
            'critical', (SELECT COUNT(*) FROM alert_history WHERE severity = 'critical' AND created_at > NOW() - (p_hours || ' hours')::INTERVAL),
            'warning', (SELECT COUNT(*) FROM alert_history WHERE severity = 'warning' AND created_at > NOW() - (p_hours || ' hours')::INTERVAL),
            'unresolved', (SELECT COUNT(*) FROM alert_history WHERE resolved_at IS NULL)
        ),
        'avg_response_time_ms', ROUND(AVG(response_time_ms))
    )
    INTO v_result
    FROM health_events
    WHERE created_at > NOW() - (p_hours || ' hours')::INTERVAL
    AND event_type = 'check';
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function: Cleanup Old Health Data
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_health_data(
    p_days INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
    v_deleted_health INTEGER;
    v_deleted_metrics INTEGER;
BEGIN
    -- Delete old health events
    DELETE FROM health_events
    WHERE created_at < NOW() - (p_days || ' days')::INTERVAL;
    GET DIAGNOSTICS v_deleted_health = ROW_COUNT;
    
    -- Delete old metrics (keep longer for trend analysis)
    DELETE FROM system_metrics
    WHERE timestamp < NOW() - ((p_days * 2) || ' days')::INTERVAL;
    GET DIAGNOSTICS v_deleted_metrics = ROW_COUNT;
    
    RETURN v_deleted_health + v_deleted_metrics;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Enable RLS
-- ============================================

ALTER TABLE health_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Migration Complete
-- ============================================

COMMENT ON TABLE health_events IS 'Log of all health check events from components';
COMMENT ON TABLE alert_history IS 'History of alerts sent to operators';
COMMENT ON TABLE system_metrics IS 'Time-series metrics for monitoring';
COMMENT ON TABLE backup_history IS 'Tracking for automated database backups';
COMMENT ON FUNCTION get_health_summary IS 'Get health summary for dashboard display';
COMMENT ON FUNCTION trigger_alert IS 'Create alert with automatic cooldown';
