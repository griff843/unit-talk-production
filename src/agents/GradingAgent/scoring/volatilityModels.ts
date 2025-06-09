/**
 * Sport-Specific Volatility Models for the 25-Point Model
 * 
 * This module implements volatility adjustments for different sports and bet types,
 * accounting for the inherent variance in outcomes. It provides statistical models
 * to normalize scores across sports with different scoring patterns and volatility profiles.
 */

import { PropType } from '../../types/pickTypes';

/**
 * Configuration options for volatility models
 */
interface VolatilityModelOptions {
  /**
   * Base volatility factor (1.0 = neutral)
   */
  baseVolatility?: number;
  
  /**
   * Enable sport-specific adjustments
   */
  enableSportAdjustments?: boolean;
  
  /**
   * Enable bet type-specific adjustments
   */
  enableBetTypeAdjustments?: boolean;
  
  /**
   * Enable total-based adjustments (for over/under bets)
   */
  enableTotalBasedAdjustments?: boolean;
  
  /**
   * Enable historical variance adjustments
   */
  enableHistoricalVarianceAdjustments?: boolean;
}

const DEFAULT_OPTIONS: VolatilityModelOptions = {
  baseVolatility: 1.0,
  enableSportAdjustments: true,
  enableBetTypeAdjustments: true,
  enableTotalBasedAdjustments: true,
  enableHistoricalVarianceAdjustments: true
};

/**
 * Sport-specific base volatility factors
 * Higher values = more volatile (scores need more adjustment)
 */
const SPORT_VOLATILITY: Record<string, number> = {
  'NFL': 1.2,   // Moderate volatility
  'NBA': 0.8,   // Lower volatility (more predictable scoring)
  'MLB': 1.5,   // Higher volatility (low-scoring, high variance)
  'NHL': 1.6,   // Highest volatility (low-scoring, high variance)
  'SOCCER': 1.7, // Very high volatility (low-scoring)
  'TENNIS': 0.9, // Lower volatility (service advantage)
  'GOLF': 1.3,   // Moderate-high volatility
  'MMA': 1.4,    // High volatility (finish potential)
  'DEFAULT': 1.0 // Neutral volatility
};

/**
 * Bet type volatility factors
 * Higher values = more volatile (scores need more adjustment)
 */
const BET_TYPE_VOLATILITY: Record<string, number> = {
  'SPREAD': 1.0,       // Base volatility
  'MONEYLINE': 0.9,    // Slightly less volatile (binary outcome)
  'OVER_UNDER': 1.1,   // Slightly more volatile
  'PROP_BET': 1.3,     // More volatile (individual performance)
  'PARLAY': 1.5,       // High volatility (multiple outcomes)
  'TEASER': 1.2,       // Moderate-high volatility
  'DEFAULT': 1.0       // Neutral volatility
};

/**
 * Calculate volatility adjustment factor for a given prop
 * 
 * @param prop The prop object containing prediction data
 * @param options Optional configuration parameters
 * @returns A volatility factor to adjust scores (higher = more volatile)
 */
export function calculateVolatilityFactor(
  prop: any,
  options: VolatilityModelOptions = DEFAULT_OPTIONS
): number {
  const { 
    baseVolatility = 1.0,
    enableSportAdjustments = true,
    enableBetTypeAdjustments = true,
    enableTotalBasedAdjustments = true,
    enableHistoricalVarianceAdjustments = true
  } = options;
  
  if (!prop) {
    return baseVolatility;
  }

  try {
    let volatilityFactor = baseVolatility;
    
    // Apply sport-specific volatility
    if (enableSportAdjustments) {
      const sport = (prop.sport || prop.league || 'DEFAULT').toUpperCase();
      volatilityFactor *= SPORT_VOLATILITY[sport] || SPORT_VOLATILITY.DEFAULT;
    }
    
    // Apply bet type volatility
    if (enableBetTypeAdjustments) {
      const betType = (prop.prop_type || 'DEFAULT').toUpperCase();
      volatilityFactor *= BET_TYPE_VOLATILITY[betType] || BET_TYPE_VOLATILITY.DEFAULT;
    }
    
    // Apply total-based adjustments for over/under bets
    if (enableTotalBasedAdjustments && prop.prop_type === 'OVER_UNDER') {
      volatilityFactor *= calculateTotalBasedVolatility(prop);
    }
    
    // Apply historical variance adjustments
    if (enableHistoricalVarianceAdjustments) {
      volatilityFactor *= calculateHistoricalVarianceAdjustment(prop);
    }
    
    // Apply sport-specific special adjustments
    volatilityFactor *= calculateSportSpecificVolatility(prop);
    
    return volatilityFactor;
  } catch (error) {
    console.error('Error calculating volatility factor:', error);
    return baseVolatility;
  }
}

/**
 * Apply volatility adjustment to a raw score
 * 
 * @param rawScore The unadjusted score
 * @param volatilityFactor The calculated volatility factor
 * @returns Volatility-adjusted score
 */
export function applyVolatilityAdjustment(
  rawScore: number,
  volatilityFactor: number
): number {
  // For positive scores, higher volatility = lower adjusted score
  // For negative scores, higher volatility = higher adjusted score (less negative)
  if (rawScore >= 0) {
    return rawScore / Math.sqrt(volatilityFactor);
  } else {
    return rawScore * Math.sqrt(volatilityFactor);
  }
}

/**
 * Calculate volatility factor based on expected total points
 * Lower scoring games have higher volatility
 */
function calculateTotalBasedVolatility(prop: any): number {
  if (!prop.line_value) {
    return 1.0;
  }
  
  const totalPoints = parseFloat(prop.line_value);
  
  // Base model: lower totals have higher volatility
  if (totalPoints <= 30) {
    return 1.5;  // High volatility for low-scoring games
  } else if (totalPoints <= 45) {
    return 1.3;  // Moderately high volatility
  } else if (totalPoints <= 55) {
    return 1.1;  // Slightly elevated volatility
  } else if (totalPoints <= 200) {
    return 1.0;  // Average volatility (most NFL/NBA games)
  } else {
    return 0.9;  // Lower volatility for very high-scoring games
  }
}

/**
 * Calculate volatility adjustment based on historical variance data
 */
function calculateHistoricalVarianceAdjustment(prop: any): number {
  const historicalData = prop.context?.historical_variance || {};
  
  // If we have explicit historical variance data, use it
  if (historicalData.variance_factor) {
    return historicalData.variance_factor;
  }
  
  // If we have standard deviation data, calculate variance factor
  if (historicalData.standard_deviation && historicalData.mean) {
    // Coefficient of variation = standard deviation / mean
    const cv = historicalData.standard_deviation / Math.abs(historicalData.mean);
    
    // Higher CV = higher volatility
    if (cv > 0.5) {
      return 1.5;  // Very high variance
    } else if (cv > 0.3) {
      return 1.3;  // High variance
    } else if (cv > 0.2) {
      return 1.1;  // Moderate variance
    } else if (cv > 0.1) {
      return 1.0;  // Average variance
    } else {
      return 0.9;  // Low variance
    }
  }
  
  // Default to neutral if no historical data
  return 1.0;
}

/**
 * Calculate sport-specific volatility adjustments
 */
function calculateSportSpecificVolatility(prop: any): number {
  const sport = (prop.sport || prop.league || '').toUpperCase();
  
  switch (sport) {
    case 'NFL':
      return calculateNFLVolatility(prop);
    case 'NBA':
      return calculateNBAVolatility(prop);
    case 'MLB':
      return calculateMLBVolatility(prop);
    case 'NHL':
      return calculateNHLVolatility(prop);
    default:
      return 1.0;
  }
}

/**
 * NFL-specific volatility model
 */
function calculateNFLVolatility(prop: any): number {
  const context = prop.context || {};
  let factor = 1.0;
  
  // Divisional games tend to be less volatile
  if (context.is_division_game) {
    factor *= 0.9;
  }
  
  // Primetime games tend to have different variance patterns
  if (context.is_primetime) {
    factor *= 1.1;
  }
  
  // Games with backup QBs are more volatile
  if (context.has_backup_qb) {
    factor *= 1.25;
  }
  
  // Weather impacts volatility
  if (context.weather?.is_adverse) {
    factor *= 1.2;
  }
  
  // Late-season games between teams with nothing to play for can be volatile
  if (context.is_late_season && context.no_playoff_implications) {
    factor *= 1.3;
  }
  
  // Turnover-prone teams create more volatility
  if (context.teams_turnover_prone) {
    factor *= 1.15;
  }
  
  return factor;
}

/**
 * NBA-specific volatility model
 */
function calculateNBAVolatility(prop: any): number {
  const context = prop.context || {};
  let factor = 1.0;
  
  // Three-point heavy teams introduce more variance
  if (context.is_three_point_heavy_team) {
    factor *= 1.2;
  }
  
  // Back-to-back games have higher variance
  if (context.is_back_to_back) {
    factor *= 1.15;
  }
  
  // Teams with inconsistent rotations are more volatile
  if (context.has_inconsistent_rotation) {
    factor *= 1.1;
  }
  
  // Late-season games with resting players are highly volatile
  if (context.is_late_season && context.has_resting_players) {
    factor *= 1.3;
  }
  
  // Pace affects volatility (faster pace = more possessions = less variance)
  if (context.pace_factor) {
    if (context.pace_factor > 105) {
      factor *= 0.9;  // Fast-paced games are less volatile
    } else if (context.pace_factor < 95) {
      factor *= 1.1;  // Slow-paced games are more volatile
    }
  }
  
  return factor;
}

/**
 * MLB-specific volatility model
 */
function calculateMLBVolatility(prop: any): number {
  const context = prop.context || {};
  let factor = 1.0;
  
  // Starting pitcher quality affects volatility
  if (context.starting_pitcher_tier === 'ace') {
    factor *= 0.9;  // Ace pitchers reduce volatility
  } else if (context.starting_pitcher_tier === 'poor') {
    factor *= 1.2;  // Poor pitchers increase volatility
  }
  
  // Bullpen strength affects late-game volatility
  if (context.bullpen_strength === 'elite') {
    factor *= 0.9;
  } else if (context.bullpen_strength === 'weak') {
    factor *= 1.15;
  }
  
  // Ballpark factors affect run scoring volatility
  if (context.ballpark_factor) {
    if (context.ballpark_factor > 110) {
      factor *= 1.1;  // Hitter-friendly parks increase volatility
    } else if (context.ballpark_factor < 90) {
      factor *= 0.95;  // Pitcher-friendly parks decrease volatility
    }
  }
  
  // Weather conditions affect volatility
  if (context.weather?.wind_blowing_out) {
    factor *= 1.15;  // Wind blowing out increases volatility
  } else if (context.weather?.wind_blowing_in) {
    factor *= 0.95;  // Wind blowing in decreases volatility
  }
  
  return factor;
}

/**
 * NHL-specific volatility model
 */
function calculateNHLVolatility(prop: any): number {
  const context = prop.context || {};
  let factor = 1.0;
  
  // Goalie quality significantly affects volatility
  if (context.starting_goalie_quality === 'elite') {
    factor *= 0.85;  // Elite goalies reduce volatility
  } else if (context.starting_goalie_quality === 'poor') {
    factor *= 1.25;  // Poor goalies increase volatility
  }
  
  // Special teams efficiency affects volatility
  if (context.special_teams_efficiency === 'high') {
    factor *= 1.1;  // Efficient special teams can create more variance
  }
  
  // Back-to-back games increase volatility
  if (context.is_back_to_back) {
    factor *= 1.15;
  }
  
  // Late-season games with playoff implications have different patterns
  if (context.is_late_season) {
    if (context.has_playoff_implications) {
      factor *= 0.9;  // Teams play more structured hockey
    } else {
      factor *= 1.2;  // Nothing to play for can lead to volatile results
    }
  }
  
  return factor;
}

/**
 * Calculate volatility-adjusted score
 * 
 * @param prop The prop object containing prediction data
 * @param rawScore The unadjusted score
 * @param options Optional configuration parameters
 * @returns Volatility-adjusted score
 */
export function calculateVolatilityAdjustedScore(
  prop: any,
  rawScore: number,
  options: VolatilityModelOptions = DEFAULT_OPTIONS
): number {
  const volatilityFactor = calculateVolatilityFactor(prop, options);
  return applyVolatilityAdjustment(rawScore, volatilityFactor);
}

/**
 * Get raw volatility statistics for a sport
 * 
 * @param sport The sport identifier
 * @returns Object containing volatility statistics
 */
export function getSportVolatilityStats(sport: string): {
  baseVolatility: number;
  pointsPerGame: number;
  standardDeviation: number;
  coefficientOfVariation: number;
} {
  const sportUpper = sport.toUpperCase();
  
  switch (sportUpper) {
    case 'NFL':
      return {
        baseVolatility: SPORT_VOLATILITY.NFL,
        pointsPerGame: 45.0,
        standardDeviation: 13.5,
        coefficientOfVariation: 0.3
      };
    case 'NBA':
      return {
        baseVolatility: SPORT_VOLATILITY.NBA,
        pointsPerGame: 220.0,
        standardDeviation: 14.0,
        coefficientOfVariation: 0.064
      };
    case 'MLB':
      return {
        baseVolatility: SPORT_VOLATILITY.MLB,
        pointsPerGame: 8.5,
        standardDeviation: 3.2,
        coefficientOfVariation: 0.376
      };
    case 'NHL':
      return {
        baseVolatility: SPORT_VOLATILITY.NHL,
        pointsPerGame: 6.0,
        standardDeviation: 2.4,
        coefficientOfVariation: 0.4
      };
    case 'SOCCER':
      return {
        baseVolatility: SPORT_VOLATILITY.SOCCER,
        pointsPerGame: 2.7,
        standardDeviation: 1.7,
        coefficientOfVariation: 0.63
      };
    default:
      return {
        baseVolatility: SPORT_VOLATILITY.DEFAULT,
        pointsPerGame: 0,
        standardDeviation: 0,
        coefficientOfVariation: 0
      };
  }
}
