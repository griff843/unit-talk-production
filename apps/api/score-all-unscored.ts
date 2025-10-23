/**
 * Batch score all unscored props in raw_props table
 * This is a one-time backfill to score existing props
 */

import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { Enhanced45FactorEngine } from './src/agents/ScoringAgent/scoring/Enhanced45FactorEngine';
import { FeatureStoreService } from './src/agents/ScoringAgent/scoring/FeatureStoreService';
import { FeatureStoreIntegration } from './src/agents/ScoringAgent/scoring/FeatureStoreIntegration';
import { MaterialChangeDetector } from './src/agents/ScoringAgent/scoring/MaterialChangeDetector';
import type { GradingFeatureSet } from './src/agents/ScoringAgent/scoring/types';

const BATCH_SIZE = 100;
const TOTAL_LIMIT = 1000; // Process 1000 props max per run

async function main() {
  console.log(`🎯 BATCH SCORING ALL UNSCORED PROPS`);
  console.log('='.repeat(80));

  // Initialize Enhanced45FactorEngine
  console.log('[1/6] Initializing Enhanced45FactorEngine...');
  const featureStoreService = new FeatureStoreService();
  const featureStoreIntegration = new FeatureStoreIntegration(featureStoreService);
  const materialChangeDetector = new MaterialChangeDetector(featureStoreIntegration);
  const scoringEngine = new Enhanced45FactorEngine(featureStoreIntegration, materialChangeDetector);
  console.log('✓ Engine initialized\n');

  // Connect to database
  console.log('[2/6] Connecting to database...');
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
  const poolerUrl = `postgresql://postgres.${projectRef}:Adalise843!@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

  const client = new Client({
    connectionString: poolerUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('✓ Connected to database\n');

  // Initialize Supabase for updates
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;
  let batchNumber = 1;

  while (totalProcessed < TOTAL_LIMIT) {
    console.log(`[3/6] Fetching batch ${batchNumber} (${BATCH_SIZE} props)...`);

    // Fetch unscored props
    const result = await client.query(`
      SELECT id, sport, league, stat_type, line, under_odds, over_odds,
             player_name, game_date, game_id, expected_value, line_movement,
             matchup_quality, player_form
      FROM raw_props
      WHERE professional_score IS NULL
        AND game_date >= NOW()::DATE
      ORDER BY created_at DESC
      LIMIT $1
    `, [BATCH_SIZE]);

    if (result.rows.length === 0) {
      console.log('✓ No more unscored props found\n');
      break;
    }

    console.log(`✓ Found ${result.rows.length} unscored props\n`);

    console.log(`[4/6] Scoring batch ${batchNumber} (${result.rows.length} props)...`);

    let batchSuccessful = 0;
    let batchFailed = 0;

    for (const prop of result.rows) {
      try {
        // Transform to GradingFeatureSet
        const featureSet: GradingFeatureSet = {
          propId: prop.id,
          gameId: prop.game_id || undefined,
          date: prop.game_date,
          sport: prop.sport || 'NFL',
          league: prop.league || prop.sport || 'NFL',
          player: prop.player_name,
          marketType: prop.stat_type,
          odds: prop.under_odds || prop.over_odds || 0,
          market: {
            type: prop.stat_type || 'unknown',
            odds: prop.under_odds || prop.over_odds || 0,
            line: prop.line || 0
          },
          line: prop.line || 0,
          expectedValue: prop.expected_value || 0,
          lineMovement: prop.line_movement || 0,
          matchupRating: prop.matchup_quality || 50,
          playerForm: prop.player_form || 50,
          // Defaults for missing data
          vegasImpliedProbability: 0.5,
          sharpMoney: 0,
          publicMoney: 0,
          steamMoves: 0,
          lineVelocity: 0,
          historicalEdge: 0,
          modelConsensus: 0.5,
          clvPrediction: 0,
          bookmakerAgreement: 0.5,
          marketDepth: 0.5
        };

        // Score via Enhanced45FactorEngine
        const scoringResult = await scoringEngine.calculate45FactorScore(featureSet);

        // Scale and convert values to match database constraints
        const edgeScore = Math.max(-100, Math.min(100, Math.round(scoringResult.expectedValue)));
        const confidenceScore = Math.max(0, Math.min(100, Math.round(scoringResult.confidence * 100)));
        const kellyFraction = Math.max(0, Math.min(1, scoringResult.kellyFraction));
        const professionalScore = Math.max(0, Math.min(9.999, scoringResult.totalScore / 10));

        // Update via Supabase
        const { error: updateError } = await supabase
          .from('raw_props')
          .update({
            professional_score: professionalScore,
            tier: scoringResult.tier,
            edge_score: edgeScore,
            confidence_score: confidenceScore,
            kelly_fraction: kellyFraction,
            pro_attempts: 1,
            processed_at: new Date().toISOString()
          })
          .eq('id', prop.id);

        if (updateError) {
          console.error(`   ✗ Failed to update ${prop.id}: ${updateError.message}`);
          batchFailed++;
        } else {
          batchSuccessful++;
        }

      } catch (error: any) {
        console.error(`   ✗ Error scoring ${prop.id}: ${error.message}`);
        batchFailed++;
      }
    }

    totalProcessed += result.rows.length;
    totalSuccessful += batchSuccessful;
    totalFailed += batchFailed;

    console.log(`   ✓ Batch ${batchNumber} complete: ${batchSuccessful} successful, ${batchFailed} failed`);
    console.log(`   Progress: ${totalProcessed}/${TOTAL_LIMIT} props processed\n`);

    if (result.rows.length < BATCH_SIZE) {
      console.log('✓ Processed all available props\n');
      break;
    }

    batchNumber++;
  }

  console.log('[5/6] Scoring complete!');
  console.log(`   ✓ Successfully scored: ${totalSuccessful} props`);
  console.log(`   ✗ Failed: ${totalFailed} props`);
  console.log(`   Success rate: ${((totalSuccessful / totalProcessed) * 100).toFixed(1)}%\n`);

  await client.end();

  console.log('='.repeat(80));
  console.log('✅ BATCH SCORING: COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error);
