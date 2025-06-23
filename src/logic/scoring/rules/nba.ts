// src/logic/scoring/rules/nba.ts
// NBA-specific scoring rules and statistics

import { PropObject } from '../../../types/propTypes';
import { ScoreBreakdown } from '../unified-edge-score';

/**
 * NBA Core Statistics Scoring
 * Evaluates fundamental basketball metrics
 */
export function nbaCoreStats(prop: PropObject): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {};
  
  // Use existing prop scores
  if (prop.trend_score) {
    breakdown.trend_factor = prop.trend_score * 0.3;
  }
  
  if (prop.matchup_score) {
    breakdown.matchup_advantage = prop.matchup_score * 0.25;
  }
  
  if (prop.role_score) {
    breakdown.role_impact = prop.role_score * 0.2;
  }
  
  // NBA-specific adjustments based on market type
  if (prop.market_type.toLowerCase().includes('points')) {
    breakdown.scoring_prop_bonus = 0.1;
  } else if (prop.market_type.toLowerCase().includes('rebounds')) {
    breakdown.rebounding_prop_bonus = 0.08;
  } else if (prop.market_type.toLowerCase().includes('assists')) {
    breakdown.playmaking_prop_bonus = 0.12;
  }
  
  return breakdown;
}

/**
 * NBA Synergy Analytics
 * Advanced basketball analytics and situational factors
 */
export function nbaSynergy(prop: PropObject): ScoreBreakdown {
  const breakdown: ScoreBreakdown = {};
  
  // Use line value score as pace indicator
  if (prop.line_value_score) {
    breakdown.pace_factor = prop.line_value_score * 0.15;
  }
  
  // Rocket plays get home court advantage simulation
  if (prop.is_rocket) {
    breakdown.rocket_boost = 0.2;
  }
  
  // Ladder plays get consistency bonus
  if (prop.is_ladder) {
    breakdown.ladder_consistency = 0.15;
  }
  
  // Tag-based adjustments
  if (prop.tags && prop.tags.length > 0) {
    const hasInjuryTag = prop.tags.some(tag => 
      typeof tag === 'string' && tag.toLowerCase().includes('injury')
    );
    if (hasInjuryTag) {
      breakdown.injury_opportunity = 0.1;
    }
    
    const hasRestTag = prop.tags.some(tag => 
      typeof tag === 'string' && tag.toLowerCase().includes('rest')
    );
    if (hasRestTag) {
      breakdown.rest_advantage = 0.08;
    }
  }
  
  return breakdown;
}