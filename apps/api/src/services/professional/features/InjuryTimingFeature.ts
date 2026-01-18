/**
 * Injury Timing Edge Feature
 *
 * Analyzes value creation from injury news breaking before lines adjust.
 * Early injury detection provides significant edge before market efficiency.
 */

import { logger } from '../../../lib/logger';
import {
  ProfessionalFeature,
  ProfessionalContext,
  ProfessionalFeatureResult,
} from '../types';

/**
 * Injury timing advantage data structure
 */
interface InjuryTimingData {
  recentInjuries: boolean;
  timingEdge?: number;
  hoursToGame: number;
  injuryImpact: number;
  timing: 'early' | 'moderate' | 'late' | 'none';
}

export class InjuryTimingFeature implements ProfessionalFeature<InjuryTimingData> {
  readonly id = 'injury-timing';
  readonly name = 'Injury Timing Edge';
  readonly defaultWeight = 0.010; // 1.0%

  /**
   * Check if feature can calculate with current context
   */
  canCalculate(context: ProfessionalContext): boolean {
    // Requires injury impact data from grading features
    return context.features?.injuryImpact !== undefined && context.hoursToGame !== undefined;
  }

  /**
   * Calculate injury timing advantage
   *
   * Key insight: Recent injury news creates value before lines fully adjust.
   * The earlier you bet relative to injury news, the larger the edge.
   *
   * Timeline thresholds:
   * - >12 hours to game: Early injury news advantage (lines haven't adjusted)
   * - 4-12 hours: Moderate advantage (partial adjustment)
   * - <4 hours: Late (lines likely fully adjusted)
   *
   * @param context - Professional context
   * @returns Feature result with injury timing analysis
   */
  async calculate(
    context: ProfessionalContext
  ): Promise<ProfessionalFeatureResult<InjuryTimingData>> {
    const startTime = Date.now();

    try {
      const injuryImpact = context.features.injuryImpact || 0;
      const hoursToGame = context.hoursToGame;

      // Threshold for "recent injury news"
      const hasRecentInjuryNews = injuryImpact > 3;

      // Base case: no recent injury news
      if (!hasRecentInjuryNews) {
        return {
          score: 0.2, // Base score (2/10 normalized)
          data: {
            recentInjuries: false,
            hoursToGame,
            injuryImpact,
            timing: 'none',
          },
          confidence: 0.8, // High confidence in absence of injuries
          metadata: {
            calculationTimeMs: Date.now() - startTime,
          },
        };
      }

      // Calculate timing advantage based on hours to game
      let rawScore: number;
      let timing: 'early' | 'moderate' | 'late';
      let timingEdge: number;

      if (hoursToGame > 12) {
        // Early injury news advantage - lines haven't fully adjusted
        rawScore = 8;
        timing = 'early';
        timingEdge = 0.6; // 60% edge preservation
      } else if (hoursToGame > 4) {
        // Moderate advantage - partial line adjustment
        rawScore = 6;
        timing = 'moderate';
        timingEdge = 0.4; // 40% edge preservation
      } else {
        // Late - lines likely fully adjusted
        rawScore = 3;
        timing = 'late';
        timingEdge = 0.1; // 10% edge preservation
      }

      const normalizedScore = rawScore / 10;

      const calculationTimeMs = Date.now() - startTime;

      logger.debug('Injury timing feature calculated', {
        propId: context.propId,
        canonicalPlayerId: context.canonicalPlayerId,
        hasRecentInjuryNews,
        hoursToGame,
        injuryImpact,
        timing,
        timingEdge,
        score: normalizedScore,
        calculationTimeMs,
      });

      return {
        score: normalizedScore,
        data: {
          recentInjuries: true,
          timingEdge,
          hoursToGame,
          injuryImpact,
          timing,
        },
        confidence: 0.85, // High confidence in injury timing model
        metadata: {
          calculationTimeMs,
          injuryThreshold: 3,
          earlyThreshold: 12,
          moderateThreshold: 4,
        },
      };
    } catch (error) {
      logger.error('Injury timing feature calculation failed', {
        propId: context.propId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return base score on error (graceful degradation)
      return {
        score: 0.2,
        data: {
          recentInjuries: false,
          hoursToGame: context.hoursToGame,
          injuryImpact: 0,
          timing: 'none',
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
