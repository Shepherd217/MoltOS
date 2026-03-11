/**
 * Subscription Service for MoltOS
 * Handles tiered plans, billing intervals, usage overages, and trial periods
 */

import { 
  SubscriptionPlan, 
  Subscription, 
  SubscriptionTier,
  BillingInterval,
  SubscriptionStatus,
  UsageMetrics,
  AppliedDiscount,
  PlanFeature
} from '@/types/billing';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// Default Plans Configuration
// ============================================================================

export const DEFAULT_PLANS: Record<SubscriptionTier, Partial<SubscriptionPlan>> = {
  basic: {
    tier: 'basic',
    name: 'Basic',
    description: 'Perfect for individual agents and small projects',
    features: [
      { id: 'f1', name: 'Agents', description: 'Up to 3 AI agents', included: true, limit: 3 },
      { id: 'f2', name: 'API Calls', description: '10,000 API calls/month', included: true, limit: 10000, unit: 'calls' },
      { id: 'f3', name: 'Storage', description: '10 GB storage', included: true, limit: 10, unit: 'GB' },
      { id: 'f4', name: 'Compute', description: '100 compute hours/month', included: true, limit: 100, unit: 'hours' },
      { id: 'f5', name: 'Team Members', description: '1 team member', included: true, limit: 1 },
      { id: 'f6', name: 'Webhooks', description: '5 webhooks', included: true, limit: 5 },
      { id: 'f7', name: 'Standard Support', description: 'Email support, 48h response', included: true },
      { id: 'f8', name: 'Priority Support', description: 'Priority support', included: false },
    ],
    limits: {
      agents: 3,
      apiCalls: 10000,
      storageGB: 10,
      computeHours: 100,
      teamMembers: 1,
      webhooks: 5,
      integrations: 3,
    },
    pricing: {
      monthly: 29,
      annual: 290, // ~17% discount
      currency: 'USD',
      overageRates: {
        apiCalls: 0.001, // $1 per 1000 calls
        storageGB: 0.50,
        computeHours: 0.10,
        agents: 10,
      },
    },
    trialDays: 14,
    isPublic: true,
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    description: 'For growing agent businesses with higher demands',
    features: [
      { id: 'f1', name: 'Agents', description: 'Up to 10 AI agents', included: true, limit: 10 },
      { id: 'f2', name: 'API Calls', description: '100,000 API calls/month', included: true, limit: 100000, unit: 'calls' },
      { id: 'f3', name: 'Storage', description: '100 GB storage', included: true, limit: 100, unit: 'GB' },
      { id: 'f4', name: 'Compute', description: '1,000 compute hours/month', included: true, limit: 1000, unit: 'hours' },
      { id: 'f5', name: 'Team Members', description: '5 team members', included: true, limit: 5 },
      { id: 'f6', name: 'Webhooks', description: 'Unlimited webhooks', included: true, limit: -1 },
      { id: 'f7', name: 'Integrations', description: '20 integrations', included: true, limit: 20 },
      { id: 'f8', name: 'Priority Support', description: 'Priority support, 24h response', included: true },
      { id: 'f9', name: 'Advanced Analytics', description: 'Advanced analytics dashboard', included: true },
    ],
    limits: {
      agents: 10,
      apiCalls: 100000,
      storageGB: 100,
      computeHours: 1000,
      teamMembers: 5,
      webhooks: -1, // unlimited
      integrations: 20,
    },
    pricing: {
      monthly: 99,
      annual: 990, // ~17% discount
      currency: 'USD',
      overageRates: {
        apiCalls: 0.0008,
        storageGB: 0.40,
        computeHours: 0.08,
        agents: 8,
      },
    },
    trialDays: 14,
    isPublic: true,
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solutions for large-scale agent operations',
    features: [
      { id: 'f1', name: 'Agents', description: 'Unlimited AI agents', included: true, limit: -1 },
      { id: 'f2', name: 'API Calls', description: 'Unlimited API calls', included: true, limit: -1 },
      { id: 'f3', name: 'Storage', description: 'Unlimited storage', included: true, limit: -1 },
      { id: 'f4', name: 'Compute', description: 'Unlimited compute', included: true, limit: -1 },
      { id: 'f5', name: 'Team Members', description: 'Unlimited team members', included: true, limit: -1 },
      { id: 'f6', name: 'Webhooks', description: 'Unlimited webhooks', included: true, limit: -1 },
      { id: 'f7', name: 'Integrations', description: 'Unlimited integrations', included: true, limit: -1 },
      { id: 'f8', name: 'Dedicated Support', description: 'Dedicated account manager', included: true },
      { id: 'f9', name: 'SLA Guarantee', description: '99.99% uptime SLA', included: true },
      { id: 'f10', name: 'Custom Contracts', description: 'Custom contract terms', included: true },
      { id: 'f11', name: 'Security Review', description: 'Security compliance review', included: true },
    ],
    limits: {
      agents: -1,
      apiCalls: -1,
      storageGB: -1,
      computeHours: -1,
      teamMembers: -1,
      webhooks: -1,
      integrations: -1,
    },
    pricing: {
      monthly: 499,
      annual: 4990,
      currency: 'USD',
      overageRates: {
        apiCalls: 0,
        storageGB: 0,
        computeHours: 0,
        agents: 0,
      },
    },
    trialDays: 30,
    isPublic: true,
  },
  custom: {
    tier: 'custom',
    name: 'Custom',
    description: 'Bespoke pricing for unique requirements',
    features: [],
    limits: {
      agents: -1,
      apiCalls: -1,
      storageGB: -1,
      computeHours: -1,
      teamMembers: -1,
      webhooks: -1,
      integrations: -1,
    },
    pricing: {
      monthly: 0,
      annual: 0,
      currency: 'USD',
      overageRates: {
        apiCalls: 0,
        storageGB: 0,
        computeHours: 0,
        agents: 0,
      },
    },
    trialDays: 30,
    isPublic: false,
  },
};

// ============================================================================
// Subscription Service Class
// ============================================================================

export class SubscriptionService {
  private supabase = createClient();

  /**
   * Create a new subscription plan
   */
  async createPlan(planData: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
    const plan: SubscriptionPlan = {
      ...DEFAULT_PLANS[planData.tier || 'basic'],
      ...planData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as SubscriptionPlan;

    const { data, error } = await this.supabase
      .from('subscription_plans')
      .insert(plan)
      .select()
      .single();

    if (error) throw new Error(`Failed to create plan: ${error.message}`);
    return data;
  }

  /**
   * Get all available plans
   */
  async getPlans(options?: { includePrivate?: boolean; tier?: SubscriptionTier }): Promise<SubscriptionPlan[]> {
    let query = this.supabase.from('subscription_plans').select('*');
    
    if (!options?.includePrivate) {
      query = query.eq('is_public', true);
    }
    
    if (options?.tier) {
      query = query.eq('tier', options.tier);
    }

    const { data, error } = await query.order('pricing_monthly', { ascending: true });
    
    if (error) throw new Error(`Failed to fetch plans: ${error.message}`);
    return data || [];
  }

  /**
   * Create a new subscription
   */
  async createSubscription(params: {
    customerId: string;
    planId: string;
    interval: BillingInterval;
    trialDays?: number;
    discounts?: AppliedDiscount[];
    metadata?: Record<string, unknown>;
  }): Promise<Subscription> {
    const { customerId, planId, interval, trialDays, discounts = [], metadata = {} } = params;

    // Fetch plan details
    const { data: plan } = await this.supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (!plan) throw new Error('Plan not found');

    // Calculate dates
    const now = new Date();
    const effectiveTrialDays = trialDays ?? plan.trial_days ?? 0;
    
    let trialStart: Date | undefined;
    let trialEnd: Date | undefined;
    let currentPeriodStart = now;
    let currentPeriodEnd: Date;

    if (effectiveTrialDays > 0) {
      trialStart = now;
      trialEnd = new Date(now.getTime() + effectiveTrialDays * 24 * 60 * 60 * 1000);
      currentPeriodStart = trialEnd;
    }

    // Calculate period end based on interval
    currentPeriodEnd = this.calculatePeriodEnd(currentPeriodStart, interval);

    const subscription: Subscription = {
      id: crypto.randomUUID(),
      customerId,
      planId,
      tier: plan.tier,
      status: effectiveTrialDays > 0 ? 'trialing' : 'active',
      interval,
      currentPeriodStart,
      currentPeriodEnd,
      trialStart,
      trialEnd,
      cancelAtPeriodEnd: false,
      usage: {
        apiCalls: 0,
        storageGB: 0,
        computeHours: 0,
        agents: 0,
        lastUpdated: now,
      },
      discounts,
      metadata,
      createdAt: now,
      updatedAt: now,
    };

    const { data, error } = await this.supabase
      .from('subscriptions')
      .insert(subscription)
      .select()
      .single();

    if (error) throw new Error(`Failed to create subscription: ${error.message}`);

    // Trigger webhook for subscription created
    await this.emitEvent('subscription.created', data);

    return data;
  }

  /**
   * Calculate the end of a billing period
   */
  private calculatePeriodEnd(start: Date, interval: BillingInterval): Date {
    const end = new Date(start);
    switch (interval) {
      case 'monthly':
        end.setMonth(end.getMonth() + 1);
        break;
      case 'quarterly':
        end.setMonth(end.getMonth() + 3);
        break;
      case 'annual':
        end.setFullYear(end.getFullYear() + 1);
        break;
    }
    return end;
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(id: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*, plan:plan_id(*)')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Get active subscription for customer
   */
  async getCustomerSubscription(customerId: string): Promise<Subscription | null> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*, plan:plan_id(*)')
      .eq('customer_id', customerId)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Update subscription plan (upgrade/downgrade)
   */
  async changePlan(subscriptionId: string, newPlanId: string, options?: {
    prorate?: boolean;
    immediate?: boolean;
  }): Promise<Subscription> {
    const { prorate = true, immediate = false } = options || {};

    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) throw new Error('Subscription not found');

    const { data: newPlan } = await this.supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', newPlanId)
      .single();

    if (!newPlan) throw new Error('New plan not found');

    const updates: Partial<Subscription> = {
      planId: newPlanId,
      tier: newPlan.tier,
      updatedAt: new Date(),
    };

    if (immediate) {
      // Immediate change - reset period
      updates.currentPeriodStart = new Date();
      updates.currentPeriodEnd = this.calculatePeriodEnd(
        updates.currentPeriodStart,
        subscription.interval
      );
    }

    const { data, error } = await this.supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) throw new Error(`Failed to change plan: ${error.message}`);

    // Create invoice for proration if needed
    if (prorate && immediate) {
      await this.createProrationInvoice(subscription, newPlan);
    }

    await this.emitEvent('subscription.plan_changed', data);
    return data;
  }

  /**
   * Change billing interval
   */
  async changeInterval(subscriptionId: string, newInterval: BillingInterval): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) throw new Error('Subscription not found');

    const newPeriodEnd = this.calculatePeriodEnd(subscription.currentPeriodStart, newInterval);

    const { data, error } = await this.supabase
      .from('subscriptions')
      .update({
        interval: newInterval,
        currentPeriodEnd: newPeriodEnd,
        updatedAt: new Date(),
      })
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) throw new Error(`Failed to change interval: ${error.message}`);

    await this.emitEvent('subscription.interval_changed', data);
    return data;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string, 
    options?: { atPeriodEnd?: boolean; reason?: string }
  ): Promise<Subscription> {
    const { atPeriodEnd = true, reason } = options || {};

    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) throw new Error('Subscription not found');

    const updates: Partial<Subscription> = {
      cancelAtPeriodEnd: atPeriodEnd,
      updatedAt: new Date(),
      metadata: {
        ...subscription.metadata,
        cancellationReason: reason,
      },
    };

    if (!atPeriodEnd) {
      updates.status = 'canceled';
      updates.canceledAt = new Date();
      updates.endedAt = new Date();
    }

    const { data, error } = await this.supabase
      .from('subscriptions')
      .update(updates)
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) throw new Error(`Failed to cancel subscription: ${error.message}`);

    await this.emitEvent(atPeriodEnd ? 'subscription.scheduled_for_cancellation' : 'subscription.canceled', data);
    return data;
  }

  /**
   * Record usage for a subscription
   */
  async recordUsage(subscriptionId: string, usage: Partial<UsageMetrics>): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) throw new Error('Subscription not found');

    const newUsage: UsageMetrics = {
      ...subscription.usage,
      ...usage,
      lastUpdated: new Date(),
    };

    const { error } = await this.supabase
      .from('subscriptions')
      .update({ usage: newUsage })
      .eq('id', subscriptionId);

    if (error) throw new Error(`Failed to record usage: ${error.message}`);
  }

  /**
   * Calculate overage charges for a subscription
   */
  async calculateOverages(subscriptionId: string): Promise<{
    apiCalls: number;
    storageGB: number;
    computeHours: number;
    agents: number;
    total: number;
  }> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) throw new Error('Subscription not found');

    const { data: plan } = await this.supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', subscription.planId)
      .single();

    if (!plan) throw new Error('Plan not found');

    const usage = subscription.usage;
    const limits = plan.limits;
    const rates = plan.pricing.overage_rates;

    const overages = {
      apiCalls: limits.apiCalls > 0 && usage.apiCalls > limits.apiCalls
        ? Math.ceil((usage.apiCalls - limits.apiCalls) / 1000) * rates.api_calls
        : 0,
      storageGB: limits.storage_gb > 0 && usage.storageGB > limits.storage_gb
        ? (usage.storageGB - limits.storage_gb) * rates.storage_gb
        : 0,
      computeHours: limits.compute_hours > 0 && usage.computeHours > limits.compute_hours
        ? (usage.computeHours - limits.compute_hours) * rates.compute_hours
        : 0,
      agents: limits.agents > 0 && usage.agents > limits.agents
        ? (usage.agents - limits.agents) * rates.agents
        : 0,
    };

    return {
      ...overages,
      total: Object.values(overages).reduce((a, b) => a + b, 0),
    };
  }

  /**
   * Renew a subscription for the next period
   */
  async renewSubscription(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) throw new Error('Subscription not found');

    if (subscription.status === 'canceled' || subscription.cancelAtPeriodEnd) {
      throw new Error('Cannot renew canceled subscription');
    }

    const now = new Date();
    const newPeriodStart = subscription.currentPeriodEnd;
    const newPeriodEnd = this.calculatePeriodEnd(newPeriodStart, subscription.interval);

    const { data, error } = await this.supabase
      .from('subscriptions')
      .update({
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        status: 'active',
        usage: {
          apiCalls: 0,
          storageGB: 0,
          computeHours: 0,
          agents: 0,
          lastUpdated: now,
        },
        updatedAt: now,
      })
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) throw new Error(`Failed to renew subscription: ${error.message}`);

    await this.emitEvent('subscription.renewed', data);
    return data;
  }

  /**
   * Pause a subscription
   */
  async pauseSubscription(subscriptionId: string, resumeDate?: Date): Promise<Subscription> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .update({
        status: 'paused',
        metadata: { resumeDate: resumeDate?.toISOString() },
        updatedAt: new Date(),
      })
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) throw new Error(`Failed to pause subscription: ${error.message}`);

    await this.emitEvent('subscription.paused', data);
    return data;
  }

  /**
   * Resume a paused subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .update({
        status: 'active',
        metadata: {},
        updatedAt: new Date(),
      })
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) throw new Error(`Failed to resume subscription: ${error.message}`);

    await this.emitEvent('subscription.resumed', data);
    return data;
  }

  /**
   * Apply discount/coupon to subscription
   */
  async applyDiscount(subscriptionId: string, discount: AppliedDiscount): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) throw new Error('Subscription not found');

    const discounts = [...subscription.discounts, discount];

    const { data, error } = await this.supabase
      .from('subscriptions')
      .update({ discounts, updatedAt: new Date() })
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) throw new Error(`Failed to apply discount: ${error.message}`);
    return data;
  }

  /**
   * Calculate subscription price with discounts
   */
  calculatePrice(subscription: Subscription, plan: SubscriptionPlan): {
    base: number;
    discount: number;
    total: number;
  } {
    const basePrice = plan.pricing[subscription.interval];
    let discountAmount = 0;

    for (const discount of subscription.discounts) {
      if (discount.duration === 'once' && subscription.currentPeriodStart > subscription.createdAt) {
        continue; // One-time discount already used
      }

      if (discount.duration === 'repeating' && discount.durationInMonths) {
        const monthsUsed = Math.floor(
          (Date.now() - subscription.createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000)
        );
        if (monthsUsed >= discount.durationInMonths) continue;
      }

      if (discount.type === 'percentage') {
        discountAmount += basePrice * (discount.value / 100);
      } else {
        discountAmount += discount.value;
      }
    }

    return {
      base: basePrice,
      discount: Math.min(discountAmount, basePrice),
      total: Math.max(basePrice - discountAmount, 0),
    };
  }

  /**
   * Create proration invoice for plan changes
   */
  private async createProrationInvoice(
    oldSubscription: Subscription,
    newPlan: SubscriptionPlan
  ): Promise<void> {
    // Implementation would create an invoice for the difference
    // This is a placeholder - actual implementation would integrate with invoicing service
    console.log('Creating proration invoice for plan change', {
      oldPlan: oldSubscription.planId,
      newPlan: newPlan.id,
    });
  }

  /**
   * Emit webhook event
   */
  private async emitEvent(event: string, data: unknown): Promise<void> {
    // Implementation would emit to webhook system
    console.log(`Event: ${event}`, data);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getFeatureValue(features: PlanFeature[], name: string): PlanFeature | undefined {
  return features.find(f => f.name === name);
}

export function isFeatureEnabled(features: PlanFeature[], name: string): boolean {
  const feature = getFeatureValue(features, name);
  return feature?.included ?? false;
}

export function getPlanLimit(plan: SubscriptionPlan, metric: keyof UsageMetrics): number {
  return plan.limits[metric] ?? 0;
}

export function checkLimitExceeded(
  usage: UsageMetrics, 
  limits: SubscriptionPlan['limits'], 
  metric: keyof UsageMetrics
): boolean {
  const limit = limits[metric];
  if (limit === -1) return false; // Unlimited
  return usage[metric] > limit;
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const subscriptionService = new SubscriptionService();
