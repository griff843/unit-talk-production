// src/logic/zoneThreat.ts
// INTERNAL ONLY - Zone Threat Rating Module
// Business Objective: Advanced pitcher/hitter matchup metrics for HR/rocket prop edge scoring
// This module is NOT exposed to public or Discord messages

export type ZoneThreatLevel = 'CLEAN' | 'MODERATE' | 'EXTREME';

/**
 * Pitcher statistics for zone threat analysis
 * All thresholds are empirically derived and should be tuned based on results
 */
export interface PitcherStats {
  pitcherId: string;
  name: string;
  hrPer9: number;           // Home runs allowed per 9 IP (league avg ~1.3)
  barrelPercent: number;    // Barrel % allowed (0-100, league avg ~8%)
  meatballPercent: number;  // % of pitches in meatball zone (league avg ~5%)
  hittableCountPct: number; // % of pitches thrown in HR-prone counts (2-0, 3-1, etc.)
  recentHRs: number;        // HRs allowed in last 3 starts
  walkRate: number;         // BB/9 (league avg ~3.2, elite control <2.0)
}

/**
 * Matchup data for additional context in scoring decisions
 */
export interface MatchupData {
  batterBarrel: number;     // Batter's Barrel% (league avg ~8%)
  batterLaunch: number;     // Batter's Launch Angle in degrees (optimal HR range 15-30°)
  parkFactor: number;       // HR park factor, 1.00 = neutral (>1.04 = hitter friendly)
  windOut: boolean;         // Wind blowing out to CF (favorable for HRs)
}

/**
 * Configuration for Zone Threat Rating thresholds
 * These values should be tuned based on historical performance data
 */
export const ZONE_THREAT_CONFIG = {
  // HR Risk Thresholds (higher = worse for pitcher)
  hrPer9: {
    high: 1.8,      // 90th percentile worst
    extreme: 2.2    // 95th percentile worst
  },
  barrelPercent: {
    high: 10,       // 85th percentile worst
    extreme: 12     // 95th percentile worst
  },
  meatballPercent: {
    high: 7,        // 80th percentile worst
    extreme: 9      // 95th percentile worst
  },
  hittableCountPct: {
    high: 28,       // 75th percentile worst
    extreme: 32     // 90th percentile worst
  },
  recentHRs: {
    high: 4,        // 4+ HRs in last 3 starts
    extreme: 6      // 6+ HRs in last 3 starts
  },
  // Walk Rate Thresholds (lower = better control)
  walkRate: {
    poor: 4.0,      // Poor control threshold
    elite: 1.7      // Elite control threshold
  },
  // Scoring thresholds
  extremeThreshold: 5,    // Score >= 5 = EXTREME (bottom ~5% of pitchers)
  moderateThreshold: 3,   // Score >= 3 = MODERATE
  // Edge boost configuration
  edgeBoost: 2           // Points added to edge score for EXTREME + favorable conditions
};

/**
 * Analyzes pitcher statistics to determine zone threat level
 * 
 * Scoring Logic:
 * - Each negative metric adds 1 point
 * - Elite control subtracts 1 point
 * - EXTREME: 5+ points (bottom ~5% of league)
 * - MODERATE: 3-4 points
 * - CLEAN: 0-2 points
 * 
 * @param pitcher - Pitcher statistics
 * @returns Zone threat level classification
 */
export function zoneThreatRating(pitcher: PitcherStats): ZoneThreatLevel {
  let score = 0;
  const config = ZONE_THREAT_CONFIG;

  // HR Rate Analysis - Primary risk factor
  if (pitcher.hrPer9 >= config.hrPer9.extreme) {
    score += 2; // Double weight for extreme HR rate
  } else if (pitcher.hrPer9 >= config.hrPer9.high) {
    score += 1;
  }

  // Barrel Rate Analysis - Quality of contact allowed
  if (pitcher.barrelPercent >= config.barrelPercent.extreme) {
    score += 2;
  } else if (pitcher.barrelPercent >= config.barrelPercent.high) {
    score += 1;
  }

  // Location Control - Meatball percentage
  if (pitcher.meatballPercent >= config.meatballPercent.extreme) {
    score += 2;
  } else if (pitcher.meatballPercent >= config.meatballPercent.high) {
    score += 1;
  }

  // Count Management - Hittable count frequency
  if (pitcher.hittableCountPct >= config.hittableCountPct.extreme) {
    score += 1;
  } else if (pitcher.hittableCountPct >= config.hittableCountPct.high) {
    score += 1;
  }

  // Recent Form - HRs allowed in last 3 starts
  if (pitcher.recentHRs >= config.recentHRs.extreme) {
    score += 2;
  } else if (pitcher.recentHRs >= config.recentHRs.high) {
    score += 1;
  }

  // Walk Rate Analysis - Control factor (negative signal for poor control)
  if (pitcher.walkRate >= config.walkRate.poor) {
    score += 1; // Poor control increases risk
  } else if (pitcher.walkRate <= config.walkRate.elite) {
    score -= 1; // Elite control reduces risk
  }

  // Classification based on total score
  if (score >= config.extremeThreshold) {
    return 'EXTREME';
  } else if (score >= config.moderateThreshold) {
    return 'MODERATE';
  }
  
  return 'CLEAN';
}

/**
 * Determines if HR prop should receive internal edge boost
 * 
 * Boost Criteria (ALL must be true):
 * - Zone Threat = EXTREME
 * - Batter Barrel% >= 10% (above average power)
 * - Launch Angle in optimal HR range (16-28°)
 * - Favorable park/wind conditions
 * 
 * @param pitcher - Pitcher statistics
 * @param matchup - Matchup data including batter and conditions
 * @returns Whether to apply internal edge boost
 */
export function shouldBoostHRProp(
  pitcher: PitcherStats,
  matchup: MatchupData
): boolean {
  const ztr = zoneThreatRating(pitcher);
  
  // Only boost for EXTREME zone threat
  if (ztr !== 'EXTREME') {
    return false;
  }

  // Batter must have above-average power (Barrel%)
  const barrelOk = matchup.batterBarrel >= 10;
  
  // Launch angle must be in optimal HR range
  const launchAngleOk = matchup.batterLaunch >= 16 && matchup.batterLaunch <= 28;
  
  // Park/wind conditions must be favorable
  const parkOk = matchup.parkFactor >= 1.04 || matchup.windOut;

  return barrelOk && launchAngleOk && parkOk;
}

/**
 * Calculates internal edge boost for qualifying props
 * 
 * @param pitcher - Pitcher statistics
 * @param matchup - Matchup data
 * @returns Edge boost points (0 if no boost applies)
 */
export function calculateZoneThreatBoost(
  pitcher: PitcherStats,
  matchup: MatchupData
): number {
  return shouldBoostHRProp(pitcher, matchup) ? ZONE_THREAT_CONFIG.edgeBoost : 0;
}

/**
 * Generates internal markdown summary for logging/review
 * INTERNAL USE ONLY - Not for public consumption
 * 
 * @param pitcher - Pitcher statistics
 * @param matchup - Matchup data (optional)
 * @returns Markdown formatted analysis summary
 */
export function generateZoneThreatSummary(
  pitcher: PitcherStats,
  matchup?: MatchupData
): string {
  const ztr = zoneThreatRating(pitcher);
  const boost = matchup ? calculateZoneThreatBoost(pitcher, matchup) : 0;
  
  let summary = `## Zone Threat Analysis - ${pitcher.name}\n\n`;
  summary += `**Threat Level:** ${ztr}\n\n`;
  
  summary += `### Pitcher Metrics\n`;
  summary += `- HR/9: ${pitcher.hrPer9.toFixed(2)} (Threshold: ${ZONE_THREAT_CONFIG.hrPer9.high})\n`;
  summary += `- Barrel%: ${pitcher.barrelPercent.toFixed(1)}% (Threshold: ${ZONE_THREAT_CONFIG.barrelPercent.high}%)\n`;
  summary += `- Meatball%: ${pitcher.meatballPercent.toFixed(1)}% (Threshold: ${ZONE_THREAT_CONFIG.meatballPercent.high}%)\n`;
  summary += `- Hittable Count%: ${pitcher.hittableCountPct.toFixed(1)}% (Threshold: ${ZONE_THREAT_CONFIG.hittableCountPct.high}%)\n`;
  summary += `- Recent HRs (3 starts): ${pitcher.recentHRs} (Threshold: ${ZONE_THREAT_CONFIG.recentHRs.high})\n`;
  summary += `- BB/9: ${pitcher.walkRate.toFixed(2)} (Elite: <${ZONE_THREAT_CONFIG.walkRate.elite})\n\n`;
  
  if (matchup) {
    summary += `### Matchup Context\n`;
    summary += `- Batter Barrel%: ${matchup.batterBarrel.toFixed(1)}%\n`;
    summary += `- Launch Angle: ${matchup.batterLaunch.toFixed(1)}°\n`;
    summary += `- Park Factor: ${matchup.parkFactor.toFixed(2)}\n`;
    summary += `- Wind Out: ${matchup.windOut ? 'Yes' : 'No'}\n\n`;
    summary += `**Edge Boost Applied:** ${boost > 0 ? `+${boost} points` : 'None'}\n`;
  }
  
  return summary;
}

/**
 * Internal logging function for Zone Threat decisions
 * Use this to track boost applications for analysis
 * 
 * @param pitcher - Pitcher statistics
 * @param matchup - Matchup data
 * @param propId - Prop identifier for tracking
 */
export function logZoneThreatDecision(
  pitcher: PitcherStats,
  matchup: MatchupData,
  propId: string
): void {
  const ztr = zoneThreatRating(pitcher);
  const boost = calculateZoneThreatBoost(pitcher, matchup);
  
  if (boost > 0) {
    console.log(`[ZONE THREAT BOOST] Prop ${propId}: ${pitcher.name} flagged EXTREME, boost +${boost}`);
  }
  
  // Additional internal logging can be added here
  // e.g., send to monitoring service, write to internal logs, etc.
}

// Example usage for documentation:
/*
// In prop vetting/edge scoring pipeline:
const pitcher: PitcherStats = {
  pitcherId: 'pitcher_123',
  name: 'John Doe',
  hrPer9: 2.1,
  barrelPercent: 11.5,
  meatballPercent: 8.2,
  hittableCountPct: 30,
  recentHRs: 5,
  walkRate: 4.2
};

const matchup: MatchupData = {
  batterBarrel: 12.5,
  batterLaunch: 22.3,
  parkFactor: 1.08,
  windOut: true
};

const ztr = zoneThreatRating(pitcher);
const boost = calculateZoneThreatBoost(pitcher, matchup);

let edgeScore = baseScore;
if (boost > 0) {
  edgeScore += boost;
  logZoneThreatDecision(pitcher, matchup, propId);
}
*/