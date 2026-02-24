import { NextRequest, NextResponse } from 'next/server';

import type { Json } from '@/types/database';

import { supabase } from '@/lib/supabase';

/**
 * Sync endpoint to pull live data from Unit Talk Production platform
 * SPRINT-DEMO-MODE-REMOVAL: All mock fallbacks removed.
 * Fail-closed: If database unavailable, return explicit error.
 */

// SPRINT-SCHEMA-ENV-GATES-002: Lazy env access
function getUnitTalkProductionUrl(): string {
  return process.env.UNIT_TALK_PRODUCTION_URL || 'http://localhost:3000';
}
function getSyncApiKey(): string {
  return process.env.SYNC_API_KEY || 'dev-sync-key';
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    // Simple API key auth for now
    if (authHeader !== `Bearer ${getSyncApiKey()}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, data } = body;

    console.log(`[CC] Sync request received: ${type}`, data);

    switch (type) {
      case 'user_update':
        await handleUserUpdate(data);
        break;

      case 'pick_created':
        await handlePickCreated(data);
        break;

      case 'agent_status':
        await handleAgentStatus(data);
        break;

      case 'security_event':
        await handleSecurityEvent(data);
        break;

      default:
        console.log(`[CC] Unknown sync type: ${type}`);
        return NextResponse.json({ error: 'Unknown sync type' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Processed ${type}` });
  } catch (error) {
    console.error('[CC] Sync error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') || 'agents';

    console.log(`[CC] Fetching live data from Supabase: ${source}`);

    let data: unknown[] = [];

    switch (source) {
      case 'agents':
        // Check if we have real agent data in production
        const { data: agentData, error: agentError } = await supabase
          .from('agent_health')
          .select('*')
          .limit(10);

        if (agentError) {
          console.error('[CC] Agent sync query failed:', agentError.message);
          return NextResponse.json(
            { success: false, error: `Database query failed: ${agentError.message}` },
            { status: 500 }
          );
        }

        data = agentData || [];
        break;

      case 'users':
        // Check for user data
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, username, tier')
          .limit(10);

        if (userError) {
          console.error('[CC] User sync query failed:', userError.message);
          return NextResponse.json(
            { success: false, error: `Database query failed: ${userError.message}` },
            { status: 500 }
          );
        }

        data = userData || [];
        break;

      case 'picks':
        // Check for picks data from unified_picks table
        const { data: pickData, error: pickError } = await supabase
          .from('unified_picks')
          .select('id, selection, confidence, workflow_stage, created_at')
          .limit(10);

        if (pickError) {
          console.error('[CC] Pick sync query failed:', pickError.message);
          return NextResponse.json(
            { success: false, error: `Database query failed: ${pickError.message}` },
            { status: 500 }
          );
        }

        data = pickData || [];
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown source: ${source}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Connected to database`,
      data: data,
      count: data.length,
      source: 'database',
    });
  } catch (error) {
    console.error('[CC] Sync GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Sync handlers
async function handleUserUpdate(userData: Record<string, unknown>) {
  // Production schema: discord_id, username, tier, capper_tier, role, active, is_active, meta, tenant_id
  const { error } = await supabase.from('users').upsert(
    {
      discord_id: userData.discord_id as string,
      username: userData.username as string,
      tier: userData.tier as string | null,
      capper_tier: userData.capper_tier as string | null,
      active: userData.status === 'active',
      is_active: userData.status === 'active',
      meta: {
        total_picks: userData.total_picks,
        win_rate: userData.win_rate,
        revenue: userData.revenue,
        last_active: userData.last_active,
      } as Json,
      tenant_id: (userData.tenant_id as string) || 'default',
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'discord_id',
    }
  );

  if (error) {
    console.error('[CC] User sync error:', error.message);
    throw new Error(`User sync failed: ${error.message}`);
  }

  console.log(`[CC] User synced: ${userData.username}`);
}

async function handlePickCreated(pickData: Record<string, unknown>) {
  const { error } = await supabase.from('picks').insert({
    user_id: pickData.user_id,
    sport: pickData.sport,
    event: pickData.event,
    pick_type: pickData.pick_type,
    selection: pickData.selection,
    odds: pickData.odds,
    stake: pickData.stake,
    confidence: pickData.confidence,
    status: pickData.status,
  });

  if (error) {
    console.error('[CC] Pick sync error:', error.message);
    throw new Error(`Pick sync failed: ${error.message}`);
  }

  console.log(`[CC] Pick synced: ${pickData.selection}`);
}

async function handleAgentStatus(agentData: Record<string, unknown>) {
  const { error } = await supabase.from('agent_health').upsert(
    {
      agent: agentData.name as string,
      status: agentData.status as string,
      last_heartbeat: (agentData.last_run as string) || new Date().toISOString(),
      details: {
        type: agentData.type,
        success_rate: agentData.success_rate,
        avg_response_time: agentData.avg_response_time,
        total_operations: agentData.total_operations,
        configuration: agentData.configuration,
      },
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'agent',
    }
  );

  if (error) {
    console.error('[CC] Agent sync error:', error.message);
    throw new Error(`Agent sync failed: ${error.message}`);
  }

  console.log(`[CC] Agent synced: ${agentData.name} (${agentData.status})`);
}

async function handleSecurityEvent(eventData: Record<string, unknown>) {
  const { error } = await supabase.from('security_events').insert({
    type: eventData.type,
    severity: eventData.severity,
    description: eventData.description,
    ip_address: eventData.ip_address,
    user_id: eventData.user_id,
    metadata: eventData.metadata,
  });

  if (error) {
    console.error('[CC] Security event sync error:', error.message);
    throw new Error(`Security event sync failed: ${error.message}`);
  }

  console.log(`[CC] Security event synced: ${eventData.type} (${eventData.severity})`);
}
