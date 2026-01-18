#!/usr/bin/env tsx
/**
 * Phase 1 Live-Fire Test Verification - SUPABASE PRODUCTION
 *
 * Verifies Odds API ingestion subsystem with real data from today
 * NO MOCKING OR ASSUMPTIONS - Only real data verification
 *
 * ✅ PRODUCTION CANARY APPROVED
 * ✅ Reads from Supabase v3 schema
 * ✅ Validates canonical entity attach rates
 *
 * Date: December 5, 2025
 */

import dotenv from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from workspace root
const rootEnvPath = resolve(__dirname, '../../../.env');
const sharedEnvPath = resolve(__dirname, '../../../.env.shared');
dotenv.config({ path: rootEnvPath });
dotenv.config({ path: sharedEnvPath });

// Validate required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ FATAL: Missing required Supabase environment variables');
  console.error('  - SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET');
  process.exit(1);
}

// Debug: Log environment variable status (sanitized)
console.log('\n🔍 ENVIRONMENT VARIABLE AUDIT:\n');
console.log(`  ODDS_API_KEY: ${process.env.ODDS_API_KEY ? `SET (${process.env.ODDS_API_KEY.length} chars)` : '❌ NOT SET'}`);
console.log(`  SUPABASE_URL: ${process.env.SUPABASE_URL}`);
console.log(`  SUPABASE_SERVICE_ROLE_KEY: SET (${process.env.SUPABASE_SERVICE_ROLE_KEY.length} chars)`);
console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
console.log('');

interface VerificationResult {
  phase: string;
  status: 'PASS' | 'FAIL';
  details: any;
  timestamp: string;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   PHASE 1 LIVE-FIRE TEST: ODDS INGESTION VERIFICATION      ║');
  console.log('║   TARGET: Supabase Production v3 Schema                     ║');
  console.log('║   DATE: December 5, 2025                                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const results: VerificationResult[] = [];

  // Connect to Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  try {
    // TASK 1: Verify Supabase connectivity and get today's date
    console.log('📡 TASK 1: Supabase Connection & Date Verification\n');

    const { data: healthCheck, error: healthError } = await supabase
      .from('raw_props')
      .select('id')
      .limit(1);

    if (healthError) {
      console.error('❌ Supabase connection failed:', healthError);
      process.exit(1);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    console.log(`✅ Supabase connected`);
    console.log(`✅ Today's date (UTC): ${todayStr}\n`);

    // TASK 2: Query today's raw_props from Supabase
    console.log('📊 TASK 2: Querying Today\'s Raw Props Data from Supabase\n');

    const { data: rawPropsToday, error: queryError } = await supabase
      .from('raw_props')
      .select('*')
      .gte('created_at', `${todayStr}T00:00:00Z`)
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('❌ Query failed:', queryError);
      process.exit(1);
    }

    const totalPropsToday = rawPropsToday?.length || 0;
    console.log(`📈 Total props ingested today: ${totalPropsToday}`);

    // TASK 3: Count props by sport/league
    console.log('\n🏀 TASK 3: Props Breakdown by Sport/League\n');

    const sportCounts: Record<string, number> = {};
    (rawPropsToday || []).forEach((prop: any) => {
      const sport = prop.sport || prop.league || 'UNKNOWN';
      sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    });

    Object.entries(sportCounts).forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count} props`);
    });

    const uniqueSports = Object.keys(sportCounts).length;
    console.log(`\n✅ Unique sports with data: ${uniqueSports}`);

    // TASK 4: Check canonical ID attach rates
    console.log('\n🔗 TASK 4: Canonical ID Attach Rates (CRITICAL FOR PHASE 1)\n');

    const propsWithGameId = (rawPropsToday || []).filter((p: any) => p.canonical_game_id).length;
    const propsWithPlayerId = (rawPropsToday || []).filter((p: any) => p.canonical_player_id).length;
    const propsWithEither = (rawPropsToday || []).filter((p: any) => p.canonical_game_id || p.canonical_player_id).length;

    const gameIdRate = totalPropsToday > 0 ? ((propsWithGameId / totalPropsToday) * 100).toFixed(1) : '0.0';
    const playerIdRate = totalPropsToday > 0 ? ((propsWithPlayerId / totalPropsToday) * 100).toFixed(1) : '0.0';
    const overallRate = totalPropsToday > 0 ? ((propsWithEither / totalPropsToday) * 100).toFixed(1) : '0.0';

    console.log(`  Props with canonical_game_id: ${propsWithGameId}/${totalPropsToday} (${gameIdRate}%)`);
    console.log(`  Props with canonical_player_id: ${propsWithPlayerId}/${totalPropsToday} (${playerIdRate}%)`);
    console.log(`  Props with either ID: ${propsWithEither}/${totalPropsToday}`);
    console.log(`  Overall attach rate: ${overallRate}%`);

    // TASK 5: Show 5 real example props
    console.log('\n📋 TASK 5: Sample Props with Real Data\n');

    const sampleProps = (rawPropsToday || []).slice(0, 5);
    sampleProps.forEach((prop: any, idx: number) => {
      console.log(`\n  Example ${idx + 1}:`);
      console.log(`    Player: ${prop.player_name || prop.name || 'N/A'}`);
      console.log(`    Sport: ${prop.sport || prop.league || 'N/A'}`);
      console.log(`    Market: ${prop.market || prop.prop_type || prop.stat_type || 'N/A'}`);
      console.log(`    Line: ${prop.line || 'N/A'}`);
      console.log(`    Over Odds: ${prop.over || prop.over_odds || 'N/A'}`);
      console.log(`    Under Odds: ${prop.under || prop.under_odds || 'N/A'}`);
      console.log(`    Game Time: ${prop.game_time || prop.event_time || 'N/A'}`);
      console.log(`    Source: ${prop.source || prop.provider || prop.data_source || 'N/A'}`);
      console.log(`    Canonical Game ID: ${prop.canonical_game_id || '❌ NOT ATTACHED'}`);
      console.log(`    Canonical Player ID: ${prop.canonical_player_id || '❌ NOT ATTACHED'}`);
      console.log(`    Created At: ${prop.created_at}`);
    });

    // TASK 6: Check for errors/warnings in data
    console.log('\n\n⚠️  TASK 6: Error & Warning Check\n');

    const errorProps = (rawPropsToday || []).filter((p: any) =>
      p.metadata?.error || p.metadata?.warning || p.error_message
    );

    console.log(`  Props with errors/warnings: ${errorProps.length}`);

    if (errorProps.length > 0 && errorProps.length <= 5) {
      errorProps.forEach((prop: any, idx: number) => {
        console.log(`\n    Error ${idx + 1}:`);
        console.log(`      Player: ${prop.player_name || prop.name}`);
        console.log(`      Error: ${prop.metadata?.error || prop.metadata?.warning || prop.error_message}`);
      });
    }

    // TASK 7: PASS/FAIL Determination
    console.log('\n\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                  PASS/FAIL DETERMINATION                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const criteria = {
      minProps: 50,
      minCanonicalRate: 70,
      minSports: 2
    };

    const checks = {
      propsIngested: totalPropsToday >= criteria.minProps,
      canonicalRate: parseFloat(overallRate) >= criteria.minCanonicalRate,
      sportsCount: uniqueSports >= criteria.minSports
    };

    console.log('Criteria Checks:');
    console.log(`  ✓ Props ingested (≥${criteria.minProps}): ${totalPropsToday} ${checks.propsIngested ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  ✓ Canonical ID attach rate (≥${criteria.minCanonicalRate}%): ${overallRate}% ${checks.canonicalRate ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  ✓ Unique sports (≥${criteria.minSports}): ${uniqueSports} ${checks.sportsCount ? '✅ PASS' : '❌ FAIL'}`);

    const overallPass = checks.propsIngested && checks.canonicalRate && checks.sportsCount;

    console.log('\n' + '═'.repeat(67));
    if (overallPass) {
      console.log('║                    🎉 OVERALL: PASS 🎉                        ║');
    } else {
      console.log('║                    ❌ OVERALL: FAIL ❌                        ║');
    }
    console.log('═'.repeat(67) + '\n');

    // TASK 8: Remediation steps if FAIL
    if (!overallPass) {
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║                   REMEDIATION STEPS                         ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝\n');

      if (!checks.propsIngested) {
        console.log('❌ ISSUE: Insufficient props ingested (<50)\n');
        console.log('  REMEDIATION:');
        console.log('    1. Verify Odds API key is configured in .env');
        console.log('    2. Run ingestion script: npx tsx apps/api/scripts/live-fire-phase1-ingestion.ts');
        console.log('    3. Check Supabase connectivity and quotas');
        console.log('    4. Verify Odds API credit limit not exceeded');
        console.log('');
      }

      if (!checks.canonicalRate) {
        console.log('❌ ISSUE: Low canonical ID attach rate (<70%)\n');
        console.log('  REMEDIATION:');
        console.log('    1. Verify ingestion used FeedAgent (not direct insert)');
        console.log('    2. Check canonical_games and canonical_players tables exist in Supabase');
        console.log('    3. Verify CanonicalMappingService is working in FeedAgent');
        console.log('    4. Re-run ingestion: npx tsx apps/api/scripts/live-fire-phase1-ingestion.ts');
        console.log('');
      }

      if (!checks.sportsCount) {
        console.log('❌ ISSUE: Insufficient sport diversity (<2 sports)\n');
        console.log('  REMEDIATION:');
        console.log('    1. Check which sports have games today');
        console.log('    2. Verify FeedAgent is configured for NBA, NCAAB, NHL');
        console.log('    3. Check Odds API returns data for requested sports');
        console.log('');
      }
    }

    // Summary results
    results.push({
      phase: 'Phase 1',
      status: overallPass ? 'PASS' : 'FAIL',
      details: {
        totalProps: totalPropsToday,
        sportBreakdown: sportCounts,
        canonicalAttachRate: overallRate,
        checks
      },
      timestamp: new Date().toISOString()
    });

    // Write results to file
    const fs = await import('fs');
    const resultsPath = 'out/ops/cutover/metrics/100/phase1-live-fire-results.json';

    // Ensure directory exists
    const dir = resultsPath.substring(0, resultsPath.lastIndexOf('/'));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Results written to: ${resultsPath}\n`);

  } catch (error) {
    console.error('\n❌ FATAL ERROR during verification:', error);
    process.exit(1);
  }
}

main();
