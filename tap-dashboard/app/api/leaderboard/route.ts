import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyRateLimit, applySecurityHeaders } from '@/lib/security';

// Lazy initialization of Supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

export async function GET() {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(new Request('http://localhost/api/leaderboard'), 'standard');
  if (rateLimitResult.response) {
    return rateLimitResult.response;
  }
  
  try {
    const { data, error } = await getSupabase()
      .from('agents')
      .select('agent_id, name, reputation, tier')
      .order('reputation', { ascending: false })
      .limit(10);

    if (error) throw error;

    // Format leaderboard data
    const leaderboard = (data || []).map((item: any, index: number) => ({
      agent_id: item.agent_id,
      name: item.name,
      reputation: item.reputation || 0,
      tier: item.tier || 'Bronze',
      position: index + 1,
    }));

    return applySecurityHeaders(NextResponse.json({ agents: leaderboard }));
  } catch (error) {
    console.error('Leaderboard error:', error);
    return applySecurityHeaders(NextResponse.json({ agents: [] }));
  }
}
