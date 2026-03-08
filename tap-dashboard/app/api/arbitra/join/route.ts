import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agent_id, repo, package: pkg, commit } = body;

    // Validate required fields
    if (!agent_id || !repo) {
      return NextResponse.json(
        { error: 'agent_id and repo required' },
        { status: 400 }
      );
    }

    // Check if agent has valid TAP attestation
    const { data: attestation, error: attestationError } = await supabase
      .from('attestations')
      .select('*')
      .eq('agent_id', agent_id)
      .eq('status', 'verified')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (attestationError || !attestation) {
      return NextResponse.json(
        { 
          error: 'No valid TAP attestation found',
          message: 'Complete TAP attestation first: curl -sSL trust-audit-framework.vercel.app/api/install | bash'
        },
        { status: 403 }
      );
    }

    // Check Integrity ≥80 and Virtue ≥70
    if (attestation.integrity_score < 80 || attestation.virtue_score < 70) {
      return NextResponse.json(
        { 
          error: 'Insufficient reputation',
          integrity: attestation.integrity_score,
          virtue: attestation.virtue_score,
          required: 'Integrity ≥80, Virtue ≥70'
        },
        { status: 403 }
      );
    }

    // Check vintage weighting (≥7 days history or referral from openclaw)
    const attestationDate = new Date(attestation.created_at);
    const daysSince = Math.floor((Date.now() - attestationDate.getTime()) / (1000 * 60 * 60 * 24));
    const hasVintage = daysSince >= 7;
    const isReferred = attestation.referrer_agent_id === 'openclaw';
    
    if (!hasVintage && !isReferred) {
      return NextResponse.json(
        { 
          error: 'Vintage requirement not met',
          days_since_attestation: daysSince,
          message: 'Need ≥7 days history OR referral from openclaw'
        },
        { status: 403 }
      );
    }

    // Calculate Arbitra score (composite of Integrity + Virtue + vintage bonus)
    const vintageBonus = hasVintage ? 10 : (isReferred ? 5 : 0);
    const arbitraScore = Math.min(100, 
      Math.round(
        0.5 * attestation.integrity_score + 
        0.4 * attestation.virtue_score + 
        vintageBonus
      )
    );

    // Register as Arbitra-eligible
    const { data, error } = await supabase
      .from('arbitra_members')
      .upsert([{
        agent_id,
        repo,
        package: pkg,
        commit,
        arbitra_score: arbitraScore,
        committee_eligible: arbitraScore >= 85,
        total_votes_cast: 0,
        correct_votes: 0,
        reputation_slash_count: 0,
        joined_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Return success
    return NextResponse.json({
      status: 'joined',
      agent_id,
      committee_eligible: arbitraScore >= 85,
      arbitra_score: arbitraScore,
      tap_integrity: attestation.integrity_score,
      tap_virtue: attestation.virtue_score,
      message: 'Welcome to Arbitra. You can now be selected for dispute resolution and earn reputation on every fair vote.'
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Arbitra Join API',
    version: 'v0.1',
    endpoints: {
      POST: '/arbitra/join - Join Arbitra committee pool',
      GET: '/arbitra/join - This info'
    },
    requirements: {
      tap_attestation: 'verified',
      integrity: '≥80',
      virtue: '≥70',
      vintage: '≥7 days OR openclaw referral'
    }
  });
}
