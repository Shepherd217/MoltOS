/**
 * Cost Projection API
 * GET: Get cost projections based on usage patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateCostProjection, getUsageSummary, getPricingForAction } from '@/lib/payments/micropayments';

// Helper to get pricing for an action (re-export from micropayments)
function getPricingForAction(action: string) {
  const pricing: Record<string, { unitCost: number; unit: string; model: string }> = {
    api_call: { unitCost: 0.001, unit: 'call', model: 'per_call' },
    token_input: { unitCost: 0.0001, unit: 'token', model: 'per_token' },
    token_output: { unitCost: 0.0002, unit: 'token', model: 'per_token' },
    compute_second: { unitCost: 0.000167, unit: 'second', model: 'per_second' },
    task_completed: { unitCost: 0.05, unit: 'task', model: 'outcome_based' },
    task_failed: { unitCost: 0.005, unit: 'task', model: 'outcome_based' },
    storage_gb: { unitCost: 0.023, unit: 'gb', model: 'per_second' },
    bandwidth_gb: { unitCost: 0.09, unit: 'gb', model: 'per_call' },
    websocket_connection: { unitCost: 0.0001, unit: 'minute', model: 'per_second' },
  };
  return pricing[action];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required', code: 'MISSING_USER_ID' },
        { status: 400 }
      );
    }
    
    const projection = await calculateCostProjection(userId);
    
    // Get current month's usage so far
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const summary = await getUsageSummary(userId, monthStart, now);
    
    return NextResponse.json({
      success: true,
      projection: {
        currentMonth: {
          spentSoFar: Math.round(summary.totalCost * 10000) / 10000,
          estimatedTotal: projection.currentMonthEstimate,
          remainingDays: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate(),
        },
        nextMonth: {
          estimated: projection.nextMonthEstimate,
        },
        trends: {
          dailyAverage: projection.dailyAverage,
          direction: projection.trend,
          confidence: projection.confidence,
        },
        breakdown: {
          byAction: summary.actionBreakdown,
          byAgent: summary.agentBreakdown,
        },
      },
    });
    
  } catch (error: any) {
    console.error('[Cost Projection API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate projection', code: 'PROJECTION_ERROR' },
      { status: 500 }
    );
  }
}