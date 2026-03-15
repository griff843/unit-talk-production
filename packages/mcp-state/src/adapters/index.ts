/**
 * @unit-talk/mcp-state — adapters
 *
 * Direct Supabase queries for pick lifecycle state.
 * READ-ONLY — no writes. All writes go through lifecycle adapters in apps/api.
 */

import { createClient } from '@supabase/supabase-js';

import type {
  McpStateConfig,
  PickDetail,
  PickLifecycleStage,
  PickSummary,
  QueryPicksResult,
  SettlementQueryResult,
  SettlementRecord,
} from '../schemas/index.js';

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface DbPickRow {
  id: string;
  bet_slip_id: string | null;
  leg_index: number | null;
  status: string;
  promotion_status: string;
  promotion_band: string | null;
  settlement_status: string;
  settlement_result: string | null;
  posted_to_discord: boolean;
  discord_message_id: string | null;
  settlement_frozen: boolean | null;
  blocked_reason: string | null;
  failed_reason: string | null;
  created_at: string;
  placed_at: string | null;
  promotion_queued_at: string | null;
  promotion_posted_at: string | null;
  settled_at: string | null;
  meta: Record<string, unknown> | null;
  promoted_to_final: boolean | null;
  promoted_final_at: string | null;
  message_id: string | null;
  posted_at: string | null;
}

interface DbSettlementRow {
  id: string;
  pick_id: string;
  settlement_result: 'win' | 'loss' | 'push' | null;
  settlement_status: string;
  settled_at: string | null;
  provider: string | null;
  raw_result: Record<string, unknown> | null;
  created_at: string;
}

// ─── Stage derivation ─────────────────────────────────────────────────────────
//
// CANONICAL SOURCE: apps/api/src/lib/lifecycle/transition-validator.ts
//   deriveLifecycleStage() — keep this function in exact parity.
//
// Stage output must be one of the canonical LifecycleStage values:
//   DRAFT | SUBMITTED | QUEUED | POSTED | SETTLING | SETTLED |
//   BLOCKED | FAILED | CANCELLED | DISPUTED | VOID
//
// Field checks mirror the canonical logic exactly:
//   - BLOCKED: blocked_reason field (not status === 'blocked')
//   - FAILED:  failed_reason field (not status === 'failed')
//   - POSTED:  requires BOTH posted_to_discord AND discord_message_id
//   - No non-canonical stages: SETTLEMENT_FROZEN, APPROVED, REJECTED, UNKNOWN are forbidden.

function deriveStage(
  row: Pick<
    DbPickRow,
    | 'status'
    | 'promotion_status'
    | 'settlement_status'
    | 'posted_to_discord'
    | 'discord_message_id'
    | 'blocked_reason'
    | 'failed_reason'
  >
): string {
  // Terminal states (canonical order)
  if (row.status === 'cancelled') return 'CANCELLED';
  if (row.settlement_status === 'void') return 'VOID';
  if (row.settlement_status === 'disputed') return 'DISPUTED';
  if (row.settlement_status === 'settled') return 'SETTLED';
  // Blocked: checked via reason field, not status field
  if (row.blocked_reason) return 'BLOCKED';
  // Failed: checked via reason field, not status field
  if (row.failed_reason) return 'FAILED';
  // Posted: requires Discord delivery confirmation (both flag AND message ID)
  if (row.posted_to_discord && row.discord_message_id) return 'POSTED';
  // Queued for promotion
  if (row.promotion_status === 'queued') return 'QUEUED';
  // Default
  return 'SUBMITTED';
}

// ─── Query functions ──────────────────────────────────────────────────────────

export async function queryPicks(
  config: McpStateConfig,
  opts: {
    status?: string;
    promotion_band?: string;
    date?: string;
    limit?: number;
    posted_to_discord?: boolean;
  }
): Promise<QueryPicksResult> {
  const supabase = createClient(config.supabaseUrl, config.supabaseKey);
  const now = new Date();

  // Build filter chain before limit/order to keep filter methods available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from('unified_picks')
    .select(
      'id, bet_slip_id, status, promotion_status, promotion_band, settlement_status, settlement_result, posted_to_discord, created_at, placed_at, settled_at, meta'
    );

  if (opts.status !== undefined) q = q.eq('status', opts.status);
  if (opts.promotion_band !== undefined) q = q.eq('promotion_band', opts.promotion_band);
  if (opts.posted_to_discord !== undefined) q = q.eq('posted_to_discord', opts.posted_to_discord);
  if (opts.date !== undefined) {
    q = q.gte('created_at', `${opts.date}T00:00:00Z`).lt('created_at', `${opts.date}T24:00:00Z`);
  }

  q = q.order('created_at', { ascending: false }).limit(opts.limit ?? 50);

  const { data, error } = (await q) as {
    data: DbPickRow[] | null;
    error: { message: string } | null;
  };
  if (error) throw new Error(`Supabase query failed: ${error.message}`);

  const picks: PickSummary[] = (data ?? []).map(row => ({
    id: row.id,
    bet_slip_id: row.bet_slip_id,
    status: row.status,
    promotion_status: row.promotion_status,
    promotion_band: row.promotion_band,
    settlement_status: row.settlement_status,
    settlement_result: row.settlement_result,
    posted_to_discord: row.posted_to_discord,
    created_at: row.created_at,
    placed_at: row.placed_at,
    settled_at: row.settled_at,
    meta: row.meta,
  }));

  return { picks, total: picks.length, queried_at: now.toISOString() };
}

export async function getPick(config: McpStateConfig, id: string): Promise<PickDetail | null> {
  const supabase = createClient(config.supabaseUrl, config.supabaseKey);

  const { data: rawData, error } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(`Supabase query failed: ${error.message}`);
  }
  if (!rawData) return null;
  const data = rawData as DbPickRow;

  return {
    id: data.id,
    bet_slip_id: data.bet_slip_id,
    leg_index: data.leg_index,
    derived_stage: deriveStage(data),
    status: data.status,
    promotion_status: data.promotion_status,
    settlement_status: data.settlement_status,
    settlement_result: data.settlement_result,
    posted_to_discord: data.posted_to_discord,
    discord_message_id: data.discord_message_id,
    settlement_frozen: data.settlement_frozen,
    blocked_reason: data.blocked_reason,
    failed_reason: data.failed_reason,
    created_at: data.created_at,
    placed_at: data.placed_at,
    promotion_queued_at: data.promotion_queued_at,
    promotion_posted_at: data.promotion_posted_at,
    settled_at: data.settled_at,
    meta: data.meta,
    promoted_to_final: data.promoted_to_final,
    promoted_final_at: data.promoted_final_at,
    message_id: data.message_id,
    posted_at: data.posted_at,
  };
}

export async function getLifecycleStage(
  config: McpStateConfig,
  id: string
): Promise<PickLifecycleStage | null> {
  const supabase = createClient(config.supabaseUrl, config.supabaseKey);

  const { data: rawData, error } = await supabase
    .from('unified_picks')
    .select(
      'id, status, promotion_status, settlement_status, posted_to_discord, discord_message_id, settlement_result, settlement_frozen, blocked_reason, failed_reason, created_at, placed_at, promotion_queued_at, promotion_posted_at, settled_at'
    )
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Supabase query failed: ${error.message}`);
  }
  if (!rawData) return null;
  const data = rawData as DbPickRow;

  return {
    id: data.id,
    derived_stage: deriveStage(data),
    status: data.status,
    promotion_status: data.promotion_status,
    settlement_status: data.settlement_status,
    posted_to_discord: data.posted_to_discord,
    discord_message_id: data.discord_message_id,
    settlement_result: data.settlement_result,
    settlement_frozen: data.settlement_frozen,
    blocked_reason: data.blocked_reason,
    failed_reason: data.failed_reason,
    created_at: data.created_at,
    placed_at: data.placed_at,
    promotion_queued_at: data.promotion_queued_at,
    promotion_posted_at: data.promotion_posted_at,
    settled_at: data.settled_at,
  };
}

export async function getSettlementRecords(
  config: McpStateConfig,
  opts: { pick_id?: string; date?: string; limit?: number }
): Promise<SettlementQueryResult> {
  const supabase = createClient(config.supabaseUrl, config.supabaseKey);
  const now = new Date();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from('prop_settlements')
    .select(
      'id, pick_id, settlement_result, settlement_status, settled_at, provider, raw_result, created_at'
    );

  if (opts.pick_id !== undefined) q = q.eq('pick_id', opts.pick_id);
  if (opts.date !== undefined) {
    q = q.gte('settled_at', `${opts.date}T00:00:00Z`).lt('settled_at', `${opts.date}T24:00:00Z`);
  }

  q = q.order('settled_at', { ascending: false }).limit(opts.limit ?? 20);

  const { data, error } = (await q) as {
    data: DbSettlementRow[] | null;
    error: { message: string } | null;
  };
  if (error) throw new Error(`Supabase query failed: ${error.message}`);

  const records: SettlementRecord[] = (data ?? []).map(row => ({
    id: row.id,
    pick_id: row.pick_id,
    settlement_result: row.settlement_result,
    settlement_status: row.settlement_status,
    settled_at: row.settled_at,
    provider: row.provider,
    raw_result: row.raw_result,
    created_at: row.created_at,
  }));

  return { records, total: records.length, queried_at: now.toISOString() };
}
