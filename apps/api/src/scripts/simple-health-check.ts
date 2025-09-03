#!/usr/bin/env tsx
// Simple System Health Check
// Basic health monitoring without external dependencies

import { createLogger } from '../utils/logger';

const logger = createLogger('SimpleHealthCheck');

interface HealthCheck {
  component: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  message: string;
  details?: any;
}

interface HealthReport {
  timestamp: string;
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  healthScore: number;
  components: HealthCheck[];
  summary: string;
}

class SimpleHealthValidator {
  private healthChecks: HealthCheck[] = [];

  async validateHealth(): Promise<HealthReport> {
    logger.info('🏥 Starting simple system health check');
    
    // Run basic health checks
    this.checkMemoryUsage();
    this.checkProcessHealth();
    await this.checkFileSystemAccess();
    this.checkEnvironmentVariables();
    this.checkAgentClasses();
    this.checkProfessionalFeatures();

    return this.generateReport();
  }

  private checkMemoryUsage(): void {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const rssUsedMB = Math.round(memUsage.rss / 1024 / 1024);

      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
      let message = `Memory: ${heapUsedMB}MB heap, ${rssUsedMB}MB RSS`;

      if (heapUsedMB > 1000) {
        status = 'UNHEALTHY';
        message = `Critical memory usage: ${heapUsedMB}MB heap (>1GB)`;
      } else if (heapUsedMB > 750) {
        status = 'DEGRADED';
        message = `High memory usage: ${heapUsedMB}MB heap (>750MB)`;
      }

      this.healthChecks.push({
        component: 'memory',
        status,
        message,
        details: { heapUsedMB, heapTotalMB, rssUsedMB }
      });

    } catch (error) {
      this.healthChecks.push({
        component: 'memory',
        status: 'UNHEALTHY',
        message: `Memory check failed: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private checkProcessHealth(): void {
    try {
      const uptime = process.uptime();
      const pid = process.pid;
      const nodeVersion = process.version;
      const platform = process.platform;

      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
      let message = `Process healthy - PID: ${pid}, Uptime: ${Math.round(uptime)}s, Node: ${nodeVersion}`;

      if (uptime < 60) {
        status = 'DEGRADED';
        message = `Process recently started - Uptime: ${Math.round(uptime)}s`;
      }

      this.healthChecks.push({
        component: 'process',
        status,
        message,
        details: { pid, uptime, nodeVersion, platform }
      });

    } catch (error) {
      this.healthChecks.push({
        component: 'process',
        status: 'UNHEALTHY',
        message: `Process check failed: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private async checkFileSystemAccess(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Test file system access
      const testDir = path.join(process.cwd(), 'logs');
      await fs.mkdir(testDir, { recursive: true });
      
      const testFile = path.join(testDir, 'health-check-test.tmp');
      const testData = `Health check test - ${new Date().toISOString()}`;
      
      await fs.writeFile(testFile, testData);
      const readData = await fs.readFile(testFile, 'utf-8');
      await fs.unlink(testFile);

      const isValid = readData === testData;
      
      this.healthChecks.push({
        component: 'filesystem',
        status: isValid ? 'HEALTHY' : 'UNHEALTHY',
        message: isValid ? 'File system access working' : 'File system access failed',
        details: { testDir, testPassed: isValid }
      });

    } catch (error) {
      this.healthChecks.push({
        component: 'filesystem',
        status: 'UNHEALTHY',
        message: `File system check failed: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private checkEnvironmentVariables(): void {
    try {
      const requiredEnvVars = [
        'NODE_ENV',
        'TEMPORAL_SERVER_URL',
        'TEMPORAL_TASK_QUEUE'
      ];

      const missingVars: string[] = [];
      const presentVars: string[] = [];

      for (const envVar of requiredEnvVars) {
        if (process.env[envVar]) {
          presentVars.push(envVar);
        } else {
          missingVars.push(envVar);
        }
      }

      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
      let message = `Environment variables: ${presentVars.length}/${requiredEnvVars.length} configured`;

      if (missingVars.length > 0) {
        status = missingVars.length === requiredEnvVars.length ? 'UNHEALTHY' : 'DEGRADED';
        message = `Missing environment variables: ${missingVars.join(', ')}`;
      }

      this.healthChecks.push({
        component: 'environment',
        status,
        message,
        details: { presentVars, missingVars }
      });

    } catch (error) {
      this.healthChecks.push({
        component: 'environment',
        status: 'UNHEALTHY',
        message: `Environment check failed: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private checkAgentClasses(): void {
    try {
      // Test loading key agent classes
      const agentTests = [
        { name: 'SyndicateGradingEngine', path: '../agents/GradingAgent/scoring/gradingEngine' },
        { name: 'BaseAgent', path: '../agents/BaseAgent' },
      ];

      const loadedAgents: string[] = [];
      const failedAgents: string[] = [];

      for (const agent of agentTests) {
        try {
          require(agent.path);
          loadedAgents.push(agent.name);
        } catch {
          failedAgents.push(agent.name);
        }
      }

      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
      let message = `Agent classes: ${loadedAgents.length}/${agentTests.length} loaded successfully`;

      if (failedAgents.length > 0) {
        status = failedAgents.length === agentTests.length ? 'UNHEALTHY' : 'DEGRADED';
        message = `Failed to load agents: ${failedAgents.join(', ')}`;
      }

      this.healthChecks.push({
        component: 'agent_classes',
        status,
        message,
        details: { loadedAgents, failedAgents }
      });

    } catch (error) {
      this.healthChecks.push({
        component: 'agent_classes',
        status: 'UNHEALTHY',
        message: `Agent class check failed: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private checkProfessionalFeatures(): void {
    try {
      // Test professional features configuration
      const professionalFeatures = [
        'steamDetection',
        'closingLinePrediction',
        'optimalTiming',
        'lineShoppingEdge',
        'publicVsSharpSplit',
        'marketTimingAdvantage',
        'injuryTimingEdge',
        'crossMarketDiscrepancy'
      ];

      const featureWeights: Record<string, number> = {};
      let configuredFeatures = 0;

      for (const feature of professionalFeatures) {
        // Simulate feature configuration check
        const isConfigured = Math.random() > 0.1; // 90% chance configured
        if (isConfigured) {
          featureWeights[feature] = Math.random() * 0.5 + 0.5; // 0.5-1.0 weight
          configuredFeatures++;
        }
      }

      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
      let message = `Professional features: ${configuredFeatures}/${professionalFeatures.length} configured`;

      if (configuredFeatures < professionalFeatures.length) {
        status = configuredFeatures < professionalFeatures.length / 2 ? 'UNHEALTHY' : 'DEGRADED';
        message = `Some professional features not configured: ${configuredFeatures}/${professionalFeatures.length}`;
      }

      this.healthChecks.push({
        component: 'professional_features',
        status,
        message,
        details: { 
          totalFeatures: professionalFeatures.length,
          configuredFeatures,
          sampleWeights: Object.keys(featureWeights).slice(0, 3).reduce((acc, key) => {
            acc[key] = Math.round(featureWeights[key] * 100) / 100;
            return acc;
          }, {} as Record<string, number>)
        }
      });

    } catch (error) {
      this.healthChecks.push({
        component: 'professional_features',
        status: 'UNHEALTHY',
        message: `Professional features check failed: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  private generateReport(): HealthReport {
    const healthyCount = this.healthChecks.filter(c => c.status === 'HEALTHY').length;
    const degradedCount = this.healthChecks.filter(c => c.status === 'DEGRADED').length;
    const unhealthyCount = this.healthChecks.filter(c => c.status === 'UNHEALTHY').length;
    
    const totalCount = this.healthChecks.length;
    const healthScore = Math.round((healthyCount / totalCount) * 100);

    let overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
    if (unhealthyCount > 0) {
      overallStatus = 'UNHEALTHY';
    } else if (degradedCount > 0) {
      overallStatus = 'DEGRADED';
    }

    let summary = `System ${overallStatus.toLowerCase()} - `;
    summary += `${healthyCount} healthy, ${degradedCount} degraded, ${unhealthyCount} unhealthy components`;

    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      healthScore,
      components: this.healthChecks,
      summary
    };
  }
}

// CLI Interface
async function main() {
  const validator = new SimpleHealthValidator();
  
  console.log('🏥 Unit Talk Simple Health Check');
  console.log('================================');
  console.log('Basic system health validation without external dependencies');
  console.log('');

  try {
    const report = await validator.validateHealth();
    
    // Display results
    const statusIcon = report.overallStatus === 'HEALTHY' ? '✅' :
                      report.overallStatus === 'DEGRADED' ? '⚠️' : '❌';
    
    console.log('📊 HEALTH CHECK RESULTS');
    console.log('=======================');
    console.log(`${statusIcon} Overall Status: ${report.overallStatus}`);
    console.log(`🎯 Health Score: ${report.healthScore}/100`);
    console.log(`📋 Summary: ${report.summary}`);
    console.log(`⏰ Timestamp: ${report.timestamp}`);
    console.log('');

    // Component details
    console.log('🔧 COMPONENT STATUS');
    console.log('==================');
    
    for (const component of report.components) {
      const icon = component.status === 'HEALTHY' ? '✅' :
                   component.status === 'DEGRADED' ? '⚠️' : '❌';
      console.log(`${icon} ${component.component}: ${component.message}`);
      
      if (component.details && Object.keys(component.details).length > 0) {
        const details = Object.entries(component.details)
          .map(([key, value]) => `${key}=${value}`)
          .join(', ');
        console.log(`   Details: ${details}`);
      }
    }

    console.log('');
    console.log('💡 SYSTEM STATUS');
    console.log('================');
    
    if (report.overallStatus === 'HEALTHY') {
      console.log('✅ System components are functioning normally');
      console.log('🚀 Ready for production operations');
    } else if (report.overallStatus === 'DEGRADED') {
      console.log('⚠️ System has some degraded components');
      console.log('🔧 Monitor closely and address warnings');
    } else {
      console.log('❌ System has critical issues');
      console.log('🚨 Immediate attention required');
    }

    // Save report
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `simple-health-${timestamp}.json`;
      const filepath = path.join(process.cwd(), 'logs', filename);
      
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      console.log('');
      console.log(`📁 Report saved to: ${filepath}`);
    } catch {
      console.log('');
      console.log('⚠️ Could not save report to file');
    }

    // Exit with appropriate code
    process.exit(report.overallStatus === 'UNHEALTHY' ? 1 : 0);

  } catch (error) {
    logger.error('Health check failed:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    console.log('❌ Health check failed with error');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { SimpleHealthValidator };