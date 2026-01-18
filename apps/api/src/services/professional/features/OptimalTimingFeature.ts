/**
 * Optimal Timing Feature
 *
 * Determines optimal bet placement timing based on hours to game and breaking news.
 * Provides strategic guidance on when to place bets for maximum edge.
 */

import { logger } from '../../../lib/logger';
import {
  ProfessionalFeature,
  ProfessionalContext,
  ProfessionalFeatureResult,
} from '../types';

/**
 * Optimal betting time data structure
 */
interface OptimalTimingData {
  hoursToGame: number;
  isOptimal: boolean;
  timeEdge?: number;
  recommendation: 'immediate' | 'monitor' | 'final_check' | 'avoid';
  hasBreakingNews: boolean;
}

export class OptimalTimingFeature implements ProfessionalFeature<OptimalTimingData> {
  readonly id = 'optimal-timing';
  readonly name = 'Optimal Timing';
  readonly defaultWeight = 0.015; // 1.5%

  /**
   * Check if feature can calculate with current context
   */
  canCalculate(context: ProfessionalContext): boolean {
    // Requires hours to game and injury/weather impact data
    return (
      context.hoursToGame !== undefined &&
      context.features?.injuryImpact !== undefined &&
      context.features?.weatherImpact !== undefined
    );
  }

  /**
   * Calculate optimal betting time
   *
   * Professional timing strategy:
   * 1. IMMEDIATE: Breaking news + <4 hours (act fast) OR >24 hours (early value)
   * 2. MONITOR: 8-24 hours (watch for late information)
   * 3. FINAL_CHECK: 2-8 hours (last chance for value)
   * 4. AVOID: <2 hours without breaking news (lines too efficient)
   *
   * Breaking news threshold:
   * - Injury impact > 5 (major injury)
   * - Weather impact > 3 (significant weather)
   *
   * @param context - Professional context
   * @returns Feature result with timing recommendation
   */
  async calculate(
    context: ProfessionalContext
  ): Promise<ProfessionalFeatureResult<OptimalTimingData>> {
    const startTime = Date.now();

    try {
      const hoursToGame = context.hoursToGame;
      const injuryImpact = context.features.injuryImpact || 0;
      const weatherImpact = context.features.weatherImpact || 0;

      // Determine if breaking news exists
      const hasBreakingNews = injuryImpact > 5 || weatherImpact > 3;

      // Calculate recommendation and score
      let recommendation: 'immediate' | 'monitor' | 'final_check' | 'avoid';
      let score: number; // 0-1 range for feature scoring
      let timeEdge: number | undefined;
      let isOptimal: boolean;

      if (hasBreakingNews && hoursToGame < 4) {
        // Act on breaking news quickly
        recommendation = 'immediate';
        score = 1.0; // Maximum score - strong timing edge
        timeEdge = 0.08; // 8% edge from acting on breaking news
        isOptimal = true;
      } else if (hoursToGame > 24) {
        // Lock in early value before market correction
        recommendation = 'immediate';
        score = 0.9; // High score - early value capture
        timeEdge = 0.05; // 5% edge from early positioning
        isOptimal = true;
      } else if (hoursToGame > 8) {
        // Watch for late information
        recommendation = 'monitor';
        score = 0.6; // Moderate score - monitor period
        timeEdge = 0.02; // 2% edge if positioned correctly
        isOptimal = false;
      } else if (hoursToGame > 2) {
        // Last chance for value
        recommendation = 'final_check';
        score = 0.4; // Lower score - final window
        timeEdge = 0.01; // 1% minimal edge
        isOptimal = false;
      } else {
        // Too close to game, avoid unless breaking news
        recommendation = 'avoid';
        score = 0.1; // Low score - poor timing
        timeEdge = undefined; // No edge this late
        isOptimal = false;
      }

      const calculationTimeMs = Date.now() - startTime;

      logger.debug('Optimal timing feature calculated', {
        propId: context.propId,
        canonicalGameId: context.canonicalGameId,
        hoursToGame,
        hasBreakingNews,
        injuryImpact,
        weatherImpact,
        recommendation,
        isOptimal,
        timeEdge,
        score,
        calculationTimeMs,
      });

      return {
        score,
        data: {
          hoursToGame,
          isOptimal,
          timeEdge,
          recommendation,
          hasBreakingNews,
        },
        confidence: 0.85, // High confidence in timing model
        metadata: {
          calculationTimeMs,
          injuryThreshold: 5,
          weatherThreshold: 3,
          earlyThreshold: 24,
          monitorThreshold: 8,
          finalCheckThreshold: 2,
        },
      };
    } catch (error) {
      logger.error('Optimal timing feature calculation failed', {
        propId: context.propId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return neutral score on error (graceful degradation)
      return {
        score: 0.5, // Neutral timing assumption
        data: {
          hoursToGame: context.hoursToGame,
          isOptimal: false,
          recommendation: 'monitor',
          hasBreakingNews: false,
        },
        confidence: 0,
        metadata: {
          calculationTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}
