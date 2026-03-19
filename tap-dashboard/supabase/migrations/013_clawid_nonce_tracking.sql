-- Migration: Add ClawID nonce tracking for replay protection
-- Date: March 19, 2026

-- Table to track used ClawID challenges (nonces)
CREATE TABLE IF NOT EXISTS clawid_nonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nonce TEXT NOT NULL,
    public_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Ensure nonce can't be reused for same public key
    UNIQUE(nonce, public_key)
);

-- Indexes for fast lookup and cleanup
CREATE INDEX idx_clawid_nonces_lookup ON clawid_nonces(nonce, public_key);
CREATE INDEX idx_clawid_nonces_expiry ON clawid_nonces(expires_at);

-- Enable RLS
ALTER TABLE clawid_nonces ENABLE ROW LEVEL SECURITY;

-- Only service role can access nonces
CREATE POLICY "Service role only" ON clawid_nonces
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Function to clean up expired nonces (can be called via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_clawid_nonces()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
    DELETE FROM clawid_nonces
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
