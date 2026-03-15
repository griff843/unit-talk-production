#!/usr/bin/env node
/**
 * generate-repo-map.mjs
 *
 * Generates a human-readable Markdown repo map for grounding LLMs.
 * Covers: apps, packages, tools, key docs, skills, scripts.
 * Does NOT dump file contents — lists paths and roles only.
 *
 * Output: out/ai/snapshots/repo_map.md
 *
 * Usage: node scripts/ai/generate-repo-map.mjs
 */

import { writeFile, readdir, stat, mkdir } from 'fs/promises';
import { join, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(ROOT, 'out', 'ai', 'snapshots');

async function listTopLevel(dir, { exts = null, excludes = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', 'coverage'] } = {}) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => !excludes.includes(e.name))
    .filter((e) => !exts || e.isFile() ? exts.includes(extname(e.name)) : true)
    .map((e) => ({ name: e.name, isDir: e.isDirectory() }));
}

async function listMdFiles(dir) {
  const entries = await listTopLevel(dir, { exts: ['.md'] });
  return entries.filter((e) => !e.isDir).map((e) => e.name);
}

function section(title, content) {
  return `## ${title}\n\n${content}\n`;
}

function table(headers, rows) {
  const header = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return [header, sep, body].join('\n');
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const lines = [];
  lines.push('# Unit Talk — Repository Map');
  lines.push('');
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push('> Use this as grounding context for LLM-based code review, architecture analysis, and incident investigation.');
  lines.push('> Do NOT use this as a substitute for reading actual files — it is a directory-level map only.');
  lines.push('');

  // --- Apps ---
  lines.push(section('Applications (`apps/`)', table(
    ['App', 'Role', 'Tech', 'Write Authority'],
    [
      ['`apps/api`', 'Backend API, agents, lifecycle enforcement', 'Node.js / TypeScript', '**CANONICAL** `unified_picks` via adapters'],
      ['`apps/command-center`', 'Operator dashboard — picks, health, replay', 'Next.js / TypeScript', 'READ-ONLY'],
      ['`apps/dashboard`', 'Analytics frontend', 'Next.js / TypeScript', 'READ-ONLY'],
      ['`apps/discord-bot`', 'Discord integration — pick posting', 'Node.js / TypeScript', 'Webhook only'],
      ['`apps/smart-form`', 'Ticket submission UI', 'Next.js / TypeScript', '`bridge_outbox` only'],
    ]
  )));

  // --- Packages ---
  lines.push(section('Packages (`packages/`)', table(
    ['Package', 'Role'],
    [
      ['`packages/mcp-state`', 'MCP server — pick lifecycle state (VERIFIED SPRINT-055)'],
      ['`packages/mcp-intelligence`', 'MCP server — CLV, calibration, model perf (VERIFIED SPRINT-055)'],
      ['`packages/mcp-ops`', 'MCP server — platform health, SLOs, pipeline status (VERIFIED SPRINT-055)'],
      ['`packages/mcp-decision`', 'MCP server — sprint governance, routing decisions (VERIFIED SPRINT-055)'],
      ['`packages/intelligence`', 'CLV engine, calibration math, market analysis'],
      ['`packages/data-access`', 'Supabase client factories, query helpers'],
      ['`packages/contracts`', 'Shared TypeScript interfaces and DTOs'],
      ['`packages/shared`', 'Shared utilities, constants'],
      ['`packages/shared-types`', 'Generated Supabase schema types'],
      ['`packages/config`', 'Shared ESLint, TypeScript, Prettier configs'],
      ['`packages/observability`', 'OpenTelemetry integration (type-check passes; build scoped to api)'],
      ['`packages/distribution`', 'Pick distribution helpers'],
    ]
  )));

  // --- Tools ---
  lines.push(section('Tools (`tools/`)', table(
    ['Tool', 'Role'],
    [
      ['`tools/claude-os`', 'Claude OS — LLM routing engine, lifecycle checker, finding backlog, sprint:close validator (COS-001–007 COMPLETE)'],
      ['`tools/governance`', 'Sprint gate enforcement (`sprint-gate.js`)'],
      ['`tools/profile`', 'Performance profiling utilities'],
      ['`tools/huly-os`', 'DEPRECATED — replaced by Linear'],
    ]
  )));

  // --- Key API Source Dirs ---
  lines.push(section('Key `apps/api/src/` Directories', table(
    ['Path', 'Contents'],
    [
      ['`apps/api/src/agents/`', 'BridgeWorker, GradingAgent, DiscordPromotionAgent, SettlementAgent, IngestionAgent'],
      ['`apps/api/src/lib/lifecycle/`', 'Lifecycle adapters (lifecycleInsert, lifecycleUpdate, atomicClaimForPost)'],
      ['`apps/api/src/lib/risk/`', 'Risk engine — Kelly sizing, bankroll, market-type exposure caps'],
      ['`apps/api/src/lib/workflow-registry/`', 'Temporal operator workflow registry'],
      ['`apps/api/src/lib/verification/`', 'R1–R5 verification/simulation layer'],
      ['`apps/api/src/routes/`', 'Express routes — picks, health, SLO, replay, operators'],
      ['`apps/api/src/scripts/`', 'One-off operator scripts (backfill, canary, etc.)'],
    ]
  )));

  // --- Claude Skills ---
  lines.push(section('Claude OS Skills (`.claude/skills/`)', table(
    ['Skill', 'Invocation', 'Purpose'],
    [
      ['`pipeline-health`', '`/pipeline-health`', 'First diagnostic — agent health, outbox depth, SLOs, platform status'],
      ['`pick-trace`', '`/pick-trace <uuid>`', 'Full lifecycle trace for a single pick'],
      ['`slo-report`', '`/slo-report [--context]`', 'SLO attainment report with gap analysis'],
      ['`edge-check`', '`/edge-check`', 'CLV edge and model calibration audit'],
      ['`sprint-plan`', '`/sprint-plan`', 'Read truth docs, emit next sprint recommendation'],
      ['`status-sync`', '`/status-sync <SPRINT>`', 'Sync status docs after sprint completion'],
      ['`system-status`', '`/system-status`', 'Current platform status snapshot'],
    ]
  )));

  // --- Claude Rules ---
  lines.push(section('Claude OS Rules (`.claude/rules/`)', table(
    ['Rule', 'Topic'],
    [
      ['`00-workflow.md`', 'Sprint phase flow, definition of done, naming, proof location'],
      ['`01-safety-and-proof.md`', 'No claims without proof, proof bundle requirements'],
      ['`02-db-migrations.md`', 'Migration standards, reversibility, forbidden ops'],
      ['`03-single-writer-and-idempotency.md`', 'Lifecycle adapters, writer roles, idempotency guards'],
      ['`04-testing-and-verification.md`', 'Test categories, pre/post verification, failure response'],
      ['`05-output-formats.md`', 'Closeout report format, proof file formats, directory structure'],
      ['`06-linear-mcp-discipline.md`', 'Linear MCP context discipline — exact ID lookup, scoped searches'],
      ['`07-lane-model.md`', 'Lane 1–6, parallelism rules, gate-before-read discipline'],
    ]
  )));

  // --- Key Docs ---
  lines.push(section('Key Documentation', table(
    ['Doc', 'Authority'],
    [
      ['`docs/status/CURRENT_SYSTEM_STATUS.md`', 'Subsystem health, infrastructure, agent compliance'],
      ['`docs/status/PHASE_STATUS.md`', 'Phase completion % (operational tracking)'],
      ['`docs/status/NEXT_5_SPRINTS.md`', 'Sprint queue and priorities'],
      ['`docs/status/DRIFT_REPORT.md`', 'Active drift items by severity'],
      ['`docs/system/UNIT_TALK_SYSTEM_BRAIN.md`', 'AI-facing canonical repo summary'],
      ['`docs/ai/LLM_DECISION_PLAYBOOK.md`', 'Which AI tool does what'],
      ['`docs/04_roadmap/layer_phase_execution_model.md`', 'Canonical Layer/Phase model for sprint classification'],
      ['`docs/06_status/current_phase.md`', 'Tier 3 canonical current position'],
      ['`docs/ops/SLO_DEFINITIONS.md`', 'Canonical SLO definitions (4 SLOs)'],
      ['`docs/ops/ON_CALL_RUNBOOK.md`', 'Incident response scenarios 1–4'],
      ['`CLAUDE_EXECUTION_CONTRACT.md`', 'Non-negotiable AI execution invariants'],
      ['`docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`', 'Sprint execution rules (authoritative)'],
      ['`docs/contracts/PICK_LIFECYCLE_CONTRACT.md`', 'Pick lifecycle contract'],
    ]
  )));

  // --- AI Artifacts ---
  lines.push(section('AI Artifact Outputs (`out/ai/`)', table(
    ['Path', 'Contents'],
    [
      ['`out/ai/context/context_bundle.json`', 'Structured context bundle (machine-readable)'],
      ['`out/ai/context/context_bundle.md`', 'Paste-ready ChatGPT context (human-readable)'],
      ['`out/ai/snapshots/repo_snapshot.json`', 'Repo intelligence snapshot (module counts, phase, drift)'],
      ['`out/ai/snapshots/repo_map.md`', 'This file — directory-level repo map'],
      ['`out/ai/snapshots/command_center_snapshot.json`', 'Live platform health + SLO snapshot (requires API_BASE_URL)'],
      ['`out/ai/reports/`', 'Intelligence review reports (edge drift, strategy perf, calibration)'],
    ]
  )));

  // --- Scripts ---
  lines.push(section('AI Scripts (`scripts/ai/`)', table(
    ['Script', 'Command', 'Output'],
    [
      ['`repo-intelligence-snapshot.mjs`', '`node scripts/ai/repo-intelligence-snapshot.mjs`', '`out/ai/snapshots/repo_snapshot.json`'],
      ['`generate-repo-map.mjs`', '`node scripts/ai/generate-repo-map.mjs`', '`out/ai/snapshots/repo_map.md`'],
      ['`export-command-center-state.mjs`', '`node scripts/ai/export-command-center-state.mjs`', '`out/ai/snapshots/command_center_snapshot.json`'],
      ['`build-context-bundle.mjs`', '`pnpm ai:context`', '`out/ai/context/context_bundle.{json,md}`'],
    ]
  )));

  const content = lines.join('\n');
  const outPath = join(OUT_DIR, 'repo_map.md');
  await writeFile(outPath, content, 'utf-8');
  console.log(`✅ repo_map.md written → ${relative(ROOT, outPath)}`);
}

main().catch((err) => {
  console.error('❌ generate-repo-map failed:', err.message);
  process.exit(1);
});
