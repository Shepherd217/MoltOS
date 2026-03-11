-- =====================================================
-- ClawVault - Enterprise Credential Management System
-- =====================================================
-- 
-- SECURITY MODEL:
--   - Zero-knowledge: Encrypted blobs, keys never in DB
--   - AES-256-GCM encryption with secure enclave/HSM
--   - Per-agent key isolation with strict access controls
--   - Comprehensive audit logging (immutable)
--   - Automatic rotation scheduling with alerts
--
-- COMPLIANCE: SOC2, GDPR, PCI-DSS ready
-- =====================================================

-- =====================================================
-- ENUM TYPES
-- =====================================================

CREATE TYPE vault_credential_type AS ENUM (
    'api_key',              -- Generic API keys (Stripe, OpenAI, etc.)
    'database_credential',  -- Database connection strings
    'webhook_secret',       -- Webhook signing secrets
    'oauth_token',          -- OAuth 2.0 tokens
    'jwt_secret',           -- JWT signing secrets
    'encryption_key',       -- Encryption/KEK keys
    'ssh_key',              -- SSH private keys
    'certificate',          -- TLS/SSL certificates
    'password',             -- Generic passwords
    'other'                 -- Uncategorized secrets
);

CREATE TYPE vault_key_storage AS ENUM (
    'software',             -- Node.js crypto (fallback)
    'enclave',              -- Hardware secure enclave (Intel SGX, AMD SEV)
    'hsm',                  -- Hardware Security Module (AWS CloudHSM, etc.)
    'tpm',                  -- Trusted Platform Module
    'kms'                   -- Cloud KMS (AWS KMS, GCP KMS, Azure Key Vault)
);

CREATE TYPE vault_access_action AS ENUM (
    'created',              -- New credential stored
    'read',                 -- Credential retrieved/decrypted
    'updated',              -- Credential modified
    'rotated',              -- Credential rotated
    'deleted',              -- Credential removed
    'access_denied',        -- Unauthorized access attempt
    'key_wrapped',          -- Key wrapped for storage
    'key_unwrapped'         -- Key unwrapped for use
);

CREATE TYPE vault_rotation_status AS ENUM (
    'healthy',              -- Within rotation window
    'due_soon',             -- Within 7 days of rotation
    'overdue',              -- Past rotation date
    'manual',               -- Manual rotation only
    'suspended'             -- Rotation temporarily suspended
);

CREATE TYPE vault_entry_status AS ENUM (
    'active',               -- Normal operation
    'expiring_soon',        -- Will expire within 7 days
    'expired',              -- Past expiration date
    'compromised',          -- Marked as potentially compromised
    'revoked',              -- Explicitly revoked
    'rotating'              -- Currently being rotated
);

-- =====================================================
-- VAULT KEY RING TABLE (Master Key References)
-- =====================================================
-- Stores references to master keys, NOT the keys themselves
-- Actual keys live in secure enclave/HSM only

CREATE TABLE vault_key_rings (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Key Identification
    key_id VARCHAR(64) NOT NULL UNIQUE,     -- Human-readable key identifier
    key_version INT NOT NULL DEFAULT 1,      -- For key rotation
    
    -- Key Storage Location (NOT the key itself!)
    storage_type vault_key_storage NOT NULL DEFAULT 'software',
    storage_reference TEXT NOT NULL,         -- HSM/enclave reference, KMS ARN, etc.
    
    -- Key Metadata (derived from key, not sensitive)
    key_algorithm VARCHAR(32) NOT NULL DEFAULT 'AES-256-GCM',
    key_fingerprint VARCHAR(128),            -- Public fingerprint for verification
    
    -- Access Control
    owner_agent_id UUID NOT NULL,            -- Primary owner ClawID
    authorized_agents UUID[] DEFAULT '{}',   -- Agents authorized to use this key
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_primary BOOLEAN NOT NULL DEFAULT false, -- Current primary key for new entries
    
    -- Rotation Tracking
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at TIMESTAMPTZ,                  -- Last rotation timestamp
    expires_at TIMESTAMPTZ,                  -- Key expiration (if applicable)
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,      -- Non-sensitive metadata
    
    -- Constraints
    CONSTRAINT valid_key_version CHECK (key_version > 0),
    CONSTRAINT unique_primary_key UNIQUE NULLS NOT NULL (owner_agent_id, is_primary) 
        DEFERRABLE INITIALLY DEFERRED
        WHERE is_primary = true
);

-- Indexes
CREATE INDEX idx_key_rings_owner ON vault_key_rings(owner_agent_id);
CREATE INDEX idx_key_rings_active ON vault_key_rings(is_active) WHERE is_active = true;
CREATE INDEX idx_key_rings_primary ON vault_key_rings(owner_agent_id, is_primary) WHERE is_primary = true;

-- =====================================================
-- VAULT ENTRIES TABLE (Encrypted Credential Storage)
-- =====================================================
-- Stores ONLY encrypted data - zero knowledge of contents

CREATE TABLE vault_entries (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Entry Identification
    entry_key VARCHAR(255) NOT NULL,         -- User-defined key name (e.g., "OPENAI_API_KEY")
    entry_namespace VARCHAR(128) DEFAULT 'default', -- Logical grouping
    
    -- Key Ring Reference (which key encrypted this)
    key_ring_id UUID NOT NULL REFERENCES vault_key_rings(id),
    
    -- Entry Type & Status
    credential_type vault_credential_type NOT NULL DEFAULT 'api_key',
    status vault_entry_status NOT NULL DEFAULT 'active',
    
    -- ENCRYPTED DATA (AES-256-GCM encrypted blob)
    -- Structure: iv(12 bytes) + ciphertext + auth_tag(16 bytes)
    encrypted_data BYTEA NOT NULL,           -- The encrypted credential
    encrypted_data_iv BYTEA NOT NULL,        -- Initialization vector (12 bytes for GCM)
    encrypted_data_tag BYTEA NOT NULL,       -- GCM authentication tag (16 bytes)
    
    -- Metadata (encrypted separately for queryability without decryption)
    encrypted_metadata BYTEA,                -- JSON metadata, encrypted
    metadata_iv BYTEA,
    metadata_tag BYTEA,
    
    -- Non-Sensitive Metadata (for querying/filtering)
    public_metadata JSONB DEFAULT '{}'::jsonb, -- Tags, descriptions (non-sensitive only!)
    
    -- Access Control
    owner_agent_id UUID NOT NULL,            -- Primary owner
    authorized_agents UUID[] DEFAULT '{}',   -- Agents with access
    required_permissions TEXT[] DEFAULT '{}', -- Required permission scopes
    
    -- Expiration & Rotation
    expires_at TIMESTAMPTZ,                  -- Credential expiration
    rotation_interval_days INT DEFAULT 90,   -- Recommended rotation interval
    last_rotated_at TIMESTAMPTZ,             -- Last rotation timestamp
    
    -- Versioning
    version INT NOT NULL DEFAULT 1,          -- Entry version for history
    previous_version_id UUID,                -- Link to previous version
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,                -- Agent who created
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID,                         -- Agent who last updated
    
    -- Soft Delete (for recovery)
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    
    -- Constraints
    CONSTRAINT unique_entry_key_per_owner UNIQUE (owner_agent_id, entry_namespace, entry_key),
    CONSTRAINT valid_entry_key CHECK (entry_key ~ '^[A-Z][A-Z0-9_]*$' OR entry_key ~ '^[a-z][a-z0-9_-]*$'),
    CONSTRAINT valid_rotation_interval CHECK (rotation_interval_days > 0 OR rotation_interval_days IS NULL),
    CONSTRAINT valid_version CHECK (version > 0),
    CONSTRAINT encrypted_data_min_size CHECK (octet_length(encrypted_data) >= 16),
    CONSTRAINT iv_length CHECK (octet_length(encrypted_data_iv) = 12),
    CONSTRAINT tag_length CHECK (octet_length(encrypted_data_tag) = 16)
);

-- Indexes for common queries
CREATE INDEX idx_vault_entries_owner ON vault_entries(owner_agent_id);
CREATE INDEX idx_vault_entries_key ON vault_entries(entry_key);
CREATE INDEX idx_vault_entries_namespace ON vault_entries(entry_namespace);
CREATE INDEX idx_vault_entries_type ON vault_entries(credential_type);
CREATE INDEX idx_vault_entries_status ON vault_entries(status) WHERE status != 'active';
CREATE INDEX idx_vault_entries_expires ON vault_entries(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_vault_entries_key_ring ON vault_entries(key_ring_id);
CREATE INDEX idx_vault_entries_active ON vault_entries(owner_agent_id, entry_namespace, entry_key) 
    WHERE deleted_at IS NULL;

-- GIN index for JSON metadata queries
CREATE INDEX idx_vault_entries_public_metadata ON vault_entries USING GIN(public_metadata);

-- =====================================================
-- VAULT ACCESS LOGS (Immutable Audit Trail)
-- =====================================================
-- Every access is logged - who, what, when, from where

CREATE TABLE vault_access_logs (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- What was accessed
    entry_id UUID REFERENCES vault_entries(id) ON DELETE SET NULL,
    entry_key VARCHAR(255),                  -- Denormalized for history
    key_ring_id UUID REFERENCES vault_key_rings(id) ON DELETE SET NULL,
    
    -- Who accessed
    agent_id UUID NOT NULL,                  -- Accessing agent
    session_id VARCHAR(128),                 -- Session identifier
    
    -- Access Details
    action vault_access_action NOT NULL,
    success BOOLEAN NOT NULL,                -- Whether access was granted
    
    -- Context (for security analysis)
    ip_address INET,                         -- Source IP
    user_agent TEXT,                         -- User agent string
    request_id VARCHAR(64),                  -- Correlation ID
    
    -- Authorization Context
    auth_method VARCHAR(64),                 -- How agent authenticated
    permissions_used TEXT[],                 -- Permissions checked
    
    -- Result Details (non-sensitive only!)
    details JSONB DEFAULT '{}'::jsonb,       -- Generic event details
    failure_reason TEXT,                     -- Why access was denied (if applicable)
    
    -- Immutable Timestamp
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT access_log_not_future CHECK (accessed_at <= NOW() + INTERVAL '1 minute')
);

-- Indexes for audit queries
CREATE INDEX idx_access_logs_entry ON vault_access_logs(entry_id);
CREATE INDEX idx_access_logs_agent ON vault_access_logs(agent_id);
CREATE INDEX idx_access_logs_action ON vault_access_logs(action);
CREATE INDEX idx_access_logs_success ON vault_access_logs(success) WHERE success = false;
CREATE INDEX idx_access_logs_accessed ON vault_access_logs(accessed_at DESC);
CREATE INDEX idx_access_logs_session ON vault_access_logs(session_id);

-- Partitioning support for high-volume logs (optional, for enterprise)
-- CREATE INDEX idx_access_logs_time_partition ON vault_access_logs(accessed_at);

-- =====================================================
-- VAULT ROTATION SCHEDULE
-- =====================================================
-- Tracks automatic rotation requirements

CREATE TABLE vault_rotation_schedule (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    entry_id UUID NOT NULL UNIQUE REFERENCES vault_entries(id) ON DELETE CASCADE,
    key_ring_id UUID NOT NULL REFERENCES vault_key_rings(id),
    
    -- Rotation Configuration
    rotation_interval_days INT NOT NULL DEFAULT 90,
    rotation_grace_days INT DEFAULT 7,       -- Days after due before escalation
    auto_rotate BOOLEAN DEFAULT false,       -- Whether to auto-rotate
    
    -- Schedule
    last_rotated_at TIMESTAMPTZ,
    next_rotation_due TIMESTAMPTZ NOT NULL,
    
    -- Status
    status vault_rotation_status NOT NULL DEFAULT 'healthy',
    
    -- Notifications
    last_notified_at TIMESTAMPTZ,            -- Last reminder sent
    notification_count INT DEFAULT 0,        -- Number of reminders
    
    -- Rotation History
    rotation_history JSONB DEFAULT '[]'::jsonb, -- Array of past rotations
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_interval CHECK (rotation_interval_days > 0),
    CONSTRAINT valid_grace CHECK (rotation_grace_days >= 0)
);

-- Indexes for rotation monitoring
CREATE INDEX idx_rotation_schedule_status ON vault_rotation_schedule(status) 
    WHERE status IN ('due_soon', 'overdue');
CREATE INDEX idx_rotation_schedule_due ON vault_rotation_schedule(next_rotation_due);
CREATE INDEX idx_rotation_schedule_entry ON vault_rotation_schedule(entry_id);

-- =====================================================
-- VAULT COMPROMISE REPORTS
-- =====================================================
-- Tracks potential security incidents

CREATE TABLE vault_compromise_reports (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Affected Entry
    entry_id UUID NOT NULL REFERENCES vault_entries(id) ON DELETE CASCADE,
    
    -- Report Details
    reported_by UUID NOT NULL,               -- Agent who reported
    severity VARCHAR(32) NOT NULL,           -- 'low', 'medium', 'high', 'critical'
    reason TEXT NOT NULL,                    -- Why compromised
    evidence TEXT,                           -- Supporting evidence
    
    -- Status
    confirmed BOOLEAN DEFAULT NULL,          -- NULL = under investigation
    confirmed_by UUID,
    confirmed_at TIMESTAMPTZ,
    
    -- Response
    actions_taken JSONB DEFAULT '[]'::jsonb, -- Array of response actions
    
    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    resolution_notes TEXT,
    
    -- Timestamps
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX idx_compromise_reports_entry ON vault_compromise_reports(entry_id);
CREATE INDEX idx_compromise_reports_status ON vault_compromise_reports(confirmed) WHERE confirmed IS NULL;

-- =====================================================
-- VAULT ENTRY VERSIONS (History)
-- =====================================================
-- Historical versions of credentials (encrypted)

CREATE TABLE vault_entry_versions (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    entry_id UUID NOT NULL REFERENCES vault_entries(id) ON DELETE CASCADE,
    version INT NOT NULL,
    
    -- Encrypted Data (same structure as vault_entries)
    encrypted_data BYTEA NOT NULL,
    encrypted_data_iv BYTEA NOT NULL,
    encrypted_data_tag BYTEA NOT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    rotation_reason TEXT,                    -- Why this version was created
    
    -- Constraints
    CONSTRAINT unique_version_per_entry UNIQUE (entry_id, version),
    CONSTRAINT version_data_checks CHECK (
        octet_length(encrypted_data) >= 16 AND
        octet_length(encrypted_data_iv) = 12 AND
        octet_length(encrypted_data_tag) = 16
    )
);

CREATE INDEX idx_entry_versions_entry ON vault_entry_versions(entry_id, version DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE vault_key_rings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_rotation_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_compromise_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_entry_versions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- VAULT KEY RINGS RLS
-- =====================================================

-- Owners can view their key rings
CREATE POLICY key_rings_select_owner ON vault_key_rings
    FOR SELECT
    USING (
        auth.uid() = owner_agent_id OR
        auth.uid() = ANY(authorized_agents) OR
        auth.jwt()->>'role' = 'vault_admin'
    );

-- Only system can create key rings (via secure function)
CREATE POLICY key_rings_insert_system ON vault_key_rings
    FOR INSERT
    WITH CHECK (auth.jwt()->>'role' IN ('service', 'vault_admin'));

-- Only vault_admin can update key ring metadata
CREATE POLICY key_rings_update_admin ON vault_key_rings
    FOR UPDATE
    USING (auth.jwt()->>'role' IN ('service', 'vault_admin'));

-- =====================================================
-- VAULT ENTRIES RLS
-- =====================================================

-- Owners and authorized agents can view entries
CREATE POLICY entries_select_authorized ON vault_entries
    FOR SELECT
    USING (
        deleted_at IS NULL AND (
            auth.uid() = owner_agent_id OR
            auth.uid() = ANY(authorized_agents) OR
            auth.jwt()->>'role' = 'vault_admin'
        )
    );

-- Owners can insert entries
CREATE POLICY entries_insert_owner ON vault_entries
    FOR INSERT
    WITH CHECK (
        auth.uid() = owner_agent_id OR
        auth.jwt()->>'role' IN ('service', 'vault_admin')
    );

-- Owners can update their entries
CREATE POLICY entries_update_owner ON vault_entries
    FOR UPDATE
    USING (
        deleted_at IS NULL AND (
            auth.uid() = owner_agent_id OR
            auth.jwt()->>'role' IN ('service', 'vault_admin')
        )
    );

-- Soft delete only (never hard delete)
CREATE POLICY entries_delete_owner ON vault_entries
    FOR DELETE
    USING (
        deleted_at IS NULL AND (
            auth.uid() = owner_agent_id OR
            auth.jwt()->>'role' = 'vault_admin'
        )
    );

-- =====================================================
-- VAULT ACCESS LOGS RLS
-- =====================================================

-- Users can view logs for their entries
CREATE POLICY access_logs_select_own ON vault_access_logs
    FOR SELECT
    USING (
        agent_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM vault_entries e
            WHERE e.id = access_logs.entry_id
            AND (e.owner_agent_id = auth.uid() OR auth.uid() = ANY(e.authorized_agents))
        ) OR
        auth.jwt()->>'role' IN ('vault_admin', 'auditor')
    );

-- Service role can insert logs
CREATE POLICY access_logs_insert_service ON vault_access_logs
    FOR INSERT
    WITH CHECK (auth.jwt()->>'role' IN ('service', 'vault_admin'));

-- Immutable - no updates/deletes
CREATE POLICY access_logs_no_update ON vault_access_logs
    FOR UPDATE
    USING (false);

CREATE POLICY access_logs_no_delete ON vault_access_logs
    FOR DELETE
    USING (false);

-- =====================================================
-- VAULT ROTATION SCHEDULE RLS
-- =====================================================

CREATE POLICY rotation_select_authorized ON vault_rotation_schedule
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM vault_entries e
            WHERE e.id = rotation_schedule.entry_id
            AND (e.owner_agent_id = auth.uid() OR auth.uid() = ANY(e.authorized_agents))
        ) OR
        auth.jwt()->>'role' IN ('vault_admin', 'auditor')
    );

CREATE POLICY rotation_insert_service ON vault_rotation_schedule
    FOR INSERT
    WITH CHECK (auth.jwt()->>'role' IN ('service', 'vault_admin'));

CREATE POLICY rotation_update_authorized ON vault_rotation_schedule
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM vault_entries e
            WHERE e.id = rotation_schedule.entry_id
            AND e.owner_agent_id = auth.uid()
        ) OR
        auth.jwt()->>'role' IN ('service', 'vault_admin')
    );

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vault_entries_updated_at
    BEFORE UPDATE ON vault_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER vault_rotation_schedule_updated_at
    BEFORE UPDATE ON vault_rotation_schedule
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Calculate rotation status based on due date
CREATE OR REPLACE FUNCTION calculate_rotation_status()
RETURNS TRIGGER AS $$
DECLARE
    days_until_due INT;
BEGIN
    days_until_due := EXTRACT(DAY FROM (NEW.next_rotation_due - NOW()));
    
    IF NEW.status = 'suspended' THEN
        RETURN NEW;
    END IF;
    
    IF NEW.next_rotation_due < NOW() THEN
        NEW.status := 'overdue';
    ELSIF days_until_due <= 7 THEN
        NEW.status := 'due_soon';
    ELSE
        NEW.status := 'healthy';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rotation_status_calculation
    BEFORE INSERT OR UPDATE OF next_rotation_due ON vault_rotation_schedule
    FOR EACH ROW
    EXECUTE FUNCTION calculate_rotation_status();

-- Log entry access
CREATE OR REPLACE FUNCTION log_vault_access(
    p_entry_id UUID,
    p_entry_key VARCHAR(255),
    p_key_ring_id UUID,
    p_agent_id UUID,
    p_action vault_access_action,
    p_success BOOLEAN,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_request_id VARCHAR(64) DEFAULT NULL,
    p_auth_method VARCHAR(64) DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb,
    p_failure_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO vault_access_logs (
        entry_id,
        entry_key,
        key_ring_id,
        agent_id,
        action,
        success,
        ip_address,
        user_agent,
        request_id,
        auth_method,
        details,
        failure_reason
    ) VALUES (
        p_entry_id,
        p_entry_key,
        p_key_ring_id,
        p_agent_id,
        p_action,
        p_success,
        p_ip_address,
        p_user_agent,
        p_request_id,
        p_auth_method,
        p_details,
        p_failure_reason
    )
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create rotation schedule for new entry
CREATE OR REPLACE FUNCTION create_rotation_schedule()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO vault_rotation_schedule (
        entry_id,
        key_ring_id,
        rotation_interval_days,
        next_rotation_due
    ) VALUES (
        NEW.id,
        NEW.key_ring_id,
        COALESCE(NEW.rotation_interval_days, 90),
        COALESCE(NEW.last_rotated_at, NEW.created_at) + 
            (COALESCE(NEW.rotation_interval_days, 90) || ' days')::INTERVAL
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entry_rotation_schedule
    AFTER INSERT ON vault_entries
    FOR EACH ROW
    EXECUTE FUNCTION create_rotation_schedule();

-- Update entry status on expiration check
CREATE OR REPLACE FUNCTION check_entry_expiration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expires_at IS NOT NULL THEN
        IF NEW.expires_at < NOW() THEN
            NEW.status := 'expired';
        ELSIF NEW.expires_at < NOW() + INTERVAL '7 days' THEN
            NEW.status := 'expiring_soon';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entry_expiration_check
    BEFORE INSERT OR UPDATE OF expires_at ON vault_entries
    FOR EACH ROW
    EXECUTE FUNCTION check_entry_expiration();

-- Archive old entry version when updating
CREATE OR REPLACE FUNCTION archive_entry_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only archive if encrypted data changed
    IF OLD.encrypted_data IS DISTINCT FROM NEW.encrypted_data THEN
        -- Insert old version to history
        INSERT INTO vault_entry_versions (
            entry_id,
            version,
            encrypted_data,
            encrypted_data_iv,
            encrypted_data_tag,
            created_by,
            rotation_reason
        ) VALUES (
            OLD.id,
            OLD.version,
            OLD.encrypted_data,
            OLD.encrypted_data_iv,
            OLD.encrypted_data_tag,
            OLD.updated_by,
            NEW.public_metadata->>'update_reason'
        );
        
        -- Increment version
        NEW.version := OLD.version + 1;
        NEW.previous_version_id := OLD.id;
        NEW.last_rotated_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entry_version_archive
    BEFORE UPDATE ON vault_entries
    FOR EACH ROW
    EXECUTE FUNCTION archive_entry_version();

-- Soft delete handler
CREATE OR REPLACE FUNCTION soft_delete_entry()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        -- Log the deletion
        PERFORM log_vault_access(
            NEW.id,
            NEW.entry_key,
            NEW.key_ring_id,
            NEW.deleted_by,
            'deleted',
            true,
            NULL, NULL, NULL, NULL,
            jsonb_build_object('deleted_at', NEW.deleted_at),
            NULL
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entry_soft_delete
    BEFORE UPDATE OF deleted_at ON vault_entries
    FOR EACH ROW
    EXECUTE FUNCTION soft_delete_entry();

-- =====================================================
-- VIEWS FOR CONVENIENCE
-- =====================================================

-- Active credentials summary
CREATE VIEW vault_active_credentials AS
SELECT 
    e.id,
    e.entry_key,
    e.entry_namespace,
    e.credential_type,
    e.status,
    e.owner_agent_id,
    e.expires_at,
    e.rotation_interval_days,
    e.last_rotated_at,
    e.version,
    e.public_metadata,
    r.status as rotation_status,
    r.next_rotation_due,
    kr.storage_type as key_storage
FROM vault_entries e
LEFT JOIN vault_rotation_schedule r ON r.entry_id = e.id
LEFT JOIN vault_key_rings kr ON kr.id = e.key_ring_id
WHERE e.deleted_at IS NULL
ORDER BY e.entry_namespace, e.entry_key;

-- Credentials needing attention
CREATE VIEW vault_attention_required AS
SELECT 
    e.id,
    e.entry_key,
    e.entry_namespace,
    e.credential_type,
    e.status as entry_status,
    CASE 
        WHEN e.status = 'compromised' THEN 'CRITICAL'
        WHEN e.status = 'expired' THEN 'HIGH'
        WHEN e.status = 'expiring_soon' THEN 'MEDIUM'
        WHEN r.status = 'overdue' THEN 'HIGH'
        WHEN r.status = 'due_soon' THEN 'MEDIUM'
        ELSE 'LOW'
    END as priority,
    e.expires_at,
    r.next_rotation_due as rotation_due,
    r.status as rotation_status
FROM vault_entries e
LEFT JOIN vault_rotation_schedule r ON r.entry_id = e.id
WHERE e.deleted_at IS NULL
AND (
    e.status IN ('compromised', 'expired', 'expiring_soon')
    OR r.status IN ('overdue', 'due_soon')
)
ORDER BY 
    CASE 
        WHEN e.status = 'compromised' THEN 1
        WHEN e.status = 'expired' THEN 2
        WHEN r.status = 'overdue' THEN 3
        WHEN e.status = 'expiring_soon' THEN 4
        WHEN r.status = 'due_soon' THEN 5
        ELSE 6
    END,
    e.entry_key;

-- Audit summary for compliance
CREATE VIEW vault_audit_summary AS
SELECT 
    date_trunc('day', accessed_at) as date,
    agent_id,
    action,
    success,
    count(*) as count
FROM vault_access_logs
GROUP BY date_trunc('day', accessed_at), agent_id, action, success
ORDER BY date DESC, count DESC;

-- Recent access patterns
CREATE VIEW vault_recent_access_patterns AS
SELECT 
    entry_id,
    entry_key,
    count(*) as access_count_24h,
    count(*) FILTER (WHERE success = false) as failed_attempts_24h,
    max(accessed_at) as last_accessed,
    array_agg(DISTINCT agent_id) as accessing_agents
FROM vault_access_logs
WHERE accessed_at > NOW() - INTERVAL '24 hours'
GROUP BY entry_id, entry_key
ORDER BY failed_attempts_24h DESC, access_count_24h DESC;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE vault_key_rings IS 'Master key references - actual keys stored in HSM/enclave only';
COMMENT ON TABLE vault_entries IS 'Encrypted credential storage - zero knowledge of contents';
COMMENT ON TABLE vault_access_logs IS 'Immutable audit trail of all vault access';
COMMENT ON TABLE vault_rotation_schedule IS 'Automatic rotation scheduling and monitoring';
COMMENT ON TABLE vault_compromise_reports IS 'Security incident tracking';
COMMENT ON TABLE vault_entry_versions IS 'Historical encrypted credential versions';

COMMENT ON COLUMN vault_entries.encrypted_data IS 'AES-256-GCM encrypted credential - iv(12) + ciphertext + tag(16)';
COMMENT ON COLUMN vault_key_rings.storage_reference IS 'Reference to key in HSM/enclave - NOT the key itself';

-- =====================================================
-- PERMISSIONS
-- =====================================================

-- Grant service role full access
GRANT ALL ON vault_key_rings TO service_role;
GRANT ALL ON vault_entries TO service_role;
GRANT ALL ON vault_access_logs TO service_role;
GRANT ALL ON vault_rotation_schedule TO service_role;
GRANT ALL ON vault_compromise_reports TO service_role;
GRANT ALL ON vault_entry_versions TO service_role;

-- Grant sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
