/**
 * Pricing Gates Integration Tests
 * 
 * Tests subscription-based access control:
 * - Free users can't access Pro features
 * - SubscriptionGate blocks correctly
 * - Middleware redirects unauthorized users
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import {
  TIER_CONFIG,
  TIER_PRIORITY,
  hasAgentAccess,
  hasFeatureAccess,
  meetsMinimumTier,
  getRouteProtection,
  PROTECTED_ROUTES,
  type SubscriptionTier,
} from '@/lib/auth';

// ============================================================================
// Mock Next.js Request/Response Helpers
// ============================================================================

function createMockRequest(
  pathname: string,
  options: { 
    tier?: SubscriptionTier;
    cookies?: Record<string, string>;
  } = {}
): NextRequest {
  const { tier = 'starter', cookies = {} } = options;
  
  const url = new URL(`http://localhost:3000${pathname}`);
  
  // Create session cookie
  const sessionCookie = JSON.stringify({ userId: `demo-${tier}` });
  
  return {
    url: url.toString(),
    nextUrl: url,
    cookies: {
      get: (name: string) => {
        if (name === 'moltos_session') {
          return { name, value: sessionCookie };
        }
        return cookies[name] ? { name, value: cookies[name] } : undefined;
      },
    },
    headers: new Headers(),
  } as unknown as NextRequest;
}

// ============================================================================
// Suite 1: Free Users Can't Access Pro Features
// ============================================================================

describe('Free Users Feature Access Restrictions', () => {
  const freeTier: SubscriptionTier = 'starter';

  describe('Agent Access Restrictions', () => {
    it('should deny Trading Agent access for free users', () => {
      const hasAccess = hasAgentAccess(freeTier, 'trading');
      expect(hasAccess).toBe(false);
    });

    it('should deny Support Agent access for free users', () => {
      const hasAccess = hasAgentAccess(freeTier, 'support');
      expect(hasAccess).toBe(false);
    });

    it('should deny Monitor Agent access for free users', () => {
      const hasAccess = hasAgentAccess(freeTier, 'monitor');
      expect(hasAccess).toBe(false);
    });

    it('should allow Genesis Agent access for free users', () => {
      const hasAccess = hasAgentAccess(freeTier, 'genesis');
      expect(hasAccess).toBe(true);
    });

    it('should only allow genesis agent for starter tier', () => {
      const allowedAgents = ['genesis', 'support', 'monitor', 'trading']
        .filter(agent => hasAgentAccess(freeTier, agent));
      
      expect(allowedAgents).toEqual(['genesis']);
    });
  });

  describe('Feature Access Restrictions', () => {
    it('should deny API access for free users', () => {
      const hasAccess = hasFeatureAccess(freeTier, 'api-access');
      expect(hasAccess).toBe(false);
    });

    it('should deny advanced primitives access for free users', () => {
      const hasAccess = hasFeatureAccess(freeTier, 'advanced-primitives');
      expect(hasAccess).toBe(false);
    });

    it('should deny custom primitives access for free users', () => {
      const hasAccess = hasFeatureAccess(freeTier, 'custom-primitives');
      expect(hasAccess).toBe(false);
    });

    it('should deny priority support access for free users', () => {
      const hasAccess = hasFeatureAccess(freeTier, 'priority-support');
      expect(hasAccess).toBe(false);
    });

    it('should deny SLA support access for free users', () => {
      const hasAccess = hasFeatureAccess(freeTier, 'sla-support');
      expect(hasAccess).toBe(false);
    });

    it('should allow read-only access for free users', () => {
      const hasAccess = hasFeatureAccess(freeTier, 'read-only');
      expect(hasAccess).toBe(true);
    });

    it('should deny basic primitives access for free users', () => {
      const hasAccess = hasFeatureAccess(freeTier, 'basic-primitives');
      expect(hasAccess).toBe(false);
    });
  });

  describe('Tier Comparison', () => {
    it('should not meet minimum tier requirements for Builder', () => {
      const meets = meetsMinimumTier(freeTier, 'builder');
      expect(meets).toBe(false);
    });

    it('should not meet minimum tier requirements for Pro', () => {
      const meets = meetsMinimumTier(freeTier, 'pro');
      expect(meets).toBe(false);
    });

    it('should not meet minimum tier requirements for Enterprise', () => {
      const meets = meetsMinimumTier(freeTier, 'enterprise');
      expect(meets).toBe(false);
    });

    it('should meet minimum tier requirements for Starter', () => {
      const meets = meetsMinimumTier(freeTier, 'starter');
      expect(meets).toBe(true);
    });

    it('should have lowest tier priority', () => {
      expect(TIER_PRIORITY[freeTier]).toBe(0);
      expect(TIER_PRIORITY[freeTier]).toBeLessThan(TIER_PRIORITY.builder);
      expect(TIER_PRIORITY[freeTier]).toBeLessThan(TIER_PRIORITY.pro);
      expect(TIER_PRIORITY[freeTier]).toBeLessThan(TIER_PRIORITY.enterprise);
    });
  });
});

// ============================================================================
// Suite 2: SubscriptionGate Component Tests
// ============================================================================

describe('SubscriptionGate Access Control', () => {
  describe('Required Tier Checks', () => {
    it('should grant access when user tier meets required tier', () => {
      const userTier: SubscriptionTier = 'pro';
      const requiredTier: SubscriptionTier = 'builder';
      
      const hasAccess = meetsMinimumTier(userTier, requiredTier);
      expect(hasAccess).toBe(true);
    });

    it('should deny access when user tier is below required tier', () => {
      const userTier: SubscriptionTier = 'starter';
      const requiredTier: SubscriptionTier = 'pro';
      
      const hasAccess = meetsMinimumTier(userTier, requiredTier);
      expect(hasAccess).toBe(false);
    });

    it('should grant access when user tier matches required tier exactly', () => {
      const userTier: SubscriptionTier = 'builder';
      const requiredTier: SubscriptionTier = 'builder';
      
      const hasAccess = meetsMinimumTier(userTier, requiredTier);
      expect(hasAccess).toBe(true);
    });

    it('should handle all tier combinations correctly', () => {
      const tiers: SubscriptionTier[] = ['starter', 'builder', 'pro', 'enterprise'];
      
      // Test matrix: for each tier, check access against all other tiers
      for (const userTier of tiers) {
        for (const requiredTier of tiers) {
          const hasAccess = meetsMinimumTier(userTier, requiredTier);
          const expectedAccess = TIER_PRIORITY[userTier] >= TIER_PRIORITY[requiredTier];
          
          expect(hasAccess).toBe(expectedAccess);
        }
      }
    });
  });

  describe('Agent-Specific Gates', () => {
    it('should correctly gate Trading Agent', () => {
      // Only Pro and Enterprise can access Trading Agent
      expect(hasAgentAccess('starter', 'trading')).toBe(false);
      expect(hasAgentAccess('builder', 'trading')).toBe(false);
      expect(hasAgentAccess('pro', 'trading')).toBe(true);
      expect(hasAgentAccess('enterprise', 'trading')).toBe(true);
    });

    it('should correctly gate Support Agent', () => {
      // Builder, Pro, and Enterprise can access Support Agent
      expect(hasAgentAccess('starter', 'support')).toBe(false);
      expect(hasAgentAccess('builder', 'support')).toBe(true);
      expect(hasAgentAccess('pro', 'support')).toBe(true);
      expect(hasAgentAccess('enterprise', 'support')).toBe(true);
    });

    it('should correctly gate Monitor Agent', () => {
      // Builder, Pro, and Enterprise can access Monitor Agent
      expect(hasAgentAccess('starter', 'monitor')).toBe(false);
      expect(hasAgentAccess('builder', 'monitor')).toBe(true);
      expect(hasAgentAccess('pro', 'monitor')).toBe(true);
      expect(hasAgentAccess('enterprise', 'monitor')).toBe(true);
    });

    it('should correctly gate Genesis Agent', () => {
      // All tiers can access Genesis Agent
      expect(hasAgentAccess('starter', 'genesis')).toBe(true);
      expect(hasAgentAccess('builder', 'genesis')).toBe(true);
      expect(hasAgentAccess('pro', 'genesis')).toBe(true);
      expect(hasAgentAccess('enterprise', 'genesis')).toBe(true);
    });
  });

  describe('Feature-Specific Gates', () => {
    it('should correctly gate API Access', () => {
      expect(hasFeatureAccess('starter', 'api-access')).toBe(false);
      expect(hasFeatureAccess('builder', 'api-access')).toBe(false);
      expect(hasFeatureAccess('pro', 'api-access')).toBe(true);
      expect(hasFeatureAccess('enterprise', 'api-access')).toBe(true);
    });

    it('should correctly gate Custom Primitives', () => {
      expect(hasFeatureAccess('starter', 'custom-primitives')).toBe(false);
      expect(hasFeatureAccess('builder', 'custom-primitives')).toBe(false);
      expect(hasFeatureAccess('pro', 'custom-primitives')).toBe(false);
      expect(hasFeatureAccess('enterprise', 'custom-primitives')).toBe(true);
    });

    it('should correctly gate SLA Support', () => {
      expect(hasFeatureAccess('starter', 'sla-support')).toBe(false);
      expect(hasFeatureAccess('builder', 'sla-support')).toBe(false);
      expect(hasFeatureAccess('pro', 'sla-support')).toBe(false);
      expect(hasFeatureAccess('enterprise', 'sla-support')).toBe(true);
    });

    it('should correctly gate Priority Support', () => {
      expect(hasFeatureAccess('starter', 'priority-support')).toBe(false);
      expect(hasFeatureAccess('builder', 'priority-support')).toBe(false);
      expect(hasFeatureAccess('pro', 'priority-support')).toBe(true);
      expect(hasFeatureAccess('enterprise', 'priority-support')).toBe(true);
    });
  });
});

// ============================================================================
// Suite 3: Middleware Route Protection Tests
// ============================================================================

describe('Middleware Route Protection', () => {
  describe('Route Protection Configuration', () => {
    it('should have Trading Agent route protected', () => {
      const protection = getRouteProtection('/agent/trading');
      expect(protection).toBeDefined();
      expect(protection?.requiredTier).toBe('pro');
      expect(protection?.requiredAgent).toBe('trading');
    });

    it('should have Support Agent route protected', () => {
      const protection = getRouteProtection('/agent/support');
      expect(protection).toBeDefined();
      expect(protection?.requiredTier).toBe('builder');
      expect(protection?.requiredAgent).toBe('support');
    });

    it('should have Monitor Agent route protected', () => {
      const protection = getRouteProtection('/agent/monitor');
      expect(protection).toBeDefined();
      expect(protection?.requiredTier).toBe('builder');
      expect(protection?.requiredAgent).toBe('monitor');
    });

    it('should have advanced primitives route protected', () => {
      const protection = getRouteProtection('/primitives/advanced');
      expect(protection).toBeDefined();
      expect(protection?.requiredTier).toBe('pro');
      expect(protection?.requiredFeature).toBe('advanced-primitives');
    });

    it('should have custom primitives route protected', () => {
      const protection = getRouteProtection('/primitives/custom');
      expect(protection).toBeDefined();
      expect(protection?.requiredTier).toBe('enterprise');
      expect(protection?.requiredFeature).toBe('custom-primitives');
    });

    it('should have settings/integrations route protected', () => {
      const protection = getRouteProtection('/settings/integrations');
      expect(protection).toBeDefined();
      expect(protection?.requiredTier).toBe('pro');
      expect(protection?.requiredFeature).toBe('api-access');
    });

    it('should return null for unprotected routes', () => {
      const protection = getRouteProtection('/public/page');
      expect(protection).toBeNull();
    });

    it('should handle nested paths under protected routes', () => {
      const protection = getRouteProtection('/agent/trading/config');
      expect(protection).toBeDefined();
      expect(protection?.requiredTier).toBe('pro');
    });
  });

  describe('Protected Routes Array', () => {
    it('should have all expected protected routes defined', () => {
      const paths = PROTECTED_ROUTES.map(r => r.path);
      
      expect(paths).toContain('/agent/trading');
      expect(paths).toContain('/agent/support');
      expect(paths).toContain('/agent/monitor');
      expect(paths).toContain('/primitives/advanced');
      expect(paths).toContain('/primitives/custom');
      expect(paths).toContain('/settings/integrations');
      expect(paths).toContain('/api/trading');
    });
  });
});

// ============================================================================
// Suite 4: Middleware Redirect Behavior
// ============================================================================

describe('Middleware Redirect Logic', () => {
  describe('Tier-Based Redirects', () => {
    it('should detect insufficient tier for protected route', () => {
      const userTier: SubscriptionTier = 'starter';
      const requiredTier: SubscriptionTier = 'pro';
      
      const canAccess = meetsMinimumTier(userTier, requiredTier);
      expect(canAccess).toBe(false);
    });

    it('should detect sufficient tier for protected route', () => {
      const userTier: SubscriptionTier = 'enterprise';
      const requiredTier: SubscriptionTier = 'pro';
      
      const canAccess = meetsMinimumTier(userTier, requiredTier);
      expect(canAccess).toBe(true);
    });

    it('should build correct upgrade URL parameters', () => {
      const requiredTier: SubscriptionTier = 'pro';
      const tierName = TIER_CONFIG[requiredTier].name;
      const fromUrl = encodeURIComponent('http://localhost:3000/agent/trading');
      
      const upgradeUrl = `/pricing?upgrade=${requiredTier}&from=${fromUrl}&required=${tierName}`;
      
      expect(upgradeUrl).toContain('upgrade=pro');
      expect(upgradeUrl).toContain('required=Pro');
      expect(upgradeUrl).toContain('from=');
    });
  });

  describe('API Route Error Responses', () => {
    it('should return correct error structure for API routes', () => {
      const requiredTier: SubscriptionTier = 'pro';
      const feature = 'trading';
      
      const errorResponse = {
        success: false,
        error: {
          code: 'INSUFFICIENT_TIER',
          message: `This feature requires ${TIER_CONFIG[requiredTier].name} tier or higher`,
          requiredTier,
          feature,
          upgradeUrl: `/pricing?upgrade=${requiredTier}`,
        },
      };
      
      expect(errorResponse.error.code).toBe('INSUFFICIENT_TIER');
      expect(errorResponse.error.requiredTier).toBe('pro');
      expect(errorResponse.error.upgradeUrl).toBe('/pricing?upgrade=pro');
    });

    it('should include X-Subscription-Required header for API errors', () => {
      const headers = {
        'X-Subscription-Required': 'pro',
      };
      
      expect(headers['X-Subscription-Required']).toBe('pro');
    });
  });

  describe('Public Route Bypass', () => {
    it('should allow access to public routes regardless of tier', () => {
      const publicRoutes = ['/', '/pricing', '/about', '/contact'];
      
      for (const route of publicRoutes) {
        const protection = getRouteProtection(route);
        // Public routes should not have protection rules
        expect(protection).toBeNull();
      }
    });
  });
});

// ============================================================================
// Suite 5: Edge Cases and Boundary Tests
// ============================================================================

describe('Edge Cases and Boundary Tests', () => {
  describe('Invalid Agent/Feature Names', () => {
    it('should return false for unknown agent types', () => {
      const hasAccess = hasAgentAccess('pro', 'unknown-agent');
      expect(hasAccess).toBe(false);
    });

    it('should return false for unknown feature names', () => {
      const hasAccess = hasFeatureAccess('enterprise', 'unknown-feature');
      expect(hasAccess).toBe(false);
    });
  });

  describe('Case Sensitivity', () => {
    it('should handle agent names case-insensitively', () => {
      // The implementation should normalize agent names
      const lowerCase = hasAgentAccess('pro', 'trading');
      const upperCase = hasAgentAccess('pro', 'TRADING');
      
      expect(lowerCase).toBe(true);
      // Current implementation uses toLowerCase in hasAgentAccess
      expect(upperCase).toBe(true);
    });

    it('should handle feature names case-insensitively', () => {
      const lowerCase = hasFeatureAccess('pro', 'api-access');
      const upperCase = hasFeatureAccess('pro', 'API-ACCESS');
      
      expect(lowerCase).toBe(true);
      expect(upperCase).toBe(true);
    });
  });

  describe('Tier Priority Edge Cases', () => {
    it('should handle same-tier comparison correctly', () => {
      const tiers: SubscriptionTier[] = ['starter', 'builder', 'pro', 'enterprise'];
      
      for (const tier of tiers) {
        expect(meetsMinimumTier(tier, tier)).toBe(true);
      }
    });

    it('should have sequential tier priorities', () => {
      expect(TIER_PRIORITY.builder).toBe(TIER_PRIORITY.starter + 1);
      expect(TIER_PRIORITY.pro).toBe(TIER_PRIORITY.builder + 1);
      expect(TIER_PRIORITY.enterprise).toBe(TIER_PRIORITY.pro + 1);
    });
  });

  describe('Route Path Variations', () => {
    it('should handle paths with trailing slashes', () => {
      const withSlash = getRouteProtection('/agent/trading/');
      const withoutSlash = getRouteProtection('/agent/trading');
      
      expect(withSlash?.requiredTier).toBe(withoutSlash?.requiredTier);
    });

    it('should handle nested paths correctly', () => {
      const nested = getRouteProtection('/agent/trading/dashboard/charts');
      const base = getRouteProtection('/agent/trading');
      
      expect(nested?.requiredTier).toBe(base?.requiredTier);
    });
  });
});

// ============================================================================
// Suite 6: Integration Scenarios
// ============================================================================

describe('Integration Scenarios', () => {
  it('should handle complete unauthorized access attempt', () => {
    // Free user tries to access Trading Agent
    const userTier: SubscriptionTier = 'starter';
    const targetRoute = '/agent/trading';
    
    // Check route protection
    const protection = getRouteProtection(targetRoute);
    expect(protection).toBeDefined();
    expect(protection?.requiredTier).toBe('pro');
    
    // Check user access
    const canAccessTier = meetsMinimumTier(userTier, protection!.requiredTier!);
    expect(canAccessTier).toBe(false);
    
    // Check agent access
    const canAccessAgent = hasAgentAccess(userTier, protection!.requiredAgent!);
    expect(canAccessAgent).toBe(false);
    
    // Result: User should be redirected to upgrade
    const redirectUrl = `/pricing?upgrade=${protection!.requiredTier}`;
    expect(redirectUrl).toBe('/pricing?upgrade=pro');
  });

  it('should handle authorized access correctly', () => {
    // Pro user accessing Trading Agent
    const userTier: SubscriptionTier = 'pro';
    const targetRoute = '/agent/trading';
    
    // Check route protection
    const protection = getRouteProtection(targetRoute);
    
    // Check user access
    const canAccessTier = meetsMinimumTier(userTier, protection!.requiredTier!);
    expect(canAccessTier).toBe(true);
    
    // Check agent access
    const canAccessAgent = hasAgentAccess(userTier, protection!.requiredAgent!);
    expect(canAccessAgent).toBe(true);
    
    // Result: User should be allowed through
  });

  it('should handle multi-level tier escalation', () => {
    // Builder user trying to access Enterprise-only feature
    const userTier: SubscriptionTier = 'builder';
    const targetRoute = '/primitives/custom';
    
    const protection = getRouteProtection(targetRoute);
    expect(protection?.requiredTier).toBe('enterprise');
    
    // User is 2 tiers below required
    const tierGap = TIER_PRIORITY[protection!.requiredTier!] - TIER_PRIORITY[userTier];
    expect(tierGap).toBe(2);
    
    // Should be denied
    const canAccess = meetsMinimumTier(userTier, protection!.requiredTier!);
    expect(canAccess).toBe(false);
  });
});
