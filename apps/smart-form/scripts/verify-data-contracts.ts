#!/usr/bin/env npx tsx
/**
 * SPRINT-SMARTFORM-DATA-CONTRACTS-INVENTORY-SURFACE-059
 *
 * Database Contract Verification Script
 *
 * Verifies that all required contract surfaces exist with correct columns.
 * Run as part of CI/CD or manually before deployment.
 *
 * Usage:
 *   npx tsx scripts/verify-data-contracts.ts
 *   npm run verify:contracts
 */

import { createClient } from '@supabase/supabase-js';

const CONTRACT_VERSION = '1.0.0';

// Contract surface definitions
const CONTRACT_SURFACES = {
  catalog_players_v1: {
    required_columns: [
      'player_id',
      'player_name',
      'sport',
      'team_id',
      'team_name',
      'team_abbr',
      'position',
      'search_text',
      'contract_version',
    ],
    description: 'Player catalog surface - derives player_name from full_name',
  },
  catalog_teams_v1: {
    required_columns: [
      'team_id',
      'team_name',
      'team_abbr',
      'sport',
      'search_text',
      'contract_version',
    ],
    description: 'Team catalog surface',
  },
  inventory_props_for_form_v1: {
    required_columns: [
      'prop_id',
      'sport',
      'game_id',
      'start_time',
      'matchup',
      'player_name',
      'team_abbr',
      'market_key',
      'line',
      'over_odds',
      'under_odds',
      'book',
      'prop_key',
      'contract_version',
    ],
    description: 'Props inventory surface - stable columns for Smart Form',
  },
  market_taxonomy_v1: {
    required_columns: [
      'sport',
      'market_key',
      'display_name',
      'category',
      'bet_type',
      'sort_order',
      'contract_version',
    ],
    description: 'Market taxonomy reference - allowed markets by sport',
  },
};

// Forbidden sources - routes should NOT query these directly
const FORBIDDEN_SOURCES = [
  'players',
  'teams',
  'raw_props',
  'mv_search_players',
  'mv_search_teams',
  'mv_props_for_form',
];

interface VerificationResult {
  surface: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: {
    missing_columns?: string[];
    row_count?: number;
    sample_data?: Record<string, unknown>[];
  };
}

async function verifyContracts(): Promise<VerificationResult[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Supabase credentials not found in environment');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const results: VerificationResult[] = [];

  console.log('========================================');
  console.log('SMART FORM DATA CONTRACT VERIFICATION');
  console.log(`Contract Version: ${CONTRACT_VERSION}`);
  console.log('========================================\n');

  // Check each contract surface
  for (const [surfaceName, config] of Object.entries(CONTRACT_SURFACES)) {
    console.log(`Checking ${surfaceName}...`);

    try {
      // Try to query the surface with all required columns
      const { data, error } = await supabase
        .from(surfaceName)
        .select(config.required_columns.join(','))
        .limit(5);

      if (error) {
        // Surface doesn't exist or has wrong columns
        results.push({
          surface: surfaceName,
          status: 'FAIL',
          message: `Surface query failed: ${error.message}`,
          details: {
            missing_columns: error.message.includes('column') ? [error.message] : undefined,
          },
        });
        console.log(`  ❌ FAIL: ${error.message}`);
        continue;
      }

      // Count total rows
      const { count, error: countError } = await supabase
        .from(surfaceName)
        .select('*', { count: 'exact', head: true });

      const rowCount = count || 0;

      // Check if surface has data
      if (rowCount === 0) {
        results.push({
          surface: surfaceName,
          status: 'WARN',
          message: 'Surface exists but has no data',
          details: { row_count: 0 },
        });
        console.log(`  ⚠️ WARN: Surface exists but has no data`);
      } else {
        results.push({
          surface: surfaceName,
          status: 'PASS',
          message: `Surface verified with ${rowCount} rows`,
          details: {
            row_count: rowCount,
            sample_data: (data?.slice(0, 2) || []) as unknown as Record<string, unknown>[],
          },
        });
        console.log(`  ✅ PASS: ${rowCount} rows`);
      }
    } catch (err) {
      results.push({
        surface: surfaceName,
        status: 'FAIL',
        message: `Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}`,
      });
      console.log(`  ❌ FAIL: Unexpected error`);
    }
  }

  // Check for market_taxonomy seed data
  console.log('\nChecking market_taxonomy seed data...');
  try {
    const { data: nbaMarkets } = await supabase
      .from('market_taxonomy_v1')
      .select('market_key')
      .eq('sport', 'NBA');

    const nbaCount = nbaMarkets?.length || 0;

    if (nbaCount >= 10) {
      console.log(`  ✅ NBA markets: ${nbaCount}`);
    } else {
      console.log(`  ⚠️ NBA markets: ${nbaCount} (expected 10+)`);
    }

    const { data: nflMarkets } = await supabase
      .from('market_taxonomy_v1')
      .select('market_key')
      .eq('sport', 'NFL');

    const nflCount = nflMarkets?.length || 0;

    if (nflCount >= 10) {
      console.log(`  ✅ NFL markets: ${nflCount}`);
    } else {
      console.log(`  ⚠️ NFL markets: ${nflCount} (expected 10+)`);
    }
  } catch (err) {
    console.log(`  ❌ Failed to check seed data`);
  }

  // Summary
  console.log('\n========================================');
  console.log('VERIFICATION SUMMARY');
  console.log('========================================');

  const passed = results.filter(r => r.status === 'PASS').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log(`  PASS: ${passed}`);
  console.log(`  WARN: ${warned}`);
  console.log(`  FAIL: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ CONTRACT VERIFICATION FAILED');
    console.log('   Fix the above issues before deploying.');
  } else if (warned > 0) {
    console.log('\n⚠️ CONTRACT VERIFICATION PASSED WITH WARNINGS');
    console.log('   Some surfaces may have no data.');
  } else {
    console.log('\n✅ CONTRACT VERIFICATION PASSED');
    console.log('   All surfaces exist with required columns.');
  }

  console.log('\n========================================');
  console.log('FORBIDDEN SOURCES (routes must NOT use)');
  console.log('========================================');
  for (const source of FORBIDDEN_SOURCES) {
    console.log(`  - ${source}`);
  }

  return results;
}

// JSON output for CI integration
async function main() {
  const results = await verifyContracts();

  // Write JSON results to stdout if --json flag is passed
  if (process.argv.includes('--json')) {
    console.log('\n--- JSON OUTPUT ---');
    console.log(
      JSON.stringify(
        {
          contract_version: CONTRACT_VERSION,
          timestamp: new Date().toISOString(),
          results,
          summary: {
            passed: results.filter(r => r.status === 'PASS').length,
            warned: results.filter(r => r.status === 'WARN').length,
            failed: results.filter(r => r.status === 'FAIL').length,
          },
        },
        null,
        2
      )
    );
  }

  // Exit with error code if any failures
  const hasFailed = results.some(r => r.status === 'FAIL');
  process.exit(hasFailed ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
