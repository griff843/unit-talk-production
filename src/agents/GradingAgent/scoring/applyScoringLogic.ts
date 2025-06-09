import { calculateTrendScore } from './trendScore';
import { calculateMatchupScore } from './matchupScore';
import { calculateExpectedValue } from './expectedValue';
import { calculateConfidenceScore } from './confidenceScore';
import { calculateLineValueScore } from './lineValueScore';
import { calculateRoleStabilityScore } from './roleStabilityScore';
import { calculateMarginAdjustment } from './marginAdjustment';
import { calculateContextualBonus, calculateSportSpecificBonus } from './contextualBonus';
import { calculatePenalties, calculateSportSpecificPenalties, calculateTimePenalties } from './penaltyCalculations';
import { calculateVolatilityFactor, calculateVolatilityAdjustedScore } from './volatilityModels';
import { determineTier } from './determineTier';

/**
 * Applies the comprehensive 25-Point Model scoring logic to a prop
 * 
 * The 25-Point Model incorporates:
 * - Core statistical factors (trend, matchup, expected value)
 * - Confidence and line value assessments
 * - Role stability and consistency metrics
 * - Margin adjustments based on actual vs. predicted outcomes
 * - Contextual bonuses for challenging predictions
 * - Penalties for flawed methodology
 * - Sport-specific volatility adjustments
 * 
 * @param prop The prop object to score
 * @returns The prop with all calculated scores
 */
export function applyScoringLogic(prop: any) {
  // Calculate base scores
  const trend_score = calculateTrendScore(prop);
  const matchup_score = calculateMatchupScore(prop);
  const ev_percent = calculateExpectedValue(prop);
  const confidence_score = calculateConfidenceScore({
    trend_score,
    matchup_score,
    ev_percent
  });
  const line_value_score = calculateLineValueScore(prop);
  const role_stability = calculateRoleStabilityScore(prop);

  // Calculate new scoring components
  const margin_adjustment = calculateMarginAdjustment(prop);
  const contextual_bonus = calculateContextualBonus(prop);
  const sport_specific_bonus = calculateSportSpecificBonus(prop);
  const penalties = calculatePenalties(prop);
  const sport_specific_penalties = calculateSportSpecificPenalties(prop);
  const time_penalties = calculateTimePenalties(prop);
  
  // Calculate total bonuses and penalties
  const total_bonus = contextual_bonus + sport_specific_bonus;
  const total_penalties = penalties + sport_specific_penalties + time_penalties;

  // Calculate raw composite score (before volatility adjustment)
  const raw_composite_score = 
    (trend_score ?? 0) +
    (matchup_score ?? 0) +
    (confidence_score ?? 0) +
    (line_value_score ?? 0) +
    (role_stability ?? 0) +
    (margin_adjustment ?? 0) +
    (total_bonus ?? 0) +
    (total_penalties ?? 0);

  // Calculate volatility factor for this prop
  const volatility_factor = calculateVolatilityFactor(prop);
  
  // Apply volatility adjustment to get final composite score
  const composite_score = calculateVolatilityAdjustedScore(
    prop,
    raw_composite_score,
    { baseVolatility: volatility_factor }
  );

  // Determine tier based on final composite score
  const tier = determineTier(composite_score);

  // Return prop with all calculated scores
  return {
    ...prop,
    // Base scores
    trend_score,
    matchup_score,
    ev_percent,
    confidence_score,
    line_value_score,
    role_stability,
    
    // New scoring components
    margin_adjustment,
    contextual_bonus,
    sport_specific_bonus,
    penalties,
    sport_specific_penalties,
    time_penalties,
    
    // Aggregated scores
    total_bonus,
    total_penalties,
    raw_composite_score,
    
    // Volatility adjustment
    volatility_factor,
    
    // Final results
    composite_score,
    tier,
    
    // Metadata
    scoring_version: "25-point-model-v1.0",
    scoring_timestamp: new Date().toISOString()
  };
}

/**
 * Apply scoring logic with detailed component breakdown
 * Used for analysis and debugging purposes
 */
export function applyScoringLogicWithBreakdown(prop: any) {
  const scoredProp = applyScoringLogic(prop);
  
  // Calculate percentage contribution of each component to the raw score
  const components = [
    { name: 'trend_score', value: scoredProp.trend_score || 0 },
    { name: 'matchup_score', value: scoredProp.matchup_score || 0 },
    { name: 'confidence_score', value: scoredProp.confidence_score || 0 },
    { name: 'line_value_score', value: scoredProp.line_value_score || 0 },
    { name: 'role_stability', value: scoredProp.role_stability || 0 },
    { name: 'margin_adjustment', value: scoredProp.margin_adjustment || 0 },
    { name: 'contextual_bonus', value: scoredProp.contextual_bonus || 0 },
    { name: 'sport_specific_bonus', value: scoredProp.sport_specific_bonus || 0 },
    { name: 'penalties', value: scoredProp.penalties || 0 },
    { name: 'sport_specific_penalties', value: scoredProp.sport_specific_penalties || 0 },
    { name: 'time_penalties', value: scoredProp.time_penalties || 0 }
  ];
  
  // Calculate absolute sum for percentage calculations
  const absoluteSum = components.reduce((sum, component) => sum + Math.abs(component.value), 0);
  
  // Calculate contribution percentages
  const componentBreakdown = components.map(component => ({
    name: component.name,
    value: component.value,
    percentage: absoluteSum > 0 ? (Math.abs(component.value) / absoluteSum) * 100 : 0
  }));
  
  return {
    ...scoredProp,
    component_breakdown: componentBreakdown,
    volatility_adjustment_impact: scoredProp.composite_score - scoredProp.raw_composite_score
  };
}

/**
 * Apply tiered weighting to different scoring components
 * This allows for customizing the importance of different factors
 */
export function applyWeightedScoringLogic(prop: any, weights: Record<string, number> = {}) {
  // Default weights
  const defaultWeights = {
    trend_score: 1.0,
    matchup_score: 1.0,
    confidence_score: 1.0,
    line_value_score: 1.0,
    role_stability: 0.8,
    margin_adjustment: 1.2,
    contextual_bonus: 0.9,
    sport_specific_bonus: 0.7,
    penalties: 1.1,
    sport_specific_penalties: 0.8,
    time_penalties: 0.6
  };
  
  // Merge provided weights with defaults
  const finalWeights = { ...defaultWeights, ...weights };
  
  // Calculate base scores
  const trend_score = calculateTrendScore(prop) * finalWeights.trend_score;
  const matchup_score = calculateMatchupScore(prop) * finalWeights.matchup_score;
  const ev_percent = calculateExpectedValue(prop);
  const confidence_score = calculateConfidenceScore({
    trend_score: trend_score / finalWeights.trend_score, // Use unweighted for calculation
    matchup_score: matchup_score / finalWeights.matchup_score, // Use unweighted for calculation
    ev_percent
  }) * finalWeights.confidence_score;
  const line_value_score = calculateLineValueScore(prop) * finalWeights.line_value_score;
  const role_stability = calculateRoleStabilityScore(prop) * finalWeights.role_stability;

  // Calculate new scoring components with weights
  const margin_adjustment = calculateMarginAdjustment(prop) * finalWeights.margin_adjustment;
  const contextual_bonus = calculateContextualBonus(prop) * finalWeights.contextual_bonus;
  const sport_specific_bonus = calculateSportSpecificBonus(prop) * finalWeights.sport_specific_bonus;
  const penalties = calculatePenalties(prop) * finalWeights.penalties;
  const sport_specific_penalties = calculateSportSpecificPenalties(prop) * finalWeights.sport_specific_penalties;
  const time_penalties = calculateTimePenalties(prop) * finalWeights.time_penalties;
  
  // Calculate total bonuses and penalties
  const total_bonus = contextual_bonus + sport_specific_bonus;
  const total_penalties = penalties + sport_specific_penalties + time_penalties;

  // Calculate raw composite score (before volatility adjustment)
  const raw_composite_score = 
    (trend_score ?? 0) +
    (matchup_score ?? 0) +
    (confidence_score ?? 0) +
    (line_value_score ?? 0) +
    (role_stability ?? 0) +
    (margin_adjustment ?? 0) +
    (total_bonus ?? 0) +
    (total_penalties ?? 0);

  // Calculate volatility factor for this prop
  const volatility_factor = calculateVolatilityFactor(prop);
  
  // Apply volatility adjustment to get final composite score
  const composite_score = calculateVolatilityAdjustedScore(
    prop,
    raw_composite_score,
    { baseVolatility: volatility_factor }
  );

  // Determine tier based on final composite score
  const tier = determineTier(composite_score);

  return {
    ...prop,
    // All scores and metadata
    trend_score,
    matchup_score,
    ev_percent,
    confidence_score,
    line_value_score,
    role_stability,
    margin_adjustment,
    contextual_bonus,
    sport_specific_bonus,
    penalties,
    sport_specific_penalties,
    time_penalties,
    total_bonus,
    total_penalties,
    raw_composite_score,
    volatility_factor,
    composite_score,
    tier,
    applied_weights: finalWeights,
    scoring_version: "25-point-model-weighted-v1.0",
    scoring_timestamp: new Date().toISOString()
  };
}
