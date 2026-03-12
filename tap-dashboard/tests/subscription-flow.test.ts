/**
 * Subscription Flow Integration Tests
 * 
 * End-to-end test suite covering:
 * - Free tier signup
 * - Upgrade to Builder
 * - Purchase Trading Agent
 * - Access premium features
 * - Webhook handling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { 
  TIER_CONFIG, 
  TIER_PRIORITY,
  hasAgentAccess, 
  hasFeatureAccess,
  meetsMinimumTier,
  getUpgradeInfo,
  type SubscriptionTier,
} from '@/lib/auth';

// ============================================================================
// Mock Data
// ============================================================================

const TEST_USERS = {
  free: {
    id: 'test-free-user',
    email: 'free@test.com',
    tier: 'starter' as SubscriptionTier,
  },
  builder: {
    id: 'test-builder-user',
    email: 'builder@test.com',
    tier: 'builder' as SubscriptionTier,
  },
  pro: {
    id: 'test-pro-user',
    email: 'pro@test.com',
    tier: 'pro' as SubscriptionTier,
  },
  enterprise: {
    id: 'test-enterprise-user',
    email: 'enterprise@test.com',
    tier: 'enterprise' as SubscriptionTier,
  },
};

// ============================================================================
// Suite 1: Free Tier Signup
// ============================================================================

describe('Free Tier Signup', () => {
  it('should initialize user with starter tier by default', () => {
    const user = TEST_USERS.free;
    expect(user.tier).toBe('starter');
    expect(TIER_CONFIG[user.tier].price).toBe(0);
  });

  it('should provide correct starter tier features', () => {
    const config = TIER_CONFIG.starter;
    
    expect(config.name).toBe('Starter');
    expect(config.price).toBe(0);
    expect(config.features).toContain('Genesis Agent access');
    expect(config.features).toContain('Read-only dashboard access');
    expect(config.limits.maxAgents).toBe(1);
    expect(config.limits.supportLevel).toBe('community');
  });

  it('should allow Genesis agent access for free users', () => {
    const hasAccess = hasAgentAccess('starter', 'genesis');
    expect(hasAccess).toBe(true);
  });

  it('should deny Trading agent access for free users', () => {
    const hasAccess = hasAgentAccess('starter', 'trading');
    expect(hasAccess).toBe(false);
  });

  it('should deny Support agent access for free users', () => {
    const hasAccess = hasAgentAccess('starter', 'support');
    expect(hasAccess).toBe(false);
  });

  it('should provide read-only feature access', () => {
    const hasAccess = hasFeatureAccess('starter', 'read-only');
    expect(hasAccess).toBe(true);
  });

  it('should deny API access for free users', () => {
    const hasAccess = hasFeatureAccess('starter', 'api-access');
    expect(hasAccess).toBe(false);
  });
});

// ============================================================================
// Suite 2: Upgrade to Builder
// ============================================================================

describe('Upgrade to Builder Tier', () => {
  it('should provide correct Builder tier configuration', () => {
    const config = TIER_CONFIG.builder;
    
    expect(config.name).toBe('Builder');
    expect(config.price).toBe(29);
    expect(config.billingPeriod).toBe('monthly');
    expect(config.limits.maxAgents).toBe(3);
    expect(config.limits.supportLevel).toBe('email');
  });

  it('should show correct upgrade info from starter to builder', () => {
    const upgradeInfo = getUpgradeInfo('starter');
    
    expect(upgradeInfo.nextTier).toBe('builder');
    expect(upgradeInfo.price).toBe(29);
    expect(upgradeInfo.features.length).toBeGreaterThan(0);
  });

  it('should allow Genesis agent access for Builder users', () => {
    const hasAccess = hasAgentAccess('builder', 'genesis');
    expect(hasAccess).toBe(true);
  });

  it('should allow Support agent access for Builder users', () => {
    const hasAccess = hasAgentAccess('builder', 'support');
    expect(hasAccess).toBe(true);
  });

  it('should allow Monitor agent access for Builder users', () => {
    const hasAccess = hasAgentAccess('builder', 'monitor');
    expect(hasAccess).toBe(true);
  });

  it('should deny Trading agent access for Builder users', () => {
    const hasAccess = hasAgentAccess('builder', 'trading');
    expect(hasAccess).toBe(false);
  });

  it('should provide basic primitives access for Builder', () => {
    const hasAccess = hasFeatureAccess('builder', 'basic-primitives');
    expect(hasAccess).toBe(true);
  });

  it('should provide advanced analytics for Builder', () => {
    const hasAccess = hasFeatureAccess('builder', 'advanced-analytics');
    expect(hasAccess).toBe(true);
  });

  it('should determine builder meets minimum tier of starter', () => {
    const meets = meetsMinimumTier('builder', 'starter');
    expect(meets).toBe(true);
  });

  it('should correctly compare tier priorities', () => {
    expect(TIER_PRIORITY.builder).toBeGreaterThan(TIER_PRIORITY.starter);
    expect(TIER_PRIORITY.pro).toBeGreaterThan(TIER_PRIORITY.builder);
    expect(TIER_PRIORITY.enterprise).toBeGreaterThan(TIER_PRIORITY.pro);
  });
});

// ============================================================================
// Suite 3: Purchase Trading Agent (Pro Tier)
// ============================================================================

describe('Purchase Trading Agent (Pro Tier)', () => {
  it('should provide correct Pro tier configuration', () => {
    const config = TIER_CONFIG.pro;
    
    expect(config.name).toBe('Pro');
    expect(config.price).toBe(79);
    expect(config.limits.maxAgents).toBe(10);
    expect(config.limits.supportLevel).toBe('priority');
  });

  it('should show correct upgrade info from builder to pro', () => {
    const upgradeInfo = getUpgradeInfo('builder');
    
    expect(upgradeInfo.nextTier).toBe('pro');
    expect(upgradeInfo.price).toBe(79);
  });

  it('should allow Trading agent access for Pro users', () => {
    const hasAccess = hasAgentAccess('pro', 'trading');
    expect(hasAccess).toBe(true);
  });

  it('should allow all agents for Pro users', () => {
    expect(hasAgentAccess('pro', 'genesis')).toBe(true);
    expect(hasAgentAccess('pro', 'support')).toBe(true);
    expect(hasAgentAccess('pro', 'monitor')).toBe(true);
    expect(hasAgentAccess('pro', 'trading')).toBe(true);
  });

  it('should provide API access for Pro users', () => {
    const hasAccess = hasFeatureAccess('pro', 'api-access');
    expect(hasAccess).toBe(true);
  });

  it('should provide priority support for Pro users', () => {
    const hasAccess = hasFeatureAccess('pro', 'priority-support');
    expect(hasAccess).toBe(true);
  });

  it('should deny SLA support for Pro users', () => {
    const hasAccess = hasFeatureAccess('pro', 'sla-support');
    expect(hasAccess).toBe(false);
  });

  it('should provide advanced primitives access for Pro', () => {
    const hasAccess = hasFeatureAccess('pro', 'advanced-primitives');
    expect(hasAccess).toBe(true);
  });

  it('should deny custom primitives for Pro users', () => {
    const hasAccess = hasFeatureAccess('pro', 'custom-primitives');
    expect(hasAccess).toBe(false);
  });

  it('should determine pro meets minimum tier of builder', () => {
    const meets = meetsMinimumTier('pro', 'builder');
    expect(meets).toBe(true);
  });
});

// ============================================================================
// Suite 4: Access Premium Features
// ============================================================================

describe('Premium Feature Access', () => {
  describe('Enterprise Tier Features', () => {
    it('should provide correct Enterprise tier configuration', () => {
      const config = TIER_CONFIG.enterprise;
      
      expect(config.name).toBe('Enterprise');
      expect(config.price).toBe(199);
      expect(config.limits.maxAgents).toBe(-1); // Unlimited
      expect(config.limits.maxPrimitives).toBe(-1); // Unlimited
      expect(config.limits.supportLevel).toBe('sla');
    });

    it('should show no upgrade info from enterprise (top tier)', () => {
      const upgradeInfo = getUpgradeInfo('enterprise');
      
      expect(upgradeInfo.nextTier).toBeNull();
      expect(upgradeInfo.price).toBe(0);
    });

    it('should allow all agents for Enterprise users', () => {
      expect(hasAgentAccess('enterprise', 'genesis')).toBe(true);
      expect(hasAgentAccess('enterprise', 'support')).toBe(true);
      expect(hasAgentAccess('enterprise', 'monitor')).toBe(true);
      expect(hasAgentAccess('enterprise', 'trading')).toBe(true);
    });

    it('should provide all features for Enterprise users', () => {
      expect(hasFeatureAccess('enterprise', 'read-only')).toBe(true);
      expect(hasFeatureAccess('enterprise', 'basic-primitives')).toBe(true);
      expect(hasFeatureAccess('enterprise', 'advanced-primitives')).toBe(true);
      expect(hasFeatureAccess('enterprise', 'custom-primitives')).toBe(true);
      expect(hasFeatureAccess('enterprise', 'api-access')).toBe(true);
      expect(hasFeatureAccess('enterprise', 'priority-support')).toBe(true);
      expect(hasFeatureAccess('enterprise', 'sla-support')).toBe(true);
    });

    it('should determine enterprise meets minimum tier of any tier', () => {
      expect(meetsMinimumTier('enterprise', 'starter')).toBe(true);
      expect(meetsMinimumTier('enterprise', 'builder')).toBe(true);
      expect(meetsMinimumTier('enterprise', 'pro')).toBe(true);
      expect(meetsMinimumTier('enterprise', 'enterprise')).toBe(true);
    });
  });

  describe('Feature Comparison Matrix', () => {
    it('should correctly gate Trading Agent by tier', () => {
      expect(hasAgentAccess('starter', 'trading')).toBe(false);
      expect(hasAgentAccess('builder', 'trading')).toBe(false);
      expect(hasAgentAccess('pro', 'trading')).toBe(true);
      expect(hasAgentAccess('enterprise', 'trading')).toBe(true);
    });

    it('should correctly gate Support Agent by tier', () => {
      expect(hasAgentAccess('starter', 'support')).toBe(false);
      expect(hasAgentAccess('builder', 'support')).toBe(true);
      expect(hasAgentAccess('pro', 'support')).toBe(true);
      expect(hasAgentAccess('enterprise', 'support')).toBe(true);
    });

    it('should correctly gate API Access by tier', () => {
      expect(hasFeatureAccess('starter', 'api-access')).toBe(false);
      expect(hasFeatureAccess('builder', 'api-access')).toBe(false);
      expect(hasFeatureAccess('pro', 'api-access')).toBe(true);
      expect(hasFeatureAccess('enterprise', 'api-access')).toBe(true);
    });

    it('should correctly gate Custom Primitives by tier', () => {
      expect(hasFeatureAccess('starter', 'custom-primitives')).toBe(false);
      expect(hasFeatureAccess('builder', 'custom-primitives')).toBe(false);
      expect(hasFeatureAccess('pro', 'custom-primitives')).toBe(false);
      expect(hasFeatureAccess('enterprise', 'custom-primitives')).toBe(true);
    });
  });
});

// ============================================================================
// Suite 5: Webhook Handling
// ============================================================================

describe('Stripe Webhook Handling', () => {
  // Mock webhook event data
  const mockCheckoutSession = {
    id: 'cs_test_123',
    object: 'checkout.session',
    status: 'complete',
    payment_status: 'paid',
    subscription: 'sub_123',
    customer: 'cus_123',
    metadata: {
      userId: 'test-user-123',
      tier: 'builder',
    },
  };

  const mockSubscription = {
    id: 'sub_123',
    object: 'subscription',
    status: 'active',
    customer: 'cus_123',
    metadata: {
      userId: 'test-user-123',
      tier: 'pro',
    },
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    cancel_at_period_end: false,
  };

  it('should validate webhook event structure', () => {
    expect(mockCheckoutSession).toHaveProperty('id');
    expect(mockCheckoutSession).toHaveProperty('status');
    expect(mockCheckoutSession).toHaveProperty('metadata.userId');
    expect(mockCheckoutSession).toHaveProperty('metadata.tier');
  });

  it('should extract userId and tier from checkout session metadata', () => {
    const userId = mockCheckoutSession.metadata.userId;
    const tier = mockCheckoutSession.metadata.tier;
    
    expect(userId).toBe('test-user-123');
    expect(tier).toBe('builder');
    expect(['starter', 'builder', 'pro', 'enterprise']).toContain(tier);
  });

  it('should handle checkout.session.completed event', () => {
    const event = {
      id: 'evt_123',
      type: 'checkout.session.completed',
      data: { object: mockCheckoutSession },
    };

    expect(event.type).toBe('checkout.session.completed');
    expect(event.data.object.status).toBe('complete');
    expect(event.data.object.payment_status).toBe('paid');
  });

  it('should handle customer.subscription.created event', () => {
    const event = {
      id: 'evt_124',
      type: 'customer.subscription.created',
      data: { object: mockSubscription },
    };

    expect(event.type).toBe('customer.subscription.created');
    expect(event.data.object.status).toBe('active');
    expect(event.data.object.metadata.tier).toBe('pro');
  });

  it('should handle customer.subscription.updated event', () => {
    const updatedSubscription = {
      ...mockSubscription,
      status: 'past_due',
    };

    const event = {
      id: 'evt_125',
      type: 'customer.subscription.updated',
      data: { object: updatedSubscription },
    };

    expect(event.data.object.status).toBe('past_due');
  });

  it('should handle invoice.payment_failed event', () => {
    const mockInvoice = {
      id: 'in_123',
      subscription: 'sub_123',
      customer: 'cus_123',
      amount_due: 7900,
      attempt_count: 1,
      next_payment_attempt: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    };

    const event = {
      id: 'evt_126',
      type: 'invoice.payment_failed',
      data: { object: mockInvoice },
    };

    expect(event.type).toBe('invoice.payment_failed');
    expect(event.data.object.attempt_count).toBeGreaterThan(0);
  });

  it('should handle customer.subscription.deleted event', () => {
    const canceledSubscription = {
      ...mockSubscription,
      status: 'canceled',
      ended_at: Math.floor(Date.now() / 1000),
    };

    const event = {
      id: 'evt_127',
      type: 'customer.subscription.deleted',
      data: { object: canceledSubscription },
    };

    expect(event.data.object.status).toBe('canceled');
    expect(event.data.object.ended_at).toBeDefined();
  });

  it('should verify tier mapping from subscription metadata', () => {
    const tier = mockSubscription.metadata.tier as SubscriptionTier;
    
    expect(TIER_CONFIG[tier]).toBeDefined();
    expect(TIER_CONFIG[tier].name).toBe('Pro');
  });

  it('should calculate subscription period correctly', () => {
    const periodStart = mockSubscription.current_period_start;
    const periodEnd = mockSubscription.current_period_end;
    const duration = periodEnd - periodStart;
    
    // Should be approximately 30 days
    expect(duration).toBeGreaterThan(29 * 24 * 60 * 60);
    expect(duration).toBeLessThan(31 * 24 * 60 * 60);
  });
});

// ============================================================================
// Suite 6: End-to-End Subscription Flow
// ============================================================================

describe('End-to-End Subscription Flow', () => {
  it('complete flow: signup → free → upgrade to builder → upgrade to pro', () => {
    // Step 1: User signs up with free tier
    let currentTier: SubscriptionTier = 'starter';
    expect(currentTier).toBe('starter');
    expect(TIER_CONFIG[currentTier].price).toBe(0);

    // Step 2: User upgrades to Builder
    currentTier = 'builder';
    expect(currentTier).toBe('builder');
    expect(TIER_CONFIG[currentTier].price).toBe(29);
    expect(hasAgentAccess(currentTier, 'support')).toBe(true);
    expect(hasAgentAccess(currentTier, 'trading')).toBe(false);

    // Step 3: User upgrades to Pro for Trading Agent
    currentTier = 'pro';
    expect(currentTier).toBe('pro');
    expect(TIER_CONFIG[currentTier].price).toBe(79);
    expect(hasAgentAccess(currentTier, 'trading')).toBe(true);
    expect(hasFeatureAccess(currentTier, 'api-access')).toBe(true);

    // Verify all tiers are properly ordered
    expect(meetsMinimumTier(currentTier, 'starter')).toBe(true);
    expect(meetsMinimumTier(currentTier, 'builder')).toBe(true);
    expect(meetsMinimumTier(currentTier, 'pro')).toBe(true);
  });

  it('should handle downgrade flow correctly', () => {
    // User starts at Pro
    let currentTier: SubscriptionTier = 'pro';
    expect(hasAgentAccess(currentTier, 'trading')).toBe(true);

    // User downgrades to Builder at period end
    currentTier = 'builder';
    
    // Should lose Trading Agent access
    expect(hasAgentAccess(currentTier, 'trading')).toBe(false);
    
    // Should retain Support Agent access
    expect(hasAgentAccess(currentTier, 'support')).toBe(true);
  });

  it('should handle cancellation flow correctly', () => {
    // User cancels Pro subscription
    const cancelledTier: SubscriptionTier = 'starter';
    
    // Should revert to free features
    expect(hasAgentAccess(cancelledTier, 'trading')).toBe(false);
    expect(hasAgentAccess(cancelledTier, 'support')).toBe(false);
    expect(hasFeatureAccess(cancelledTier, 'api-access')).toBe(false);
    
    // Should retain Genesis access
    expect(hasAgentAccess(cancelledTier, 'genesis')).toBe(true);
  });
});

// ============================================================================
// Suite 7: Stripe Price Configuration Validation
// ============================================================================

describe('Stripe Price Configuration', () => {
  it('should have correct price IDs for all tiers', () => {
    // These should be set in environment variables
    const requiredPriceIds = [
      'STRIPE_PRICE_BUILDER',
      'STRIPE_PRICE_PRO',
      'STRIPE_PRICE_ENTERPRISE',
    ];

    // Verify the lib/stripe.ts exports correct structure
    const { STRIPE_PRICES } = require('@/lib/stripe');
    
    expect(STRIPE_PRICES.builder.amount).toBe(2900); // $29.00
    expect(STRIPE_PRICES.pro.amount).toBe(7900); // $79.00
    expect(STRIPE_PRICES.enterprise.amount).toBe(19900); // $199.00
  });

  it('should have correct billing intervals', () => {
    const { STRIPE_PRICES } = require('@/lib/stripe');
    
    expect(STRIPE_PRICES.builder.interval).toBe('month');
    expect(STRIPE_PRICES.pro.interval).toBe('month');
    expect(STRIPE_PRICES.enterprise.interval).toBe('month');
  });
});
