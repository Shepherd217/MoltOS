-- Migration: User Subscriptions Table
-- Creates table to store user subscription tiers linked to Supabase Auth

-- User subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tier TEXT NOT NULL CHECK (tier IN ('starter', 'builder', 'pro', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'unpaid')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id),
    UNIQUE(stripe_subscription_id)
);

-- Indexes for common queries
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_tier ON user_subscriptions(tier);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own subscription"
    ON user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
    ON user_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role can manage all subscriptions
CREATE POLICY "Service role can manage all subscriptions"
    ON user_subscriptions FOR ALL
    USING (auth.role() = 'service_role');

-- Function to automatically create starter subscription for new users
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_subscriptions (user_id, tier, status, current_period_start, current_period_end)
    VALUES (
        NEW.id,
        'starter',
        'active',
        NOW(),
        NOW() + INTERVAL '100 years'  -- Starter is free forever
    )
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default subscription on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_subscription();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_subscriptions_updated_at();

-- Function to get user subscription tier
CREATE OR REPLACE FUNCTION get_user_tier(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    user_tier TEXT;
BEGIN
    SELECT tier INTO user_tier
    FROM user_subscriptions
    WHERE user_id = user_uuid
    AND status = 'active'
    AND (current_period_end IS NULL OR current_period_end > NOW());
    
    RETURN COALESCE(user_tier, 'starter');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has feature access
CREATE OR REPLACE FUNCTION user_has_feature(user_uuid UUID, feature_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_tier TEXT;
    feature_access JSONB;
BEGIN
    user_tier := get_user_tier(user_uuid);
    
    -- Define feature access by tier
    feature_access := jsonb_build_object(
        'starter', jsonb_build_array('genesis', 'read-only'),
        'builder', jsonb_build_array('genesis', 'read-only', 'support', 'monitor', 'basic-primitives'),
        'pro', jsonb_build_array('genesis', 'read-only', 'support', 'monitor', 'trading', 'basic-primitives', 'advanced-primitives', 'api-access'),
        'enterprise', jsonb_build_array('genesis', 'read-only', 'support', 'monitor', 'trading', 'basic-primitives', 'advanced-primitives', 'custom-primitives', 'api-access', 'priority-support', 'sla-support')
    );
    
    RETURN feature_access->user_tier ? feature_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has agent access
CREATE OR REPLACE FUNCTION user_has_agent(user_uuid UUID, agent_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_tier TEXT;
    agent_access JSONB;
BEGIN
    user_tier := get_user_tier(user_uuid);
    
    -- Define agent access by tier
    agent_access := jsonb_build_object(
        'starter', jsonb_build_array('genesis'),
        'builder', jsonb_build_array('genesis', 'support', 'monitor'),
        'pro', jsonb_build_array('genesis', 'support', 'monitor', 'trading'),
        'enterprise', jsonb_build_array('genesis', 'support', 'monitor', 'trading')
    );
    
    RETURN agent_access->user_tier ? agent_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE user_subscriptions IS 'Stores user subscription tiers and billing information';
COMMENT ON COLUMN user_subscriptions.tier IS 'Subscription tier: starter, builder, pro, or enterprise';
COMMENT ON COLUMN user_subscriptions.status IS 'Subscription status: active, cancelled, past_due, or unpaid';

-- ============================================================================
-- Subscription Audit Log (for admin tier changes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('tier_change', 'status_change', 'created', 'cancelled')),
    previous_tier TEXT,
    new_tier TEXT,
    previous_status TEXT,
    new_status TEXT,
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for audit queries
CREATE INDEX idx_subscription_audit_log_user_id ON subscription_audit_log(user_id);
CREATE INDEX idx_subscription_audit_log_changed_at ON subscription_audit_log(changed_at);
CREATE INDEX idx_subscription_audit_log_action ON subscription_audit_log(action);

-- Enable RLS on audit log
ALTER TABLE subscription_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role can manage all audit logs
CREATE POLICY "Service role can manage all audit logs"
    ON subscription_audit_log FOR ALL
    USING (auth.role() = 'service_role');

-- Users can view own audit logs
CREATE POLICY "Users can view own audit logs"
    ON subscription_audit_log FOR SELECT
    USING (auth.uid() = user_id);

COMMENT ON TABLE subscription_audit_log IS 'Audit trail for subscription changes made by admins';
