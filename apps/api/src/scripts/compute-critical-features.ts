/**
 * Compute Critical Features Script
 *
 * Implements 5 critical features (82% of scoring weight) for all market_props:
 * 1. expectedValueDevigged (25% weight) - Remove vig and calculate true EV
 * 2. lineMovementVelocity (15% weight) - Track rate of line movement
 * 3. playerForm (20% weight) - Recent performance trending
 * 4. marketEfficiency (10% weight) - Market maker confidence
 * 5. closingLineValue (12% weight) - Predicted closing line edge
 *
 * Part of Option 3 (Hybrid Approach) - Database Remediation
 */

import { supabaseClient } from '../services/supabaseClient';
import { FeatureStoreService } from '../services/FeatureStoreService';
import { createLogger } from '../utils/logger';

const logger = createLogger('ComputeCriticalFeatures');
const featureStore = new FeatureStoreService();

interface MarketProp {
  id: string;
  sport: string;
  market: string;
  selection: string;
  line: number;
  odds: number;
  over_odds?: number;
  under_odds?: number;
  player_name: string;
  game_date: string;
  created_at: string;
}

/**
 * Feature 1: expectedValueDevigged (25% weight)
 *
 * Removes bookmaker vig from odds to calculate true probability and edge.
 * This is the foundation of professional betting - finding +EV opportunities.
 */
async function computeExpectedValueDevigged(prop: MarketProp): Promise<number> {
  const { odds, over_odds, under_odds } = prop;

  // Convert American odds to decimal
  const toDecimal = (americanOdds: number): number => {
    if (americanOdds > 0) {
      return (americanOdds / 100) + 1;
    } else {
      return (100 / Math.abs(americanOdds)) + 1;
    }
  };

  // Convert decimal odds to implied probability
  const toProbability = (decimalOdds: number): number => {
    return 1 / decimalOdds;
  };

  try {
    // For two-way markets (Over/Under), devig using both sides
    if (over_odds && under_odds) {
      const overDecimal = toDecimal(over_odds);
      const underDecimal = toDecimal(under_odds);

      const overProb = toProbability(overDecimal);
      const underProb = toProbability(underDecimal);

      // Total probability exceeds 1.0 due to vig
      const totalProb = overProb + underProb;
      const vigFactor = 1 / totalProb;

      // Devigged (true) probabilities
      const trueOverProb = overProb * vigFactor;
      const trueUnderProb = underProb * vigFactor;

      // Calculate true fair odds
      const trueFairOdds = 1 / (prop.selection === 'Over' ? trueOverProb : trueUnderProb);

      // Expected value = (True probability × Payout) - 1
      // For the side we're betting
      const ourSide = prop.selection === 'Over' ? over_odds : under_odds;
      const ourDecimal = toDecimal(ourSide);
      const ourImpliedProb = toProbability(ourDecimal);
      const ourTrueProb = prop.selection === 'Over' ? trueOverProb : trueUnderProb;

      // Edge = True probability - Implied probability
      const edge = ourTrueProb - ourImpliedProb;

      // Expected value as percentage
      const ev = edge * 100;

      logger.info('Devigged EV calculated', {
        propId: prop.id,
        selection: prop.selection,
        vigFactor: vigFactor.toFixed(4),
        edge: edge.toFixed(4),
        ev: ev.toFixed(2) + '%'
      });

      return ev;
    } else {
      // Single-sided odds - estimate vig as ~5%
      const decimalOdds = toDecimal(odds);
      const impliedProb = toProbability(decimalOdds);

      // Assume fair odds with 5% vig removed
      const estimatedTrueProb = impliedProb * 1.05;
      const edge = estimatedTrueProb - impliedProb;
      const ev = edge * 100;

      logger.info('Single-sided EV estimated', {
        propId: prop.id,
        estimatedVig: '5%',
        ev: ev.toFixed(2) + '%'
      });

      return ev;
    }
  } catch (error) {
    logger.error('Error computing devigged EV', { propId: prop.id, error });
    return 0; // Neutral EV on error
  }
}

/**
 * Feature 2: lineMovementVelocity (15% weight)
 *
 * Measures how fast the line is moving (sharp money indicator).
 * Fast movement = sharp action, slow movement = public action.
 */
async function computeLineMovementVelocity(prop: MarketProp): Promise<number> {
  try {
    // Query line history from raw_props for this player/market
    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    const { data: lineHistory, error } = await supabaseClient
      .from('raw_props')
      .select('line, odds, timestamp')
      .eq('player_name', prop.player_name)
      .eq('stat_type', prop.market)
      .eq('game_date', prop.game_date)
      .order('timestamp', { ascending: true })
      .limit(50); // Last 50 updates

    if (error || !lineHistory || lineHistory.length < 2) {
      // No line history yet - return neutral velocity
      logger.info('No line history for velocity calculation', { propId: prop.id });
      return 0;
    }

    // Calculate velocity as change per hour
    const firstPoint = lineHistory[0];
    const lastPoint = lineHistory[lineHistory.length - 1];

    const lineChange = Math.abs(lastPoint.line - firstPoint.line);
    const timeElapsedMs = new Date(lastPoint.timestamp).getTime() - new Date(firstPoint.timestamp).getTime();
    const timeElapsedHours = timeElapsedMs / (1000 * 60 * 60);

    // Velocity = change per hour
    const velocity = timeElapsedHours > 0 ? lineChange / timeElapsedHours : 0;

    logger.info('Line velocity calculated', {
      propId: prop.id,
      lineChange: lineChange.toFixed(2),
      timeElapsedHours: timeElapsedHours.toFixed(2),
      velocity: velocity.toFixed(3)
    });

    return velocity;
  } catch (error) {
    logger.error('Error computing line velocity', { propId: prop.id, error });
    return 0;
  }
}

/**
 * Feature 3: playerForm (20% weight)
 *
 * Analyzes recent player performance trend.
 * Higher weight because player performance is highly predictive.
 */
async function computePlayerForm(prop: MarketProp): Promise<number> {
  try {
    // Query recent game performance from historical data
    // For MVP, we'll estimate form based on line value vs season average

    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    // Get historical props for this player/market to establish baseline
    const { data: historicalProps, error } = await supabaseClient
      .from('raw_props')
      .select('line, timestamp')
      .eq('player_name', prop.player_name)
      .eq('stat_type', prop.market)
      .order('timestamp', { ascending: false })
      .limit(20); // Last 20 props

    if (error || !historicalProps || historicalProps.length < 5) {
      // Insufficient data - return neutral form
      logger.info('Insufficient data for player form', { propId: prop.id });
      return 50; // Neutral form score
    }

    // Calculate average line over history
    const avgLine = historicalProps.reduce((sum, p) => sum + p.line, 0) / historicalProps.length;

    // Current line vs average line indicates form
    // If line is higher than average, player is in good form (books expect more)
    // If line is lower, player is in poor form
    const formDifference = prop.line - avgLine;
    const formPercentage = (formDifference / avgLine) * 100;

    // Convert to 0-100 scale (50 = average form)
    // +10% above average = 60 form score
    // -10% below average = 40 form score
    const formScore = Math.max(0, Math.min(100, 50 + (formPercentage * 10)));

    logger.info('Player form calculated', {
      propId: prop.id,
      playerName: prop.player_name,
      currentLine: prop.line,
      avgLine: avgLine.toFixed(2),
      formPercentage: formPercentage.toFixed(2) + '%',
      formScore: formScore.toFixed(1)
    });

    return formScore;
  } catch (error) {
    logger.error('Error computing player form', { propId: prop.id, error });
    return 50; // Neutral form on error
  }
}

/**
 * Feature 4: marketEfficiency (10% weight)
 *
 * Measures market maker confidence through odds spread.
 * Tight spread = efficient market, wide spread = uncertain market.
 */
async function computeMarketEfficiency(prop: MarketProp): Promise<number> {
  try {
    const { over_odds, under_odds } = prop;

    if (!over_odds || !under_odds) {
      // Single-sided market - estimate 85% efficiency
      logger.info('Single-sided market - estimated efficiency', { propId: prop.id });
      return 85;
    }

    // Convert to decimal odds
    const toDecimal = (americanOdds: number): number => {
      if (americanOdds > 0) {
        return (americanOdds / 100) + 1;
      } else {
        return (100 / Math.abs(americanOdds)) + 1;
      }
    };

    const overDecimal = toDecimal(over_odds);
    const underDecimal = toDecimal(under_odds);

    // Calculate implied probabilities
    const overProb = 1 / overDecimal;
    const underProb = 1 / underDecimal;

    // Total probability (includes vig)
    const totalProb = overProb + underProb;

    // Vig = Total probability - 1.0
    // Lower vig = more efficient market (confident market makers)
    // Typical vig ranges from 2% (sharp markets) to 10% (soft markets)
    const vig = (totalProb - 1.0) * 100;

    // Efficiency score: 100 - (vig * 10)
    // 2% vig = 98 efficiency (very efficient)
    // 5% vig = 95 efficiency (standard)
    // 10% vig = 90 efficiency (soft market)
    const efficiency = Math.max(70, Math.min(100, 100 - (vig * 5)));

    logger.info('Market efficiency calculated', {
      propId: prop.id,
      vig: vig.toFixed(2) + '%',
      efficiency: efficiency.toFixed(1)
    });

    return efficiency;
  } catch (error) {
    logger.error('Error computing market efficiency', { propId: prop.id, error });
    return 85; // Average efficiency on error
  }
}

/**
 * Feature 5: closingLineValue (12% weight)
 *
 * Predicts where the closing line will be to assess current value.
 * Key indicator of long-term success.
 */
async function computeClosingLineValue(prop: MarketProp): Promise<number> {
  try {
    // Query line movement trend
    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    const { data: lineHistory, error } = await supabaseClient
      .from('raw_props')
      .select('line, timestamp')
      .eq('player_name', prop.player_name)
      .eq('stat_type', prop.market)
      .eq('game_date', prop.game_date)
      .order('timestamp', { ascending: true })
      .limit(20);

    if (error || !lineHistory || lineHistory.length < 3) {
      // No trend data - assume current line is fair
      logger.info('No CLV trend data', { propId: prop.id });
      return 0; // Neutral CLV
    }

    // Linear regression to predict closing line
    const n = lineHistory.length;
    const timestamps = lineHistory.map((p, i) => i); // Use index as time
    const lines = lineHistory.map(p => p.line);

    // Calculate slope (line movement trend)
    const sumX = timestamps.reduce((a, b) => a + b, 0);
    const sumY = lines.reduce((a, b) => a + b, 0);
    const sumXY = timestamps.reduce((sum, x, i) => sum + (x * lines[i]), 0);
    const sumX2 = timestamps.reduce((sum, x) => sum + (x * x), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict closing line (assume 10 more time periods until game)
    const predictedClosingLine = intercept + (slope * (n + 10));

    // CLV = Predicted closing line - Current line
    // Positive CLV = we're getting better than closing line
    const clv = predictedClosingLine - prop.line;

    logger.info('CLV predicted', {
      propId: prop.id,
      currentLine: prop.line,
      predictedClosing: predictedClosingLine.toFixed(2),
      clv: clv.toFixed(3),
      trend: slope > 0 ? 'rising' : slope < 0 ? 'falling' : 'flat'
    });

    return clv;
  } catch (error) {
    logger.error('Error computing CLV', { propId: prop.id, error });
    return 0; // Neutral CLV on error
  }
}

/**
 * Main execution: Compute and store all 5 critical features
 */
async function main() {
  try {
    logger.info('🚀 Starting critical feature computation');

    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    // Fetch all market props (including historical for feature computation)
    const { data: props, error } = await supabaseClient
      .from('market_props')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1000); // Process up to 1000 props for performance

    if (error) {
      throw error;
    }

    if (!props || props.length === 0) {
      logger.warn('No props found in market_props');
      return;
    }

    logger.info(`Found ${props.length} props to process`);

    const results = {
      total: props.length,
      processed: 0,
      errors: 0,
      features: {
        expectedValueDevigged: 0,
        lineMovementVelocity: 0,
        playerForm: 0,
        marketEfficiency: 0,
        closingLineValue: 0
      }
    };

    // Process props in batches of 50 to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < props.length; i += batchSize) {
      const batch = props.slice(i, i + batchSize);

      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(props.length / batchSize)}`);

      for (const prop of batch) {
        try {
          const asOf = new Date().toISOString();

          // Compute all 5 features
          const [evDevigged, lineVelocity, form, efficiency, clv] = await Promise.all([
            computeExpectedValueDevigged(prop),
            computeLineMovementVelocity(prop),
            computePlayerForm(prop),
            computeMarketEfficiency(prop),
            computeClosingLineValue(prop)
          ]);

          // Store in feature_values table using direct INSERT
          // (bypassing upsert since unique constraint doesn't exist yet)
          const featureRecords = [
            {
              entity_type: 'prop',
              entity_id: prop.id,
              sport: prop.sport,
              feature_name: 'expected_value_devigged',
              as_of: asOf,
              value: evDevigged
            },
            {
              entity_type: 'prop',
              entity_id: prop.id,
              sport: prop.sport,
              feature_name: 'line_movement_velocity',
              as_of: asOf,
              value: lineVelocity
            },
            {
              entity_type: 'prop',
              entity_id: prop.id,
              sport: prop.sport,
              feature_name: 'player_form',
              as_of: asOf,
              value: form
            },
            {
              entity_type: 'prop',
              entity_id: prop.id,
              sport: prop.sport,
              feature_name: 'market_efficiency',
              as_of: asOf,
              value: efficiency
            },
            {
              entity_type: 'prop',
              entity_id: prop.id,
              sport: prop.sport,
              feature_name: 'closing_line_value',
              as_of: asOf,
              value: clv
            }
          ];

          const { error: insertError } = await supabaseClient
            .from('feature_values')
            .insert(featureRecords);

          if (insertError) {
            throw insertError;
          }

          results.processed++;
          results.features.expectedValueDevigged++;
          results.features.lineMovementVelocity++;
          results.features.playerForm++;
          results.features.marketEfficiency++;
          results.features.closingLineValue++;

          // Log progress every 100 props
          if (results.processed % 100 === 0) {
            logger.info(`Progress: ${results.processed}/${results.total} props processed`);
          }
        } catch (error) {
          logger.error('Error processing prop', { propId: prop.id, error });
          results.errors++;
        }
      }

      // Small delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    logger.info('✅ Feature computation complete', results);

    // Summary statistics
    logger.info('Summary:', {
      totalProps: results.total,
      successfullyProcessed: results.processed,
      errors: results.errors,
      successRate: ((results.processed / results.total) * 100).toFixed(2) + '%',
      featuresPerProp: 5,
      totalFeaturesCreated: results.processed * 5
    });

  } catch (error) {
    logger.error('Fatal error in feature computation', { error });
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

export { main as computeCriticalFeatures };
