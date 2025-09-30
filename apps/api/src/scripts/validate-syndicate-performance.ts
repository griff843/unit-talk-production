/**
 * Syndicate Performance Validation Script
 * Phase 10: Comprehensive validation of syndicate-level performance targets
 *
 * Validates:
 * - 55%+ win rate achievement
 * - 5-8% monthly ROI target
 * - 99.9% system uptime
 * - 1000+ daily props processing
 * - 2000+ props/hour throughput
 */

import { logger } from '../shared/logger';
import { syndicateSystem, ProductionSyndicateConfig } from '../syndicate/SyndicateController';
import { Pool } from 'pg';
import { Redis } from 'ioredis';

interface ValidationResult {
  metric: string;
  target: number;
  actual: number;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string;
}

interface PerformanceReport {
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  validationResults: ValidationResult[];
  summary: {
    passedTests: number;
    failedTests: number;
    warningTests: number;
    totalTests: number;
  };
  recommendations: string[];
  syndicateReadiness: boolean;
}

class SyndicatePerformanceValidator {
  private dbPool: Pool;
  private redis: Redis;

  constructor() {
    this.initializeConnections();
  }

  private async initializeConnections(): Promise<void> {
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      application_name: 'syndicate_validator'
    });

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });
  }

  /**
   * Run comprehensive syndicate performance validation
   */
  public async validateSyndicatePerformance(): Promise<PerformanceReport> {
    logger.info('🎯 Starting Syndicate Performance Validation');

    const validationResults: ValidationResult[] = [];

    // 1. Win Rate Validation
    validationResults.push(await this.validateWinRate());

    // 2. ROI Validation
    validationResults.push(await this.validateMonthlyROI());

    // 3. System Uptime Validation
    validationResults.push(await this.validateSystemUptime());

    // 4. Processing Volume Validation
    validationResults.push(await this.validateProcessingVolume());

    // 5. Throughput Validation
    validationResults.push(await this.validateThroughput());

    // 6. Risk Management Validation
    validationResults.push(await this.validateRiskManagement());

    // 7. Latency Validation
    validationResults.push(await this.validateLatency());

    // 8. Data Quality Validation
    validationResults.push(await this.validateDataQuality());

    // 9. ML Model Performance Validation
    validationResults.push(await this.validateMLPerformance());

    // 10. Business Continuity Validation
    validationResults.push(await this.validateBusinessContinuity());

    // Generate performance report
    const report = this.generatePerformanceReport(validationResults);

    // Log comprehensive results
    this.logValidationResults(report);

    return report;
  }

  /**
   * Validate win rate meets syndicate-level target (55%+)
   */
  private async validateWinRate(): Promise<ValidationResult> {
    const query = `
      SELECT
        COUNT(*) as total_picks,
        SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END)::float / COUNT(*) as win_rate
      FROM syndicate_picks
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND outcome IS NOT NULL
    `;

    try {
      const result = await this.dbPool.query(query);
      const data = result.rows[0];

      const actual = parseFloat(data.win_rate) || 0;
      const target = ProductionSyndicateConfig.performance.targetWinRate;
      const totalPicks = parseInt(data.total_picks) || 0;

      let status: 'PASS' | 'FAIL' | 'WARNING';
      let details: string;

      if (totalPicks < 100) {
        status = 'WARNING';
        details = `Insufficient data: only ${totalPicks} picks in last 30 days`;
      } else if (actual >= target) {
        status = 'PASS';
        details = `Win rate ${(actual * 100).toFixed(1)}% exceeds target ${(target * 100).toFixed(1)}%`;
      } else if (actual >= target * 0.9) {
        status = 'WARNING';
        details = `Win rate ${(actual * 100).toFixed(1)}% below target but within 10%`;
      } else {
        status = 'FAIL';
        details = `Win rate ${(actual * 100).toFixed(1)}% significantly below target ${(target * 100).toFixed(1)}%`;
      }

      return {
        metric: 'Win Rate',
        target: target * 100,
        actual: actual * 100,
        status,
        details
      };

    } catch (error) {
      return {
        metric: 'Win Rate',
        target: ProductionSyndicateConfig.performance.targetWinRate * 100,
        actual: 0,
        status: 'FAIL',
        details: `Validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate monthly ROI meets target (5-8%)
   */
  private async validateMonthlyROI(): Promise<ValidationResult> {
    const query = `
      SELECT
        SUM(CASE WHEN outcome = 'win' THEN roi * stake ELSE -stake END) as total_pnl,
        SUM(stake) as total_volume,
        (SUM(CASE WHEN outcome = 'win' THEN roi * stake ELSE -stake END) / SUM(stake)) as roi
      FROM syndicate_picks
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND outcome IS NOT NULL
    `;

    try {
      const result = await this.dbPool.query(query);
      const data = result.rows[0];

      const actual = parseFloat(data.roi) || 0;
      const target = ProductionSyndicateConfig.performance.targetMonthlyROI;
      const totalVolume = parseFloat(data.total_volume) || 0;

      let status: 'PASS' | 'FAIL' | 'WARNING';
      let details: string;

      if (totalVolume < 10000) {
        status = 'WARNING';
        details = `Insufficient volume: $${totalVolume.toLocaleString()} in last 30 days`;
      } else if (actual >= target) {
        status = 'PASS';
        details = `ROI ${(actual * 100).toFixed(2)}% meets target ${(target * 100).toFixed(2)}%`;
      } else if (actual >= target * 0.8) {
        status = 'WARNING';
        details = `ROI ${(actual * 100).toFixed(2)}% below target but acceptable`;
      } else {
        status = 'FAIL';
        details = `ROI ${(actual * 100).toFixed(2)}% significantly below target ${(target * 100).toFixed(2)}%`;
      }

      return {
        metric: 'Monthly ROI',
        target: target * 100,
        actual: actual * 100,
        status,
        details
      };

    } catch (error) {
      return {
        metric: 'Monthly ROI',
        target: ProductionSyndicateConfig.performance.targetMonthlyROI * 100,
        actual: 0,
        status: 'FAIL',
        details: `Validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate system uptime meets target (99.9%)
   */
  private async validateSystemUptime(): Promise<ValidationResult> {
    try {
      // Check system health metrics
      const healthData = await this.redis.get('syndicate:system_health');
      const health = healthData ? JSON.parse(healthData) : { uptime: 0 };

      const actual = health.uptime || 0;
      const target = ProductionSyndicateConfig.performance.systemUptime;

      let status: 'PASS' | 'FAIL' | 'WARNING';
      let details: string;

      if (actual >= target) {
        status = 'PASS';
        details = `System uptime ${(actual * 100).toFixed(3)}% meets target ${(target * 100).toFixed(3)}%`;
      } else if (actual >= target * 0.99) {
        status = 'WARNING';
        details = `System uptime ${(actual * 100).toFixed(3)}% slightly below target`;
      } else {
        status = 'FAIL';
        details = `System uptime ${(actual * 100).toFixed(3)}% below target ${(target * 100).toFixed(3)}%`;
      }

      return {
        metric: 'System Uptime',
        target: target * 100,
        actual: actual * 100,
        status,
        details
      };

    } catch (error) {
      return {
        metric: 'System Uptime',
        target: ProductionSyndicateConfig.performance.systemUptime * 100,
        actual: 0,
        status: 'FAIL',
        details: `Validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate daily processing volume (1000+ props)
   */
  private async validateProcessingVolume(): Promise<ValidationResult> {
    const query = `
      SELECT
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as daily_props
      FROM syndicate_picks
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date DESC
    `;

    try {
      const result = await this.dbPool.query(query);
      const dailyData = result.rows;

      if (dailyData.length === 0) {
        return {
          metric: 'Daily Processing Volume',
          target: ProductionSyndicateConfig.processing.maxDailyProps,
          actual: 0,
          status: 'FAIL',
          details: 'No processing data available'
        };
      }

      const avgDailyProps = dailyData.reduce((sum, d) => sum + parseInt(d.daily_props), 0) / dailyData.length;
      const target = ProductionSyndicateConfig.processing.maxDailyProps;

      let status: 'PASS' | 'FAIL' | 'WARNING';
      let details: string;

      if (avgDailyProps >= target) {
        status = 'PASS';
        details = `Average daily volume ${Math.round(avgDailyProps)} props meets target ${target}`;
      } else if (avgDailyProps >= target * 0.8) {
        status = 'WARNING';
        details = `Average daily volume ${Math.round(avgDailyProps)} props below target but acceptable`;
      } else {
        status = 'FAIL';
        details = `Average daily volume ${Math.round(avgDailyProps)} props below target ${target}`;
      }

      return {
        metric: 'Daily Processing Volume',
        target,
        actual: Math.round(avgDailyProps),
        status,
        details
      };

    } catch (error) {
      return {
        metric: 'Daily Processing Volume',
        target: ProductionSyndicateConfig.processing.maxDailyProps,
        actual: 0,
        status: 'FAIL',
        details: `Validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate throughput (2000+ props/hour)
   */
  private async validateThroughput(): Promise<ValidationResult> {
    try {
      const throughputData = await this.redis.get('syndicate:throughput_metrics');
      const metrics = throughputData ? JSON.parse(throughputData) : { propsPerHour: 0 };

      const actual = metrics.propsPerHour || 0;
      const target = ProductionSyndicateConfig.processing.processingSpeed;

      let status: 'PASS' | 'FAIL' | 'WARNING';
      let details: string;

      if (actual >= target) {
        status = 'PASS';
        details = `Throughput ${actual} props/hour meets target ${target}`;
      } else if (actual >= target * 0.8) {
        status = 'WARNING';
        details = `Throughput ${actual} props/hour below target but acceptable`;
      } else {
        status = 'FAIL';
        details = `Throughput ${actual} props/hour below target ${target}`;
      }

      return {
        metric: 'Processing Throughput',
        target,
        actual,
        status,
        details
      };

    } catch (error) {
      return {
        metric: 'Processing Throughput',
        target: ProductionSyndicateConfig.processing.processingSpeed,
        actual: 0,
        status: 'FAIL',
        details: `Validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate risk management (max drawdown < 15%)
   */
  private async validateRiskManagement(): Promise<ValidationResult> {
    const query = `
      SELECT
        MAX(ABS(running_drawdown)) as max_drawdown,
        MAX(daily_risk_exposure) as max_exposure
      FROM syndicate_risk_metrics
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `;

    try {
      const result = await this.dbPool.query(query);
      const data = result.rows[0];

      const actual = parseFloat(data.max_drawdown) || 0;
      const target = ProductionSyndicateConfig.performance.maxDrawdown;

      let status: 'PASS' | 'FAIL' | 'WARNING';
      let details: string;

      if (actual <= target) {
        status = 'PASS';
        details = `Max drawdown ${(actual * 100).toFixed(1)}% within target ${(target * 100).toFixed(1)}%`;
      } else if (actual <= target * 1.2) {
        status = 'WARNING';
        details = `Max drawdown ${(actual * 100).toFixed(1)}% slightly exceeds target`;
      } else {
        status = 'FAIL';
        details = `Max drawdown ${(actual * 100).toFixed(1)}% exceeds target ${(target * 100).toFixed(1)}%`;
      }

      return {
        metric: 'Risk Management',
        target: target * 100,
        actual: actual * 100,
        status,
        details
      };

    } catch (error) {
      return {
        metric: 'Risk Management',
        target: ProductionSyndicateConfig.performance.maxDrawdown * 100,
        actual: 0,
        status: 'FAIL',
        details: `Validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate API latency (< 100ms)
   */
  private async validateLatency(): Promise<ValidationResult> {
    try {
      const latencyData = await this.redis.get('syndicate:latency_metrics');
      const metrics = latencyData ? JSON.parse(latencyData) : { avgLatency: 0 };

      const actual = metrics.avgLatency || 0;
      const target = 100; // 100ms target

      let status: 'PASS' | 'FAIL' | 'WARNING';
      let details: string;

      if (actual <= target) {
        status = 'PASS';
        details = `Average latency ${actual}ms meets target ${target}ms`;
      } else if (actual <= target * 1.5) {
        status = 'WARNING';
        details = `Average latency ${actual}ms slightly exceeds target`;
      } else {
        status = 'FAIL';
        details = `Average latency ${actual}ms exceeds target ${target}ms`;
      }

      return {
        metric: 'API Latency',
        target,
        actual,
        status,
        details
      };

    } catch (error) {
      return {
        metric: 'API Latency',
        target: 100,
        actual: 0,
        status: 'FAIL',
        details: `Validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate data quality and freshness
   */
  private async validateDataQuality(): Promise<ValidationResult> {
    const query = `
      SELECT
        COUNT(*) as total_records,
        COUNT(CASE WHEN data_quality_score > 0.95 THEN 1 END) as high_quality_records,
        AVG(data_freshness_minutes) as avg_freshness
      FROM syndicate_data_quality
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `;

    try {
      const result = await this.dbPool.query(query);
      const data = result.rows[0];

      const totalRecords = parseInt(data.total_records) || 0;
      const highQualityRecords = parseInt(data.high_quality_records) || 0;
      const actual = totalRecords > 0 ? (highQualityRecords / totalRecords) : 0;
      const target = 0.95; // 95% data quality target

      let status: 'PASS' | 'FAIL' | 'WARNING';
      let details: string;

      if (totalRecords === 0) {
        status = 'WARNING';
        details = 'No data quality metrics available';
      } else if (actual >= target) {
        status = 'PASS';
        details = `Data quality ${(actual * 100).toFixed(1)}% meets target ${(target * 100).toFixed(1)}%`;
      } else if (actual >= target * 0.9) {
        status = 'WARNING';
        details = `Data quality ${(actual * 100).toFixed(1)}% slightly below target`;
      } else {
        status = 'FAIL';
        details = `Data quality ${(actual * 100).toFixed(1)}% below target ${(target * 100).toFixed(1)}%`;
      }

      return {
        metric: 'Data Quality',
        target: target * 100,
        actual: actual * 100,
        status,
        details
      };

    } catch (error) {
      return {
        metric: 'Data Quality',
        target: 95,
        actual: 0,
        status: 'FAIL',
        details: `Validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate ML model performance
   */
  private async validateMLPerformance(): Promise<ValidationResult> {
    try {
      const mlData = await this.redis.get('syndicate:ml_performance');
      const metrics = mlData ? JSON.parse(mlData) : { accuracy: 0, confidence: 0 };

      const actual = metrics.accuracy || 0;
      const target = 0.567; // Target accuracy based on Phase 4 results

      let status: 'PASS' | 'FAIL' | 'WARNING';
      let details: string;

      if (actual >= target) {
        status = 'PASS';
        details = `ML accuracy ${(actual * 100).toFixed(1)}% meets target ${(target * 100).toFixed(1)}%`;
      } else if (actual >= target * 0.95) {
        status = 'WARNING';
        details = `ML accuracy ${(actual * 100).toFixed(1)}% slightly below target`;
      } else {
        status = 'FAIL';
        details = `ML accuracy ${(actual * 100).toFixed(1)}% below target ${(target * 100).toFixed(1)}%`;
      }

      return {
        metric: 'ML Model Performance',
        target: target * 100,
        actual: actual * 100,
        status,
        details
      };

    } catch (error) {
      return {
        metric: 'ML Model Performance',
        target: 56.7,
        actual: 0,
        status: 'FAIL',
        details: `Validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate business continuity and disaster recovery readiness
   */
  private async validateBusinessContinuity(): Promise<ValidationResult> {
    try {
      const bcData = await this.redis.get('syndicate:business_continuity');
      const metrics = bcData ? JSON.parse(bcData) : { readiness: 0 };

      const actual = metrics.readiness || 0;
      const target = 1.0; // 100% readiness

      let status: 'PASS' | 'FAIL' | 'WARNING';
      let details: string;

      if (actual >= target) {
        status = 'PASS';
        details = `Business continuity readiness ${(actual * 100).toFixed(1)}% meets target`;
      } else if (actual >= 0.9) {
        status = 'WARNING';
        details = `Business continuity readiness ${(actual * 100).toFixed(1)}% mostly prepared`;
      } else {
        status = 'FAIL';
        details = `Business continuity readiness ${(actual * 100).toFixed(1)}% below target`;
      }

      return {
        metric: 'Business Continuity',
        target: target * 100,
        actual: actual * 100,
        status,
        details
      };

    } catch (error) {
      return {
        metric: 'Business Continuity',
        target: 100,
        actual: 0,
        status: 'FAIL',
        details: `Validation failed: ${error.message}`
      };
    }
  }

  /**
   * Generate comprehensive performance report
   */
  private generatePerformanceReport(validationResults: ValidationResult[]): PerformanceReport {
    const passedTests = validationResults.filter(r => r.status === 'PASS').length;
    const failedTests = validationResults.filter(r => r.status === 'FAIL').length;
    const warningTests = validationResults.filter(r => r.status === 'WARNING').length;
    const totalTests = validationResults.length;

    // Determine overall status
    let overallStatus: 'PASS' | 'FAIL' | 'WARNING';
    if (failedTests === 0) {
      overallStatus = warningTests === 0 ? 'PASS' : 'WARNING';
    } else {
      overallStatus = 'FAIL';
    }

    // Determine syndicate readiness
    const syndicateReadiness = failedTests <= 1 && passedTests >= 7;

    // Generate recommendations
    const recommendations = this.generateRecommendations(validationResults);

    return {
      overallStatus,
      validationResults,
      summary: {
        passedTests,
        failedTests,
        warningTests,
        totalTests
      },
      recommendations,
      syndicateReadiness
    };
  }

  /**
   * Generate recommendations based on validation results
   */
  private generateRecommendations(validationResults: ValidationResult[]): string[] {
    const recommendations: string[] = [];

    for (const result of validationResults) {
      if (result.status === 'FAIL') {
        switch (result.metric) {
          case 'Win Rate':
            recommendations.push('Improve ML model accuracy and feature engineering to increase win rate');
            break;
          case 'Monthly ROI':
            recommendations.push('Optimize bet sizing and selection criteria to improve ROI');
            break;
          case 'System Uptime':
            recommendations.push('Implement redundancy and improve infrastructure reliability');
            break;
          case 'Daily Processing Volume':
            recommendations.push('Scale processing infrastructure to handle higher volumes');
            break;
          case 'Processing Throughput':
            recommendations.push('Optimize processing algorithms and add parallel workers');
            break;
          case 'Risk Management':
            recommendations.push('Implement stricter position sizing and risk controls');
            break;
          case 'API Latency':
            recommendations.push('Optimize database queries and implement caching');
            break;
          case 'Data Quality':
            recommendations.push('Improve data validation and cleansing processes');
            break;
          case 'ML Model Performance':
            recommendations.push('Retrain models with additional features and recent data');
            break;
          case 'Business Continuity':
            recommendations.push('Complete disaster recovery testing and documentation');
            break;
        }
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('System performing excellently - maintain current operations and monitoring');
    }

    return recommendations;
  }

  /**
   * Log comprehensive validation results
   */
  private logValidationResults(report: PerformanceReport): void {
    logger.info('🎯 SYNDICATE PERFORMANCE VALIDATION COMPLETE', {
      overallStatus: report.overallStatus,
      syndicateReadiness: report.syndicateReadiness,
      summary: report.summary
    });

    // Log each validation result
    report.validationResults.forEach(result => {
      const emoji = result.status === 'PASS' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';
      logger.info(`${emoji} ${result.metric}: ${result.details}`, {
        target: result.target,
        actual: result.actual,
        status: result.status
      });
    });

    // Log recommendations
    if (report.recommendations.length > 0) {
      logger.info('📋 RECOMMENDATIONS:', {
        recommendations: report.recommendations
      });
    }

    // Final syndicate readiness assessment
    if (report.syndicateReadiness) {
      logger.info('🏆 SYNDICATE SYSTEM READY FOR PRODUCTION DEPLOYMENT', {
        passRate: (report.summary.passedTests / report.summary.totalTests * 100).toFixed(1) + '%'
      });
    } else {
      logger.warn('⚠️ SYNDICATE SYSTEM REQUIRES IMPROVEMENTS BEFORE PRODUCTION', {
        failedTests: report.summary.failedTests,
        warningTests: report.summary.warningTests
      });
    }
  }

  /**
   * Cleanup connections
   */
  public async cleanup(): Promise<void> {
    await this.dbPool.end();
    await this.redis.disconnect();
  }
}

// Execute validation if run directly
if (require.main === module) {
  (async () => {
    const validator = new SyndicatePerformanceValidator();

    try {
      const report = await validator.validateSyndicatePerformance();

      // Exit with appropriate code
      const exitCode = report.overallStatus === 'FAIL' ? 1 : 0;
      process.exit(exitCode);

    } catch (error) {
      logger.error('Validation failed with error', { error: error.message });
      process.exit(1);
    } finally {
      await validator.cleanup();
    }
  })();
}

export { SyndicatePerformanceValidator, PerformanceReport, ValidationResult };