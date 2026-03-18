import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert } from '@/lib/database.types'

type Agent = Tables<'agents'>

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { publicKey, agentId } = body
    
    if (!publicKey || !agentId) {
      return NextResponse.json(
        { error: 'Missing publicKey or agentId' },
        { status: 400 }
      )
    }
    
    // Check if agent already exists
    const { data: existing } = await supabase
      .from('agents')
      .select('agent_id')
      .eq('public_key', publicKey)
      .single()
    
    if (existing) {
      // Return existing agent
      const { data: agent } = await supabase
        .from('agents')
        .select('*')
        .eq('public_key', publicKey)
        .single()
      
      if (!agent) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json({
        success: true,
        agent: {
          agent_id: agent.agent_id,
          name: agent.name ?? `Agent ${agentId.slice(0, 8)}`,
          public_key: agent.public_key,
          tier: agent.tier ?? 'Bronze',
          reputation: agent.reputation ?? 0,
          status: agent.status ?? 'active',
        },
      })
    }
    
    // Create new agent with ClawID
    const name = `Agent ${agentId.slice(0, 8)}`
    
    const insertData: TablesInsert<'agents'> = {
      agent_id: agentId,
      public_key: publicKey,
      boot_audit_hash: 'pending', // Required field
      name,
      tier: 'Bronze',
      reputation: 0,
      status: 'active',
    }
    
    const { data: agent, error } = await supabase
      .from('agents')
      .insert(insertData)
      .select()
      .single()
    
    if (error || !agent) {
      console.error('Failed to create agent:', error)
      return NextResponse.json(
        { error: 'Failed to register ClawID' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      agent: {
        agent_id: agent.agent_id,
        name: agent.name ?? name,
        public_key: agent.public_key,
        tier: agent.tier ?? 'Bronze',
        reputation: agent.reputation ?? 0,
        status: agent.status ?? 'active',
      },
    })
  } catch (error) {
    console.error('ClawID registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
