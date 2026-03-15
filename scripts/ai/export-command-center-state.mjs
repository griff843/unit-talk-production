#!/usr/bin/env node
/**
 * export-command-center-state.mjs
 *
 * Exports live platform health and SLO state from the API layer.
 * Requires API_BASE_URL env var. Fails closed if the env is missing or
 * if any endpoint returns a non-2xx response.
 *
 * Output: out/ai/snapshots/command_center_snapshot.json
 *
 * Usage:
 *   API_BASE_URL=http://localhost:3001 node scripts/ai/export-command-center-state.mjs
 *   API_BASE_URL=https://your-api.domain node scripts/ai/export-command-center-state.mjs
 *
 * Optional env:
 *   OPERATOR_TOKEN — if set, also fetches SLO status (requires operator auth)
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(ROOT, 'out', 'ai', 'snapshots');

const API_BASE_URL = process.env.API_BASE_URL;
const OPERATOR_TOKEN = process.env.OPERATOR_TOKEN;

if (!API_BASE_URL) {
  console.error('❌ API_BASE_URL env var is required. Set it to your API base URL.');
  console.error('   Example: API_BASE_URL=http://localhost:3001 node scripts/ai/export-command-center-state.mjs');
  process.exit(1);
}

async function fetchJSON(url, { token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}: ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const base = API_BASE_URL.replace(/\/$/, '');
  console.log(`Fetching platform state from ${base}...`);

  // Always fetch platform health
  let health;
  try {
    health = await fetchJSON(`${base}/api/health/summary`);
    console.log(`  ✅ /api/health/summary — status: ${health.platform_status ?? 'unknown'}`);
  } catch (err) {
    console.error(`  ❌ /api/health/summary failed: ${err.message}`);
    process.exit(1);
  }

  // Optionally fetch SLO status (requires OPERATOR_TOKEN)
  let slo = null;
  if (OPERATOR_TOKEN) {
    try {
      slo = await fetchJSON(`${base}/api/slo/status`, { token: OPERATOR_TOKEN });
      console.log(`  ✅ /api/slo/status — breach_count: ${slo.breach_count ?? 'unknown'}`);
    } catch (err) {
      console.warn(`  ⚠️  /api/slo/status failed (OPERATOR_TOKEN may be invalid): ${err.message}`);
      slo = { error: err.message, note: 'Requires valid OPERATOR_TOKEN' };
    }
  } else {
    slo = { skipped: true, note: 'OPERATOR_TOKEN not set — set it to include SLO data' };
    console.log('  ℹ️  Skipping /api/slo/status (OPERATOR_TOKEN not set)');
  }

  const snapshot = {
    generated_at: new Date().toISOString(),
    source: base,
    platform_health: health,
    slo_status: slo,
  };

  const outPath = join(OUT_DIR, 'command_center_snapshot.json');
  await writeFile(outPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`✅ command_center_snapshot.json written → ${relative(ROOT, outPath)}`);
}

main().catch((err) => {
  console.error('❌ export-command-center-state failed:', err.message);
  process.exit(1);
});
