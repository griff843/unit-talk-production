// src/logic/scoring/rules/nhl.ts
// NHL-specific scoring rules and statistics

import { PropObject } from '../../../types/propTypes';
import { ScoreBreakdown } from '../unified-edge-score';

/**
 * NHL Core Statistics Scoring
 * Evaluates fundamental hockey metrics
 */
export function nhlCoreStats(prop: PropObject): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {};
  
  // Use existing prop scores
  if (prop['trend_score']) {
    breakdown['trend_factor'] = prop['trend_score'] * 0.32;
  }
  
  if (prop['matchup_score']) {
    breakdown['matchup_advantage'] = prop['matchup_score'] * 0.28;
  }
  
  if (prop['role_score']) {
    breakdown['role_impact'] = prop['role_score'] * 0.22;
  }
  
  // NHL-specific adjustments based on market type
  if (prop['market_type'].toLowerCase().includes('goal')) {
    breakdown['scoring_prop_bonus'] = 0.14;
  } else if (prop['market_type'].toLowerCase().includes('assist')) {
    breakdown['playmaking_prop_bonus'] = 0.12;
  } else if (prop['market_type'].toLowerCase().includes('save')) {
    breakdown['goalie_prop_bonus'] = 0.16;
  }
  
  return breakdown;
}

/**
 * NHL Synergy Analytics
 * Advanced hockey analytics and situational factors
 */
export function nhlSynergy(prop: PropObject): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {};
  
  // Use line value score as pace/special teams factor
  if (prop['line_value_score']) {
    breakdown['game_flow_factor'] = prop['line_value_score'] * 0.18;
  }
  
  // Rocket plays get special teams advantage
  if (prop['is_rocket']) {
    breakdown['rocket_boost'] = 0.16;
  }
  
  // Ladder plays get consistency bonus
  if (prop['is_ladder']) {
    breakdown['ladder_consistency'] = 0.13;
  }
  
  // Tag-based adjustments
  if (prop['tags'] && prop['tags'].length > 0) {
    const hasRestTag = prop['tags'].some(tag => 
      typeof tag === 'string' && tag.toLowerCase().includes('rest')
    );
    if (hasRestTag) {
      breakdown['fatigue_factor'] = -0.1; // Negative for tired teams
    }
    
    const hasHomeTag = prop['tags'].some(tag => 
      typeof tag === 'string' && tag.toLowerCase().includes('home')
    );
    if (hasHomeTag) {
      breakdown['home_ice_advantage'] = 0.09;
    }
  }
  
  return breakdown;
}