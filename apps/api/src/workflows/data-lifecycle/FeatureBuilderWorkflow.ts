import { proxyActivities } from '@temporalio/workflow';
import * as wf from '@temporalio/workflow';

// Import activity types for feature computation
interface FeatureBuilderActivities {
  computeRollingFeatures(params: {
    lookbackHours: number;
    batchSize: number;
    features: string[];
  }): Promise<{
    processedProps: number;
    computedFeatures: number;
    errorCount: number;
    duration: number;
  }>;

  computeMarketEfficiencyFeatures(params: {
    timeWindow: number;
    sports: string[];
  }): Promise<{
    marketsAnalyzed: number;
    efficiencyScores: Record<string, number>;
    outliers: Array<{
      prop_id: string;
      efficiency_score: number;
      reason: string;
    }>;
  }>;

  computePlayerFormFeatures(params: {
    lookbackDays: number;
    sports: string[];
  }): Promise<{
    playersAnalyzed: number;
    formScores: Record<string, number>;
    trendsDetected: number;
  }>;

  computeSteamDetectionFeatures(params: {
    timeWindow: number;
    movementThreshold: number;
  }): Promise<{
    steamMovesDetected: number;
    sharpMoneyIndicators: number;
    marketAlerts: Array<{
      prop_id: string;
      movement: number;
      confidence: number;
    }>;
  }>;

  computeCorrelationFeatures(params: {
    correlationWindow: number;
    minCorrelation: number;
  }): Promise<{
    correlationPairs: number;
    strongCorrelations: Array<{
      prop_a: string;
      prop_b: string;
      correlation: number;
    }>;
  }>;

  updateFeatureStore(params: {
    features: Record<string, any>;
    batchSize: number;
  }): Promise<{
    updatedRecords: number;
    errorCount: number;
  }>;

  validateFeatureQuality(params: {
    features: string[];
    qualityThreshold: number;
  }): Promise<{
    validFeatures: string[];
    invalidFeatures: Array<{
      feature: string;
      reason: string;
      quality_score: number;
    }>;
  }>;

  sendFeatureAlert(params: {
    alertType: 'steam' | 'correlation' | 'outlier' | 'quality';
    message: string;
    details: object;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void>;
}

// Configure activities for high-performance feature computation
const activities = proxyActivities<FeatureBuilderActivities>({
  startToCloseTimeout: '15 minutes', // Hourly computation window
  heartbeatTimeout: '2 minutes',     // Frequent heartbeats for monitoring
  scheduleToStartTimeout: '1 minute'  // Fast startup for real-time features
});

/**
 * FeatureBuilderWorkflow - Real-time Feature Computation Engine
 * 
 * Runs hourly to compute 45-factor scoring features including:
 * - Rolling averages and volatility metrics
 * - Market efficiency and steam detection
 * - Player form and correlation analysis
 * - Line movement and sharp money indicators
 * 
 * Optimized for 8K+ simultaneous props with parallel processing
 */
export async function FeatureBuilderWorkflow(params: {
  lookbackHours?: number;
  computeAll?: boolean;
  sports?: string[];
  batchSize?: number;
  features?: string[];
  dryRun?: boolean;
}): Promise<{
  success: boolean;
  featuresComputed: Record<string, number>;
  totalProps: number;
  alerts: Array<{
    type: string;
    message: string;
    count: number;
  }>;
  duration: number;
  errors: string[];
}> {
  
  const startTime = Date.now();
  const workflowId = wf.workflowInfo().workflowId;
  
  // Initialize result tracking
  let result = {
    success: false,
    featuresComputed: {} as Record<string, number>,
    totalProps: 0,
    alerts: [] as Array<{ type: string; message: string; count: number }>,
    duration: 0,
    errors: [] as string[]
  };

  try {
    wf.log.info('🧠 FeatureBuilderWorkflow started', {
      workflowId,
      params,
      scheduledAt: new Date().toISOString()
    });

    // ================================
    // 1. PARAMETER SETUP & VALIDATION
    // ================================
    
    const lookbackHours = params.lookbackHours || 24;
    const computeAll = params.computeAll || true;
    const sports = params.sports || ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAF'];
    const batchSize = params.batchSize || 5000;
    const dryRun = params.dryRun || false;
    
    // 45-factor feature set for professional scoring
    const defaultFeatures = [
      // Rolling averages and trends
      'rolling_avg_7d', 'rolling_avg_30d', 'rolling_std_7d',
      'trend_direction', 'trend_strength', 'momentum_score',
      
      // Market efficiency and steam
      'market_efficiency_score', 'steam_probability', 'sharp_money_indicator',
      'line_movement_velocity', 'odds_movement_magnitude', 'vig_analysis',
      
      // Player and matchup factors
      'player_form_score', 'matchup_advantage', 'venue_impact',
      'fatigue_factor', 'injury_impact', 'role_stability',
      
      // Timing and market context
      'time_decay_factor', 'market_maturity', 'liquidity_score',
      'public_bias_indicator', 'contrarian_opportunity', 'closing_line_prediction',
      
      // Correlation and risk
      'correlation_risk', 'portfolio_impact', 'hedge_opportunity',
      'middle_opportunity', 'arbitrage_potential', 'kelly_fraction',
      
      // Advanced analytics
      'expected_value', 'probability_edge', 'confidence_interval',
      'model_agreement', 'consensus_deviation', 'outlier_score',
      
      // Meta features
      'data_quality_score', 'prediction_stability', 'feature_importance',
      'model_certainty', 'historical_accuracy', 'volatility_adjusted_edge'
    ];
    
    const features = params.features || defaultFeatures;

    wf.log.info('📊 Feature computation parameters validated', {
      lookbackHours,
      sports,
      batchSize,
      featureCount: features.length,
      computeAll,
      dryRun
    });

    // ================================
    // 2. ROLLING FEATURES COMPUTATION
    // ================================
    
    if (computeAll || features.some(f => f.includes('rolling') || f.includes('trend'))) {
      wf.log.info('📈 Computing rolling and trend features');
      
      const rollingResult = await activities.computeRollingFeatures({
        lookbackHours,
        batchSize,
        features: features.filter(f => 
          f.includes('rolling') || f.includes('trend') || f.includes('momentum')
        )
      });

      result.featuresComputed.rolling = rollingResult.processedProps;
      result.totalProps = Math.max(result.totalProps, rollingResult.processedProps);
      
      if (rollingResult.errorCount > 0) {
        result.errors.push(`Rolling features: ${rollingResult.errorCount} computation errors`);
      }

      wf.log.info('✅ Rolling features computed', {
        processedProps: rollingResult.processedProps,
        computedFeatures: rollingResult.computedFeatures,
        errors: rollingResult.errorCount
      });
    }

    // ================================
    // 3. MARKET EFFICIENCY FEATURES
    // ================================
    
    if (computeAll || features.some(f => f.includes('efficiency') || f.includes('market'))) {
      wf.log.info('🎯 Computing market efficiency features');
      
      const efficiencyResult = await activities.computeMarketEfficiencyFeatures({
        timeWindow: lookbackHours,
        sports
      });

      result.featuresComputed.market_efficiency = efficiencyResult.marketsAnalyzed;
      
      // Generate alerts for outliers
      if (efficiencyResult.outliers.length > 0) {
        result.alerts.push({
          type: 'market_outliers',
          message: 'Market efficiency outliers detected',
          count: efficiencyResult.outliers.length
        });

        await activities.sendFeatureAlert({
          alertType: 'outlier',
          message: `${efficiencyResult.outliers.length} market efficiency outliers detected`,
          details: { outliers: efficiencyResult.outliers },
          priority: efficiencyResult.outliers.length > 10 ? 'high' : 'medium'
        });
      }

      wf.log.info('✅ Market efficiency features computed', {
        marketsAnalyzed: efficiencyResult.marketsAnalyzed,
        outliersDetected: efficiencyResult.outliers.length
      });
    }

    // ================================
    // 4. STEAM DETECTION FEATURES
    // ================================
    
    if (computeAll || features.some(f => f.includes('steam') || f.includes('sharp'))) {
      wf.log.info('🌊 Computing steam detection features');
      
      const steamResult = await activities.computeSteamDetectionFeatures({
        timeWindow: 4, // 4-hour window for steam detection
        movementThreshold: 0.5 // Minimum line movement to consider
      });

      result.featuresComputed.steam_detection = steamResult.steamMovesDetected;
      
      // Generate critical alerts for steam moves
      if (steamResult.steamMovesDetected > 0) {
        result.alerts.push({
          type: 'steam_moves',
          message: 'Steam moves detected',
          count: steamResult.steamMovesDetected
        });

        await activities.sendFeatureAlert({
          alertType: 'steam',
          message: `${steamResult.steamMovesDetected} steam moves detected`,
          details: { alerts: steamResult.marketAlerts },
          priority: 'critical'
        });
      }

      wf.log.info('✅ Steam detection features computed', {
        steamMoves: steamResult.steamMovesDetected,
        sharpIndicators: steamResult.sharpMoneyIndicators,
        alerts: steamResult.marketAlerts.length
      });
    }

    // ================================
    // 5. PLAYER FORM FEATURES
    // ================================
    
    if (computeAll || features.some(f => f.includes('player') || f.includes('form'))) {
      wf.log.info('👤 Computing player form features');
      
      const formResult = await activities.computePlayerFormFeatures({
        lookbackDays: Math.ceil(lookbackHours / 24),
        sports
      });

      result.featuresComputed.player_form = formResult.playersAnalyzed;
      
      wf.log.info('✅ Player form features computed', {
        playersAnalyzed: formResult.playersAnalyzed,
        trendsDetected: formResult.trendsDetected
      });
    }

    // ================================
    // 6. CORRELATION ANALYSIS
    // ================================
    
    if (computeAll || features.some(f => f.includes('correlation') || f.includes('risk'))) {
      wf.log.info('🔗 Computing correlation features');
      
      const correlationResult = await activities.computeCorrelationFeatures({
        correlationWindow: lookbackHours,
        minCorrelation: 0.7 // Strong correlations only
      });

      result.featuresComputed.correlations = correlationResult.correlationPairs;
      
      // Alert on strong correlations for risk management
      if (correlationResult.strongCorrelations.length > 0) {
        result.alerts.push({
          type: 'strong_correlations',
          message: 'Strong prop correlations detected',
          count: correlationResult.strongCorrelations.length
        });

        await activities.sendFeatureAlert({
          alertType: 'correlation',
          message: `${correlationResult.strongCorrelations.length} strong correlations detected`,
          details: { correlations: correlationResult.strongCorrelations },
          priority: 'high'
        });
      }

      wf.log.info('✅ Correlation features computed', {
        pairs: correlationResult.correlationPairs,
        strongCorrelations: correlationResult.strongCorrelations.length
      });
    }

    // ================================
    // 7. UPDATE FEATURE STORE
    // ================================
    
    if (!dryRun) {
      wf.log.info('💾 Updating feature store');
      
      const updateResult = await activities.updateFeatureStore({
        features: result.featuresComputed,
        batchSize
      });

      if (updateResult.errorCount > 0) {
        result.errors.push(`Feature store update: ${updateResult.errorCount} errors`);
      }

      wf.log.info('✅ Feature store updated', {
        updatedRecords: updateResult.updatedRecords,
        errors: updateResult.errorCount
      });
    }

    // ================================
    // 8. FEATURE QUALITY VALIDATION
    // ================================
    
    wf.log.info('🔍 Validating feature quality');
    
    const validationResult = await activities.validateFeatureQuality({
      features,
      qualityThreshold: 0.90 // 90% quality threshold
    });

    if (validationResult.invalidFeatures.length > 0) {
      result.errors.push(`Quality validation: ${validationResult.invalidFeatures.length} features below threshold`);
      
      await activities.sendFeatureAlert({
        alertType: 'quality',
        message: `${validationResult.invalidFeatures.length} features failed quality validation`,
        details: { invalidFeatures: validationResult.invalidFeatures },
        priority: 'medium'
      });
    }

    wf.log.info('✅ Feature quality validation completed', {
      validFeatures: validationResult.validFeatures.length,
      invalidFeatures: validationResult.invalidFeatures.length
    });

    // ================================
    // 9. SUCCESS COMPLETION
    // ================================
    
    result.success = result.errors.length === 0;
    result.duration = Date.now() - startTime;
    
    wf.log.info('🎉 FeatureBuilderWorkflow completed', {
      workflowId,
      success: result.success,
      totalProps: result.totalProps,
      featuresComputed: Object.keys(result.featuresComputed).length,
      alerts: result.alerts.length,
      duration: result.duration,
      dryRun
    });

    return result;

  } catch (error) {
    // ================================
    // ERROR HANDLING
    // ================================
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    result.duration = Date.now() - startTime;
    
    wf.log.error('❌ FeatureBuilderWorkflow failed', {
      workflowId,
      error: errorMessage,
      duration: result.duration,
      params
    });

    await activities.sendFeatureAlert({
      alertType: 'quality',
      message: 'Feature computation workflow failed',
      details: {
        workflowId,
        error: errorMessage,
        duration: result.duration,
        params
      },
      priority: 'critical'
    });
    
    return result;
  }
}

/**
 * Scheduled FeatureBuilderWorkflow - Runs hourly for real-time features
 * 
 * Optimized for continuous feature computation supporting:
 * - Real-time prop scoring and alerts
 * - Material change detection  
 * - Steam move identification
 * - Risk management signals
 */
export async function ScheduledFeatureBuilderWorkflow(): Promise<void> {
  wf.log.info('⏰ Scheduled FeatureBuilderWorkflow triggered hourly');
  
  try {
    const result = await FeatureBuilderWorkflow({
      lookbackHours: 24, // Standard lookback for hourly runs
      computeAll: true,  // Compute all 45 factors
      batchSize: 5000,   // Optimal batch size for hourly processing
      dryRun: false      // Real feature computation
    });

    if (!result.success) {
      throw new Error(`Scheduled feature computation failed: ${result.errors.join(', ')}`);
    }

    wf.log.info('✅ Scheduled FeatureBuilderWorkflow completed', {
      totalProps: result.totalProps,
      featuresComputed: Object.keys(result.featuresComputed).length,
      alerts: result.alerts.length,
      duration: result.duration
    });

  } catch (error) {
    wf.log.error('❌ Scheduled FeatureBuilderWorkflow failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    throw error; // Trigger Temporal retry
  }
}

/**
 * Express FeatureBuilderWorkflow - Triggered by material changes
 * 
 * Fast computation for time-critical scenarios:
 * - Steam moves requiring immediate analysis
 * - Line movements exceeding thresholds
 * - Breaking news impact assessment
 */
export async function ExpressFeatureBuilderWorkflow(params: {
  propIds: string[];
  priority: 'normal' | 'high' | 'critical';
  features: string[];
}): Promise<void> {
  wf.log.info('⚡ Express FeatureBuilderWorkflow triggered', {
    propIds: params.propIds.length,
    priority: params.priority
  });

  try {
    const result = await FeatureBuilderWorkflow({
      lookbackHours: 4, // Shorter lookback for speed
      computeAll: false, // Only compute specified features
      features: params.features,
      batchSize: 1000,  // Smaller batches for speed
      dryRun: false
    });

    if (!result.success && params.priority === 'critical') {
      throw new Error(`Critical express feature computation failed: ${result.errors.join(', ')}`);
    }

  } catch (error) {
    wf.log.error('❌ Express FeatureBuilderWorkflow failed', {
      error: error instanceof Error ? error.message : String(error),
      priority: params.priority
    });
    
    if (params.priority === 'critical') {
      throw error;
    }
  }
}