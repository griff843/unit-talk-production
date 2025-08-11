import { redisCache } from '../../cache/enhanced-cache';
import { withCircuitBreaker } from '../../services/enhanced-circuit-breaker';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics } from '../BaseAgent/types';

import { DataProcessor } from './dataProcessor';
import { MarketForecaster } from './marketForecaster';
import { ModelManager } from './modelManager';
import { PredictionEngine } from './predictionEngine';

interface PredictiveAnalyticsMetrics extends BaseMetrics {
  predictionsGenerated: number;
  modelsDeployed: number;
  forecastAccuracy: number;
  dataPointsProcessed: number;
  modelTrainingTime: number;
  predictionLatency: number;
  accuracyTrend: number;
  confidenceScore: number;
  marketInsights: number;
}

interface MarketPrediction {
  predictionId: string;
  marketId: string;
  gameId: string;
  betType: string;
  predictedOutcome: PredictedOutcome;
  confidence: number;
  expectedAccuracy: number;
  modelUsed: string;
  dataQuality: number;
  timeHorizon: number;
  createdAt: Date;
  expiresAt: Date;
}

interface PredictedOutcome {
  winProbability: number;
  expectedValue: number;
  oddsRange: { min: number; max: number };
  volatility: number;
  marketDirection: 'bullish' | 'bearish' | 'neutral';
  supportLevel: number;
  resistanceLevel: number;
  momentum: number;
}

interface MarketInsight {
  insightId: string;
  type: 'trend' | 'anomaly' | 'opportunity' | 'risk' | 'pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedMarkets: string[];
  confidence: number;
  timeframe: string;
  actionable: boolean;
  recommendations: string[];
  historicalPrecedent?: string;
  timestamp: Date;
}

interface ModelPerformance {
  modelId: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  roc_auc: number;
  calibration: number;
  lastUpdated: Date;
  sampleSize: number;
  performanceTrend: 'improving' | 'declining' | 'stable';
}

export class PredictiveAnalyticsAgent extends BaseAgent {
  private marketForecaster: MarketForecaster;
  private modelManager: ModelManager;
  private dataProcessor: DataProcessor;
  private predictionEngine: PredictionEngine;
  private analyticsMetrics: PredictiveAnalyticsMetrics;
  private activePredictions: Map<string, MarketPrediction> = new Map();
  private marketInsights: Map<string, MarketInsight[]> = new Map();
  private modelPerformance: Map<string, ModelPerformance> = new Map();

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    
    this.analyticsMetrics = {
      ...this.metrics,
      predictionsGenerated: 0,
      modelsDeployed: 0,
      forecastAccuracy: 0,
      dataPointsProcessed: 0,
      modelTrainingTime: 0,
      predictionLatency: 0,
      accuracyTrend: 0,
      confidenceScore: 0,
      marketInsights: 0
    };

    // Initialize subsystems
    this.marketForecaster = new MarketForecaster(this.logger);
    this.modelManager = new ModelManager(this.logger);
    this.dataProcessor = new DataProcessor(this.logger);
    this.predictionEngine = new PredictionEngine(this.logger);
  }

  protected async initialize(): Promise<void> {
    this.logger.info('🔮 PredictiveAnalyticsAgent initializing...');

    // Initialize all subsystems
    await Promise.all([
      this.marketForecaster.initialize(),
      this.modelManager.initialize(),
      this.dataProcessor.initialize(),
      this.predictionEngine.initialize()
    ]);

    // Load existing predictions and insights
    await this.loadActivePredictions();
    await this.loadMarketInsights();
    await this.loadModelPerformance();

    this.logger.info('✅ PredictiveAnalyticsAgent initialized successfully');
  }

  protected async process(): Promise<void> {
    this.logger.info('🔄 Running PredictiveAnalyticsAgent cycle...');
    
    const cycleStartTime = Date.now();

    try {
      // 1. Process new data
      await this.processIncomingData();
      
      // 2. Update and retrain models
      await this.updateModels();
      
      // 3. Generate market predictions
      await this.generateMarketPredictions();
      
      // 4. Identify market insights and anomalies
      await this.identifyMarketInsights();
      
      // 5. Validate existing predictions
      await this.validateExistingPredictions();
      
      // 6. Update model performance metrics
      await this.updateModelPerformance();
      
      // 7. Generate forecasting insights
      await this.generateForecastingInsights();

    } catch (error) {
      this.logger.error('❌ Error in predictive analytics cycle', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }

    const cycleTime = Date.now() - cycleStartTime;
    this.analyticsMetrics.processingTimeMs = cycleTime;

    this.logger.info('✅ PredictiveAnalyticsAgent cycle completed', {
      cycleTimeMs: cycleTime,
      predictionsGenerated: this.analyticsMetrics.predictionsGenerated,
      insightsGenerated: this.analyticsMetrics.marketInsights,
      forecastAccuracy: this.analyticsMetrics.forecastAccuracy
    });
  }

  // Core Processing Methods
  private async processIncomingData(): Promise<void> {
    this.logger.info('📊 Processing incoming market data...');

    try {
      const rawData = await this.fetchMarketData();
      const processedData = await this.dataProcessor.processMarketData(rawData);
      
      this.analyticsMetrics.dataPointsProcessed += processedData.length;
      
      // Store processed data for model training
      await this.storeProcessedData(processedData);
      
      this.logger.info(`✅ Processed ${processedData.length} data points`);

    } catch (error) {
      this.logger.error('❌ Failed to process incoming data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async updateModels(): Promise<void> {
    this.logger.info('🧠 Updating predictive models...');

    try {
      const modelUpdateStartTime = Date.now();
      
      // Check which models need updating
      const modelsToUpdate = await this.modelManager.identifyModelsForUpdate();
      
      for (const modelId of modelsToUpdate) {
        await this.modelManager.updateModel(modelId);
        this.analyticsMetrics.modelsDeployed++;
      }
      
      // Retrain models with new data if needed
      const retrainingNeeded = await this.modelManager.checkRetrainingNeeds();
      if (retrainingNeeded.length > 0) {
        await this.modelManager.retrainModels(retrainingNeeded);
      }
      
      this.analyticsMetrics.modelTrainingTime = Date.now() - modelUpdateStartTime;
      
      this.logger.info(`✅ Updated ${modelsToUpdate.length} models`);

    } catch (error) {
      this.logger.error('❌ Failed to update models', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async generateMarketPredictions(): Promise<void> {
    this.logger.info('🎯 Generating market predictions...');

    try {
      const predictionStartTime = Date.now();
      
      // Get active markets for prediction
      const activeMarkets = await this.getActiveMarkets();
      
      const newPredictions: MarketPrediction[] = [];
      
      for (const market of activeMarkets) {
        try {
          const prediction = await this.predictionEngine.generatePrediction(market);
          
          if (prediction && prediction.confidence > 0.6) {
            newPredictions.push(prediction);
            this.activePredictions.set(prediction.predictionId, prediction);
          }
          
        } catch (error) {
          this.logger.warn('⚠️ Failed to generate prediction for market', {
            marketId: market.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      // Store predictions
      await this.storePredictions(newPredictions);
      
      this.analyticsMetrics.predictionsGenerated += newPredictions.length;
      this.analyticsMetrics.predictionLatency = Date.now() - predictionStartTime;
      
      // Calculate confidence metrics
      if (newPredictions.length > 0) {
        this.analyticsMetrics.confidenceScore = newPredictions
          .reduce((sum, pred) => sum + pred.confidence, 0) / newPredictions.length;
      }
      
      this.logger.info(`✅ Generated ${newPredictions.length} market predictions`);

    } catch (error) {
      this.logger.error('❌ Failed to generate market predictions', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async identifyMarketInsights(): Promise<void> {
    this.logger.info('💡 Identifying market insights...');

    try {
      const insights: MarketInsight[] = [];
      
      // Detect market trends
      const trendInsights = await this.marketForecaster.detectTrends();
      insights.push(...trendInsights);
      
      // Identify anomalies
      const anomalyInsights = await this.marketForecaster.detectAnomalies();
      insights.push(...anomalyInsights);
      
      // Find arbitrage opportunities
      const opportunityInsights = await this.marketForecaster.identifyOpportunities();
      insights.push(...opportunityInsights);
      
      // Assess market risks
      const riskInsights = await this.marketForecaster.assessMarketRisks();
      insights.push(...riskInsights);
      
      // Store insights by market
      for (const insight of insights) {
        for (const marketId of insight.affectedMarkets) {
          const marketInsights = this.marketInsights.get(marketId) || [];
          marketInsights.push(insight);
          this.marketInsights.set(marketId, marketInsights);
        }
      }
      
      this.analyticsMetrics.marketInsights += insights.length;
      
      // Process critical insights immediately
      const criticalInsights = insights.filter(i => i.severity === 'critical');
      if (criticalInsights.length > 0) {
        await this.processCriticalInsights(criticalInsights);
      }
      
      this.logger.info(`✅ Identified ${insights.length} market insights (${criticalInsights.length} critical)`);

    } catch (error) {
      this.logger.error('❌ Failed to identify market insights', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async validateExistingPredictions(): Promise<void> {
    this.logger.info('✅ Validating existing predictions...');

    try {
      const currentTime = new Date();
      let validatedCount = 0;
      let expiredCount = 0;
      
      for (const [predictionId, prediction] of this.activePredictions) {
        // Remove expired predictions
        if (prediction.expiresAt < currentTime) {
          this.activePredictions.delete(predictionId);
          expiredCount++;
          continue;
        }
        
        // Validate prediction accuracy if outcome is available
        const actualOutcome = await this.getActualOutcome(prediction);
        if (actualOutcome) {
          const accuracy = await this.calculatePredictionAccuracy(prediction, actualOutcome);
          await this.recordPredictionResult(prediction, actualOutcome, accuracy);
          validatedCount++;
        }
      }
      
      this.logger.info(`✅ Validated ${validatedCount} predictions, expired ${expiredCount}`);

    } catch (error) {
      this.logger.error('❌ Failed to validate predictions', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async updateModelPerformance(): Promise<void> {
    this.logger.info('📈 Updating model performance metrics...');

    try {
      const models = await this.modelManager.getAllModels();
      
      for (const model of models) {
        const performance = await this.modelManager.calculateModelPerformance(model.modelId);
        this.modelPerformance.set(model.modelId, performance);
      }
      
      // Calculate overall forecast accuracy
      const performances = Array.from(this.modelPerformance.values());
      if (performances.length > 0) {
        this.analyticsMetrics.forecastAccuracy = performances
          .reduce((sum, perf) => sum + perf.accuracy, 0) / performances.length;
      }
      
      this.logger.info(`✅ Updated performance for ${performances.length} models`);

    } catch (error) {
      this.logger.error('❌ Failed to update model performance', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async generateForecastingInsights(): Promise<void> {
    this.logger.info('🔍 Generating forecasting insights...');

    try {
      const insights = {
        totalPredictions: this.activePredictions.size,
        averageConfidence: this.analyticsMetrics.confidenceScore,
        forecastAccuracy: this.analyticsMetrics.forecastAccuracy,
        modelPerformance: await this.getModelPerformanceSummary(),
        marketTrends: await this.getMarketTrendSummary(),
        predictionDistribution: await this.getPredictionDistribution(),
        accuracyTrends: await this.getAccuracyTrends(),
        topPerformingModels: await this.getTopPerformingModels(),
        marketOpportunities: await this.getMarketOpportunities(),
        riskAlerts: await this.getRiskAlerts()
      };

      // Store insights
      await withCircuitBreaker.supabase(
        async () => {
          if (this.hasSupabase()) {
            await this.requireSupabase()
              .from('predictive_insights')
              .insert({
                timestamp: new Date().toISOString(),
                insights,
                metrics: this.analyticsMetrics
              });
          }
        },
        async () => {
          this.logger.warn('⚠️ Failed to store forecasting insights, Supabase circuit breaker open');
        }
      );

      // Cache insights for dashboard
      await redisCache.set(
        'predictive:insights:latest',
        JSON.stringify(insights),
        1800 // 30 minutes TTL
      );

      this.logger.info('✅ Generated and stored forecasting insights', {
        predictions: insights.totalPredictions,
        accuracy: insights.forecastAccuracy,
        confidence: insights.averageConfidence
      });

    } catch (error) {
      this.logger.error('❌ Failed to generate forecasting insights', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Helper Methods
  private async fetchMarketData(): Promise<any[]> {
    // This would integrate with actual market data sources
    return await withCircuitBreaker.supabase(
      async () => {
        if (this.hasSupabase()) {
          const { data: markets, error } = await this.requireSupabase()
            .from('market_data')
            .select('*')
            .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
            .order('timestamp', { ascending: false })
            .limit(1000);

          if (error) {
            this.logger.error('❌ Failed to fetch market data', { error: error.message });
            return [];
          }

          return markets || [];
        }
        return [];
      },
      async () => {
        this.logger.warn('⚠️ Cannot fetch market data, using cached data');
        const cached = await redisCache.get('market:data:latest');
        return cached ? JSON.parse(cached) : [];
      }
    );
  }

  private async getActiveMarkets(): Promise<any[]> {
    // Get currently active markets for prediction
    const cached = await redisCache.get('markets:active');
    if (cached) {
      return JSON.parse(cached);
    }

    // Mock active markets for demonstration
    return [
      { id: 'market_1', gameId: 'game_123', betType: 'moneyline', status: 'active' },
      { id: 'market_2', gameId: 'game_124', betType: 'spread', status: 'active' },
      { id: 'market_3', gameId: 'game_125', betType: 'total', status: 'active' }
    ];
  }

  private async storeProcessedData(processedData: any[]): Promise<void> {
    // Store processed data for model training
    await redisCache.set(
      `processed_data:${Date.now()}`,
      JSON.stringify(processedData),
      86400 // 24 hours TTL
    );
  }

  private async storePredictions(predictions: MarketPrediction[]): Promise<void> {
    for (const prediction of predictions) {
      await redisCache.set(
        `prediction:${prediction.predictionId}`,
        JSON.stringify(prediction),
        prediction.timeHorizon * 60 * 1000 // TTL based on time horizon
      );
    }
  }

  private async processCriticalInsights(criticalInsights: MarketInsight[]): Promise<void> {
    for (const insight of criticalInsights) {
      this.logger.warn('🚨 Critical market insight detected', {
        type: insight.type,
        description: insight.description,
        affectedMarkets: insight.affectedMarkets.length,
        confidence: insight.confidence
      });

      // This would trigger immediate notifications or alerts
    }
  }

  private async getActualOutcome(prediction: MarketPrediction): Promise<any | null> {
    // Check if actual outcome is available for this prediction
    const cached = await redisCache.get(`outcome:${prediction.gameId}:${prediction.betType}`);
    return cached ? JSON.parse(cached) : null;
  }

  private async calculatePredictionAccuracy(
    prediction: MarketPrediction,
    actualOutcome: any
  ): Promise<number> {
    // Calculate accuracy based on predicted vs actual outcome
    const predictionError = Math.abs(prediction.predictedOutcome.winProbability - actualOutcome.actualProbability);
    return Math.max(0, 1 - predictionError);
  }

  private async recordPredictionResult(
    prediction: MarketPrediction,
    actualOutcome: any,
    accuracy: number
  ): Promise<void> {
    const result = {
      predictionId: prediction.predictionId,
      actualOutcome,
      accuracy,
      modelUsed: prediction.modelUsed,
      confidence: prediction.confidence,
      timestamp: new Date()
    };

    await redisCache.set(
      `prediction_result:${prediction.predictionId}`,
      JSON.stringify(result),
      86400 // 24 hours TTL
    );
  }

  private async getModelPerformanceSummary(): Promise<any> {
    const performances = Array.from(this.modelPerformance.values());
    
    return {
      totalModels: performances.length,
      averageAccuracy: performances.length > 0 ? 
        performances.reduce((sum, p) => sum + p.accuracy, 0) / performances.length : 0,
      topPerformer: performances.reduce((best, current) => 
        current.accuracy > best.accuracy ? current : best, performances[0] || { modelId: 'none', accuracy: 0 })
    };
  }

  private async getMarketTrendSummary(): Promise<any> {
    const allInsights = Array.from(this.marketInsights.values()).flat();
    const trendInsights = allInsights.filter(i => i.type === 'trend');
    
    return {
      totalTrends: trendInsights.length,
      bullishTrends: trendInsights.filter(i => i.description.includes('bullish')).length,
      bearishTrends: trendInsights.filter(i => i.description.includes('bearish')).length,
      neutralTrends: trendInsights.filter(i => i.description.includes('neutral')).length
    };
  }

  private async getPredictionDistribution(): Promise<any> {
    const predictions = Array.from(this.activePredictions.values());
    
    return {
      byConfidence: {
        high: predictions.filter(p => p.confidence > 0.8).length,
        medium: predictions.filter(p => p.confidence >= 0.6 && p.confidence <= 0.8).length,
        low: predictions.filter(p => p.confidence < 0.6).length
      },
      byBetType: this.groupPredictionsByBetType(predictions),
      byTimeHorizon: this.groupPredictionsByTimeHorizon(predictions)
    };
  }

  private groupPredictionsByBetType(predictions: MarketPrediction[]): any {
    const groups: Record<string, number> = {};
    
    predictions.forEach(p => {
      groups[p.betType] = (groups[p.betType] || 0) + 1;
    });
    
    return groups;
  }

  private groupPredictionsByTimeHorizon(predictions: MarketPrediction[]): any {
    const groups = { short: 0, medium: 0, long: 0 };
    
    predictions.forEach(p => {
      if (p.timeHorizon <= 60) groups.short++;
      else if (p.timeHorizon <= 300) groups.medium++;
      else groups.long++;
    });
    
    return groups;
  }

  private async getAccuracyTrends(): Promise<any> {
    // This would analyze historical accuracy trends
    return {
      trend: 'improving',
      changeRate: 0.05,
      lastWeekAccuracy: 0.72,
      currentAccuracy: this.analyticsMetrics.forecastAccuracy
    };
  }

  private async getTopPerformingModels(): Promise<any[]> {
    return Array.from(this.modelPerformance.values())
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 5)
      .map(p => ({
        modelId: p.modelId,
        accuracy: p.accuracy,
        trend: p.performanceTrend
      }));
  }

  private async getMarketOpportunities(): Promise<any[]> {
    const allInsights = Array.from(this.marketInsights.values()).flat();
    return allInsights
      .filter(i => i.type === 'opportunity' && i.actionable)
      .slice(0, 10)
      .map(i => ({
        description: i.description,
        confidence: i.confidence,
        markets: i.affectedMarkets.length,
        timeframe: i.timeframe
      }));
  }

  private async getRiskAlerts(): Promise<any[]> {
    const allInsights = Array.from(this.marketInsights.values()).flat();
    return allInsights
      .filter(i => i.type === 'risk' && i.severity !== 'low')
      .slice(0, 5)
      .map(i => ({
        description: i.description,
        severity: i.severity,
        markets: i.affectedMarkets.length,
        recommendations: i.recommendations
      }));
  }

  private async loadActivePredictions(): Promise<void> {
    try {
      const cachedPredictions = await redisCache.getPattern('prediction:*');
      
      for (const [key, data] of cachedPredictions) {
        const prediction = JSON.parse(data);
        prediction.createdAt = new Date(prediction.createdAt);
        prediction.expiresAt = new Date(prediction.expiresAt);
        this.activePredictions.set(prediction.predictionId, prediction);
      }

      this.logger.info(`📋 Loaded ${this.activePredictions.size} active predictions`);
    } catch (error) {
      this.logger.warn('⚠️ Failed to load active predictions from cache');
    }
  }

  private async loadMarketInsights(): Promise<void> {
    try {
      const cachedInsights = await redisCache.getPattern('insights:market:*');
      
      for (const [key, data] of cachedInsights) {
        const marketId = key.split(':').pop();
        if (marketId) {
          const insights = JSON.parse(data);
          insights.forEach((insight: any) => {
            insight.timestamp = new Date(insight.timestamp);
          });
          this.marketInsights.set(marketId, insights);
        }
      }

      this.logger.info(`📋 Loaded insights for ${this.marketInsights.size} markets`);
    } catch (error) {
      this.logger.warn('⚠️ Failed to load market insights from cache');
    }
  }

  private async loadModelPerformance(): Promise<void> {
    try {
      const cachedPerformance = await redisCache.getPattern('model:performance:*');
      
      for (const [key, data] of cachedPerformance) {
        const modelId = key.split(':').pop();
        if (modelId) {
          const performance = JSON.parse(data);
          performance.lastUpdated = new Date(performance.lastUpdated);
          this.modelPerformance.set(modelId, performance);
        }
      }

      this.logger.info(`📋 Loaded performance data for ${this.modelPerformance.size} models`);
    } catch (error) {
      this.logger.warn('⚠️ Failed to load model performance from cache');
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 PredictiveAnalyticsAgent cleanup...');
    
    // Save active predictions
    for (const [predictionId, prediction] of this.activePredictions) {
      await redisCache.set(
        `prediction:${predictionId}`,
        JSON.stringify(prediction),
        86400 // 24 hours TTL
      );
    }
    
    // Save market insights
    for (const [marketId, insights] of this.marketInsights) {
      await redisCache.set(
        `insights:market:${marketId}`,
        JSON.stringify(insights),
        86400 // 24 hours TTL
      );
    }
    
    // Save model performance
    for (const [modelId, performance] of this.modelPerformance) {
      await redisCache.set(
        `model:performance:${modelId}`,
        JSON.stringify(performance),
        86400 // 24 hours TTL
      );
    }
    
    await Promise.all([
      this.marketForecaster.cleanup(),
      this.modelManager.cleanup(),
      this.dataProcessor.cleanup(),
      this.predictionEngine.cleanup()
    ]);
    
    this.activePredictions.clear();
    this.marketInsights.clear();
    this.modelPerformance.clear();
    
    this.logger.info('✅ PredictiveAnalyticsAgent cleanup complete');
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    return {
      ...this.analyticsMetrics,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  public async checkHealth(): Promise<any> {
    const checks = [];

    // Check subsystem health
    checks.push({
      component: 'market_forecaster',
      status: await this.marketForecaster.isHealthy() ? 'healthy' : 'unhealthy'
    });

    checks.push({
      component: 'model_manager',
      status: await this.modelManager.isHealthy() ? 'healthy' : 'unhealthy'
    });

    checks.push({
      component: 'data_processor',
      status: await this.dataProcessor.isHealthy() ? 'healthy' : 'unhealthy'
    });

    checks.push({
      component: 'prediction_engine',
      status: await this.predictionEngine.isHealthy() ? 'healthy' : 'unhealthy'
    });

    const healthyComponents = checks.filter(c => c.status === 'healthy').length;
    const overallStatus = healthyComponents === checks.length ? 'healthy' : 
                         healthyComponents >= checks.length / 2 ? 'degraded' : 'unhealthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      details: {
        checks,
        metrics: this.analyticsMetrics,
        activePredictions: this.activePredictions.size,
        marketInsights: Array.from(this.marketInsights.values()).flat().length
      }
    };
  }
}