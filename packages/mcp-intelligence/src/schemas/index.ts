/**
 * @unit-talk/mcp-intelligence — schemas
 */

import { z } from 'zod';

// ─── Tool input schemas ───────────────────────────────────────────────────────

export const ComputeClvInput = z.object({
  book_offers: z
    .array(
      z.object({
        odds: z.number().describe('American odds (e.g. -110, +150)'),
        book_profile: z.enum(['retail', 'market_maker', 'sharp']).optional().default('retail'),
        liquidity_tier: z.enum(['low', 'medium', 'high']).optional().default('medium'),
        data_quality: z.enum(['good', 'partial', 'suspect']).optional().default('good'),
      })
    )
    .min(2)
    .describe('At least 2 book offers required for consensus'),
  devig_method: z
    .enum(['proportional', 'shin', 'power'])
    .optional()
    .default('proportional')
    .describe('Devigging method'),
  closing_odds: z.number().optional().describe('Closing line American odds (for CLV computation)'),
});

export const ComputeCalibrationInput = z.object({
  predictions: z
    .array(
      z.object({
        predicted_prob: z.number().min(0).max(1).describe('Model predicted probability (0-1)'),
        actual_outcome: z
          .number()
          .min(0)
          .max(1)
          .describe('Actual outcome: 1=win, 0=loss, 0.5=push'),
      })
    )
    .min(10)
    .describe('At least 10 predictions required for meaningful calibration'),
  bucket_width: z
    .number()
    .min(0.05)
    .max(0.25)
    .optional()
    .default(0.1)
    .describe('Width of reliability diagram buckets'),
});

export const GetRiskMetricsInput = z.object({});

export const GetShadowDivergenceInput = z.object({
  window_days: z
    .number()
    .min(1)
    .max(90)
    .optional()
    .default(7)
    .describe('Number of days to analyze for shadow scoring divergence'),
});

export const RunStrategySimInput = z.object({
  strategy: z
    .enum(['flat-unit', 'flat-unit-friction', 'kelly-025', 'kelly-010'])
    .describe('Strategy name'),
  date_range: z
    .string()
    .optional()
    .describe('Date range in YYYY-MM-DD:YYYY-MM-DD format (uses demo fixture if omitted)'),
});

// ─── Output types ─────────────────────────────────────────────────────────────

export interface ClvResult {
  consensus_fair_prob: number;
  consensus_fair_odds: number;
  edge_pct: number;
  edge_positive: boolean;
  clv_estimate: number | null;
  model_version: string;
  computed_at: string;
}

export interface CalibrationResult {
  brier_score: number;
  log_loss: number;
  ece: number;
  mce: number;
  n_predictions: number;
  status: 'CALIBRATED' | 'DRIFT' | 'MISCALIBRATED';
  computed_at: string;
}

export interface ShadowDivergenceResult {
  window_days: number;
  total_runs: number;
  divergent_runs: number;
  divergence_rate_pct: number;
  queried_at: string;
}

export type McpIntelligenceConfig = {
  supabaseUrl: string;
  supabaseKey: string;
  apiBaseUrl: string;
};
