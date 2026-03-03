/**
 * Hedge Detector Activity
 *
 * Detects hedge opportunities and arbitrage opportunities across different bookmakers
 * from real-time prop data ingestion.
 *
 * Phase 7: AlertAgent Integration for Real-Time Hedge Detection
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { withCircuitBreaker } from '../../../services/enhanced-circuit-breaker';
import { Logger } from '../../../shared/logger/types';
import { requireSupabase } from '../../../utils/supabaseUtils';

export interface HedgeOpportunity {
  type: 'hedge' | 'arbitrage' | 'middle';
  playerName: string;
  market: string;
  sport: string;
  gameDate: string;

  // Bookmaker A (primary)
  bookmakerA: string;
  bookmakerATitleA: string;
  lineA: number;
  oddsA: number;
  propIdA: string;

  // Bookmaker B (hedge)
  bookmakerB: string;
  bookmakerBTitleB: string;
  lineB: number;
  oddsB: number;
  propIdB: string;

  // Opportunity metrics
  lineDiscrepancy: number;
  impliedProbabilityA: number;
  impliedProbabilityB: number;
  totalImpliedProbability: number;
  arbitragePercentage: number;
  profitPotential: number;

  // Hedge-specific metrics
  guaranteedProfit?: number;
  riskFreePercentage?: number;

  // Middle-specific metrics
  middleGap?: number;
  winProbability?: number;

  alertPriority: 'low' | 'medium' | 'high' | 'critical';
  metadata: Record<string, any>;
}

export interface HedgeDetectionConfig {
  minLineDiscrepancy: number; // Minimum line gap for hedge (e.g., 3.0 points)
  minArbitragePercentage: number; // Minimum arbitrage % (e.g., 1.0%)
  minMiddleGap: number; // Minimum gap for middle opportunities (e.g., 2.0 points)
  lookbackMinutes: number; // Time window to find matching props (e.g., 15 minutes)
}

const DEFAULT_CONFIG: HedgeDetectionConfig = {
  minLineDiscrepancy: 3.0,
  minArbitragePercentage: 1.0,
  minMiddleGap: 2.0,
  lookbackMinutes: 15,
};

/**
 * Detect hedge opportunities from newly inserted prop
 */
export async function detectHedgeOpportunities(
  newProp: any,
  logger: Logger,
  config: Partial<HedgeDetectionConfig> = {}
): Promise<HedgeOpportunity[]> {
  const startTime = Date.now();
  const detectionConfig = { ...DEFAULT_CONFIG, ...config };
  const opportunities: HedgeOpportunity[] = [];

  try {
    logger.info('🔍 Analyzing hedge opportunities for new prop', {
      propId: newProp.id,
      playerName: newProp.player_name,
      market: newProp.stat_type,
      line: newProp.line,
      bookmaker: newProp.bookmaker_key,
    });

    // Find matching props from other bookmakers
    const matchingProps = await getMatchingPropsFromOtherBookmakers(
      newProp,
      detectionConfig.lookbackMinutes,
      logger
    );

    if (!matchingProps || matchingProps.length === 0) {
      logger.debug('No matching props found from other bookmakers', {
        playerName: newProp.player_name,
        market: newProp.stat_type,
      });
      return opportunities;
    }

    logger.info(`📊 Analyzing ${matchingProps.length} matching props for hedge opportunities`, {
      playerName: newProp.player_name,
      market: newProp.stat_type,
    });

    // Analyze each matching prop for hedge opportunities
    for (const matchingProp of matchingProps) {
      const opportunity = analyzeHedgeOpportunity(newProp, matchingProp, detectionConfig, logger);

      if (opportunity) {
        opportunities.push(opportunity);
      }
    }

    const processingTime = Date.now() - startTime;
    logger.info('✅ Hedge opportunity detection complete', {
      playerName: newProp.player_name,
      opportunitiesFound: opportunities.length,
      processingTimeMs: processingTime,
    });

    return opportunities;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('❌ Error detecting hedge opportunities', {
      propId: newProp.id,
      playerName: newProp.player_name,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs: processingTime,
    });
    return opportunities;
  }
}

/**
 * Get matching props from other bookmakers for the same player and market
 */
async function getMatchingPropsFromOtherBookmakers(
  prop: any,
  lookbackMinutes: number,
  logger: Logger
): Promise<any[]> {
  try {
    const supabase = requireSupabase();
    const lookbackTime = new Date(Date.now() - lookbackMinutes * 60 * 1000).toISOString();

    const { data, error } = await withCircuitBreaker.supabase(
      async () => {
        return await supabase
          .from('raw_props')
          .select('*')
          .eq('player_name', prop.player_name)
          .eq('stat_type', prop.stat_type)
          .neq('bookmaker_key', prop.bookmaker_key) // Different bookmakers only
          .gte('created_at', lookbackTime)
          .order('created_at', { ascending: false });
      },
      async () => {
        logger.warn('Circuit breaker open, unable to fetch matching props');
        return { data: null, error: new Error('Circuit breaker open') };
      }
    );

    if (error) {
      logger.warn('Failed to fetch matching props', {
        error: error.message,
        playerName: prop.player_name,
      });
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('Error fetching matching props', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Analyze two props for hedge opportunity
 */
function analyzeHedgeOpportunity(
  propA: any,
  propB: any,
  config: HedgeDetectionConfig,
  logger: Logger
): HedgeOpportunity | null {
  try {
    // Calculate line discrepancy
    const lineDiscrepancy = Math.abs(propA.line - propB.line);

    // Check minimum line discrepancy threshold
    if (lineDiscrepancy < config.minLineDiscrepancy) {
      return null;
    }

    // Calculate implied probabilities from American odds
    const impliedProbA = calculateImpliedProbability(propA.odds);
    const impliedProbB = calculateImpliedProbability(propB.odds);
    const totalImpliedProb = impliedProbA + impliedProbB;

    // Calculate arbitrage percentage (negative total implied prob indicates arb)
    const arbitragePercentage = (1 - totalImpliedProb) * 100;

    // Determine opportunity type
    let opportunityType: 'hedge' | 'arbitrage' | 'middle' = 'hedge';
    let profitPotential = 0;
    let guaranteedProfit = 0;
    let riskFreePercentage = 0;
    let middleGap = 0;
    let winProbability = 0;

    // Check for arbitrage opportunity
    if (arbitragePercentage >= config.minArbitragePercentage) {
      opportunityType = 'arbitrage';
      profitPotential = arbitragePercentage;
      guaranteedProfit = calculateGuaranteedProfit(propA.odds, propB.odds);
      riskFreePercentage = arbitragePercentage;

      logger.info('💰 Arbitrage opportunity detected', {
        playerName: propA.player_name,
        lineA: propA.line,
        lineB: propB.line,
        arbitragePercentage: arbitragePercentage.toFixed(2),
      });
    }
    // Check for middle opportunity
    else if (lineDiscrepancy >= config.minMiddleGap) {
      opportunityType = 'middle';
      middleGap = lineDiscrepancy;
      winProbability = calculateMiddleWinProbability(lineDiscrepancy, impliedProbA, impliedProbB);
      profitPotential = winProbability * 100;

      logger.info('🎯 Middle opportunity detected', {
        playerName: propA.player_name,
        lineA: propA.line,
        lineB: propB.line,
        middleGap: middleGap.toFixed(2),
        winProbability: (winProbability * 100).toFixed(1),
      });
    }
    // Standard hedge opportunity
    else {
      profitPotential = Math.abs(arbitragePercentage);
      riskFreePercentage = Math.max(0, profitPotential);

      logger.debug('🔄 Hedge opportunity detected', {
        playerName: propA.player_name,
        lineDiscrepancy: lineDiscrepancy.toFixed(2),
      });
    }

    // Determine alert priority
    const alertPriority = determineHedgePriority(opportunityType, lineDiscrepancy, profitPotential);

    const opportunity: HedgeOpportunity = {
      type: opportunityType,
      playerName: propA.player_name,
      market: propA.stat_type,
      sport: propA.sport,
      gameDate: propA.game_date,

      bookmakerA: propA.bookmaker_key,
      bookmakerATitleA: propA.bookmaker_title,
      lineA: propA.line,
      oddsA: propA.odds,
      propIdA: propA.id,

      bookmakerB: propB.bookmaker_key,
      bookmakerBTitleB: propB.bookmaker_title,
      lineB: propB.line,
      oddsB: propB.odds,
      propIdB: propB.id,

      lineDiscrepancy,
      impliedProbabilityA: impliedProbA,
      impliedProbabilityB: impliedProbB,
      totalImpliedProbability: totalImpliedProb,
      arbitragePercentage,
      profitPotential,

      guaranteedProfit: opportunityType === 'arbitrage' ? guaranteedProfit : undefined,
      riskFreePercentage: opportunityType === 'arbitrage' ? riskFreePercentage : undefined,

      middleGap: opportunityType === 'middle' ? middleGap : undefined,
      winProbability: opportunityType === 'middle' ? winProbability : undefined,

      alertPriority,
      metadata: {
        matchupA: propA.matchup,
        matchupB: propB.matchup,
        teamA: propA.team,
        teamB: propB.team,
        detectedAt: new Date().toISOString(),
      },
    };

    return opportunity;
  } catch (error) {
    logger.error('Error analyzing hedge opportunity', {
      propIdA: propA.id,
      propIdB: propB.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Calculate implied probability from American odds
 */
function calculateImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    // Positive odds: implied prob = 100 / (odds + 100)
    return 100 / (americanOdds + 100);
  } else {
    // Negative odds: implied prob = |odds| / (|odds| + 100)
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

/**
 * Calculate guaranteed profit from arbitrage opportunity
 */
function calculateGuaranteedProfit(oddsA: number, oddsB: number): number {
  const impliedProbA = calculateImpliedProbability(oddsA);
  const impliedProbB = calculateImpliedProbability(oddsB);
  const totalImpliedProb = impliedProbA + impliedProbB;

  // Guaranteed profit as percentage of stake
  return (1 - totalImpliedProb) * 100;
}

/**
 * Calculate win probability for middle opportunities
 */
function calculateMiddleWinProbability(
  middleGap: number,
  impliedProbA: number,
  impliedProbB: number
): number {
  // Simplified win probability estimation based on middle gap and implied probabilities
  // Higher middle gap = higher win probability
  // Formula: base probability * (1 - total implied prob adjustment)
  const baseProbability = Math.min(0.8, middleGap / 10);
  const impliedProbAdjustment = (impliedProbA + impliedProbB) / 2;

  return baseProbability * (1 - impliedProbAdjustment * 0.5);
}

/**
 * Determine alert priority for hedge opportunity
 */
function determineHedgePriority(
  type: 'hedge' | 'arbitrage' | 'middle',
  lineDiscrepancy: number,
  profitPotential: number
): 'low' | 'medium' | 'high' | 'critical' {
  // Critical: High arbitrage percentage or large middle gap
  if (type === 'arbitrage' && profitPotential >= 5.0) {
    return 'critical';
  }
  if (type === 'middle' && lineDiscrepancy >= 5.0) {
    return 'critical';
  }

  // High: Good arbitrage or middle opportunity
  if (type === 'arbitrage' && profitPotential >= 2.0) {
    return 'high';
  }
  if (type === 'middle' && lineDiscrepancy >= 4.0) {
    return 'high';
  }

  // Medium: Moderate opportunity
  if (type === 'arbitrage' && profitPotential >= 1.0) {
    return 'medium';
  }
  if (type === 'middle' && lineDiscrepancy >= 3.0) {
    return 'medium';
  }

  // Low: Standard hedge
  return 'low';
}

/**
 * Store hedge opportunity in database for historical tracking
 */
export async function storeHedgeOpportunity(
  opportunity: HedgeOpportunity,
  logger: Logger
): Promise<void> {
  try {
    const supabase = requireSupabase();

    await withCircuitBreaker.supabase(
      async () => {
        const { error } = await supabase.from('hedge_opportunities').insert({
          type: opportunity.type,
          player_name: opportunity.playerName,
          market: opportunity.market,
          sport: opportunity.sport,
          game_date: opportunity.gameDate,

          bookmaker_a: opportunity.bookmakerA,
          bookmaker_a_title: opportunity.bookmakerATitleA,
          line_a: opportunity.lineA,
          odds_a: opportunity.oddsA,
          prop_id_a: opportunity.propIdA,

          bookmaker_b: opportunity.bookmakerB,
          bookmaker_b_title: opportunity.bookmakerBTitleB,
          line_b: opportunity.lineB,
          odds_b: opportunity.oddsB,
          prop_id_b: opportunity.propIdB,

          line_discrepancy: opportunity.lineDiscrepancy,
          implied_probability_a: opportunity.impliedProbabilityA,
          implied_probability_b: opportunity.impliedProbabilityB,
          total_implied_probability: opportunity.totalImpliedProbability,
          arbitrage_percentage: opportunity.arbitragePercentage,
          profit_potential: opportunity.profitPotential,

          guaranteed_profit: opportunity.guaranteedProfit,
          risk_free_percentage: opportunity.riskFreePercentage,
          middle_gap: opportunity.middleGap,
          win_probability: opportunity.winProbability,

          alert_priority: opportunity.alertPriority,
          metadata: opportunity.metadata,
          detected_at: new Date().toISOString(),
        });

        if (error) {
          throw new Error(`Failed to store hedge opportunity: ${error.message}`);
        }

        logger.info('✅ Hedge opportunity stored in database', {
          type: opportunity.type,
          playerName: opportunity.playerName,
          profitPotential: opportunity.profitPotential.toFixed(2),
        });
      },
      async () => {
        logger.warn('Failed to store hedge opportunity, circuit breaker open', {
          playerName: opportunity.playerName,
        });
      }
    );
  } catch (error) {
    logger.error('Error storing hedge opportunity', {
      playerName: opportunity.playerName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
