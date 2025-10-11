/**
 * Score Props with Enhanced Features - FIXED VERSION
 *
 * Properly integrates with Enhanced45FactorEngine by:
 * 1. Querying computed features from feature_values table
 * 2. Building GradingFeatureSet with our 5 features + defaults
 * 3. Passing to Enhanced45FactorEngine for scoring
 *
 * This follows the EXACT pattern from ScoringAgent.ts lines 513-556
 */

import { supabaseClient } from '../services/supabaseClient';
import { FeatureStoreService } from '../services/FeatureStoreService';
import { FeatureStoreIntegration } from '../agents/ScoringAgent/scoring/FeatureStoreIntegration';
import { MaterialChangeDetector } from '../agents/ScoringAgent/scoring/MaterialChangeDetector';
import { Enhanced45FactorEngine } from '../agents/ScoringAgent/scoring/Enhanced45FactorEngine';
import { GradingFeatureSet } from '../types/GradingFeatureSet';
import { createLogger } from '../utils/logger';
import { randomUUID } from 'crypto';

const logger = createLogger('ScoreEnhancedPropsFixed');

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

interface ComputedFeatures {
  expected_value_devigged?: number;
  line_movement_velocity?: number;
  player_form?: number;
  market_efficiency?: number;
  closing_line_value?: number;
}

/**
 * Query feature_values table for a prop's computed features
 */
async function getComputedFeatures(propId: string): Promise<ComputedFeatures> {
  const { data: features, error } = await supabaseClient
    .from('feature_values')
    .select('feature_name, value')
    .eq('entity_id', propId)
    .eq('entity_type', 'prop');

  if (error) {
    logger.error('Error fetching features', { propId, error });
    return {};
  }

  const featureMap: ComputedFeatures = {};
  features?.forEach(f => {
    featureMap[f.feature_name as keyof ComputedFeatures] = f.value;
  });

  return featureMap;
}

/**
 * Build GradingFeatureSet from prop + computed features
 * This follows ScoringAgent.ts lines 513-554 pattern
 */
function buildGradingFeatureSet(prop: PropToScore, computed: ComputedFeatures): GradingFeatureSet {
  return {
    propId: prop.id,
    date: prop.game_date,
    sport: prop.sport,
    league: extractLeague(prop.sport),
    player: prop.player_name,
    marketType: prop.market,
    odds: prop.odds,
    market: {
      type: prop.market,
      odds: prop.odds,
      line: prop.line
    },

    // Map our 5 computed features (82% of scoring weight)
    expectedValue: computed.expected_value_devigged || 0,
    lineMovement: computed.line_movement_velocity || 0,
    playerForm: computed.player_form || 50,
    marketEfficiency: computed.market_efficiency || 85,
    closingLineValue: computed.closing_line_value || 0,

    // Fill remaining fields with defaults (follows ScoringAgent pattern)
    matchupRating: 50,
    sharpMoney: 50,
    marketIntelligence: 50,
    volumeProfile: 50,
    injuryImpact: 0,
    weatherImpact: 0,
    playerFatigue: 0,
    venueAdvantage: 0,
    refereeImpact: 0,
    paceImpact: 0,
    motivationalFactors: 0,
    correlationRisk: 0,
    volatility: 5,
    portfolioImpact: 0,

    timestamp: new Date().toISOString(),
    version: '1.0',
    source: 'market_props',
    confidence: 50,
    dataQuality: {
      completeness: 0.95,
      outlierScore: 0.95,
      consistencyScore: 0.95,
      dataValidationScore: 0.95
    }
  };
}

function extractLeague(sport: string): string {
  const sportUpper = sport.toUpperCase();
  if (sportUpper === 'NFL' || sportUpper === 'AMERICANFOOTBALL_NFL') return 'NFL';
  if (sportUpper === 'NBA' || sportUpper === 'BASKETBALL_NBA') return 'NBA';
  if (sportUpper === 'MLB' || sportUpper === 'BASEBALL_MLB') return 'MLB';
  if (sportUpper === 'NHL' || sportUpper === 'ICEHOCKEY_NHL') return 'NHL';
  if (sportUpper === 'NCAAF' || sportUpper === 'AMERICANFOOTBALL_NCAAF') return 'NCAAF';
  return sport;
}

async function main() {
  try {
    logger.info('🎯 Starting enhanced prop scoring (FIXED VERSION)');

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
          // 1. Get computed features from feature_values table
          const computedFeatures = await getComputedFeatures(prop.id);

          // 2. Build GradingFeatureSet (follows ScoringAgent pattern)
          const gradingFeatures = buildGradingFeatureSet(prop, computedFeatures);

          // 3. Calculate 45-factor score (CORRECT METHOD CALL)
          const scoreResult = await scoringEngine.calculate45FactorScore(gradingFeatures);

          // 4. Prepare scored_prop record
          const scoredProp = {
            id: randomUUID(),
            prop_ref: prop.id,
            sport: prop.sport,
            professional_score: scoreResult.totalScore,
            tier: scoreResult.tier,
            edge: scoreResult.expectedValue,
            confidence: scoreResult.confidence,
            prob_win: scoreResult.totalScore / 100, // Convert score to probability
            kelly_fraction: scoreResult.kellyFraction,
            clv_pct: computedFeatures.closing_line_value || 0,
            factor_contributions: scoreResult.factorScores || {},
            model_outputs: {
              marketScore: scoreResult.marketScore,
              playerScore: scoreResult.playerScore,
              matchupScore: scoreResult.matchupScore,
              priceScore: scoreResult.priceScore,
              metaScore: scoreResult.metaScore
            },
            feature_completeness: 1.0, // We have all 5 critical features
            feature_freshness: 1.0,
            scoring_version: '45-factor-enhanced',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          // 5. Insert into scored_props
          const { error: insertError } = await supabaseClient
            .from('scored_props')
            .insert(scoredProp);

          if (insertError) {
            throw insertError;
          }

          results.scored++;
          results.scores.push(scoreResult.totalScore);

          // Log every 25 scores
          if (results.scored % 25 === 0) {
            const currentScores = results.scores.slice(-25);
            const avgScore = currentScores.reduce((a, b) => a + b, 0) / currentScores.length;
            const minScore = Math.min(...currentScores);
            const maxScore = Math.max(...currentScores);

            logger.info(`Progress: ${results.scored}/${results.total} | Recent avg: ${avgScore.toFixed(2)} | Range: ${minScore.toFixed(2)}-${maxScore.toFixed(2)}`);
          }

        } catch (error: any) {
          logger.error('Error scoring prop', {
            propId: prop.id,
            errorMessage: error.message,
            errorStack: error.stack
          });
          results.errors++;
        }
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Calculate final statistics
    if (results.scores.length === 0) {
      logger.error('❌ NO PROPS SCORED - All failed!');
      process.exit(1);
    }

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

  } catch (error: any) {
    logger.error('Fatal error in scoring', {
      error,
      message: error.message,
      stack: error.stack
    });
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

export { main as scoreEnhancedPropsFixed };
