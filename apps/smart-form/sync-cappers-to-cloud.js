#!/usr/bin/env node
/**
 * REFERENCE-PARITY-002 — Cloud Capper Roster Sync
 *
 * Upserts the canonical 11-capper production roster into the cloud Supabase
 * `users` table and deactivates test fixtures.
 *
 * SAFE BY DEFAULT: Runs in DRYRUN mode unless --apply is passed.
 *
 * Usage (inside smart-form container):
 *   node /app/scripts/ops/sync-cappers-to-cloud.js           # DRYRUN
 *   node /app/scripts/ops/sync-cappers-to-cloud.js --apply   # APPLY
 *
 * Or from host via docker-compose:
 *   docker-compose exec smart-form node scripts/ops/sync-cappers-to-cloud.js
 *   docker-compose exec smart-form node scripts/ops/sync-cappers-to-cloud.js --apply
 */

const { createClient } = require('@supabase/supabase-js');

const DRYRUN = !process.argv.includes('--apply');
const TENANT_ID = '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a';

// ── Canonical Production Roster (from apps/api/src/config/env.ts) ──
const CANONICAL_CAPPERS = [
  { username: 'Griff843',     tier: 'vip_plus', capper_tier: 'platinum' },
  { username: 'Vicgo',        tier: 'vip',      capper_tier: 'gold' },
  { username: 'Sauced',       tier: 'vip',      capper_tier: 'gold' },
  { username: 'MoneyReef',    tier: 'vip_plus', capper_tier: 'gold' },
  { username: 'Squirrel',     tier: 'vip',      capper_tier: 'gold' },
  { username: 'Noahthegoon',  tier: 'vip',      capper_tier: 'gold' },
  { username: 'KingRo623',    tier: 'vip',      capper_tier: 'gold' },
  { username: 'Jaybird',      tier: 'vip',      capper_tier: 'gold' },
  { username: 'dub',          tier: 'vip',      capper_tier: 'gold' },
  { username: 'Ziplock',      tier: 'vip',      capper_tier: 'gold' },
  { username: 'Polo',         tier: 'vip',      capper_tier: 'gold' },
];

// ── Test fixtures to deactivate (preserve rows for FK integrity) ──
const DEACTIVATE_IDS = [
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', // griff843 duplicate (42 picks)
  'cccccccc-cccc-cccc-cccc-cccccccccccc', // automation_bot
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', // e2e_test_capper
  '012602a5-52e8-457e-838e-45f0f43edfc3', // E2E_TestCapper (has picks)
  '724ed7be-a74f-4c7c-9cab-32905d1b2d15', // phase5-test-user
  '00000000-0000-0000-0000-000000000001', // test_user_phase13 (has picks)
];

// ── Existing griff843 row to UPDATE (not insert) ──
const GRIFF_EXISTING_ID = 'ee082554-79f1-4c56-a532-938dee989747';

async function main() {
  console.log('='.repeat(60));
  console.log(`REFERENCE-PARITY-002 — Capper Roster Sync`);
  console.log(`Mode: ${DRYRUN ? 'DRYRUN (no changes)' : 'APPLY (writing to cloud)'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // Validate env
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  console.log(`Supabase URL: ${url}`);

  const sb = createClient(url, key);

  // ── Step 1: Read current state ──
  console.log('\n--- STEP 1: Current cloud state ---');
  const { data: currentUsers, error: readErr } = await sb
    .from('users')
    .select('id, username, active, is_active, tier, capper_tier')
    .order('username');
  if (readErr) { console.error('Read error:', readErr); process.exit(1); }
  console.log(`Current users: ${currentUsers.length}`);
  currentUsers.forEach(u => console.log(`  ${u.username} (${u.id.slice(0,8)}...) active=${u.active}`));

  // Build lookup by lowercase username
  const existingByName = {};
  currentUsers.forEach(u => {
    const key = u.username.toLowerCase();
    if (!existingByName[key]) existingByName[key] = [];
    existingByName[key].push(u);
  });

  // ── Step 2: Plan operations ──
  console.log('\n--- STEP 2: Planned operations ---');
  const ops = { inserts: [], updates: [], deactivations: [] };

  for (const capper of CANONICAL_CAPPERS) {
    const lowerName = capper.username.toLowerCase();
    const existing = existingByName[lowerName];

    if (lowerName === 'griff843') {
      // Special case: update the canonical row, do NOT insert
      ops.updates.push({
        id: GRIFF_EXISTING_ID,
        username: capper.username,
        tier: capper.tier,
        capper_tier: capper.capper_tier,
        active: true,
        is_active: true,
        updated_at: new Date().toISOString(),
      });
      console.log(`  UPDATE: ${capper.username} (${GRIFF_EXISTING_ID.slice(0,8)}...) — fix casing + tier`);
    } else if (existing && existing.length > 0) {
      // Capper exists — update tier/active
      const row = existing[0];
      ops.updates.push({
        id: row.id,
        username: capper.username,
        tier: capper.tier,
        capper_tier: capper.capper_tier,
        active: true,
        is_active: true,
        updated_at: new Date().toISOString(),
      });
      console.log(`  UPDATE: ${capper.username} (${row.id.slice(0,8)}...) — existing row`);
    } else {
      // New capper — insert
      ops.inserts.push({
        username: capper.username,
        discord_id: `${capper.username.toLowerCase()}_production`,
        tier: capper.tier,
        capper_tier: capper.capper_tier,
        active: true,
        is_active: true,
        tenant_id: TENANT_ID,
        meta: { created_by: 'reference-parity-002', created_at: new Date().toISOString() },
      });
      console.log(`  INSERT: ${capper.username} — new row`);
    }
  }

  // Plan deactivations
  for (const id of DEACTIVATE_IDS) {
    const user = currentUsers.find(u => u.id === id);
    if (user && user.active) {
      ops.deactivations.push(id);
      console.log(`  DEACTIVATE: ${user.username} (${id.slice(0,8)}...)`);
    } else if (user && !user.active) {
      console.log(`  SKIP: ${user.username} (${id.slice(0,8)}...) — already inactive`);
    } else {
      console.log(`  SKIP: ${id.slice(0,8)}... — not found in cloud`);
    }
  }

  console.log(`\nSummary: ${ops.inserts.length} inserts, ${ops.updates.length} updates, ${ops.deactivations.length} deactivations`);

  if (DRYRUN) {
    console.log('\n*** DRYRUN MODE — No changes applied ***');
    console.log('Re-run with --apply to execute.');
    console.log('\n--- DRYRUN PLAN (JSON) ---');
    console.log(JSON.stringify(ops, null, 2));
    return;
  }

  // ── Step 3: Execute operations ──
  console.log('\n--- STEP 3: Executing operations ---');
  let errors = 0;

  // 3a: Inserts
  if (ops.inserts.length > 0) {
    console.log(`\nInserting ${ops.inserts.length} new cappers...`);
    const { data: inserted, error: insertErr } = await sb
      .from('users')
      .insert(ops.inserts)
      .select('id, username');
    if (insertErr) {
      console.error('INSERT ERROR:', insertErr);
      errors++;
    } else {
      inserted.forEach(u => console.log(`  Inserted: ${u.username} (${u.id})`));
    }
  }

  // 3b: Updates (one at a time to avoid conflicts)
  for (const upd of ops.updates) {
    const { id, ...fields } = upd;
    const { error: updErr } = await sb
      .from('users')
      .update(fields)
      .eq('id', id);
    if (updErr) {
      console.error(`UPDATE ERROR for ${id}:`, updErr);
      errors++;
    } else {
      console.log(`  Updated: ${fields.username} (${id})`);
    }
  }

  // 3c: Deactivations
  if (ops.deactivations.length > 0) {
    console.log(`\nDeactivating ${ops.deactivations.length} test fixtures...`);
    const { error: deactErr } = await sb
      .from('users')
      .update({ active: false, is_active: false, updated_at: new Date().toISOString() })
      .in('id', ops.deactivations);
    if (deactErr) {
      console.error('DEACTIVATE ERROR:', deactErr);
      errors++;
    } else {
      console.log(`  Deactivated ${ops.deactivations.length} rows.`);
    }
  }

  // ── Step 4: Verify ──
  console.log('\n--- STEP 4: Post-apply verification ---');
  const { data: postUsers, error: postErr } = await sb
    .from('users')
    .select('id, username, active, is_active, tier, capper_tier')
    .order('username');
  if (postErr) { console.error('Post-read error:', postErr); }

  const activeCappers = postUsers.filter(u => u.active);
  const inactiveCappers = postUsers.filter(u => !u.active);

  console.log(`\nTotal users: ${postUsers.length}`);
  console.log(`Active: ${activeCappers.length}`);
  activeCappers.forEach(u => console.log(`  [ACTIVE] ${u.username} (${u.id.slice(0,8)}...) tier=${u.tier} capper_tier=${u.capper_tier}`));
  console.log(`Inactive: ${inactiveCappers.length}`);
  inactiveCappers.forEach(u => console.log(`  [INACTIVE] ${u.username} (${u.id.slice(0,8)}...)`));

  console.log(`\nErrors: ${errors}`);
  console.log(errors === 0 ? 'RESULT: SUCCESS' : 'RESULT: PARTIAL FAILURE');

  // Output JSON for proof
  console.log('\n--- POST-APPLY STATE (JSON) ---');
  console.log(JSON.stringify(postUsers, null, 2));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
