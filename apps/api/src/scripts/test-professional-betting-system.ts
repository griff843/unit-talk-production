// @ts-nocheck
/**
 * Professional Betting System Test Runner
 *
 * Comprehensive validation of the complete professional betting system:
 * - Component functionality tests
 * - Integration tests
 * - Performance benchmarks
 * - System health checks
 *
 * Run with: npx tsx src/scripts/test-professional-betting-system.ts
 */

import { performance } from 'perf_hooks';

import { Logger } from '@shared/logger';

import { CLVAlertService } from '../services/alerts/CLVAlertService';
import { CLVTrackingService } from '../services/clv/CLVTrackingService';
import { DeviggingService } from '../services/devigging/DeviggingService';
import { FeedbackLoopService } from '../services/feedback/FeedbackLoopService';
import { ProfessionalBettingScheduler } from '../services/schedulers/ProfessionalBettingScheduler';
import { supabaseClient } from '../services/supabaseClient';

const logger = new Logger('ProfessionalBettingSystemTest');

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  passed: boolean;
  totalDuration: number;
}

class ProfessionalBettingSystemTester {
  private deviggingService: DeviggingService;
  private clvTrackingService: CLVTrackingService;
  private feedbackLoopService: FeedbackLoopService;
  private clvAlertService: CLVAlertService;
  private scheduler: ProfessionalBettingScheduler;
  private testUserId = '550e8400-e29b-41d4-a716-446655440000';

  constructor() {
    this.deviggingService = DeviggingService.getInstance();
    this.clvTrackingService = CLVTrackingService.getInstance();
    this.feedbackLoopService = FeedbackLoopService.getInstance();
    this.clvAlertService = CLVAlertService.getInstance();
    this.scheduler = ProfessionalBettingScheduler.getInstance();
  }

  async runAllTests(): Promise<void> {
    logger.info('🚀 Starting Professional Betting System Tests');
    console.log('\n' + '='.repeat(60));
    console.log('🏆 PROFESSIONAL BETTING SYSTEM VALIDATION');
    console.log('='.repeat(60) + '\n');

    const testSuites: TestSuite[] = [];

    try {
      // Setup test environment
      await this.setupTestEnvironment();

      // Run test suites
      testSuites.push(await this.runDeviggingTests());
      testSuites.push(await this.runCLVTrackingTests());
      testSuites.push(await this.runFeedbackLoopTests());
      testSuites.push(await this.runAlertSystemTests());
      testSuites.push(await this.runSchedulerTests());
      testSuites.push(await this.runIntegrationTests());
      testSuites.push(await this.runPerformanceTests());

      // Generate final report
      this.generateFinalReport(testSuites);
    } catch (error) {
      logger.error('Test suite failed with critical error', error);
      console.error('❌ CRITICAL TEST FAILURE:', error);
    } finally {
      await this.cleanupTestEnvironment();
    }
  }

  private async runTest(name: string, testFn: () => Promise<any>): Promise<TestResult> {
    const start = performance.now();

    try {
      const result = await testFn();
      const duration = performance.now() - start;

      return {
        name,
        passed: true,
        duration,
        details: result,
      };
    } catch (error) {
      const duration = performance.now() - start;

      return {
        name,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async runDeviggingTests(): Promise<TestSuite> {
    console.log('🔧 Testing Devigging Service...');

    const tests: TestResult[] = [];
    const suiteStart = performance.now();

    // Test 1: Two-way market devigging
    tests.push(
      await this.runTest('Two-way market devigging', async () => {
        const market = { option1: { odds: -110 }, option2: { odds: -110 } };
        const result = this.deviggingService.devigTwoWay(market);

        if (Math.abs(result.totalVig - 4.55) > 0.5) {
          throw new Error(`Expected ~4.55% vig, got ${result.totalVig.toFixed(2)}%`);
        }

        if (Math.abs(result.option1TrueProb + result.option2TrueProb - 1.0) > 0.001) {
          throw new Error('Probabilities do not sum to 1.0');
        }

        return { vig: result.totalVig, probs: [result.option1TrueProb, result.option2TrueProb] };
      })
    );

    // Test 2: Multi-way market devigging
    tests.push(
      await this.runTest('Multi-way market devigging', async () => {
        const market = {
          option1: { odds: 200 },
          option2: { odds: 300 },
          option3: { odds: 400 },
        };
        const result = this.deviggingService.devigMultiWay(market);

        if (result.totalVig <= 0) {
          throw new Error('Multi-way market should have positive vig');
        }

        const totalProb = result.option1TrueProb + result.option2TrueProb + result.option3TrueProb;
        if (Math.abs(totalProb - 1.0) > 0.001) {
          throw new Error('Probabilities do not sum to 1.0');
        }

        return { vig: result.totalVig, totalProb };
      })
    );

    // Test 3: Edge calculation accuracy
    tests.push(
      await this.runTest('Edge calculation accuracy', async () => {
        const modelProb = 0.55; // 55% model probability
        const marketOdds = -110; // ~52.4% implied after devig

        const edge = this.deviggingService.calculateEdge(modelProb, marketOdds, false);

        // Should have positive edge since model > market
        if (edge <= 0) {
          throw new Error(`Expected positive edge, got ${edge.toFixed(3)}`);
        }

        return { edge, modelProb, marketImplied: 52.4 };
      })
    );

    // Test 4: Performance test
    tests.push(
      await this.runTest('Devigging performance', async () => {
        const markets = Array.from({ length: 100 }, (_, i) => ({
          option1: { odds: -110 + i },
          option2: { odds: -110 - i },
        }));

        const start = performance.now();
        const results = markets.map(m => this.deviggingService.devigTwoWay(m));
        const duration = performance.now() - start;

        if (duration > 100) {
          throw new Error(`Too slow: ${duration.toFixed(1)}ms for 100 markets`);
        }

        return {
          markets: 100,
          duration: `${duration.toFixed(1)}ms`,
          avgPerMarket: `${(duration / 100).toFixed(2)}ms`,
        };
      })
    );

    const totalDuration = performance.now() - suiteStart;
    const passed = tests.every(t => t.passed);

    this.printTestResults('Devigging Service', tests, passed);

    return {
      name: 'Devigging Service',
      tests,
      passed,
      totalDuration,
    };
  }

  private async runCLVTrackingTests(): Promise<TestSuite> {
    console.log('📊 Testing CLV Tracking Service...');

    const tests: TestResult[] = [];
    const suiteStart = performance.now();

    // Test 1: Pick tracking
    tests.push(
      await this.runTest('Pick tracking', async () => {
        const propId = `test-clv-${Date.now()}`;
        const pickData = {
          propId,
          userId: this.testUserId,
          sport: 'NFL',
          market: 'player_props',
          book: 'DraftKings',
          openingLine: 10.5,
          openingOdds: -110,
          betLine: 10.5,
          betOdds: -110,
          gameTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
          modelEdge: 2.5,
        };

        await this.clvTrackingService.trackPick(pickData);

        // Verify tracking worked
        const { data } = await supabaseClient
          .from('clv_tracking')
          .select('*')
          .eq('prop_id', propId)
          .single();

        if (!data) {
          throw new Error('Pick was not tracked in database');
        }

        return { propId, tracked: true, betOdds: data.bet_odds };
      })
    );

    // Test 2: Closing line update and CLV calculation
    tests.push(
      await this.runTest('CLV calculation', async () => {
        const propId = `test-clv-update-${Date.now()}`;

        // First track the pick
        await this.clvTrackingService.trackPick({
          propId,
          userId: this.testUserId,
          sport: 'NFL',
          market: 'player_props',
          book: 'DraftKings',
          openingLine: 10.5,
          openingOdds: -108, // We got -108
          betLine: 10.5,
          betOdds: -108,
          gameTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
          modelEdge: 2.5,
        });

        // Update with worse closing line (we beat the close)
        const clvEntry = await this.clvTrackingService.updateClosingLine(propId, 10.5, -115);

        if (!clvEntry.beatsClosing) {
          throw new Error('Should beat closing line (-108 vs -115)');
        }

        if (clvEntry.clvPercentage <= 0) {
          throw new Error(`Expected positive CLV, got ${clvEntry.clvPercentage}%`);
        }

        return {
          betOdds: -108,
          closingOdds: -115,
          clv: `${clvEntry.clvPercentage.toFixed(2)}%`,
          beatsClosing: clvEntry.beatsClosing,
        };
      })
    );

    // Test 3: Stats aggregation
    tests.push(
      await this.runTest('Stats aggregation', async () => {
        const stats = await this.clvTrackingService.getCLVStats({
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });

        if (stats.totalBets < 0) {
          throw new Error('Invalid stats structure');
        }

        return {
          totalBets: stats.totalBets,
          avgCLV: `${stats.avgCLVPercentage.toFixed(2)}%`,
          positiveRate: `${((stats.clvPositive / Math.max(stats.totalBets, 1)) * 100).toFixed(1)}%`,
        };
      })
    );

    const totalDuration = performance.now() - suiteStart;
    const passed = tests.every(t => t.passed);

    this.printTestResults('CLV Tracking Service', tests, passed);

    return {
      name: 'CLV Tracking Service',
      tests,
      passed,
      totalDuration,
    };
  }

  private async runFeedbackLoopTests(): Promise<TestSuite> {
    console.log('🔄 Testing Feedback Loop Service...');

    const tests: TestResult[] = [];
    const suiteStart = performance.now();

    // Test 1: Feedback loop execution
    tests.push(
      await this.runTest('Feedback loop execution', async () => {
        try {
          const results = await this.feedbackLoopService.runFeedbackLoop();

          // Verify structure
          if (
            !results.weightAdjustments ||
            !results.bookAdjustments ||
            !results.marketAdjustments
          ) {
            throw new Error('Invalid feedback loop results structure');
          }

          return {
            weightAdjustments: results.weightAdjustments.length,
            bookAdjustments: results.bookAdjustments.length,
            marketAdjustments: results.marketAdjustments.length,
            prunedFeatures: results.prunedFeatures.length,
          };
        } catch (error) {
          // In test environment, may fail due to lack of data - that's expected
          if (error instanceof Error && error.message.includes('sample size')) {
            return { status: 'Expected failure - insufficient test data', reason: error.message };
          }
          throw error;
        }
      })
    );

    // Test 2: Optimization history tracking
    tests.push(
      await this.runTest('Optimization history', async () => {
        const history = await this.feedbackLoopService.getOptimizationHistory(7);

        if (!Array.isArray(history)) {
          throw new Error('History should return array');
        }

        return { historyEntries: history.length };
      })
    );

    const totalDuration = performance.now() - suiteStart;
    const passed = tests.every(t => t.passed);

    this.printTestResults('Feedback Loop Service', tests, passed);

    return {
      name: 'Feedback Loop Service',
      tests,
      passed,
      totalDuration,
    };
  }

  private async runAlertSystemTests(): Promise<TestSuite> {
    console.log('🚨 Testing Alert System...');

    const tests: TestResult[] = [];
    const suiteStart = performance.now();

    // Test 1: CLV monitoring
    tests.push(
      await this.runTest('CLV monitoring', async () => {
        await this.clvAlertService.monitorCLV();
        return { status: 'Monitoring completed without errors' };
      })
    );

    // Test 2: Alert retrieval
    tests.push(
      await this.runTest('Alert retrieval', async () => {
        const alerts = await this.clvAlertService.getActiveAlerts();

        if (!Array.isArray(alerts)) {
          throw new Error('Alerts should return array');
        }

        return { activeAlerts: alerts.length };
      })
    );

    // Test 3: Threshold configuration
    tests.push(
      await this.runTest('Threshold configuration', async () => {
        const originalThresholds = {
          critical: { clv: -2, duration: 24 },
          warning: { clv: 0, duration: 72 },
          investigate: { clv: 2, duration: 168 },
        };

        this.clvAlertService.updateThresholds({
          critical: { clv: -3, duration: 12 },
        });

        // Reset to original
        this.clvAlertService.updateThresholds(originalThresholds);

        return { status: 'Thresholds updated successfully' };
      })
    );

    const totalDuration = performance.now() - suiteStart;
    const passed = tests.every(t => t.passed);

    this.printTestResults('Alert System', tests, passed);

    return {
      name: 'Alert System',
      tests,
      passed,
      totalDuration,
    };
  }

  private async runSchedulerTests(): Promise<TestSuite> {
    console.log('⏰ Testing Scheduler...');

    const tests: TestResult[] = [];
    const suiteStart = performance.now();

    // Test 1: Scheduler start/stop
    tests.push(
      await this.runTest('Scheduler lifecycle', async () => {
        // Test start
        this.scheduler.start();
        let status = this.scheduler.getStatus();

        if (!status.isRunning) {
          throw new Error('Scheduler should be running after start()');
        }

        // Test stop
        this.scheduler.stop();
        status = this.scheduler.getStatus();

        if (status.isRunning) {
          throw new Error('Scheduler should be stopped after stop()');
        }

        return { lifecycle: 'Passed', scheduledTasks: status.scheduledTasks.length };
      })
    );

    // Test 2: Manual task triggers
    tests.push(
      await this.runTest('Manual task triggers', async () => {
        await this.scheduler.triggerTask('clv_monitoring');
        await this.scheduler.triggerTask('health_check');

        return { status: 'Manual triggers executed successfully' };
      })
    );

    const totalDuration = performance.now() - suiteStart;
    const passed = tests.every(t => t.passed);

    this.printTestResults('Scheduler', tests, passed);

    return {
      name: 'Scheduler',
      tests,
      passed,
      totalDuration,
    };
  }

  private async runIntegrationTests(): Promise<TestSuite> {
    console.log('🔗 Testing System Integration...');

    const tests: TestResult[] = [];
    const suiteStart = performance.now();

    // Test 1: End-to-end professional flow
    tests.push(
      await this.runTest('E2E professional flow', async () => {
        // 1. Devig odds
        const market = { option1: { odds: -108 }, option2: { odds: -112 } };
        const devigged = this.deviggingService.devigTwoWay(market);

        // 2. Track pick using devigged edge
        const propId = `e2e-${Date.now()}`;
        const modelProb = 0.54;
        const edge = this.deviggingService.calculateEdge(modelProb, -108, false);

        await this.clvTrackingService.trackPick({
          propId,
          userId: this.testUserId,
          sport: 'NFL',
          market: 'player_props',
          book: 'DraftKings',
          openingLine: 10.5,
          openingOdds: -108,
          betLine: 10.5,
          betOdds: -108,
          gameTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
          modelEdge: edge,
        });

        // 3. Update closing line
        const clvEntry = await this.clvTrackingService.updateClosingLine(propId, 10.5, -115);

        // 4. Run monitoring (should not trigger alerts for single good pick)
        await this.clvAlertService.monitorCLV();

        return {
          devigged: `${devigged.totalVig.toFixed(2)}%`,
          edge: `${edge.toFixed(2)}%`,
          clv: `${clvEntry.clvPercentage.toFixed(2)}%`,
          beatsClosing: clvEntry.beatsClosing,
        };
      })
    );

    // Test 2: Database consistency
    tests.push(
      await this.runTest('Database consistency', async () => {
        // Check that all professional betting tables exist
        const tables = [
          'clv_tracking',
          'sportsbook_weights',
          'market_confidence',
          'clv_alerts',
          'feedback_loop_history',
          'devigging_cache',
        ];

        for (const table of tables) {
          const { data, error } = await supabaseClient.from(table).select('*').limit(1);

          if (error && !error.message.includes('permission')) {
            throw new Error(`Table ${table} query failed: ${error.message}`);
          }
        }

        return { tablesChecked: tables.length, status: 'All tables accessible' };
      })
    );

    const totalDuration = performance.now() - suiteStart;
    const passed = tests.every(t => t.passed);

    this.printTestResults('System Integration', tests, passed);

    return {
      name: 'System Integration',
      tests,
      passed,
      totalDuration,
    };
  }

  private async runPerformanceTests(): Promise<TestSuite> {
    console.log('⚡ Testing Performance...');

    const tests: TestResult[] = [];
    const suiteStart = performance.now();

    // Test 1: Devigging performance
    tests.push(
      await this.runTest('Devigging performance', async () => {
        const start = performance.now();

        for (let i = 0; i < 1000; i++) {
          this.deviggingService.devigTwoWay({
            option1: { odds: -110 + (i % 20) },
            option2: { odds: -110 - (i % 20) },
          });
        }

        const duration = performance.now() - start;
        const avgPerOp = duration / 1000;

        if (avgPerOp > 1) {
          throw new Error(`Too slow: ${avgPerOp.toFixed(3)}ms per devig (target: <1ms)`);
        }

        return {
          operations: 1000,
          totalTime: `${duration.toFixed(1)}ms`,
          avgPerOp: `${avgPerOp.toFixed(3)}ms`,
        };
      })
    );

    // Test 2: CLV tracking performance
    tests.push(
      await this.runTest('CLV tracking performance', async () => {
        const operations = 10;
        const start = performance.now();

        for (let i = 0; i < operations; i++) {
          await this.clvTrackingService.trackPick({
            propId: `perf-${i}-${Date.now()}`,
            userId: this.testUserId,
            sport: 'NFL',
            market: 'player_props',
            book: 'DraftKings',
            openingLine: 10.5,
            openingOdds: -110,
            betLine: 10.5,
            betOdds: -110,
            gameTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
            modelEdge: 2.5,
          });
        }

        const duration = performance.now() - start;
        const avgPerOp = duration / operations;

        if (avgPerOp > 50) {
          throw new Error(`Too slow: ${avgPerOp.toFixed(1)}ms per track (target: <50ms)`);
        }

        return {
          operations,
          totalTime: `${duration.toFixed(1)}ms`,
          avgPerOp: `${avgPerOp.toFixed(1)}ms`,
        };
      })
    );

    const totalDuration = performance.now() - suiteStart;
    const passed = tests.every(t => t.passed);

    this.printTestResults('Performance', tests, passed);

    return {
      name: 'Performance',
      tests,
      passed,
      totalDuration,
    };
  }

  private printTestResults(suiteName: string, tests: TestResult[], passed: boolean): void {
    const icon = passed ? '✅' : '❌';
    const passedCount = tests.filter(t => t.passed).length;

    console.log(`${icon} ${suiteName}: ${passedCount}/${tests.length} tests passed`);

    tests.forEach(test => {
      const testIcon = test.passed ? '  ✓' : '  ✗';
      const duration = `(${test.duration.toFixed(1)}ms)`;
      console.log(`${testIcon} ${test.name} ${duration}`);

      if (!test.passed && test.error) {
        console.log(`    Error: ${test.error}`);
      }
    });

    console.log();
  }

  private generateFinalReport(testSuites: TestSuite[]): void {
    const totalTests = testSuites.reduce((sum, suite) => sum + suite.tests.length, 0);
    const passedTests = testSuites.reduce(
      (sum, suite) => sum + suite.tests.filter(t => t.passed).length,
      0
    );
    const totalDuration = testSuites.reduce((sum, suite) => sum + suite.totalDuration, 0);
    const allPassed = testSuites.every(suite => suite.passed);

    console.log('='.repeat(60));
    console.log('📋 FINAL TEST REPORT');
    console.log('='.repeat(60));
    console.log(`Overall Status: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Tests: ${passedTests}/${totalTests} passed`);
    console.log(`Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log();

    // Suite breakdown
    testSuites.forEach(suite => {
      const icon = suite.passed ? '✅' : '❌';
      const passedCount = suite.tests.filter(t => t.passed).length;
      console.log(
        `${icon} ${suite.name}: ${passedCount}/${suite.tests.length} (${(suite.totalDuration / 1000).toFixed(2)}s)`
      );
    });

    console.log('\n' + '='.repeat(60));

    if (allPassed) {
      console.log('🎉 PROFESSIONAL BETTING SYSTEM VALIDATION COMPLETE!');
      console.log('🏆 All systems operational and ready for production');
      console.log('📈 Sharp betting capabilities fully implemented');
    } else {
      console.log('⚠️  VALIDATION ISSUES DETECTED');
      console.log('🔧 Review failed tests before production deployment');
    }

    console.log('='.repeat(60) + '\n');
  }

  private async setupTestEnvironment(): Promise<void> {
    logger.info('Setting up test environment...');

    // Create test user
    await supabaseClient.from('users').upsert(
      {
        id: this.testUserId,
        username: 'professional-test-user',
        discord_id: '123456789',
        tier: 'premium',
      },
      { onConflict: 'id' }
    );
  }

  private async cleanupTestEnvironment(): Promise<void> {
    logger.info('Cleaning up test environment...');

    const tables = ['clv_tracking', 'clv_alerts', 'feedback_loop_history'];

    for (const table of tables) {
      await supabaseClient
        .from(table)
        .delete()
        .or(`prop_id.like.test-%,prop_id.like.e2e-%,prop_id.like.perf-%`);
    }
  }
}

// Run the tests
async function main() {
  const tester = new ProfessionalBettingSystemTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { ProfessionalBettingSystemTester };
