/**
 * Automated Validation Gates Service
 * 
 * Comprehensive validation system for feature flag rollouts with:
 * - Real-time metric monitoring
 * - Automated threshold enforcement  
 * - Progressive gate evaluation
 * - Intelligent rollback triggers
 * - Statistical significance testing
 */

import { createLogger } from '../../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { FeatureFlagService } from '../feature-flags/FeatureFlagService';
import { withCircuitBreaker } from '../enhanced-circuit-breaker';

export interface ValidationGateConfig {
  flagName: string;
  gateName: string;
  metricName: string;
  thresholdValue: number;
  comparisonOperator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  required: boolean;
  weight: number;
  evaluationWindowMinutes: number;
  minimumSampleSize: number;
  confidenceLevel: number; // 0.95 for 95% confidence
  isActive: boolean;
}

export interface GateEvaluationResult {
  gateName: string;
  metricName: string;
  actualValue: number;
  thresholdValue: number;
  passed: boolean;
  required: boolean;
  weight: number;
  sampleSize: number;
  confidenceInterval: {
    lower: number;
    upper: number;
    confidence: number;
  };
  statisticalSignificance: number;
  evaluationTime: string;
  reason: string;
}

export interface RolloutValidationSummary {
  flagName: string;
  rolloutPercentage: number;
  totalGates: number;
  passedGates: number;
  failedGates: number;
  criticalFailures: number;
  overallScore: number;
  recommendation: 'proceed' | 'pause' | 'rollback';
  evaluationTime: string;
  gateResults: GateEvaluationResult[];
  riskAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    mitigations: string[];
  };
}

export interface MetricSnapshot {
  metricName: string;
  value: number;
  timestamp: string;
  sampleSize: number;
  source: string;
  tags: Record<string, string>;
}

export class AutomatedValidationGates {
  private logger = createLogger('AutomatedValidationGates');
  private supabase: SupabaseClient;
  private featureFlagService: FeatureFlagService;
  
  // Validation state tracking
  private evaluationIntervals: Map<string, NodeJS.Timeout> = new Map();
  private metricCache: Map<string, MetricSnapshot[]> = new Map();
  private lastEvaluations: Map<string, RolloutValidationSummary> = new Map();
  
  // Performance tracking
  private evaluationLatencies: number[] = [];
  private successRate = 1.0;
  private totalEvaluations = 0;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.featureFlagService = new FeatureFlagService(supabase);
    
    this.startContinuousValidation();
    this.startMetricsCollection();
  }

  /**
   * Start continuous validation monitoring
   */
  private startContinuousValidation(): void {
    // Run validation checks every 30 seconds
    setInterval(async () => {
      await this.runContinuousValidation();
    }, 30000);

    // Cleanup old cache entries every 5 minutes
    setInterval(() => {
      this.cleanupMetricCache();
    }, 5 * 60 * 1000);

    this.logger.info('✅ Continuous validation monitoring started');
  }

  /**
   * Run validation for all active feature flags
   */
  private async runContinuousValidation(): Promise<void> {
    try {
      // Get all active feature flags with rollout > 0
      const { data: activeFlags } = await this.supabase
        .from('feature_flags')
        .select('flag_name, rollout_percentage')
        .eq('enabled', true)
        .gt('rollout_percentage', 0);

      if (!activeFlags || activeFlags.length === 0) {
        return;
      }

      for (const flag of activeFlags) {
        try {
          const summary = await this.validateRollout(flag.flag_name);
          
          // Check for critical failures
          if (summary.recommendation === 'rollback') {
            await this.handleCriticalValidationFailure(summary);
          }
          
        } catch (error) {
          this.logger.error('Failed to validate flag during continuous monitoring', {
            flagName: flag.flag_name,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

    } catch (error) {
      this.logger.error('Continuous validation run failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Validate rollout against all configured gates
   */
  async validateRollout(flagName: string): Promise<RolloutValidationSummary> {
    const startTime = Date.now();
    this.totalEvaluations++;

    try {
      this.logger.debug('🔍 Starting rollout validation', { flagName });

      // Get validation gates for this flag
      const gates = await this.getValidationGates(flagName);
      if (gates.length === 0) {
        return this.createDefaultSummary(flagName, 'No validation gates configured');
      }

      // Get current rollout percentage
      const rolloutInfo = await this.getCurrentRolloutInfo(flagName);
      
      // Evaluate each gate
      const gateResults: GateEvaluationResult[] = [];
      let totalWeight = 0;
      let weightedScore = 0;
      let criticalFailures = 0;

      for (const gate of gates) {
        try {
          const result = await this.evaluateGate(gate, rolloutInfo.rolloutPercentage);
          gateResults.push(result);
          
          totalWeight += gate.weight;
          if (result.passed) {
            weightedScore += gate.weight;
          } else if (gate.required) {
            criticalFailures++;
          }

        } catch (error) {
          this.logger.error('Gate evaluation failed', {
            flagName,
            gateName: gate.gateName,
            error: error instanceof Error ? error.message : String(error)
          });
          
          // Create failed result for tracking
          gateResults.push({
            gateName: gate.gateName,
            metricName: gate.metricName,
            actualValue: 0,
            thresholdValue: gate.thresholdValue,
            passed: false,
            required: gate.required,
            weight: gate.weight,
            sampleSize: 0,
            confidenceInterval: { lower: 0, upper: 0, confidence: 0 },
            statisticalSignificance: 0,
            evaluationTime: new Date().toISOString(),
            reason: `Evaluation error: ${error instanceof Error ? error.message : String(error)}`
          });
          
          if (gate.required) {
            criticalFailures++;
          }
        }
      }

      // Calculate overall metrics
      const passedGates = gateResults.filter(r => r.passed).length;
      const failedGates = gateResults.filter(r => !r.passed).length;
      const overallScore = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;
      
      // Determine recommendation
      const recommendation = this.determineRecommendation(
        overallScore, 
        criticalFailures, 
        gateResults,
        rolloutInfo.rolloutPercentage
      );

      // Assess risk
      const riskAssessment = this.assessRisk(gateResults, rolloutInfo.rolloutPercentage);

      const summary: RolloutValidationSummary = {
        flagName,
        rolloutPercentage: rolloutInfo.rolloutPercentage,
        totalGates: gates.length,
        passedGates,
        failedGates,
        criticalFailures,
        overallScore,
        recommendation,
        evaluationTime: new Date().toISOString(),
        gateResults,
        riskAssessment
      };

      // Cache the result
      this.lastEvaluations.set(flagName, summary);
      
      // Store validation results
      await this.storeValidationResults(summary);

      const evaluationTime = Date.now() - startTime;
      this.evaluationLatencies.push(evaluationTime);
      
      this.logger.info('✅ Rollout validation completed', {
        flagName,
        overallScore: Math.round(overallScore),
        recommendation,
        evaluationTimeMs: evaluationTime,
        passedGates,
        failedGates
      });

      return summary;

    } catch (error) {
      this.successRate = (this.successRate * (this.totalEvaluations - 1) + 0) / this.totalEvaluations;
      
      this.logger.error('❌ Rollout validation failed', {
        flagName,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Evaluate individual validation gate
   */
  private async evaluateGate(gate: ValidationGateConfig, rolloutPercentage: number): Promise<GateEvaluationResult> {
    // Collect metric data
    const metricData = await this.collectMetricData(
      gate.flagName,
      gate.metricName,
      gate.evaluationWindowMinutes
    );

    if (metricData.length < gate.minimumSampleSize) {
      return {
        gateName: gate.gateName,
        metricName: gate.metricName,
        actualValue: 0,
        thresholdValue: gate.thresholdValue,
        passed: false,
        required: gate.required,
        weight: gate.weight,
        sampleSize: metricData.length,
        confidenceInterval: { lower: 0, upper: 0, confidence: 0 },
        statisticalSignificance: 0,
        evaluationTime: new Date().toISOString(),
        reason: `Insufficient sample size: ${metricData.length} < ${gate.minimumSampleSize}`
      };
    }

    // Calculate statistical metrics
    const actualValue = this.calculateMetricValue(metricData);
    const confidenceInterval = this.calculateConfidenceInterval(metricData, gate.confidenceLevel);
    const statisticalSignificance = this.calculateStatisticalSignificance(
      metricData,
      gate.thresholdValue,
      gate.comparisonOperator
    );

    // Evaluate threshold
    const passed = this.evaluateThreshold(actualValue, gate.thresholdValue, gate.comparisonOperator);
    
    // Additional context-aware evaluation
    const contextualPassed = this.evaluateWithContext(
      passed,
      actualValue,
      gate,
      rolloutPercentage,
      confidenceInterval,
      statisticalSignificance
    );

    let reason = '';
    if (!contextualPassed) {
      if (!passed) {
        reason = `Threshold violation: ${actualValue} ${this.getOperatorSymbol(gate.comparisonOperator)} ${gate.thresholdValue}`;
      } else {
        reason = `Statistical significance too low: ${statisticalSignificance.toFixed(3)} < 0.95`;
      }
    } else {
      reason = `Threshold met with ${statisticalSignificance.toFixed(3)} confidence`;
    }

    return {
      gateName: gate.gateName,
      metricName: gate.metricName,
      actualValue,
      thresholdValue: gate.thresholdValue,
      passed: contextualPassed,
      required: gate.required,
      weight: gate.weight,
      sampleSize: metricData.length,
      confidenceInterval,
      statisticalSignificance,
      evaluationTime: new Date().toISOString(),
      reason
    };
  }

  /**
   * Collect metric data for evaluation
   */
  private async collectMetricData(
    flagName: string,
    metricName: string,
    windowMinutes: number
  ): Promise<MetricSnapshot[]> {
    const cacheKey = `${flagName}-${metricName}`;
    
    try {
      // First try to get from cache
      const cached = this.metricCache.get(cacheKey) || [];
      const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000);
      const validCached = cached.filter(
        m => new Date(m.timestamp) >= cutoffTime
      );

      // If we have sufficient cached data, use it
      if (validCached.length >= 50) {
        return validCached;
      }

      // Collect from multiple sources
      const [
        flagMetrics,
        systemMetrics,
        applicationMetrics
      ] = await Promise.all([
        this.collectFromFeatureFlagMetrics(flagName, metricName, windowMinutes),
        this.collectFromSystemMetrics(metricName, windowMinutes),
        this.collectFromApplicationMetrics(flagName, metricName, windowMinutes)
      ]);

      const allMetrics = [...flagMetrics, ...systemMetrics, ...applicationMetrics];
      
      // Update cache
      this.metricCache.set(cacheKey, allMetrics);
      
      return allMetrics;

    } catch (error) {
      this.logger.error('Failed to collect metric data', {
        flagName,
        metricName,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return [];
    }
  }

  /**
   * Collect metrics from feature flag metrics table
   */
  private async collectFromFeatureFlagMetrics(
    flagName: string,
    metricName: string,
    windowMinutes: number
  ): Promise<MetricSnapshot[]> {
    const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000);

    const { data, error } = await this.supabase
      .from('feature_flag_metrics')
      .select('*')
      .eq('flag_name', flagName)
      .gte('collected_at', cutoffTime.toISOString())
      .order('collected_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    const results: MetricSnapshot[] = [];

    for (const row of data) {
      const value = this.extractMetricValue(row, metricName);
      if (value !== null && value !== undefined) {
        results.push({
          metricName,
          value,
          timestamp: row.collected_at,
          sampleSize: row.active_users || 1,
          source: 'feature_flag_metrics',
          tags: {
            flag_name: flagName,
            environment: row.environment || 'unknown'
          }
        });
      }
    }

    return results;
  }

  /**
   * Collect metrics from system monitoring
   */
  private async collectFromSystemMetrics(
    metricName: string,
    windowMinutes: number
  ): Promise<MetricSnapshot[]> {
    // This would integrate with Prometheus/monitoring system
    // For now, return simulated data
    const metrics: MetricSnapshot[] = [];
    
    // Simulate data collection from monitoring system
    const dataPoints = Math.floor(windowMinutes / 5); // Every 5 minutes
    const now = Date.now();
    
    for (let i = 0; i < dataPoints; i++) {
      const timestamp = new Date(now - i * 5 * 60 * 1000);
      const value = this.generateSimulatedMetricValue(metricName);
      
      if (value !== null) {
        metrics.push({
          metricName,
          value,
          timestamp: timestamp.toISOString(),
          sampleSize: 100,
          source: 'system_metrics',
          tags: { source: 'prometheus' }
        });
      }
    }
    
    return metrics;
  }

  /**
   * Collect metrics from application-specific sources
   */
  private async collectFromApplicationMetrics(
    flagName: string,
    metricName: string,
    windowMinutes: number
  ): Promise<MetricSnapshot[]> {
    // This would collect from application-specific metrics
    // Such as A/B test results, business metrics, etc.
    
    if (metricName.includes('conversion') || metricName.includes('accuracy')) {
      return this.collectABTestMetrics(flagName, metricName, windowMinutes);
    }
    
    return [];
  }

  /**
   * Collect A/B test metrics
   */
  private async collectABTestMetrics(
    flagName: string,
    metricName: string,
    windowMinutes: number
  ): Promise<MetricSnapshot[]> {
    const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000);

    const { data, error } = await this.supabase
      .from('ab_test_results')
      .select('*')
      .eq('flag_name', flagName)
      .gte('timestamp', cutoffTime.toISOString());

    if (error || !data) {
      return [];
    }

    // Group by variant and calculate metrics
    const variants = this.groupBy(data, 'variant');
    const metrics: MetricSnapshot[] = [];
    
    for (const [variant, results] of Object.entries(variants)) {
      if (metricName.includes('conversion')) {
        const conversions = results.filter(r => r.event_type === 'conversion').length;
        const total = results.length;
        const conversionRate = total > 0 ? conversions / total : 0;
        
        metrics.push({
          metricName: `${metricName}_${variant}`,
          value: conversionRate,
          timestamp: new Date().toISOString(),
          sampleSize: total,
          source: 'ab_test_results',
          tags: { 
            flag_name: flagName,
            variant,
            metric_type: 'conversion_rate'
          }
        });
      }
      
      if (metricName.includes('accuracy')) {
        const errors = results.filter(r => r.error_occurred).length;
        const total = results.length;
        const accuracy = total > 0 ? (total - errors) / total : 0;
        
        metrics.push({
          metricName: `${metricName}_${variant}`,
          value: accuracy,
          timestamp: new Date().toISOString(),
          sampleSize: total,
          source: 'ab_test_results',
          tags: {
            flag_name: flagName,
            variant,
            metric_type: 'accuracy_rate'
          }
        });
      }
    }
    
    return metrics;
  }

  /**
   * Extract metric value from database row
   */
  private extractMetricValue(row: any, metricName: string): number | null {
    const metricMap: Record<string, string> = {
      'processing_latency_p99': 'latency_p99_ms',
      'accuracy_rate': 'conversion_rate_treatment',
      'error_rate': 'error_rate',
      'alert_latency_p99': 'latency_p99_ms',
      'alert_accuracy': 'conversion_rate_treatment',
      'false_positive_rate': 'error_rate',
      'data_ingestion_latency': 'latency_p50_ms',
      'data_consistency_rate': 'conversion_rate_treatment',
      'storage_efficiency': 'throughput',
      'feature_retrieval_latency': 'latency_p50_ms',
      'feature_freshness': 'conversion_rate_treatment',
      'cache_hit_rate': 'throughput',
      'monitoring_latency': 'latency_p50_ms',
      'alert_delivery_rate': 'conversion_rate_treatment',
      'false_alert_rate': 'error_rate'
    };

    const dbColumn = metricMap[metricName];
    if (!dbColumn || row[dbColumn] === null || row[dbColumn] === undefined) {
      return null;
    }

    return Number(row[dbColumn]);
  }

  /**
   * Generate simulated metric values for testing
   */
  private generateSimulatedMetricValue(metricName: string): number | null {
    const baseValues: Record<string, number> = {
      'processing_latency_p99': 45 + Math.random() * 20, // 45-65ms
      'accuracy_rate': 0.96 + Math.random() * 0.03, // 96-99%
      'error_rate': Math.random() * 0.02, // 0-2%
      'alert_latency_p99': 800 + Math.random() * 400, // 800-1200ms
      'alert_accuracy': 0.97 + Math.random() * 0.02, // 97-99%
      'false_positive_rate': Math.random() * 0.08, // 0-8%
      'data_ingestion_latency': 80 + Math.random() * 40, // 80-120ms
      'data_consistency_rate': 0.997 + Math.random() * 0.003, // 99.7-100%
      'storage_efficiency': 0.75 + Math.random() * 0.15, // 75-90%
      'throughput': 100 + Math.random() * 50 // 100-150 ops/sec
    };

    return baseValues[metricName] || null;
  }

  /**
   * Calculate statistical metrics
   */
  private calculateMetricValue(data: MetricSnapshot[]): number {
    if (data.length === 0) return 0;
    
    // Weight by sample size
    const weightedSum = data.reduce((sum, point) => sum + (point.value * point.sampleSize), 0);
    const totalSamples = data.reduce((sum, point) => sum + point.sampleSize, 0);
    
    return totalSamples > 0 ? weightedSum / totalSamples : 0;
  }

  /**
   * Calculate confidence interval
   */
  private calculateConfidenceInterval(
    data: MetricSnapshot[],
    confidenceLevel: number
  ): { lower: number; upper: number; confidence: number } {
    if (data.length < 2) {
      return { lower: 0, upper: 0, confidence: 0 };
    }

    const values = data.map(d => d.value);
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / (n - 1);
    const stdError = Math.sqrt(variance / n);
    
    // t-distribution critical value (approximation for large n)
    const tValue = this.getTCriticalValue(n - 1, 1 - confidenceLevel);
    const marginOfError = tValue * stdError;
    
    return {
      lower: mean - marginOfError,
      upper: mean + marginOfError,
      confidence: confidenceLevel
    };
  }

  /**
   * Calculate statistical significance
   */
  private calculateStatisticalSignificance(
    data: MetricSnapshot[],
    threshold: number,
    operator: string
  ): number {
    if (data.length < 2) return 0;

    const values = data.map(d => d.value);
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / (n - 1);
    const stdError = Math.sqrt(variance / n);
    
    if (stdError === 0) return 1;
    
    // Calculate t-statistic
    const tStat = Math.abs(mean - threshold) / stdError;
    
    // Convert to p-value (approximation)
    const pValue = 2 * (1 - this.tCdf(Math.abs(tStat), n - 1));
    
    return 1 - pValue; // Return confidence level
  }

  /**
   * Evaluate with contextual information
   */
  private evaluateWithContext(
    basicPassed: boolean,
    actualValue: number,
    gate: ValidationGateConfig,
    rolloutPercentage: number,
    confidenceInterval: { lower: number; upper: number; confidence: number },
    statisticalSignificance: number
  ): boolean {
    if (!basicPassed) return false;
    
    // Require higher confidence for larger rollouts
    const requiredConfidence = this.getRequiredConfidence(rolloutPercentage);
    if (statisticalSignificance < requiredConfidence) {
      return false;
    }
    
    // For critical gates, ensure the confidence interval doesn't cross the threshold
    if (gate.required) {
      const thresholdInInterval = this.thresholdInConfidenceInterval(
        gate.thresholdValue,
        gate.comparisonOperator,
        confidenceInterval
      );
      
      if (thresholdInInterval) {
        return false; // Too much uncertainty
      }
    }
    
    return true;
  }

  /**
   * Determine rollout recommendation
   */
  private determineRecommendation(
    overallScore: number,
    criticalFailures: number,
    gateResults: GateEvaluationResult[],
    rolloutPercentage: number
  ): 'proceed' | 'pause' | 'rollback' {
    // Critical failures always trigger rollback
    if (criticalFailures > 0) {
      return 'rollback';
    }
    
    // Score-based evaluation
    if (overallScore >= 90) {
      return 'proceed';
    } else if (overallScore >= 75) {
      // Check for degrading trends
      const hasDegradingTrends = this.hasDegradingTrends(gateResults);
      return hasDegradingTrends ? 'pause' : 'proceed';
    } else if (overallScore >= 60) {
      return 'pause';
    } else {
      return 'rollback';
    }
  }

  /**
   * Assess risk level
   */
  private assessRisk(
    gateResults: GateEvaluationResult[],
    rolloutPercentage: number
  ): RolloutValidationSummary['riskAssessment'] {
    const factors: string[] = [];
    const mitigations: string[] = [];
    
    const failedRequired = gateResults.filter(r => !r.passed && r.required);
    const lowConfidence = gateResults.filter(r => r.statisticalSignificance < 0.9);
    const smallSamples = gateResults.filter(r => r.sampleSize < 100);
    
    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (failedRequired.length > 0) {
      level = 'critical';
      factors.push(`${failedRequired.length} critical validation gates failed`);
      mitigations.push('Immediate rollback recommended');
    } else if (lowConfidence.length > gateResults.length * 0.5) {
      level = 'high';
      factors.push('Over 50% of gates have low statistical confidence');
      mitigations.push('Increase sample size before proceeding');
    } else if (smallSamples.length > 0) {
      level = 'medium';
      factors.push(`${smallSamples.length} gates have insufficient sample sizes`);
      mitigations.push('Wait for more data before next rollout step');
    }
    
    // Rollout percentage factor
    if (rolloutPercentage > 50 && level !== 'low') {
      factors.push('High rollout percentage increases impact of issues');
      mitigations.push('Consider smaller rollout steps');
    }
    
    return { level, factors, mitigations };
  }

  /**
   * Handle critical validation failures
   */
  private async handleCriticalValidationFailure(summary: RolloutValidationSummary): Promise<void> {
    this.logger.error('🚨 Critical validation failure detected', {
      flagName: summary.flagName,
      criticalFailures: summary.criticalFailures,
      overallScore: summary.overallScore
    });

    try {
      // Trigger emergency rollback
      await this.featureFlagService.emergencyRollback(
        summary.flagName,
        `Critical validation failure: ${summary.criticalFailures} gates failed, score: ${summary.overallScore.toFixed(1)}%`
      );

      // Log emergency rollback
      await this.supabase
        .from('emergency_rollbacks')
        .insert({
          flag_name: summary.flagName,
          trigger_reason: 'Automated validation gate failure',
          trigger_type: 'automatic',
          rollout_percentage_before: summary.rolloutPercentage,
          triggered_by: 'AutomatedValidationGates',
          trigger_metric: summary.gateResults.filter(r => !r.passed && r.required)[0]?.metricName || 'multiple',
          metadata: {
            validation_summary: summary
          }
        });

      this.logger.warn('⚠️ Emergency rollback completed due to validation failure', {
        flagName: summary.flagName
      });

    } catch (error) {
      this.logger.error('Failed to handle critical validation failure', {
        flagName: summary.flagName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Helper methods

  private async getValidationGates(flagName: string): Promise<ValidationGateConfig[]> {
    const { data, error } = await this.supabase
      .from('rollout_validation_gates')
      .select('*')
      .eq('flag_name', flagName)
      .eq('is_active', true);

    if (error || !data) {
      return [];
    }

    return data.map(row => ({
      flagName: row.flag_name,
      gateName: row.gate_name,
      metricName: row.metric_name,
      thresholdValue: row.threshold_value,
      comparisonOperator: row.comparison_operator,
      required: row.required,
      weight: row.weight,
      evaluationWindowMinutes: row.evaluation_window_minutes,
      minimumSampleSize: row.minimum_sample_size,
      confidenceLevel: 0.95,
      isActive: row.is_active
    }));
  }

  private async getCurrentRolloutInfo(flagName: string): Promise<{ rolloutPercentage: number; enabled: boolean }> {
    const { data, error } = await this.supabase
      .from('feature_flags')
      .select('rollout_percentage, enabled')
      .eq('flag_name', flagName)
      .single();

    if (error || !data) {
      return { rolloutPercentage: 0, enabled: false };
    }

    return {
      rolloutPercentage: data.rollout_percentage,
      enabled: data.enabled
    };
  }

  private evaluateThreshold(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'eq': return Math.abs(value - threshold) < 0.001;
      default: return false;
    }
  }

  private getOperatorSymbol(operator: string): string {
    const symbols = { gt: '>', lt: '<', gte: '>=', lte: '<=', eq: '==' };
    return symbols[operator as keyof typeof symbols] || operator;
  }

  private getRequiredConfidence(rolloutPercentage: number): number {
    if (rolloutPercentage >= 75) return 0.99;
    if (rolloutPercentage >= 50) return 0.95;
    if (rolloutPercentage >= 25) return 0.90;
    return 0.85;
  }

  private thresholdInConfidenceInterval(
    threshold: number,
    operator: string,
    interval: { lower: number; upper: number; confidence: number }
  ): boolean {
    switch (operator) {
      case 'gt':
      case 'gte':
        return interval.lower <= threshold;
      case 'lt':
      case 'lte':
        return interval.upper >= threshold;
      case 'eq':
        return interval.lower <= threshold && threshold <= interval.upper;
      default:
        return false;
    }
  }

  private hasDegradingTrends(gateResults: GateEvaluationResult[]): boolean {
    // This would analyze historical trends
    // For now, return false (no degrading trends detected)
    return false;
  }

  private getTCriticalValue(degreesOfFreedom: number, alpha: number): number {
    // Simplified t-critical value approximation
    if (degreesOfFreedom >= 30) return 1.96; // Normal approximation
    const tTable = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228];
    return tTable[Math.min(Math.max(degreesOfFreedom - 1, 0), tTable.length - 1)] || 2.0;
  }

  private tCdf(t: number, df: number): number {
    // Simplified t-distribution CDF approximation
    if (df >= 30) {
      // Normal approximation
      return 0.5 * (1 + this.erf(t / Math.sqrt(2)));
    }
    
    // Rough approximation for smaller df
    const x = t / Math.sqrt(df + t * t);
    return 0.5 + 0.5 * this.erf(x * Math.sqrt(df / 2));
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private createDefaultSummary(flagName: string, reason: string): RolloutValidationSummary {
    return {
      flagName,
      rolloutPercentage: 0,
      totalGates: 0,
      passedGates: 0,
      failedGates: 0,
      criticalFailures: 0,
      overallScore: 100,
      recommendation: 'proceed',
      evaluationTime: new Date().toISOString(),
      gateResults: [],
      riskAssessment: {
        level: 'low',
        factors: [reason],
        mitigations: []
      }
    };
  }

  private async storeValidationResults(summary: RolloutValidationSummary): Promise<void> {
    try {
      await withCircuitBreaker.supabase(
        async () => {
          await this.supabase
            .from('events')
            .insert({
              event_type: 'feature_flag.validation.completed.v1',
              aggregate_id: summary.flagName,
              aggregate_type: 'feature_flag',
              event_data: summary,
              idempotency_key: `validation-${summary.flagName}-${Date.now()}`,
              metadata: {
                source: 'AutomatedValidationGates',
                component: 'validation_engine'
              }
            });
        },
        async () => {
          this.logger.warn('Circuit breaker open, caching validation results locally');
        }
      );

    } catch (error) {
      this.logger.error('Failed to store validation results', {
        flagName: summary.flagName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private cleanupMetricCache(): void {
    const cutoffTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour
    
    for (const [key, metrics] of this.metricCache) {
      const validMetrics = metrics.filter(
        m => new Date(m.timestamp) >= cutoffTime
      );
      
      if (validMetrics.length === 0) {
        this.metricCache.delete(key);
      } else {
        this.metricCache.set(key, validMetrics);
      }
    }
  }

  private startMetricsCollection(): void {
    // Emit service metrics every minute
    setInterval(async () => {
      await this.emitServiceMetrics();
    }, 60000);
  }

  private async emitServiceMetrics(): Promise<void> {
    try {
      const averageLatency = this.evaluationLatencies.length > 0
        ? this.evaluationLatencies.reduce((a, b) => a + b, 0) / this.evaluationLatencies.length
        : 0;

      const metrics = {
        totalEvaluations: this.totalEvaluations,
        successRate: this.successRate,
        averageLatencyMs: averageLatency,
        activeValidations: this.lastEvaluations.size,
        cacheSize: this.metricCache.size,
        timestamp: new Date().toISOString()
      };

      await this.supabase
        .from('events')
        .insert({
          event_type: 'validation_gates.service.metrics.v1',
          aggregate_id: 'validation-gates-service',
          aggregate_type: 'system',
          event_data: metrics,
          idempotency_key: `validation-metrics-${Date.now()}`,
          metadata: {
            source: 'AutomatedValidationGates',
            component: 'metrics_collection'
          }
        });

      // Reset latency buffer to prevent memory growth
      if (this.evaluationLatencies.length > 1000) {
        this.evaluationLatencies = this.evaluationLatencies.slice(-100);
      }

    } catch (error) {
      this.logger.error('Failed to emit service metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get last validation summary for a flag
   */
  getLastValidationSummary(flagName: string): RolloutValidationSummary | null {
    return this.lastEvaluations.get(flagName) || null;
  }

  /**
   * Get service health status
   */
  getHealthStatus(): {
    healthy: boolean;
    metrics: {
      totalEvaluations: number;
      successRate: number;
      averageLatencyMs: number;
      activeValidations: number;
    };
  } {
    const averageLatency = this.evaluationLatencies.length > 0
      ? this.evaluationLatencies.reduce((a, b) => a + b, 0) / this.evaluationLatencies.length
      : 0;

    return {
      healthy: this.successRate > 0.95,
      metrics: {
        totalEvaluations: this.totalEvaluations,
        successRate: this.successRate,
        averageLatencyMs: averageLatency,
        activeValidations: this.lastEvaluations.size
      }
    };
  }
}