/**
 * Phase 4: Risk Checker
 * Evaluates risk factors for autopilot pick publishing decisions
 */

import type { PickData, RiskCheckResult, RiskFactor } from './types';

export class RiskChecker {
  /**
   * Evaluate all risk factors for a pick
   * Returns risk score (0-100) and list of risk factors
   *
   * Risk Scoring:
   * - 0-20: Low risk (safe to publish)
   * - 21-50: Medium risk (review recommended)
   * - 51-80: High risk (likely reject)
   * - 81-100: Critical risk (definite reject)
   */
  async checkRisk(pick: PickData): Promise<RiskCheckResult> {
    const riskFactors: RiskFactor[] = [];
    let riskScore = 0;

    // Check 1: Missing critical fields
    if (!pick.player_name || !pick.stat_type || pick.line === undefined) {
      riskFactors.push({
        factor: 'missing_data',
        severity: 'critical',
        message: 'Missing critical pick fields (player_name, stat_type, or line)',
        value: 100,
      });
      riskScore += 100;
    }

    // Check 2: Odds validation
    if (pick.over_odds !== undefined && pick.under_odds !== undefined) {
      // Check if odds are reasonable (American odds typically -200 to +200)
      if (Math.abs(pick.over_odds) > 500 || Math.abs(pick.under_odds) > 500) {
        riskFactors.push({
          factor: 'extreme_odds',
          severity: 'high',
          message: `Extreme odds detected: over=${pick.over_odds}, under=${pick.under_odds}`,
          value: 50,
        });
        riskScore += 50;
      }

      // Check for missing odds
      if (pick.over_odds === 0 || pick.under_odds === 0) {
        riskFactors.push({
          factor: 'zero_odds',
          severity: 'critical',
          message: 'Zero odds detected (data may be corrupted)',
          value: 80,
        });
        riskScore += 80;
      }
    } else {
      riskFactors.push({
        factor: 'missing_odds',
        severity: 'high',
        message: 'Missing odds data',
        value: 60,
      });
      riskScore += 60;
    }

    // Check 3: Confidence level (if available)
    if (pick.confidence !== undefined) {
      if (pick.confidence < 0.5) {
        riskFactors.push({
          factor: 'low_confidence',
          severity: 'medium',
          message: `Low confidence score: ${pick.confidence}`,
          value: 30,
        });
        riskScore += 30;
      }
    }

    // Check 4: Line value sanity
    if (pick.line !== undefined) {
      // Check for extreme lines (vary by sport/stat type)
      const lineValue = Math.abs(pick.line);
      if (lineValue > 1000) {
        riskFactors.push({
          factor: 'extreme_line',
          severity: 'high',
          message: `Extreme line value: ${pick.line}`,
          value: 40,
        });
        riskScore += 40;
      }

      if (lineValue < 0.1 && pick.stat_type !== 'boolean') {
        riskFactors.push({
          factor: 'suspicious_line',
          severity: 'medium',
          message: `Unusually low line value: ${pick.line}`,
          value: 25,
        });
        riskScore += 25;
      }
    }

    // Check 5: Sport validation
    const validSports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF'];
    if (pick.sport && !validSports.includes(pick.sport.toUpperCase())) {
      riskFactors.push({
        factor: 'invalid_sport',
        severity: 'medium',
        message: `Unrecognized sport: ${pick.sport}`,
        value: 20,
      });
      riskScore += 20;
    }

    // Cap risk score at 100
    riskScore = Math.min(riskScore, 100);

    // Decision: pass if risk score < 50 (medium risk threshold)
    const passed = riskScore < 50;

    return {
      passed,
      risk_score: riskScore,
      risk_factors: riskFactors,
    };
  }

  /**
   * Get risk threshold for autopilot mode
   */
  getRiskThreshold(mode: 'log_only' | 'canary' | 'prod'): number {
    switch (mode) {
      case 'log_only':
        return 50; // More lenient in log_only for testing
      case 'canary':
        return 30; // Stricter in canary
      case 'prod':
        return 20; // Very strict in production
      default:
        return 50;
    }
  }
}

export const riskChecker = new RiskChecker();
