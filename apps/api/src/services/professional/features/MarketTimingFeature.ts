/**
 * Market Timing Advantage Feature
 *
 * Models time-decay edge for optimal bet placement.
 * Early betting captures maximum value before market efficiency increases.
 */

import { logger } from '../../../lib/logger';
import {
  ProfessionalFeature,
  ProfessionalContext,
  ProfessionalFeatureResult,
} from '../types';

/**
 * Market timing advantage data structure
 */
interface MarketTimingData {
  timeDecayFactor: number;
  earlyEdge?: number;
  hoursToGame: number;
  timing: 'optimal' | 'good' | 'acceptable' | 'poor';
}

export class MarketTimingFeature implements ProfessionalFeature<MarketTimingData> {
  readonly id = 'market-timing';
  readonly name = 'Market Timing Advantage';
  readonly defaultWeight = 0.010; // 1.0%

  /**
   * Check if feature can calculate with current context
   */
  canCalculate(context: ProfessionalContext): boolean {
    // Requires hours to game for timing calculation
    return context.hoursToGame !== undefined;
  }

  /**
   * Calculate market timing advantage
   *
   * Professional timing strategy:
   * - >24 hours: Optimal time for value capture (market less efficient)
   * - 8-24 hours: Good timing (balanced efficiency)
   * - 2-8 hours: Acceptable timing (higher efficiency)
   * - <2 hours: Poor timing (unless breaking news justifies)
   *
   * Time decay model: Edge decreases as game approaches due to:
   * - Increased betting volume
   * - Sharp money entering market
   * - Information efficiency improving
   * - Line adjustments reflecting all public information
   *
   * @param context - Professional context
   * @returns Feature result with timing advantage analysis
   */
  async calculate(
    context: ProfessionalContext
  ): Promise<ProfessionalFeatureResult<MarketTimingData>> {
    const startTime = Date.now();

    try {
      const hoursToGame = context.hoursToGame;

      // Calculate time decay factor and timing classification
      let timeDecayFactor: number;
      let timing: 'optimal' | 'good' | 'acceptable' | 'poor';
      let earlyEdge: number | undefined;

      if (hoursToGame > 24) {
        // Optimal timing - maximum value before market becomes efficient
        timeDecayFactor = 0.9; // 90% edge preservation
        timing = 'optimal';
        earlyEdge = 0.05; // 5% additional edge from early positioning
      } else if (hoursToGame > 8) {
        // Good timing - still capturing value before peak efficiency
        timeDecayFactor = 0.6; // 60% edge preservation
        timing = 'good';
        earlyEdge = 0.02; // 2% additional edge
      } else if (hoursToGame > 2) {
        // Acceptable timing - market approaching efficiency
        timeDecayFactor = 0.3; // 30% edge preservation
        timing = 'acceptable';
        earlyEdge = 0.005; // 0.5% minimal edge
      } else {
        // Poor timing - market highly efficient
        // Only justified by breaking news or specific information edge
        timeDecayFactor = 0.1; // 10% edge preservation
        timing = 'poor';
        earlyEdge = undefined; // No early timing edge this late
      }

      const calculationTimeMs = Date.now() - startTime;

      logger.debug('Market timing feature calculated', {
        propId: context.propId,
        canonicalGameId: context.canonicalGameId,
        hoursToGame,
        timing,
        timeDecayFactor,
        earlyEdge,
        calculationTimeMs,
      });

      return {
        score: timeDecayFactor, // Already in 0-1 range
        data: {
          timeDecayFactor,
          earlyEdge,
          hoursToGame,
          timing,
        },
        confidence: 0.9, // High confidence in time-decay model
        metadata: {
          calculationTimeMs,
          optimalThreshold: 24,
          goodThreshold: 8,
          acceptableThreshold: 2,
        },
      };
    } catch (error) {
      logger.error('Market timing feature calculation failed', {
        propId: context.propId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return neutral score on error (graceful degradation)
      return {
        score: 0.5, // Neutral timing assumption
        data: {
          timeDecayFactor: 0.5,
          hoursToGame: context.hoursToGame,
          timing: 'acceptable',
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
