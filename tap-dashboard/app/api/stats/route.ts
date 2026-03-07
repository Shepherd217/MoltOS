import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Get confirmed agents count
    const { count: confirmedAgents } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true })
      .eq('confirmed', true);

    // Get total signups
    const { count: totalSignups } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    // Get total referrals
    const { data: referrals } = await supabase
      .from('waitlist')
      .select('referral_count');
    
    const totalReferrals = referrals?.reduce((sum, r) => sum + (r.referral_count || 0), 0) || 0;

    return NextResponse.json({
      agents: confirmedAgents || 12,  // Fallback to founding 12
      totalSignups: totalSignups || 12,
      attestations: 66,  // Will be dynamic later
      alpha: 3000,       // Will be dynamic later
      claims: 0,         // Will be dynamic later
      referrals: totalReferrals
    });
  } catch (error) {
    // Return fallback data if error
    return NextResponse.json({
      agents: 12,
      totalSignups: 12,
      attestations: 66,
      alpha: 3000,
      claims: 0,
      referrals: 0
    });
  }
}
