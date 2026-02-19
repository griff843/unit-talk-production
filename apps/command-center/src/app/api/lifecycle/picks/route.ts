'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import {
  deriveLifecycleStage,
  buildTimeline,
  needsAttention,
  type LifecycleStage,
} from '@/lib/lifecycleDisplay';

/**
 * LIFECYCLE PICKS API
 * Sprint: COMMAND-CENTER-LIFECYCLE-OPS-039
 *
 * READ-ONLY endpoint for fetching picks with lifecycle stage filtering.
 * Supports filters: lifecycle_stage, stuck, blocker_code, failure_code
 */

// Fixed stuck thresholds (in minutes) per sprint constraints
const STUCK_THRESHOLDS = {
  SUBMITTED: 5,    // 5 minutes to get queued
  QUEUED: 15,      // 15 minutes to get posted
  POSTED: 1440,    // 24 hours to get settled
};

interface LifecyclePick {
  id: string;
  lifecycle_stage: LifecycleStage;
  blocked_reason?: string;
  failed_reason?: string;
  stuck_minutes?: number;
  needs_attention: boolean;
  capper: string;
  sport: string;
  selection: string;
  odds: number;
  tier: string;
  confidence: number;
  created_at: string;
  promotion_queued_at?: string;
  promotion_posted_at?: string;
  settled_at?: string;
  blocked_at?: string;
  failed_at?: string;
}

function calculateStuckMinutes(
  stage: LifecycleStage,
  timestamps: {
    created_at?: string;
    promotion_queued_at?: string;
    promotion_posted_at?: string;
  }
): number | undefined {
  const now = Date.now();

  switch (stage) {
    case 'SUBMITTED': {
      if (!timestamps.created_at) return undefined;
      const mins = (now - new Date(timestamps.created_at).getTime()) / 60000;
      return mins > STUCK_THRESHOLDS.SUBMITTED ? Math.floor(mins) : undefined;
    }
    case 'QUEUED': {
      if (!timestamps.promotion_queued_at) return undefined;
      const mins = (now - new Date(timestamps.promotion_queued_at).getTime()) / 60000;
      return mins > STUCK_THRESHOLDS.QUEUED ? Math.floor(mins) : undefined;
    }
    case 'POSTED': {
      if (!timestamps.promotion_posted_at) return undefined;
      const mins = (now - new Date(timestamps.promotion_posted_at).getTime()) / 60000;
      return mins > STUCK_THRESHOLDS.POSTED ? Math.floor(mins) : undefined;
    }
    default:
      return undefined;
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const lifecycleStage = searchParams.get('lifecycle_stage');
    const stuck = searchParams.get('stuck') === 'true';
    const blockerCode = searchParams.get('blocker_code');
    const failureCode = searchParams.get('failure_code');
    const needsAttentionFilter = searchParams.get('needs_attention') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Fetch picks with lifecycle-relevant fields
    const { data: picksData, error: picksError } = await supabase
      .from('unified_picks')
      .select(`
        id,
        user_id,
        selection,
        odds,
        confidence,
        sport,
        tier_when_placed,
        status,
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
        failed_at,
        users!unified_picks_user_id_fkey (
          username,
          capper_tier
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (picksError) {
      console.error('Error fetching lifecycle picks:', picksError);
      return NextResponse.json({ error: picksError.message }, { status: 500 });
    }

    // Transform and filter picks
    let lifecyclePicks: LifecyclePick[] = (picksData || []).map((pick: any) => {
      const user = Array.isArray(pick.users) ? pick.users[0] : pick.users;

      const lifecycleData = {
        status: pick.status,
        promotion_status: pick.promotion_status,
        settlement_status: pick.settlement_status,
        posted_to_discord: pick.posted_to_discord,
        discord_message_id: pick.discord_message_id,
        blocked_reason: pick.blocked_reason,
        failed_reason: pick.failed_reason,
      };

      const stage = deriveLifecycleStage(lifecycleData);
      const stuckMinutes = calculateStuckMinutes(stage, {
        created_at: pick.created_at,
        promotion_queued_at: pick.promotion_queued_at,
        promotion_posted_at: pick.promotion_posted_at,
      });

      return {
        id: pick.id,
        lifecycle_stage: stage,
        blocked_reason: pick.blocked_reason,
        failed_reason: pick.failed_reason,
        stuck_minutes: stuckMinutes,
        needs_attention: needsAttention(lifecycleData),
        capper: user?.username || 'Unknown',
        sport: pick.sport || 'Unknown',
        selection: pick.selection || '',
        odds: pick.odds || 0,
        tier: pick.tier_when_placed || user?.capper_tier || 'C',
        confidence: pick.confidence || 50,
        created_at: pick.created_at,
        promotion_queued_at: pick.promotion_queued_at,
        promotion_posted_at: pick.promotion_posted_at,
        settled_at: pick.settled_at,
        blocked_at: pick.blocked_at,
        failed_at: pick.failed_at,
      };
    });

    // Apply filters
    if (lifecycleStage) {
      const stages = lifecycleStage.split(',') as LifecycleStage[];
      lifecyclePicks = lifecyclePicks.filter(p => stages.includes(p.lifecycle_stage));
    }

    if (stuck) {
      lifecyclePicks = lifecyclePicks.filter(p => p.stuck_minutes !== undefined);
    }

    if (blockerCode) {
      lifecyclePicks = lifecyclePicks.filter(p =>
        p.blocked_reason && p.blocked_reason.includes(blockerCode)
      );
    }

    if (failureCode) {
      lifecyclePicks = lifecyclePicks.filter(p =>
        p.failed_reason && p.failed_reason.includes(failureCode)
      );
    }

    if (needsAttentionFilter) {
      lifecyclePicks = lifecyclePicks.filter(p => p.needs_attention);
    }

    // Calculate summary stats
    const summary = {
      total: lifecyclePicks.length,
      byStage: lifecyclePicks.reduce((acc, p) => {
        acc[p.lifecycle_stage] = (acc[p.lifecycle_stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      stuckCount: lifecyclePicks.filter(p => p.stuck_minutes !== undefined).length,
      needsAttentionCount: lifecyclePicks.filter(p => p.needs_attention).length,
    };

    return NextResponse.json({
      picks: lifecyclePicks,
      summary,
      thresholds: STUCK_THRESHOLDS,
    });
  } catch (error) {
    console.error('Lifecycle picks API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
