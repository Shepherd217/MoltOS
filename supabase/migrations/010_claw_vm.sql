-- Migration: 010_claw_vm.sql
-- Description: ClawVM database schema for VM instances, snapshots, metrics, and resource quotas
-- Created: 2026-03-12

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE vm_state AS ENUM (
    'pending',
    'running',
    'paused',
    'stopped',
    'error'
);

CREATE TYPE vm_tier AS ENUM (
    'novice',
    'standard',
    'verified',
    'expert',
    'sovereign'
);

-- ============================================
-- TABLE: claw_resource_quotas (Create first for FK reference)
-- ============================================

CREATE TABLE claw_resource_quotas (
    tier vm_tier PRIMARY KEY,
    min_reputation_score INTEGER NOT NULL DEFAULT 0,
    max_memory_mb INTEGER NOT NULL,
    max_vcpu INTEGER NOT NULL,
    max_disk_gb INTEGER NOT NULL,
    max_vms_per_agent INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_min_reputation_score CHECK (min_reputation_score >= 0),
    CONSTRAINT chk_max_memory_mb CHECK (max_memory_mb > 0),
    CONSTRAINT chk_max_vcpu CHECK (max_vcpu > 0),
    CONSTRAINT chk_max_disk_gb CHECK (max_disk_gb > 0),
    CONSTRAINT chk_max_vms_per_agent CHECK (max_vms_per_agent > 0)
);

COMMENT ON TABLE claw_resource_quotas IS 'Defines resource limits and requirements for each VM tier';
COMMENT ON COLUMN claw_resource_quotas.tier IS 'The tier name (novice, standard, verified, expert, sovereign)';
COMMENT ON COLUMN claw_resource_quotas.min_reputation_score IS 'Minimum reputation score required for this tier';
COMMENT ON COLUMN claw_resource_quotas.max_memory_mb IS 'Maximum memory allocation in MB for this tier';
COMMENT ON COLUMN claw_resource_quotas.max_vcpu IS 'Maximum vCPU count for this tier';
COMMENT ON COLUMN claw_resource_quotas.max_disk_gb IS 'Maximum disk size in GB for this tier';
COMMENT ON COLUMN claw_resource_quotas.max_vms_per_agent IS 'Maximum number of VMs per agent for this tier';

-- Insert default tier configurations
INSERT INTO claw_resource_quotas (tier, min_reputation_score, max_memory_mb, max_vcpu, max_disk_gb, max_vms_per_agent) VALUES
    ('novice', 0, 512, 1, 5, 1),
    ('standard', 100, 2048, 2, 20, 3),
    ('verified', 500, 4096, 4, 50, 5),
    ('expert', 2000, 8192, 8, 100, 10),
    ('sovereign', 10000, 16384, 16, 500, 25);

-- ============================================
-- TABLE: claw_vms
-- ============================================

CREATE TABLE claw_vms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Process/Runtime info
    socket_path TEXT,
    pid INTEGER,
    
    -- Resource allocation
    memory_mb INTEGER NOT NULL,
    vcpu_count INTEGER NOT NULL,
    disk_gb INTEGER NOT NULL,
    
    -- State and tier
    state vm_state NOT NULL DEFAULT 'pending',
    tier vm_tier NOT NULL DEFAULT 'novice',
    
    -- File paths
    kernel_image TEXT NOT NULL,
    rootfs_path TEXT NOT NULL,
    
    -- Networking
    vsock_cid INTEGER,
    network_tap TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_memory_mb CHECK (memory_mb > 0),
    CONSTRAINT chk_vcpu_count CHECK (vcpu_count > 0),
    CONSTRAINT chk_disk_gb CHECK (disk_gb > 0),
    CONSTRAINT chk_pid CHECK (pid IS NULL OR pid > 0),
    CONSTRAINT chk_vsock_cid CHECK (vsock_cid IS NULL OR vsock_cid > 0),
    CONSTRAINT chk_started_at CHECK (started_at IS NULL OR started_at >= created_at),
    CONSTRAINT chk_stopped_at CHECK (stopped_at IS NULL OR (started_at IS NOT NULL AND stopped_at >= started_at))
);

COMMENT ON TABLE claw_vms IS 'VM instances managed by ClawVM';
COMMENT ON COLUMN claw_vms.agent_id IS 'Reference to the owning agent';
COMMENT ON COLUMN claw_vms.socket_path IS 'Path to the VM control socket';
COMMENT ON COLUMN claw_vms.pid IS 'Process ID of the running VM';
COMMENT ON COLUMN claw_vms.memory_mb IS 'Allocated memory in MB';
COMMENT ON COLUMN claw_vms.vcpu_count IS 'Number of virtual CPUs';
COMMENT ON COLUMN claw_vms.disk_gb IS 'Disk size in GB';
COMMENT ON COLUMN claw_vms.state IS 'Current VM state';
COMMENT ON COLUMN claw_vms.tier IS 'Resource tier for this VM';
COMMENT ON COLUMN claw_vms.kernel_image IS 'Path to kernel image';
COMMENT ON COLUMN claw_vms.rootfs_path IS 'Path to root filesystem';
COMMENT ON COLUMN claw_vms.vsock_cid IS 'VSOCK context ID for guest communication';
COMMENT ON COLUMN claw_vms.network_tap IS 'Network TAP device name';
COMMENT ON COLUMN claw_vms.started_at IS 'When the VM was started';
COMMENT ON COLUMN claw_vms.stopped_at IS 'When the VM was stopped';

-- ============================================
-- TABLE: claw_vm_snapshots
-- ============================================

CREATE TABLE claw_vm_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vm_id UUID NOT NULL REFERENCES claw_vms(id) ON DELETE CASCADE,
    
    -- Snapshot files
    memory_snapshot_path TEXT NOT NULL,
    disk_snapshot_path TEXT NOT NULL,
    
    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT chk_expires_at CHECK (expires_at IS NULL OR expires_at > created_at)
);

COMMENT ON TABLE claw_vm_snapshots IS 'VM checkpoint snapshots';
COMMENT ON COLUMN claw_vm_snapshots.vm_id IS 'Reference to the parent VM';
COMMENT ON COLUMN claw_vm_snapshots.memory_snapshot_path IS 'Path to memory snapshot file';
COMMENT ON COLUMN claw_vm_snapshots.disk_snapshot_path IS 'Path to disk snapshot file';
COMMENT ON COLUMN claw_vm_snapshots.metadata IS 'JSON metadata about the snapshot';
COMMENT ON COLUMN claw_vm_snapshots.expires_at IS 'Optional expiration time for auto-cleanup';

-- ============================================
-- TABLE: claw_vm_metrics
-- ============================================

CREATE TABLE claw_vm_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vm_id UUID NOT NULL REFERENCES claw_vms(id) ON DELETE CASCADE,
    
    -- CPU metrics
    cpu_time_ms BIGINT NOT NULL DEFAULT 0,
    
    -- Memory metrics
    memory_usage_mb INTEGER NOT NULL DEFAULT 0,
    
    -- Disk I/O metrics
    disk_read_bytes BIGINT NOT NULL DEFAULT 0,
    disk_write_bytes BIGINT NOT NULL DEFAULT 0,
    
    -- Network metrics
    network_rx_bytes BIGINT NOT NULL DEFAULT 0,
    network_tx_bytes BIGINT NOT NULL DEFAULT 0,
    
    -- Timestamp
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_cpu_time_ms CHECK (cpu_time_ms >= 0),
    CONSTRAINT chk_memory_usage_mb CHECK (memory_usage_mb >= 0),
    CONSTRAINT chk_disk_read_bytes CHECK (disk_read_bytes >= 0),
    CONSTRAINT chk_disk_write_bytes CHECK (disk_write_bytes >= 0),
    CONSTRAINT chk_network_rx_bytes CHECK (network_rx_bytes >= 0),
    CONSTRAINT chk_network_tx_bytes CHECK (network_tx_bytes >= 0)
);

COMMENT ON TABLE claw_vm_metrics IS 'Historical resource usage metrics for VMs';
COMMENT ON COLUMN claw_vm_metrics.vm_id IS 'Reference to the VM';
COMMENT ON COLUMN claw_vm_metrics.cpu_time_ms IS 'CPU time consumed in milliseconds';
COMMENT ON COLUMN claw_vm_metrics.memory_usage_mb IS 'Memory usage in MB at sample time';
COMMENT ON COLUMN claw_vm_metrics.disk_read_bytes IS 'Total bytes read from disk';
COMMENT ON COLUMN claw_vm_metrics.disk_write_bytes IS 'Total bytes written to disk';
COMMENT ON COLUMN claw_vm_metrics.network_rx_bytes IS 'Total network bytes received';
COMMENT ON COLUMN claw_vm_metrics.network_tx_bytes IS 'Total network bytes transmitted';
COMMENT ON COLUMN claw_vm_metrics.timestamp IS 'When this metric sample was recorded';

-- ============================================
-- INDEXES
-- ============================================

-- claw_vms indexes
CREATE INDEX idx_claw_vms_agent_id ON claw_vms(agent_id);
CREATE INDEX idx_claw_vms_state ON claw_vms(state);
CREATE INDEX idx_claw_vms_tier ON claw_vms(tier);
CREATE INDEX idx_claw_vms_created_at ON claw_vms(created_at);
CREATE INDEX idx_claw_vms_agent_state ON claw_vms(agent_id, state);

-- claw_vm_snapshots indexes
CREATE INDEX idx_claw_vm_snapshots_vm_id ON claw_vm_snapshots(vm_id);
CREATE INDEX idx_claw_vm_snapshots_created_at ON claw_vm_snapshots(created_at);
CREATE INDEX idx_claw_vm_snapshots_expires_at ON claw_vm_snapshots(expires_at) WHERE expires_at IS NOT NULL;

-- claw_vm_metrics indexes
CREATE INDEX idx_claw_vm_metrics_vm_id ON claw_vm_metrics(vm_id);
CREATE INDEX idx_claw_vm_metrics_timestamp ON claw_vm_metrics(timestamp);
CREATE INDEX idx_claw_vm_metrics_vm_timestamp ON claw_vm_metrics(vm_id, timestamp);

-- Partial indexes for common queries
CREATE INDEX idx_claw_vms_running ON claw_vms(agent_id, state) WHERE state = 'running';
CREATE INDEX idx_claw_vm_metrics_recent ON claw_vm_metrics(vm_id, timestamp DESC);

-- ============================================
-- TRIGGERS (updated_at)
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to claw_vms
CREATE TRIGGER trg_claw_vms_updated_at
    BEFORE UPDATE ON claw_vms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to claw_resource_quotas
CREATE TRIGGER trg_claw_resource_quotas_updated_at
    BEFORE UPDATE ON claw_resource_quotas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update stopped_at when state changes to stopped
CREATE OR REPLACE FUNCTION update_stopped_at_column()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.state = 'stopped' AND OLD.state != 'stopped' THEN
        NEW.stopped_at = NOW();
    ELSIF NEW.state != 'stopped' AND OLD.state = 'stopped' THEN
        NEW.stopped_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_claw_vms_stopped_at
    BEFORE UPDATE ON claw_vms
    FOR EACH ROW
    EXECUTE FUNCTION update_stopped_at_column();

-- Trigger to update started_at when state changes to running
CREATE OR REPLACE FUNCTION update_started_at_column()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.state = 'running' AND (OLD.state = 'pending' OR OLD.started_at IS NULL) THEN
        NEW.started_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_claw_vms_started_at
    BEFORE UPDATE ON claw_vms
    FOR EACH ROW
    EXECUTE FUNCTION update_started_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE claw_vms ENABLE ROW LEVEL SECURITY;
ALTER TABLE claw_vm_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE claw_vm_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE claw_resource_quotas ENABLE ROW LEVEL SECURITY;

-- claw_vms policies
CREATE POLICY claw_vms_owner_all ON claw_vms
    FOR ALL
    TO authenticated
    USING (agent_id IN (
        SELECT id FROM agents WHERE owner_id = auth.uid()
    ))
    WITH CHECK (agent_id IN (
        SELECT id FROM agents WHERE owner_id = auth.uid()
    ));

CREATE POLICY claw_vms_agent_view ON claw_vms
    FOR SELECT
    TO authenticated
    USING (agent_id IN (
        SELECT id FROM agents WHERE id = agent_id
    ));

-- Allow service role full access
CREATE POLICY claw_vms_service_all ON claw_vms
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- claw_vm_snapshots policies (same as parent VM)
CREATE POLICY claw_vm_snapshots_owner_all ON claw_vm_snapshots
    FOR ALL
    TO authenticated
    USING (vm_id IN (
        SELECT id FROM claw_vms WHERE agent_id IN (
            SELECT id FROM agents WHERE owner_id = auth.uid()
        )
    ))
    WITH CHECK (vm_id IN (
        SELECT id FROM claw_vms WHERE agent_id IN (
            SELECT id FROM agents WHERE owner_id = auth.uid()
        )
    ));

CREATE POLICY claw_vm_snapshots_agent_view ON claw_vm_snapshots
    FOR SELECT
    TO authenticated
    USING (vm_id IN (
        SELECT id FROM claw_vms WHERE agent_id IN (
            SELECT id FROM agents WHERE id = agent_id
        )
    ));

CREATE POLICY claw_vm_snapshots_service_all ON claw_vm_snapshots
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- claw_vm_metrics policies (read-only for analysis)
CREATE POLICY claw_vm_metrics_owner_read ON claw_vm_metrics
    FOR SELECT
    TO authenticated
    USING (vm_id IN (
        SELECT id FROM claw_vms WHERE agent_id IN (
            SELECT id FROM agents WHERE owner_id = auth.uid()
        )
    ));

CREATE POLICY claw_vm_metrics_agent_read ON claw_vm_metrics
    FOR SELECT
    TO authenticated
    USING (vm_id IN (
        SELECT id FROM claw_vms WHERE agent_id IN (
            SELECT id FROM agents WHERE id = agent_id
        )
    ));

CREATE POLICY claw_vm_metrics_service_all ON claw_vm_metrics
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- claw_resource_quotas policies (read-only for users)
CREATE POLICY claw_resource_quotas_read ON claw_resource_quotas
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY claw_resource_quotas_service_all ON claw_resource_quotas
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function: get_vm_resource_usage
-- Returns aggregated resource usage metrics for a VM
CREATE OR REPLACE FUNCTION get_vm_resource_usage(p_vm_id UUID)
RETURNS TABLE (
    vm_id UUID,
    total_cpu_time_ms BIGINT,
    avg_memory_usage_mb NUMERIC,
    max_memory_usage_mb INTEGER,
    total_disk_read_bytes BIGINT,
    total_disk_write_bytes BIGINT,
    total_network_rx_bytes BIGINT,
    total_network_tx_bytes BIGINT,
    metric_count BIGINT,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.vm_id,
        SUM(m.cpu_time_ms) AS total_cpu_time_ms,
        AVG(m.memory_usage_mb)::NUMERIC AS avg_memory_usage_mb,
        MAX(m.memory_usage_mb) AS max_memory_usage_mb,
        SUM(m.disk_read_bytes) AS total_disk_read_bytes,
        SUM(m.disk_write_bytes) AS total_disk_write_bytes,
        SUM(m.network_rx_bytes) AS total_network_rx_bytes,
        SUM(m.network_tx_bytes) AS total_network_tx_bytes,
        COUNT(*) AS metric_count,
        MIN(m.timestamp) AS first_seen,
        MAX(m.timestamp) AS last_seen
    FROM claw_vm_metrics m
    WHERE m.vm_id = p_vm_id
    GROUP BY m.vm_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_vm_resource_usage(UUID) IS 'Returns aggregated resource usage metrics for a specific VM';

-- Function: enforce_resource_quota
-- Checks if an agent can create a VM of the specified tier
CREATE OR REPLACE FUNCTION enforce_resource_quota(p_agent_id UUID, p_tier vm_tier)
RETURNS TABLE (
    allowed BOOLEAN,
    reason TEXT,
    current_vm_count BIGINT,
    max_vms INTEGER,
    requested_memory INTEGER,
    available_memory BIGINT,
    requested_vcpu INTEGER,
    available_vcpu BIGINT,
    requested_disk INTEGER,
    available_disk BIGINT
) AS $$
DECLARE
    v_quota RECORD;
    v_current_vms BIGINT;
    v_agent_memory BIGINT;
    v_agent_vcpu BIGINT;
    v_agent_disk BIGINT;
    v_owner_id UUID;
BEGIN
    -- Get quota for the requested tier
    SELECT * INTO v_quota
    FROM claw_resource_quotas
    WHERE tier = p_tier AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            false::BOOLEAN,
            'Invalid or inactive tier'::TEXT,
            0::BIGINT, 0::INTEGER, 0::INTEGER, 0::BIGINT, 
            0::INTEGER, 0::BIGINT, 0::INTEGER, 0::BIGINT;
        RETURN;
    END IF;
    
    -- Get owner_id for the agent
    SELECT owner_id INTO v_owner_id
    FROM agents WHERE id = p_agent_id;
    
    IF v_owner_id IS NULL THEN
        RETURN QUERY SELECT 
            false::BOOLEAN,
            'Agent not found'::TEXT,
            0::BIGINT, 0::INTEGER, 0::INTEGER, 0::BIGINT, 
            0::INTEGER, 0::BIGINT, 0::INTEGER, 0::BIGINT;
        RETURN;
    END IF;
    
    -- Count current VMs for this agent
    SELECT COUNT(*) INTO v_current_vms
    FROM claw_vms
    WHERE agent_id = p_agent_id AND state NOT IN ('stopped', 'error');
    
    -- Calculate currently used resources by all VMs for this agent
    SELECT 
        COALESCE(SUM(memory_mb), 0),
        COALESCE(SUM(vcpu_count), 0),
        COALESCE(SUM(disk_gb), 0)
    INTO v_agent_memory, v_agent_vcpu, v_agent_disk
    FROM claw_vms
    WHERE agent_id = p_agent_id AND state NOT IN ('stopped', 'error');
    
    -- Check quota limits
    IF v_current_vms >= v_quota.max_vms_per_agent THEN
        RETURN QUERY SELECT 
            false::BOOLEAN,
            format('VM limit exceeded: %s/%s VMs', v_current_vms, v_quota.max_vms_per_agent)::TEXT,
            v_current_vms,
            v_quota.max_vms_per_agent,
            v_quota.max_memory_mb,
            v_quota.max_memory_mb - v_agent_memory,
            v_quota.max_vcpu,
            v_quota.max_vcpu - v_agent_vcpu,
            v_quota.max_disk_gb,
            v_quota.max_disk_gb - v_agent_disk;
        RETURN;
    END IF;
    
    IF v_agent_memory + v_quota.max_memory_mb > v_quota.max_memory_mb * v_quota.max_vms_per_agent THEN
        RETURN QUERY SELECT 
            false::BOOLEAN,
            format('Memory quota would be exceeded: using %s MB of %s MB available', 
                   v_agent_memory + v_quota.max_memory_mb, 
                   v_quota.max_memory_mb * v_quota.max_vms_per_agent)::TEXT,
            v_current_vms,
            v_quota.max_vms_per_agent,
            v_quota.max_memory_mb,
            v_quota.max_memory_mb * v_quota.max_vms_per_agent - v_agent_memory,
            v_quota.max_vcpu,
            v_quota.max_vcpu * v_quota.max_vms_per_agent - v_agent_vcpu,
            v_quota.max_disk_gb,
            v_quota.max_disk_gb * v_quota.max_vms_per_agent - v_agent_disk;
        RETURN;
    END IF;
    
    -- Quota check passed
    RETURN QUERY SELECT 
        true::BOOLEAN,
        'Quota check passed'::TEXT,
        v_current_vms,
        v_quota.max_vms_per_agent,
        v_quota.max_memory_mb,
        v_quota.max_memory_mb * v_quota.max_vms_per_agent - v_agent_memory,
        v_quota.max_vcpu,
        v_quota.max_vcpu * v_quota.max_vms_per_agent - v_agent_vcpu,
        v_quota.max_disk_gb,
        v_quota.max_disk_gb * v_quota.max_vms_per_agent - v_agent_disk;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION enforce_resource_quota(UUID, vm_tier) IS 'Checks if an agent can create a VM of the specified tier based on resource quotas';

-- ============================================
-- ADDITIONAL UTILITY FUNCTIONS
-- ============================================

-- Function to cleanup expired snapshots
CREATE OR REPLACE FUNCTION cleanup_expired_snapshots()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM claw_vm_snapshots
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_snapshots() IS 'Removes expired VM snapshots. Returns count of deleted rows.';

-- Function to get agent VM summary
CREATE OR REPLACE FUNCTION get_agent_vm_summary(p_agent_id UUID)
RETURNS TABLE (
    total_vms BIGINT,
    running_vms BIGINT,
    stopped_vms BIGINT,
    error_vms BIGINT,
    total_memory_mb BIGINT,
    total_vcpu BIGINT,
    total_disk_gb BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS total_vms,
        COUNT(*) FILTER (WHERE state = 'running')::BIGINT AS running_vms,
        COUNT(*) FILTER (WHERE state = 'stopped')::BIGINT AS stopped_vms,
        COUNT(*) FILTER (WHERE state = 'error')::BIGINT AS error_vms,
        COALESCE(SUM(memory_mb) FILTER (WHERE state = 'running'), 0)::BIGINT AS total_memory_mb,
        COALESCE(SUM(vcpu_count) FILTER (WHERE state = 'running'), 0)::BIGINT AS total_vcpu,
        COALESCE(SUM(disk_gb), 0)::BIGINT AS total_disk_gb
    FROM claw_vms
    WHERE agent_id = p_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_agent_vm_summary(UUID) IS 'Returns a summary of VMs for a specific agent';

-- ============================================
-- GRANTS
-- ============================================

-- Grant appropriate permissions
GRANT SELECT ON claw_resource_quotas TO authenticated;
GRANT ALL ON claw_vms TO authenticated;
GRANT ALL ON claw_vm_snapshots TO authenticated;
GRANT SELECT ON claw_vm_metrics TO authenticated;

-- Grant sequence usage for UUID generation
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

COMMENT ON TABLE claw_vms IS 'VM instances managed by ClawVM - Created by migration 010_claw_vm.sql';
COMMENT ON TABLE claw_vm_snapshots IS 'VM checkpoint snapshots - Created by migration 010_claw_vm.sql';
COMMENT ON TABLE claw_vm_metrics IS 'Historical resource usage metrics for VMs - Created by migration 010_claw_vm.sql';
COMMENT ON TABLE claw_resource_quotas IS 'Defines resource limits and requirements for each VM tier - Created by migration 010_claw_vm.sql';
