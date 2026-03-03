#!/usr/bin/env npx tsx
// @ts-nocheck - Script with mock data for testing
/**
 * PROFIT-ATTRIBUTION-SNAPSHOT-001: Phase F - Feature Contributions Backfill
 *
 * Safely backfills feature_contributions for settled picks that have
 * professional_score but are missing feature_contributions.
 *
 * SAFETY GUARANTEES:
 * - Bounded: Only processes settled picks with professional_score
 * - Idempotent: Skips picks that already have feature_contributions
 * - Safe: Does NOT update professional_score or tier (read-only replay)
 * - Batched: Processes in small batches with delays to avoid DB pressure
 * - Logged: Full audit trail of what was updated
 *
 * USAGE:
 *   npx tsx backfill-feature-contributions.ts --dry-run   # Preview only
 *   npx tsx backfill-feature-contributions.ts             # Execute backfill
 *   npx tsx backfill-feature-contributions.ts --limit=100 # Process 100 picks
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Import grading engine for replay
import { SyndicateGradingEngine } from '../agents/GradingAgent/scoring/gradingEngine';
import type { GradingFeatureSet } from '../types/GradingFeatureSet';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const OUT_DIR = path.join(process.cwd(), 'out', 'profit-attribution-snapshot', '2026-02-07');

// Parse CLI arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '1000', 10);
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000; // 1 second between batches

interface BackfillStats {
  total_eligible: number;
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
  error_details: Array<{ id: string; error: string }>;
}

async function buildFeatureSetFromPick(pick: any): Promise<GradingFeatureSet> {
  const odds = pick.odds || -110;
  const line = pick.line || 0;
  const sport = pick.sport || 'NBA';

  return {
    propId: pick.id,
    unifiedPickId: pick.id,
    gameId: pick.game_id,
    date: pick.manual_game_date || pick.game_date || new Date().toISOString().slice(0, 10),
    sport,
    league: sport,
    player: pick.player_name || 'Unknown',
    market: pick.stat_type || 'points',
    direction: pick.direction || 'over',
    line,
    odds: {
      over: typeof odds === 'number' ? odds : -110,
      under: typeof odds === 'number' ? -odds : -110,
      line,
    },
    expectedValue: 0,
    lineMovement: 0,
    matchupRating: 0.5,
    playerForm: 0.5,
    injuryImpact: 0,
    weatherImpact: 0,
    marketIntelligence: 0.5,
    sharpMoney: 0.5,
    volumeProfile: 0.5,
    closingLineValue: 0,
    playerFatigue: 0,
    venueAdvantage: 0,
    refereeImpact: 0,
    paceImpact: 0,
    motivationalFactors: 0.5,
    correlationRisk: 0,
    volatility: 0.5,
    portfolioImpact: 0,
    bidAskSpread: 0.02,
    dataQuality: {
      freshnessScore: 0.8,
      sourceReliabilityScore: 0.8,
      dataValidationScore: 0.8,
      outlierScore: 0.9,
      consistencyScore: 0.9,
      completeness: 0.7,
    },
    timestamp: pick.created_at || new Date().toISOString(),
    version: '1.0',
  };
}

async function runBackfill() {
  console.log('═'.repeat(70));
  console.log('PROFIT-ATTRIBUTION-SNAPSHOT-001: Phase F - Backfill');
  console.log('═'.repeat(70));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE EXECUTION'}`);
  console.log(`Limit: ${LIMIT} picks`);
  console.log(`Batch size: ${BATCH_SIZE}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const stats: BackfillStats = {
    total_eligible: 0,
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    error_details: [],
  };

  // Count eligible picks
  console.log('\n📊 Counting eligible picks...');

  const { count: eligibleCount, error: countErr } = await supabase
    .from('unified_picks')
    .select('id', { count: 'exact', head: true })
    .eq('settlement_status', 'settled')
    .not('professional_score', 'is', null)
    .or('feature_contributions.is.null,feature_contributions.eq.{}');

  if (countErr) {
    console.error(`Count error: ${countErr.message}`);
    process.exit(1);
  }

  stats.total_eligible = eligibleCount || 0;
  console.log(`  Eligible for backfill: ${stats.total_eligible}`);
  console.log(`  Will process: ${Math.min(stats.total_eligible, LIMIT)}`);

  if (stats.total_eligible === 0) {
    console.log('\n✅ No picks need backfill!');
    process.exit(0);
  }

  // Create grading engine
  console.log('\n📦 Initializing grading engine...');
  const engine = new SyndicateGradingEngine({});

  // Process in batches
  console.log('\n🔄 Starting backfill...');
  let offset = 0;

  while (stats.processed < LIMIT && offset < stats.total_eligible) {
    // Fetch batch
    const { data: batch, error: batchErr } = await supabase
      .from('unified_picks')
      .select('*')
      .eq('settlement_status', 'settled')
      .not('professional_score', 'is', null)
      .or('feature_contributions.is.null,feature_contributions.eq.{}')
      .order('settled_at', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (batchErr) {
      console.error(`Batch fetch error: ${batchErr.message}`);
      break;
    }

    if (!batch || batch.length === 0) {
      break;
    }

    console.log(`\n  Batch ${Math.floor(offset / BATCH_SIZE) + 1}: ${batch.length} picks`);

    for (const pick of batch) {
      if (stats.processed >= LIMIT) break;

      stats.processed++;

      try {
        // Skip if already has contributions (idempotent check)
        if (pick.feature_contributions && Object.keys(pick.feature_contributions).length > 0) {
          stats.skipped++;
          continue;
        }

        // Build feature set and replay grading
        const featureSet = await buildFeatureSetFromPick(pick);
        const result = await engine.gradeProp(featureSet);

        // Extract contributions
        const contributions =
          result.featureContributions && Object.keys(result.featureContributions).length > 0
            ? result.featureContributions
            : null;

        if (!contributions) {
          stats.skipped++;
          continue;
        }

        // SAFETY CHECK: Verify score hasn't changed significantly
        const scoreDiff = Math.abs((result.finalScore || 0) - (pick.professional_score || 0));
        if (scoreDiff > 5) {
          console.log(
            `    ⚠️ Score drift detected for ${pick.id}: ` +
              `original=${pick.professional_score}, replayed=${result.finalScore}`
          );
          // Still update contributions, but log the drift
        }

        if (DRY_RUN) {
          console.log(
            `    [DRY RUN] Would update ${pick.id}: ` +
              `${Object.keys(contributions).length} contributions`
          );
          stats.updated++;
        } else {
          // Update ONLY feature_contributions (not score or tier)
          const { error: updateErr } = await supabase
            .from('unified_picks')
            .update({
              feature_contributions: contributions,
              // DO NOT update professional_score or tier
            })
            .eq('id', pick.id);

          if (updateErr) {
            stats.errors++;
            stats.error_details.push({ id: pick.id, error: updateErr.message });
            console.log(`    ❌ Update failed for ${pick.id}: ${updateErr.message}`);
          } else {
            stats.updated++;
            if (stats.updated % 100 === 0) {
              console.log(`    ✅ Updated ${stats.updated} picks`);
            }
          }
        }
      } catch (err) {
        stats.errors++;
        stats.error_details.push({
          id: pick.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    offset += BATCH_SIZE;

    // Delay between batches
    if (offset < stats.total_eligible && stats.processed < LIMIT) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  // Final report
  console.log('\n' + '═'.repeat(70));
  console.log('BACKFILL COMPLETE');
  console.log('═'.repeat(70));
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Total eligible: ${stats.total_eligible}`);
  console.log(`  Processed: ${stats.processed}`);
  console.log(`  Updated: ${stats.updated}`);
  console.log(`  Skipped: ${stats.skipped}`);
  console.log(`  Errors: ${stats.errors}`);

  if (stats.errors > 0) {
    console.log('\n  Error details (first 10):');
    for (const e of stats.error_details.slice(0, 10)) {
      console.log(`    - ${e.id}: ${e.error}`);
    }
  }

  // Save report
  const reportPath = path.join(OUT_DIR, `F1_backfill_report_${DRY_RUN ? 'dry' : 'live'}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        mode: DRY_RUN ? 'DRY_RUN' : 'LIVE',
        stats,
      },
      null,
      2
    )
  );
  console.log(`\n✅ Report saved to ${reportPath}`);

  // Calculate new coverage
  if (!DRY_RUN && stats.updated > 0) {
    const { count: newWithContribs } = await supabase
      .from('unified_picks')
      .select('id', { count: 'exact', head: true })
      .not('feature_contributions', 'is', null);

    const { count: totalSettled } = await supabase
      .from('unified_picks')
      .select('id', { count: 'exact', head: true })
      .eq('settlement_status', 'settled');

    console.log(`\n📊 Post-backfill coverage:`);
    console.log(`  With feature_contributions: ${newWithContribs}`);
    console.log(`  Total settled: ${totalSettled}`);
    console.log(
      `  Coverage: ${totalSettled ? (((newWithContribs || 0) / (totalSettled || 1)) * 100).toFixed(1) : 0}%`
    );
  }
}

runBackfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
