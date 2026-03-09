/**
 * SPRINT-044G: Provider Offers Pipeline Runtime Validation
 *
 * Validates the end-to-end SGO → provider_offers ingestion path:
 *   1. Provider registry has 'sgo'
 *   2. Baseline row counts
 *   3. Live SGO ingestion (canonical pass/fail)
 *   4. SGO row integrity (provider, market_key, event_id populated)
 *   5. Canonical ingestion check (provider_offers vs raw_props)
 *   6. FK resolution (participant_id → participants)
 *   7. Post-ingestion delta (no duplicate explosion)
 *   8. Downstream grading readiness
 *
 * Usage:
 *   cd apps/api && npx tsx src/scripts/validate-provider-offers-pipeline.ts
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load from repo root .env (script runs from apps/api)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Track results
interface PhaseResult {
  phase: number;
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  details: string[];
}

const results: PhaseResult[] = [];
let baselineCounts = {
  total: 0,
  bySgo: 0,
  withParticipant: 0,
  withGraded: 0,
};
let ingestionTimestamp: string;
let sgoInserted = 0;
let sgoUpdated = 0;

function log(msg: string) {
  console.log(msg);
}

function phaseHeader(num: number, name: string) {
  log(`\nPhase ${num}: ${name}`);
}

function addResult(
  phase: number,
  name: string,
  status: 'PASS' | 'WARN' | 'FAIL',
  details: string[]
) {
  results.push({ phase, name, status, details });
  const pad = '.'.repeat(Math.max(1, 48 - name.length));
  log(`  ${pad} ${status}`);
  details.forEach(d => log(`  - ${d}`));
}

// ─── Phase 1: Provider Registry ─────────────────────────────────────────────

async function phase1_providerRegistry() {
  phaseHeader(1, 'Provider Registry');

  const { data: sgoRow, error: sgoErr } = await supabase
    .from('provider_registry')
    .select('*')
    .eq('code', 'sgo')
    .maybeSingle();

  const { count: totalProviders } = await supabase
    .from('provider_registry')
    .select('*', { count: 'exact', head: true });

  if (sgoErr) {
    addResult(1, 'Provider Registry', 'FAIL', [`Query error: ${sgoErr.message}`]);
    return;
  }

  if (!sgoRow) {
    addResult(1, 'Provider Registry', 'FAIL', [
      'sgo NOT found in provider_registry',
      `Total providers: ${totalProviders}`,
    ]);
    return;
  }

  addResult(1, 'Provider Registry', 'PASS', [
    `sgo: found (priority=${sgoRow.priority}, player_props=${sgoRow.has_player_props})`,
    `Total providers: ${totalProviders}`,
  ]);
}

// ─── Phase 2: Pre-Ingestion Baseline ────────────────────────────────────────

async function phase2_baseline() {
  phaseHeader(2, 'Pre-Ingestion Baseline');

  const { count: total } = await supabase
    .from('provider_offers')
    .select('*', { count: 'exact', head: true });

  const { count: sgoCount } = await supabase
    .from('provider_offers')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'sgo');

  const { count: withParticipant } = await supabase
    .from('provider_offers')
    .select('*', { count: 'exact', head: true })
    .not('participant_id', 'is', null);

  const { count: withGraded } = await supabase
    .from('provider_offers')
    .select('*', { count: 'exact', head: true })
    .not('graded_at', 'is', null);

  baselineCounts = {
    total: total || 0,
    bySgo: sgoCount || 0,
    withParticipant: withParticipant || 0,
    withGraded: withGraded || 0,
  };

  addResult(2, 'Pre-Ingestion Baseline', 'PASS', [
    `provider_offers: ${baselineCounts.total} total`,
    `SGO rows: ${baselineCounts.bySgo}`,
    `With participant_id: ${baselineCounts.withParticipant}`,
    `With graded_at: ${baselineCounts.withGraded}`,
  ]);
}

// ─── Phase 3: Live SGO Ingestion ────────────────────────────────────────────

async function phase3_liveIngestion() {
  phaseHeader(3, 'Live SGO Ingestion');

  ingestionTimestamp = new Date().toISOString();

  try {
    const { ingestSGOProviderOffers } =
      await import('../agents/IngestionAgent/providerOffersIngestion');

    const sgoResult = await ingestSGOProviderOffers('basketball_nba');
    sgoInserted = sgoResult.inserted;
    sgoUpdated = sgoResult.updated;

    const details = [
      `SGO: inserted=${sgoResult.inserted}, updated=${sgoResult.updated}, error=${sgoResult.error || 'none'}`,
    ];

    // OddsAPI as contextual baseline only (does NOT affect pass/fail)
    try {
      const { ingestProviderOffers } =
        await import('../agents/IngestionAgent/providerOffersIngestion');
      const oddsResult = await ingestProviderOffers('basketball_nba');
      details.push(
        `OddsAPI (baseline only): inserted=${oddsResult.inserted}, updated=${oddsResult.updated}`
      );
    } catch (oddsErr) {
      details.push(`OddsAPI (baseline only): skipped (${(oddsErr as Error).message})`);
    }

    if (sgoResult.error) {
      addResult(3, 'Live SGO Ingestion', 'FAIL', [
        ...details,
        `SGO ingestion returned error: ${sgoResult.error}`,
      ]);
    } else if (sgoResult.inserted > 0 || sgoResult.updated > 0) {
      addResult(3, 'Live SGO Ingestion', 'PASS', details);
    } else {
      addResult(3, 'Live SGO Ingestion', 'WARN', [
        ...details,
        'SGO returned 0 inserted and 0 updated (may be off-season or no live games)',
      ]);
    }
  } catch (err) {
    addResult(3, 'Live SGO Ingestion', 'FAIL', [`Exception: ${(err as Error).message}`]);
  }
}

// ─── Phase 4: SGO Row Integrity ─────────────────────────────────────────────

async function phase4_sgoRowIntegrity() {
  phaseHeader(4, 'SGO Row Integrity');

  const { data: sgoRows, error } = await supabase
    .from('provider_offers')
    .select('id, provider, provider_market_key, provider_event_id')
    .eq('provider', 'sgo')
    .gte('created_at', ingestionTimestamp)
    .limit(100);

  if (error) {
    addResult(4, 'SGO Row Integrity', 'FAIL', [`Query error: ${error.message}`]);
    return;
  }

  if (!sgoRows || sgoRows.length === 0) {
    const status = sgoInserted === 0 ? 'WARN' : 'FAIL';
    addResult(4, 'SGO Row Integrity', status, [
      `No SGO rows found after ingestion timestamp (inserted=${sgoInserted})`,
    ]);
    return;
  }

  let providerOk = 0;
  let marketKeyOk = 0;
  let eventIdOk = 0;
  const failures: string[] = [];

  for (const row of sgoRows) {
    if (row.provider === 'sgo') providerOk++;
    else failures.push(`Row ${row.id}: provider='${row.provider}' (expected 'sgo')`);

    if (row.provider_market_key) marketKeyOk++;
    else failures.push(`Row ${row.id}: provider_market_key is null/empty`);

    if (row.provider_event_id) eventIdOk++;
    else failures.push(`Row ${row.id}: provider_event_id is null/empty`);
  }

  const total = sgoRows.length;
  const allGood = providerOk === total && marketKeyOk === total && eventIdOk === total;

  addResult(4, 'SGO Row Integrity', allGood ? 'PASS' : 'FAIL', [
    `SGO rows checked: ${total}`,
    `provider='sgo': ${providerOk}/${total}`,
    `provider_market_key populated: ${marketKeyOk}/${total}`,
    `provider_event_id populated: ${eventIdOk}/${total}`,
    ...failures.slice(0, 5),
  ]);
}

// ─── Phase 5: Canonical Ingestion Check ─────────────────────────────────────

async function phase5_canonicalCheck() {
  phaseHeader(5, 'Canonical Ingestion Check');

  // provider_offers SGO delta
  const { count: newSgoCount } = await supabase
    .from('provider_offers')
    .select('*', { count: 'exact', head: true })
    .eq('provider', 'sgo');

  const sgoDelta = (newSgoCount || 0) - baselineCounts.bySgo;

  // raw_props recent activity (informational only)
  let rawPropsDelta = 0;
  try {
    const { count: rawPropsRecent } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', ingestionTimestamp);
    rawPropsDelta = rawPropsRecent || 0;
  } catch {
    // raw_props query failure is non-critical
  }

  const details = [
    `provider_offers new SGO rows: +${sgoDelta} (CANONICAL - determines PASS)`,
    `raw_props mirrored rows: +${rawPropsDelta} (informational only)`,
  ];

  if (sgoDelta > 0) {
    addResult(5, 'Canonical Ingestion Check', 'PASS', details);
  } else if (sgoInserted === 0 && sgoUpdated === 0) {
    addResult(5, 'Canonical Ingestion Check', 'WARN', [
      ...details,
      'No SGO data available (Phase 3 also returned 0)',
    ]);
  } else {
    addResult(5, 'Canonical Ingestion Check', 'FAIL', [
      ...details,
      `Expected SGO rows but delta is ${sgoDelta}`,
    ]);
  }
}

// ─── Phase 6: FK Resolution Verification ────────────────────────────────────

async function phase6_fkResolution() {
  phaseHeader(6, 'FK Resolution');

  const { data: recentRows, error } = await supabase
    .from('provider_offers')
    .select('id, participant_id, meta')
    .gte('created_at', ingestionTimestamp)
    .limit(100);

  if (error) {
    addResult(6, 'FK Resolution', 'FAIL', [`Query error: ${error.message}`]);
    return;
  }

  if (!recentRows || recentRows.length === 0) {
    const status = sgoInserted === 0 ? 'WARN' : 'FAIL';
    addResult(6, 'FK Resolution', status, ['No recent rows to check']);
    return;
  }

  const withParticipant = recentRows.filter(r => r.participant_id);
  let resolvedOk = 0;
  let resolutionFailures = 0;
  const failureDetails: string[] = [];

  // Verify participant FKs resolve
  if (withParticipant.length > 0) {
    const participantIds = withParticipant.map(r => r.participant_id);
    const { data: participants } = await supabase
      .from('participants')
      .select('id, type')
      .in('id', participantIds);

    const foundIds = new Set((participants || []).map(p => p.id));
    for (const row of withParticipant) {
      if (foundIds.has(row.participant_id)) {
        resolvedOk++;
      } else {
        resolutionFailures++;
        failureDetails.push(`Row ${row.id}: participant_id ${row.participant_id} not found`);
      }
    }
  }

  // Check for unresolved provider_participant_id
  const withoutParticipant = recentRows.filter(r => !r.participant_id);
  let unresolvedWithPpid = 0;
  for (const row of withoutParticipant) {
    const ppid = row.meta?.provider_participant_id;
    if (ppid) {
      unresolvedWithPpid++;
      failureDetails.push(
        `Row ${row.id}: has provider_participant_id='${ppid}' but participant_id is NULL`
      );
    }
  }

  const totalFailures = resolutionFailures + unresolvedWithPpid;

  addResult(6, 'FK Resolution', totalFailures === 0 ? 'PASS' : 'FAIL', [
    `Rows with participant_id: ${withParticipant.length} (${resolvedOk} resolve to valid participants)`,
    `Resolution failures: ${totalFailures}`,
    ...failureDetails.slice(0, 5),
  ]);
}

// ─── Phase 7: Post-Ingestion Delta ──────────────────────────────────────────

async function phase7_postDelta() {
  phaseHeader(7, 'Post-Ingestion Delta');

  const { count: newTotal } = await supabase
    .from('provider_offers')
    .select('*', { count: 'exact', head: true });

  const delta = (newTotal || 0) - baselineCounts.total;
  const expectedMax = Math.max(sgoInserted, 1) * 10;
  const duplicateExplosion = delta > expectedMax && sgoInserted > 0;

  const details = [`Before: ${baselineCounts.total}, After: ${newTotal || 0}, Delta: +${delta}`];

  if (duplicateExplosion) {
    details.push(`DUPLICATE EXPLOSION: delta ${delta} >> expected ~${sgoInserted} inserts`);
    addResult(7, 'Post-Ingestion Delta', 'WARN', details);
  } else {
    details.push('No duplicate explosion detected');
    addResult(7, 'Post-Ingestion Delta', 'PASS', details);
  }
}

// ─── Phase 8: Downstream Grading Readiness ──────────────────────────────────

async function phase8_gradingReadiness() {
  phaseHeader(8, 'Grading Readiness');

  const { data: ungradedRows, error } = await supabase
    .from('provider_offers')
    .select('id, event_id, market_id, provider, line, snapshot_at')
    .is('graded_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    addResult(8, 'Grading Readiness', 'FAIL', [`Query error: ${error.message}`]);
    return;
  }

  if (!ungradedRows || ungradedRows.length === 0) {
    addResult(8, 'Grading Readiness', 'WARN', ['No ungraded rows found']);
    return;
  }

  let fieldsOk = 0;
  let eventResolves = 0;
  const fieldFailures: string[] = [];

  // Check required fields
  for (const row of ungradedRows) {
    const hasRequired = row.event_id && row.market_id && row.provider && row.snapshot_at;
    if (hasRequired) fieldsOk++;
    else fieldFailures.push(`Row ${row.id}: missing required field(s)`);
  }

  // Check event FK resolution
  const eventIds = [...new Set(ungradedRows.filter(r => r.event_id).map(r => r.event_id))];
  if (eventIds.length > 0) {
    const { data: events } = await supabase.from('events').select('id').in('id', eventIds);
    eventResolves = events?.length || 0;
  }

  const total = ungradedRows.length;
  addResult(8, 'Grading Readiness', fieldsOk === total ? 'PASS' : 'FAIL', [
    `Ungraded rows available: ${total}`,
    `Required fields present: ${fieldsOk}/${total}`,
    `Event FK resolves: ${eventResolves}/${eventIds.length} unique events`,
    ...fieldFailures.slice(0, 3),
  ]);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log('══════════════════════════════════════════════════');
  log(' SPRINT-044G: Provider Offers Pipeline Validation');
  log('══════════════════════════════════════════════════');

  await phase1_providerRegistry();
  await phase2_baseline();
  await phase3_liveIngestion();
  await phase4_sgoRowIntegrity();
  await phase5_canonicalCheck();
  await phase6_fkResolution();
  await phase7_postDelta();
  await phase8_gradingReadiness();

  // Summary
  log('\n══════════════════════════════════════════════════');
  const passed = results.filter(r => r.status === 'PASS').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  log(` RESULT: ${passed} PASSED, ${warned} WARN, ${failed} FAILED (of ${results.length})`);
  log('══════════════════════════════════════════════════');

  if (failed > 0) {
    log('\nFailed phases:');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        log(`  Phase ${r.phase}: ${r.name}`);
        r.details.forEach(d => log(`    - ${d}`));
      });
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
