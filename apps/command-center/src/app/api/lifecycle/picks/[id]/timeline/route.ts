'use server';

import { NextRequest, NextResponse } from 'next/server';

import { deriveLifecycleStage, buildTimeline, type LifecycleStage } from '@/lib/lifecycleDisplay';
import { createClient } from '@/lib/supabase';

/**
 * LIFECYCLE TIMELINE API
 * Sprint: COMMAND-CENTER-LIFECYCLE-OPS-039
 *
 * READ-ONLY endpoint for fetching detailed timeline for a single pick.
 * Uses existing buildTimeline utility from lifecycleDisplay.
 */

interface TimelineEvent {
  stage: LifecycleStage;
  timestamp: string;
  label: string;
  reason?: string;
}

interface TimelineResponse {
  pickId: string;
  currentStage: LifecycleStage;
  events: TimelineEvent[];
  blockedReason?: string;
  failedReason?: string;
}

interface PickRecord {
  id: string;
  workflow_stage: string | null;
  promotion_status: string | null;
  settlement_status: string | null;
  posted_to_discord: boolean | null;
  discord_message_id: string | null;
  blocked_reason: string | null;
  failed_reason: string | null;
  created_at: string | null;
  placed_at: string | null;
  promotion_queued_at: string | null;
  promotion_posted_at: string | null;
  settled_at: string | null;
  blocked_at: string | null;
  failed_at: string | null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // Fetch the pick with all lifecycle-relevant timestamps
    // Note: freeze_enforced_at removed (not in production schema)
    const { data, error: pickError } = await supabase
      .from('unified_picks')
      .select(
        `
        id,
        workflow_stage,
        promotion_status,
        settlement_status,
        posted_to_discord,
        discord_message_id,
        blocked_reason,
        failed_reason,
        created_at,
        placed_at,
        promotion_queued_at,
        promotion_posted_at,
        settled_at,
        blocked_at,
        failed_at
      `
      )
      .eq('id', id)
      .single();

    const pick = data as PickRecord | null;

    if (pickError) {
      if (pickError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Pick not found' }, { status: 404 });
      }
      console.error('Error fetching pick for timeline:', pickError);
      return NextResponse.json({ error: pickError.message }, { status: 500 });
    }

    if (!pick) {
      return NextResponse.json({ error: 'Pick not found' }, { status: 404 });
    }

    // Derive current lifecycle stage
    // Note: using workflow_stage as status (production schema)
    const currentStage = deriveLifecycleStage({
      status: pick.workflow_stage,
      promotion_status: pick.promotion_status,
      settlement_status: pick.settlement_status,
      posted_to_discord: pick.posted_to_discord,
      discord_message_id: pick.discord_message_id,
      blocked_reason: pick.blocked_reason,
      failed_reason: pick.failed_reason,
    });

    // Build timeline using existing utility
    const baseTimeline = buildTimeline({
      created_at: pick.created_at,
      placed_at: pick.placed_at,
      promotion_queued_at: pick.promotion_queued_at,
      promotion_posted_at: pick.promotion_posted_at,
      settled_at: pick.settled_at,
      blocked_at: pick.blocked_at,
      failed_at: pick.failed_at,
    });

    // Enhance timeline with reason codes for BLOCKED/FAILED
    const enhancedTimeline: TimelineEvent[] = baseTimeline.map(event => {
      const enhanced: TimelineEvent = {
        stage: event.stage,
        timestamp: event.timestamp,
        label: event.label,
      };

      if (event.stage === 'BLOCKED' && pick.blocked_reason) {
        enhanced.reason = pick.blocked_reason;
      }
      if (event.stage === 'FAILED' && pick.failed_reason) {
        enhanced.reason = pick.failed_reason;
      }

      return enhanced;
    });

    const response: TimelineResponse = {
      pickId: id,
      currentStage,
      events: enhancedTimeline,
      blockedReason: pick.blocked_reason || undefined,
      failedReason: pick.failed_reason || undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Timeline API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
