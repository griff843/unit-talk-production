/**
 * A/B Testing Engine for Syndicate-Grade Feature Rollouts
 * 
 * Advanced A/B testing capabilities for:
 * - Grading engine performance comparison (Enhanced 45-factor vs Legacy)
 * - Event-driven vs polling AlertAgent performance
 * - Feature store vs real-time computation efficiency
 * - Statistical significance calculation
 * - Real-time performance monitoring
 * - Automatic rollback on performance degradation
 */

import { createLogger } from '../../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { FeatureFlagService, ABTestGroup } from './FeatureFlagService';

export interface ABTestEvent {
  flagName: string;
  variant: 'control' | 'treatment';
  userId: string;
  eventType: 'conversion' | 'error' | 'performance' | 'engagement' | 'custom';
  eventValue?: number;
  metadata?: Record<string, any>;
  sessionId?: string;
  latencyMs?: number;
  errorOccurred?: boolean;
  errorDetails?: string;
}

export interface ABTestAnalysis {
  flagName: string;
  environment: string;
  
  // Sample sizes
  controlSampleSize: number;
  treatmentSampleSize: number;
  totalSampleSize: number;
  
  // Conversion metrics
  controlConversionRate: number;
  treatmentConversionRate: number;
  conversionLift: number;
  
  // Performance metrics
  controlAvgLatency: number;
  treatmentAvgLatency: number;
  latencyChange: number;
  
  // Error rates
  controlErrorRate: number;
  treatmentErrorRate: number;
  errorRateChange: number;
  
  // Statistical analysis
  statisticalSignificance: number;
  confidenceInterval: [number, number];
  pValue: number;
  testPower: number;
  
  // Test status
  testDuration: number;
  minimumSampleReached: boolean;
  recommendedAction: 'continue' | 'promote_treatment' | 'rollback' | 'extend_test';
  
  // Metadata
  analysisTime: string;
  testStartTime: string;
}

export interface PerformanceComparison {
  flagName: string;
  metric: string;
  
  // Control group metrics
  controlValue: number;
  controlCount: number;
  controlStdDev: number;
  
  // Treatment group metrics
  treatmentValue: number;
  treatmentCount: number;
  treatmentStdDev: number;
  
  // Comparison results
  percentageChange: number;
  absoluteChange: number;
  significancePValue: number;
  significanceLevel: 'high' | 'medium' | 'low' | 'none';
  
  // Thresholds
  threshold: number;
  thresholdDirection: 'improvement' | 'degradation';
  thresholdBreached: boolean;
}

export class ABTestingEngine {
  private logger = createLogger('ABTestingEngine');
  private supabase: SupabaseClient;
  private featureFlagService: FeatureFlagService;
  
  // Statistical thresholds
  private readonly SIGNIFICANCE_THRESHOLD = 0.05; // 95% confidence
  private readonly MINIMUM_SAMPLE_SIZE = 1000;
  private readonly MINIMUM_TEST_DURATION_HOURS = 24;
  private readonly POWER_THRESHOLD = 0.8; // 80% statistical power

  constructor(supabase: SupabaseClient, featureFlagService: FeatureFlagService) {
    this.supabase = supabase;
    this.featureFlagService = featureFlagService;
    this.startContinuousAnalysis();
  }

  /**
   * Track an A/B test event
   */
  async trackEvent(event: ABTestEvent): Promise<void> {
    try {
      await this.supabase
        .from('ab_test_results')
        .insert({
          flag_name: event.flagName,
          variant: event.variant,
          user_id: event.userId,
          event_type: event.eventType,
          event_value: event.eventValue,
          event_metadata: event.metadata || {},
          session_id: event.sessionId,
          latency_ms: event.latencyMs,
          error_occurred: event.errorOccurred || false,
          error_details: event.errorDetails,
          environment: process.env.NODE_ENV || 'development'
        });

      this.logger.debug('A/B test event tracked', {
        flagName: event.flagName,
        variant: event.variant,
        eventType: event.eventType,
        userId: event.userId
      });

    } catch (error) {
      this.logger.error('Failed to track A/B test event', {
        flagName: event.flagName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Analyze A/B test results for a specific flag
   */
  async analyzeTest(flagName: string, options: {
    minHours?: number;
    minSampleSize?: number;
  } = {}): Promise<ABTestAnalysis | null> {
    const {
      minHours = this.MINIMUM_TEST_DURATION_HOURS,
      minSampleSize = this.MINIMUM_SAMPLE_SIZE
    } = options;

    try {
      // Get test data from the last period
      const testStartTime = new Date(Date.now() - (minHours * 60 * 60 * 1000));
      
      const { data: testResults, error } = await this.supabase
        .from('ab_test_results')
        .select('*')
        .eq('flag_name', flagName)
        .gte('timestamp', testStartTime.toISOString())
        .order('timestamp', { ascending: true });

      if (error || !testResults || testResults.length === 0) {
        this.logger.warn('No A/B test data found', { flagName });
        return null;
      }

      // Separate control and treatment groups
      const controlResults = testResults.filter(r => r.variant === 'control');
      const treatmentResults = testResults.filter(r => r.variant === 'treatment');

      if (controlResults.length < minSampleSize || treatmentResults.length < minSampleSize) {
        this.logger.info('Insufficient sample size for analysis', {
          flagName,
          controlSize: controlResults.length,
          treatmentSize: treatmentResults.length,
          minRequired: minSampleSize
        });
        return null;
      }

      // Calculate conversion rates
      const controlConversions = controlResults.filter(r => r.event_type === 'conversion').length;
      const treatmentConversions = treatmentResults.filter(r => r.event_type === 'conversion').length;
      
      const controlConversionRate = controlConversions / controlResults.length;
      const treatmentConversionRate = treatmentConversions / treatmentResults.length;
      const conversionLift = ((treatmentConversionRate - controlConversionRate) / controlConversionRate) * 100;

      // Calculate performance metrics
      const controlLatencies = controlResults
        .filter(r => r.latency_ms !== null)
        .map(r => r.latency_ms as number);
      const treatmentLatencies = treatmentResults
        .filter(r => r.latency_ms !== null)
        .map(r => r.latency_ms as number);

      const controlAvgLatency = this.calculateMean(controlLatencies);
      const treatmentAvgLatency = this.calculateMean(treatmentLatencies);
      const latencyChange = ((treatmentAvgLatency - controlAvgLatency) / controlAvgLatency) * 100;

      // Calculate error rates
      const controlErrors = controlResults.filter(r => r.error_occurred).length;
      const treatmentErrors = treatmentResults.filter(r => r.error_occurred).length;
      
      const controlErrorRate = controlErrors / controlResults.length;
      const treatmentErrorRate = treatmentErrors / treatmentResults.length;
      const errorRateChange = ((treatmentErrorRate - controlErrorRate) / (controlErrorRate || 0.001)) * 100;

      // Statistical significance testing
      const { pValue, confidenceInterval, testPower } = this.calculateStatisticalSignificance(
        controlConversions, controlResults.length,
        treatmentConversions, treatmentResults.length
      );

      const statisticalSignificance = 1 - pValue;
      const isSignificant = pValue < this.SIGNIFICANCE_THRESHOLD;
      
      // Determine recommended action
      const recommendedAction = this.determineRecommendedAction({
        isSignificant,
        conversionLift,
        latencyChange,
        errorRateChange,
        testPower,
        sampleSize: testResults.length
      });

      const analysis: ABTestAnalysis = {
        flagName,
        environment: process.env.NODE_ENV || 'development',
        
        // Sample sizes
        controlSampleSize: controlResults.length,
        treatmentSampleSize: treatmentResults.length,
        totalSampleSize: testResults.length,
        
        // Conversion metrics
        controlConversionRate,
        treatmentConversionRate,
        conversionLift,
        
        // Performance metrics
        controlAvgLatency,
        treatmentAvgLatency,
        latencyChange,
        
        // Error rates
        controlErrorRate,
        treatmentErrorRate,
        errorRateChange,
        
        // Statistical analysis
        statisticalSignificance,
        confidenceInterval,
        pValue,
        testPower,
        
        // Test status
        testDuration: minHours,
        minimumSampleReached: testResults.length >= minSampleSize,
        recommendedAction,
        
        // Metadata
        analysisTime: new Date().toISOString(),
        testStartTime: testStartTime.toISOString()
      };

      this.logger.info('A/B test analysis completed', {
        flagName,
        conversionLift: Math.round(conversionLift * 100) / 100,
        latencyChange: Math.round(latencyChange * 100) / 100,
        pValue: Math.round(pValue * 10000) / 10000,
        recommendedAction
      });

      return analysis;

    } catch (error) {
      this.logger.error('A/B test analysis failed', {
        flagName,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Compare performance metrics between control and treatment groups
   */
  async comparePerformance(flagName: string, metric: string, thresholds: {
    threshold: number;
    direction: 'improvement' | 'degradation';
  }): Promise<PerformanceComparison | null> {
    try {
      const { data: results, error } = await this.supabase
        .from('ab_test_results')
        .select('variant, latency_ms, event_value, error_occurred')
        .eq('flag_name', flagName)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

      if (error || !results) {
        return null;
      }

      const controlData = results.filter(r => r.variant === 'control');
      const treatmentData = results.filter(r => r.variant === 'treatment');

      if (controlData.length === 0 || treatmentData.length === 0) {
        return null;
      }

      // Extract metric values based on metric type
      const controlValues = this.extractMetricValues(controlData, metric);
      const treatmentValues = this.extractMetricValues(treatmentData, metric);

      if (controlValues.length === 0 || treatmentValues.length === 0) {
        return null;
      }

      // Calculate statistics
      const controlMean = this.calculateMean(controlValues);
      const treatmentMean = this.calculateMean(treatmentValues);
      const controlStdDev = this.calculateStandardDeviation(controlValues);
      const treatmentStdDev = this.calculateStandardDeviation(treatmentValues);

      const absoluteChange = treatmentMean - controlMean;
      const percentageChange = ((treatmentMean - controlMean) / controlMean) * 100;

      // Statistical significance test (t-test)
      const significancePValue = this.performTTest(
        controlValues, treatmentValues
      );

      const significanceLevel = this.determineSignificanceLevel(significancePValue);
      
      // Check if threshold is breached
      const thresholdBreached = thresholds.direction === 'improvement' 
        ? percentageChange >= thresholds.threshold
        : percentageChange <= -thresholds.threshold;

      return {
        flagName,
        metric,
        
        // Control group metrics
        controlValue: controlMean,
        controlCount: controlValues.length,
        controlStdDev,
        
        // Treatment group metrics
        treatmentValue: treatmentMean,
        treatmentCount: treatmentValues.length,
        treatmentStdDev,
        
        // Comparison results
        percentageChange,
        absoluteChange,
        significancePValue,
        significanceLevel,
        
        // Thresholds
        threshold: thresholds.threshold,
        thresholdDirection: thresholds.direction,
        thresholdBreached
      };

    } catch (error) {
      this.logger.error('Performance comparison failed', {
        flagName,
        metric,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Automatically check for rollback conditions
   */
  async checkRollbackConditions(flagName: string): Promise<{
    shouldRollback: boolean;
    reasons: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const reasons: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    try {
      // Get recent performance comparison
      const latencyComparison = await this.comparePerformance(flagName, 'latency', {
        threshold: 20, // 20% degradation threshold
        direction: 'degradation'
      });

      const errorComparison = await this.comparePerformance(flagName, 'error_rate', {
        threshold: 50, // 50% increase in error rate
        direction: 'degradation'
      });

      // Check latency degradation
      if (latencyComparison && latencyComparison.thresholdBreached) {
        reasons.push(`Latency degraded by ${Math.round(latencyComparison.percentageChange)}%`);
        severity = 'high';
      }

      // Check error rate increase
      if (errorComparison && errorComparison.thresholdBreached) {
        reasons.push(`Error rate increased by ${Math.round(errorComparison.percentageChange)}%`);
        severity = 'critical';
      }

      // Check for critical system metrics
      const criticalMetrics = await this.checkCriticalMetrics(flagName);
      if (criticalMetrics.length > 0) {
        reasons.push(...criticalMetrics);
        severity = 'critical';
      }

      const shouldRollback = reasons.length > 0;

      if (shouldRollback) {
        this.logger.warn('Rollback conditions detected', {
          flagName,
          reasons,
          severity
        });
      }

      return { shouldRollback, reasons, severity };

    } catch (error) {
      this.logger.error('Failed to check rollback conditions', {
        flagName,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        shouldRollback: false,
        reasons: ['Error checking rollback conditions'],
        severity: 'low'
      };
    }
  }

  /**
   * Generate comprehensive A/B test report
   */
  async generateTestReport(flagName: string): Promise<{
    analysis: ABTestAnalysis | null;
    performanceComparisons: PerformanceComparison[];
    rollbackAssessment: any;
    recommendations: string[];
  }> {
    try {
      const [analysis, rollbackAssessment] = await Promise.all([
        this.analyzeTest(flagName),
        this.checkRollbackConditions(flagName)
      ]);

      // Get performance comparisons for key metrics
      const performanceComparisons = await Promise.all([
        this.comparePerformance(flagName, 'latency', { threshold: 10, direction: 'improvement' }),
        this.comparePerformance(flagName, 'error_rate', { threshold: 25, direction: 'degradation' }),
        this.comparePerformance(flagName, 'throughput', { threshold: 15, direction: 'improvement' })
      ]);

      const validComparisons = performanceComparisons.filter(c => c !== null) as PerformanceComparison[];

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        analysis,
        validComparisons,
        rollbackAssessment
      );

      return {
        analysis,
        performanceComparisons: validComparisons,
        rollbackAssessment,
        recommendations
      };

    } catch (error) {
      this.logger.error('Failed to generate test report', {
        flagName,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        analysis: null,
        performanceComparisons: [],
        rollbackAssessment: { shouldRollback: false, reasons: [], severity: 'low' },
        recommendations: ['Error generating test report']
      };
    }
  }

  // Helper Methods

  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.calculateMean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateStatisticalSignificance(
    controlConversions: number, controlTotal: number,
    treatmentConversions: number, treatmentTotal: number
  ): { pValue: number; confidenceInterval: [number, number]; testPower: number } {
    // Z-test for proportions
    const p1 = controlConversions / controlTotal;
    const p2 = treatmentConversions / treatmentTotal;
    const pooledP = (controlConversions + treatmentConversions) / (controlTotal + treatmentTotal);
    
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1/controlTotal + 1/treatmentTotal));
    const z = (p2 - p1) / se;
    
    // Two-tailed p-value
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));
    
    // Confidence interval for difference in proportions
    const seDiff = Math.sqrt((p1 * (1 - p1) / controlTotal) + (p2 * (1 - p2) / treatmentTotal));
    const criticalValue = 1.96; // 95% confidence
    const diff = p2 - p1;
    const confidenceInterval: [number, number] = [
      diff - criticalValue * seDiff,
      diff + criticalValue * seDiff
    ];
    
    // Simplified power calculation
    const effectSize = Math.abs(p2 - p1) / Math.sqrt(pooledP * (1 - pooledP));
    const testPower = this.calculatePower(effectSize, controlTotal + treatmentTotal);
    
    return { pValue, confidenceInterval, testPower };
  }

  private normalCDF(x: number): number {
    // Approximation of normal CDF
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
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

  private calculatePower(effectSize: number, sampleSize: number): number {
    // Simplified power calculation
    const ncp = effectSize * Math.sqrt(sampleSize / 2);
    return this.normalCDF(ncp - 1.96) + this.normalCDF(-ncp - 1.96);
  }

  private performTTest(sample1: number[], sample2: number[]): number {
    const n1 = sample1.length;
    const n2 = sample2.length;
    
    if (n1 < 2 || n2 < 2) return 1.0; // No significance with small samples
    
    const mean1 = this.calculateMean(sample1);
    const mean2 = this.calculateMean(sample2);
    const var1 = Math.pow(this.calculateStandardDeviation(sample1), 2);
    const var2 = Math.pow(this.calculateStandardDeviation(sample2), 2);
    
    // Welch's t-test (unequal variances)
    const se = Math.sqrt(var1/n1 + var2/n2);
    const t = (mean1 - mean2) / se;
    
    // Degrees of freedom (Welch-Satterthwaite equation)
    const df = Math.pow(var1/n1 + var2/n2, 2) / 
               (Math.pow(var1/n1, 2)/(n1-1) + Math.pow(var2/n2, 2)/(n2-1));
    
    // Simplified p-value calculation (assumes normal distribution for large samples)
    return 2 * (1 - this.normalCDF(Math.abs(t)));
  }

  private extractMetricValues(data: any[], metric: string): number[] {
    switch (metric) {
      case 'latency':
        return data.filter(d => d.latency_ms !== null).map(d => d.latency_ms);
      case 'error_rate':
        return data.map(d => d.error_occurred ? 1 : 0);
      case 'throughput':
      case 'conversion':
        return data.filter(d => d.event_value !== null).map(d => d.event_value);
      default:
        return [];
    }
  }

  private determineSignificanceLevel(pValue: number): 'high' | 'medium' | 'low' | 'none' {
    if (pValue < 0.01) return 'high';
    if (pValue < 0.05) return 'medium';
    if (pValue < 0.1) return 'low';
    return 'none';
  }

  private determineRecommendedAction(params: {
    isSignificant: boolean;
    conversionLift: number;
    latencyChange: number;
    errorRateChange: number;
    testPower: number;
    sampleSize: number;
  }): 'continue' | 'promote_treatment' | 'rollback' | 'extend_test' {
    const { isSignificant, conversionLift, latencyChange, errorRateChange, testPower, sampleSize } = params;
    
    // Critical failure conditions
    if (errorRateChange > 50 || latencyChange > 100) {
      return 'rollback';
    }
    
    // Insufficient power or sample size
    if (testPower < this.POWER_THRESHOLD || sampleSize < this.MINIMUM_SAMPLE_SIZE) {
      return 'extend_test';
    }
    
    // Significant positive results
    if (isSignificant && conversionLift > 5 && latencyChange < 20 && errorRateChange < 25) {
      return 'promote_treatment';
    }
    
    // Significant negative results
    if (isSignificant && (conversionLift < -5 || errorRateChange > 25)) {
      return 'rollback';
    }
    
    return 'continue';
  }

  private async checkCriticalMetrics(flagName: string): Promise<string[]> {
    const issues: string[] = [];
    
    try {
      // Check system-level metrics from the last hour
      const { data: recentEvents, error } = await this.supabase
        .from('ab_test_results')
        .select('*')
        .eq('flag_name', flagName)
        .eq('variant', 'treatment')
        .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

      if (error || !recentEvents) {
        return issues;
      }

      // Check for cascading failures
      const errorRate = recentEvents.filter(e => e.error_occurred).length / recentEvents.length;
      if (errorRate > 0.1) { // 10% error rate threshold
        issues.push(`Critical error rate: ${Math.round(errorRate * 100)}%`);
      }

      // Check for performance outliers
      const latencies = recentEvents
        .filter(e => e.latency_ms !== null)
        .map(e => e.latency_ms);
      
      if (latencies.length > 0) {
        const p99Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)];
        if (p99Latency > 5000) { // 5 second P99 threshold
          issues.push(`Critical P99 latency: ${p99Latency}ms`);
        }
      }

    } catch (error) {
      this.logger.error('Failed to check critical metrics', {
        flagName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    return issues;
  }

  private generateRecommendations(
    analysis: ABTestAnalysis | null,
    comparisons: PerformanceComparison[],
    rollbackAssessment: any
  ): string[] {
    const recommendations: string[] = [];
    
    if (rollbackAssessment.shouldRollback) {
      recommendations.push(`URGENT: Consider immediate rollback due to: ${rollbackAssessment.reasons.join(', ')}`);
    }
    
    if (analysis) {
      if (analysis.recommendedAction === 'promote_treatment') {
        recommendations.push(`Treatment shows significant improvement (${Math.round(analysis.conversionLift)}% lift). Consider promoting to production.`);
      } else if (analysis.recommendedAction === 'extend_test') {
        recommendations.push('Extend test duration to reach statistical significance.');
      }
      
      if (analysis.testPower < this.POWER_THRESHOLD) {
        recommendations.push(`Increase sample size to improve test power (current: ${Math.round(analysis.testPower * 100)}%)`);
      }
    }
    
    for (const comparison of comparisons) {
      if (comparison.thresholdBreached && comparison.thresholdDirection === 'degradation') {
        recommendations.push(`Monitor ${comparison.metric}: showing ${Math.round(comparison.percentageChange)}% degradation`);
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Test is progressing normally. Continue monitoring.');
    }
    
    return recommendations;
  }

  private startContinuousAnalysis(): void {
    // Run analysis every 5 minutes for active tests
    setInterval(async () => {
      await this.runContinuousAnalysis();
    }, 5 * 60 * 1000);
  }

  private async runContinuousAnalysis(): Promise<void> {
    try {
      // Get all active feature flags with A/B tests
      const { data: activeFlags, error } = await this.supabase
        .from('feature_flags')
        .select('flag_name, ab_test_groups')
        .eq('enabled', true)
        .gt('rollout_percentage', 0);

      if (error || !activeFlags) {
        return;
      }

      for (const flag of activeFlags) {
        if (flag.ab_test_groups && Array.isArray(flag.ab_test_groups) && flag.ab_test_groups.length > 0) {
          // Check for rollback conditions
          const rollbackCheck = await this.checkRollbackConditions(flag.flag_name);
          
          if (rollbackCheck.shouldRollback && rollbackCheck.severity === 'critical') {
            this.logger.warn('Auto-triggering emergency rollback', {
              flagName: flag.flag_name,
              reasons: rollbackCheck.reasons
            });
            
            await this.featureFlagService.emergencyRollback(
              flag.flag_name,
              `Automatic rollback triggered: ${rollbackCheck.reasons.join(', ')}`
            );
          }
        }
      }

    } catch (error) {
      this.logger.error('Continuous analysis failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}