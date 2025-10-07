/**
 * Dynamic Weight Loader for Enhanced45FactorEngine
 *
 * Loads ML-optimized weights for sport-specific factor tuning
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../../../utils/logger';
import { Factor45Config } from './Enhanced45FactorEngine';

interface MLWeightConfig {
  sport: string;
  version: string;
  trainedAt: string;
  performance: {
    winRate: number;
    accuracy: number;
    brierScore: number;
    logLoss: number;
    sampleSize: number;
  };
  weights: {
    marketFactors: Record<string, number>;
    playerFactors: Record<string, number>;
    matchupFactors: Record<string, number>;
    priceFactors: Record<string, number>;
    metaFactors: Record<string, number>;
  };
}

export class DynamicWeightLoader {
  private logger = createLogger('DynamicWeightLoader');
  private weightCache: Map<string, Factor45Config> = new Map();
  private configDir: string;

  constructor() {
    this.configDir = path.resolve(__dirname, '../../../../config/enhanced45-weights');
  }

  /**
   * Load sport-specific weights with fallback to defaults
   */
  loadWeights(sport: string): Factor45Config {
    const sportKey = sport.toUpperCase();

    // Check cache first
    if (this.weightCache.has(sportKey)) {
      this.logger.debug('Loading weights from cache', { sport: sportKey });
      return this.weightCache.get(sportKey)!;
    }

    // Try loading ML-optimized weights
    try {
      const mlConfig = this.loadMLWeights(sportKey);
      if (mlConfig) {
        this.logger.info('Loaded ML-optimized weights', {
          sport: sportKey,
          version: mlConfig.version,
          winRate: mlConfig.performance.winRate,
          sampleSize: mlConfig.performance.sampleSize
        });

        const config = this.convertMLConfigToFactor45(mlConfig);
        this.weightCache.set(sportKey, config);
        return config;
      }
    } catch (error) {
      this.logger.warn('Failed to load ML weights, using defaults', {
        sport: sportKey,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Fallback to default expert weights
    const defaultConfig = this.getDefaultWeights();
    this.weightCache.set(sportKey, defaultConfig);
    return defaultConfig;
  }

  /**
   * Load ML-optimized weights from file
   */
  private loadMLWeights(sport: string): MLWeightConfig | null {
    const filename = `${sport.toLowerCase()}-weights.json`;
    const filepath = path.join(this.configDir, filename);

    if (!fs.existsSync(filepath)) {
      this.logger.debug('ML weight file not found', { filepath });
      return null;
    }

    const content = fs.readFileSync(filepath, 'utf-8');
    const config: MLWeightConfig = JSON.parse(content);

    // Validate config
    if (!this.validateMLConfig(config)) {
      this.logger.error('Invalid ML config file', { filepath });
      return null;
    }

    return config;
  }

  /**
   * Validate ML config structure
   */
  private validateMLConfig(config: MLWeightConfig): boolean {
    return !!(
      config.sport &&
      config.version &&
      config.weights &&
      config.weights.marketFactors &&
      config.weights.playerFactors &&
      config.weights.matchupFactors &&
      config.weights.priceFactors &&
      config.weights.metaFactors
    );
  }

  /**
   * Convert ML config to Factor45Config
   */
  private convertMLConfigToFactor45(mlConfig: MLWeightConfig): Factor45Config {
    return {
      marketFactors: mlConfig.weights.marketFactors as any,
      playerFactors: mlConfig.weights.playerFactors as any,
      matchupFactors: mlConfig.weights.matchupFactors as any,
      priceFactors: mlConfig.weights.priceFactors as any,
      metaFactors: mlConfig.weights.metaFactors as any
    };
  }

  /**
   * Get default expert weights (from Enhanced45FactorEngine)
   */
  private getDefaultWeights(): Factor45Config {
    return {
      marketFactors: {
        expectedValueDevigged: 0.25,
        lineMovementVelocity: 0.15,
        closingLineValue: 0.12,
        marketEfficiency: 0.10,
        publicVsSharpSplit: 0.08,
        volumeProfile: 0.08,
        crossMarketArbitrage: 0.06,
        steamDetection: 0.06,
        marketResistance: 0.05,
        optimalTiming: 0.05
      },
      playerFactors: {
        playerForm: 0.20,
        roleStability: 0.15,
        matchupHistory: 0.12,
        injuryImpact: 0.12,
        fatigueLevel: 0.10,
        usageRate: 0.08,
        performanceTrends: 0.08,
        clutchFactor: 0.06,
        propSpecificTendencies: 0.05,
        situationalPerformance: 0.04
      },
      matchupFactors: {
        teamVsTeam: 0.18,
        defenseVsPosition: 0.16,
        paceImpact: 0.14,
        gameScript: 0.12,
        homeAwaysplits: 0.10,
        refereeTendencies: 0.08,
        weatherImpact: 0.08,
        venueFactors: 0.06,
        restAdvantage: 0.04,
        motivationalFactors: 0.04
      },
      priceFactors: {
        lineShoppingEdge: 0.18,
        kellyFraction: 0.16,
        riskAdjustedReturn: 0.14,
        correlationRisk: 0.12,
        portfolioImpact: 0.10,
        volatilityScore: 0.08,
        liquidityPremium: 0.08,
        marketTiming: 0.06,
        bidAskSpread: 0.04,
        optionValue: 0.04
      },
      metaFactors: {
        dataQuality: 0.30,
        modelAgreement: 0.25,
        historicalAccuracy: 0.20,
        confidenceInterval: 0.15,
        recencyBiasAdjustment: 0.10
      }
    };
  }

  /**
   * Clear weight cache (useful for retraining)
   */
  clearCache(): void {
    this.weightCache.clear();
    this.logger.info('Weight cache cleared');
  }

  /**
   * Get available sport-specific configs
   */
  getAvailableConfigs(): string[] {
    if (!fs.existsSync(this.configDir)) {
      return [];
    }

    const files = fs.readdirSync(this.configDir);
    return files
      .filter(f => f.endsWith('-weights.json'))
      .map(f => f.replace('-weights.json', '').toUpperCase());
  }

  /**
   * Get performance metrics for loaded config
   */
  getPerformanceMetrics(sport: string): MLWeightConfig['performance'] | null {
    const sportKey = sport.toUpperCase();
    const mlConfig = this.loadMLWeights(sportKey);

    return mlConfig ? mlConfig.performance : null;
  }
}

// Singleton instance
export const dynamicWeightLoader = new DynamicWeightLoader();
