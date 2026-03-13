/**
 * Stripe Customer Portal API
 * POST /api/stripe/portal
 * 
 * Creates a Stripe Customer Portal session for managing subscriptions,
 * payment methods, and viewing invoices.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Lazy-load stripe client to avoid build-time errors
let stripe: Stripe;
function getStripe() {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not defined. Please set it in your environment variables.');
    }
    stripe = new Stripe(key, {
      apiVersion: '2024-04-10',
      typescript: true,
    });
  }
  return stripe;
}

interface PortalRequest {
  userId: string;
  email: string;
  returnUrl?: string;
}

/**
 * POST handler for creating a customer portal session
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: PortalRequest = await request.json();
    const { userId, email, returnUrl } = body;

    // Validate required fields
    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, email', code: 'MISSING_FIELDS' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format', code: 'INVALID_EMAIL' },
        { status: 400 }
      );
    }

    // Get or create customer
    const customer = await getOrCreateCustomer(email, {
      userId,
      source: 'moltos_portal',
    });

    // Create portal session
    const portalSession = await createCustomerPortalSession(
      customer.id,
      returnUrl
    );

    console.log('[Stripe Portal] Created portal session:', {
      customerId: customer.id,
      userId,
    });

    return NextResponse.json({
      success: true,
      url: portalSession.url,
      customerId: customer.id,
    });

  } catch (error) {
    console.error('[Stripe Portal] Error creating portal session:', error);

    if (error instanceof stripe.errors.StripeError) {
      return NextResponse.json(
        { 
          error: error.message, 
          code: error.code || 'STRIPE_ERROR',
          type: error.type
        },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create portal session',
        code: 'PORTAL_ERROR'
      },
      { status: 500 }
    );
  }
}
