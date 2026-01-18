/**
 * Steam Detection Feature
 *
 * Real-time steam move detection with volume correlation.
 * Steam moves indicate sharp money entering the market, creating follow opportunities.
 * This is the most complex professional feature (2.5% weight).
 */

import { logger } from '../../../lib/logger';
import {
  ProfessionalFeature,
  ProfessionalContext,
  ProfessionalFeatureResult,
} from '../types';

/**
 * Steam analysis data structure
 */
interface SteamAnalysisData {
  hasSteam: boolean;
  steamDirection?: 'over' | 'under';
  lineMovement?: number;
  volumeSpike?: boolean;
  velocity?: 'rapid' | 'moderate' | 'slow';
  confidence: number;
}

/**
 * Line history data point
 */
interface LineHistoryPoint {
  timestamp: number;
  line: number;
  volume?: number;
}

export class SteamDetectionFeature implements ProfessionalFeature<SteamAnalysisData> {
  readonly id = 'steam-detection';
  readonly name = 'Steam Detection';
  readonly defaultWeight = 0.025; // 2.5%

  /**
   * Check if feature can calculate with current context
   */
  canCalculate(context: ProfessionalContext): boolean {
    // Requires line movement history
    const lineHistoryMap = context.marketData?.lineMovementHistory;
    const lineHistory = lineHistoryMap?.get(context.propId) || [];
    return lineHistory.length >= 3; // Need at least 3 data points
  }

  /**
   * Detect steam moves using multi-factor analysis
   *
   * Steam move criteria (all three create high confidence):
   * 1. **Significant line movement**: >1.5 points in short time (sharp money moving line)
   * 2. **Volume spike**: >150% of average volume (high betting activity)
   * 3. **Movement velocity**: <5 minutes between data points (rapid line changes)
   *
   * Confidence scoring:
   * - Significant movement: +0.5 confidence
   * - Volume spike: +0.3 confidence
   * - Fast velocity: +0.2 confidence
   * - Total ≥0.6 = steam move detected
   *
   * Why steam moves matter:
   * - Indicates sharp/syndicate money entering market
   * - Line will likely continue moving in same direction
   * - Following steam creates edge (riding sharp action)
   * - Must act quickly before line moves further
   *
   * @param context - Professional context
   * @returns Feature result with steam detection analysis
   */
  async calculate(
    context: ProfessionalContext
  ): Promise<ProfessionalFeatureResult<SteamAnalysisData>> {
    const startTime = Date.now();

    try {
      // Get line movement history
      const lineHistoryMap = context.marketData?.lineMovementHistory;
      const lineHistory: LineHistoryPoint[] =
        (lineHistoryMap?.get(context.propId) as LineHistoryPoint[]) || [];

      // Base case: insufficient data
      if (lineHistory.length < 3) {
        return {
          score: 0.0, // No steam without data
          data: {
            hasSteam: false,
            confidence: 0,
          },
          confidence: 0,
          metadata: {
            calculationTimeMs: Date.now() - startTime,
            dataPoints: lineHistory.length,
            sufficientData: false,
          },
        };
      }

      // Analyze recent 3 data points for steam signals
      const recent = lineHistory.slice(-3);

      // 1. Significant line movement check
      const firstLine = recent[0].line;
      const lastLine = recent[2].line;
      const lineMovement = Math.abs(lastLine - firstLine);
      const isSignificantMovement = lineMovement >= 1.5;

      // Determine direction of movement
      const steamDirection: 'over' | 'under' | undefined =
        lastLine > firstLine ? 'over' : lastLine < firstLine ? 'under' : undefined;

      // 2. Volume spike check
      let volumeSpike = false;
      const recentVolumes = recent.map((h) => h.volume || 0).filter((v) => v > 0);

      if (recentVolumes.length >= 2) {
        const currentVolume = recentVolumes[recentVolumes.length - 1];
        const avgVolume =
          recentVolumes.slice(0, -1).reduce((a, b) => a + b, 0) /
          (recentVolumes.length - 1);
        volumeSpike = currentVolume > avgVolume * 1.5; // 150% spike threshold
      }

      // 3. Movement velocity check
      const timeSpan = recent[2].timestamp - recent[0].timestamp;
      const isFastMovement = timeSpan < 300000; // Less than 5 minutes
      const isModerateMovement = timeSpan >= 300000 && timeSpan < 900000; // 5-15 minutes

      let velocity: 'rapid' | 'moderate' | 'slow';
      if (isFastMovement) {
        velocity = 'rapid';
      } else if (isModerateMovement) {
        velocity = 'moderate';
      } else {
        velocity = 'slow';
      }

      // Calculate confidence score
      const confidenceScore =
        (isSignificantMovement ? 0.5 : 0) +
        (volumeSpike ? 0.3 : 0) +
        (isFastMovement ? 0.2 : 0);

      const confidence = Math.min(confidenceScore, 1.0);

      // Steam detected if confidence ≥ 0.6
      const hasSteam = confidence >= 0.6;

      // Calculate feature score (0-1 range)
      // Steam moves create high edge, so score directly correlates with confidence
      const score = confidence;

      const calculationTimeMs = Date.now() - startTime;

      logger.debug('Steam detection feature calculated', {
        propId: context.propId,
        canonicalGameId: context.canonicalGameId,
        hasSteam,
        steamDirection,
        lineMovement,
        volumeSpike,
        velocity,
        confidence,
        score,
        timeSpanMs: timeSpan,
        calculationTimeMs,
      });

      return {
        score,
        data: {
          hasSteam,
          steamDirection: hasSteam ? steamDirection : undefined,
          lineMovement: hasSteam ? lineMovement : undefined,
          volumeSpike: hasSteam ? volumeSpike : undefined,
          velocity,
          confidence,
        },
        confidence,
        metadata: {
          calculationTimeMs,
          dataPoints: lineHistory.length,
          recentDataPoints: recent.length,
          sufficientData: true,
          timeSpanMs: timeSpan,
          movementThreshold: 1.5,
          volumeSpikeThreshold: 1.5,
          fastMovementThreshold: 300000,
          detectionThreshold: 0.6,
        },
      };
    } catch (error) {
      logger.error('Steam detection feature calculation failed', {
        propId: context.propId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return no steam on error (graceful degradation)
      return {
        score: 0.0,
        data: {
          hasSteam: false,
          confidence: 0,
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
