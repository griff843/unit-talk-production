#!/usr/bin/env node

/**
 * 48-72 Hour Shadow Mode Soak Test
 * 
 * Runs continuous validation in shadow mode to ensure:
 * - No data corruption
 * - No memory leaks
 * - Stable performance
 * - Consistent results
 * - No Discord publications
 */

import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

// Configuration
const SOAK_DURATION_HOURS = parseInt(process.env.SOAK_DURATION || '48');
const CHECK_INTERVAL_MINUTES = parseInt(process.env.CHECK_INTERVAL || '15');
const RESULTS_DIR = './soak-results';
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK_URL;

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Types
interface SoakMetrics {
  timestamp: Date;
  duration_hours: number;
  memory_usage: NodeJS.MemoryUsage;
  cpu_usage: NodeJS.CpuUsage;
  active_connections: number;
  error_count: number;
  warning_count: number;
  processed_items: {
    feeds: number;
    grades: number;
    promotions: number;
    alerts: number;
    recaps: number;
  };
  performance: {
    api_response_p50: number;
    api_response_p95: number;
    api_response_p99: number;
    db_query_p50: number;
    db_query_p95: number;
    db_query_p99: number;
  };
  consistency: {
    data_integrity: boolean;
    shadow_mode_active: boolean;
    discord_publications: number;
    unexpected_writes: number;
  };
}

interface HealthCheck {
  service: string;
  healthy: boolean;
  response_time: number;
  error?: string;
}

class ShadowSoakTest extends EventEmitter {
  private startTime: Date;
  private metrics: SoakMetrics[] = [];
  private errors: any[] = [];
  private warnings: any[] = [];
  private checkInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor() {
    super();
    this.startTime = new Date();
  }

  async start(): Promise<void> {
    console.log(`🚀 Starting ${SOAK_DURATION_HOURS}-hour shadow mode soak test`);
    console.log(`⏱️  Check interval: ${CHECK_INTERVAL_MINUTES} minutes`);
    
    this.isRunning = true;

    // Ensure shadow mode is active
    await this.enableShadowMode();

    // Create results directory
    await fs.mkdir(RESULTS_DIR, { recursive: true });

    // Start monitoring
    this.checkInterval = setInterval(
      () => this.performCheck(),
      CHECK_INTERVAL_MINUTES * 60 * 1000
    );

    // Perform initial check
    await this.performCheck();

    // Set termination timer
    setTimeout(
      () => this.stop(),
      SOAK_DURATION_HOURS * 60 * 60 * 1000
    );

    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  private async enableShadowMode(): Promise<void> {
    console.log('🔒 Ensuring shadow mode is active...');
    
    const { error } = await supabase
      .from('system_config')
      .upsert({
        key: 'global_settings',
        safe_mode: false,
        shadow_mode: true,
        shadow_mode_reason: 'Soak testing',
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to enable shadow mode: ${error.message}`);
    }

    // Verify shadow mode via API
    const response = await fetch(`${process.env.API_URL}/api/health/mode`);
    const data = await response.json();
    
    if (!data.shadow_mode) {
      throw new Error('Shadow mode verification failed');
    }

    console.log('✅ Shadow mode active');
  }

  private async performCheck(): Promise<void> {
    const checkStart = Date.now();
    console.log(`\n🔍 Performing check #${this.metrics.length + 1}...`);

    try {
      const metrics: SoakMetrics = {
        timestamp: new Date(),
        duration_hours: (Date.now() - this.startTime.getTime()) / (1000 * 60 * 60),
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage(),
        active_connections: await this.getActiveConnections(),
        error_count: this.errors.length,
        warning_count: this.warnings.length,
        processed_items: await this.getProcessedItems(),
        performance: await this.getPerformanceMetrics(),
        consistency: await this.getConsistencyMetrics()
      };

      // Check for issues
      await this.validateMetrics(metrics);

      // Store metrics
      this.metrics.push(metrics);
      await this.saveMetrics(metrics);

      // Log summary
      this.logSummary(metrics);

      console.log(`✅ Check completed in ${Date.now() - checkStart}ms`);
    } catch (error) {
      console.error('❌ Check failed:', error);
      this.errors.push({
        timestamp: new Date(),
        type: 'check_failure',
        error: error instanceof Error ? error.message : error
      });
    }
  }

  private async getActiveConnections(): Promise<number> {
    const { count } = await supabase
      .from('pg_stat_activity')
      .select('*', { count: 'exact', head: true })
      .eq('datname', 'postgres');
    
    return count || 0;
  }

  private async getProcessedItems(): Promise<SoakMetrics['processed_items']> {
    const now = new Date();
    const checkWindow = new Date(now.getTime() - CHECK_INTERVAL_MINUTES * 60 * 1000);

    const [feeds, grades, promotions, alerts, recaps] = await Promise.all([
      supabase
        .from('raw_props')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', checkWindow.toISOString()),
      
      supabase
        .from('grading_results')
        .select('*', { count: 'exact', head: true })
        .gte('graded_at', checkWindow.toISOString()),
      
      supabase
        .from('final_picks')
        .select('*', { count: 'exact', head: true })
        .gte('promoted_at', checkWindow.toISOString()),
      
      supabase
        .from('alert_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', checkWindow.toISOString()),
      
      supabase
        .from('recap_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', checkWindow.toISOString())
    ]);

    return {
      feeds: feeds.count || 0,
      grades: grades.count || 0,
      promotions: promotions.count || 0,
      alerts: alerts.count || 0,
      recaps: recaps.count || 0
    };
  }

  private async getPerformanceMetrics(): Promise<SoakMetrics['performance']> {
    // Query performance logs for percentiles
    const { data: apiMetrics } = await supabase
      .rpc('calculate_percentiles', {
        table_name: 'api_performance_logs',
        column_name: 'response_time',
        time_window: CHECK_INTERVAL_MINUTES
      });

    const { data: dbMetrics } = await supabase
      .rpc('calculate_percentiles', {
        table_name: 'db_performance_logs',
        column_name: 'query_time',
        time_window: CHECK_INTERVAL_MINUTES
      });

    return {
      api_response_p50: apiMetrics?.p50 || 0,
      api_response_p95: apiMetrics?.p95 || 0,
      api_response_p99: apiMetrics?.p99 || 0,
      db_query_p50: dbMetrics?.p50 || 0,
      db_query_p95: dbMetrics?.p95 || 0,
      db_query_p99: dbMetrics?.p99 || 0
    };
  }

  private async getConsistencyMetrics(): Promise<SoakMetrics['consistency']> {
    // Check shadow mode is still active
    const { data: config } = await supabase
      .from('system_config')
      .select('*')
      .eq('key', 'global_settings')
      .single();

    // Check for any Discord publications (should be 0 in shadow mode)
    const { count: discordCount } = await supabase
      .from('discord_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - CHECK_INTERVAL_MINUTES * 60 * 1000).toISOString());

    // Check for unexpected database writes
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', 'INSERT')
      .in('table_name', ['discord_messages', 'production_picks'])
      .gte('created_at', new Date(Date.now() - CHECK_INTERVAL_MINUTES * 60 * 1000).toISOString());

    // Validate data integrity
    const integrityCheck = await this.validateDataIntegrity();

    return {
      data_integrity: integrityCheck,
      shadow_mode_active: config?.shadow_mode === true,
      discord_publications: discordCount || 0,
      unexpected_writes: auditLogs?.length || 0
    };
  }

  private async validateDataIntegrity(): Promise<boolean> {
    try {
      // Check referential integrity
      const { data: orphans } = await supabase
        .rpc('check_orphaned_records');

      // Check for duplicate keys
      const { data: duplicates } = await supabase
        .rpc('check_duplicate_keys');

      // Check sequence continuity
      const { data: sequences } = await supabase
        .rpc('check_sequence_gaps');

      return !orphans?.length && !duplicates?.length && !sequences?.length;
    } catch (error) {
      console.error('Data integrity check failed:', error);
      return false;
    }
  }

  private async validateMetrics(metrics: SoakMetrics): Promise<void> {
    const issues: string[] = [];

    // Memory leak detection (>1GB growth per hour)
    const memoryGrowthRate = metrics.memory_usage.heapUsed / (metrics.duration_hours * 1024 * 1024 * 1024);
    if (memoryGrowthRate > 1) {
      issues.push(`Memory leak detected: ${memoryGrowthRate.toFixed(2)}GB/hour growth`);
    }

    // Performance degradation (>20% increase in p95)
    if (this.metrics.length > 0) {
      const lastMetrics = this.metrics[this.metrics.length - 1];
      const p95Increase = (metrics.performance.api_response_p95 - lastMetrics.performance.api_response_p95) 
        / lastMetrics.performance.api_response_p95;
      
      if (p95Increase > 0.2) {
        issues.push(`Performance degradation: ${(p95Increase * 100).toFixed(1)}% increase in p95`);
      }
    }

    // Shadow mode violation
    if (!metrics.consistency.shadow_mode_active) {
      issues.push('CRITICAL: Shadow mode is not active!');
    }

    if (metrics.consistency.discord_publications > 0) {
      issues.push(`CRITICAL: ${metrics.consistency.discord_publications} Discord publications in shadow mode!`);
    }

    if (metrics.consistency.unexpected_writes > 0) {
      issues.push(`WARNING: ${metrics.consistency.unexpected_writes} unexpected production writes`);
    }

    // Data integrity issues
    if (!metrics.consistency.data_integrity) {
      issues.push('Data integrity check failed');
    }

    // Alert on issues
    if (issues.length > 0) {
      await this.alertIssues(issues);
      issues.forEach(issue => {
        if (issue.includes('CRITICAL')) {
          this.errors.push({ timestamp: new Date(), issue });
        } else {
          this.warnings.push({ timestamp: new Date(), issue });
        }
      });
    }
  }

  private async alertIssues(issues: string[]): Promise<void> {
    console.error('🚨 Issues detected:', issues);

    if (ALERT_WEBHOOK) {
      try {
        await fetch(ALERT_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `Soak Test Alert`,
            attachments: [{
              color: 'danger',
              title: 'Issues Detected',
              text: issues.join('\n'),
              timestamp: new Date().toISOString()
            }]
          })
        });
      } catch (error) {
        console.error('Failed to send alert:', error);
      }
    }
  }

  private async saveMetrics(metrics: SoakMetrics): Promise<void> {
    const filename = `soak-metrics-${metrics.timestamp.toISOString().replace(/:/g, '-')}.json`;
    const filepath = path.join(RESULTS_DIR, filename);
    
    await fs.writeFile(filepath, JSON.stringify(metrics, null, 2));
  }

  private logSummary(metrics: SoakMetrics): void {
    console.log('\n📊 Metrics Summary:');
    console.log(`  Duration: ${metrics.duration_hours.toFixed(2)} hours`);
    console.log(`  Memory: ${(metrics.memory_usage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Errors: ${metrics.error_count}, Warnings: ${metrics.warning_count}`);
    console.log(`  Processed: F:${metrics.processed_items.feeds} G:${metrics.processed_items.grades} P:${metrics.processed_items.promotions}`);
    console.log(`  API p95: ${metrics.performance.api_response_p95}ms`);
    console.log(`  Shadow Mode: ${metrics.consistency.shadow_mode_active ? '✅' : '❌'}`);
    console.log(`  Discord Pubs: ${metrics.consistency.discord_publications === 0 ? '✅ None' : `❌ ${metrics.consistency.discord_publications}`}`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    console.log('\n🛑 Stopping soak test...');
    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Generate final report
    await this.generateReport();

    // Exit code based on results
    const exitCode = this.errors.length > 0 ? 1 : 0;
    process.exit(exitCode);
  }

  private async generateReport(): Promise<void> {
    const report = {
      summary: {
        duration_hours: SOAK_DURATION_HOURS,
        start_time: this.startTime,
        end_time: new Date(),
        total_checks: this.metrics.length,
        total_errors: this.errors.length,
        total_warnings: this.warnings.length,
        status: this.errors.length === 0 ? 'PASSED' : 'FAILED'
      },
      performance: {
        api_p95_avg: this.calculateAverage(this.metrics.map(m => m.performance.api_response_p95)),
        api_p95_max: Math.max(...this.metrics.map(m => m.performance.api_response_p95)),
        db_p95_avg: this.calculateAverage(this.metrics.map(m => m.performance.db_query_p95)),
        db_p95_max: Math.max(...this.metrics.map(m => m.performance.db_query_p95))
      },
      consistency: {
        shadow_mode_violations: this.metrics.filter(m => !m.consistency.shadow_mode_active).length,
        discord_publications_total: this.metrics.reduce((sum, m) => sum + m.consistency.discord_publications, 0),
        data_integrity_failures: this.metrics.filter(m => !m.consistency.data_integrity).length
      },
      resource_usage: {
        memory_start: this.metrics[0]?.memory_usage.heapUsed || 0,
        memory_end: this.metrics[this.metrics.length - 1]?.memory_usage.heapUsed || 0,
        memory_growth: ((this.metrics[this.metrics.length - 1]?.memory_usage.heapUsed || 0) - 
                        (this.metrics[0]?.memory_usage.heapUsed || 0)) / (1024 * 1024)
      },
      errors: this.errors,
      warnings: this.warnings
    };

    const reportPath = path.join(RESULTS_DIR, 'soak-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📋 Final Report:');
    console.log('================');
    console.log(`Status: ${report.summary.status}`);
    console.log(`Duration: ${report.summary.duration_hours} hours`);
    console.log(`Checks: ${report.summary.total_checks}`);
    console.log(`Errors: ${report.summary.total_errors}`);
    console.log(`Warnings: ${report.summary.total_warnings}`);
    console.log(`\nPerformance:`);
    console.log(`  API p95 avg: ${report.performance.api_p95_avg.toFixed(2)}ms`);
    console.log(`  API p95 max: ${report.performance.api_p95_max}ms`);
    console.log(`\nConsistency:`);
    console.log(`  Shadow violations: ${report.consistency.shadow_mode_violations}`);
    console.log(`  Discord pubs: ${report.consistency.discord_publications_total}`);
    console.log(`  Integrity failures: ${report.consistency.data_integrity_failures}`);
    console.log(`\nMemory Growth: ${report.resource_usage.memory_growth.toFixed(2)}MB`);
    console.log(`\nReport saved to: ${reportPath}`);
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
}

// Health check services
async function checkServiceHealth(): Promise<HealthCheck[]> {
  const services = [
    { name: 'api', url: `${process.env.API_URL}/health` },
    { name: 'command-center', url: `${process.env.COMMAND_CENTER_URL}/health` },
    { name: 'discord-bot', url: `${process.env.DISCORD_BOT_URL}/health` },
    { name: 'dashboard', url: `${process.env.FRONTEND_URL}/api/health` }
  ];

  return Promise.all(services.map(async (service) => {
    const start = Date.now();
    try {
      const response = await fetch(service.url, { 
        signal: AbortSignal.timeout(5000)
      });
      
      return {
        service: service.name,
        healthy: response.ok,
        response_time: Date.now() - start
      };
    } catch (error) {
      return {
        service: service.name,
        healthy: false,
        response_time: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }));
}

// Main execution
async function main() {
  console.log('🏁 Shadow Mode Soak Test Runner');
  console.log('================================\n');

  // Validate environment
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }

  // Check all services are healthy
  console.log('🔍 Checking service health...');
  const healthChecks = await checkServiceHealth();
  const unhealthy = healthChecks.filter(h => !h.healthy);
  
  if (unhealthy.length > 0) {
    console.error('❌ Unhealthy services:', unhealthy.map(h => h.service).join(', '));
    console.error('Please ensure all services are running before starting soak test');
    process.exit(1);
  }

  console.log('✅ All services healthy\n');

  // Start soak test
  const soakTest = new ShadowSoakTest();
  await soakTest.start();
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { ShadowSoakTest };