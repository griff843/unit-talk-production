// src/logic/scoring/rules/mlb.ts
// MLB-specific scoring rules and statistics

import { PropObject } from '../../../types/propTypes';
import { ScoreBreakdown } from '../unified-edge-score';

/**
 * MLB Core Statistics Scoring
 * Evaluates fundamental baseball metrics
 */
export function mlbCoreStats(prop: PropObject): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {};
  
  // Use existing prop scores
  if (prop['trend_score']) {
    breakdown['trend_factor'] = prop['trend_score'] * 0.35;
  }
  
  if (prop['matchup_score']) {
    breakdown['matchup_advantage'] = prop['matchup_score'] * 0.3;
  }
  
  if (prop['role_score']) {
    breakdown['role_impact'] = prop['role_score'] * 0.25;
  }
  
  // MLB-specific adjustments based on market type
  if (prop['market_type'].toLowerCase().includes('hit')) {
    breakdown['batting_prop_bonus'] = 0.12;
  } else if (prop['market_type'].toLowerCase().includes('strikeout')) {
    breakdown['pitching_prop_bonus'] = 0.15;
  } else if (prop['market_type'].toLowerCase().includes('run')) {
    breakdown['scoring_prop_bonus'] = 0.1;
  }
  
  return breakdown;
}

/**
 * MLB Synergy Analytics
 * Advanced baseball analytics and situational factors
 */
export function mlbSynergy(prop: PropObject): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {};
  
  // Use line value score as weather/park factor
  if (prop['line_value_score']) {
    breakdown['environmental_factor'] = prop['line_value_score'] * 0.2;
  }
  
  // Rocket plays get weather advantage simulation
  if (prop['is_rocket']) {
    breakdown['rocket_boost'] = 0.18;
  }
  
  // Ladder plays get consistency bonus
  if (prop['is_ladder']) {
    breakdown['ladder_consistency'] = 0.12;
  }
  
  // Tag-based adjustments
  if (prop['tags'] && prop['tags'].length > 0) {
    const hasWeatherTag = prop['tags'].some(tag => 
      typeof tag === 'string' && tag.toLowerCase().includes('weather')
    );
    if (hasWeatherTag) {
      breakdown['weather_advantage'] = 0.08;
    }
    
    const hasParkTag = prop['tags'].some(tag => 
      typeof tag === 'string' && tag.toLowerCase().includes('park')
    );
    if (hasParkTag) {
      breakdown['park_factor'] = 0.06;
    }
  }
  
  return breakdown;
}