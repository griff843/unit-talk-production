/**
 * Workflow Registry — Curated Catalog
 *
 * SPRINT-052-LAYER3-PHASE11-OPERATOR-WORKFLOW-FOUNDATION
 *
 * Statically registered workflows with metadata. Covers the 5 canonical
 * operator script categories: analysis, backfill, feed, health, settlement.
 */

import type { WorkflowEntry } from './types';

export const WORKFLOW_REGISTRY: WorkflowEntry[] = [
  // ── ANALYSIS ──────────────────────────────────────────────────────────────
  {
    name: 'analyze-grading-promotion',
    displayName: 'Analyze Grading & Promotion',
    description:
      'Analyze grading pipeline performance and promotion band distribution across recent picks.',
    category: 'analysis',
    scriptPath: 'analyze-grading-promotion.ts',
    riskLevel: 'low',
    invocation: 'pnpm --filter api tsx src/scripts/analyze-grading-promotion.ts',
    requiresDatabase: true,
  },
  {
    name: 'edge-validation-report',
    displayName: 'Edge Validation Report',
    description:
      'Generate CLV edge validation report comparing pre/post line movement for recent picks.',
    category: 'analysis',
    scriptPath: 'edge-validation-report.ts',
    riskLevel: 'low',
    invocation: 'pnpm --filter api tsx src/scripts/edge-validation-report.ts',
    requiresDatabase: true,
  },
  {
    name: 'verify-slo',
    displayName: 'Verify SLO Attainment',
    description:
      'Verify SLO attainment against the 4 platform SLOs: lifecycle, Discord posting, grading latency, settlement accuracy.',
    category: 'analysis',
    scriptPath: 'verify-slo.ts',
    riskLevel: 'low',
    invocation: 'pnpm --filter api tsx src/scripts/verify-slo.ts',
    requiresDatabase: true,
  },
  {
    name: 'check-grading-status',
    displayName: 'Check Grading Status',
    description:
      'Check current grading status: pending picks, scoring distribution, recent grade activity.',
    category: 'analysis',
    scriptPath: 'check-grading-status.ts',
    riskLevel: 'low',
    invocation: 'pnpm --filter api tsx src/scripts/check-grading-status.ts',
    requiresDatabase: true,
  },

  // ── BACKFILL ──────────────────────────────────────────────────────────────
  {
    name: 'backfill-promotion-band-null',
    displayName: 'Backfill Null Promotion Bands',
    description:
      'Backfill picks with null promotion_band that passed meetsPromotionCriteria(). Sets band to HARD via operator_override lifecycle role.',
    category: 'backfill',
    scriptPath: 'backfill-promotion-band-null.ts',
    riskLevel: 'medium',
    invocation: 'pnpm --filter api tsx src/scripts/backfill-promotion-band-null.ts',
    requiresDatabase: true,
  },
  {
    name: 'backfill-market-props-batch',
    displayName: 'Backfill Market Props (Batch)',
    description:
      'Batch backfill market prop data for provider_offers. Processes in configurable batch sizes.',
    category: 'backfill',
    scriptPath: 'backfill-market-props-batch.ts',
    riskLevel: 'medium',
    invocation: 'pnpm --filter api tsx src/scripts/backfill-market-props-batch.ts',
    requiresDatabase: true,
    parameters: [
      {
        name: '--batch-size',
        description: 'Number of records per batch (default: 100)',
        required: false,
        type: 'number',
        example: '--batch-size 50',
      },
    ],
  },
  {
    name: 'backfill-feature-contributions',
    displayName: 'Backfill Feature Contributions',
    description:
      'Backfill ML feature contribution scores for picks missing them. Required for CLV attribution.',
    category: 'backfill',
    scriptPath: 'backfill-feature-contributions.ts',
    riskLevel: 'medium',
    invocation: 'pnpm --filter api tsx src/scripts/backfill-feature-contributions.ts',
    requiresDatabase: true,
  },

  // ── FEED ──────────────────────────────────────────────────────────────────
  {
    name: 'feed-agent-backfill',
    displayName: 'Feed Agent Backfill',
    description:
      'Trigger FeedAgent to backfill missed provider_offers from external feeds (SGO + OddsAPI).',
    category: 'feed',
    scriptPath: 'feed-agent-backfill.ts',
    riskLevel: 'low',
    invocation: 'pnpm --filter api tsx src/scripts/feed-agent-backfill.ts',
    requiresDatabase: true,
  },
  {
    name: 'run-shadow',
    displayName: 'Run Shadow Mode Comparison',
    description:
      'Run shadow mode comparison between V1 and V3 grading paths. Outputs divergence report.',
    category: 'feed',
    scriptPath: 'run-shadow.ts',
    riskLevel: 'low',
    invocation: 'pnpm --filter api tsx src/scripts/run-shadow.ts',
    requiresDatabase: true,
  },
  {
    name: 'run-replay',
    displayName: 'Run Deterministic Replay',
    description:
      'Execute deterministic replay from a production event journal file. Writes proof bundle to out/replay-runs/.',
    category: 'feed',
    scriptPath: 'run-replay.ts',
    riskLevel: 'low',
    invocation:
      'pnpm --filter api tsx src/scripts/run-replay.ts --journal <path> --from <ISO> --to <ISO>',
    requiresDatabase: false,
    parameters: [
      {
        name: '--journal',
        description: 'Path to the JSONL journal file',
        required: true,
        type: 'string',
        example: '--journal out/journals/2026-03-15.jsonl',
      },
      {
        name: '--from',
        description: 'Replay window start (ISO 8601)',
        required: true,
        type: 'string',
        example: '--from 2026-03-15T00:00:00Z',
      },
      {
        name: '--to',
        description: 'Replay window end (ISO 8601)',
        required: true,
        type: 'string',
        example: '--to 2026-03-15T23:59:59Z',
      },
    ],
  },

  // ── HEALTH ────────────────────────────────────────────────────────────────
  {
    name: 'simple-health-check',
    displayName: 'Simple Health Check',
    description:
      'Quick platform health check: Supabase connectivity, agent_health table, outbox depth.',
    category: 'health',
    scriptPath: 'simple-health-check.ts',
    riskLevel: 'low',
    invocation: 'pnpm --filter api tsx src/scripts/simple-health-check.ts',
    requiresDatabase: true,
  },
  {
    name: 'verify-gates',
    displayName: 'Verify All Gates',
    description:
      'Run all verification gates: lifecycle single-writer, type-check, SLO status, single-writer gate.',
    category: 'health',
    scriptPath: 'verify-gates.ts',
    riskLevel: 'low',
    invocation: 'pnpm --filter api tsx src/scripts/verify-gates.ts',
    requiresDatabase: true,
  },
  {
    name: 'system-health-validator',
    displayName: 'System Health Validator',
    description:
      'Full system health validation: all agents, outbox, workers, database connectivity, recent pick throughput.',
    category: 'health',
    scriptPath: 'system-health-validator.ts',
    riskLevel: 'low',
    invocation: 'pnpm --filter api tsx src/scripts/system-health-validator.ts',
    requiresDatabase: true,
  },

  // ── SETTLEMENT ────────────────────────────────────────────────────────────
  {
    name: 'diagnose-grading-system',
    displayName: 'Diagnose Grading System',
    description:
      'Full grading system diagnosis: NaN checks, scoring integrity, pick state distribution, promotion pipeline health.',
    category: 'settlement',
    scriptPath: 'diagnose-grading-system.ts',
    riskLevel: 'low',
    invocation: 'pnpm --filter api tsx src/scripts/diagnose-grading-system.ts',
    requiresDatabase: true,
  },
  {
    name: 'check-parlay-status',
    displayName: 'Check Parlay Status',
    description:
      'Check parlay grouping status: pending parlays, settlement state, leg completion counts.',
    category: 'settlement',
    scriptPath: 'check-parlay-status.ts',
    riskLevel: 'low',
    invocation: 'pnpm --filter api tsx src/scripts/check-parlay-status.ts',
    requiresDatabase: true,
  },

  // ── OPS ───────────────────────────────────────────────────────────────────
  {
    name: 'db-preflight',
    displayName: 'Database Migration Preflight',
    description: 'Run database migration preflight checks before applying new migrations.',
    category: 'ops',
    scriptPath: 'ops/supabase-migration-preflight.ts',
    riskLevel: 'low',
    invocation: 'pnpm ops:db:preflight',
    requiresDatabase: true,
  },
  {
    name: 'start-all-workflows',
    displayName: 'Start All Temporal Workflows',
    description:
      'Start all registered Temporal workflows: feed ingestion, recap generation, analytics.',
    category: 'ops',
    scriptPath: 'start-all-workflows.ts',
    riskLevel: 'high',
    invocation: 'pnpm --filter api tsx src/scripts/start-all-workflows.ts',
    requiresDatabase: true,
  },
  {
    name: 'run-strategy',
    displayName: 'Run Strategy Simulation',
    description:
      'Execute strategy evaluation simulation comparing flat-unit, kelly, and custom staking strategies.',
    category: 'ops',
    scriptPath: 'run-strategy.ts',
    riskLevel: 'low',
    invocation: 'pnpm strategy:simulate',
    requiresDatabase: false,
    parameters: [
      {
        name: '--strategy',
        description: 'Strategy ID to simulate (flat-unit, kelly-025, kelly-010)',
        required: false,
        type: 'string',
        example: '--strategy kelly-025',
      },
    ],
  },
];
