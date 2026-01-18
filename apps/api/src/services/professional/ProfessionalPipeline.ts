/**
 * Professional Pipeline Orchestrator
 *
 * Central orchestrator for all professional betting features.
 * Coordinates feature execution, aggregates scores, and provides unified insights.
 */

import { logger } from '../../lib/logger';
import {
  ProfessionalFeature,
  ProfessionalContext,
  ProfessionalPipelineConfig,
  ProfessionalPipelineResult,
  ProfessionalFeatureResult,
  ProfessionalInsights,
  DEFAULT_FEATURE_WEIGHTS,
} from './types';
import {
  recordFeatureExecution,
  recordFeatureError,
  recordFeatureSkipped,
  recordPipelineExecution,
  recordPipelineError,
} from '../../monitoring/ProfessionalMetrics';

export class ProfessionalPipeline {
  private features: Map<string, ProfessionalFeature>;
  private weights: Map<string, number>;
  private config: Required<ProfessionalPipelineConfig>;

  constructor(
    features: ProfessionalFeature[],
    config: ProfessionalPipelineConfig = {}
  ) {
    this.features = new Map(features.map((f) => [f.id, f]));

    // Initialize weights (custom overrides or defaults)
    this.weights = new Map();
    for (const feature of features) {
      const customWeight = config.weights?.[feature.id];
      const weight = customWeight ?? DEFAULT_FEATURE_WEIGHTS[feature.id] ?? feature.defaultWeight;
      this.weights.set(feature.id, weight);
    }

    // Default config
    this.config = {
      weights: config.weights || {},
      enabledFeatures: config.enabledFeatures || Array.from(this.features.keys()),
      parallel: config.parallel ?? false,
      gracefulDegradation: config.gracefulDegradation ?? true,
    };

    logger.info('ProfessionalPipeline initialized', {
      featureCount: this.features.size,
      enabledFeatures: this.config.enabledFeatures.length,
      parallel: this.config.parallel,
    });
  }

  /**
   * Run all enabled features and calculate composite professional score.
   * @param context - Professional context with all required data
   * @returns Aggregated professional insights and score
   */
  async execute(context: ProfessionalContext): Promise<ProfessionalPipelineResult> {
    const startTime = Date.now();
    const results: Map<string, ProfessionalFeatureResult> = new Map();
    let featuresExecuted = 0;
    let featuresSkipped = 0;
    let featuresFailed = 0;

    logger.debug('ProfessionalPipeline executing', {
      propId: context.propId,
      canonicalGameId: context.canonicalGameId,
      canonicalPlayerId: context.canonicalPlayerId,
      enabledFeatures: this.config.enabledFeatures.length,
    });

    // Execute features (sequential or parallel based on config)
    if (this.config.parallel) {
      const promises: Array<Promise<void>> = [];

      for (const featureId of this.config.enabledFeatures) {
        const feature = this.features.get(featureId);
        if (!feature) continue;

        promises.push(
          this.executeFeature(feature, context, results).then((success) => {
            if (success) featuresExecuted++;
            else if (success === false) featuresFailed++;
            else featuresSkipped++;
          })
        );
      }

      await Promise.all(promises);
    } else {
      // Sequential execution (default for predictable behavior)
      for (const featureId of this.config.enabledFeatures) {
        const feature = this.features.get(featureId);
        if (!feature) continue;

        const success = await this.executeFeature(feature, context, results);
        if (success) featuresExecuted++;
        else if (success === false) featuresFailed++;
        else featuresSkipped++;
      }
    }

    // Calculate weighted composite score
    const compositeScore = this.calculateCompositeScore(results);

    // Build unified insights
    const insights = this.buildInsights(results);

    const totalDurationMs = Date.now() - startTime;

    // Record pipeline-level metrics
    recordPipelineExecution(
      totalDurationMs / 1000, // Convert to seconds
      compositeScore,
      featuresExecuted,
      !!context.clvData,
      !!context.canonicalGameId,
      !!context.canonicalPlayerId
    );

    logger.info('ProfessionalPipeline completed', {
      propId: context.propId,
      canonicalGameId: context.canonicalGameId,
      canonicalPlayerId: context.canonicalPlayerId,
      compositeScore,
      featuresExecuted,
      featuresSkipped,
      featuresFailed,
      totalDurationMs,
      hasCLV: !!context.clvData,
    });

    return {
      compositeScore,
      featureResults: results,
      insights,
      metadata: {
        totalDurationMs,
        featuresExecuted,
        featuresSkipped,
        featuresFailed,
      },
    };
  }

  /**
   * Execute a single feature with error handling
   */
  private async executeFeature(
    feature: ProfessionalFeature,
    context: ProfessionalContext,
    results: Map<string, ProfessionalFeatureResult>
  ): Promise<boolean | null> {
    const featureStartTime = Date.now();

    // Check if feature can calculate with current context
    if (!feature.canCalculate(context)) {
      recordFeatureSkipped(feature.id, 'missing_data');
      logger.debug(`Feature ${feature.id} cannot calculate (missing data)`, {
        propId: context.propId,
        canonicalGameId: context.canonicalGameId,
        canonicalPlayerId: context.canonicalPlayerId,
      });
      return null; // Skipped
    }

    try {
      const result = await feature.calculate(context);
      const durationMs = Date.now() - featureStartTime;

      // Add calculation time to metadata
      result.metadata = {
        ...result.metadata,
        calculationTimeMs: durationMs,
      };

      results.set(feature.id, result);

      // Record feature-level metrics
      recordFeatureExecution(
        feature.id,
        feature.name,
        durationMs / 1000, // Convert to seconds
        result.score,
        result.confidence
      );

      logger.debug(`Feature ${feature.id} calculated`, {
        propId: context.propId,
        canonicalGameId: context.canonicalGameId,
        canonicalPlayerId: context.canonicalPlayerId,
        score: result.score,
        confidence: result.confidence,
        durationMs,
      });

      return true; // Success
    } catch (error) {
      const durationMs = Date.now() - featureStartTime;

      const errorType = error instanceof Error ? error.name : 'UnknownError';
      recordFeatureError(feature.id, errorType);

      logger.error(`Feature ${feature.id} failed`, {
        propId: context.propId,
        canonicalGameId: context.canonicalGameId,
        canonicalPlayerId: context.canonicalPlayerId,
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      });

      if (!this.config.gracefulDegradation) {
        throw error; // Re-throw if graceful degradation is disabled
      }

      return false; // Failed
    }
  }

  /**
   * Calculate weighted composite score from feature results
   */
  private calculateCompositeScore(
    results: Map<string, ProfessionalFeatureResult>
  ): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const [featureId, result] of results) {
      const weight = this.weights.get(featureId) || 0;
      weightedSum += result.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Build unified insights structure from feature results
   * (Matches current SyndicateGradingEngine format for backward compatibility)
   */
  private buildInsights(
    results: Map<string, ProfessionalFeatureResult>
  ): ProfessionalInsights {
    const insights: ProfessionalInsights = {};

    // Map feature results to insights structure
    for (const [featureId, result] of results) {
      switch (featureId) {
        case 'steam-detection':
          insights.steamAnalysis = result.data;
          break;
        case 'closing-line-prediction':
          insights.predictedClosingLine = result.data;
          break;
        case 'optimal-timing':
          insights.optimalBettingTime = result.data;
          break;
        case 'line-shopping':
          insights.lineShoppingResult = result.data;
          break;
        case 'public-vs-sharp':
          insights.bettingPercentages = result.data;
          break;
        case 'market-timing':
          insights.marketTimingAdvantage = result.data;
          break;
        case 'injury-timing':
          insights.injuryTimingAdvantage = result.data;
          break;
        case 'cross-market':
          insights.crossMarketArbitrage = result.data;
          break;
      }
    }

    return insights;
  }

  /**
   * Get all registered features
   */
  getFeatures(): ProfessionalFeature[] {
    return Array.from(this.features.values());
  }

  /**
   * Get feature weights
   */
  getWeights(): Record<string, number> {
    return Object.fromEntries(this.weights);
  }
}
