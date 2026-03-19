export const dynamic = 'force-dynamic';

/**
 * Crypto Deposit Address API Route
 * 
 * GET: Returns a new crypto deposit address for the specified currency
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCryptoDepositAddress } from '@/lib/earnings/service';
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';

// Helper to get authenticated user
async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Unauthorized - Bearer token required' };
  }

  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON || '',
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: 'Unauthorized - Invalid token' };
  }

  return { user, error: null };
}

// GET /api/user/deposit/crypto-address?currency=BTC
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, 'critical');
  if (rateLimitResult.response) {
    return rateLimitResult.response;
  }

  try {
    // Get authenticated user
    const { user, error: authError } = await getAuthUser(request);
    if (authError || !user) {
      return applySecurityHeaders(NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      ));
    }

    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency') || 'BTC';

    // Validate currency
    const supportedCurrencies = ['BTC', 'ETH', 'USDC', 'USDT'];
    if (!supportedCurrencies.includes(currency)) {
      return applySecurityHeaders(NextResponse.json(
        {
          success: false,
          error: 'Unsupported currency',
          message: `Supported currencies: ${supportedCurrencies.join(', ')}`
        },
        { status: 400 }
      ));
    }

    // Generate deposit address
    const address = await getCryptoDepositAddress(userId, currency);

    return applySecurityHeaders(NextResponse.json({
      success: true,
      address,
    }));

  } catch (error) {
    console.error('Error generating crypto address:', error);
    return applySecurityHeaders(NextResponse.json(
      {
        success: false,
        error: 'Failed to generate deposit address',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    ));
  }
}
