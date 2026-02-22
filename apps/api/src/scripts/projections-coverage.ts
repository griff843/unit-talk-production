/* eslint-disable no-console, security/detect-object-injection, max-lines-per-function, complexity, max-depth */
/**
 * Projections Coverage Report
 * Sprint: SPRINT-PROJECTIONS-FOUNDATION-099A
 *
 * Reports projection coverage for today's picks by sport/stat_type.
 *
 * Usage: npx tsx src/scripts/projections-coverage.ts [--date YYYY-MM-DD]
 */

import { createClient } from '@supabase/supabase-js';

import { getProjectionEngine, ACTIVE_MODEL_VERSIONS } from '../services/projections';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const SUPPORTED_SPORTS = ['NBA', 'MLB', 'NFL', 'NHL'];

// ============================================================================
// HELPERS
// ============================================================================

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatTable(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => (r[i] || '').length))
  );

  const separator = colWidths.map(w => '-'.repeat(w + 2)).join('+');
  const formatRow = (row: string[]) =>
    row.map((cell, i) => ` ${(cell || '').padEnd(colWidths[i] ?? 0)} `).join('|');

  return [separator, formatRow(headers), separator, ...rows.map(formatRow), separator].join('\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  let targetDate = new Date().toISOString().split('T')[0];

  // Parse --date argument
  const dateIdx = args.indexOf('--date');
  if (dateIdx !== -1 && args[dateIdx + 1]) {
    targetDate = args[dateIdx + 1];
  }

  console.log('='.repeat(60));
  console.log('PROJECTIONS COVERAGE REPORT');
  console.log('Sprint: SPRINT-PROJECTIONS-FOUNDATION-099A');
  console.log('='.repeat(60));
  console.log();
  console.log(`📅 Target Date: ${targetDate}`);
  console.log();

  // Validate env
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Create client
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const projectionEngine = getProjectionEngine(supabase);

  // Collect coverage data
  const coverageResults: Array<{
    sport: string;
    statType: string;
    projectionCount: number;
    modelVersion: string;
  }> = [];

  console.log('📊 Fetching projection coverage...');
  console.log();

  for (const sport of SUPPORTED_SPORTS) {
    const coverage = await projectionEngine.getCoverage(sport, targetDate);

    if (coverage.total > 0) {
      for (const [statType, count] of Object.entries(coverage.byStatType)) {
        coverageResults.push({
          sport,
          statType,
          projectionCount: count,
          modelVersion: coverage.modelVersion || 'N/A',
        });
      }
    } else {
      // Add entry showing no projections
      coverageResults.push({
        sport,
        statType: '(none)',
        projectionCount: 0,
        modelVersion: ACTIVE_MODEL_VERSIONS[sport] || 'N/A',
      });
    }
  }

  // Display projection coverage table
  console.log('📋 PROJECTIONS BY SPORT/STAT TYPE');
  console.log();

  const projHeaders = ['Sport', 'Stat Type', 'Count', 'Model Version'];
  const projRows = coverageResults.map(r => [
    r.sport,
    r.statType,
    r.projectionCount.toString(),
    r.modelVersion,
  ]);

  console.log(formatTable(projHeaders, projRows));
  console.log();

  // Now check picks coverage (if unified_picks table exists)
  console.log("📋 PICKS COVERAGE (Today's Picks vs Projections)");
  console.log();

  try {
    // Get today's picks grouped by sport/stat_type
    const { data: picksData, error: picksError } = await supabase
      .from('unified_picks')
      .select('sport, stat_type, player_name')
      .gte('game_date', targetDate)
      .lte('game_date', targetDate);

    if (picksError) {
      console.log(`   ⚠️ Could not fetch picks: ${picksError.message}`);
    } else if (!picksData || picksData.length === 0) {
      console.log(`   ℹ️ No picks found for ${targetDate}`);
    } else {
      // Group picks by sport/stat_type
      const pickGroups = new Map<string, Set<string>>();
      for (const pick of picksData) {
        const key = `${pick.sport}:${pick.stat_type}`;
        if (!pickGroups.has(key)) {
          pickGroups.set(key, new Set());
        }
        pickGroups.get(key)!.add(pick.player_name);
      }

      // Check projection coverage for each group
      const coverageRows: string[][] = [];

      for (const [key, players] of pickGroups) {
        const [sport, statType] = key.split(':');
        const totalPlayers = players.size;

        // Count how many players have projections
        let withProjection = 0;
        for (const player of players) {
          const proj = await projectionEngine.getProjection(player, statType ?? '', {
            sport,
            date: targetDate,
          });
          if (proj) {
            withProjection++;
          }
        }

        const coveragePct = totalPlayers > 0 ? (withProjection / totalPlayers) * 100 : 0;

        coverageRows.push([
          sport ?? '',
          statType ?? '',
          totalPlayers.toString(),
          withProjection.toString(),
          formatPct(coveragePct),
        ]);
      }

      if (coverageRows.length > 0) {
        const pickHeaders = ['Sport', 'Stat Type', 'Total Picks', 'With Proj', 'Coverage'];
        console.log(formatTable(pickHeaders, coverageRows));
      } else {
        console.log('   ℹ️ No picks with sport/stat_type grouping found');
      }
    }
  } catch (err) {
    console.log(`   ⚠️ Error checking picks coverage: ${err}`);
  }

  console.log();

  // Summary
  const totalProjections = coverageResults.reduce((sum, r) => sum + r.projectionCount, 0);
  const sportsWithProjections = new Set(
    coverageResults.filter(r => r.projectionCount > 0).map(r => r.sport)
  ).size;

  console.log('📊 SUMMARY');
  console.log(`   Total projections for ${targetDate}: ${totalProjections}`);
  console.log(`   Sports with projections: ${sportsWithProjections}/${SUPPORTED_SPORTS.length}`);
  console.log();

  // Model versions
  console.log('🔧 ACTIVE MODEL VERSIONS');
  for (const [sport, version] of Object.entries(ACTIVE_MODEL_VERSIONS)) {
    console.log(`   ${sport}: ${version}`);
  }
  console.log();

  console.log('='.repeat(60));
  console.log('✅ Coverage report complete');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
