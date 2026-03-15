#!/usr/bin/env node
/**
 * repo-intelligence-snapshot.mjs
 *
 * Generates a structured JSON snapshot of the repo's intelligence layer:
 * packages, apps, key file counts, and sprint/phase metadata from status docs.
 *
 * Output: out/ai/snapshots/repo_snapshot.json
 *
 * Usage: node scripts/ai/repo-intelligence-snapshot.mjs
 */

import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { join, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(ROOT, 'out', 'ai', 'snapshots');

// Dirs to count files in (for LOC/file density signal)
const SCAN_DIRS = [
  { name: 'apps/api', path: join(ROOT, 'apps', 'api', 'src') },
  { name: 'apps/command-center', path: join(ROOT, 'apps', 'command-center', 'src') },
  { name: 'apps/dashboard', path: join(ROOT, 'apps', 'dashboard', 'src') },
  { name: 'apps/discord-bot', path: join(ROOT, 'apps', 'discord-bot', 'src') },
  { name: 'apps/smart-form', path: join(ROOT, 'apps', 'smart-form', 'src') },
  { name: 'packages/mcp-state', path: join(ROOT, 'packages', 'mcp-state', 'src') },
  { name: 'packages/mcp-intelligence', path: join(ROOT, 'packages', 'mcp-intelligence', 'src') },
  { name: 'packages/mcp-ops', path: join(ROOT, 'packages', 'mcp-ops', 'src') },
  { name: 'packages/mcp-decision', path: join(ROOT, 'packages', 'mcp-decision', 'src') },
  { name: 'packages/intelligence', path: join(ROOT, 'packages', 'intelligence', 'src') },
  { name: 'tools/claude-os', path: join(ROOT, 'tools', 'claude-os', 'src') },
];

async function countFiles(dir, ext = ['.ts', '.tsx', '.mjs', '.js']) {
  let count = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '__tests__') {
      count += await countFiles(full, ext);
    } else if (entry.isFile() && ext.includes(extname(entry.name))) {
      count++;
    }
  }
  return count;
}

async function readStatusField(file, pattern) {
  try {
    const content = await readFile(join(ROOT, file), 'utf-8');
    const match = content.match(pattern);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

async function extractSprintQueue() {
  try {
    const content = await readFile(join(ROOT, 'docs', 'status', 'NEXT_5_SPRINTS.md'), 'utf-8');
    const sprints = [];
    const tableRows = content.match(/^\|\s*\d+\s*\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|/gm) || [];
    for (const row of tableRows) {
      const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 5) {
        sprints.push({
          position: cells[0],
          name: cells[1],
          priority: cells[2],
          phase: cells[3],
          focus: cells[4],
        });
      }
    }
    return sprints;
  } catch {
    return [];
  }
}

async function extractDriftSummary() {
  try {
    const content = await readFile(join(ROOT, 'docs', 'status', 'DRIFT_REPORT.md'), 'utf-8');
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const severity of Object.keys(counts)) {
      const matches = content.match(new RegExp(`\\|\\s*${severity}\\s*\\|`, 'g'));
      counts[severity] = matches ? matches.length : 0;
    }
    return counts;
  } catch {
    return { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('Scanning repo structure...');

  // File counts per module
  const moduleCounts = {};
  for (const dir of SCAN_DIRS) {
    moduleCounts[dir.name] = await countFiles(dir.path);
  }

  // Status doc metadata
  const lastUpdated = await readStatusField(
    'docs/status/CURRENT_SYSTEM_STATUS.md',
    /\*\*Last Updated\*\*:\s*([^\n|*]+)/
  );
  const auditSource = await readStatusField(
    'docs/status/CURRENT_SYSTEM_STATUS.md',
    /\*\*Audit Source\*\*:\s*([^\n|*]+)/
  );

  const sprintQueue = await extractSprintQueue();
  const driftSummary = await extractDriftSummary();

  const snapshot = {
    generated_at: new Date().toISOString(),
    repo_root: ROOT,
    layer_phase: {
      layer: 3,
      phase: 10,
      label: 'Layer 3 / Phase 10 — Command Center UX',
      layer1: 'COMPLETE',
      layer2: 'COMPLETE',
      layer3: 'ACTIVE',
      layer4_pct: 40,
    },
    status_docs: {
      last_updated: lastUpdated,
      audit_source: auditSource,
    },
    mcp_layer: {
      status: 'VERIFIED',
      sprint: 'SPRINT-055-MCP-LAYER-PARITY-FIX',
      servers: ['unit-talk-state', 'unit-talk-intelligence', 'unit-talk-ops', 'unit-talk-decision'],
    },
    claude_os: {
      status: 'COMPLETE',
      completion_pct: 100,
      completed_sprints: ['COS-001', 'COS-002', 'COS-003', 'COS-004', 'COS-005', 'COS-006', 'COS-007'],
    },
    observability_skills: {
      status: 'LIVE',
      sprint: 'SPRINT-056-OBSERVABILITY-SKILLS',
      skills: ['pipeline-health', 'pick-trace', 'slo-report', 'edge-check'],
    },
    apps: {
      'apps/api': { role: 'CANONICAL_WRITER', write_authority: 'unified_picks via lifecycle adapters' },
      'apps/command-center': { role: 'READ_ONLY', write_authority: 'none' },
      'apps/dashboard': { role: 'READ_ONLY', write_authority: 'none' },
      'apps/discord-bot': { role: 'INTEGRATION', write_authority: 'none (webhook only)' },
      'apps/smart-form': { role: 'BRIDGE_WRITER', write_authority: 'bridge_outbox only' },
    },
    canonical_tables: {
      unified_picks: 'CANONICAL — lifecycle adapters only',
      participants: 'CANONICAL — SGO sync',
      bridge_outbox: 'ACTIVE — smart-form writer',
      agent_health: 'ACTIVE — agents writer',
      prop_settlements: 'ACTIVE — SettlementAgent',
      daily_picks: 'DEPRECATED',
      players: 'DEPRECATED',
      teams: 'DEPRECATED',
    },
    module_file_counts: moduleCounts,
    sprint_queue: sprintQueue,
    drift_summary: driftSummary,
    key_invariants: [
      'single-writer: all unified_picks writes via lifecycle adapters',
      'idempotency: submit (bet_slip_id), post (atomic claim), settle (atomic claim)',
      'proof discipline: proof artifacts required for every sprint completion',
      'governed tags: CI mints sprint tags from governance/closeouts/*.md',
      'fail closed: OPERATOR_TOKEN required for get_slo_status',
    ],
  };

  const outPath = join(OUT_DIR, 'repo_snapshot.json');
  await writeFile(outPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`✅ repo_snapshot.json written → ${relative(ROOT, outPath)}`);
}

main().catch((err) => {
  console.error('❌ repo-intelligence-snapshot failed:', err.message);
  process.exit(1);
});
