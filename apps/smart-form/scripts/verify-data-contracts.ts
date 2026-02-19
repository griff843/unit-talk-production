#!/usr/bin/env npx tsx
/**
 * SPRINT-SMARTFORM-CONTRACT-EXECUTION-PROOF-060
 *
 * Database Contract Verification Script
 *
 * Verifies that all required contract surfaces exist with correct columns.
 * Run as part of CI/CD or manually before deployment.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 *   NEXT_PUBLIC_SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *
 * HOW TO SET ENVIRONMENT:
 *   Option 1: Create apps/smart-form/.env with the variables above
 *   Option 2: Export variables in your shell
 *   Option 3: Pass inline: NEXT_PUBLIC_SUPABASE_URL=... npx tsx scripts/verify-data-contracts.ts
 *
 * Usage:
 *   npx tsx scripts/verify-data-contracts.ts
 *   npx tsx scripts/verify-data-contracts.ts --json
 *   pnpm -C apps/smart-form verify:contracts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file from the smart-form directory
const envPath = path.resolve(__dirname, '..', '.env');
const envLocalPath = path.resolve(__dirname, '..', '.env.local');

// Try loading .env.local first (higher priority), then .env
dotenv.config({ path: envLocalPath });
dotenv.config({ path: envPath });

const CONTRACT_VERSION = '1.0.1';

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
  manual_inventory_for_form_v1: {
    required_columns: [
      'sport',
      'player_id',
      'player_name',
      'team_abbr',
      'market_key',
      'avg_line',
      'count_recent',
      'last_seen_at',
      'contract_version',
    ],
    description: 'Manual inventory surface - prop suggestions from unified_picks',
  },
  market_usage_stats_v1: {
    required_columns: [
      'sport',
      'market_key',
      'usage_count',
      'unique_players',
      'last_used_at',
      'contract_version',
    ],
    description: 'Market usage statistics - for sorting stat types by popularity',
  },
};

// Forbidden sources - routes should NOT query these directly
const FORBIDDEN_SOURCES = [
  'players',
  'teams',
  'raw_props',
  'unified_picks',
  'mv_search_players',
  'mv_search_teams',
  'mv_props_for_form',
];

// Required NBA markets (per sprint spec)
const REQUIRED_NBA_MARKETS = [
  'PTS',
  'REB',
  'AST',
  '3PM',
  'PRA',
  'PR',
  'PA',
  'RA',
  'BLK',
  'STL',
  'TO',
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

function printEnvironmentHelp(): void {
  console.error(`
╔══════════════════════════════════════════════════════════════════════════════╗
║  ERROR: Supabase credentials not found in environment                        ║
╚══════════════════════════════════════════════════════════════════════════════╝

REQUIRED ENVIRONMENT VARIABLES:
  • NEXT_PUBLIC_SUPABASE_URL     - Your Supabase project URL
  • SUPABASE_SERVICE_ROLE_KEY    - Service role key (preferred)
    OR
  • NEXT_PUBLIC_SUPABASE_ANON_KEY - Anon key (limited permissions)

HOW TO FIX:

  Option 1: Create a .env file
  ─────────────────────────────
  Create file: apps/smart-form/.env

  Contents:
    NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

  Option 2: Export in shell
  ─────────────────────────
    export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

  Option 3: Inline execution
  ──────────────────────────
    NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-data-contracts.ts

CURRENT STATE:
  NEXT_PUBLIC_SUPABASE_URL:    ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ SET' : '❌ NOT SET'}
  SUPABASE_SERVICE_ROLE_KEY:   ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ SET' : '❌ NOT SET'}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ SET' : '❌ NOT SET'}

See: apps/smart-form/.env.example for a template
`);
}

async function verifyContracts(): Promise<VerificationResult[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    printEnvironmentHelp();
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const results: VerificationResult[] = [];

  console.log('========================================');
  console.log('SMART FORM DATA CONTRACT VERIFICATION');
  console.log(`Contract Version: ${CONTRACT_VERSION}`);
  console.log('Sprint: SMARTFORM-CONTRACT-EXECUTION-PROOF-060');
  console.log('========================================\n');
  console.log(`Supabase URL: ${supabaseUrl.substring(0, 30)}...`);
  console.log('');

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
      const { count } = await supabase
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
  console.log('\n========================================');
  console.log('CHECKING REQUIRED NBA MARKETS');
  console.log('========================================');
  try {
    const { data: nbaMarkets } = await supabase
      .from('market_taxonomy_v1')
      .select('market_key')
      .eq('sport', 'NBA');

    const nbaMarketKeys = new Set(
      (nbaMarkets || []).map((m: { market_key: string }) => m.market_key)
    );
    const missingMarkets = REQUIRED_NBA_MARKETS.filter(m => !nbaMarketKeys.has(m));

    if (missingMarkets.length === 0) {
      console.log(`  ✅ All ${REQUIRED_NBA_MARKETS.length} required NBA markets present`);
      console.log(`     Markets: ${REQUIRED_NBA_MARKETS.join(', ')}`);
    } else {
      console.log(`  ❌ FAIL: Missing NBA markets: ${missingMarkets.join(', ')}`);
      results.push({
        surface: 'market_taxonomy_v1',
        status: 'FAIL',
        message: `Missing required NBA markets: ${missingMarkets.join(', ')}`,
        details: { missing_columns: missingMarkets },
      });
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
    console.log('   Some surfaces may have no data (expected if no manual submissions yet).');
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

  console.log('\n========================================');
  console.log('CONTRACT SURFACES');
  console.log('========================================');
  for (const [name, config] of Object.entries(CONTRACT_SURFACES)) {
    console.log(`  - ${name}: ${config.description}`);
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
