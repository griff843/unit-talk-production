'use server';

import { NextRequest, NextResponse } from 'next/server';

import { requireOperatorIdentity } from '@/lib/auth';
import { deriveLifecycleStage, type LifecycleStage } from '@/lib/lifecycleDisplay';
import { createClient } from '@/lib/supabase';

/**
 * STUCK PICKS API
 * Sprint: COMMAND-CENTER-LIFECYCLE-OPS-039
 *
 * READ-ONLY endpoint for detecting stuck picks.
 * Fixed thresholds: 5/15/1440 minutes per sprint constraints.
 */

// Fixed stuck thresholds (in minutes) - non-configurable per sprint constraints
const STUCK_THRESHOLDS = {
  submittedToQueued: 5, // 5 minutes
  queuedToPosted: 15, // 15 minutes
  postedToSettled: 1440, // 24 hours (1440 minutes)
};

interface StuckPick {
  pickId: string;
  stage: LifecycleStage;
  stuckSince: string;
  stuckMinutes: number;
  reason: string;
  capper: string;
  selection: string;
  sport: string;
}

interface StuckSummary {
  total: number;
  byStage: Record<string, number>;
}

// Database record types
interface UserRecord {
  username: string;
}

interface SubmittedPickRecord {
  id: string;
  selection: string | null;
  sport: string | null;
  created_at: string;
  promotion_status: string | null;
  blocked_reason: string | null;
  failed_reason: string | null;
  settlement_status: string | null;
  posted_to_discord: boolean | null;
  discord_message_id: string | null;
  users: UserRecord | UserRecord[] | null;
}

interface QueuedPickRecord {
  id: string;
  selection: string | null;
  sport: string | null;
  promotion_queued_at: string;
  promotion_status: string | null;
  posted_to_discord: boolean | null;
  blocked_reason: string | null;
  failed_reason: string | null;
  users: UserRecord | UserRecord[] | null;
}

interface PostedPickRecord {
  id: string;
  selection: string | null;
  sport: string | null;
  promotion_posted_at: string;
  posted_to_discord: boolean | null;
  settlement_status: string | null;
  blocked_reason: string | null;
  failed_reason: string | null;
  users: UserRecord | UserRecord[] | null;
}

function getUsername(users: UserRecord | UserRecord[] | null): string {
  if (!users) return 'Unknown';
  const user = Array.isArray(users) ? users[0] : users;
  return user?.username || 'Unknown';
}

export async function GET(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const now = new Date();
    const stuckPicks: StuckPick[] = [];

    // Query 1: Picks stuck in SUBMITTED (no promotion_queued_at for > 5 mins)
    const submittedThreshold = new Date(now.getTime() - STUCK_THRESHOLDS.submittedToQueued * 60000);
    const { data: submittedData, error: err1 } = await supabase
      .from('unified_picks')
      .select(
        `
        id,
        selection,
        sport,
        created_at,
        promotion_status,
        blocked_reason,
        failed_reason,
        settlement_status,
        posted_to_discord,
        discord_message_id,
        users!unified_picks_user_id_fkey (username)
      `
      )
      .eq('promotion_status', 'not_promoted')
      .is('blocked_reason', null)
      .is('failed_reason', null)
      .eq('settlement_status', 'pending')
      .lt('created_at', submittedThreshold.toISOString())
      .order('created_at', { ascending: true })
      .limit(50);

    const submittedStuck = submittedData as unknown as SubmittedPickRecord[] | null;

    if (!err1 && submittedStuck) {
      for (const pick of submittedStuck) {
        const stage = deriveLifecycleStage({
          promotion_status: pick.promotion_status || undefined,
          blocked_reason: pick.blocked_reason || undefined,
          failed_reason: pick.failed_reason || undefined,
          settlement_status: pick.settlement_status || undefined,
          posted_to_discord: pick.posted_to_discord || undefined,
          discord_message_id: pick.discord_message_id || undefined,
        });

        if (stage === 'SUBMITTED') {
          const stuckMinutes = Math.floor(
            (now.getTime() - new Date(pick.created_at).getTime()) / 60000
          );
          stuckPicks.push({
            pickId: pick.id,
            stage: 'SUBMITTED',
            stuckSince: pick.created_at,
            stuckMinutes,
            reason: `No transition from SUBMITTED in ${stuckMinutes} minutes (threshold: ${STUCK_THRESHOLDS.submittedToQueued} min)`,
            capper: getUsername(pick.users),
            selection: pick.selection || '',
            sport: pick.sport || 'Unknown',
          });
        }
      }
    }

    // Query 2: Picks stuck in QUEUED (no promotion_posted_at for > 15 mins)
    const queuedThreshold = new Date(now.getTime() - STUCK_THRESHOLDS.queuedToPosted * 60000);
    const { data: queuedData, error: err2 } = await supabase
      .from('unified_picks')
      .select(
        `
        id,
        selection,
        sport,
        promotion_queued_at,
        promotion_status,
        posted_to_discord,
        blocked_reason,
        failed_reason,
        users!unified_picks_user_id_fkey (username)
      `
      )
      .eq('promotion_status', 'queued')
      .eq('posted_to_discord', false)
      .is('blocked_reason', null)
      .is('failed_reason', null)
      .lt('promotion_queued_at', queuedThreshold.toISOString())
      .order('promotion_queued_at', { ascending: true })
      .limit(50);

    const queuedStuck = queuedData as unknown as QueuedPickRecord[] | null;

    if (!err2 && queuedStuck) {
      for (const pick of queuedStuck) {
        const stuckMinutes = Math.floor(
          (now.getTime() - new Date(pick.promotion_queued_at).getTime()) / 60000
        );
        stuckPicks.push({
          pickId: pick.id,
          stage: 'QUEUED',
          stuckSince: pick.promotion_queued_at,
          stuckMinutes,
          reason: `No transition from QUEUED in ${stuckMinutes} minutes (threshold: ${STUCK_THRESHOLDS.queuedToPosted} min)`,
          capper: getUsername(pick.users),
          selection: pick.selection || '',
          sport: pick.sport || 'Unknown',
        });
      }
    }

    // Query 3: Picks stuck in POSTED (no settled_at for > 24 hours)
    const postedThreshold = new Date(now.getTime() - STUCK_THRESHOLDS.postedToSettled * 60000);
    const { data: postedData, error: err3 } = await supabase
      .from('unified_picks')
      .select(
        `
        id,
        selection,
        sport,
        promotion_posted_at,
        posted_to_discord,
        settlement_status,
        blocked_reason,
        failed_reason,
        users!unified_picks_user_id_fkey (username)
      `
      )
      .eq('posted_to_discord', true)
      .eq('settlement_status', 'pending')
      .is('blocked_reason', null)
      .is('failed_reason', null)
      .lt('promotion_posted_at', postedThreshold.toISOString())
      .order('promotion_posted_at', { ascending: true })
      .limit(50);

    const postedStuck = postedData as unknown as PostedPickRecord[] | null;

    if (!err3 && postedStuck) {
      for (const pick of postedStuck) {
        const stuckMinutes = Math.floor(
          (now.getTime() - new Date(pick.promotion_posted_at).getTime()) / 60000
        );
        stuckPicks.push({
          pickId: pick.id,
          stage: 'POSTED',
          stuckSince: pick.promotion_posted_at,
          stuckMinutes,
          reason: `No settlement in ${Math.floor(stuckMinutes / 60)} hours (threshold: ${STUCK_THRESHOLDS.postedToSettled / 60} hours)`,
          capper: getUsername(pick.users),
          selection: pick.selection || '',
          sport: pick.sport || 'Unknown',
        });
      }
    }

    // Sort by stuck duration (longest first)
    stuckPicks.sort((a, b) => b.stuckMinutes - a.stuckMinutes);

    // Calculate summary
    const summary: StuckSummary = {
      total: stuckPicks.length,
      byStage: stuckPicks.reduce(
        (acc, p) => {
          acc[p.stage] = (acc[p.stage] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };

    return NextResponse.json({
      thresholds: STUCK_THRESHOLDS,
      stuckPicks,
      summary,
    });
  } catch (error) {
    console.error('Stuck picks API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
