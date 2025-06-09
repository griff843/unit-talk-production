/**
 * Contextual Bonus Calculator for the 25-Point Model
 * 
 * This module calculates bonus points for correct predictions made in challenging scenarios
 * such as road underdogs, adverse weather conditions, player injuries, or other
 * special circumstances that increase the difficulty of making accurate predictions.
 */

import { PropType } from '../../types/pickTypes';

interface ContextualBonusOptions {
  /**
   * Maximum possible bonus points
   */
  maxBonus?: number;
  
  /**
   * Bonus for correct road underdog predictions
   */
  roadUnderdogBonus?: number;
  
  /**
   * Bonus for correct predictions in adverse weather
   */
  adverseWeatherBonus?: number;
  
  /**
   * Bonus for correct predictions with key player injuries
   */
  keyInjuryBonus?: number;
  
  /**
   * Bonus for correct predictions in high-leverage situations
   */
  highLeverageBonus?: number;
  
  /**
   * Bonus for correct predictions against strong historical trends
   */
  counterTrendBonus?: number;
}

const DEFAULT_OPTIONS: ContextualBonusOptions = {
  maxBonus: 5.0,
  roadUnderdogBonus: 2.0,
  adverseWeatherBonus: 1.5,
  keyInjuryBonus: 2.0,
  highLeverageBonus: 2.5,
  counterTrendBonus: 1.5
};

/**
 * Calculate contextual bonus points for correct predictions in challenging scenarios
 * 
 * @param prop The prop object containing prediction and contextual data
 * @param options Optional configuration parameters
 * @returns A bonus score between 0 and maxBonus
 */
export function calculateContextualBonus(
  prop: any,
  options: ContextualBonusOptions = DEFAULT_OPTIONS
): number {
  const { 
    maxBonus = 5.0,
    roadUnderdogBonus = 2.0,
    adverseWeatherBonus = 1.5,
    keyInjuryBonus = 2.0,
    highLeverageBonus = 2.5,
    counterTrendBonus = 1.5
  } = options;
  
  // Only apply bonuses to correct predictions
  if (!prop || !prop.is_win) {
    return 0;
  }

  try {
    let totalBonus = 0;
    
    // Check for road underdog scenario
    if (isRoadUnderdog(prop)) {
      totalBonus += roadUnderdogBonus;
    }
    
    // Check for adverse weather conditions
    if (hasAdverseWeather(prop)) {
      totalBonus += adverseWeatherBonus;
    }
    
    // Check for key player injuries
    if (hasKeyPlayerInjuries(prop)) {
      totalBonus += keyInjuryBonus;
    }
    
    // Check for high-leverage situation
    if (isHighLeverageSituation(prop)) {
      totalBonus += highLeverageBonus;
    }
    
    // Check for prediction against strong historical trend
    if (isCounterTrendPrediction(prop)) {
      totalBonus += counterTrendBonus;
    }
    
    // Cap the total bonus at the maximum allowed
    return Math.min(totalBonus, maxBonus);
  } catch (error) {
    console.error('Error calculating contextual bonus:', error);
    return 0;
  }
}

/**
 * Determine if the prediction was for a road underdog
 */
function isRoadUnderdog(prop: any): boolean {
  // Check if the team was playing away
  const isRoadTeam = prop.is_home === false || 
                     prop.venue_type === 'AWAY' || 
                     prop.context?.venue_type === 'AWAY';
                     
  // Check if the team was an underdog (positive spread or underdog moneyline)
  const isUnderdog = (prop.prop_type === 'SPREAD' && parseFloat(prop.line_value) > 0) ||
                     (prop.prop_type === 'MONEYLINE' && parseFloat(prop.odds) > 100) ||
                     prop.context?.is_underdog === true;
                     
  return isRoadTeam && isUnderdog;
}

/**
 * Determine if the game had adverse weather conditions
 */
function hasAdverseWeather(prop: any): boolean {
  // Check for weather data in the context
  const weatherContext = prop.context?.weather || {};
  
  // Check for extreme weather conditions
  const hasExtremeTemp = weatherContext.temperature_fahrenheit < 32 || 
                         weatherContext.temperature_fahrenheit > 95;
                         
  const hasHighWind = weatherContext.wind_speed_mph > 20;
  
  const hasPrecipitation = weatherContext.precipitation_type === 'RAIN' || 
                           weatherContext.precipitation_type === 'SNOW';
                           
  const hasExtremeWeather = weatherContext.extreme_weather === true;
  
  return hasExtremeTemp || hasHighWind || hasPrecipitation || hasExtremeWeather;
}

/**
 * Determine if there were key player injuries affecting the game
 */
function hasKeyPlayerInjuries(prop: any): boolean {
  // Check for injury data in the context
  const injuryContext = prop.context?.injuries || {};
  
  // Check if key players were injured
  const hasKeyInjuries = injuryContext.has_key_injuries === true;
  
  // Check if star players were out
  const hasStarPlayerOut = injuryContext.star_player_out === true;
  
  // Check if there were multiple starters out
  const hasMultipleStartersOut = 
    Array.isArray(injuryContext.injured_starters) && 
    injuryContext.injured_starters.length > 1;
    
  // Check if quarterback was injured (football specific)
  const hasQBInjury = injuryContext.quarterback_injured === true;
  
  return hasKeyInjuries || hasStarPlayerOut || hasMultipleStartersOut || hasQBInjury;
}

/**
 * Determine if this was a high-leverage situation
 */
function isHighLeverageSituation(prop: any): boolean {
  // Check for high-leverage indicators in the context
  const gameContext = prop.context?.game || {};
  
  // Check if it was a playoff/tournament game
  const isPlayoffGame = gameContext.is_playoff === true || 
                        gameContext.is_tournament === true ||
                        gameContext.is_elimination === true;
                        
  // Check if it was a rivalry game
  const isRivalryGame = gameContext.is_rivalry === true;
  
  // Check if it was a nationally televised game
  const isNationallyTelevised = gameContext.is_nationally_televised === true;
  
  // Check if it was a close game (decided by small margin)
  const isCloseGame = gameContext.final_score_differential <= 3;
  
  // Check if it was a late-game situation
  const isLateGameSituation = gameContext.is_late_game === true || 
                              gameContext.is_clutch_time === true;
                              
  return isPlayoffGame || isRivalryGame || isNationallyTelevised || 
         isCloseGame || isLateGameSituation;
}

/**
 * Determine if the prediction went against a strong historical trend
 */
function isCounterTrendPrediction(prop: any): boolean {
  // Check for trend data in the context
  const trendContext = prop.context?.trends || {};
  
  // Check if prediction went against a strong team trend
  const againstTeamTrend = trendContext.against_team_trend === true;
  
  // Check if prediction went against a strong head-to-head trend
  const againstH2HTrend = trendContext.against_h2h_trend === true;
  
  // Check if prediction went against a strong situational trend
  const againstSituationalTrend = trendContext.against_situational_trend === true;
  
  // Check if prediction went against public consensus
  const againstPublicConsensus = 
    trendContext.public_consensus_percentage && 
    trendContext.public_consensus_percentage >= 70 && 
    trendContext.against_public_consensus === true;
    
  return againstTeamTrend || againstH2HTrend || 
         againstSituationalTrend || againstPublicConsensus;
}

/**
 * Calculate sport-specific contextual bonuses
 */
export function calculateSportSpecificBonus(prop: any): number {
  const sport = prop.sport || prop.league;
  let sportBonus = 0;
  
  switch (sport?.toUpperCase()) {
    case 'NFL':
      sportBonus = calculateNFLContextualBonus(prop);
      break;
      
    case 'NBA':
      sportBonus = calculateNBAContextualBonus(prop);
      break;
      
    case 'MLB':
      sportBonus = calculateMLBContextualBonus(prop);
      break;
      
    case 'NHL':
      sportBonus = calculateNHLContextualBonus(prop);
      break;
      
    default:
      sportBonus = 0;
  }
  
  return sportBonus;
}

/**
 * NFL-specific contextual bonuses
 */
function calculateNFLContextualBonus(prop: any): number {
  const context = prop.context || {};
  let bonus = 0;
  
  // Division game bonus
  if (context.is_division_game) {
    bonus += 0.5;
  }
  
  // Short week (Thursday game) bonus
  if (context.is_short_week) {
    bonus += 0.75;
  }
  
  // West coast team playing early east coast game
  if (context.is_west_coast_team_early_east_game) {
    bonus += 1.0;
  }
  
  // Extreme weather impact on game total
  if (prop.prop_type === 'OVER_UNDER' && hasAdverseWeather(prop)) {
    bonus += 1.0;
  }
  
  return bonus;
}

/**
 * NBA-specific contextual bonuses
 */
function calculateNBAContextualBonus(prop: any): number {
  const context = prop.context || {};
  let bonus = 0;
  
  // Back-to-back game
  if (context.is_back_to_back) {
    bonus += 0.75;
  }
  
  // Third game in four nights
  if (context.is_third_in_four_nights) {
    bonus += 1.0;
  }
  
  // End of long road trip
  if (context.is_end_of_road_trip && context.road_trip_length >= 4) {
    bonus += 0.5;
  }
  
  // Player on minutes restriction
  if (prop.prop_type === 'PROP_BET' && context.player?.is_minutes_restricted) {
    bonus += 1.5;
  }
  
  return bonus;
}

/**
 * MLB-specific contextual bonuses
 */
function calculateMLBContextualBonus(prop: any): number {
  const context = prop.context || {};
  let bonus = 0;
  
  // Day game after night game
  if (context.is_day_game_after_night_game) {
    bonus += 0.5;
  }
  
  // Bullpen heavily used in previous games
  if (context.is_bullpen_depleted) {
    bonus += 0.75;
  }
  
  // Extreme pitcher-friendly or hitter-friendly park
  if (context.park_factor && (context.park_factor < 0.8 || context.park_factor > 1.2)) {
    bonus += 0.5;
  }
  
  // Getaway day game
  if (context.is_getaway_day) {
    bonus += 0.5;
  }
  
  return bonus;
}

/**
 * NHL-specific contextual bonuses
 */
function calculateNHLContextualBonus(prop: any): number {
  const context = prop.context || {};
  let bonus = 0;
  
  // Back-to-back game
  if (context.is_back_to_back) {
    bonus += 0.75;
  }
  
  // Backup goalie starting
  if (context.is_backup_goalie_starting) {
    bonus += 1.0;
  }
  
  // First game back from long road trip
  if (context.is_first_game_after_road_trip && context.road_trip_length >= 4) {
    bonus += 0.5;
  }
  
  // Late-season game with playoff implications
  if (context.is_late_season && context.has_playoff_implications) {
    bonus += 0.75;
  }
  
  return bonus;
}
