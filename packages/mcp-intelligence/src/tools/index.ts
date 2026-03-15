/**
 * @unit-talk/mcp-intelligence — tool registrations
 *
 * Tools:
 *   compute_clv              — CLV edge computation from book odds
 *   compute_calibration      — Brier/ECE calibration metrics
 *   get_shadow_divergence    — shadow scoring divergence rate
 *   get_risk_metrics         — live portfolio risk from API
 *   run_strategy_simulation  — returns CLI command to run R5 strategy simulation
 */


import {
  computeCalibration,
  computeClv,
  fetchRiskMetrics,
  fetchShadowDivergence,
} from '../adapters/index.js';
import {
  ComputeCalibrationInput,
  ComputeClvInput,
  GetRiskMetricsInput,
  GetShadowDivergenceInput,
  RunStrategySimInput,
} from '../schemas/index.js';

import type { McpIntelligenceConfig } from '../schemas/index.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerIntelligenceTools(server: McpServer, config: McpIntelligenceConfig): void {
  // ── compute_clv ───────────────────────────────────────────────────────────
  server.tool(
    'compute_clv',
    'Compute CLV edge from book odds. Accepts 2+ book offers in American odds format. ' +
      'Returns consensus fair probability, edge%, and CLV estimate if closing_odds provided.',
    ComputeClvInput.shape,
    async ({ book_offers, devig_method, closing_odds }) => {
      const result = computeClv(book_offers, devig_method ?? 'proportional', closing_odds);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── compute_calibration ───────────────────────────────────────────────────
  server.tool(
    'compute_calibration',
    'Compute model calibration metrics (Brier score, ECE, MCE) from a set of predicted probabilities ' +
      'and actual outcomes. Requires at least 10 predictions. Returns CALIBRATED | DRIFT | MISCALIBRATED.',
    ComputeCalibrationInput.shape,
    async ({ predictions, bucket_width }) => {
      const result = computeCalibration(predictions, bucket_width ?? 0.1);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_shadow_divergence ─────────────────────────────────────────────────
  server.tool(
    'get_shadow_divergence',
    'Query shadow scoring divergence rate from shadow_scoring_runs table. ' +
      'Returns how often shadow scoring diverged from prod over the specified window.',
    GetShadowDivergenceInput.shape,
    async ({ window_days }) => {
      const result = await fetchShadowDivergence(config, window_days ?? 7);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── get_risk_metrics ──────────────────────────────────────────────────────
  server.tool(
    'get_risk_metrics',
    'Get live portfolio risk metrics from the API risk engine (GET /api/risk/status). ' +
      'Returns exposure state, drift state, correlation state, and drawdown state.',
    GetRiskMetricsInput.shape,
    async () => {
      const result = await fetchRiskMetrics(config);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ── run_strategy_simulation ───────────────────────────────────────────────
  server.tool(
    'run_strategy_simulation',
    'Returns the CLI command to run an R5 strategy simulation. ' +
      'The simulation engine lives in apps/api and must be run via CLI. ' +
      'Strategies: flat-unit, flat-unit-friction, kelly-025, kelly-010.',
    RunStrategySimInput.shape,
    async ({ strategy, date_range }) => {
      const dateFlag = date_range ? ` --date-range ${date_range}` : '';
      const cmd = `cd apps/api && SUPABASE_URL=$SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY pnpm strategy:simulate -- --strategy ${strategy}${dateFlag}`;
      const result = {
        strategy,
        date_range: date_range ?? 'demo fixture (8 picks)',
        cli_command: cmd,
        note: 'Run this command from the repo root. Proof artifacts saved to out/strategy-runs/.',
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );
}
