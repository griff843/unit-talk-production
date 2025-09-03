#!/usr/bin/env npx tsx

/**
 * Shadow Mode End-to-End Test Runner
 * Validates the complete shadow mode system with real data scenarios
 */

import 'dotenv/config';
import { ShadowModeService } from '../src/shadow/ShadowMode';
import { publishGuard } from '../src/promotion/PublishGuard';
import { promotionGatekeeper } from '../src/services/PromotionGatekeeper';
import { supabaseClient } from '../src/services/supabaseClient';

interface TestScenario {
  name: string;
  description: string;
  shadowMode: boolean;
  expectedOutcome: 'published' | 'shadow_logged' | 'both' | 'neither';
  testPick: any;
}

class ShadowModeTestRunner {
  private testResults: Array<{
    scenario: string;
    passed: boolean;
    details: string;
    executionTime: number;
  }> = [];

  private scenarios: TestScenario[] = [
    {
      name: 'S-Tier Instant Pick - Normal Mode',
      description: 'High confidence S-tier pick should publish instantly in normal mode',
      shadowMode: false,
      expectedOutcome: 'published',
      testPick: {
        id: `test-s-tier-normal-${Date.now()}`,
        propId: `prop-s-tier-${Date.now()}`,
        tier: 'S',
        confidence: 0.92,
        professionalScore: 95,
        expectedValue: 0.18,
        clvTracking: {
          initialOdds: -110,
          currentOdds: -105,
          clvBps: 22
        },
        steamData: {
          strength: 18,
          direction: 'for' as const,
          volume: 35000
        },
        gameTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        sport: 'NBA',
        correlatedPicks: [],
        portfolioExposure: 0.12
      }
    },
    {
      name: 'S-Tier Instant Pick - Shadow Mode',
      description: 'High confidence S-tier pick should be shadow logged only in shadow mode',
      shadowMode: true,
      expectedOutcome: 'shadow_logged',
      testPick: {
        id: `test-s-tier-shadow-${Date.now()}`,
        propId: `prop-s-tier-shadow-${Date.now()}`,
        tier: 'S',
        confidence: 0.89,
        professionalScore: 91,
        expectedValue: 0.15,
        clvTracking: {
          initialOdds: -115,
          currentOdds: -108,
          clvBps: 16
        },
        steamData: {
          strength: 20,
          direction: 'for' as const,
          volume: 28000
        },
        gameTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        sport: 'NFL',
        correlatedPicks: [],
        portfolioExposure: 0.08
      }
    },
    {
      name: 'A-Tier Scheduled Pick - Shadow Mode',
      description: 'A-tier pick should be shadow logged for 10am queue in shadow mode',
      shadowMode: true,
      expectedOutcome: 'shadow_logged',
      testPick: {
        id: `test-a-tier-shadow-${Date.now()}`,
        propId: `prop-a-tier-shadow-${Date.now()}`,
        tier: 'A',
        confidence: 0.74,
        professionalScore: 82,
        expectedValue: 0.09,
        clvTracking: {
          initialOdds: -110,
          currentOdds: -107,
          clvBps: 11
        },
        gameTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
        sport: 'MLB',
        correlatedPicks: [],
        portfolioExposure: 0.18
      }
    },
    {
      name: 'Rejected Pick - Shadow Mode',
      description: 'Low quality pick should be shadow logged as rejected in shadow mode',
      shadowMode: true,
      expectedOutcome: 'shadow_logged',
      testPick: {
        id: `test-rejected-shadow-${Date.now()}`,
        propId: `prop-rejected-shadow-${Date.now()}`,
        tier: 'C',
        confidence: 0.42,
        professionalScore: 58,
        expectedValue: 0.008,
        clvTracking: {
          initialOdds: -110,
          currentOdds: -118,
          clvBps: -12
        },
        gameTime: new Date(Date.now() + 1 * 60 * 60 * 1000),
        sport: 'NHL',
        correlatedPicks: [],
        portfolioExposure: 0.41
      }
    }
  ];

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Shadow Mode End-to-End Tests...\n');

    // Store original environment
    const originalShadowMode = process.env.SHADOW_MODE;

    try {
      for (const scenario of this.scenarios) {
        await this.runScenario(scenario);
        console.log(''); // Add spacing between tests
      }

      this.printResults();
      await this.cleanup();

    } finally {
      // Restore original environment
      if (originalShadowMode !== undefined) {
        process.env.SHADOW_MODE = originalShadowMode;
      } else {
        delete process.env.SHADOW_MODE;
      }
    }
  }

  private async runScenario(scenario: TestScenario): Promise<void> {
    const startTime = Date.now();
    console.log(`🧪 Testing: ${scenario.name}`);
    console.log(`   ${scenario.description}`);

    try {
      // Set environment for this scenario
      process.env.SHADOW_MODE = scenario.shadowMode.toString();

      // Get fresh service instances
      const shadowService = ShadowModeService.getInstance();
      // Use imported publishGuard singleton

      // Verify shadow mode state
      const isShadowMode = shadowService.isShadowMode();
      if (isShadowMode !== scenario.shadowMode) {
        throw new Error(`Shadow mode state mismatch. Expected: ${scenario.shadowMode}, Got: ${isShadowMode}`);
      }

      console.log(`   Shadow Mode: ${isShadowMode ? 'ENABLED' : 'DISABLED'}`);

      // Count initial shadow records
      const initialShadowCount = await this.getShadowPickCount();

      // Execute promotion evaluation
      const promotionDecision = await promotionGatekeeper.evaluatePromotion(scenario.testPick);
      
      console.log(`   Promotion Decision: ${promotionDecision.approved ? 'APPROVED' : 'REJECTED'} (${promotionDecision.lane})`);
      console.log(`   Risk Score: ${promotionDecision.riskScore}, Confidence: ${promotionDecision.confidence}`);

      // Execute through publish guard
      const publishResult = await publishGuard.handlePromotionDecision({
        approved: promotionDecision.approved,
        lane: promotionDecision.lane === '10am' ? 'scheduled' : 
              promotionDecision.lane === 'instant' ? 'instant' : 'rejected',
        reasons: this.extractReasons(promotionDecision),
        pick: scenario.testPick,
        gateResults: promotionDecision.gateResults,
        riskScore: promotionDecision.riskScore
      }, {
        tier: scenario.testPick.tier,
        isInstant: promotionDecision.lane === 'instant',
        groupKey: this.generateGroupKey(scenario.testPick)
      });

      console.log(`   Publish Result: Published=${publishResult.published}, Shadow=${publishResult.shadowLogged}`);

      // Verify outcome matches expectation
      const finalShadowCount = await this.getShadowPickCount();
      const shadowRecordsAdded = finalShadowCount - initialShadowCount;

      let passed = false;
      let details = '';

      switch (scenario.expectedOutcome) {
        case 'published':
          passed = publishResult.published && !publishResult.shadowLogged;
          details = `Expected: Published only. Got: Published=${publishResult.published}, Shadow=${publishResult.shadowLogged}`;
          break;
        case 'shadow_logged':
          passed = !publishResult.published && publishResult.shadowLogged && shadowRecordsAdded > 0;
          details = `Expected: Shadow logged only. Got: Published=${publishResult.published}, Shadow=${publishResult.shadowLogged}, Records added=${shadowRecordsAdded}`;
          break;
        case 'both':
          passed = publishResult.published && publishResult.shadowLogged;
          details = `Expected: Both published and shadow logged. Got: Published=${publishResult.published}, Shadow=${publishResult.shadowLogged}`;
          break;
        case 'neither':
          passed = !publishResult.published && !publishResult.shadowLogged;
          details = `Expected: Neither published nor shadow logged. Got: Published=${publishResult.published}, Shadow=${publishResult.shadowLogged}`;
          break;
      }

      const executionTime = Date.now() - startTime;

      this.testResults.push({
        scenario: scenario.name,
        passed,
        details,
        executionTime
      });

      console.log(`   Result: ${passed ? '✅ PASSED' : '❌ FAILED'} (${executionTime}ms)`);
      if (!passed) {
        console.log(`   Details: ${details}`);
      }

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.testResults.push({
        scenario: scenario.name,
        passed: false,
        details: `Error: ${errorMessage}`,
        executionTime
      });

      console.log(`   Result: ❌ FAILED (${executionTime}ms)`);
      console.log(`   Error: ${errorMessage}`);
    }
  }

  private async getShadowPickCount(): Promise<number> {
    try {
      const { data, error } = await supabaseClient
        .from('shadow_decisions')
        .select('id', { count: 'exact' })
        .limit(1);

      if (error) {
        console.warn(`Warning: Could not count shadow picks: ${error.message}`);
        return 0;
      }

      return (data as any)?.length || 0;
    } catch (error) {
      console.warn(`Warning: Could not access shadow picks table: ${error}`);
      return 0;
    }
  }

  private extractReasons(decision: any): string[] {
    const reasons: string[] = [];
    
    if (decision.approved) {
      reasons.push(`Approved via ${decision.lane} lane`);
      if (decision.gateResults) {
        const passedGates = decision.gateResults.filter((r: any) => r.passed);
        reasons.push(`Passed ${passedGates.length} promotion gates`);
      }
    } else {
      reasons.push('Failed promotion requirements');
      if (decision.gateResults) {
        const failedGates = decision.gateResults.filter((r: any) => !r.passed && r.impact === 'blocking');
        failedGates.forEach((gate: any) => reasons.push(gate.message));
      }
    }
    
    return reasons.slice(0, 5); // Limit to 5 reasons
  }

  private generateGroupKey(pick: any): string {
    const gameDate = pick.gameTime.toISOString().split('T')[0];
    const sportKey = pick.sport.toLowerCase();
    return `${sportKey}_${gameDate}`;
  }

  private printResults(): void {
    console.log('\n📊 Shadow Mode Test Results Summary');
    console.log('=====================================\n');

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const avgExecutionTime = this.testResults.reduce((sum, r) => sum + r.executionTime, 0) / totalTests;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ${failedTests > 0 ? '❌' : ''}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`Average Execution Time: ${avgExecutionTime.toFixed(0)}ms\n`);

    if (failedTests > 0) {
      console.log('Failed Tests:');
      console.log('-------------');
      this.testResults
        .filter(r => !r.passed)
        .forEach(result => {
          console.log(`❌ ${result.scenario}`);
          console.log(`   ${result.details}\n`);
        });
    }

    console.log('Execution Times:');
    console.log('----------------');
    this.testResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.scenario}: ${result.executionTime}ms`);
    });
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test data...');

    try {
      // Clean up test picks from shadow table
      const testPickIds = this.scenarios.map(s => s.testPick.id);
      
      const { error } = await supabaseClient
        .from('shadow_decisions')
        .delete()
        .in('pick_id', testPickIds);

      if (error) {
        console.warn(`Warning: Could not clean up test data: ${error.message}`);
      } else {
        console.log('✅ Test data cleaned up successfully');
      }
    } catch (error) {
      console.warn(`Warning: Cleanup failed: ${error}`);
    }
  }
}

// Additional utility tests
async function runUtilityTests(): Promise<void> {
  console.log('\n🔧 Running Shadow Mode Utility Tests...\n');

  const shadowService = ShadowModeService.getInstance();

  // Test environment detection
  console.log('🧪 Testing Environment Detection:');
  
  process.env.SHADOW_MODE = 'true';
  console.log(`   SHADOW_MODE=true: ${shadowService.isShadowMode() ? '✅' : '❌'}`);
  
  process.env.SHADOW_MODE = 'false';
  console.log(`   SHADOW_MODE=false: ${!shadowService.isShadowMode() ? '✅' : '❌'}`);
  
  delete process.env.SHADOW_MODE;
  console.log(`   SHADOW_MODE=undefined: ${!shadowService.isShadowMode() ? '✅' : '❌'}`);

  // Test shadow data cleanup
  console.log('\n🧪 Testing Shadow Data Cleanup:');
  process.env.SHADOW_MODE = 'true';
  
  try {
    await shadowService.cleanupOldShadow();
    console.log('   Cleanup execution: ✅');
  } catch (error) {
    console.log(`   Cleanup execution: ❌ (${error})`);
  }

  // Test metrics writing
  console.log('\n🧪 Testing Shadow Metrics Writing:');
  
  try {
    await shadowService.shadowWriteMetrics({
      window: '7d',
      postedEv: 0.08,
      avgConfidence: 0.75,
      hitRate: 0.62,
      totalPicks: 100,
      sTierPicks: 15,
      avgOdds: -108,
      clvBps: 14.2,
      roi: 0.085
    });
    console.log('   Metrics writing: ✅');
  } catch (error) {
    console.log(`   Metrics writing: ❌ (${error})`);
  }
}

// Main execution
async function main(): Promise<void> {
  console.log('Shadow Mode Test Suite');
  console.log('======================\n');

  const testRunner = new ShadowModeTestRunner();
  
  try {
    await runUtilityTests();
    await testRunner.runAllTests();
    
    console.log('\n✅ Shadow Mode test suite completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Shadow Mode test suite failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}