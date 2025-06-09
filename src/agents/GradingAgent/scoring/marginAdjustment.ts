/**
 * Margin Adjustment Calculator for the 25-Point Model
 * 
 * This module calculates score adjustments based on how close the actual result
 * was to the predicted line, with different handling for over/under vs point spread bets.
 * Implements diminishing returns for large margins using a sigmoid-based curve.
 */

import { PropType } from '../../types/pickTypes';

interface MarginAdjustmentOptions {
  /**
   * Maximum possible adjustment (positive or negative)
   */
  maxAdjustment?: number;
  
  /**
   * Scaling factor for diminishing returns curve
   */
  scalingFactor?: number;
  
  /**
   * Threshold where diminishing returns begin to take effect (in points/units)
   */
  diminishingReturnsThreshold?: number;
}

const DEFAULT_OPTIONS: MarginAdjustmentOptions = {
  maxAdjustment: 5.0,
  scalingFactor: 0.5,
  diminishingReturnsThreshold: 7.0
};

/**
 * Calculate margin adjustment score based on how close the actual result was to the line
 * 
 * @param prop The prop object containing prediction and actual result data
 * @param options Optional configuration parameters
 * @returns A score adjustment between -maxAdjustment and +maxAdjustment
 */
export function calculateMarginAdjustment(
  prop: any,
  options: MarginAdjustmentOptions = DEFAULT_OPTIONS
): number {
  const { maxAdjustment = 5.0, scalingFactor = 0.5, diminishingReturnsThreshold = 7.0 } = options;
  
  if (!prop || !prop.actual_result || !prop.line_value) {
    return 0; // Cannot calculate without required data
  }

  try {
    // Extract required values
    const actualValue = parseFloat(prop.actual_result);
    const lineValue = parseFloat(prop.line_value);
    const propType = prop.prop_type as PropType;
    
    // Calculate raw margin (how far from the line)
    let rawMargin: number;
    
    switch (propType) {
      case 'OVER_UNDER':
        rawMargin = calculateOverUnderMargin(actualValue, lineValue, prop.pick_type === 'OVER');
        break;
      
      case 'SPREAD':
        rawMargin = calculateSpreadMargin(actualValue, lineValue, prop.team_id, prop.opponent_team_id);
        break;
        
      case 'MONEYLINE':
        // For moneyline bets, margin is binary (win/loss) but can be weighted by odds
        rawMargin = prop.is_win ? 10 : -10;
        break;
        
      case 'PROP_BET':
        // For player props, calculate based on over/under logic
        rawMargin = calculateOverUnderMargin(actualValue, lineValue, prop.pick_type === 'OVER');
        break;
        
      default:
        return 0; // Unknown prop type
    }
    
    // Apply diminishing returns curve to the raw margin
    return applyDiminishingReturnsCurve(
      rawMargin, 
      maxAdjustment, 
      scalingFactor, 
      diminishingReturnsThreshold
    );
  } catch (error) {
    console.error('Error calculating margin adjustment:', error);
    return 0;
  }
}

/**
 * Calculate margin for over/under bets
 */
function calculateOverUnderMargin(actualValue: number, lineValue: number, isOver: boolean): number {
  const difference = actualValue - lineValue;
  
  // For over bets, positive difference is good
  // For under bets, negative difference is good
  return isOver ? difference : -difference;
}

/**
 * Calculate margin for spread bets
 */
function calculateSpreadMargin(
  actualValue: number, 
  lineValue: number, 
  teamId: string, 
  opponentTeamId: string
): number {
  // For spread bets, we need to know which team the bet was on
  // and calculate the actual spread vs the predicted spread
  
  // This is a simplified implementation - in a real system,
  // you would need to determine the actual point difference between teams
  const actualSpread = actualValue;
  
  // Positive line value means team is underdog, negative means favorite
  // The margin is how much better/worse the team did compared to the spread
  return actualSpread - lineValue;
}

/**
 * Apply a diminishing returns curve to the raw margin
 * Uses a modified sigmoid function to create a smooth curve
 */
function applyDiminishingReturnsCurve(
  rawMargin: number,
  maxAdjustment: number,
  scalingFactor: number,
  threshold: number
): number {
  // If margin is within threshold, apply linear scaling
  if (Math.abs(rawMargin) <= threshold) {
    return (rawMargin / threshold) * maxAdjustment * 0.6; // 60% of max for within-threshold values
  }
  
  // For values beyond threshold, apply sigmoid curve for diminishing returns
  const normalizedMargin = (Math.abs(rawMargin) - threshold) * scalingFactor;
  const sigmoidFactor = 2 / (1 + Math.exp(-normalizedMargin)) - 1; // Ranges from 0 to 1
  
  // Calculate additional adjustment (40% of max) with diminishing returns
  const additionalAdjustment = sigmoidFactor * maxAdjustment * 0.4;
  
  // Combine base adjustment with additional adjustment, preserving sign
  const sign = rawMargin >= 0 ? 1 : -1;
  return sign * ((maxAdjustment * 0.6) + additionalAdjustment);
}

/**
 * Calculate margin adjustment specifically for volatility-adjusted scoring
 * Takes into account the sport and typical scoring patterns
 */
export function calculateVolatilityAdjustedMargin(
  prop: any,
  sportVolatility: number = 1.0
): number {
  const baseAdjustment = calculateMarginAdjustment(prop);
  
  // Apply sport-specific volatility factor
  // Higher volatility sports (like basketball) get reduced margin impact
  // Lower volatility sports (like soccer) get increased margin impact
  return baseAdjustment / sportVolatility;
}
