/**
 * Manual Scoring Trigger
 * Scores existing unscored props using Enhanced45FactorEngine
 * Run: npx tsx apps/api/trigger-manual-scoring.ts
 */

import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { Enhanced45FactorEngine } from './src/agents/ScoringAgent/scoring/Enhanced45FactorEngine';
import { FeatureStoreIntegration } from './src/agents/ScoringAgent/scoring/FeatureStoreIntegration';
import { MaterialChangeDetector } from './src/agents/ScoringAgent/scoring/MaterialChangeDetector';
import { FeatureStoreService } from './src/services/FeatureStoreService';
import { GradingFeatureSet } from './src/types/GradingFeatureSet';

async function main() {
  const limit = parseInt(process.argv[2] || '50', 10);
  console.log(`🎯 MANUAL SCORING TRIGGER (Limit: ${limit} props)`);
  console.log('='.repeat(60));

  try {
    // Initialize Enhanced45FactorEngine
    console.log('[1/5] Initializing Enhanced45FactorEngine...');
    const featureStoreService = new FeatureStoreService();
    const featureStoreIntegration = new FeatureStoreIntegration(featureStoreService);
    const materialChangeDetector = new MaterialChangeDetector(featureStoreIntegration);
    const scoringEngine = new Enhanced45FactorEngine(featureStoreIntegration, materialChangeDetector);
    console.log('✓ Engine initialized');

    // Connect to database
    console.log('\n[2/5] Connecting to database...');
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
    const poolerUrl = `postgresql://postgres.${projectRef}:Adalise843!@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

    const client = new Client({
      connectionString: poolerUrl,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log('✓ Connected to database');

    // Fetch unscored props
    console.log(`\n[3/5] Fetching unscored props (limit: ${limit})...`);
    const result = await client.query(`
      SELECT * FROM public.raw_props
      WHERE professional_score IS NULL
        AND game_date >= CURRENT_DATE
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    const unscoredProps = result.rows;
    console.log(`✓ Found ${unscoredProps.length} unscored props`);

    if (unscoredProps.length === 0) {
      console.log('\n✅ No unscored props found. All caught up!');
      await client.end();
      process.exit(0);
    }

    // Score props
    console.log(`\n[4/5] Scoring ${unscoredProps.length} props via Enhanced45FactorEngine...`);
    let scoredCount = 0;
    let failedCount = 0;

    for (const prop of unscoredProps) {
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
          injuryImpact: prop.injury_impact || 0,
          weatherImpact: prop.weather_impact || 0,
          marketIntelligence: prop.market_intelligence || 50,
          sharpMoney: prop.sharp_money || 0,
          volumeProfile: prop.volume_profile || 50,
          closingLineValue: prop.closing_line_value || 0,
          marketEfficiency: prop.data_completeness || 0.5,
          bidAskSpread: prop.bid_ask_spread || 0.02,
          playerFatigue: prop.player_fatigue || 0,
          venueAdvantage: prop.venue_advantage || 0,
          refereeImpact: prop.referee_impact || 0,
          paceImpact: prop.pace_impact || 0,
          motivationalFactors: prop.motivational_factors || 0,
          correlationRisk: prop.correlation_risk || 0,
          volatility: prop.volatility || 5,
          portfolioImpact: prop.portfolio_impact || 0,
          dataQuality: {
            dataValidationScore: prop.data_validation_score || 0.95,
            outlierScore: prop.outlier_score || 0.95,
            consistencyScore: prop.consistency_score || 0.95,
            completeness: prop.data_completeness || 0.95
          },
          steamMoveData: {
            detected: prop.steam_detected || false,
            confidence: 0.5,
            timestamp: Date.now()
          },
          contrarianOpportunity: prop.contrarian_opportunity || false,
          timestamp: new Date().toISOString(),
          version: '3.0.0',
          source: prop.source || 'odds-api',
          confidence: prop.confidence || 0
        };

        // Score via Enhanced45FactorEngine
        const scoringResult = await scoringEngine.calculate45FactorScore(featureSet);

        // Update database
        // NOTE: Database schema constraints:
        // - professional_score: NUMERIC(4,3) - max 9.999, so scale 0-100 -> 0-9.999
        // - kelly_fraction: NUMERIC(6,5) - max 9.99999, should be fine for 0-1 range
        // - edge_score: INTEGER
        // - confidence_score: INTEGER
        const edgeScore = Math.max(-100, Math.min(100, Math.round(scoringResult.expectedValue)));
        const confidenceScore = Math.max(0, Math.min(100, Math.round(scoringResult.confidence * 100)));
        const kellyFraction = Math.max(0, Math.min(1, scoringResult.kellyFraction));
        const professionalScore = Math.max(0, Math.min(9.999, scoringResult.totalScore / 10)); // Scale 0-100 -> 0-9.999

        console.log(`   Scoring result: Score=${(professionalScore * 10).toFixed(2)}, Tier=${scoringResult.tier}, Edge=${edgeScore}, Conf=${confidenceScore}%, Kelly=${kellyFraction.toFixed(4)}`);

        // Use Supabase client with SERVICE_ROLE_KEY to bypass RLS
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error: updateError } = await supabase
          .from('raw_props')
          .update({
            professional_score: professionalScore,
            tier: scoringResult.tier,
            edge_score: edgeScore,
            confidence_score: confidenceScore,
            kelly_fraction: kellyFraction,
            pro_attempts: (prop.pro_attempts || 0) + 1,
            processed_at: new Date().toISOString()
          })
          .eq('id', prop.id);

        if (updateError) {
          throw new Error(`Supabase update failed: ${updateError.message}`);
        }

        scoredCount++;

        if (scoredCount % 10 === 0) {
          console.log(`   Progress: ${scoredCount}/${unscoredProps.length} props scored`);
        }

      } catch (error) {
        failedCount++;
        console.error(`   ✗ Failed to score prop ${prop.id}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    await client.end();

    // Summary
    console.log(`\n[5/5] Scoring complete!`);
    console.log(`   ✓ Successfully scored: ${scoredCount} props`);
    console.log(`   ✗ Failed: ${failedCount} props`);
    console.log(`   Success rate: ${unscoredProps.length > 0 ? ((scoredCount / unscoredProps.length) * 100).toFixed(1) + '%' : '0%'}`);

    console.log('\n' + '='.repeat(60));
    console.log(scoredCount > 0 ? '✅ MANUAL SCORING: SUCCESS' : '❌ MANUAL SCORING: FAILED');
    console.log('='.repeat(60));

    process.exit(scoredCount > 0 ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
