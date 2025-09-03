// src/logic/zoneThreat.ts
// INTERNAL ONLY - Zone Threat Rating Module
// Business Objective: Advanced pitcher/hitter matchup metrics for HR/rocket prop edge scoring
// This module is NOT exposed to public or Discord messages

export type ZoneThreatLevel = 'low' | 'medium' | 'high';

export interface ZoneThreatConfig {
  thresholds: {
    low: number;
    medium: number;
    high: number;
  };
  weights: {
    [key: string]: number;
  };
}

export interface ZoneThreatResult {
  level: ZoneThreatLevel;
  score: number;
  factors: {
    [key: string]: number;
  };
}

export function calculateZoneThreat(data: any, config: ZoneThreatConfig): ZoneThreatResult {
  // Calculate weighted score
  let score = 0;
  const factors: { [key: string]: number } = {};

  for (const [key, weight] of Object.entries(config.weights)) {
    const value = data[key] || 0;
    const factor = value * weight;
    factors[key] = factor;
    score += factor;
  }

  // Determine threat level
  let level: ZoneThreatLevel;
  if (score >= config.thresholds.high) {
    level = 'high';
  } else if (score >= config.thresholds.medium) {
    level = 'medium';
  } else {
    level = 'low';
  }

  return {
    level,
    score,
    factors
  };
}

// Additional exports required by edgeScoring.ts
export const zoneThreatRating = calculateZoneThreat;

export function calculateZoneThreatBoost(threatResult: ZoneThreatResult): number {
  // Convert threat level to a boost multiplier
  switch (threatResult.level) {
    case 'high':
      return 1.5;
    case 'medium':
      return 1.2;
    case 'low':
      return 1.0;
    default:
      return 1.0;
  }
}

export function logZoneThreatDecision(decision: any): void {
  // Log zone threat decision for debugging/analytics
  console.log('[Zone Threat Decision]', decision);
}

// Type definitions for pitcher and matchup data
export interface PitcherStats {
  era: number;
  whip: number;
  k9: number;
  bb9: number;
  hr9: number;
  gb_rate?: number;
  fb_rate?: number;
  ld_rate?: number;
  hard_contact_rate?: number;
  barrel_rate?: number;
}

export interface MatchupData {
  pitcher: PitcherStats;
  batter_vs_pitcher?: {
    avg: number;
    ops: number;
    hr_rate: number;
    k_rate: number;
  };
  park_factor?: number;
  weather?: {
    wind_speed: number;
    wind_direction: string;
    temperature: number;
  };
}