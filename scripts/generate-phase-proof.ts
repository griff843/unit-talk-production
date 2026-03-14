#!/usr/bin/env npx tsx
/**
 * PHASE ADVANCEMENT PROOF GENERATOR
 * Sprint: SPRINT-CLAUDE-OS-PHASE-PROOF-003
 *
 * Generates a pre-populated skeleton proof_phase_advancement_<N>.txt for a
 * sprint that claims phase completion. The sprint author fills in evidence
 * fields and completes the sign-off before running sprint:close --phase <N>.
 *
 * Usage:
 *   npm run phase:proof -- --sprint SPRINT-FOO-123 --phase 5
 *   npm run phase:proof -- --sprint SPRINT-FOO-123 --phase 5 --date 2026-03-14
 *
 * Reference: docs/claude/PHASE_ADVANCEMENT_PROOF_TEMPLATE.md
 */

/* eslint-disable no-console, security/detect-non-literal-fs-filename */

import * as fs from 'fs';
import * as path from 'path';

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const SPRINTS_DIR = path.join(WORKSPACE_ROOT, 'out', 'sprints');

// ─── Phase Map ────────────────────────────────────────────────────────────────
// Sourced from docs/04_roadmap/layer_phase_execution_model.md §2 and §3

interface PhaseInfo {
  name: string;
  layer: number;
  layerName: string;
  layerExitCriteria: string;
  scope: string;
  criteria: string[];
}

const PHASE_MAP: Record<number, PhaseInfo> = {
  0: {
    name: 'Governance Lock',
    layer: 1,
    layerName: 'Functional Pick Machine',
    layerExitCriteria:
      'A production pick can reliably traverse the full lifecycle without manual\n' +
      'intervention and the result is deterministic, auditable, and recoverable.',
    scope: 'Execution contracts, single-writer discipline, CI gates, Claude OS governance',
    criteria: [
      'Execution contracts ratified and committed',
      'Single-writer discipline enforced (lifecycle gate passing)',
      'CI gates operational (type-check, build, tests, lifecycle:single-writer)',
      'Claude OS governance docs committed to canonical locations',
    ],
  },
  1: {
    name: 'Runtime Truth',
    layer: 1,
    layerName: 'Functional Pick Machine',
    layerExitCriteria:
      'A production pick can reliably traverse the full lifecycle without manual\n' +
      'intervention and the result is deterministic, auditable, and recoverable.',
    scope: 'Agent health, lifecycle enforcement, idempotency guarantees',
    criteria: [
      'Agent health checks operational (agent_health table populated)',
      'Lifecycle enforcement active (all unified_picks writes via adapters)',
      'Idempotency guarantees verified (submit, post, settle)',
      'Lifecycle gate passing in strict mode (0 violations)',
    ],
  },
  2: {
    name: 'Data Truth',
    layer: 1,
    layerName: 'Functional Pick Machine',
    layerExitCriteria:
      'A production pick can reliably traverse the full lifecycle without manual\n' +
      'intervention and the result is deterministic, auditable, and recoverable.',
    scope: 'Schema canonicalization, type safety, schema drift elimination',
    criteria: [
      'Supabase types regenerated and matching schema (no drift)',
      'Deprecated tables (players, teams, daily_picks) decommissioned',
      'participants and participant_memberships canonical and populated',
      'TypeScript type-check passing (0 errors)',
    ],
  },
  3: {
    name: 'Distribution Determinism',
    layer: 1,
    layerName: 'Functional Pick Machine',
    layerExitCriteria:
      'A production pick can reliably traverse the full lifecycle without manual\n' +
      'intervention and the result is deterministic, auditable, and recoverable.',
    scope: 'Discord worker reliability, outbox integrity, delivery proofs',
    criteria: [
      'Discord worker reliably processing bridge_outbox',
      'Outbox integrity verified (no stuck rows, dead-letter handling)',
      'Delivery proofs captured for posted picks',
      'Discord promotion pipeline end-to-end verified',
    ],
  },
  4: {
    name: 'Operational Determinism',
    layer: 1,
    layerName: 'Functional Pick Machine',
    layerExitCriteria:
      'A production pick can reliably traverse the full lifecycle without manual\n' +
      'intervention and the result is deterministic, auditable, and recoverable.',
    scope: 'Worker health restore, quarantine/dead-letter handling, pipeline observability',
    criteria: [
      'Worker health restore operational (agent_health correctly updated)',
      'Quarantine/dead-letter rows handled (no silent failures)',
      'Pipeline observability in place (health endpoints, dashboards)',
      'Worker fault tolerance verified',
    ],
  },
  5: {
    name: 'Platform Stabilization',
    layer: 1,
    layerName: 'Functional Pick Machine',
    layerExitCriteria:
      'A production pick can reliably traverse the full lifecycle without manual\n' +
      'intervention and the result is deterministic, auditable, and recoverable.',
    scope: 'End-to-end E2E verification, smoke tests, shadow mode, fault injection',
    criteria: [
      'E2E verification pass (full pick lifecycle verified)',
      'Smoke tests pass (all assertions green)',
      'Shadow mode operational (R3 — divergence detection active)',
      'Fault injection framework validated (R4 — F1-F10 scenarios pass)',
      'Replay engine E2E traversal (R2 — deterministic output verified)',
    ],
  },
  6: {
    name: 'Operator Control Plane',
    layer: 2,
    layerName: 'Production Platform',
    layerExitCriteria:
      'Operators can run the platform, detect problems, and recover from failure\n' +
      'states without requiring engineering escalation for normal operational events.',
    scope:
      'Backend control surface: operator APIs, autopilot mode controls, manual override workflows',
    criteria: [
      'Operator APIs implemented and documented',
      'Autopilot mode controls operational (LOG_ONLY → CANARY → PROD transitions)',
      'Manual override workflows verified',
      'Control plane access controls in place',
    ],
  },
  7: {
    name: 'Reliability & Monitoring',
    layer: 2,
    layerName: 'Production Platform',
    layerExitCriteria:
      'Operators can run the platform, detect problems, and recover from failure\n' +
      'states without requiring engineering escalation for normal operational events.',
    scope: 'Alerting, SLO tracking, health dashboards, on-call runbooks',
    criteria: [
      'Alerting operational (key failure modes covered)',
      'SLO tracking in place (latency, error rate, availability)',
      'Health dashboards accessible to operators',
      'On-call runbooks written and reviewed',
    ],
  },
  8: {
    name: 'Recovery & Replay',
    layer: 2,
    layerName: 'Production Platform',
    layerExitCriteria:
      'Operators can run the platform, detect problems, and recover from failure\n' +
      'states without requiring engineering escalation for normal operational events.',
    scope: 'Replay engine production readiness, incident recovery procedures, backup/restore',
    criteria: [
      'Replay engine production-ready (verified against real event corpus)',
      'Incident recovery procedures documented and tested',
      'Backup/restore procedures in place',
      'Recovery time objectives (RTO) verified',
    ],
  },
  9: {
    name: 'SmartForm UX',
    layer: 3,
    layerName: 'Product Complete',
    layerExitCriteria:
      'Workflows are usable. Users and operators have polished interfaces and\n' +
      'efficient workflows.',
    scope: 'Smart Form polish, user-facing pick submission workflows',
    criteria: [
      'Smart Form pick submission workflow polished and usable',
      'Validation feedback clear and actionable',
      'Submission latency acceptable',
      'Error states handled gracefully',
    ],
  },
  10: {
    name: 'Command Center UX',
    layer: 3,
    layerName: 'Product Complete',
    layerExitCriteria:
      'Workflows are usable. Users and operators have polished interfaces and\n' +
      'efficient workflows.',
    scope: 'Command Center interface redesign, operator UI, workflow tooling',
    criteria: [
      'Command Center interface redesigned and operator-tested',
      'Operator UI workflows efficient (key tasks require minimal clicks)',
      'Workflow tooling integrated and functional',
      'Operator feedback incorporated',
    ],
  },
  11: {
    name: 'Workflow Optimization',
    layer: 3,
    layerName: 'Product Complete',
    layerExitCriteria:
      'Workflows are usable. Users and operators have polished interfaces and\n' +
      'efficient workflows.',
    scope: 'Cross-cutting operator efficiency, automation of routine workflows',
    criteria: [
      'Routine operator workflows automated',
      'Cross-cutting efficiency improvements measured and verified',
      'Daily operational friction minimized',
      'Operator time-on-task metrics improved',
    ],
  },
  12: {
    name: 'Edge Detection',
    layer: 4,
    layerName: 'Syndicate Intelligence',
    layerExitCriteria:
      'Edge detection, market resistance analysis, and CLV analytics are\n' +
      'operational and provide actionable intelligence.',
    scope: 'Closing line value analysis, edge identification, backtesting',
    criteria: [
      'Closing line value (CLV) analysis operational',
      'Edge identification algorithm verified against historical data',
      'Backtesting framework validated',
      'Edge detection results actionable and surfaced to operators',
    ],
  },
  13: {
    name: 'Market Resistance',
    layer: 4,
    layerName: 'Syndicate Intelligence',
    layerExitCriteria:
      'Edge detection, market resistance analysis, and CLV analytics are\n' +
      'operational and provide actionable intelligence.',
    scope: 'Market behavior analysis, line movement interpretation',
    criteria: [
      'Market behavior analysis operational',
      'Line movement interpretation algorithm verified',
      'Market resistance signals surfaced to operators',
      'Historical line movement data ingested and verified',
    ],
  },
  14: {
    name: 'CLV Analytics',
    layer: 4,
    layerName: 'Syndicate Intelligence',
    layerExitCriteria:
      'Edge detection, market resistance analysis, and CLV analytics are\n' +
      'operational and provide actionable intelligence.',
    scope: 'Customer lifetime value, historical model performance, analytics',
    criteria: [
      'CLV model operational and producing outputs',
      'Historical model performance analytics verified',
      'Analytics surfaced to operators in Command Center',
      'CLV metrics actionable for syndicate decisions',
    ],
  },
};

// ─── Arg parsing ──────────────────────────────────────────────────────────────

interface ParsedArgs {
  sprintId: string;
  phase: number | null;
  date: string | null;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let sprintId = '';
  let phase: number | null = null;
  let date: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    if (arg === '--sprint' && nextArg) {
      sprintId = nextArg;
      i++;
    } else if (arg === '--phase' && nextArg) {
      phase = parseInt(nextArg, 10);
      i++;
    } else if (arg === '--date' && nextArg) {
      date = nextArg;
      i++;
    }
  }

  return { sprintId, phase, date };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function findLatestDateFolder(sprintDir: string): string | null {
  if (!fs.existsSync(sprintDir)) return null;
  const entries = fs.readdirSync(sprintDir, { withFileTypes: true });
  const dateFolders = entries
    .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
    .map(e => e.name)
    .sort()
    .reverse();
  return dateFolders[0] || null;
}

// ─── Skeleton builder ─────────────────────────────────────────────────────────

function buildSkeleton(sprintId: string, phase: number, date: string, info: PhaseInfo): string {
  const criteriaLines = info.criteria
    .map(c => `[ ] ${c}\n    Evidence: [FILL IN: CI output, proof file references, commit hashes]`)
    .join('\n\n');

  const lines = [
    '============================================================',
    'PHASE ADVANCEMENT PROOF',
    `Phase: ${phase} — ${info.name}`,
    `Layer: ${info.layer} — ${info.layerName}`,
    `Sprint: ${sprintId}`,
    `Date:   ${date}`,
    '============================================================',
    '',
    'PHASE SCOPE',
    '-----------',
    info.scope,
    '',
    'LAYER EXIT CRITERIA (layer_phase_execution_model.md §2)',
    '--------------------------------------------------------',
    info.layerExitCriteria,
    '',
    'PHASE COMPLETION EVIDENCE',
    '--------------------------',
    criteriaLines,
    '',
    'EXPLICIT SIGN-OFF',
    '-----------------',
    `[REPLACE THIS LINE with: "Phase ${phase} criteria satisfied as of ${date} by ${sprintId}."]`,
    '',
    '============================================================',
  ];

  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const { sprintId, phase, date } = parseArgs();

  if (!sprintId || phase === null || isNaN(phase)) {
    console.error(
      'Usage: npm run phase:proof -- --sprint <SPRINT-ID> --phase <N> [--date YYYY-MM-DD]'
    );
    console.error('       Phase must be an integer 0–14.');
    process.exit(1);
  }

  const info = PHASE_MAP[phase];
  if (!info) {
    console.error(`❌ Unknown phase: ${phase}. Valid phases are 0–14.`);
    process.exit(1);
  }

  const sprintDir = path.join(SPRINTS_DIR, sprintId);
  const targetDate = date || findLatestDateFolder(sprintDir) || todayISO();
  const proofsDir = path.join(sprintDir, targetDate, 'proofs');
  const outputFile = path.join(proofsDir, `proof_phase_advancement_${phase}.txt`);

  // Fail-closed: refuse to overwrite
  if (fs.existsSync(outputFile)) {
    console.error(`❌ File already exists: ${outputFile}`);
    console.error('   Delete it manually if you want to regenerate.');
    process.exit(1);
  }

  fs.mkdirSync(proofsDir, { recursive: true });

  const skeleton = buildSkeleton(sprintId, phase, targetDate, info);
  fs.writeFileSync(outputFile, skeleton, 'utf8');

  console.log('✅ Phase advancement proof skeleton generated');
  console.log(`   Phase:  ${phase} — ${info.name}`);
  console.log(`   Layer:  ${info.layer} — ${info.layerName}`);
  console.log(`   Sprint: ${sprintId}`);
  console.log(`   Date:   ${targetDate}`);
  console.log(`   File:   ${outputFile}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Fill in every [FILL IN: ...] field with actual evidence');
  console.log('  2. Replace the [REPLACE THIS LINE] sign-off with the completed statement');
  console.log(`  3. Run: npm run sprint:close -- ${sprintId} --phase ${phase}`);
}

main();
