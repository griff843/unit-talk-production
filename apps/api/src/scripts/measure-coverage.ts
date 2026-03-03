/**
 * PICK-TYPE-COVERAGE-001: Phase A - Measure Contract Field Coverage
 *
 * Runs coverage queries against cloud Supabase and outputs JSON results.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/measure-coverage.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('🔍 PICK-TYPE-COVERAGE-001: Phase A - Coverage Measurement');
  console.log('='.repeat(70));
  console.log(`Target DB: ${SUPABASE_URL}`);
  console.log();

  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    target_db: SUPABASE_URL,
  };

  // 1. Overall coverage
  console.log('📊 1. Overall Coverage...');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: overall, error: overallErr } = await supabase.from('unified_picks').select('*');

  // We need to compute coverage manually since RPC might not be available
  const { data: allPicks, error: picksErr } = await supabase
    .from('unified_picks')
    .select(
      'id, sport, stat_type, pick_type, selection_type, matchup, game_start_time, units, odds, odds_decimal, leg_index, total_ticket_odds_american, total_ticket_odds_decimal, total_units, ticket_type, source, player_id, player_name, team_id, home_team_id, away_team_id, game_id, created_at, selection'
    );

  if (picksErr) {
    console.error('❌ Failed to fetch picks:', picksErr.message);
    process.exit(1);
  }

  const picks = allPicks || [];
  const total = picks.length;

  console.log(`   Total picks: ${total}`);

  // Calculate overall coverage
  const overallCoverage = {
    total_picks: total,
    pick_type: {
      filled: picks.filter(p => p.pick_type != null).length,
      pct:
        total > 0
          ? Math.round((1000 * picks.filter(p => p.pick_type != null).length) / total) / 10
          : 0,
    },
    selection_type: {
      filled: picks.filter(p => p.selection_type != null).length,
      pct:
        total > 0
          ? Math.round((1000 * picks.filter(p => p.selection_type != null).length) / total) / 10
          : 0,
    },
    matchup: {
      filled: picks.filter(p => p.matchup != null).length,
      pct:
        total > 0
          ? Math.round((1000 * picks.filter(p => p.matchup != null).length) / total) / 10
          : 0,
    },
    game_start_time: {
      filled: picks.filter(p => p.game_start_time != null).length,
      pct:
        total > 0
          ? Math.round((1000 * picks.filter(p => p.game_start_time != null).length) / total) / 10
          : 0,
    },
    units: {
      filled: picks.filter(p => p.units != null).length,
      pct:
        total > 0 ? Math.round((1000 * picks.filter(p => p.units != null).length) / total) / 10 : 0,
    },
    odds_decimal: {
      filled: picks.filter(p => p.odds_decimal != null).length,
      pct:
        total > 0
          ? Math.round((1000 * picks.filter(p => p.odds_decimal != null).length) / total) / 10
          : 0,
    },
    leg_index: {
      filled: picks.filter(p => p.leg_index != null).length,
      pct:
        total > 0
          ? Math.round((1000 * picks.filter(p => p.leg_index != null).length) / total) / 10
          : 0,
    },
    total_ticket_odds_american: {
      filled: picks.filter(p => p.total_ticket_odds_american != null).length,
      pct:
        total > 0
          ? Math.round(
              (1000 * picks.filter(p => p.total_ticket_odds_american != null).length) / total
            ) / 10
          : 0,
    },
    total_ticket_odds_decimal: {
      filled: picks.filter(p => p.total_ticket_odds_decimal != null).length,
      pct:
        total > 0
          ? Math.round(
              (1000 * picks.filter(p => p.total_ticket_odds_decimal != null).length) / total
            ) / 10
          : 0,
    },
    total_units: {
      filled: picks.filter(p => p.total_units != null).length,
      pct:
        total > 0
          ? Math.round((1000 * picks.filter(p => p.total_units != null).length) / total) / 10
          : 0,
    },
  };

  results.overall_coverage = overallCoverage;

  // Print overall coverage
  console.log('\n   OVERALL COVERAGE:');
  console.log('   ' + '-'.repeat(50));
  for (const [field, data] of Object.entries(overallCoverage)) {
    if (field === 'total_picks') continue;
    const d = data as { filled: number; pct: number };
    const status = d.pct >= 95 ? '✅' : d.pct >= 50 ? '⚠️' : '❌';
    console.log(
      `   ${status} ${field.padEnd(30)} ${String(d.filled).padStart(5)}/${total} (${d.pct}%)`
    );
  }

  // 2. Coverage by sport
  console.log('\n📊 2. Coverage by Sport...');
  const sportGroups: Record<string, typeof picks> = {};
  for (const p of picks) {
    const sport = p.sport || 'unknown';
    if (!sportGroups[sport]) sportGroups[sport] = [];
    sportGroups[sport].push(p);
  }

  const bySport: Record<string, any> = {};
  for (const [sport, sportPicks] of Object.entries(sportGroups)) {
    const n = sportPicks.length;
    bySport[sport] = {
      total: n,
      pick_type_pct:
        n > 0
          ? Math.round((1000 * sportPicks.filter(p => p.pick_type != null).length) / n) / 10
          : 0,
      selection_type_pct:
        n > 0
          ? Math.round((1000 * sportPicks.filter(p => p.selection_type != null).length) / n) / 10
          : 0,
      matchup_pct:
        n > 0 ? Math.round((1000 * sportPicks.filter(p => p.matchup != null).length) / n) / 10 : 0,
      units_pct:
        n > 0 ? Math.round((1000 * sportPicks.filter(p => p.units != null).length) / n) / 10 : 0,
      odds_decimal_pct:
        n > 0
          ? Math.round((1000 * sportPicks.filter(p => p.odds_decimal != null).length) / n) / 10
          : 0,
    };
  }
  results.by_sport = bySport;

  console.log('   ' + '-'.repeat(60));
  for (const [sport, data] of Object.entries(bySport).sort(
    (a, b) => (b[1] as any).total - (a[1] as any).total
  )) {
    const d = data as any;
    console.log(
      `   ${sport.padEnd(10)} n=${String(d.total).padStart(4)} | pick_type=${d.pick_type_pct}% | units=${d.units_pct}%`
    );
  }

  // 3. Coverage by inferred pick type
  console.log('\n📊 3. Coverage by Inferred Pick Type...');
  const inferPickType = (p: any): string => {
    const st = (p.stat_type || '').toLowerCase();
    if (['moneyline', 'ml', 'money line', 'winner', 'to_win'].includes(st)) return 'moneyline';
    if (['spread', 'point_spread', 'puck_line', 'run_line'].includes(st)) return 'spread';
    if (['total', 'over_under', 'o/u', 'over/under'].includes(st)) return 'total';
    if (st.startsWith('team_')) return 'team_prop';
    if (p.player_id || (p.player_name && p.player_name.trim() !== '')) return 'player_prop';
    return 'other/unknown';
  };

  const pickTypeGroups: Record<string, typeof picks> = {};
  for (const p of picks) {
    const inferred = inferPickType(p);
    if (!pickTypeGroups[inferred]) pickTypeGroups[inferred] = [];
    pickTypeGroups[inferred].push(p);
  }

  const byInferredType: Record<string, any> = {};
  for (const [itype, typePicks] of Object.entries(pickTypeGroups)) {
    const n = typePicks.length;
    byInferredType[itype] = {
      total: n,
      pick_type_pct:
        n > 0 ? Math.round((1000 * typePicks.filter(p => p.pick_type != null).length) / n) / 10 : 0,
      selection_type_pct:
        n > 0
          ? Math.round((1000 * typePicks.filter(p => p.selection_type != null).length) / n) / 10
          : 0,
      units_pct:
        n > 0 ? Math.round((1000 * typePicks.filter(p => p.units != null).length) / n) / 10 : 0,
      odds_decimal_pct:
        n > 0
          ? Math.round((1000 * typePicks.filter(p => p.odds_decimal != null).length) / n) / 10
          : 0,
    };
  }
  results.by_inferred_pick_type = byInferredType;

  // 4. Coverage by source
  console.log('\n📊 4. Coverage by Source...');
  const sourceGroups: Record<string, typeof picks> = {};
  for (const p of picks) {
    const src = p.source || 'unknown';
    if (!sourceGroups[src]) sourceGroups[src] = [];
    sourceGroups[src].push(p);
  }

  const bySource: Record<string, any> = {};
  for (const [src, srcPicks] of Object.entries(sourceGroups)) {
    const n = srcPicks.length;
    bySource[src] = {
      total: n,
      pick_type_pct:
        n > 0 ? Math.round((1000 * srcPicks.filter(p => p.pick_type != null).length) / n) / 10 : 0,
      matchup_pct:
        n > 0 ? Math.round((1000 * srcPicks.filter(p => p.matchup != null).length) / n) / 10 : 0,
      game_start_time_pct:
        n > 0
          ? Math.round((1000 * srcPicks.filter(p => p.game_start_time != null).length) / n) / 10
          : 0,
      game_id_pct:
        n > 0 ? Math.round((1000 * srcPicks.filter(p => p.game_id != null).length) / n) / 10 : 0,
    };
  }
  results.by_source = bySource;

  // 5. Coverage by ticket type
  console.log('\n📊 5. Coverage by Ticket Type...');
  const ticketTypeGroups: Record<string, typeof picks> = {};
  for (const p of picks) {
    const tt = p.ticket_type || 'unknown';
    if (!ticketTypeGroups[tt]) ticketTypeGroups[tt] = [];
    ticketTypeGroups[tt].push(p);
  }

  const byTicketType: Record<string, any> = {};
  for (const [tt, ttPicks] of Object.entries(ticketTypeGroups)) {
    const n = ttPicks.length;
    byTicketType[tt] = {
      total: n,
      pick_type_pct:
        n > 0 ? Math.round((1000 * ttPicks.filter(p => p.pick_type != null).length) / n) / 10 : 0,
      leg_index_pct:
        n > 0 ? Math.round((1000 * ttPicks.filter(p => p.leg_index != null).length) / n) / 10 : 0,
      total_odds_american_pct:
        n > 0
          ? Math.round(
              (1000 * ttPicks.filter(p => p.total_ticket_odds_american != null).length) / n
            ) / 10
          : 0,
      total_odds_decimal_pct:
        n > 0
          ? Math.round(
              (1000 * ttPicks.filter(p => p.total_ticket_odds_decimal != null).length) / n
            ) / 10
          : 0,
      total_units_pct:
        n > 0 ? Math.round((1000 * ttPicks.filter(p => p.total_units != null).length) / n) / 10 : 0,
    };
  }
  results.by_ticket_type = byTicketType;

  // 6. Missing cohorts
  console.log('\n📊 6. Missing Field Cohorts...');
  const parlayPicks = picks.filter(p => p.ticket_type === 'parlay');
  const apiPicks = picks.filter(p => p.source === 'api');

  const missingCohorts = {
    missing_pick_type: picks.filter(p => p.pick_type == null).length,
    missing_selection_type: picks.filter(p => p.selection_type == null).length,
    missing_units: picks.filter(p => p.units == null).length,
    missing_odds_decimal: picks.filter(p => p.odds_decimal == null).length,
    api_missing_matchup: apiPicks.filter(p => p.matchup == null).length,
    api_missing_game_start_time: apiPicks.filter(p => p.game_start_time == null).length,
    parlay_missing_leg_index: parlayPicks.filter(p => p.leg_index == null).length,
    parlay_missing_total_odds: parlayPicks.filter(p => p.total_ticket_odds_decimal == null).length,
  };
  results.missing_cohorts = missingCohorts;

  console.log('   ' + '-'.repeat(50));
  for (const [cohort, count] of Object.entries(missingCohorts)) {
    const status = count === 0 ? '✅' : '❌';
    console.log(`   ${status} ${cohort.padEnd(35)} ${count}`);
  }

  // 7. Recent picks sample
  console.log('\n📊 7. Recent Picks Sample (last 10)...');
  const recent = picks
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  results.recent_picks = recent.map(p => ({
    id: p.id.substring(0, 8) + '...',
    sport: p.sport,
    stat_type: p.stat_type,
    pick_type: p.pick_type,
    selection_type: p.selection_type,
    odds_decimal: p.odds_decimal,
    units: p.units,
    matchup: p.matchup ? p.matchup.substring(0, 30) : null,
  }));

  console.log('   ' + '-'.repeat(80));
  for (const p of recent) {
    console.log(
      `   ${p.id.substring(0, 8)}... | ${(p.sport || '').padEnd(6)} | pick_type=${(p.pick_type || 'null').padEnd(12)} | units=${p.units || 'null'}`
    );
  }

  // Save results
  const outputDir = path.join(process.cwd(), 'out/pick-type-coverage/2026-02-11');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'A2_coverage_output.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log(`\n📄 Results saved to: ${outputPath}`);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 BASELINE COVERAGE SUMMARY:');
  console.log('='.repeat(70));
  console.log(`Total picks: ${total}`);
  console.log(`\nContract Column Coverage:`);
  console.log(`  pick_type:       ${overallCoverage.pick_type.pct}%`);
  console.log(`  selection_type:  ${overallCoverage.selection_type.pct}%`);
  console.log(`  matchup:         ${overallCoverage.matchup.pct}%`);
  console.log(`  game_start_time: ${overallCoverage.game_start_time.pct}%`);
  console.log(`  units:           ${overallCoverage.units.pct}%`);
  console.log(`  odds_decimal:    ${overallCoverage.odds_decimal.pct}%`);
  console.log(`  leg_index:       ${overallCoverage.leg_index.pct}% (parlay-specific)`);
  console.log(
    `  total_odds_*:    ${overallCoverage.total_ticket_odds_decimal.pct}% (parlay-specific)`
  );
  console.log(`  total_units:     ${overallCoverage.total_units.pct}% (parlay-specific)`);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
