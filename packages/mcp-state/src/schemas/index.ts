/**
 * @unit-talk/mcp-state — schemas
 *
 * Input schemas (Zod) and output types for pick lifecycle state tools.
 */

import { z } from 'zod';

// ─── Tool input schemas ───────────────────────────────────────────────────────

export const QueryPicksInput = z.object({
  status: z
    .enum(['pending', 'approved', 'rejected', 'posted', 'settled', 'voided', 'blocked', 'failed'])
    .optional()
    .describe('Filter by pick status'),
  promotion_band: z
    .enum(['HARD', 'STRONG', 'MEDIUM', 'LIGHT'])
    .optional()
    .describe('Filter by promotion band'),
  date: z
    .string()
    .optional()
    .describe('Filter by created_at date (YYYY-MM-DD). Returns picks from that day UTC.'),
  limit: z
    .number()
    .min(1)
    .max(200)
    .optional()
    .default(50)
    .describe('Max number of picks to return (default: 50, max: 200)'),
  posted_to_discord: z.boolean().optional().describe('Filter by Discord post status'),
});

export const GetPickInput = z.object({
  id: z.string().uuid().describe('Pick UUID'),
});

export const GetLifecycleStageInput = z.object({
  id: z.string().uuid().describe('Pick UUID'),
});

export const GetSettlementRecordsInput = z.object({
  pick_id: z.string().uuid().optional().describe('Filter by pick UUID'),
  date: z.string().optional().describe('Filter by settled_at date (YYYY-MM-DD)'),
  limit: z.number().min(1).max(100).optional().default(20),
});

export const McpStateConfigSchema = z.object({
  supabaseUrl: z.string(),
  supabaseKey: z.string(),
});

// ─── Output types ─────────────────────────────────────────────────────────────

export interface PickSummary {
  id: string;
  bet_slip_id: string | null;
  status: string;
  promotion_status: string;
  promotion_band: string | null;
  settlement_status: string;
  settlement_result: string | null;
  posted_to_discord: boolean;
  created_at: string;
  placed_at: string | null;
  settled_at: string | null;
  meta: Record<string, unknown> | null;
}

export interface PickLifecycleStage {
  id: string;
  derived_stage: string;
  status: string;
  promotion_status: string;
  settlement_status: string;
  posted_to_discord: boolean;
  discord_message_id: string | null;
  settlement_result: string | null;
  settlement_frozen: boolean | null;
  blocked_reason: string | null;
  failed_reason: string | null;
  created_at: string;
  placed_at: string | null;
  promotion_queued_at: string | null;
  promotion_posted_at: string | null;
  settled_at: string | null;
}

export interface PickDetail extends PickLifecycleStage {
  bet_slip_id: string | null;
  leg_index: number | null;
  meta: Record<string, unknown> | null;
  promoted_to_final: boolean | null;
  promoted_final_at: string | null;
  message_id: string | null;
  posted_at: string | null;
}

export interface SettlementRecord {
  id: string;
  pick_id: string;
  settlement_result: 'win' | 'loss' | 'push' | null;
  settlement_status: string;
  settled_at: string | null;
  provider: string | null;
  raw_result: Record<string, unknown> | null;
  created_at: string;
}

export interface QueryPicksResult {
  picks: PickSummary[];
  total: number;
  queried_at: string;
}

export interface SettlementQueryResult {
  records: SettlementRecord[];
  total: number;
  queried_at: string;
}

export type McpStateConfig = {
  supabaseUrl: string;
  supabaseKey: string;
};
