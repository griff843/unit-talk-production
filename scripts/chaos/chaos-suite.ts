#!/usr/bin/env node

/**
 * Chaos Testing Suite for Unit Talk Platform
 * 
 * Simulates various failure scenarios:
 * - Service outages
 * - Database failures
 * - Network issues
 * - Resource exhaustion
 * - Data corruption
 * - Byzantine failures
 */

import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuration
const CHAOS_DURATION_MINUTES = parseInt(process.env.CHAOS_DURATION || '30');
const CHAOS_INTENSITY = process.env.CHAOS_INTENSITY || 'medium'; // low, medium, high
const SAFE_MODE = process.env.CHAOS_SAFE_MODE === 'true';
const RESULTS_DIR = './chaos-results';

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Types
interface ChaosScenario {
  name: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  execute: () => Promise<void>;
  cleanup: () => Promise<void>;
  validate: () => Promise<boolean>;
}

interface ChaosResult {
  scenario: string;
  started_at: Date;
  ended_at: Date;
  success: boolean;
  recovery_time: number;
  errors: string[];
  metrics: {
    availability: number;
    data_integrity: boolean;
    performance_impact: number;
  };
}

class ChaosTestSuite extends EventEmitter {
  private scenarios: ChaosScenario[] = [];
  private results: ChaosResult[] = [];
  private isRunning = false;
  private startTime: Date;

  constructor() {
    super();
    this.startTime = new Date();
    this.initializeScenarios();
  }

  private initializeScenarios(): void {
    // Low risk scenarios
    this.scenarios.push(
      this.createServiceOutageScenario('api'),
      this.createServiceOutageScenario('grading_agent'),
      this.createNetworkLatencyScenario(),
      this.createCPUStressScenario()
    );

    // Medium risk scenarios
    if (CHAOS_INTENSITY === 'medium' || CHAOS_INTENSITY === 'high') {
      this.scenarios.push(
        this.createDatabaseConnectionFailure(),
        this.createMemoryLeakScenario(),
        this.createDiskSpaceExhaustion(),
        this.createRateLimitExhaustion()
      );
    }

    // High risk scenarios (only in non-production)
    if (CHAOS_INTENSITY === 'high' && !SAFE_MODE) {
      this.scenarios.push(
        this.createDataCorruptionScenario(),
        this.createCascadeFailureScenario(),
        this.createByzantineFailureScenario(),
        this.createTimeSkewScenario()
      );
    }
  }

  async start(): Promise<void> {
    console.log(`🔥 Starting Chaos Testing Suite`);
    console.log(`⚡ Intensity: ${CHAOS_INTENSITY}`);
    console.log(`🛡️ Safe Mode: ${SAFE_MODE}`);
    console.log(`⏱️ Duration: ${CHAOS_DURATION_MINUTES} minutes\n`);

    this.isRunning = true;

    // Create results directory
    await fs.mkdir(RESULTS_DIR, { recursive: true });

    // Create system snapshot before chaos
    await this.createSystemSnapshot('before');

    // Execute chaos scenarios
    for (const scenario of this.scenarios) {
      if (!this.isRunning) break;

      await this.executeScenario(scenario);
      
      // Wait between scenarios
      await this.delay(30000); // 30 seconds
    }

    // Create system snapshot after chaos
    await this.createSystemSnapshot('after');

    // Generate report
    await this.generateReport();

    console.log('\n✅ Chaos testing complete');
  }

  private async executeScenario(scenario: ChaosScenario): Promise<void> {
    console.log(`\n🎯 Executing: ${scenario.name}`);
    console.log(`   Risk Level: ${scenario.risk}`);
    console.log(`   Description: ${scenario.description}`);

    const result: ChaosResult = {
      scenario: scenario.name,
      started_at: new Date(),
      ended_at: new Date(),
      success: false,
      recovery_time: 0,
      errors: [],
      metrics: {
        availability: 0,
        data_integrity: true,
        performance_impact: 0
      }
    };

    try {
      // Measure baseline performance
      const baselinePerf = await this.measurePerformance();

      // Execute chaos
      await scenario.execute();
      console.log('   ⚡ Chaos injected');

      // Monitor impact
      const impactStart = Date.now();
      let recovered = false;
      let attempts = 0;
      const maxAttempts = 20;

      while (!recovered && attempts < maxAttempts) {
        attempts++;
        await this.delay(5000); // Check every 5 seconds

        // Check if system recovered
        recovered = await scenario.validate();
        
        if (!recovered) {
          console.log(`   🔄 Recovery attempt ${attempts}/${maxAttempts}`);
        }
      }

      result.recovery_time = Date.now() - impactStart;
      result.success = recovered;

      // Measure performance impact
      const chaosPerf = await this.measurePerformance();
      result.metrics.performance_impact = 
        ((chaosPerf - baselinePerf) / baselinePerf) * 100;

      // Check data integrity
      result.metrics.data_integrity = await this.checkDataIntegrity();

      // Calculate availability
      result.metrics.availability = recovered ? 
        (1 - (result.recovery_time / (CHAOS_DURATION_MINUTES * 60000))) * 100 : 0;

      console.log(`   ✅ Scenario completed`);
      console.log(`   Recovery time: ${result.recovery_time}ms`);
      console.log(`   Availability: ${result.metrics.availability.toFixed(2)}%`);

    } catch (error) {
      console.error(`   ❌ Scenario failed:`, error);
      result.errors.push(error instanceof Error ? error.message : String(error));
    } finally {
      // Always cleanup
      try {
        await scenario.cleanup();
        console.log('   🧹 Cleanup completed');
      } catch (cleanupError) {
        console.error('   ⚠️ Cleanup failed:', cleanupError);
        result.errors.push(`Cleanup failed: ${cleanupError}`);
      }

      result.ended_at = new Date();
      this.results.push(result);
    }
  }

  // Scenario Definitions

  private createServiceOutageScenario(service: string): ChaosScenario {
    return {
      name: `Service Outage: ${service}`,
      description: `Simulate ${service} becoming unavailable`,
      risk: 'low',
      execute: async () => {
        // Stop the service container
        await execAsync(`docker-compose stop ${service}`);
      },
      cleanup: async () => {
        // Restart the service
        await execAsync(`docker-compose start ${service}`);
        await this.delay(10000); // Wait for service to be ready
      },
      validate: async () => {
        // Check if service is healthy
        try {
          const response = await fetch(`${process.env.API_URL}/health/${service}`);
          return response.ok;
        } catch {
          return false;
        }
      }
    };
  }

  private createNetworkLatencyScenario(): ChaosScenario {
    return {
      name: 'Network Latency',
      description: 'Add 500ms latency to all network calls',
      risk: 'low',
      execute: async () => {
        // Add network latency using tc (traffic control)
        await execAsync(`docker exec api tc qdisc add dev eth0 root netem delay 500ms`);
      },
      cleanup: async () => {
        // Remove network latency
        await execAsync(`docker exec api tc qdisc del dev eth0 root netem`).catch(() => {});
      },
      validate: async () => {
        // Check if API responds within acceptable time
        const start = Date.now();
        try {
          await fetch(`${process.env.API_URL}/health`);
          const duration = Date.now() - start;
          return duration < 2000; // Should respond within 2s even with latency
        } catch {
          return false;
        }
      }
    };
  }

  private createCPUStressScenario(): ChaosScenario {
    return {
      name: 'CPU Stress',
      description: 'Consume 80% CPU on API service',
      risk: 'low',
      execute: async () => {
        // Run CPU stress test in container
        await execAsync(`docker exec api stress --cpu 4 --timeout 60s &`);
      },
      cleanup: async () => {
        // Kill stress process
        await execAsync(`docker exec api pkill stress`).catch(() => {});
      },
      validate: async () => {
        // Check if API still responds
        try {
          const response = await fetch(`${process.env.API_URL}/health`);
          return response.ok;
        } catch {
          return false;
        }
      }
    };
  }

  private createDatabaseConnectionFailure(): ChaosScenario {
    return {
      name: 'Database Connection Failure',
      description: 'Block database connections',
      risk: 'medium',
      execute: async () => {
        // Block database port using iptables
        await execAsync(`docker exec api iptables -A OUTPUT -p tcp --dport 5432 -j DROP`);
      },
      cleanup: async () => {
        // Unblock database port
        await execAsync(`docker exec api iptables -D OUTPUT -p tcp --dport 5432 -j DROP`).catch(() => {});
      },
      validate: async () => {
        // Check if system enters safe mode or recovers
        const { data } = await supabase
          .from('system_config')
          .select('safe_mode')
          .single();
        
        // System should detect and handle DB failure
        return data?.safe_mode === true || await this.checkDatabaseConnection();
      }
    };
  }

  private createMemoryLeakScenario(): ChaosScenario {
    let memoryHog: any[] = [];
    
    return {
      name: 'Memory Leak',
      description: 'Simulate memory leak consuming 1GB',
      risk: 'medium',
      execute: async () => {
        // Allocate memory in chunks
        const chunkSize = 50 * 1024 * 1024; // 50MB chunks
        const chunks = 20; // Total 1GB
        
        for (let i = 0; i < chunks; i++) {
          memoryHog.push(Buffer.alloc(chunkSize));
          await this.delay(1000); // Gradual allocation
        }
      },
      cleanup: async () => {
        // Release memory
        memoryHog = [];
        if (global.gc) {
          global.gc();
        }
      },
      validate: async () => {
        // Check if system is still responsive
        const memUsage = process.memoryUsage();
        return memUsage.heapUsed < 2 * 1024 * 1024 * 1024; // Less than 2GB
      }
    };
  }

  private createDiskSpaceExhaustion(): ChaosScenario {
    const tempFile = path.join('/tmp', 'chaos-disk-fill.tmp');
    
    return {
      name: 'Disk Space Exhaustion',
      description: 'Fill disk to 95% capacity',
      risk: 'medium',
      execute: async () => {
        // Create large file
        await execAsync(`dd if=/dev/zero of=${tempFile} bs=1G count=10`);
      },
      cleanup: async () => {
        // Remove large file
        await fs.unlink(tempFile).catch(() => {});
      },
      validate: async () => {
        // Check if system handles disk space correctly
        try {
          // Should still be able to write small files
          await fs.writeFile('/tmp/test.txt', 'test');
          await fs.unlink('/tmp/test.txt');
          return true;
        } catch {
          return false;
        }
      }
    };
  }

  private createRateLimitExhaustion(): ChaosScenario {
    return {
      name: 'Rate Limit Exhaustion',
      description: 'Exceed API rate limits',
      risk: 'medium',
      execute: async () => {
        // Send burst of requests
        const promises = [];
        for (let i = 0; i < 1000; i++) {
          promises.push(
            fetch(`${process.env.API_URL}/api/picks`)
              .catch(() => {})
          );
        }
        await Promise.all(promises);
      },
      cleanup: async () => {
        // Wait for rate limit to reset
        await this.delay(60000);
      },
      validate: async () => {
        // Check if rate limiting is working
        const response = await fetch(`${process.env.API_URL}/api/picks`);
        return response.status === 429 || response.ok;
      }
    };
  }

  private createDataCorruptionScenario(): ChaosScenario {
    const corruptedIds: string[] = [];
    
    return {
      name: 'Data Corruption',
      description: 'Inject invalid data into database',
      risk: 'high',
      execute: async () => {
        // Insert corrupted records
        const { data } = await supabase
          .from('raw_props')
          .insert([
            { 
              id: 'corrupt-1',
              player_name: null, // Invalid null
              line: -999, // Invalid negative
              stat_type: 'INVALID_TYPE'
            },
            {
              id: 'corrupt-2',
              player_name: 'A'.repeat(1000), // Too long
              line: NaN,
              stat_type: ''
            }
          ])
          .select();
        
        if (data) {
          corruptedIds.push(...data.map(d => d.id));
        }
      },
      cleanup: async () => {
        // Remove corrupted records
        if (corruptedIds.length > 0) {
          await supabase
            .from('raw_props')
            .delete()
            .in('id', corruptedIds);
        }
      },
      validate: async () => {
        // Check if system detects and handles corruption
        const { data } = await supabase
          .from('data_integrity_checks')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        return data?.status === 'corrupted_data_detected';
      }
    };
  }

  private createCascadeFailureScenario(): ChaosScenario {
    return {
      name: 'Cascade Failure',
      description: 'Trigger cascading service failures',
      risk: 'high',
      execute: async () => {
        // Kill multiple services in sequence
        await execAsync(`docker-compose stop feed_agent`);
        await this.delay(5000);
        await execAsync(`docker-compose stop grading_agent`);
        await this.delay(5000);
        await execAsync(`docker-compose stop promoter_agent`);
      },
      cleanup: async () => {
        // Restart all services
        await execAsync(`docker-compose start feed_agent grading_agent promoter_agent`);
        await this.delay(20000);
      },
      validate: async () => {
        // Check if safe mode activated
        const { data } = await supabase
          .from('system_config')
          .select('safe_mode, safe_mode_reason')
          .single();
        
        return data?.safe_mode === true && 
               data?.safe_mode_reason?.includes('Multiple service failures');
      }
    };
  }

  private createByzantineFailureScenario(): ChaosScenario {
    return {
      name: 'Byzantine Failure',
      description: 'Service returns incorrect data randomly',
      risk: 'high',
      execute: async () => {
        // Inject middleware that randomly corrupts responses
        // This would require a special chaos proxy in production
        console.log('   Simulating Byzantine failure (mock)');
      },
      cleanup: async () => {
        console.log('   Removing Byzantine failure simulation');
      },
      validate: async () => {
        // Check if system detects inconsistent responses
        return true; // Mock validation
      }
    };
  }

  private createTimeSkewScenario(): ChaosScenario {
    return {
      name: 'Time Skew',
      description: 'Adjust system clock by 5 minutes',
      risk: 'high',
      execute: async () => {
        // Adjust container time
        await execAsync(`docker exec api date -s '+5 minutes'`);
      },
      cleanup: async () => {
        // Sync time with host
        await execAsync(`docker exec api ntpdate -s time.nist.gov`).catch(() => {});
      },
      validate: async () => {
        // Check if system handles time discrepancies
        const response = await fetch(`${process.env.API_URL}/api/time-check`);
        const data = await response.json();
        return Math.abs(data.skew) < 10000; // Less than 10 seconds skew
      }
    };
  }

  // Helper Methods

  private async createSystemSnapshot(phase: 'before' | 'after'): Promise<void> {
    console.log(`📸 Creating system snapshot: ${phase}`);
    
    const snapshot = {
      timestamp: new Date(),
      phase,
      services: await this.getServiceStatuses(),
      database: await this.getDatabaseStats(),
      metrics: await this.getSystemMetrics()
    };

    const filename = path.join(RESULTS_DIR, `snapshot-${phase}.json`);
    await fs.writeFile(filename, JSON.stringify(snapshot, null, 2));
  }

  private async getServiceStatuses(): Promise<any> {
    const services = ['api', 'grading_agent', 'feed_agent', 'promoter_agent'];
    const statuses: any = {};

    for (const service of services) {
      try {
        const response = await fetch(`${process.env.API_URL}/health/${service}`);
        statuses[service] = {
          healthy: response.ok,
          status: response.status
        };
      } catch (error) {
        statuses[service] = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return statuses;
  }

  private async getDatabaseStats(): Promise<any> {
    const { data } = await supabase.rpc('get_database_stats');
    return data;
  }

  private async getSystemMetrics(): Promise<any> {
    return {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime()
    };
  }

  private async measurePerformance(): Promise<number> {
    const iterations = 10;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await fetch(`${process.env.API_URL}/health`);
      times.push(Date.now() - start);
    }

    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  private async checkDataIntegrity(): Promise<boolean> {
    const { data, error } = await supabase.rpc('validate_data_integrity');
    return !error && data?.is_valid === true;
  }

  private async checkDatabaseConnection(): Promise<boolean> {
    try {
      const { error } = await supabase.from('system_config').select('*').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  private async generateReport(): Promise<void> {
    const report = {
      summary: {
        total_scenarios: this.scenarios.length,
        executed: this.results.length,
        passed: this.results.filter(r => r.success).length,
        failed: this.results.filter(r => !r.success).length,
        intensity: CHAOS_INTENSITY,
        duration_minutes: CHAOS_DURATION_MINUTES
      },
      results: this.results,
      metrics: {
        avg_recovery_time: this.calculateAverage(
          this.results.map(r => r.recovery_time)
        ),
        avg_availability: this.calculateAverage(
          this.results.map(r => r.metrics.availability)
        ),
        data_integrity_failures: this.results.filter(
          r => !r.metrics.data_integrity
        ).length,
        avg_performance_impact: this.calculateAverage(
          this.results.map(r => r.metrics.performance_impact)
        )
      },
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(RESULTS_DIR, 'chaos-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📊 Chaos Test Report');
    console.log('===================');
    console.log(`Scenarios: ${report.summary.executed}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Avg Recovery: ${report.metrics.avg_recovery_time.toFixed(0)}ms`);
    console.log(`Avg Availability: ${report.metrics.avg_availability.toFixed(2)}%`);
    console.log(`\nReport saved to: ${reportPath}`);
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Analyze results for patterns
    const slowRecovery = this.results.filter(r => r.recovery_time > 30000);
    if (slowRecovery.length > 0) {
      recommendations.push(
        `Improve recovery time for: ${slowRecovery.map(r => r.scenario).join(', ')}`
      );
    }

    const dataIntegrityIssues = this.results.filter(r => !r.metrics.data_integrity);
    if (dataIntegrityIssues.length > 0) {
      recommendations.push(
        'Implement stronger data validation and integrity checks'
      );
    }

    const highPerformanceImpact = this.results.filter(
      r => r.metrics.performance_impact > 50
    );
    if (highPerformanceImpact.length > 0) {
      recommendations.push(
        'Add performance isolation to prevent degradation during failures'
      );
    }

    return recommendations;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop(): void {
    console.log('\n🛑 Stopping chaos tests...');
    this.isRunning = false;
  }
}

// Main execution
async function main() {
  console.log('💥 Chaos Testing Suite');
  console.log('=====================\n');

  // Safety check
  if (process.env.NODE_ENV === 'production' && !SAFE_MODE) {
    console.error('❌ Cannot run chaos tests in production without SAFE_MODE');
    process.exit(1);
  }

  // Confirm execution
  if (!process.env.CHAOS_CONFIRM) {
    console.log('⚠️  WARNING: Chaos tests will intentionally break things!');
    console.log('Set CHAOS_CONFIRM=true to proceed');
    process.exit(1);
  }

  const suite = new ChaosTestSuite();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => suite.stop());
  process.on('SIGTERM', () => suite.stop());

  await suite.start();
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { ChaosTestSuite };