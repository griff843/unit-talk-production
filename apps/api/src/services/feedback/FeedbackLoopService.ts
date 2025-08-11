/**
 * Automated Feedback Loop Service
 * Uses CLV/ROI data to continuously optimize weights and features
 * This is what separates sharp systems from static models
 * 
 * @module FeedbackLoopService
 */

import { SyndicateGradingEngine } from '../../agents/GradingAgent/scoring/gradingEngine';
import { createLogger } from '../../utils/logger';
import { clvTrackingService } from '../clv/CLVTrackingService';
import { supabaseClient } from '../supabaseClient';

import type { ScoringWeights } from '../../agents/GradingAgent/scoring/gradingEngine';

export interface WeightAdjustment {
  feature: keyof ScoringWeights;
  oldWeight: number;
  newWeight: number;
  reason: string;
  clvImpact: number;
  confidence: number;
}

export interface BookPerformance {
  book: string;
  avgCLV: number;
  betCount: number;
  roi: number;
  reliability: number; // 0-1 professional_score
  weight: number;     // Current weight
  suggestedWeight: number;
}

export interface MarketPerformance {
  sport: string;
  market: string;
  avgCLV: number;
  betCount: number;
  confidence: number;
  edgeMultiplier: number;
}

export interface FeatureImportance {
  feature: keyof ScoringWeights;
  importance: number;
  clvCorrelation: number;
  shouldPrune: boolean;
}

export class FeedbackLoopService {
  private static instance: FeedbackLoopService;
  private logger: any;
  private gradingEngine: SyndicateGradingEngine;
  
  // Configuration
  private readonly MIN_SAMPLE_SIZE = 50;          // Min bets before adjusting
  private readonly ADJUSTMENT_RATE = 0.1;         // Max 10% change per update
  private readonly CLV_TARGET = 2.5;              // Target 2.5% CLV
  private readonly PRUNE_THRESHOLD = 0.01;        // Prune features < 1% importance
  
  private constructor() {
    this.logger = createLogger('FeedbackLoopService');
    this.gradingEngine = new SyndicateGradingEngine();
  }

  public static getInstance(): FeedbackLoopService {
    if (!FeedbackLoopService.instance) {
      FeedbackLoopService.instance = new FeedbackLoopService();
    }
    return FeedbackLoopService.instance;
  }

  /**
   * Main feedback loop - runs automatically
   * Should be scheduled to run every 6-24 hours
   */
  async runFeedbackLoop(): Promise<{
    weightAdjustments: WeightAdjustment[];
    bookAdjustments: BookPerformance[];
    marketAdjustments: MarketPerformance[];
    prunedFeatures: string[];
  }> {
    this.logger.info('Starting automated feedback loop...');
    
    try {
      // 1. Analyze recent CLV performance
      const clvData = await this.analyzeRecentCLV();
      
      // 2. Adjust feature weights based on CLV correlation
      const weightAdjustments = await this.adjustFeatureWeights(clvData);
      
      // 3. Adjust sportsbook weights based on performance
      const bookAdjustments = await this.adjustBookWeights();
      
      // 4. Adjust market-specific confidence
      const marketAdjustments = await this.adjustMarketConfidence();
      
      // 5. Prune underperforming features
      const prunedFeatures = await this.pruneFeatures(clvData);
      
      // 6. Apply adjustments to grading engine
      await this.applyAdjustments(weightAdjustments, bookAdjustments, marketAdjustments);
      
      // 7. Log results
      await this.logFeedbackResults({
        weightAdjustments,
        bookAdjustments,
        marketAdjustments,
        prunedFeatures
      });
      
      this.logger.info('Feedback loop completed successfully');
      
      return {
        weightAdjustments,
        bookAdjustments,
        marketAdjustments,
        prunedFeatures
      };
    } catch (error) {
      this.logger.error('Feedback loop failed', error);
      throw error;
    }
  }

  /**
   * Analyze recent CLV performance by feature
   */
  private async analyzeRecentCLV(): Promise<Map<string, FeatureImportance>> {
    // Get recent picks with CLV data
    const { data: recentPicks, error } = await supabaseClient
      .from('graded_props')
      .select(`
        *,
        clv_tracking!inner(
          clv,
          clvPercentage,
          beatsClosing
        )
      `)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .not('clv_tracking.clv', 'is', null);

    if (error) throw error;

    // Analyze feature contribution to CLV
    const featureImportance = new Map<string, FeatureImportance>();
    const currentWeights = this.gradingEngine.getCurrentConfig().weights;

    // Calculate correlation between each feature and CLV
    for (const [feature, weight] of Object.entries(currentWeights)) {
      const correlation = this.calculateFeatureCLVCorrelation(
        recentPicks || [],
        feature as keyof ScoringWeights
      );
      
      const importance = weight * Math.abs(correlation);
      
      featureImportance.set(feature, {
        feature: feature as keyof ScoringWeights,
        importance,
        clvCorrelation: correlation,
        shouldPrune: importance < this.PRUNE_THRESHOLD && recentPicks!.length > this.MIN_SAMPLE_SIZE
      });
    }

    return featureImportance;
  }

  /**
   * Calculate correlation between feature values and CLV
   */
  private calculateFeatureCLVCorrelation(
    picks: any[],
    feature: keyof ScoringWeights
  ): number {
    if (picks.length < 10) return 0;

    // Extract feature values and CLV values
    const featureValues = picks.map(p => p.featureContributions?.[feature] || 0);
    const clvValues = picks.map(p => p.clv_tracking?.clvPercentage || 0);

    // Calculate Pearson correlation
    const n = featureValues.length;
    const sumX = featureValues.reduce((a, b) => a + b, 0);
    const sumY = clvValues.reduce((a, b) => a + b, 0);
    const sumXY = featureValues.reduce((total, x, i) => total + x * clvValues[i], 0);
    const sumX2 = featureValues.reduce((total, x) => total + x * x, 0);
    const sumY2 = clvValues.reduce((total, y) => total + y * y, 0);

    const correlation = (n * sumXY - sumX * sumY) / 
      Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return isNaN(correlation) ? 0 : correlation;
  }

  /**
   * Adjust feature weights based on CLV performance
   */
  private async adjustFeatureWeights(
    featureImportance: Map<string, FeatureImportance>
  ): Promise<WeightAdjustment[]> {
    const adjustments: WeightAdjustment[] = [];
    const currentConfig = this.gradingEngine.getCurrentConfig();
    const currentWeights = { ...currentConfig.weights };

    // Get current CLV performance
    const recentStats = await clvTrackingService.getCLVStats({
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    });

    const currentCLV = recentStats.avgCLVPercentage;
    const clvGap = this.CLV_TARGET - currentCLV;

    for (const [feature, importance] of featureImportance) {
      const featureKey = feature as keyof ScoringWeights;
      const currentWeight = currentWeights[featureKey];
      
      // Skip if no current weight
      if (!currentWeight) continue;

      let adjustment = 0;

      // Positive correlation with CLV = increase weight
      // Negative correlation = decrease weight
      if (importance.clvCorrelation > 0.1 && clvGap > 0) {
        // Feature helps CLV and we need more CLV
        adjustment = Math.min(this.ADJUSTMENT_RATE, importance.clvCorrelation * 0.5);
      } else if (importance.clvCorrelation < -0.1 && clvGap > 0) {
        // Feature hurts CLV and we need more CLV
        adjustment = -Math.min(this.ADJUSTMENT_RATE, Math.abs(importance.clvCorrelation) * 0.5);
      } else if (importance.clvCorrelation > 0.1 && clvGap < 0) {
        // Feature helps CLV but we have too much CLV (rare)
        adjustment = -Math.min(this.ADJUSTMENT_RATE * 0.5, importance.clvCorrelation * 0.25);
      }

      if (Math.abs(adjustment) > 0.01) {
        const newWeight = Math.max(0, currentWeight * (1 + adjustment));
        
        adjustments.push({
          feature: featureKey,
          oldWeight: currentWeight,
          newWeight,
          reason: `CLV correlation: ${importance.clvCorrelation.toFixed(3)}`,
          clvImpact: importance.clvCorrelation,
          confidence: Math.min(1, recentStats.totalBets / 100)
        });

        currentWeights[featureKey] = newWeight;
      }
    }

    // Normalize weights to sum to previous total
    const oldTotal = Object.values(currentConfig.weights).reduce((a, b) => a + b, 0);
    const newTotal = Object.values(currentWeights).reduce((a, b) => a + b, 0);
    
    if (newTotal > 0) {
      const scale = oldTotal / newTotal;
      Object.keys(currentWeights).forEach(key => {
        currentWeights[key as keyof ScoringWeights] *= scale;
      });
    }

    return adjustments;
  }

  /**
   * Adjust sportsbook weights based on CLV performance
   */
  private async adjustBookWeights(): Promise<BookPerformance[]> {
    const stats = await clvTrackingService.getCLVStats({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    });

    const bookPerformance: BookPerformance[] = [];
    
    // Get current book weights from database
    const { data: currentWeights } = await supabaseClient
      .from('sportsbook_weights')
      .select('*');

    const weightMap = new Map(
      currentWeights?.map(w => [w.book, w.weight]) || []
    );

    // Analyze each book
    for (const [book, metrics] of stats.byBook) {
      const currentWeight = weightMap.get(book) || 1.0;
      
      // Calculate reliability professional_score based on CLV consistency
      const reliability = this.calculateReliability(metrics);
      
      // Suggest new weight based on CLV performance
      let suggestedWeight = currentWeight;
      
      if (metrics.avgCLV > this.CLV_TARGET && metrics.count > this.MIN_SAMPLE_SIZE) {
        // Book consistently provides value
        suggestedWeight = Math.min(1.5, currentWeight * (1 + this.ADJUSTMENT_RATE));
      } else if (metrics.avgCLV < 0 && metrics.count > this.MIN_SAMPLE_SIZE) {
        // Book consistently overvalues (bad for us)
        suggestedWeight = Math.max(0.5, currentWeight * (1 - this.ADJUSTMENT_RATE));
      }

      bookPerformance.push({
        book,
        avgCLV: metrics.avgCLV,
        betCount: metrics.count,
        roi: metrics.roi,
        reliability,
        weight: currentWeight,
        suggestedWeight
      });
    }

    // Sort by suggested weight
    return bookPerformance.sort((a, b) => b.suggestedWeight - a.suggestedWeight);
  }

  /**
   * Calculate reliability professional_score for a book
   */
  private calculateReliability(metrics: any): number {
    // Factors: sample size, consistency (low std dev), positive CLV
    const sampleScore = Math.min(1, metrics.count / 100);
    const consistencyScore = metrics.stdDev > 0 ? Math.max(0, 1 - metrics.stdDev / 10) : 0.5;
    const clvScore = Math.max(0, Math.min(1, (metrics.avgCLV + 5) / 10));
    
    return (sampleScore * 0.2 + consistencyScore * 0.4 + clvScore * 0.4);
  }

  /**
   * Adjust market-specific confidence multipliers
   */
  private async adjustMarketConfidence(): Promise<MarketPerformance[]> {
    const stats = await clvTrackingService.getCLVStats({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    });

    const marketPerformance: MarketPerformance[] = [];
    
    // Analyze sport+market combinations
    const { data: recentPicks } = await supabaseClient
      .from('graded_props')
      .select('sport, market, clv_tracking(clvPercentage)')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .not('clv_tracking.clvPercentage', 'is', null);

    // Group by sport+market
    const marketGroups = new Map<string, any[]>();
    recentPicks?.forEach(pick => {
      const key = `${pick.sport}:${pick.market}`;
      if (!marketGroups.has(key)) {
        marketGroups.set(key, []);
      }
      marketGroups.get(key)!.push(pick);
    });

    // Calculate performance for each market
    for (const [key, picks] of marketGroups) {
      const [sport, market] = key.split(':');
      const avgCLV = picks.reduce((sum, p) => sum + p.clv_tracking.clvPercentage, 0) / picks.length;
      const betCount = picks.length;
      
      // Calculate confidence based on CLV and sample size
      const clvScore = Math.max(0, Math.min(1, avgCLV / 5)); // 5% CLV = max professional_score
      const sampleScore = Math.min(1, betCount / 50);
      const confidence = clvScore * 0.7 + sampleScore * 0.3;
      
      // Edge multiplier: boost edges in high-CLV markets
      const edgeMultiplier = avgCLV > 2 ? 1.1 : avgCLV > 0 ? 1.0 : 0.9;
      
      marketPerformance.push({
        sport,
        market,
        avgCLV,
        betCount,
        confidence,
        edgeMultiplier
      });
    }

    return marketPerformance.sort((a, b) => b.avgCLV - a.avgCLV);
  }

  /**
   * Prune underperforming features
   */
  private async pruneFeatures(
    featureImportance: Map<string, FeatureImportance>
  ): Promise<string[]> {
    const prunedFeatures: string[] = [];
    const currentConfig = this.gradingEngine.getCurrentConfig();
    
    for (const [feature, importance] of featureImportance) {
      if (importance.shouldPrune) {
        // Mark feature for pruning (set weight to 0)
        const updatedWeights = { ...currentConfig.weights };
        updatedWeights[feature as keyof ScoringWeights] = 0;
        
        prunedFeatures.push(feature);
        
        this.logger.warn(`Pruning feature ${feature}: importance=${importance.importance.toFixed(4)}`);
      }
    }

    return prunedFeatures;
  }

  /**
   * Apply all adjustments to the system
   */
  private async applyAdjustments(
    weightAdjustments: WeightAdjustment[],
    bookAdjustments: BookPerformance[],
    marketAdjustments: MarketPerformance[]
  ): Promise<void> {
    // 1. Update feature weights in grading engine
    if (weightAdjustments.length > 0) {
      const currentConfig = this.gradingEngine.getCurrentConfig();
      const newWeights = { ...currentConfig.weights };
      
      weightAdjustments.forEach(adj => {
        newWeights[adj.feature] = adj.newWeight;
      });
      
      this.gradingEngine.updateScoringConfig('optimized', {
        ...currentConfig,
        name: 'Auto-Optimized',
        version: new Date().toISOString(),
        weights: newWeights
      });
      
      this.gradingEngine.setActiveConfig('optimized');
    }

    // 2. Update sportsbook weights in database
    for (const bookAdj of bookAdjustments) {
      if (Math.abs(bookAdj.weight - bookAdj.suggestedWeight) > 0.01) {
        await supabaseClient
          .from('sportsbook_weights')
          .upsert({
            book: bookAdj.book,
            weight: bookAdj.suggestedWeight,
            reliability: bookAdj.reliability,
            last_updated: new Date().toISOString()
          });
      }
    }

    // 3. Update market confidence in database
    for (const marketAdj of marketAdjustments) {
      await supabaseClient
        .from('market_confidence')
        .upsert({
          sport: marketAdj.sport,
          market: marketAdj.market,
          confidence: marketAdj.confidence,
          edge_multiplier: marketAdj.edgeMultiplier,
          last_updated: new Date().toISOString()
        });
    }
  }

  /**
   * Log feedback loop results for monitoring
   */
  private async logFeedbackResults(results: any): Promise<void> {
    await supabaseClient
      .from('feedback_loop_history')
      .insert({
        timestamp: new Date().toISOString(),
        weight_adjustments: results.weightAdjustments,
        book_adjustments: results.bookAdjustments,
        market_adjustments: results.marketAdjustments,
        pruned_features: results.prunedFeatures,
        summary: {
          total_adjustments: results.weightAdjustments.length,
          books_adjusted: results.bookAdjustments.filter(
            (b: BookPerformance) => Math.abs(b.weight - b.suggestedWeight) > 0.01
          ).length,
          features_pruned: results.prunedFeatures.length
        }
      });
  }

  /**
   * Get optimization history
   */
  async getOptimizationHistory(days: number = 30): Promise<any[]> {
    const { data, error } = await supabaseClient
      .from('feedback_loop_history')
      .select('*')
      .gte('timestamp', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Manual trigger for immediate optimization
   */
  async triggerOptimization(): Promise<any> {
    this.logger.info('Manual optimization triggered');
    return this.runFeedbackLoop();
  }
}

// Export singleton instance
export const feedbackLoopService = FeedbackLoopService.getInstance();