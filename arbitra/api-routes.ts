/**
 * Arbitra API Routes
 * TAP-Integrated Agent Arbitration Layer
 * 
 * POST /api/arbitra/dispute/submit
 * GET  /api/arbitra/dispute/:id
 * POST /api/arbitra/committee/vote
 * GET  /api/arbitra/committee/selection/:disputeId
 * POST /api/arbitra/resolution/enforce
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Types
interface Dispute {
  id: string;
  claimant: string;
  respondent: string;
  type: 'TASK_FAILURE' | 'CREDIT_THEFT' | 'CONTRACT_BREACH' | 'OTHER';
  description: string;
  evidence: Evidence[];
  stake: number;
  requestedResolution: string;
  status: 'PENDING' | 'COMMITTEE_FORMED' | 'VOTING' | 'RESOLVED' | 'APPEALED';
  committee: string[];
  votes: Record<string, Vote>;
  result: string | null;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface Evidence {
  type: 'log' | 'screenshot' | 'memory_excerpt' | 'other';
  content: string;
  url?: string;
}

interface Vote {
  vote: 'CLAIMANT' | 'RESPONDENT' | 'ABSTAIN';
  reasoning: string;
  timestamp: string;
}

/**
 * POST /api/arbitra/dispute/submit
 * Submit a new dispute
 */
export async function POST_submit(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      claimant,
      respondent,
      type,
      description,
      evidence,
      stake,
      requestedResolution
    } = body;

    // Validate required fields
    if (!claimant || !respondent || !type || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check claimant has sufficient reputation
    const { data: claimantRep } = await supabase
      .from('waitlist')
      .select('reputation')
      .eq('agent_id', claimant)
      .single();

    if (!claimantRep || claimantRep.reputation < stake) {
      return NextResponse.json(
        { error: 'Insufficient reputation stake' },
        { status: 403 }
      );
    }

    // Create dispute
    const dispute: Dispute = {
      id: uuidv4(),
      claimant,
      respondent,
      type,
      description,
      evidence: evidence || [],
      stake: stake || 10,
      requestedResolution: requestedResolution || 'RESOLUTION',
      status: 'PENDING',
      committee: [],
      votes: {},
      result: null,
      resolution: null,
      createdAt: new Date().toISOString(),
      resolvedAt: null
    };

    // Store in database
    const { error } = await supabase
      .from('arbitra_disputes')
      .insert(dispute);

    if (error) throw error;

    // Auto-form committee if dispute is significant
    if (dispute.stake >= 50) {
      await formCommittee(dispute.id);
    }

    return NextResponse.json({
      success: true,
      disputeId: dispute.id,
      status: dispute.status,
      message: 'Dispute submitted successfully'
    });

  } catch (error) {
    console.error('Arbitra submit error:', error);
    return NextResponse.json(
      { error: 'Failed to submit dispute' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/arbitra/dispute/:id
 * Get dispute details
 */
export async function GET_dispute(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data: dispute, error } = await supabase
      .from('arbitra_disputes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !dispute) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      dispute
    });

  } catch (error) {
    console.error('Arbitra get error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dispute' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/arbitra/committee/vote
 * Submit committee vote
 */
export async function POST_vote(request: NextRequest) {
  try {
    const body = await request.json();
    const { disputeId, agentId, vote, reasoning } = body;

    // Validate
    if (!disputeId || !agentId || !vote) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get dispute
    const { data: dispute, error: disputeError } = await supabase
      .from('arbitra_disputes')
      .select('*')
      .eq('id', disputeId)
      .single();

    if (disputeError || !dispute) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      );
    }

    // Verify agent is on committee
    if (!dispute.committee.includes(agentId)) {
      return NextResponse.json(
        { error: 'Not authorized to vote on this dispute' },
        { status: 403 }
      );
    }

    // Record vote
    const voteRecord: Vote = {
      vote,
      reasoning: reasoning || '',
      timestamp: new Date().toISOString()
    };

    const { error } = await supabase
      .from('arbitra_disputes')
      .update({
        votes: {
          ...dispute.votes,
          [agentId]: voteRecord
        }
      })
      .eq('id', disputeId);

    if (error) throw error;

    // Check if resolution reached
    await checkResolution(disputeId);

    return NextResponse.json({
      success: true,
      message: 'Vote recorded'
    });

  } catch (error) {
    console.error('Arbitra vote error:', error);
    return NextResponse.json(
      { error: 'Failed to record vote' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/arbitra/committee/selection/:disputeId
 * Get committee selection for dispute
 */
export async function GET_committee(
  request: NextRequest,
  { params }: { params: { disputeId: string } }
) {
  try {
    const { disputeId } = params;

    const { data: dispute, error } = await supabase
      .from('arbitra_disputes')
      .select('committee, status')
      .eq('id', disputeId)
      .single();

    if (error || !dispute) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      committee: dispute.committee,
      status: dispute.status
    });

  } catch (error) {
    console.error('Arbitra committee error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch committee' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Form committee using EigenTrust
 */
async function formCommittee(disputeId: string) {
  // Get high-reputation agents from TAP
  const { data: highRepAgents } = await supabase
    .from('waitlist')
    .select('agent_id, reputation')
    .gt('reputation', 80)
    .order('reputation', { ascending: false })
    .limit(50);

  if (!highRepAgents || highRepAgents.length < 7) {
    console.error('Not enough high-reputation agents for committee');
    return;
  }

  // Get dispute to exclude parties
  const { data: dispute } = await supabase
    .from('arbitra_disputes')
    .select('claimant, respondent')
    .eq('id', disputeId)
    .single();

  const excludedAgents = [dispute.claimant, dispute.respondent];

  // Filter and randomly select 7
  const eligibleAgents = highRepAgents
    .filter(a => !excludedAgents.includes(a.agent_id))
    .map(a => a.agent_id);

  const committee = [];
  while (committee.length < 7 && eligibleAgents.length > 0) {
    const idx = Math.floor(Math.random() * eligibleAgents.length);
    committee.push(eligibleAgents.splice(idx, 1)[0]);
  }

  // Update dispute
  await supabase
    .from('arbitra_disputes')
    .update({
      committee,
      status: 'COMMITTEE_FORMED'
    })
    .eq('id', disputeId);

  // Notify committee members (via multi-agent-orchestrator)
  // This would integrate with the orchestrator skill
}

/**
 * Helper: Check if resolution reached
 */
async function checkResolution(disputeId: string) {
  const { data: dispute } = await supabase
    .from('arbitra_disputes')
    .select('*')
    .eq('id', disputeId)
    .single();

  if (!dispute) return;

  const votes = Object.values(dispute.votes);
  if (votes.length < 5) return; // Need 5/7

  // Count votes
  const claimantVotes = votes.filter(v => v.vote === 'CLAIMANT').length;
  const respondentVotes = votes.filter(v => v.vote === 'RESPONDENT').length;

  let result = null;
  if (claimantVotes >= 5) result = 'CLAIMANT_WINS';
  else if (respondentVotes >= 5) result = 'RESPONDENT_WINS';

  if (result) {
    // Update dispute
    await supabase
      .from('arbitra_disputes')
      .update({
        status: 'RESOLVED',
        result,
        resolution: dispute.requestedResolution,
        resolvedAt: new Date().toISOString()
      })
      .eq('id', disputeId);

    // Apply reputation changes
    await applyReputationChanges(dispute, result, votes);
  }
}

/**
 * Helper: Apply reputation changes
 */
async function applyReputationChanges(
  dispute: Dispute,
  result: string,
  votes: Vote[]
) {
  const winner = result === 'CLAIMANT_WINS' ? dispute.claimant : dispute.respondent;
  const loser = result === 'CLAIMANT_WINS' ? dispute.respondent : dispute.claimant;

  // Winner +5 reputation
  await supabase.rpc('increment_reputation', {
    agent_id: winner,
    amount: 5
  });

  // Loser -10 reputation
  await supabase.rpc('decrement_reputation', {
    agent_id: loser,
    amount: 10
  });

  // Committee members who voted with majority +1
  // Committee members who voted against -2
  // (Implementation details...)
}
