/**
 * Score Props with Enhanced Features
 *
 * Scores the 200 props that have enhanced features computed.
 * Expected improvement: Score variance from ~51.16 (identical) to 35-75 range.
 *
 * Part of Option 3 (Hybrid Approach) - Database Remediation Phase 4B
 */

import { supabaseClient } from '../services/supabaseClient';
import { FeatureStoreService } from '../services/FeatureStoreService';
import { FeatureStoreIntegration } from '../agents/ScoringAgent/scoring/FeatureStoreIntegration';
import { MaterialChangeDetector } from '../agents/ScoringAgent/scoring/MaterialChangeDetector';
import { Enhanced45FactorEngine } from '../agents/ScoringAgent/scoring/Enhanced45FactorEngine';
import { createLogger } from '../utils/logger';
import { randomUUID } from 'crypto';

const logger = createLogger('ScoreEnhancedProps');

interface PropToScore {
  id: string;
  sport: string;
  market: string;
  player_name: string;
  line: number;
  odds: number;
  over_odds?: number;
  under_odds?: number;
  selection: string;
  game_date: string;
}

async function main() {
  try {
    logger.info('🎯 Starting enhanced prop scoring');

    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    // Initialize scoring engine with CORRECT constructor pattern
    const featureStoreService = new FeatureStoreService();
    const featureStore = new FeatureStoreIntegration(featureStoreService);
    const changeDetector = new MaterialChangeDetector(featureStore);
    const scoringEngine = new Enhanced45FactorEngine(featureStore, changeDetector);

    logger.info('✅ Scoring engine initialized correctly');

    // Get unique prop IDs that have features
    const { data: featureRecords, error: featuresError } = await supabaseClient
      .from('feature_values')
      .select('entity_id')
      .limit(1000);

    if (featuresError) {
      throw featuresError;
    }

    const propIdsWithFeatures = [...new Set(featureRecords?.map(f => f.entity_id) || [])];

    logger.info(`Found ${propIdsWithFeatures.length} props with enhanced features`);

    // Fetch these props from market_props
    const { data: props, error: propsError } = await supabaseClient
      .from('market_props')
      .select('id, sport, market, player_name, line, odds, over_odds, under_odds, selection, game_date')
      .in('id', propIdsWithFeatures);

    if (propsError) {
      throw propsError;
    }

    if (!props || props.length === 0) {
      logger.warn('No props found to score');
      return;
    }

    logger.info(`Fetched ${props.length} props to score`);

    const results = {
      total: props.length,
      scored: 0,
      errors: 0,
      scores: [] as number[],
      startTime: Date.now()
    };

    // Score props in small batches
    const batchSize = 10;
    for (let i = 0; i < props.length; i += batchSize) {
      const batch = props.slice(i, i + batchSize);

      logger.info(`Scoring batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(props.length / batchSize)}`);

      for (const prop of batch) {
        try {
          // Retrieve features for this prop
          const features = await featureStore.retrieveFeatures(prop.id);

          // Calculate 45-factor score
          const scoreResult = await scoringEngine.calculate45FactorScore(features);

          // Prepare scored_prop record
          const scoredProp = {
            id: randomUUID(),
            prop_ref: prop.id,
            sport: prop.sport,
            professional_score: scoreResult.professionalScore,
            tier: scoreResult.tier,
            edge: scoreResult.edge,
            confidence: scoreResult.confidence,
            prob_win: scoreResult.probWin,
            kelly_fraction: scoreResult.kellyFraction,
            clv_pct: scoreResult.clvPct || 0,
            factor_contributions: scoreResult.factorContributions || {},
            model_outputs: scoreResult.modelOutputs || {},
            feature_completeness: features.completeness,
            feature_freshness: features.freshness,
            scoring_version: '45-factor-enhanced',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          // Insert into scored_props
          const { error: insertError } = await supabaseClient
            .from('scored_props')
            .insert(scoredProp);

          if (insertError) {
            throw insertError;
          }

          results.scored++;
          results.scores.push(scoreResult.professionalScore);

          // Log every 25 scores
          if (results.scored % 25 === 0) {
            const currentScores = results.scores.slice(-25);
            const avgScore = currentScores.reduce((a, b) => a + b, 0) / currentScores.length;
            const minScore = Math.min(...currentScores);
            const maxScore = Math.max(...currentScores);

            logger.info(`Progress: ${results.scored}/${results.total} | Recent avg: ${avgScore.toFixed(2)} | Range: ${minScore.toFixed(2)}-${maxScore.toFixed(2)}`);
          }

        } catch (error) {
          logger.error('Error scoring prop', { propId: prop.id, error });
          results.errors++;
        }
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Calculate final statistics
    const elapsedMs = Date.now() - results.startTime;
    const avgScore = results.scores.reduce((a, b) => a + b, 0) / results.scores.length;
    const minScore = Math.min(...results.scores);
    const maxScore = Math.max(...results.scores);
    const variance = results.scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / results.scores.length;
    const stdDev = Math.sqrt(variance);

    logger.info('✅ Scoring complete!');
    logger.info('📊 Results:', {
      total: results.total,
      scored: results.scored,
      errors: results.errors,
      successRate: ((results.scored / results.total) * 100).toFixed(2) + '%',
      elapsedMs,
      avgTimePerProp: (elapsedMs / results.scored).toFixed(0) + 'ms'
    });

    logger.info('📈 Score Statistics:', {
      average: avgScore.toFixed(2),
      min: minScore.toFixed(2),
      max: maxScore.toFixed(2),
      range: (maxScore - minScore).toFixed(2),
      standardDeviation: stdDev.toFixed(2),
      variance: variance.toFixed(2)
    });

    // Compare to target
    const targetRange = 40; // Target: 35-75 range
    const actualRange = maxScore - minScore;

    logger.info('🎯 Target Comparison:', {
      targetMinRange: '35-75 (40 points)',
      actualRange: actualRange.toFixed(2) + ' points',
      improvement: actualRange > 10 ? '✅ SIGNIFICANT' : '⚠️ MINIMAL',
      vsBaseline: 'Baseline was ~0.5 points (51.15-51.16)'
    });

    if (actualRange > 10) {
      logger.info('🎉 SUCCESS! Score variance significantly improved!');
    } else if (actualRange > 2) {
      logger.info('✅ IMPROVEMENT! Score variance better than baseline');
    } else {
      logger.warn('⚠️ LIMITED IMPROVEMENT - May need more real features');
    }

  } catch (error) {
    logger.error('Fatal error in scoring', { error });
    process.exit(1);
  }
}

// Execute
if (require.main === module) {
  main().then(() => {
    logger.info('Script complete - exiting');
    process.exit(0);
  }).catch(error => {
    logger.error('Unhandled error', { error });
    process.exit(1);
  });
}

export { main as scoreEnhancedProps };
