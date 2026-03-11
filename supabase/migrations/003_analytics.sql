-- =====================================================
-- ClawAnalytics: Privacy-First Analytics for MoltOS
-- =====================================================
-- Core principles:
--   - NO user identities or personal data
--   - NO IP addresses or location tracking
--   - Aggregate metrics only
--   - Hashed agent IDs for privacy
--   - Automatic data retention (90 days raw, 1 year daily)
--
-- Tables:
--   - analytics_events: Raw event stream
--   - analytics_daily: Pre-aggregated daily metrics
--   - analytics_agents: Per-agent statistics (pseudonymous)
-- =====================================================

-- =====================================================
-- EXTENSIONS
-- =====================================================

-- Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enable TimescaleDB for time-series optimization (if available)
-- Note: This requires TimescaleDB extension to be installed
-- CREATE EXTENSION IF NOT EXISTS timescaledb;

-- =====================================================
-- ENUM TYPES
-- =====================================================

CREATE TYPE analytics_event_type AS ENUM (
    'agent_deployed',       -- New agent registered
    'agent_updated',        -- Agent configuration updated
    'task_started',         -- Task execution began
    'task_completed',       -- Task finished successfully
    'task_failed',          -- Task failed/crashed
    'task_cancelled',       -- Task cancelled by user
    'payment_sent',         -- Payment initiated
    'payment_received',     -- Payment completed
    'payment_failed',       -- Payment failed
    'reputation_earned',    -- Positive reputation change
    'reputation_lost',      -- Negative reputation change
    'escrow_created',       -- New escrow contract
    'escrow_funded',        -- Escrow received funds
    'escrow_completed',     -- Escrow released
    'escrow_disputed',      -- Escrow entered dispute
    'api_request',          -- API call made
    'sdk_event'             -- Custom SDK event
);

CREATE TYPE analytics_rollup_period AS ENUM (
    'hourly',
    'daily',
    'weekly',
    'monthly'
);

-- =====================================================
-- ANALYTICS EVENTS TABLE (Raw Events)
-- =====================================================
-- Stores individual privacy-preserving events
-- Retention: 90 days (automatic cleanup)

CREATE TABLE analytics_events (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event Classification
    event_type analytics_event_type NOT NULL,
    
    -- Privacy-Preserving Identifiers (hashed)
    -- These are SHA-256 hashes, not raw IDs
    agent_hash VARCHAR(64),               -- Hashed agent ID (optional)
    session_hash VARCHAR(64),             -- Hashed session ID (optional)
    
    -- Timestamp (indexed for time-series queries)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Event Metadata (JSONB for flexibility)
    -- Never contains PII, IP addresses, or personal data
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Aggregated Metrics (for immediate use)
    -- Pre-computed values to avoid expensive aggregations
    metric_value DECIMAL(20, 8),          -- Numeric value (amount, count, etc.)
    metric_unit VARCHAR(50),              -- Unit of measurement
    
    -- Shard key for horizontal scaling (optional)
    shard_key INT GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM created_at)::INT % 100
    ) STORED,
    
    -- Constraints
    CONSTRAINT valid_agent_hash CHECK (
        agent_hash IS NULL OR agent_hash ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT valid_session_hash CHECK (
        session_hash IS NULL OR session_hash ~ '^[a-f0-9]{64}$'
    )
);

-- Indexes for common query patterns
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_agent ON analytics_events(agent_hash);
CREATE INDEX idx_analytics_events_type_time ON analytics_events(event_type, created_at DESC);

-- Partial indexes for frequent queries
CREATE INDEX idx_analytics_events_recent ON analytics_events(created_at DESC)
    WHERE created_at > NOW() - INTERVAL '7 days';

-- =====================================================
-- ANALYTICS DAILY ROLLUPS TABLE
-- =====================================================
-- Pre-aggregated daily metrics for fast dashboard queries
-- Retention: 1 year

CREATE TABLE analytics_daily (
    -- Composite Primary Key
    date DATE NOT NULL,
    event_type analytics_event_type NOT NULL,
    
    -- Aggregated Metrics
    total_count BIGINT NOT NULL DEFAULT 0,
    total_value DECIMAL(20, 8) DEFAULT 0,
    unique_agents BIGINT DEFAULT 0,       -- Count of unique agent_hash
    
    -- Distribution Metrics
    min_value DECIMAL(20, 8),
    max_value DECIMAL(20, 8),
    avg_value DECIMAL(20, 8),
    
    -- Hourly breakdown (JSON for compactness)
    hourly_distribution JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (date, event_type)
);

-- Indexes
CREATE INDEX idx_analytics_daily_date ON analytics_daily(date DESC);
CREATE INDEX idx_analytics_daily_type ON analytics_daily(event_type);

-- =====================================================
-- ANALYTICS AGENTS TABLE (Pseudonymous Stats)
-- =====================================================
-- Per-agent statistics using only hashed identifiers
-- No link to actual agent identity

CREATE TABLE analytics_agents (
    -- Hashed agent ID (never store raw ID)
    agent_hash VARCHAR(64) PRIMARY KEY,
    
    -- First/Last Activity
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Task Statistics
    tasks_total BIGINT DEFAULT 0,
    tasks_completed BIGINT DEFAULT 0,
    tasks_failed BIGINT DEFAULT 0,
    tasks_cancelled BIGINT DEFAULT 0,
    
    -- Success Rate (computed)
    success_rate DECIMAL(5, 2) GENERATED ALWAYS AS (
        CASE 
            WHEN tasks_total > 0 THEN (tasks_completed::DECIMAL / tasks_total * 100)
            ELSE 0
        END
    ) STORED,
    
    -- Payment Statistics
    payments_sent_total DECIMAL(20, 8) DEFAULT 0,
    payments_received_total DECIMAL(20, 8) DEFAULT 0,
    payment_count_sent BIGINT DEFAULT 0,
    payment_count_received BIGINT DEFAULT 0,
    
    -- Reputation Tracking
    reputation_score DECIMAL(10, 2) DEFAULT 0,
    reputation_changes_positive BIGINT DEFAULT 0,
    reputation_changes_negative BIGINT DEFAULT 0,
    
    -- Activity Tracking
    total_sessions BIGINT DEFAULT 0,
    total_api_calls BIGINT DEFAULT 0,
    
    -- Daily breakdown (last 30 days, compact JSON)
    daily_activity JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_agent_hash_pk CHECK (agent_hash ~ '^[a-f0-9]{64}$')
);

-- Indexes
CREATE INDEX idx_analytics_agents_last_seen ON analytics_agents(last_seen_at DESC);
CREATE INDEX idx_analytics_agents_reputation ON analytics_agents(reputation_score DESC);
CREATE INDEX idx_analytics_agents_success_rate ON analytics_agents(success_rate DESC);
CREATE INDEX idx_analytics_agents_active ON analytics_agents(last_seen_at DESC)
    WHERE last_seen_at > NOW() - INTERVAL '7 days';

-- =====================================================
-- ANALYTICS REAL-TIME TABLE (In-Memory/Cache-like)
-- =====================================================
-- Recent events for real-time dashboards
-- Uses UNLOGGED for performance (data can be reconstructed from events)

CREATE UNLOGGED TABLE analytics_realtime (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type analytics_event_type NOT NULL,
    agent_hash VARCHAR(64),
    metric_value DECIMAL(20, 8),
    metric_unit VARCHAR(50),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for real-time queries
CREATE INDEX idx_analytics_realtime_time ON analytics_realtime(created_at DESC);
CREATE INDEX idx_analytics_realtime_type_time ON analytics_realtime(event_type, created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_realtime ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY analytics_service_all ON analytics_events
    FOR ALL
    USING (auth.jwt()->>'role' IN ('service', 'admin', 'analytics'));

CREATE POLICY analytics_daily_service_all ON analytics_daily
    FOR ALL
    USING (auth.jwt()->>'role' IN ('service', 'admin', 'analytics'));

CREATE POLICY analytics_agents_service_all ON analytics_agents
    FOR ALL
    USING (auth.jwt()->>'role' IN ('service', 'admin', 'analytics'));

CREATE POLICY analytics_realtime_service_all ON analytics_realtime
    FOR ALL
    USING (auth.jwt()->>'role' IN ('service', 'admin', 'analytics'));

-- Read-only access for dashboard users
CREATE POLICY analytics_read_dashboard ON analytics_events
    FOR SELECT
    USING (auth.jwt()->>'role' IN ('dashboard', 'viewer'));

CREATE POLICY analytics_daily_read_dashboard ON analytics_daily
    FOR SELECT
    USING (auth.jwt()->>'role' IN ('dashboard', 'viewer'));

CREATE POLICY analytics_agents_read_dashboard ON analytics_agents
    FOR SELECT
    USING (auth.jwt()->>'role' IN ('dashboard', 'viewer'));

CREATE POLICY analytics_realtime_read_dashboard ON analytics_realtime
    FOR SELECT
    USING (auth.jwt()->>'role' IN ('dashboard', 'viewer'));

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update analytics_agents on new event
CREATE OR REPLACE FUNCTION update_analytics_agents()
RETURNS TRIGGER AS $$
DECLARE
    current_daily JSONB;
    today TEXT := TO_CHAR(NEW.created_at, 'YYYY-MM-DD');
BEGIN
    -- Skip if no agent_hash
    IF NEW.agent_hash IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Insert or update agent stats
    INSERT INTO analytics_agents (agent_hash, last_seen_at)
    VALUES (NEW.agent_hash, NEW.created_at)
    ON CONFLICT (agent_hash) DO UPDATE SET
        last_seen_at = NEW.created_at,
        updated_at = NOW(),
        -- Update task counts
        tasks_total = CASE 
            WHEN NEW.event_type IN ('task_started', 'task_completed', 'task_failed', 'task_cancelled')
            THEN analytics_agents.tasks_total + 1
            ELSE analytics_agents.tasks_total
        END,
        tasks_completed = CASE 
            WHEN NEW.event_type = 'task_completed'
            THEN analytics_agents.tasks_completed + 1
            ELSE analytics_agents.tasks_completed
        END,
        tasks_failed = CASE 
            WHEN NEW.event_type = 'task_failed'
            THEN analytics_agents.tasks_failed + 1
            ELSE analytics_agents.tasks_failed
        END,
        tasks_cancelled = CASE 
            WHEN NEW.event_type = 'task_cancelled'
            THEN analytics_agents.tasks_cancelled + 1
            ELSE analytics_agents.tasks_cancelled
        END,
        -- Update payment stats
        payments_received_total = CASE 
            WHEN NEW.event_type = 'payment_received' AND NEW.metric_value IS NOT NULL
            THEN analytics_agents.payments_received_total + NEW.metric_value
            ELSE analytics_agents.payments_received_total
        END,
        payments_sent_total = CASE 
            WHEN NEW.event_type = 'payment_sent' AND NEW.metric_value IS NOT NULL
            THEN analytics_agents.payments_sent_total + NEW.metric_value
            ELSE analytics_agents.payments_sent_total
        END,
        payment_count_received = CASE 
            WHEN NEW.event_type = 'payment_received'
            THEN analytics_agents.payment_count_received + 1
            ELSE analytics_agents.payment_count_received
        END,
        payment_count_sent = CASE 
            WHEN NEW.event_type = 'payment_sent'
            THEN analytics_agents.payment_count_sent + 1
            ELSE analytics_agents.payment_count_sent
        END,
        -- Update reputation
        reputation_changes_positive = CASE 
            WHEN NEW.event_type = 'reputation_earned'
            THEN analytics_agents.reputation_changes_positive + 1
            ELSE analytics_agents.reputation_changes_positive
        END,
        reputation_changes_negative = CASE 
            WHEN NEW.event_type = 'reputation_lost'
            THEN analytics_agents.reputation_changes_negative + 1
            ELSE analytics_agents.reputation_changes_negative
        END,
        reputation_score = CASE 
            WHEN NEW.event_type = 'reputation_earned' AND NEW.metric_value IS NOT NULL
            THEN analytics_agents.reputation_score + NEW.metric_value
            WHEN NEW.event_type = 'reputation_lost' AND NEW.metric_value IS NOT NULL
            THEN analytics_agents.reputation_score - NEW.metric_value
            ELSE analytics_agents.reputation_score
        END,
        -- Update activity counts
        total_api_calls = CASE 
            WHEN NEW.event_type = 'api_request'
            THEN analytics_agents.total_api_calls + 1
            ELSE analytics_agents.total_api_calls
        END,
        total_sessions = CASE 
            WHEN NEW.event_type = 'agent_deployed'
            THEN analytics_agents.total_sessions + 1
            ELSE analytics_agents.total_sessions
        END;
    
    -- Update daily activity JSONB
    SELECT daily_activity INTO current_daily FROM analytics_agents WHERE agent_hash = NEW.agent_hash;
    
    UPDATE analytics_agents
    SET daily_activity = jsonb_set(
        COALESCE(current_daily, '{}'::jsonb),
        ARRAY[today],
        COALESCE(
            (current_daily->>today)::bigint,
            0
        )::text::jsonb,
        true
    )
    WHERE agent_hash = NEW.agent_hash;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER analytics_event_agent_update
    AFTER INSERT ON analytics_events
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_agents();

-- Function to update analytics_realtime
CREATE OR REPLACE FUNCTION update_analytics_realtime()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into realtime table
    INSERT INTO analytics_realtime (event_type, agent_hash, metric_value, metric_unit, metadata, created_at)
    VALUES (NEW.event_type, NEW.agent_hash, NEW.metric_value, NEW.metric_unit, NEW.metadata, NEW.created_at);
    
    -- Cleanup old realtime data (keep last hour)
    DELETE FROM analytics_realtime WHERE created_at < NOW() - INTERVAL '1 hour';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER analytics_event_realtime
    AFTER INSERT ON analytics_events
    FOR EACH ROW
    EXECUTE FUNCTION update_analytics_realtime();

-- Function to update daily rollups
CREATE OR REPLACE FUNCTION upsert_daily_rollup(
    p_date DATE,
    p_event_type analytics_event_type,
    p_count BIGINT DEFAULT 1,
    p_value DECIMAL(20, 8) DEFAULT 0,
    p_agent_hash VARCHAR(64) DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    current_hour INT := EXTRACT(HOUR FROM NOW());
    hour_key TEXT := current_hour::text;
    current_hourly JSONB;
BEGIN
    -- Get current hourly distribution
    SELECT hourly_distribution INTO current_hourly
    FROM analytics_daily
    WHERE date = p_date AND event_type = p_event_type;
    
    -- Insert or update rollup
    INSERT INTO analytics_daily (
        date, event_type, total_count, total_value, unique_agents,
        hourly_distribution, updated_at
    )
    VALUES (
        p_date, p_event_type, p_count, p_value, 
        CASE WHEN p_agent_hash IS NOT NULL THEN 1 ELSE 0 END,
        jsonb_build_object(hour_key, p_count),
        NOW()
    )
    ON CONFLICT (date, event_type) DO UPDATE SET
        total_count = analytics_daily.total_count + p_count,
        total_value = analytics_daily.total_value + p_value,
        unique_agents = analytics_daily.unique_agents + CASE 
            WHEN p_agent_hash IS NOT NULL 
            AND NOT EXISTS (
                SELECT 1 FROM analytics_events e
                WHERE e.created_at::date = p_date
                AND e.event_type = p_event_type
                AND e.agent_hash = p_agent_hash
                LIMIT 1
            )
            THEN 1 
            ELSE 0 
        END,
        min_value = LEAST(analytics_daily.min_value, p_value),
        max_value = GREATEST(analytics_daily.max_value, p_value),
        avg_value = (analytics_daily.total_value + p_value) / (analytics_daily.total_count + p_count),
        hourly_distribution = COALESCE(current_hourly, '{}'::jsonb) || jsonb_build_object(
            hour_key, 
            COALESCE((current_hourly->>hour_key)::bigint, 0) + p_count
        ),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to manually rollup daily stats (run via cron)
CREATE OR REPLACE FUNCTION rollup_daily_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
    event_type analytics_event_type,
    total_count BIGINT,
    total_value DECIMAL(20, 8),
    unique_agents BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.event_type,
        COUNT(*)::BIGINT as total_count,
        COALESCE(SUM(e.metric_value), 0)::DECIMAL(20, 8) as total_value,
        COUNT(DISTINCT e.agent_hash)::BIGINT as unique_agents
    FROM analytics_events e
    WHERE e.created_at::date = target_date
    GROUP BY e.event_type;
    
    -- Insert/update rollups
    INSERT INTO analytics_daily (date, event_type, total_count, total_value, unique_agents)
    SELECT 
        target_date,
        e.event_type,
        COUNT(*)::BIGINT,
        COALESCE(SUM(e.metric_value), 0)::DECIMAL(20, 8),
        COUNT(DISTINCT e.agent_hash)::BIGINT
    FROM analytics_events e
    WHERE e.created_at::date = target_date
    GROUP BY e.event_type
    ON CONFLICT (date, event_type) DO UPDATE SET
        total_count = EXCLUDED.total_count,
        total_value = EXCLUDED.total_value,
        unique_agents = EXCLUDED.unique_agents,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old data (privacy-preserving retention)
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS TABLE(deleted_events BIGINT, deleted_realtime BIGINT) AS $$
DECLARE
    deleted_count_events BIGINT;
    deleted_count_realtime BIGINT;
BEGIN
    -- Delete raw events older than 90 days
    DELETE FROM analytics_events
    WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_count_events = ROW_COUNT;
    
    -- Delete old realtime data (should be automatic, but just in case)
    DELETE FROM analytics_realtime
    WHERE created_at < NOW() - INTERVAL '1 hour';
    GET DIAGNOSTICS deleted_count_realtime = ROW_COUNT;
    
    -- Note: analytics_daily is kept for 1 year (handled separately)
    -- Note: analytics_agents keeps aggregate stats indefinitely (no PII)
    
    RETURN QUERY SELECT deleted_count_events, deleted_count_realtime;
END;
$$ LANGUAGE plpgsql;

-- Function to hash agent ID (privacy-preserving)
CREATE OR REPLACE FUNCTION hash_agent_id(agent_id TEXT)
RETURNS VARCHAR(64) AS $$
BEGIN
    IF agent_id IS NULL THEN
        RETURN NULL;
    END IF;
    -- Use SHA-256 with a pepper (adds additional security layer)
    -- In production, use an environment variable for the pepper
    RETURN encode(digest(agent_id || 'clawanalytics_pepper_2024', 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- VIEWS FOR DASHBOARDS
-- =====================================================

-- Overview metrics (last 24h, 7d, 30d)
CREATE VIEW analytics_overview AS
WITH time_ranges AS (
    SELECT 
        '24h'::text as period,
        NOW() - INTERVAL '24 hours' as start_time
    UNION ALL
    SELECT '7d'::text, NOW() - INTERVAL '7 days'
    UNION ALL
    SELECT '30d'::text, NOW() - INTERVAL '30 days'
)
SELECT 
    tr.period,
    COUNT(*) FILTER (WHERE e.event_type = 'agent_deployed') as agents_deployed,
    COUNT(*) FILTER (WHERE e.event_type = 'task_completed') as tasks_completed,
    COUNT(*) FILTER (WHERE e.event_type = 'task_failed') as tasks_failed,
    COALESCE(SUM(e.metric_value) FILTER (WHERE e.event_type IN ('payment_sent', 'payment_received')), 0) as payment_volume,
    COUNT(DISTINCT e.agent_hash) as unique_agents_active
FROM time_ranges tr
LEFT JOIN analytics_events e ON e.created_at >= tr.start_time
GROUP BY tr.period, tr.start_time
ORDER BY tr.start_time DESC;

-- Real-time activity feed
CREATE VIEW analytics_activity_feed AS
SELECT 
    e.id,
    e.event_type,
    e.agent_hash,
    e.metric_value,
    e.metric_unit,
    e.metadata,
    e.created_at,
    CASE 
        WHEN e.created_at > NOW() - INTERVAL '1 minute' THEN 'just now'
        WHEN e.created_at > NOW() - INTERVAL '5 minutes' THEN 'few minutes ago'
        WHEN e.created_at > NOW() - INTERVAL '1 hour' THEN 'recently'
        ELSE 'earlier'
    END as time_ago
FROM analytics_events e
WHERE e.created_at > NOW() - INTERVAL '24 hours'
ORDER BY e.created_at DESC
LIMIT 100;

-- Top performing agents (privacy-preserving)
CREATE VIEW analytics_top_agents AS
SELECT 
    agent_hash,
    tasks_completed,
    tasks_failed,
    success_rate,
    payments_received_total,
    payment_count_received,
    reputation_score,
    last_seen_at,
    CASE 
        WHEN tasks_completed > 100 AND success_rate > 95 THEN 'elite'
        WHEN tasks_completed > 50 AND success_rate > 90 THEN 'expert'
        WHEN tasks_completed > 10 AND success_rate > 80 THEN 'established'
        ELSE 'new'
    END as agent_tier
FROM analytics_agents
ORDER BY 
    reputation_score DESC,
    success_rate DESC,
    tasks_completed DESC
LIMIT 100;

-- Reputation distribution
CREATE VIEW analytics_reputation_distribution AS
SELECT 
    CASE 
        WHEN reputation_score >= 1000 THEN '1000+'
        WHEN reputation_score >= 500 THEN '500-999'
        WHEN reputation_score >= 100 THEN '100-499'
        WHEN reputation_score >= 10 THEN '10-99'
        ELSE '0-9'
    END as score_range,
    COUNT(*) as agent_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM analytics_agents
GROUP BY 1
ORDER BY 
    CASE 
        WHEN score_range = '1000+' THEN 1
        WHEN score_range = '500-999' THEN 2
        WHEN score_range = '100-499' THEN 3
        WHEN score_range = '10-99' THEN 4
        ELSE 5
    END;

-- Daily trends (last 30 days)
CREATE VIEW analytics_daily_trends AS
SELECT 
    d.date,
    SUM(d.total_count) FILTER (WHERE d.event_type = 'task_completed') as tasks_completed,
    SUM(d.total_count) FILTER (WHERE d.event_type = 'task_failed') as tasks_failed,
    SUM(d.total_value) FILTER (WHERE d.event_type IN ('payment_sent', 'payment_received')) as payment_volume,
    SUM(d.unique_agents) as unique_agents_active
FROM analytics_daily d
WHERE d.date > CURRENT_DATE - INTERVAL '30 days'
GROUP BY d.date
ORDER BY d.date DESC;

-- Hourly activity pattern (for heatmaps)
CREATE VIEW analytics_hourly_patterns AS
SELECT 
    EXTRACT(HOUR FROM created_at)::int as hour_of_day,
    EXTRACT(DOW FROM created_at)::int as day_of_week,
    COUNT(*) as event_count,
    COUNT(DISTINCT agent_hash) as unique_agents
FROM analytics_events
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 2, 1;

-- =====================================================
-- STORED PROCEDURES FOR API
-- =====================================================

-- Get dashboard summary
CREATE OR REPLACE FUNCTION get_analytics_dashboard()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'agents', jsonb_build_object(
            'total', (SELECT COUNT(*) FROM analytics_agents),
            'active_24h', (SELECT COUNT(DISTINCT agent_hash) FROM analytics_events WHERE created_at > NOW() - INTERVAL '24 hours'),
            'active_7d', (SELECT COUNT(DISTINCT agent_hash) FROM analytics_events WHERE created_at > NOW() - INTERVAL '7 days'),
            'new_24h', (SELECT COUNT(*) FROM analytics_agents WHERE first_seen_at > NOW() - INTERVAL '24 hours')
        ),
        'tasks', jsonb_build_object(
            'completed_24h', (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'task_completed' AND created_at > NOW() - INTERVAL '24 hours'),
            'completed_7d', (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'task_completed' AND created_at > NOW() - INTERVAL '7 days'),
            'completed_30d', (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'task_completed' AND created_at > NOW() - INTERVAL '30 days'),
            'failed_24h', (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'task_failed' AND created_at > NOW() - INTERVAL '24 hours')
        ),
        'payments', jsonb_build_object(
            'volume_24h', (SELECT COALESCE(SUM(metric_value), 0) FROM analytics_events WHERE event_type = 'payment_received' AND created_at > NOW() - INTERVAL '24 hours'),
            'volume_7d', (SELECT COALESCE(SUM(metric_value), 0) FROM analytics_events WHERE event_type = 'payment_received' AND created_at > NOW() - INTERVAL '7 days'),
            'count_24h', (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'payment_received' AND created_at > NOW() - INTERVAL '24 hours')
        ),
        'timestamp', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Get agent leaderboard
CREATE OR REPLACE FUNCTION get_agent_leaderboard(limit_count INT DEFAULT 20)
RETURNS TABLE(
    agent_hash VARCHAR(64),
    tasks_completed BIGINT,
    success_rate DECIMAL(5, 2),
    reputation_score DECIMAL(10, 2),
    payments_received_total DECIMAL(20, 8),
    agent_tier TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.agent_hash,
        a.tasks_completed,
        a.success_rate,
        a.reputation_score,
        a.payments_received_total,
        CASE 
            WHEN a.tasks_completed > 100 AND a.success_rate > 95 THEN 'elite'
            WHEN a.tasks_completed > 50 AND a.success_rate > 90 THEN 'expert'
            WHEN a.tasks_completed > 10 AND a.success_rate > 80 THEN 'established'
            ELSE 'new'
        END as agent_tier
    FROM analytics_agents a
    ORDER BY a.reputation_score DESC, a.success_rate DESC, a.tasks_completed DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE analytics_events IS 'Raw privacy-preserving analytics events. Retention: 90 days';
COMMENT ON TABLE analytics_daily IS 'Pre-aggregated daily metrics. Retention: 1 year';
COMMENT ON TABLE analytics_agents IS 'Per-agent statistics using hashed IDs only. No PII.';
COMMENT ON TABLE analytics_realtime IS 'Recent events for real-time dashboards. Ephemeral.';
COMMENT ON COLUMN analytics_events.agent_hash IS 'SHA-256 hash of agent ID. Not reversible.';
COMMENT ON COLUMN analytics_events.session_hash IS 'SHA-256 hash of session ID. Not reversible.';
COMMENT ON FUNCTION hash_agent_id IS 'Creates privacy-preserving hash of agent ID with pepper';

-- =====================================================
-- INITIAL DATA SEED (optional - for testing)
-- =====================================================

-- Create a service role for analytics (run manually if needed)
-- CREATE ROLE analytics_service WITH LOGIN PASSWORD '...';
-- GRANT ALL ON analytics_events TO analytics_service;
-- GRANT ALL ON analytics_daily TO analytics_service;
-- GRANT ALL ON analytics_agents TO analytics_service;
-- GRANT ALL ON analytics_realtime TO analytics_service;
