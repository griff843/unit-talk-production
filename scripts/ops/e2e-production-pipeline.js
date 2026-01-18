#!/usr/bin/env node
/**
 * E2E Production Pipeline Orchestrator
 * @date 2025-11-20
 * @charter docs/PRODUCTION_CHARTER.md v3.0
 */

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const OUTPUT_DIR = path.join(process.cwd(), 'out/ops/cutover/metrics/e2e-production');
const SUMMARY_PATH = path.join(OUTPUT_DIR, 'E2E_TEST_SUMMARY.md');
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3010';
const TENANT_ID = process.env.DEFAULT_TENANT_ID || '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';
const USER_ID = '00000000-0000-0000-0000-000000000001';

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function log(msg, extra) {
  const ts = new Date().toISOString();
  if (extra) console.log(`[${ts}] ${msg}`, extra);
  else console.log(`[${ts}] ${msg}`);
}

function runCommand(cmd) {
  log(`$ ${cmd}`);
  execSync(cmd, { cwd: process.cwd(), stdio: 'inherit', env: process.env });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const startTs = new Date().toISOString();
  const stages = [];

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Stage 1: Prop ingestion
  try {
    log('Stage 1: Ingest live props into raw_props');
    runCommand('docker-compose exec api sh -lc "cd /app/apps/api && npx tsx src/runner/e2e-canonical-ingestion.ts"');
    stages.push({ name: 'Prop Ingestion', ok: true, details: 'raw_props ingest script completed' });
  } catch (err) {
    stages.push({ name: 'Prop Ingestion', ok: false, details: err.message || String(err) });
  }

  // Stage 2: Professional grading
  try {
    log('Stage 2: Process props through ProfessionalPropProcessor');
    runCommand('docker-compose exec api sh -lc "cd /app/apps/api && npx tsx src/runner/processThroughProfessionalSystem.ts"');
    stages.push({ name: 'Professional Grading', ok: true, details: 'Professional pipeline completed' });
  } catch (err) {
    stages.push({ name: 'Professional Grading', ok: false, details: err.message || String(err) });
  }

  let pickResult = null;
  let unifiedPick = null;

  // Stage 3: Canonical pick creation
  try {
    log('Stage 3: Ensure demo user and create canonical pick');

    const { data: userRow, error: userErr } = await supabase.from('users').select('id').eq('id', USER_ID).maybeSingle();
    if (userErr) throw new Error(`Demo user lookup failed: ${userErr.message}`);
    if (!userRow) {
      const now = new Date().toISOString();
      const { error: insertUserErr } = await supabase.from('users').insert({
        id: USER_ID,
        tenant_id: TENANT_ID,
        username: 'e2e-demo-user',
        tier: 'Free',
        status: 'active',
        created_at: now,
        updated_at: now,
      });
      if (insertUserErr) throw new Error(`Demo user insert failed: ${insertUserErr.message}`);
    }

    const { data: candidates, error: uniErr } = await supabase
      .from('unified_picks')
      .select('*')
      .gte('created_at', startTs)
      .order('professional_score', { ascending: false })
      .limit(10);
    if (uniErr) throw new Error(`unified_picks query failed: ${uniErr.message}`);
    if (!candidates || !candidates.length) throw new Error('No unified_picks available to convert to canonical pick');
    unifiedPick = candidates[0];

    const payload = {
      tenantId: TENANT_ID,
      userId: USER_ID,
      league: unifiedPick.sport || unifiedPick.league || 'NBA',
      marketType: unifiedPick.stat_type || 'points',
      line: unifiedPick.line || 0,
      side: (unifiedPick.direction || 'over').toLowerCase(),
      playerName: unifiedPick.player_name,
      gameId: unifiedPick.game_id || null,
      odds: unifiedPick.odds || -115,
      stakeText: `${unifiedPick.unit_size || 1}u`,
      stake: unifiedPick.unit_size || 1,
      userScore: unifiedPick.confidence_score ? Math.round(unifiedPick.confidence_score / 10) : 8,
      idempotencyKey: `e2e-${unifiedPick.id}`,
      metadata: { source: 'e2e-production-pipeline', unifiedPickId: unifiedPick.id },
    };

    const res = await axios.post(`${API_BASE}/api/domain/picks/insert`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    if (!res.data || !res.data.pickId) throw new Error('Pick insert response missing pickId');
    pickResult = res.data;
    stages.push({ name: 'Canonical Pick Creation', ok: true, details: `pickId=${res.data.pickId}` });
  } catch (err) {
    stages.push({ name: 'Canonical Pick Creation', ok: false, details: err.message || String(err) });
  }

  // Stage 4: Outbox processing
  let publishRow = null;
  if (pickResult && pickResult.pickId) {
    try {
      log('Stage 4: Verify pick_publish outbox processing');
      await wait(15000);

      const { data: pickRow } = await supabase.from('picks').select('*').eq('id', pickResult.pickId).maybeSingle();
      const { data: publishRows } = await supabase
        .from('pick_publish')
        .select('*')
        .eq('pick_id', pickResult.pickId)
        .order('created_at', { ascending: false })
        .limit(1);

      publishRow = publishRows && publishRows[0];
      const ok = !!pickRow && !!publishRow && ['sent', 'processed', 'shadow-sent'].includes(publishRow.status);
      stages.push({
        name: 'Outbox Processing',
        ok,
        details: publishRow ? `status=${publishRow.status}, attempts=${publishRow.attempts}` : 'No pick_publish row found',
      });
    } catch (err) {
      stages.push({ name: 'Outbox Processing', ok: false, details: err.message || String(err) });
    }
  } else {
    stages.push({ name: 'Outbox Processing', ok: false, details: 'Skipped because canonical pick was not created' });
  }

  // Metrics for summary
  const { count: totalRaw } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'e2e-production-pipeline')
    .gte('created_at', startTs);
  const { count: totalUnified } = await supabase.from('unified_picks').select('*', { count: 'exact', head: true }).gte('created_at', startTs);
  const { count: totalPicks } = await supabase.from('picks').select('*', { count: 'exact', head: true }).gte('created_at', startTs);
  const { count: totalPublish } = await supabase
    .from('pick_publish')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startTs);

  const allOk = stages.every((s) => s.ok);
  const lines = [
    '# E2E Production Pipeline Summary',
    '',
    `**Run started:** ${startTs}`,
    `**Tenant ID:** ${TENANT_ID}`,
    `**Demo user ID:** ${USER_ID}`,
    '',
    '## Stage Results',
    ...stages.map((s) => `- ${s.ok ? '✅' : '❌'} ${s.name}: ${s.details}`),
    '',
    '## Pipeline Metrics',
    `- raw_props inserted (source=e2e-production-pipeline): ${totalRaw || 0}`,
    `- unified_picks created since start: ${totalUnified || 0}`,
    `- canonical picks created since start: ${totalPicks || 0}`,
    `- pick_publish rows since start: ${totalPublish || 0}`,
  ];

  if (publishRow) {
    lines.push(
      '',
      '## Discord Promotion Readiness',
      `- pick_publish.id: ${publishRow.id}`,
      `- status: ${publishRow.status}`,
      `- attempts: ${publishRow.attempts}`,
      `- ready_for_discord: ${['sent', 'processed', 'shadow-sent'].includes(publishRow.status)}`,
    );
  }

  fs.writeFileSync(SUMMARY_PATH, lines.join('\n'), 'utf8');
  log(`E2E summary written to ${SUMMARY_PATH}`);

  if (!allOk) {
    console.error('E2E production pipeline FAILED');
    process.exit(1);
  }

  console.log('E2E production pipeline PASSED');
  process.exit(0);
}

main().catch((err) => {
  console.error('E2E production pipeline orchestrator failed:', err.message || err);
  process.exit(1);
});

