/**
 * Penalty Calculations for the 25-Point Model
 * 
 * This module applies score reductions for various factors that indicate a prediction
 * was flawed, even if it ultimately proved correct. It penalizes poor analytical reasoning,
 * statistically unsound predictions, ignoring key factors, or predictions that were
 * correct due to luck rather than sound analysis.
 */

import { PropType } from '../../types/pickTypes';

interface PenaltyOptions {
  /**
   * Maximum possible penalty (negative points)
   */
  maxPenalty?: number;
  
  /**
   * Penalty for poor analytical reasoning
   */
  poorReasoningPenalty?: number;
  
  /**
   * Penalty for statistically unsound predictions
   */
  statisticalErrorPenalty?: number;
  
  /**
   * Penalty for ignoring key contextual factors
   */
  ignoredFactorsPenalty?: number;
  
  /**
   * Penalty for predictions that were correct by luck rather than analysis
   */
  luckyOutcomePenalty?: number;
  
  /**
   * Penalty for inconsistent reasoning compared to similar past predictions
   */
  inconsistencyPenalty?: number;
}

const DEFAULT_OPTIONS: PenaltyOptions = {
  maxPenalty: -8.0,
  poorReasoningPenalty: -2.5,
  statisticalErrorPenalty: -3.0,
  ignoredFactorsPenalty: -2.0,
  luckyOutcomePenalty: -1.5,
  inconsistencyPenalty: -2.0
};

/**
 * Calculate penalties for flawed prediction methodology
 * 
 * @param prop The prop object containing prediction data and analysis
 * @param options Optional configuration parameters
 * @returns A penalty score (negative number) between 0 and maxPenalty
 */
export function calculatePenalties(
  prop: any,
  options: PenaltyOptions = DEFAULT_OPTIONS
): number {
  const { 
    maxPenalty = -8.0,
    poorReasoningPenalty = -2.5,
    statisticalErrorPenalty = -3.0,
    ignoredFactorsPenalty = -2.0,
    luckyOutcomePenalty = -1.5,
    inconsistencyPenalty = -2.0
  } = options;
  
  if (!prop) {
    return 0;
  }

  try {
    let totalPenalty = 0;
    
    // Check for poor analytical reasoning
    if (hasPoorReasoning(prop)) {
      totalPenalty += poorReasoningPenalty;
    }
    
    // Check for statistical errors
    if (hasStatisticalErrors(prop)) {
      totalPenalty += statisticalErrorPenalty;
    }
    
    // Check for ignored key factors
    if (hasIgnoredKeyFactors(prop)) {
      totalPenalty += ignoredFactorsPenalty;
    }
    
    // Check for lucky outcomes
    if (isLuckyOutcome(prop)) {
      totalPenalty += luckyOutcomePenalty;
    }
    
    // Check for inconsistent reasoning
    if (hasInconsistentReasoning(prop)) {
      totalPenalty += inconsistencyPenalty;
    }
    
    // Limit the total penalty to the maximum allowed (make it less negative)
    return Math.max(totalPenalty, maxPenalty);
  } catch (error) {
    console.error('Error calculating penalties:', error);
    return 0;
  }
}

/**
 * Determine if the prediction had poor analytical reasoning
 */
function hasPoorReasoning(prop: any): boolean {
  const analysis = prop.analysis || {};
  
  // Check for missing or inadequate reasoning
  const hasNoReasoning = !analysis.reasoning || 
                         analysis.reasoning.length < 20;
                         
  // Check for logical fallacies in reasoning
  const hasLogicalFallacies = analysis.has_logical_fallacies === true;
  
  // Check for over-reliance on narratives rather than data
  const isNarrativeDriven = analysis.is_narrative_driven === true &&
                           analysis.data_backed === false;
                           
  // Check for recency bias
  const hasRecencyBias = analysis.has_recency_bias === true;
  
  // Check for reasoning quality score (if available)
  const hasLowReasoningScore = analysis.reasoning_quality_score && 
                              analysis.reasoning_quality_score < 0.4;
                              
  return hasNoReasoning || hasLogicalFallacies || isNarrativeDriven || 
         hasRecencyBias || hasLowReasoningScore;
}

/**
 * Determine if the prediction contained statistical errors
 */
function hasStatisticalErrors(prop: any): boolean {
  const analysis = prop.analysis || {};
  
  // Check for misuse of statistics
  const hasMisusedStats = analysis.has_statistical_errors === true;
  
  // Check for sample size issues
  const hasSmallSampleSize = analysis.has_sample_size_issues === true;
  
  // Check for correlation/causation confusion
  const hasCorrelationCausationConfusion = analysis.confuses_correlation_causation === true;
  
  // Check for misunderstood probability
  const hasProbabilityErrors = analysis.has_probability_errors === true;
  
  // Check for regression to mean ignorance
  const ignoresRegression = analysis.ignores_regression_to_mean === true;
  
  // Check for statistical methodology score (if available)
  const hasLowStatScore = analysis.statistical_methodology_score && 
                         analysis.statistical_methodology_score < 0.5;
                         
  return hasMisusedStats || hasSmallSampleSize || hasCorrelationCausationConfusion || 
         hasProbabilityErrors || ignoresRegression || hasLowStatScore;
}

/**
 * Determine if the prediction ignored key contextual factors
 */
function hasIgnoredKeyFactors(prop: any): boolean {
  const analysis = prop.analysis || {};
  const context = prop.context || {};
  
  // Get list of key factors that should have been considered
  const keyFactors = context.key_factors || [];
  
  // Get list of factors that were actually considered
  const consideredFactors = analysis.considered_factors || [];
  
  // Check if any key factors were ignored
  const hasIgnoredFactors = keyFactors.some(factor => 
    !consideredFactors.includes(factor)
  );
  
  // Check if analysis explicitly ignored important factors
  const explicitlyIgnoredFactors = analysis.ignored_key_factors === true;
  
  // Check for completeness score (if available)
  const hasLowCompletenessScore = analysis.completeness_score && 
                                 analysis.completeness_score < 0.6;
                                 
  return hasIgnoredFactors || explicitlyIgnoredFactors || hasLowCompletenessScore;
}

/**
 * Determine if the prediction was correct due to luck rather than analysis
 */
function isLuckyOutcome(prop: any): boolean {
  // Only apply to correct predictions
  if (!prop.is_win) {
    return false;
  }
  
  const analysis = prop.analysis || {};
  
  // Check if the winning factor wasn't mentioned in analysis
  const winningFactorIgnored = analysis.mentioned_winning_factor === false;
  
  // Check if the prediction was based on incorrect assumptions
  const hadIncorrectAssumptions = analysis.had_incorrect_assumptions === true;
  
  // Check if the prediction was right for wrong reasons
  const rightForWrongReasons = analysis.right_for_wrong_reasons === true;
  
  // Check if the outcome was highly improbable based on pre-game factors
  const wasImprobableOutcome = analysis.was_improbable_outcome === true;
  
  // Check for luck factor score (if available)
  const hasHighLuckScore = analysis.luck_factor_score && 
                          analysis.luck_factor_score > 0.7;
                          
  return winningFactorIgnored || hadIncorrectAssumptions || 
         rightForWrongReasons || wasImprobableOutcome || hasHighLuckScore;
}

/**
 * Determine if the prediction reasoning is inconsistent with similar past predictions
 */
function hasInconsistentReasoning(prop: any): boolean {
  const analysis = prop.analysis || {};
  
  // Check for explicit inconsistency flag
  const isExplicitlyInconsistent = analysis.is_inconsistent_with_past === true;
  
  // Check for contradictory reasoning compared to similar past picks
  const hasContradictoryReasoning = analysis.has_contradictory_reasoning === true;
  
  // Check for selective use of statistics
  const hasSelectiveStats = analysis.uses_stats_selectively === true;
  
  // Check for consistency score (if available)
  const hasLowConsistencyScore = analysis.consistency_score && 
                                analysis.consistency_score < 0.5;
                                
  return isExplicitlyInconsistent || hasContradictoryReasoning || 
         hasSelectiveStats || hasLowConsistencyScore;
}

/**
 * Calculate sport-specific penalties
 */
export function calculateSportSpecificPenalties(prop: any): number {
  const sport = prop.sport || prop.league;
  let sportPenalty = 0;
  
  switch (sport?.toUpperCase()) {
    case 'NFL':
      sportPenalty = calculateNFLPenalties(prop);
      break;
      
    case 'NBA':
      sportPenalty = calculateNBAPenalties(prop);
      break;
      
    case 'MLB':
      sportPenalty = calculateMLBPenalties(prop);
      break;
      
    case 'NHL':
      sportPenalty = calculateNHLPenalties(prop);
      break;
      
    default:
      sportPenalty = 0;
  }
  
  return sportPenalty;
}

/**
 * NFL-specific penalties
 */
function calculateNFLPenalties(prop: any): number {
  const analysis = prop.analysis || {};
  let penalty = 0;
  
  // Ignoring turnover luck
  if (analysis.ignored_turnover_variance === true) {
    penalty -= 1.0;
  }
  
  // Overemphasizing QB without considering O-line
  if (analysis.overemphasized_qb === true && analysis.considered_oline === false) {
    penalty -= 0.75;
  }
  
  // Ignoring weather in relevant situations
  if (analysis.ignored_weather === true && prop.context?.weather?.is_significant === true) {
    penalty -= 1.0;
  }
  
  return penalty;
}

/**
 * NBA-specific penalties
 */
function calculateNBAPenalties(prop: any): number {
  const analysis = prop.analysis || {};
  let penalty = 0;
  
  // Ignoring rest disadvantage
  if (analysis.ignored_rest_disadvantage === true) {
    penalty -= 0.75;
  }
  
  // Ignoring pace factors
  if (analysis.ignored_pace_factors === true) {
    penalty -= 0.5;
  }
  
  // Ignoring three-point variance
  if (analysis.ignored_3pt_variance === true) {
    penalty -= 0.75;
  }
  
  return penalty;
}

/**
 * MLB-specific penalties
 */
function calculateMLBPenalties(prop: any): number {
  const analysis = prop.analysis || {};
  let penalty = 0;
  
  // Ignoring ballpark factors
  if (analysis.ignored_ballpark_factors === true) {
    penalty -= 0.75;
  }
  
  // Overemphasizing small sample batter vs. pitcher matchups
  if (analysis.overemphasized_batter_pitcher_matchups === true) {
    penalty -= 1.0;
  }
  
  // Ignoring bullpen status
  if (analysis.ignored_bullpen_status === true) {
    penalty -= 0.75;
  }
  
  return penalty;
}

/**
 * NHL-specific penalties
 */
function calculateNHLPenalties(prop: any): number {
  const analysis = prop.analysis || {};
  let penalty = 0;
  
  // Ignoring goalie matchup
  if (analysis.ignored_goalie_matchup === true) {
    penalty -= 1.0;
  }
  
  // Overemphasizing recent goal scoring (high variance)
  if (analysis.overemphasized_recent_scoring === true) {
    penalty -= 0.75;
  }
  
  // Ignoring special teams performance
  if (analysis.ignored_special_teams === true) {
    penalty -= 0.5;
  }
  
  return penalty;
}

/**
 * Calculate time-based penalties (predictions that aged poorly)
 */
export function calculateTimePenalties(prop: any): number {
  const analysis = prop.analysis || {};
  
  // Check when the prediction was made
  const predictionTime = new Date(prop.prediction_timestamp).getTime();
  const gameTime = new Date(prop.game_timestamp).getTime();
  const timeToGame = gameTime - predictionTime;
  
  // No penalty for predictions close to game time
  if (timeToGame < 24 * 60 * 60 * 1000) { // Less than 24 hours before game
    return 0;
  }
  
  let timePenalty = 0;
  
  // Penalty for not updating analysis when new information emerged
  if (analysis.failed_to_update_with_new_info === true) {
    timePenalty -= 1.5;
  }
  
  // Penalty for early prediction that didn't account for later developments
  if (timeToGame > 3 * 24 * 60 * 60 * 1000 && // More than 3 days before
      analysis.accounted_for_late_developments === false) {
    timePenalty -= 1.0;
  }
  
  return timePenalty;
}
