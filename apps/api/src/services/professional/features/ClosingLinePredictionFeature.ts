/**
 * Closing Line Prediction Feature
 *
 * ML-powered line closure forecasting using trend analysis and volume data.
 * Predicting closing line is critical for CLV (Closing Line Value) optimization.
 */

import { logger } from '../../../lib/logger';
import {
  ProfessionalFeature,
  ProfessionalContext,
  ProfessionalFeatureResult,
} from '../types';

/**
 * Closing line prediction data structure
 */
interface ClosingLinePredictionData {
  predictedLine: number;
  confidence: number;
  expectedEdge?: number;
  currentLine: number;
  trend: number;
  volumeFactor: number;
}

/**
 * Line history data point
 */
interface LineHistoryPoint {
  timestamp: number;
  line: number;
  volume?: number;
}

export class ClosingLinePredictionFeature
  implements ProfessionalFeature<ClosingLinePredictionData>
{
  readonly id = 'closing-line-prediction';
  readonly name = 'Closing Line Prediction';
  readonly defaultWeight = 0.020; // 2.0%

  /**
   * Check if feature can calculate with current context
   */
  canCalculate(context: ProfessionalContext): boolean {
    // Requires current line and hours to game
    return (
      context.features?.market?.line !== undefined && context.hoursToGame !== undefined
    );
  }

  /**
   * Predict closing line using trend analysis and volume data
   *
   * Methodology:
   * 1. Analyze recent line movement history (last 5 data points)
   * 2. Calculate linear trend (change per hour)
   * 3. Apply time decay factor (lines move more early, stabilize closer to game)
   * 4. Weight by volume (high volume suggests continued movement)
   * 5. Project final line at game time
   *
   * Key insights:
   * - Early line movements are stronger predictors
   * - High volume indicates sharp money and line continuation
   * - Lines stabilize in final hours before game
   *
   * @param context - Professional context
   * @returns Feature result with predicted closing line
   */
  async calculate(
    context: ProfessionalContext
  ): Promise<ProfessionalFeatureResult<ClosingLinePredictionData>> {
    const startTime = Date.now();

    try {
      const currentLine = context.features.market?.line || 0;
      const hoursToGame = context.hoursToGame;

      // Get line movement history from market data cache
      const lineHistoryMap = context.marketData?.lineMovementHistory;
      const lineHistory: LineHistoryPoint[] =
        (lineHistoryMap?.get(context.propId) as LineHistoryPoint[]) || [];

      // Base case: not enough historical data
      if (lineHistory.length < 2) {
        return {
          score: 0.5, // Neutral score without data
          data: {
            predictedLine: currentLine,
            confidence: 0.3, // Low confidence
            currentLine,
            trend: 0,
            volumeFactor: 1.0,
          },
          confidence: 0.3,
          metadata: {
            calculationTimeMs: Date.now() - startTime,
            dataPoints: lineHistory.length,
            hasSufficientData: false,
          },
        };
      }

      // Analyze recent movement (last 5 data points)
      const recentMovement = lineHistory.slice(-5);

      // Calculate trend (change per hour)
      const trend = this.calculateLineTrend(recentMovement);

      // Time decay factor - lines move more early, stabilize closer to game
      const timeFactor = Math.max(0.1, hoursToGame / 24);

      // Volume-weighted prediction
      const volumeData = recentMovement.map((h) => h.volume || 0);
      const avgVolume = volumeData.reduce((a, b) => a + b, 0) / volumeData.length;
      const currentVolume = volumeData[volumeData.length - 1] || avgVolume;
      const volumeFactor = avgVolume > 0 ? currentVolume / avgVolume : 1.0;

      // Calculate prediction adjustment
      let predictionAdjustment = 0;
      if (currentVolume > avgVolume * 1.5) {
        // High volume suggests continued movement in same direction
        predictionAdjustment = trend * 0.5;
      }

      // Predicted closing line
      const predictedLine = currentLine + predictionAdjustment * timeFactor;

      // Expected edge from getting in before predicted movement
      const expectedEdge = Math.abs(predictedLine - currentLine);

      // Confidence based on data quality
      const dataConfidence = Math.min(1.0, lineHistory.length / 10); // Max at 10+ points
      const volumeConfidence = volumeFactor > 1.2 ? 0.9 : 0.7; // Higher with volume
      const confidence = (dataConfidence + volumeConfidence) / 2;

      // Score based on expected edge (0-1 range)
      // Typical edge range: 0-2 points
      // Normalize to 0-1 with 2 points = max score
      const score = Math.min(1.0, expectedEdge / 2);

      const calculationTimeMs = Date.now() - startTime;

      logger.debug('Closing line prediction feature calculated', {
        propId: context.propId,
        canonicalGameId: context.canonicalGameId,
        currentLine,
        predictedLine,
        trend,
        timeFactor,
        volumeFactor,
        expectedEdge,
        confidence,
        score,
        calculationTimeMs,
      });

      return {
        score,
        data: {
          predictedLine,
          confidence,
          expectedEdge,
          currentLine,
          trend,
          volumeFactor,
        },
        confidence,
        metadata: {
          calculationTimeMs,
          dataPoints: lineHistory.length,
          recentDataPoints: recentMovement.length,
          hasSufficientData: true,
          timeFactor,
          avgVolume,
          currentVolume,
        },
      };
    } catch (error) {
      logger.error('Closing line prediction feature calculation failed', {
        propId: context.propId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return neutral score on error (graceful degradation)
      const currentLine = context.features.market?.line || 0;
      return {
        score: 0.5,
        data: {
          predictedLine: currentLine,
          confidence: 0,
          currentLine,
          trend: 0,
          volumeFactor: 1.0,
        },
        confidence: 0,
        metadata: {
          calculationTimeMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Calculate linear trend from line history
   *
   * Returns change per hour (positive = line moving up, negative = line moving down)
   */
  private calculateLineTrend(
    lineHistory: LineHistoryPoint[]
  ): number {
    if (lineHistory.length < 2) return 0;

    // Simple linear trend calculation
    const first = lineHistory[0];
    const last = lineHistory[lineHistory.length - 1];
    const timeSpan = last.timestamp - first.timestamp;
    const lineChange = last.line - first.line;

    // Return change per hour
    return timeSpan > 0 ? lineChange / (timeSpan / 3600000) : 0;
  }
}
