import { BaseAgentConfig, BaseAgentDependencies } from '../agents/BaseAgent/types';
import { createLogger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandling';
import { supabase } from '../services/supabaseClient';

// Import all agents
import { RecapAgent } from '../agents/RecapAgent';
import { AlertAgent } from '../agents/AlertAgent';
import { AnalyticsAgent } from '../agents/AnalyticsAgent';
import { AuditAgent } from '../agents/AuditAgent';
import { ContestAgent } from '../agents/ContestAgent';
import { DataAgent } from '../agents/DataAgent';
import { FeedAgent } from '../agents/FeedAgent';
import { FinalizerAgent } from '../agents/FinalizerAgent';
import { FeedbackLoopAgent } from '../agents/FeedbackLoopAgent';
import { GradingAgent } from '../agents/GradingAgent';

// Test result types
interface TestResult {
  agentName: string;
  success: boolean;
  duration: number;
  error?: string;
  timestamp: string;
  details?: Record<string, any>;
}

interface TestSuite {
  name: string;
  agents: string[];
  description: string;
}

/**
 * Unified Test Harness for all agents
 * Provides comprehensive testing capabilities with reporting and metrics
 */
export class UnifiedTestHarness {
  private logger = createLogger('UnifiedTestHarness');
  private supabase = supabase;
  private errorHandler = new ErrorHandler('UnifiedTestHarness', supabase);
  private testResults: TestResult[] = [];

  // Test suites configuration
  private testSuites: TestSuite[] = [
    {
      name: 'Core Agents',
      agents: ['RecapAgent', 'AlertAgent', 'FeedAgent'],
      description: 'Essential agents for platform operation'
    },
    {
      name: 'Analytics Agents',
      agents: ['AnalyticsAgent', 'DataAgent'],
      description: 'Data processing and analytics agents'
    },
    {
      name: 'Processing Agents',
      agents: ['GradingAgent', 'FinalizerAgent'],
      description: 'Pick processing and finalization agents'
    },
    {
      name: 'Enhancement Agents',
      agents: ['FeedbackLoopAgent', 'AuditAgent'],
      description: 'System enhancement and monitoring agents'
    },
    {
      name: 'Engagement Agents',
      agents: ['ContestAgent'],
      description: 'User engagement and promotion agents'
    }
  ];

  // Agent class mapping
  private agentClasses: Record<string, any> = {
    RecapAgent,
    AlertAgent,
    AnalyticsAgent,
    AuditAgent,
    ContestAgent,
    DataAgent,
    FeedAgent,
    FinalizerAgent,
    FeedbackLoopAgent,
    GradingAgent
  };

  /**
   * Run all test suites
   */
  public async runAllTests(): Promise<void> {
    try {
      this.logger.info('🚀 Starting unified agent test harness');
      const startTime = Date.now();

      // Clear previous results
      this.testResults = [];

      // Run each test suite
      for (const suite of this.testSuites) {
        await this.runTestSuite(suite);
      }

      const totalDuration = Date.now() - startTime;
      
      // Generate and save report
      await this.generateTestReport(totalDuration);
      
      this.logger.info(`✅ All tests completed in ${totalDuration}ms`);
    } catch (error) {
      this.logger.error('Test harness execution failed:', error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Run a specific test suite
   */
  public async runTestSuite(suite: TestSuite): Promise<void> {
    try {
      this.logger.info(`📋 Running test suite: ${suite.name}`);
      const suiteStartTime = Date.now();

      for (const agentName of suite.agents) {
        await this.testAgent(agentName);
      }

      const suiteDuration = Date.now() - suiteStartTime;
      this.logger.info(`✅ Test suite ${suite.name} completed in ${suiteDuration}ms`);
    } catch (error) {
      this.logger.error('Test harness execution failed:', error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Test a specific agent
   */
  private async testAgent(agentName: string): Promise<void> {
    try {
      this.logger.info(`🧪 Testing agent: ${agentName}`);
      const startTime = Date.now();

      // Get agent class
      const AgentClass = this.agentClasses[agentName];
      if (!AgentClass) {
        throw new Error(`Agent class not found: ${agentName}`);
      }

      // Create agent configuration
      const config = this.createAgentConfig(agentName);
      const deps = this.createAgentDependencies();

      // Create agent instance
      const agent = new AgentClass(config, deps);

      // Test agent lifecycle
      await agent.start();
      
      // Wait a moment for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check health
      const health = await agent.checkHealth();
      if (!health || (typeof health === 'object' && health.status !== 'healthy')) {
        throw new Error(`Agent health check failed: ${JSON.stringify(health)}`);
      }

      // Stop agent
      await agent.stop();

      const duration = Date.now() - startTime;
      
      // Record success
      this.testResults.push({
        agentName,
        success: true,
        duration,
        timestamp: new Date().toISOString(),
        details: { health }
      });

      this.logger.info(`✅ Agent ${agentName} test passed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - Date.now();
      
      // Record failure
      this.testResults.push({
        agentName,
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });

      this.logger.error(`❌ Agent ${agentName} test failed in ${duration}ms:`, error as Record<string, any>);
      throw error;
    }
  }

  /**
   * Create agent configuration
   */
  private createAgentConfig(agentName: string): BaseAgentConfig {
    return {
      name: agentName,
      version: '1.0.0',
      enabled: true,
      logLevel: 'info',
      metrics: {
        enabled: true,
        interval: 30,
        endpoint: '/metrics',
        port: 9090
      },
      health: {
        enabled: true,
        interval: 30,
        timeout: 5000,
        checkDb: true,
        checkExternal: false,
        endpoint: '/health'
      },
      schedule: 'disabled',
      retry: {
        enabled: true,
        maxRetries: 3,
        maxAttempts: 3,
        backoffMs: 1000,
        backoff: 1000,
        maxBackoffMs: 5000,
        exponential: true,
        jitter: true
      }
    };
  }

  /**
   * Create agent dependencies
   */
  private createAgentDependencies(): BaseAgentDependencies {
    return {
      supabase: this.supabase,
      logger: this.logger,
      errorHandler: this.errorHandler
    };
  }

  /**
   * Generate comprehensive test report
   */
  private async generateTestReport(totalDuration: number): Promise<void> {
    const successCount = this.testResults.filter(r => r.success).length;
    const failureCount = this.testResults.filter(r => r.success === false).length;
    const totalTests = this.testResults.length;

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests,
        successCount,
        failureCount,
        successRate: (successCount / totalTests) * 100,
        totalDuration
      },
      results: this.testResults,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    // Log summary
    this.logger.info('📊 Test Report Summary:', {
      totalTests,
      successCount,
      failureCount,
      successRate: report.summary.successRate,
      duration: totalDuration
    });

    // Log failures if any
    const failures = this.testResults.filter(r => r.success === false);
    if (failures.length > 0) {
      this.logger.warn('❌ Failed Tests:', failures);
      failures.forEach(failure => {
        this.logger.error(`  - ${failure.agentName}: ${failure.error}`);
      });
    }

    // Save report to database and file
    await this.saveTestReport(report);
    await this.saveTestReportToFile(report);
  }

  /**
   * Save test report to database
   */
  private async saveTestReport(report: any): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('test_reports')
        .insert([{
          report_data: report,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        this.logger.error('Failed to save test report to database:', error as Record<string, any>);
      } else {
        this.logger.info('✅ Test report saved to database');
      }
    } catch (error) {
      this.logger.error('Error saving test report:', error as Record<string, any>);
    }
  }

  /**
   * Save test report to file
   */
  private async saveTestReportToFile(report: any): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const reportsDir = path.join(process.cwd(), 'test-reports');
      
      // Ensure reports directory exists
      try {
        await fs.mkdir(reportsDir, { recursive: true });
      } catch {
        // Directory might already exist
      }

      const filename = `test-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const filepath = path.join(reportsDir, filename);

      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      this.logger.info(`✅ Test report saved to file: ${filepath}`);
    } catch (error) {
      this.logger.error('Error saving test report to file:', error as Record<string, any>);
    }
  }

  /**
   * Run a single agent test (public method for external use)
   */
  public async runSingleAgent(agentName: string): Promise<TestResult> {
    this.logger.info(`🎯 Running single agent test: ${agentName}`);
    
    await this.testAgent(agentName);
    
    const result = this.testResults.find(r => r.agentName === agentName);
    if (result) {
      this.logger.info(`✅ Single agent test completed: ${agentName}`);
    } else {
      this.logger.error(`❌ Single agent test failed: ${agentName}`);
    }

    return result!;
  }

  /**
   * Get test results
   */
  public getTestResults(): TestResult[] {
    return [...this.testResults];
  }

  /**
   * Clear test results
   */
  public clearTestResults(): void {
    this.testResults = [];
  }
}

// Export for CLI usage
export async function runUnifiedTests(): Promise<void> {
  const harness = new UnifiedTestHarness();
  await harness.runAllTests();
}

// CLI execution
if (require.main === module) {
  const agentName = process.argv[2];
  const harness = new UnifiedTestHarness();
  
  if (agentName) {
    harness.runSingleAgent(agentName)
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    harness.runAllTests()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}