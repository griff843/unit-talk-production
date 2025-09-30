#!/usr/bin/env tsx
/**
 * Steam Detection & Enhanced Injury Analysis Validation Script
 *
 * Validates the newly implemented critical features:
 * 1. Steam Detection Engine with line movement, volume spikes, reverse patterns
 * 2. Enhanced Injury Analysis with prop impact assessment
 *
 * Performance Requirements:
 * - Processing time <2 seconds per operation
 * - BaseAgent pattern compliance
 * - Sharp Grading Rules adherence
 * - Comprehensive logging and monitoring
 *
 * Usage: npx tsx src/scripts/validate-steam-injury-features.ts
 */

import 'dotenv/config';
import { createLogger } from '../utils/logger';
import { AlertAgent } from '../agents/AlertAgent';
import { BaseAgentConfig, BaseAgentDependencies } from '../agents/BaseAgent/types';
import { Metrics } from '../monitoring/metrics';

const logger = createLogger('ValidationScript:SteamInjuryFeatures');

interface ValidationResult {
  feature: string;
  success: boolean;
  processingTimeMs: number;
  errors: string[];
  metrics: Record<string, any>;
}

/**
 * Main validation function
 */
async function validateSteamInjuryFeatures(): Promise<void> {
  logger.info('🚀 Starting Steam Detection & Enhanced Injury Analysis validation...');

  const results: ValidationResult[] = [];

  try {
    // Initialize AlertAgent for testing
    const alertAgent = await initializeAlertAgent();

    // Test 1: Steam Detection Engine
    logger.info('📊 Testing Steam Detection Engine...');
    const steamResult = await validateSteamDetection(alertAgent);
    results.push(steamResult);

    // Test 2: Enhanced Injury Analysis
    logger.info('🏥 Testing Enhanced Injury Analysis...');
    const injuryResult = await validateInjuryAnalysis(alertAgent);
    results.push(injuryResult);

    // Test 3: Performance Requirements
    logger.info('⚡ Validating Performance Requirements...');
    const performanceResult = await validatePerformanceRequirements(results);
    results.push(performanceResult);

    // Test 4: Integration with BaseAgent patterns
    logger.info('🔗 Testing BaseAgent Integration...');
    const integrationResult = await validateBaseAgentIntegration(alertAgent);
    results.push(integrationResult);

    // Generate comprehensive report
    await generateValidationReport(results);

  } catch (error) {
    logger.error('❌ Validation failed with critical error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

/**
 * Initialize AlertAgent for testing
 */
async function initializeAlertAgent(): Promise<AlertAgent> {
  const config: BaseAgentConfig = {
    name: 'AlertAgent-Validation',
    version: '1.0.0',
    enabled: true,
    logLevel: 'info',
    metrics: { enabled: true, interval: 60, endpoint: '/metrics' },
    health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false, endpoint: '/health' },
    retry: { enabled: true, maxRetries: 3, maxAttempts: 3, backoffMs: 200, backoff: 200, maxBackoffMs: 5000, exponential: true, jitter: true }
  };

  const deps: BaseAgentDependencies = {
    logger: createLogger('AlertAgent-Validation')
  };

  const agent = new AlertAgent(config, deps);
  await agent.start();

  logger.info('✅ AlertAgent initialized for validation');
  return agent;
}

/**
 * Validate Steam Detection Engine functionality
 */
async function validateSteamDetection(alertAgent: AlertAgent): Promise<ValidationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const metrics: Record<string, any> = {};

  try {
    // Import the detection functions
    const { detectSteamMovement } = await import('../agents/AlertAgent/activities');

    // Test with realistic parameters
    const testParams = {
      leagues: ['NFL', 'NBA', 'MLB'],
      threshold: 3.0, // >3 points movement
      timeWindow: 60  // 60 minutes
    };

    logger.info('Testing steam detection with parameters', testParams);

    const detections = await detectSteamMovement(testParams);

    // Validate response structure
    if (!Array.isArray(detections)) {
      errors.push('Steam detection should return an array');
    }

    // Validate detection objects structure
    for (const detection of detections) {
      if (!detection.propId || !detection.league || typeof detection.movement !== 'number') {
        errors.push('Invalid detection object structure');
        break;
      }
    }

    metrics.detectionsFound = detections.length;
    metrics.avgMovement = detections.length > 0
      ? detections.reduce((sum, d) => sum + d.movement, 0) / detections.length
      : 0;

    logger.info('Steam detection test completed', {
      detectionsFound: detections.length,
      avgMovement: metrics.avgMovement
    });

  } catch (error) {
    errors.push(`Steam detection error: ${error instanceof Error ? error.message : String(error)}`);
    logger.error('Steam detection test failed', { error });
  }

  const processingTime = Date.now() - startTime;

  return {
    feature: 'Steam Detection Engine',
    success: errors.length === 0,
    processingTimeMs: processingTime,
    errors,
    metrics
  };
}

/**
 * Validate Enhanced Injury Analysis functionality
 */
async function validateInjuryAnalysis(alertAgent: AlertAgent): Promise<ValidationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const metrics: Record<string, any> = {};

  try {
    // Import the analysis functions
    const { detectInjuryImpacts } = await import('../agents/AlertAgent/activities');

    // Test with realistic parameters
    const testParams = {
      leagues: ['NFL', 'NBA', 'MLB', 'NHL'],
      sources: ['ESPN', 'NFL.com', 'NBA.com', 'RotoBaller']
    };

    logger.info('Testing injury analysis with parameters', testParams);

    const impacts = await detectInjuryImpacts(testParams);

    // Validate response structure
    if (!Array.isArray(impacts)) {
      errors.push('Injury analysis should return an array');
    }

    // Validate impact objects structure
    for (const impact of impacts) {
      if (!impact.playerId || !impact.playerName || !impact.league) {
        errors.push('Invalid impact object structure');
        break;
      }

      if (!['minor', 'major', 'season-ending'].includes(impact.severity)) {
        errors.push('Invalid severity classification');
        break;
      }

      if (!Array.isArray(impact.affectedProps)) {
        errors.push('affectedProps should be an array');
        break;
      }
    }

    metrics.impactsFound = impacts.length;
    metrics.severityDistribution = {
      minor: impacts.filter(i => i.severity === 'minor').length,
      major: impacts.filter(i => i.severity === 'major').length,
      seasonEnding: impacts.filter(i => i.severity === 'season-ending').length
    };

    logger.info('Injury analysis test completed', {
      impactsFound: impacts.length,
      severityDistribution: metrics.severityDistribution
    });

  } catch (error) {
    errors.push(`Injury analysis error: ${error instanceof Error ? error.message : String(error)}`);
    logger.error('Injury analysis test failed', { error });
  }

  const processingTime = Date.now() - startTime;

  return {
    feature: 'Enhanced Injury Analysis',
    success: errors.length === 0,
    processingTimeMs: processingTime,
    errors,
    metrics
  };
}

/**
 * Validate performance requirements (<2 seconds)
 */
async function validatePerformanceRequirements(results: ValidationResult[]): Promise<ValidationResult> {
  const errors: string[] = [];
  const metrics: Record<string, any> = {};

  const PERFORMANCE_THRESHOLD_MS = 2000; // 2 seconds

  for (const result of results) {
    if (result.processingTimeMs > PERFORMANCE_THRESHOLD_MS) {
      errors.push(`${result.feature} exceeded performance threshold: ${result.processingTimeMs}ms > ${PERFORMANCE_THRESHOLD_MS}ms`);
    }
  }

  metrics.maxProcessingTime = Math.max(...results.map(r => r.processingTimeMs));
  metrics.avgProcessingTime = results.reduce((sum, r) => sum + r.processingTimeMs, 0) / results.length;
  metrics.performanceThreshold = PERFORMANCE_THRESHOLD_MS;

  logger.info('Performance validation completed', {
    maxProcessingTime: metrics.maxProcessingTime,
    avgProcessingTime: metrics.avgProcessingTime,
    performanceMet: errors.length === 0
  });

  return {
    feature: 'Performance Requirements',
    success: errors.length === 0,
    processingTimeMs: 0,
    errors,
    metrics
  };
}

/**
 * Validate BaseAgent integration patterns
 */
async function validateBaseAgentIntegration(alertAgent: AlertAgent): Promise<ValidationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const metrics: Record<string, any> = {};

  try {
    // Test health check
    const healthStatus = await alertAgent.checkHealth();
    if (!healthStatus || !healthStatus.status) {
      errors.push('AlertAgent health check failed');
    } else {
      metrics.healthStatus = healthStatus.status;
    }

    // Test metrics collection
    const agentMetrics = await alertAgent.collectMetrics();
    if (!agentMetrics || typeof agentMetrics.agentName !== 'string') {
      errors.push('AlertAgent metrics collection failed');
    } else {
      metrics.agentMetrics = {
        agentName: agentMetrics.agentName,
        errorCount: agentMetrics.errorCount,
        successCount: agentMetrics.successCount
      };
    }

    // Test sophisticated metrics if available
    if (typeof alertAgent.getSophisticatedMetrics === 'function') {
      const sophisticatedMetrics = alertAgent.getSophisticatedMetrics();
      metrics.sophisticatedMode = sophisticatedMetrics.isEventDrivenMode;
      metrics.componentStatus = sophisticatedMetrics.componentStatus;
    }

    logger.info('BaseAgent integration validation completed', {
      healthStatus: metrics.healthStatus,
      sophisticatedMode: metrics.sophisticatedMode
    });

  } catch (error) {
    errors.push(`BaseAgent integration error: ${error instanceof Error ? error.message : String(error)}`);
    logger.error('BaseAgent integration test failed', { error });
  }

  const processingTime = Date.now() - startTime;

  return {
    feature: 'BaseAgent Integration',
    success: errors.length === 0,
    processingTimeMs: processingTime,
    errors,
    metrics
  };
}

/**
 * Generate comprehensive validation report
 */
async function generateValidationReport(results: ValidationResult[]): Promise<void> {
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const successfulTests = results.filter(r => r.success).length;
  const totalTests = results.length;

  const report = {
    validationTimestamp: new Date().toISOString(),
    overallStatus: totalErrors === 0 ? 'PASSED' : 'FAILED',
    testsRun: totalTests,
    testsSuccessful: successfulTests,
    testsFailed: totalTests - successfulTests,
    totalErrors: totalErrors,
    maxProcessingTime: Math.max(...results.map(r => r.processingTimeMs)),
    avgProcessingTime: results.reduce((sum, r) => sum + r.processingTimeMs, 0) / results.length,
    results: results.map(r => ({
      feature: r.feature,
      success: r.success,
      processingTimeMs: r.processingTimeMs,
      errors: r.errors,
      metrics: r.metrics
    }))
  };

  logger.info('🎯 VALIDATION REPORT SUMMARY', {
    overallStatus: report.overallStatus,
    testsSuccessful: `${successfulTests}/${totalTests}`,
    totalErrors,
    maxProcessingTime: `${report.maxProcessingTime}ms`,
    avgProcessingTime: `${Math.round(report.avgProcessingTime)}ms`
  });

  // Log detailed results
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    logger.info(`${status} ${result.feature}`, {
      processingTime: `${result.processingTimeMs}ms`,
      errors: result.errors.length,
      metrics: result.metrics
    });

    if (result.errors.length > 0) {
      for (const error of result.errors) {
        logger.error(`  • ${error}`);
      }
    }
  }

  // Overall validation status
  if (report.overallStatus === 'PASSED') {
    logger.info('🎉 VALIDATION SUCCESSFUL - Steam Detection & Enhanced Injury Analysis features are ready for production!');
  } else {
    logger.error('💥 VALIDATION FAILED - Issues detected that must be resolved before production deployment');
    process.exit(1);
  }

  // Update Prometheus metrics
  try {
    const metrics = Metrics.getInstance();
    metrics.setBusinessMetric('feature_validation_success_rate', successfulTests / totalTests);
    metrics.setBusinessMetric('feature_validation_max_processing_time', report.maxProcessingTime);
    metrics.trackOperation('feature_validation', report.overallStatus === 'PASSED' ? 'success' : 'failure');
  } catch (error) {
    logger.warn('Failed to update Prometheus metrics', { error });
  }
}

/**
 * Execute validation
 */
if (require.main === module) {
  validateSteamInjuryFeatures()
    .then(() => {
      logger.info('🏁 Validation script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Validation script failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      process.exit(1);
    });
}

export { validateSteamInjuryFeatures };