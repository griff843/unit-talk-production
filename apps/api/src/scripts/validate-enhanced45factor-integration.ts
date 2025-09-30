/**
 * Enhanced45FactorEngine Integration Validation Script
 *
 * Validates that the Enhanced45FactorEngine is fully compatible with
 * the newly integrated advanced features (Steam Detection, Line Shopping,
 * Enhanced Injury Analysis, Settlement Automation, API Quota Management).
 */

import { createClient } from '@supabase/supabase-js';
import { Enhanced45FactorEngine, Enhanced45FactorResult } from '../agents/ScoringAgent/scoring/Enhanced45FactorEngine';
import { FeatureStoreService } from '../services/FeatureStoreService';
import { FeatureStoreIntegration } from '../agents/ScoringAgent/scoring/FeatureStoreIntegration';
import { MaterialChangeDetector } from '../agents/ScoringAgent/scoring/MaterialChangeDetector';
import { ScoringFeatureSet } from '../types/ScoringFeatureSet';
import { healthChecker } from '../monitoring/enhanced-health-checks';
import { createLogger } from '../utils/logger';
import { requireSupabase } from '../utils/supabaseUtils';

const logger = createLogger('Enhanced45FactorIntegrationValidation');

interface ValidationResult {
  status: 'success' | 'failure' | 'warning';
  message: string;
  details?: any;
}

interface IntegrationValidationReport {
  overall: 'compatible' | 'partial' | 'incompatible';
  steamDetectionCompatibility: ValidationResult;
  lineShoppingCompatibility: ValidationResult;
  injuryAnalysisCompatibility: ValidationResult;
  settlementAutomationCompatibility: ValidationResult;
  apiQuotaCompatibility: ValidationResult;
  healthMonitoringCompatibility: ValidationResult;
  performanceValidation: ValidationResult;
  databaseIntegration: ValidationResult;
  recommendations: string[];
}

async function validateEnhanced45FactorIntegration(): Promise<IntegrationValidationReport> {
  logger.info('🏆 Starting Enhanced45FactorEngine integration validation');

  const report: IntegrationValidationReport = {
    overall: 'compatible',
    steamDetectionCompatibility: { status: 'success', message: '' },
    lineShoppingCompatibility: { status: 'success', message: '' },
    injuryAnalysisCompatibility: { status: 'success', message: '' },
    settlementAutomationCompatibility: { status: 'success', message: '' },
    apiQuotaCompatibility: { status: 'success', message: '' },
    healthMonitoringCompatibility: { status: 'success', message: '' },
    performanceValidation: { status: 'success', message: '' },
    databaseIntegration: { status: 'success', message: '' },
    recommendations: []
  };

  try {
    // Initialize Enhanced45FactorEngine
    const featureStoreService = new FeatureStoreService();
    const featureStoreIntegration = new FeatureStoreIntegration(featureStoreService);
    const materialChangeDetector = new MaterialChangeDetector(featureStoreIntegration);
    const enhanced45Engine = new Enhanced45FactorEngine(featureStoreIntegration, materialChangeDetector);

    logger.info('✅ Enhanced45FactorEngine initialized successfully');

    // 1. Validate Steam Detection Compatibility
    report.steamDetectionCompatibility = await validateSteamDetectionIntegration(enhanced45Engine);

    // 2. Validate Line Shopping Compatibility
    report.lineShoppingCompatibility = await validateLineShoppingIntegration(enhanced45Engine);

    // 3. Validate Injury Analysis Compatibility
    report.injuryAnalysisCompatibility = await validateInjuryAnalysisIntegration(enhanced45Engine);

    // 4. Validate Settlement Automation Compatibility
    report.settlementAutomationCompatibility = await validateSettlementAutomationIntegration(enhanced45Engine);

    // 5. Validate API Quota Compatibility (infrastructure level)
    report.apiQuotaCompatibility = await validateAPIQuotaIntegration();

    // 6. Validate Health Monitoring Compatibility
    report.healthMonitoringCompatibility = await validateHealthMonitoringIntegration();

    // 7. Performance Validation
    report.performanceValidation = await validatePerformanceCompatibility(enhanced45Engine);

    // 8. Database Integration Validation
    report.databaseIntegration = await validateDatabaseIntegration();

    // Determine overall compatibility status
    const validationResults = [
      report.steamDetectionCompatibility,
      report.lineShoppingCompatibility,
      report.injuryAnalysisCompatibility,
      report.settlementAutomationCompatibility,
      report.apiQuotaCompatibility,
      report.healthMonitoringCompatibility,
      report.performanceValidation,
      report.databaseIntegration
    ];

    const failures = validationResults.filter(r => r.status === 'failure').length;
    const warnings = validationResults.filter(r => r.status === 'warning').length;

    if (failures > 0) {
      report.overall = 'incompatible';
      report.recommendations.push('Critical integration issues detected - manual intervention required');
    } else if (warnings > 0) {
      report.overall = 'partial';
      report.recommendations.push('Some integration warnings detected - monitoring recommended');
    } else {
      report.overall = 'compatible';
      report.recommendations.push('All integrations validated successfully');
    }

    // Cleanup
    materialChangeDetector.shutdown();

  } catch (error) {
    logger.error('❌ Enhanced45FactorEngine integration validation failed', error);
    report.overall = 'incompatible';
    report.recommendations.push(`Integration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return report;
}

async function validateSteamDetectionIntegration(enhanced45Engine: Enhanced45FactorEngine): Promise<ValidationResult> {
  try {
    logger.info('🌊 Validating Steam Detection integration');

    // Create test feature set with steam detection factors
    const testFeatureSet = createTestFeatureSet({
      steamMoveDetected: true,
      lineMovementVelocity: 85,
      volumeProfile: 90,
      steamDetection: 88
    });

    // Process through Enhanced45FactorEngine
    const result = await enhanced45Engine.calculate45FactorScore(testFeatureSet);

    // Validate that steam factors are properly processed
    const steamFactors = ['steamDetection', 'lineMovementVelocity', 'volumeProfile'];
    const steamFactorsProcessed = steamFactors.every(factor =>
      result.factorScores[factor] !== undefined && result.factorScores[factor] > 0
    );

    if (!steamFactorsProcessed) {
      return {
        status: 'failure',
        message: 'Steam detection factors not properly processed by Enhanced45FactorEngine',
        details: {
          factorScores: result.factorScores,
          missingFactors: steamFactors.filter(f => !result.factorScores[f])
        }
      };
    }

    // Validate enhanced steam scoring contributes to overall score
    const steamContribution = steamFactors.reduce((sum, factor) =>
      sum + (result.factorScores[factor] || 0), 0
    );

    if (steamContribution < 50) {
      return {
        status: 'warning',
        message: 'Steam detection factors have low contribution to overall score',
        details: { steamContribution, factorScores: result.factorScores }
      };
    }

    return {
      status: 'success',
      message: 'Steam Detection integration validated successfully',
      details: {
        steamContribution,
        totalScore: result.totalScore,
        processingTimeMs: result.processingTimeMs
      }
    };

  } catch (error) {
    return {
      status: 'failure',
      message: 'Steam Detection integration validation failed',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function validateLineShoppingIntegration(enhanced45Engine: Enhanced45FactorEngine): Promise<ValidationResult> {
  try {
    logger.info('🛒 Validating Line Shopping integration');

    // Create test feature set with line shopping factors
    const testFeatureSet = createTestFeatureSet({
      lineShoppingEdge: 12, // 12% edge
      bestAvailableLine: -105,
      crossMarketArbitrage: 75,
      marketEfficiency: 80
    });

    const result = await enhanced45Engine.calculate45FactorScore(testFeatureSet);

    // Validate line shopping factors are processed
    const lineShoppingFactors = ['lineShoppingEdge', 'crossMarketArbitrage', 'marketEfficiency'];
    const lineShoppingProcessed = lineShoppingFactors.every(factor =>
      result.factorScores[factor] !== undefined
    );

    if (!lineShoppingProcessed) {
      return {
        status: 'failure',
        message: 'Line Shopping factors not properly processed',
        details: {
          factorScores: result.factorScores,
          missingFactors: lineShoppingFactors.filter(f => !result.factorScores[f])
        }
      };
    }

    // Validate line shopping edge contributes to pricing
    if (result.factorScores.lineShoppingEdge && result.factorScores.lineShoppingEdge < 70) {
      return {
        status: 'warning',
        message: 'Line shopping edge factor undervalued in scoring',
        details: { lineShoppingEdge: result.factorScores.lineShoppingEdge }
      };
    }

    return {
      status: 'success',
      message: 'Line Shopping integration validated successfully',
      details: {
        lineShoppingContribution: lineShoppingFactors.reduce((sum, f) => sum + (result.factorScores[f] || 0), 0),
        totalScore: result.totalScore
      }
    };

  } catch (error) {
    return {
      status: 'failure',
      message: 'Line Shopping integration validation failed',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function validateInjuryAnalysisIntegration(enhanced45Engine: Enhanced45FactorEngine): Promise<ValidationResult> {
  try {
    logger.info('🏥 Validating Enhanced Injury Analysis integration');

    // Create test feature set with injury factors
    const testFeatureSet = createTestFeatureSet({
      injuryImpact: 85, // High injury impact
      playerForm: 45,   // Reduced due to injury
      fatigueLevel: 70, // Elevated fatigue
      situationalPerformance: 40 // Context-dependent performance hit
    });

    const result = await enhanced45Engine.calculate45FactorScore(testFeatureSet);

    // Validate injury factors are processed
    const injuryFactors = ['injuryImpact', 'playerForm', 'fatigueLevel', 'situationalPerformance'];
    const injuryFactorsProcessed = injuryFactors.every(factor =>
      result.factorScores[factor] !== undefined
    );

    if (!injuryFactorsProcessed) {
      return {
        status: 'failure',
        message: 'Injury Analysis factors not properly processed',
        details: {
          factorScores: result.factorScores,
          missingFactors: injuryFactors.filter(f => !result.factorScores[f])
        }
      };
    }

    // Validate injury impact reduces overall score appropriately
    if (result.totalScore > 80 && testFeatureSet.injuryImpact && testFeatureSet.injuryImpact > 80) {
      return {
        status: 'warning',
        message: 'High injury impact not sufficiently reflected in total score',
        details: {
          totalScore: result.totalScore,
          injuryImpact: testFeatureSet.injuryImpact,
          injuryFactorScore: result.factorScores.injuryImpact
        }
      };
    }

    return {
      status: 'success',
      message: 'Enhanced Injury Analysis integration validated successfully',
      details: {
        injuryContribution: injuryFactors.reduce((sum, f) => sum + (result.factorScores[f] || 0), 0),
        totalScore: result.totalScore,
        injuryAdjustedScore: result.riskAdjustedScore
      }
    };

  } catch (error) {
    return {
      status: 'failure',
      message: 'Enhanced Injury Analysis integration validation failed',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function validateSettlementAutomationIntegration(enhanced45Engine: Enhanced45FactorEngine): Promise<ValidationResult> {
  try {
    logger.info('✅ Validating Settlement Automation integration');

    // Settlement automation doesn't directly affect scoring but should work with all scoring outputs
    const testFeatureSet = createTestFeatureSet({
      expectedValue: 8.5, // 8.5% expected value
      confidence: 88,     // High confidence
      tier: 'A'          // High tier for settlement
    });

    const result = await enhanced45Engine.calculate45FactorScore(testFeatureSet);

    // Validate that scoring produces values compatible with settlement automation
    const hasValidTier = ['S', 'A', 'B', 'C', 'D'].includes(result.tier);
    const hasValidConfidence = result.confidence >= 0 && result.confidence <= 1;
    const hasValidExpectedValue = result.expectedValue !== undefined && result.expectedValue !== null;

    if (!hasValidTier || !hasValidConfidence || !hasValidExpectedValue) {
      return {
        status: 'failure',
        message: 'Scoring output incompatible with settlement automation requirements',
        details: {
          tier: result.tier,
          confidence: result.confidence,
          expectedValue: result.expectedValue,
          hasValidTier,
          hasValidConfidence,
          hasValidExpectedValue
        }
      };
    }

    // Check if high-confidence picks have appropriate tier assignment
    if (result.confidence > 0.85 && !['S', 'A'].includes(result.tier)) {
      return {
        status: 'warning',
        message: 'High-confidence picks not assigned appropriate tier for settlement',
        details: {
          confidence: result.confidence,
          tier: result.tier,
          expectedTier: 'S or A'
        }
      };
    }

    return {
      status: 'success',
      message: 'Settlement Automation integration validated successfully',
      details: {
        tier: result.tier,
        confidence: result.confidence,
        expectedValue: result.expectedValue,
        kellyFraction: result.kellyFraction
      }
    };

  } catch (error) {
    return {
      status: 'failure',
      message: 'Settlement Automation integration validation failed',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function validateAPIQuotaIntegration(): Promise<ValidationResult> {
  try {
    logger.info('📊 Validating API Quota Management integration');

    // API Quota is infrastructure level - validate it doesn't interfere with scoring
    // and that monitoring is available
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    // Check if quota tables are accessible
    const supabaseClient = requireSupabase();
      const { data: configs, error: configError } = await supabase
      .from('api_quota_configs')
      .select('provider, enabled')
      .limit(1);

    if (configError) {
      return {
        status: 'warning',
        message: 'API Quota tables not accessible - quota management may be degraded',
        details: { error: configError.message }
      };
    }

    // Check if quota usage is being tracked
    const supabaseClient = requireSupabase();
      const { data: usage, error: usageError } = await supabase
      .from('api_quota_usage')
      .select('provider, timestamp')
      .order('timestamp', { ascending: false })
      .limit(1);

    if (usageError) {
      return {
        status: 'warning',
        message: 'API Quota usage tracking not working properly',
        details: { error: usageError.message }
      };
    }

    return {
      status: 'success',
      message: 'API Quota Management integration validated successfully',
      details: {
        quotaConfigsAccessible: !!configs,
        usageTrackingActive: !!usage,
        enabledProviders: configs?.filter(c => c.enabled).length || 0
      }
    };

  } catch (error) {
    return {
      status: 'failure',
      message: 'API Quota Management integration validation failed',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function validateHealthMonitoringIntegration(): Promise<ValidationResult> {
  try {
    logger.info('🏥 Validating Health Monitoring integration');

    // Test that advanced features are properly monitored
    const advancedFeaturesHealth = await healthChecker.getAdvancedFeaturesHealth();

    const requiredFeatures = [
      'steam_detection',
      'line_shopping',
      'injury_analysis',
      'api_quota_coordinator',
      'settlement_automation'
    ];

    const missingFeatures = requiredFeatures.filter(feature =>
      !advancedFeaturesHealth.features[feature as keyof typeof advancedFeaturesHealth.features]
    );

    if (missingFeatures.length > 0) {
      return {
        status: 'failure',
        message: 'Advanced features not properly integrated with health monitoring',
        details: {
          missingFeatures,
          availableFeatures: Object.keys(advancedFeaturesHealth.features)
        }
      };
    }

    // Check if critical features are healthy
    const criticalFailures = advancedFeaturesHealth.summary.critical_failures;
    if (criticalFailures > 0) {
      return {
        status: 'warning',
        message: 'Critical failures detected in advanced features health monitoring',
        details: {
          criticalFailures,
          overallStatus: advancedFeaturesHealth.status
        }
      };
    }

    return {
      status: 'success',
      message: 'Health Monitoring integration validated successfully',
      details: {
        overallStatus: advancedFeaturesHealth.status,
        healthyFeatures: advancedFeaturesHealth.summary.healthy_features,
        totalFeatures: advancedFeaturesHealth.summary.total_features
      }
    };

  } catch (error) {
    return {
      status: 'failure',
      message: 'Health Monitoring integration validation failed',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function validatePerformanceCompatibility(enhanced45Engine: Enhanced45FactorEngine): Promise<ValidationResult> {
  try {
    logger.info('⚡ Validating Performance compatibility');

    // Test batch processing performance with new features
    const testFeatureSets = Array.from({ length: 10 }, (_, i) =>
      createTestFeatureSet({
        steamDetection: Math.random() * 100,
        lineShoppingEdge: Math.random() * 20,
        injuryImpact: Math.random() * 100,
        propId: `test-prop-${i}`
      })
    );

    const startTime = Date.now();
    const results = await enhanced45Engine.batchProcess45Factor(testFeatureSets);
    const processingTimeMs = Date.now() - startTime;

    const avgProcessingTime = processingTimeMs / testFeatureSets.length;
    const targetProcessingTime = 50; // 50ms per prop target

    if (avgProcessingTime > targetProcessingTime * 2) {
      return {
        status: 'warning',
        message: 'Performance degradation detected with new advanced features',
        details: {
          avgProcessingTimeMs: avgProcessingTime,
          targetTimeMs: targetProcessingTime,
          totalProcessingTimeMs: processingTimeMs,
          propsProcessed: testFeatureSets.length
        }
      };
    }

    // Validate all props were processed successfully
    if (results.length !== testFeatureSets.length) {
      return {
        status: 'failure',
        message: 'Not all props processed successfully in batch operation',
        details: {
          expectedCount: testFeatureSets.length,
          actualCount: results.length,
          processingTimeMs
        }
      };
    }

    return {
      status: 'success',
      message: 'Performance compatibility validated successfully',
      details: {
        avgProcessingTimeMs: Math.round(avgProcessingTime * 100) / 100,
        totalProcessingTimeMs: processingTimeMs,
        propsProcessed: testFeatureSets.length,
        performanceRating: avgProcessingTime < targetProcessingTime ? 'excellent' : 'good'
      }
    };

  } catch (error) {
    return {
      status: 'failure',
      message: 'Performance compatibility validation failed',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function validateDatabaseIntegration(): Promise<ValidationResult> {
  try {
    logger.info('🗄️ Validating Database integration');

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    // Check if all advanced features tables are accessible
    const advancedTables = [
      'steam_moves',
      'best_odds',
      'injury_impacts',
      'arbitrage_opportunities',
      'api_quota_configs',
      'api_quota_usage'
    ];

    const tableChecks = await Promise.all(
      advancedTables.map(async (table) => {
        try {
          const supabaseClient = requireSupabase();
      const { error } = await supabase
            .from(table)
            .select('id')
            .limit(1);
          return { table, accessible: !error, error: error?.message };
        } catch (e) {
          return { table, accessible: false, error: e instanceof Error ? e.message : 'Unknown error' };
        }
      })
    );

    const inaccessibleTables = tableChecks.filter(check => !check.accessible);

    if (inaccessibleTables.length > 0) {
      return {
        status: 'failure',
        message: 'Some advanced features database tables are not accessible',
        details: {
          inaccessibleTables: inaccessibleTables.map(t => ({ table: t.table, error: t.error })),
          accessibleTables: tableChecks.filter(check => check.accessible).map(t => t.table)
        }
      };
    }

    // Check if Enhanced45FactorEngine can store scoring results with new schema
    const supabaseClient = requireSupabase();
      const { error: rawPropsCheck } = await supabase
      .from('sports_game_odds')
      .select('id, tier, confidence, professional_score, kelly_fraction')
      .limit(1);

    if (rawPropsCheck) {
      return {
        status: 'warning',
        message: 'Scoring result storage schema may have compatibility issues',
        details: { error: rawPropsCheck.message }
      };
    }

    return {
      status: 'success',
      message: 'Database integration validated successfully',
      details: {
        accessibleTables: advancedTables,
        scoringStorageCompatible: true
      }
    };

  } catch (error) {
    return {
      status: 'failure',
      message: 'Database integration validation failed',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

function createTestFeatureSet(overrides: any = {}): ScoringFeatureSet {
  return {
    propId: overrides.propId || 'test-prop-validation',
    date: '2025-09-23',
    sport: 'NFL',
    league: 'NFL',
    player: 'Test Player',
    market: {
      type: 'receiving_yards',
      line: 75.5,
      odds: -110
    },
    expectedValue: overrides.expectedValue || 5.2,
    sharpMoney: 60,
    lineMovement: overrides.lineMovementVelocity || 15,
    matchupRating: 75,
    playerForm: overrides.playerForm || 80,
    marketType: 'receiving_yards',
    odds: -110,
    injuryImpact: overrides.injuryImpact || 20,
    weatherImpact: 5,
    marketIntelligence: 70,
    volumeProfile: overrides.volumeProfile || 65,
    closingLineValue: 3.2,
    playerFatigue: overrides.fatigueLevel || 30,
    venueAdvantage: 10,
    refereeImpact: 5,
    paceImpact: 15,
    motivationalFactors: 25,
    correlationRisk: 0.15,
    volatility: 8,
    portfolioImpact: 0.05,
    bidAskSpread: 0.025,
    timestamp: new Date().toISOString(),
    version: '1.0',
    source: 'validation-test',
    confidence: overrides.confidence || 82,
    dataQuality: {
      completeness: 0.95,
      outlierScore: 0.92,
      consistencyScore: 0.94,
      dataValidationScore: 0.96
    },
    // Advanced feature integration test fields
    steamDetection: overrides.steamDetection,
    lineShoppingEdge: overrides.lineShoppingEdge,
    bestAvailableLine: overrides.bestAvailableLine,
    crossMarketArbitrage: overrides.crossMarketArbitrage,
    marketEfficiency: overrides.marketEfficiency,
    fatigueLevel: overrides.fatigueLevel,
    situationalPerformance: overrides.situationalPerformance,
    tier: overrides.tier
  };
}

// Main execution
async function main() {
  try {
    logger.info('🚀 Starting Enhanced45FactorEngine Integration Validation');

    const report = await validateEnhanced45FactorIntegration();

    // Log detailed results
    logger.info('📊 Integration Validation Report', {
      overall: report.overall,
      steamDetection: report.steamDetectionCompatibility.status,
      lineShopping: report.lineShoppingCompatibility.status,
      injuryAnalysis: report.injuryAnalysisCompatibility.status,
      settlementAutomation: report.settlementAutomationCompatibility.status,
      apiQuota: report.apiQuotaCompatibility.status,
      healthMonitoring: report.healthMonitoringCompatibility.status,
      performance: report.performanceValidation.status,
      database: report.databaseIntegration.status
    });

    // Print human-readable summary
    console.log('\n==============================================');
    console.log('Enhanced45FactorEngine Integration Validation');
    console.log('==============================================\n');

    console.log(`Overall Compatibility: ${report.overall.toUpperCase()}\n`);

    console.log('Component Validations:');
    console.log(`  🌊 Steam Detection:      ${getStatusSymbol(report.steamDetectionCompatibility.status)} ${report.steamDetectionCompatibility.message}`);
    console.log(`  🛒 Line Shopping:        ${getStatusSymbol(report.lineShoppingCompatibility.status)} ${report.lineShoppingCompatibility.message}`);
    console.log(`  🏥 Injury Analysis:      ${getStatusSymbol(report.injuryAnalysisCompatibility.status)} ${report.injuryAnalysisCompatibility.message}`);
    console.log(`  ✅ Settlement Automation: ${getStatusSymbol(report.settlementAutomationCompatibility.status)} ${report.settlementAutomationCompatibility.message}`);
    console.log(`  📊 API Quota Management: ${getStatusSymbol(report.apiQuotaCompatibility.status)} ${report.apiQuotaCompatibility.message}`);
    console.log(`  🏥 Health Monitoring:    ${getStatusSymbol(report.healthMonitoringCompatibility.status)} ${report.healthMonitoringCompatibility.message}`);
    console.log(`  ⚡ Performance:          ${getStatusSymbol(report.performanceValidation.status)} ${report.performanceValidation.message}`);
    console.log(`  🗄️ Database Integration: ${getStatusSymbol(report.databaseIntegration.status)} ${report.databaseIntegration.message}`);

    console.log('\nRecommendations:');
    report.recommendations.forEach(rec => console.log(`  • ${rec}`));

    console.log('\n==============================================\n');

    if (report.overall === 'compatible') {
      logger.info('✅ Enhanced45FactorEngine is fully compatible with all advanced features');
      process.exit(0);
    } else if (report.overall === 'partial') {
      logger.warn('⚠️ Enhanced45FactorEngine has partial compatibility - monitoring recommended');
      process.exit(0);
    } else {
      logger.error('❌ Enhanced45FactorEngine compatibility issues detected');
      process.exit(1);
    }

  } catch (error) {
    logger.error('💥 Integration validation failed with error', error);
    console.error('\n❌ Validation failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

function getStatusSymbol(status: string): string {
  switch (status) {
    case 'success': return '✅';
    case 'warning': return '⚠️';
    case 'failure': return '❌';
    default: return '❓';
  }
}

if (require.main === module) {
  main();
}

export { validateEnhanced45FactorIntegration, IntegrationValidationReport };