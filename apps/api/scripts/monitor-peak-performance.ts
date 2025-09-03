#!/usr/bin/env tsx
// Peak Performance Monitoring Script
// Tracks data ingestion, processing times, and system metrics during peak hours

import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../src/utils/logger';
import { getEnv } from '../src/utils/getEnv';

const env = getEnv();
const logger = createLogger('PeakMonitor');

// Initialize Supabase client
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

interface SystemMetrics {
  timestamp: string;
  data_ingestion_rate: number;
  props_processed: number;
  average_processing_time: number;
  grading_queue_size: number;
  error_rate: number;
  memory_usage?: number;
  cpu_usage?: number;
}

interface PerformanceReport {
  monitoring_period: {
    start: string;
    end: string;
    duration_minutes: number;
  };
  peak_metrics: {
    max_ingestion_rate: number;
    max_processing_time: number;
    total_props_processed: number;
    average_error_rate: number;
  };
  system_health: {
    database_performance: string;
    agent_performance: string;
    temporal_performance: string;
    overall_status: string;
  };
  recommendations: string[];
}

class PeakPerformanceMonitor {
  private isMonitoring = false;
  private metrics: SystemMetrics[] = [];
  private startTime: Date | null = null;
  
  constructor() {
    this.setupGracefulShutdown();
  }

  async startMonitoring(durationMinutes: number = 30): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Monitoring already in progress');
      return;
    }

    this.isMonitoring = true;
    this.startTime = new Date();
    this.metrics = [];

    logger.info(`🚀 Starting peak performance monitoring for ${durationMinutes} minutes`);
    logger.info(`⏰ Monitoring started at: ${this.startTime.toISOString()}`);

    const monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.metrics.push(metrics);
        this.logRealTimeMetrics(metrics);
      } catch (error) {
        logger.error('Error collecting metrics:', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }, 30000); // Collect metrics every 30 seconds

    // Stop monitoring after specified duration
    setTimeout(async () => {
      clearInterval(monitoringInterval);
      await this.stopMonitoring();
    }, durationMinutes * 60 * 1000);
  }

  private async collectMetrics(): Promise<SystemMetrics> {
    const timestamp = new Date().toISOString();
    
    // Query recent data ingestion activity
    const { data: recentProps, error: propsError } = await supabase
      .from('raw_props')
      .select('id, created_at')
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .order('created_at', { ascending: false });

    if (propsError) {
      logger.error('Error querying props:', propsError);
    }

    // Query recent grading activity
    const { data: recentGrades, error: gradesError } = await supabase
      .from('unified_picks')
      .select('id, created_at, processing_time')
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (gradesError) {
      logger.error('Error querying grades:', gradesError);
    }

    // Query agent health status
    const { data: agentHealth, error: healthError } = await supabase
      .from('agent_health')
      .select('agent_name, status, last_activity')
      .gte('last_activity', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (healthError) {
      logger.error('Error querying agent health:', healthError);
    }

    // Calculate metrics
    const propsInLast5Min = recentProps?.length || 0;
    const dataIngestionRate = (propsInLast5Min / 5) * 60; // Props per minute → Props per hour
    
    const processingTimes = recentGrades?.map(g => g.processing_time).filter(Boolean) || [];
    const avgProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
      : 0;

    // Estimate queue size (props without corresponding grades)
    const unprocessedProps = Math.max(0, propsInLast5Min - (recentGrades?.length || 0));

    // Calculate error rate (simplified)
    const healthyAgents = agentHealth?.filter(a => a.status === 'healthy').length || 0;
    const totalAgents = agentHealth?.length || 1;
    const errorRate = ((totalAgents - healthyAgents) / totalAgents) * 100;

    return {
      timestamp,
      data_ingestion_rate: dataIngestionRate,
      props_processed: propsInLast5Min,
      average_processing_time: avgProcessingTime,
      grading_queue_size: unprocessedProps,
      error_rate: errorRate
    };
  }

  private logRealTimeMetrics(metrics: SystemMetrics): void {
    console.log('\n📊 REAL-TIME PERFORMANCE METRICS');
    console.log('================================');
    console.log(`🕐 Timestamp: ${new Date(metrics.timestamp).toLocaleString()}`);
    console.log(`📈 Data Ingestion Rate: ${metrics.data_ingestion_rate.toFixed(0)} props/hour`);
    console.log(`⚡ Props Processed (5min): ${metrics.props_processed}`);
    console.log(`⏱️  Avg Processing Time: ${metrics.average_processing_time.toFixed(2)}ms`);
    console.log(`📋 Grading Queue Size: ${metrics.grading_queue_size}`);
    console.log(`❌ Error Rate: ${metrics.error_rate.toFixed(2)}%`);
    
    // Performance indicators
    if (metrics.data_ingestion_rate < 3600) { // Less than 1 prop per second
      console.log('⚠️  LOW INGESTION RATE - Below expected peak performance');
    }
    
    if (metrics.average_processing_time > 1000) { // More than 1 second
      console.log('⚠️  HIGH PROCESSING TIME - Performance degradation detected');
    }
    
    if (metrics.error_rate > 5) { // More than 5% error rate
      console.log('🚨 HIGH ERROR RATE - System health issues detected');
    }
    
    console.log('================================\n');
  }

  private async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring || !this.startTime) {
      return;
    }

    this.isMonitoring = false;
    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - this.startTime.getTime()) / 60000);

    logger.info(`🏁 Performance monitoring completed after ${durationMinutes} minutes`);
    
    // Generate comprehensive report
    const report = this.generatePerformanceReport(endTime, durationMinutes);
    
    // Log report
    console.log('\n📈 PEAK PERFORMANCE MONITORING REPORT');
    console.log('=====================================');
    console.log(JSON.stringify(report, null, 2));
    
    // Save report to file
    await this.saveReportToFile(report);
    
    logger.info('✅ Performance monitoring report generated and saved');
  }

  private generatePerformanceReport(endTime: Date, durationMinutes: number): PerformanceReport {
    if (!this.startTime || this.metrics.length === 0) {
      throw new Error('No monitoring data available');
    }

    const ingestionRates = this.metrics.map(m => m.data_ingestion_rate);
    const processingTimes = this.metrics.map(m => m.average_processing_time).filter(t => t > 0);
    const errorRates = this.metrics.map(m => m.error_rate);
    
    const totalPropsProcessed = this.metrics.reduce((sum, m) => sum + m.props_processed, 0);
    const maxIngestionRate = Math.max(...ingestionRates);
    const maxProcessingTime = Math.max(...processingTimes);
    const avgErrorRate = errorRates.reduce((sum, rate) => sum + rate, 0) / errorRates.length;

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (maxIngestionRate < 3600) {
      recommendations.push('Consider optimizing data ingestion pipeline - below expected peak rate');
    }
    
    if (maxProcessingTime > 500) {
      recommendations.push('Optimize grading engine performance - processing times exceed 500ms target');
    }
    
    if (avgErrorRate > 2) {
      recommendations.push('Investigate system health issues - error rate above 2% threshold');
    }

    // Determine system health status
    const dbPerformance = maxProcessingTime < 100 ? 'excellent' : 
                         maxProcessingTime < 500 ? 'good' : 'needs_improvement';
    const agentPerformance = avgErrorRate < 1 ? 'excellent' :
                           avgErrorRate < 5 ? 'good' : 'needs_improvement';
    const temporalPerformance = maxIngestionRate > 3600 ? 'excellent' :
                              maxIngestionRate > 1800 ? 'good' : 'needs_improvement';

    return {
      monitoring_period: {
        start: this.startTime.toISOString(),
        end: endTime.toISOString(),
        duration_minutes: durationMinutes
      },
      peak_metrics: {
        max_ingestion_rate: maxIngestionRate,
        max_processing_time: maxProcessingTime,
        total_props_processed: totalPropsProcessed,
        average_error_rate: avgErrorRate
      },
      system_health: {
        database_performance: dbPerformance,
        agent_performance: agentPerformance,
        temporal_performance: temporalPerformance,
        overall_status: [dbPerformance, agentPerformance, temporalPerformance].every(s => s === 'excellent') 
          ? 'excellent' : 'good'
      },
      recommendations
    };
  }

  private async saveReportToFile(report: PerformanceReport): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `peak-performance-report-${timestamp}.json`;
    const filepath = path.join(process.cwd(), 'logs', filename);
    
    try {
      // Ensure logs directory exists
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      
      // Write report to file
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      
      logger.info(`📁 Performance report saved to: ${filepath}`);
    } catch (error) {
      logger.error('Failed to save report to file:', { 
        error: error instanceof Error ? error.message : String(error),
        filepath 
      });
    }
  }

  private setupGracefulShutdown(): void {
    process.on('SIGINT', async () => {
      logger.info('🛑 Received SIGINT, stopping performance monitoring...');
      if (this.isMonitoring) {
        await this.stopMonitoring();
      }
      process.exit(0);
    });
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const durationArg = args.find(arg => arg.startsWith('--duration='));
  const duration = durationArg ? parseInt(durationArg.split('=')[1]) : 30;

  if (duration < 5 || duration > 120) {
    console.error('❌ Duration must be between 5 and 120 minutes');
    process.exit(1);
  }

  const monitor = new PeakPerformanceMonitor();
  
  console.log('🚀 Unit Talk Peak Performance Monitor');
  console.log('====================================');
  console.log(`⏰ Duration: ${duration} minutes`);
  console.log(`📊 Metrics Collection: Every 30 seconds`);
  console.log(`🎯 Targets: >3600 props/hour, <500ms processing, <2% errors`);
  console.log('');

  await monitor.startMonitoring(duration);
}

if (require.main === module) {
  main().catch(error => {
    logger.error('Peak performance monitoring failed:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  });
}

export { PeakPerformanceMonitor };