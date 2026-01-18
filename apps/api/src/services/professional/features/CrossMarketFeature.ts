/**
 * Cross Market Discrepancy Feature
 *
 * Detects arbitrage opportunities between related props (e.g., player points vs team total).
 * This is the simplest professional feature (0.5% weight).
 */

import { logger } from '../../../lib/logger';
import {
  ProfessionalFeature,
  ProfessionalContext,
  ProfessionalFeatureResult,
} from '../types';

/**
 * Cross market discrepancy data structure
 */
interface CrossMarketData {
  hasArbitrage: boolean;
  relatedProps?: Array<{
    propId: string;
    correlation: number;
    discrepancy: number;
  }>;
  arbitrageEdge?: number;
  maxDiscrepancy: number;
}

export class CrossMarketFeature implements ProfessionalFeature<CrossMarketData> {
  readonly id = 'cross-market';
  readonly name = 'Cross Market Discrepancy';
  readonly defaultWeight = 0.005; // 0.5%

  /**
   * Check if feature can calculate with current context
   */
  canCalculate(context: ProfessionalContext): boolean {
    // Can always calculate, but may return base score if no related props
    return true;
  }

  /**
   * Calculate cross-market arbitrage opportunities
   *
   * Looks for discrepancies in highly correlated markets:
   * - Player points vs team total
   * - Rebounds vs double-double props
   * - Assists vs total assists props
   *
   * @param context - Professional context
   * @returns Feature result with arbitrage analysis
   */
  async calculate(
    context: ProfessionalContext
  ): Promise<ProfessionalFeatureResult<CrossMarketData>> {
    const startTime = Date.now();

    try {
      // Get related props from market data cache
      const relatedPropsMap = context.marketData?.relatedProps;
      const relatedProps = relatedPropsMap?.get(context.propId) || [];

      // Base case: no related props available
      if (relatedProps.length === 0) {
        return {
          score: 0.2, // Base score normalized to 0-1 range (2/10 from original)
          data: {
            hasArbitrage: false,
            maxDiscrepancy: 0,
          },
          confidence: 0.5, // Low confidence without related market data
          metadata: {
            calculationTimeMs: Date.now() - startTime,
            relatedPropsCount: 0,
          },
        };
      }

      // Analyze highly correlated markets for discrepancies
      let maxDiscrepancy = 0;
      const correlatedProps: Array<{
        propId: string;
        correlation: number;
        discrepancy: number;
      }> = [];

      for (const related of relatedProps) {
        if (related.correlation > 0.7) {
          // Highly correlated markets (threshold: 70%)

          // Calculate discrepancy between expected and actual lines
          // In production, this would compare:
          // - Actual line vs expected line based on correlation
          // - Market efficiency score
          // - Cross-book line discrepancies
          const discrepancy = this.calculateDiscrepancy(related, context);

          if (discrepancy > 0) {
            correlatedProps.push({
              propId: related.propId,
              correlation: related.correlation,
              discrepancy,
            });

            maxDiscrepancy = Math.max(maxDiscrepancy, discrepancy);
          }
        }
      }

      // Calculate normalized score (0-1 range)
      const rawScore = Math.min(10, 2 + maxDiscrepancy);
      const normalizedScore = rawScore / 10;

      // Determine if arbitrage opportunity exists
      const hasArbitrage = maxDiscrepancy > 1.0; // Threshold for actionable arbitrage
      const arbitrageEdge = hasArbitrage ? maxDiscrepancy / 10 : undefined;

      const calculationTimeMs = Date.now() - startTime;

      logger.debug('Cross market feature calculated', {
        propId: context.propId,
        canonicalGameId: context.canonicalGameId,
        hasArbitrage,
        maxDiscrepancy,
        relatedPropsAnalyzed: relatedProps.length,
        correlatedPropsFound: correlatedProps.length,
        score: normalizedScore,
        calculationTimeMs,
      });

      return {
        score: normalizedScore,
        data: {
          hasArbitrage,
          relatedProps: correlatedProps.length > 0 ? correlatedProps : undefined,
          arbitrageEdge,
          maxDiscrepancy,
        },
        confidence: relatedProps.length >= 3 ? 0.9 : 0.6, // Higher confidence with more data
        metadata: {
          calculationTimeMs,
          relatedPropsCount: relatedProps.length,
          correlatedPropsCount: correlatedProps.length,
        },
      };
    } catch (error) {
      logger.error('Cross market feature calculation failed', {
        propId: context.propId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return base score on error (graceful degradation)
      return {
        score: 0.2,
        data: {
          hasArbitrage: false,
          maxDiscrepancy: 0,
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
   * Calculate discrepancy between related prop and expected correlation
   *
   * In production, this would:
   * - Compare actual line vs expected line based on correlation coefficient
   * - Factor in market efficiency scores
   * - Identify cross-book line discrepancies
   * - Calculate true arbitrage edge after vig
   *
   * @param related - Related prop data
   * @param context - Professional context
   * @returns Discrepancy score (0-5 range)
   */
  private calculateDiscrepancy(related: any, context: ProfessionalContext): number {
    // Placeholder implementation
    // In production, would use:
    // - Historical correlation data
    // - Current lines from multiple books
    // - Expected line calculation based on correlation
    // - Vig-adjusted arbitrage calculation

    // For now, simulate discrepancy based on correlation strength
    // Higher correlation = higher potential discrepancy value
    if (related.correlation > 0.9) {
      return Math.random() * 5; // Very high correlation can yield significant discrepancies
    } else if (related.correlation > 0.8) {
      return Math.random() * 3;
    } else {
      return Math.random() * 1.5;
    }
  }
}
