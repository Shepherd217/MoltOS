-- =====================================================
-- ClawMemory - Native Memory System for MoltOS
-- =====================================================
-- Tables:
--   - memory_sessions: Session metadata and context
--   - memory_entries: Individual memory items with vector embeddings
--   - memory_index: Vector search index using pgvector
--   - memory_summaries: Daily/weekly consolidated memory summaries
--
-- Features:
--   - Vector embeddings for semantic search (384-dim all-MiniLM-L6-v2)
--   - Automatic pruning (90 days detailed, compressed older)
--   - Session-based short-term vs long-term memory
--   - RLS policies for privacy
-- =====================================================

-- Enable pgvector extension for vector search
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- ENUM TYPES
-- =====================================================

CREATE TYPE memory_entry_type AS ENUM (
    'conversation',     -- Direct conversation with agent
    'observation',      -- Something the agent observed
    'action',           -- Action the agent took
    'decision',         -- Important decision made
    'user_preference',  -- User preferences/settings
    'system_event',     -- System-level events
    'consolidated'      -- Compressed/summarized memory
);

CREATE TYPE memory_importance AS ENUM (
    'low',      -- Ephemeral, may be pruned quickly
    'medium',   -- Standard importance
    'high',     -- Important, keep longer
    'critical'  -- Never auto-prune
);

CREATE TYPE memory_session_status AS ENUM (
    'active',      -- Currently ongoing
    'paused',      -- Temporarily paused
    'completed',   -- Normal completion
    'archived'     -- Archived after consolidation
);

-- =====================================================
-- MEMORY SESSIONS TABLE
-- =====================================================

CREATE TABLE memory_sessions (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership & Context
    user_id UUID NOT NULL,                  -- User who owns this session
    agent_id TEXT,                          -- Agent that managed the session
    parent_session_id UUID,                 -- For session branching/forking
    
    -- Session Metadata
    title TEXT,                             -- Auto-generated or user-provided title
    description TEXT,                       -- Brief description of session context
    status memory_session_status NOT NULL DEFAULT 'active',
    
    -- Context Window
    context_window JSONB DEFAULT '{}'::jsonb, -- Active working memory
    context_tokens INT DEFAULT 0,           -- Estimated token count
    max_tokens INT DEFAULT 8000,            -- Max tokens for this session
    
    -- Statistics
    entry_count INT DEFAULT 0,              -- Number of entries in this session
    total_tokens INT DEFAULT 0,             -- Total tokens across all entries
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,                   -- When session was completed
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Consolidation
    consolidated BOOLEAN DEFAULT FALSE,     -- Has been compressed
    summary_id UUID,                        -- Link to summary if consolidated
    
    -- Tags & Metadata
    tags TEXT[] DEFAULT '{}',               -- Searchable tags
    source TEXT,                            -- Source app/integration
    metadata JSONB DEFAULT '{}'::jsonb,     -- Flexible metadata
    
    -- Constraints
    CONSTRAINT valid_context_tokens CHECK (context_tokens >= 0),
    CONSTRAINT valid_max_tokens CHECK (max_tokens > 0)
);

-- Indexes for common queries
CREATE INDEX idx_memory_sessions_user ON memory_sessions(user_id);
CREATE INDEX idx_memory_sessions_agent ON memory_sessions(agent_id);
CREATE INDEX idx_memory_sessions_status ON memory_sessions(status);
CREATE INDEX idx_memory_sessions_parent ON memory_sessions(parent_session_id);
CREATE INDEX idx_memory_sessions_created ON memory_sessions(created_at DESC);
CREATE INDEX idx_memory_sessions_updated ON memory_sessions(updated_at DESC);
CREATE INDEX idx_memory_sessions_last_accessed ON memory_sessions(last_accessed_at DESC);
CREATE INDEX idx_memory_sessions_tags ON memory_sessions USING GIN(tags);

-- =====================================================
-- MEMORY ENTRIES TABLE
-- =====================================================

CREATE TABLE memory_entries (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    session_id UUID NOT NULL REFERENCES memory_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,                  -- Denormalized for RLS
    
    -- Content
    content TEXT NOT NULL,                  -- The actual memory content
    content_type memory_entry_type NOT NULL DEFAULT 'conversation',
    importance memory_importance NOT NULL DEFAULT 'medium',
    
    -- Vector Embedding (384 dimensions for all-MiniLM-L6-v2)
    embedding VECTOR(384),                  -- Semantic vector representation
    embedding_model TEXT DEFAULT 'all-MiniLM-L6-v2', -- Model used
    
    -- Context & Relationships
    role TEXT,                              -- 'user', 'assistant', 'system', 'tool'
    turn_number INT,                        -- Position in conversation
    reply_to UUID,                          -- Reference to parent entry
    related_entries UUID[],                 -- Related memory IDs
    
    -- Search & Retrieval
    keywords TEXT[],                        -- Extracted keywords
    entities TEXT[],                        -- Named entities mentioned
    
    -- Token Tracking
    token_count INT DEFAULT 0,              -- Token count for this entry
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    timestamp TIMESTAMPTZ,                  -- Original event timestamp (if different)
    
    -- Compression
    compressed BOOLEAN DEFAULT FALSE,       -- Is this a compressed entry
    original_entry_ids UUID[],              -- If compressed, IDs of original entries
    compression_ratio DECIMAL(3,2),         -- How much it was compressed (e.g., 0.75)
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,     -- Flexible metadata
    
    -- Constraints
    CONSTRAINT valid_token_count CHECK (token_count >= 0),
    CONSTRAINT valid_turn_number CHECK (turn_number >= 0),
    CONSTRAINT valid_compression CHECK (compression_ratio IS NULL OR (compression_ratio > 0 AND compression_ratio <= 1))
);

-- Indexes
CREATE INDEX idx_memory_entries_session ON memory_entries(session_id);
CREATE INDEX idx_memory_entries_user ON memory_entries(user_id);
CREATE INDEX idx_memory_entries_type ON memory_entries(content_type);
CREATE INDEX idx_memory_entries_importance ON memory_entries(importance);
CREATE INDEX idx_memory_entries_created ON memory_entries(created_at DESC);
CREATE INDEX idx_memory_entries_role ON memory_entries(role);
CREATE INDEX idx_memory_entries_keywords ON memory_entries USING GIN(keywords);
CREATE INDEX idx_memory_entries_entities ON memory_entries USING GIN(entities);
CREATE INDEX idx_memory_entries_reply ON memory_entries(reply_to);

-- Vector similarity search index (IVFFlat for performance with large datasets)
CREATE INDEX idx_memory_entries_embedding ON memory_entries 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- =====================================================
-- MEMORY SUMMARIES TABLE (Consolidated Memories)
-- =====================================================

CREATE TABLE memory_summaries (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership
    user_id UUID NOT NULL,
    
    -- Time Period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    period_type TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
    
    -- Summary Content
    summary TEXT NOT NULL,                  -- Condensed summary
    key_points TEXT[],                      -- Key takeaways
    action_items TEXT[],                    -- Actions to remember
    decisions JSONB,                        -- Important decisions made
    
    -- Vector for semantic search of summaries
    embedding VECTOR(384),
    
    -- Statistics
    original_entry_count INT NOT NULL,      -- How many entries were compressed
    compression_ratio DECIMAL(3,2) NOT NULL, -- e.g., 0.10 = 90% compression
    
    -- Source Sessions
    session_ids UUID[],                     -- Sessions included in this summary
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Constraints
    CONSTRAINT valid_period CHECK (period_end > period_start),
    CONSTRAINT valid_period_type CHECK (period_type IN ('daily', 'weekly', 'monthly', 'custom'))
);

-- Indexes
CREATE INDEX idx_memory_summaries_user ON memory_summaries(user_id);
CREATE INDEX idx_memory_summaries_period ON memory_summaries(period_start DESC, period_end DESC);
CREATE INDEX idx_memory_summaries_type ON memory_summaries(period_type);
CREATE INDEX idx_memory_summaries_embedding ON memory_summaries 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 50);

-- =====================================================
-- MEMORY ACCESS LOG (For analytics & debugging)
-- =====================================================

CREATE TABLE memory_access_log (
    id UUID PRIMARY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_id UUID REFERENCES memory_sessions(id) ON DELETE SET NULL,
    entry_id UUID REFERENCES memory_entries(id) ON DELETE SET NULL,
    
    access_type TEXT NOT NULL,              -- 'read', 'write', 'search', 'delete'
    search_query TEXT,                      -- If search, the query used
    search_results_count INT,               -- Number of results returned
    
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_memory_access_user ON memory_access_log(user_id);
CREATE INDEX idx_memory_access_time ON memory_access_log(accessed_at DESC);
CREATE INDEX idx_memory_access_type ON memory_access_log(access_type);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE memory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_access_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- MEMORY SESSIONS RLS POLICIES
-- =====================================================

-- Users can only see their own sessions
CREATE POLICY memory_sessions_select_own ON memory_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can only insert their own sessions
CREATE POLICY memory_sessions_insert_own ON memory_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can only update their own sessions
CREATE POLICY memory_sessions_update_own ON memory_sessions
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can only delete their own sessions
CREATE POLICY memory_sessions_delete_own ON memory_sessions
    FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can access all sessions (for consolidation jobs)
CREATE POLICY memory_sessions_service ON memory_sessions
    FOR ALL
    USING (auth.jwt()->>'role' IN ('service', 'admin'));

-- =====================================================
-- MEMORY ENTRIES RLS POLICIES
-- =====================================================

CREATE POLICY memory_entries_select_own ON memory_entries
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY memory_entries_insert_own ON memory_entries
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY memory_entries_update_own ON memory_entries
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY memory_entries_delete_own ON memory_entries
    FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY memory_entries_service ON memory_entries
    FOR ALL
    USING (auth.jwt()->>'role' IN ('service', 'admin'));

-- =====================================================
-- MEMORY SUMMARIES RLS POLICIES
-- =====================================================

CREATE POLICY memory_summaries_select_own ON memory_summaries
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY memory_summaries_insert_own ON memory_summaries
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY memory_summaries_update_own ON memory_summaries
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY memory_summaries_delete_own ON memory_summaries
    FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY memory_summaries_service ON memory_summaries
    FOR ALL
    USING (auth.jwt()->>'role' IN ('service', 'admin'));

-- =====================================================
-- MEMORY ACCESS LOG RLS POLICIES
-- =====================================================

CREATE POLICY memory_access_log_select_own ON memory_access_log
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY memory_access_log_insert_own ON memory_access_log
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY memory_access_log_service ON memory_access_log
    FOR ALL
    USING (auth.jwt()->>'role' IN ('service', 'admin'));

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Auto-update updated_at on memory_sessions
CREATE OR REPLACE FUNCTION update_memory_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_accessed_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_sessions_update_timestamp
    BEFORE UPDATE ON memory_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_memory_session_timestamp();

-- Auto-increment entry count on session when entry added
CREATE OR REPLACE FUNCTION increment_session_entry_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE memory_sessions
    SET 
        entry_count = entry_count + 1,
        total_tokens = total_tokens + NEW.token_count,
        updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_entries_increment_count
    AFTER INSERT ON memory_entries
    FOR EACH ROW
    EXECUTE FUNCTION increment_session_entry_count();

-- Auto-decrement entry count on session when entry deleted
CREATE OR REPLACE FUNCTION decrement_session_entry_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE memory_sessions
    SET 
        entry_count = entry_count - 1,
        total_tokens = total_tokens - OLD.token_count,
        updated_at = NOW()
    WHERE id = OLD.session_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_entries_decrement_count
    AFTER DELETE ON memory_entries
    FOR EACH ROW
    EXECUTE FUNCTION decrement_session_entry_count();

-- Log memory access
CREATE OR REPLACE FUNCTION log_memory_access()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO memory_access_log (user_id, session_id, entry_id, access_type)
    VALUES (
        NEW.user_id,
        NEW.session_id,
        NEW.id,
        'write'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_entries_log_access
    AFTER INSERT ON memory_entries
    FOR EACH ROW
    EXECUTE FUNCTION log_memory_access();

-- =====================================================
-- SEMANTIC SEARCH FUNCTION
-- =====================================================

-- Search memories by semantic similarity
CREATE OR REPLACE FUNCTION search_memories(
    p_user_id UUID,
    p_query_embedding VECTOR(384),
    p_match_threshold FLOAT DEFAULT 0.7,
    p_match_count INT DEFAULT 10,
    p_session_id UUID DEFAULT NULL,
    p_entry_types memory_entry_type[] DEFAULT NULL,
    p_min_importance memory_importance DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    session_id UUID,
    content TEXT,
    content_type memory_entry_type,
    importance memory_importance,
    similarity FLOAT,
    created_at TIMESTAMPTZ,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        me.id,
        me.session_id,
        me.content,
        me.content_type,
        me.importance,
        1 - (me.embedding <=> p_query_embedding) as similarity,
        me.created_at,
        me.metadata
    FROM memory_entries me
    WHERE me.user_id = p_user_id
        AND me.embedding IS NOT NULL
        AND 1 - (me.embedding <=> p_query_embedding) > p_match_threshold
        AND (p_session_id IS NULL OR me.session_id = p_session_id)
        AND (p_entry_types IS NULL OR me.content_type = ANY(p_entry_types))
        AND (p_min_importance IS NULL OR 
             CASE 
                WHEN p_min_importance = 'critical' THEN me.importance = 'critical'
                WHEN p_min_importance = 'high' THEN me.importance IN ('critical', 'high')
                WHEN p_min_importance = 'medium' THEN me.importance IN ('critical', 'high', 'medium')
                ELSE TRUE
             END)
    ORDER BY me.embedding <=> p_query_embedding
    LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql;

-- Search memory summaries
CREATE OR REPLACE FUNCTION search_memory_summaries(
    p_user_id UUID,
    p_query_embedding VECTOR(384),
    p_match_threshold FLOAT DEFAULT 0.7,
    p_match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    summary TEXT,
    key_points TEXT[],
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ms.id,
        ms.period_start,
        ms.period_end,
        ms.summary,
        ms.key_points,
        1 - (ms.embedding <=> p_query_embedding) as similarity
    FROM memory_summaries ms
    WHERE ms.user_id = p_user_id
        AND ms.embedding IS NOT NULL
        AND 1 - (ms.embedding <=> p_query_embedding) > p_match_threshold
    ORDER BY ms.embedding <=> p_query_embedding
    LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CONSOLIDATION FUNCTIONS
-- =====================================================

-- Get entries eligible for consolidation (older than 90 days, not compressed, not critical)
CREATE OR REPLACE FUNCTION get_entries_for_consolidation(
    p_user_id UUID,
    p_before_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '90 days',
    p_batch_size INT DEFAULT 1000
)
RETURNS TABLE (
    id UUID,
    session_id UUID,
    content TEXT,
    content_type memory_entry_type,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        me.id,
        me.session_id,
        me.content,
        me.content_type,
        me.created_at
    FROM memory_entries me
    JOIN memory_sessions ms ON me.session_id = ms.id
    WHERE me.user_id = p_user_id
        AND me.created_at < p_before_date
        AND me.compressed = FALSE
        AND me.importance != 'critical'
        AND ms.consolidated = FALSE
    ORDER BY me.created_at ASC
    LIMIT p_batch_size;
END;
$$ LANGUAGE plpgsql;

-- Mark session as consolidated
CREATE OR REPLACE FUNCTION mark_session_consolidated(
    p_session_id UUID,
    p_summary_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE memory_sessions
    SET 
        consolidated = TRUE,
        summary_id = p_summary_id,
        status = 'archived',
        updated_at = NOW()
    WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PRUNING FUNCTIONS
-- =====================================================

-- Soft delete old non-critical entries (mark as compressed with minimal content)
CREATE OR REPLACE FUNCTION prune_old_memories(
    p_user_id UUID,
    p_older_than_days INT DEFAULT 90
)
RETURNS TABLE (
    pruned_count INT,
    freed_tokens INT
) AS $$
DECLARE
    v_count INT;
    v_tokens INT;
BEGIN
    -- Get stats before deletion
    SELECT COUNT(*), COALESCE(SUM(token_count), 0)
    INTO v_count, v_tokens
    FROM memory_entries
    WHERE user_id = p_user_id
        AND created_at < NOW() - (p_older_than_days || ' days')::INTERVAL
        AND importance IN ('low', 'medium')
        AND compressed = FALSE;
    
    -- Mark as compressed (actual deletion is manual or by background job)
    UPDATE memory_entries
    SET 
        compressed = TRUE,
        content = '[Pruned: ' || LEFT(content, 100) || '...]',
        metadata = metadata || jsonb_build_object('pruned_at', NOW(), 'pruned_reason', 'age')
    WHERE user_id = p_user_id
        AND created_at < NOW() - (p_older_than_days || ' days')::INTERVAL
        AND importance IN ('low', 'medium')
        AND compressed = FALSE;
    
    RETURN QUERY SELECT v_count, v_tokens;
END;
$$ LANGUAGE plpgsql;

-- Hard delete pruned entries (use with caution)
CREATE OR REPLACE FUNCTION hard_delete_pruned_memories(
    p_user_id UUID,
    p_older_than_days INT DEFAULT 180
)
RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    DELETE FROM memory_entries
    WHERE user_id = p_user_id
        AND compressed = TRUE
        AND created_at < NOW() - (p_older_than_days || ' days')::INTERVAL
        AND importance != 'critical';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS FOR CONVENIENCE
-- =====================================================

-- Active sessions view
CREATE VIEW active_memory_sessions AS
SELECT * FROM memory_sessions
WHERE status = 'active'
ORDER BY last_accessed_at DESC;

-- Recent entries view
CREATE VIEW recent_memory_entries AS
SELECT 
    me.*,
    ms.title as session_title
FROM memory_entries me
JOIN memory_sessions ms ON me.session_id = ms.id
WHERE me.created_at > NOW() - INTERVAL '24 hours'
ORDER BY me.created_at DESC;

-- Memory statistics view
CREATE VIEW memory_statistics AS
SELECT 
    user_id,
    COUNT(*) as total_entries,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as entries_24h,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as entries_7d,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as entries_30d,
    COUNT(*) FILTER (WHERE compressed = TRUE) as compressed_entries,
    COALESCE(SUM(token_count), 0) as total_tokens,
    COUNT(DISTINCT session_id) as total_sessions
FROM memory_entries
GROUP BY user_id;

-- Sessions needing consolidation view
CREATE VIEW sessions_needing_consolidation AS
SELECT 
    ms.*,
    COUNT(me.id) as entry_count,
    MIN(me.created_at) as oldest_entry
FROM memory_sessions ms
LEFT JOIN memory_entries me ON ms.id = me.session_id
WHERE ms.consolidated = FALSE
    AND ms.status = 'completed'
    AND ms.ended_at < NOW() - INTERVAL '7 days'
GROUP BY ms.id
HAVING COUNT(me.id) > 0;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE memory_sessions IS 'Session containers for related memory entries';
COMMENT ON TABLE memory_entries IS 'Individual memory items with vector embeddings for semantic search';
COMMENT ON TABLE memory_summaries IS 'Consolidated/summarized memories from multiple sessions';
COMMENT ON TABLE memory_access_log IS 'Audit log for memory access patterns';

COMMENT ON COLUMN memory_entries.embedding IS '384-dimensional vector for semantic similarity search';
COMMENT ON COLUMN memory_entries.importance IS 'Low importance entries are pruned first during cleanup';
COMMENT ON COLUMN memory_sessions.context_window IS 'Active working memory for the current session';
COMMENT ON COLUMN memory_entries.compressed IS 'Indicates if entry has been summarized/compressed';
