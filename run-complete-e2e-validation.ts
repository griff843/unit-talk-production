#!/usr/bin/env tsx

/**
 * COMPLETE E2E VALIDATION RUNNER
 *
 * Executes all validation tests for the Unit Talk platform:
 * 1. Comprehensive E2E Pipeline Test
 * 2. Enhanced45Factor Scoring System Test
 * 3. Generates consolidated report with actionable recommendations
 *
 * Usage: npx tsx run-complete-e2e-validation.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

interface ValidationResult {
  testName: string;
  success: boolean;
  output: string;
  executionTimeMs: number;
  errors: string[];
}

class CompleteE2EValidationRunner {
  private results: ValidationResult[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  async runAllValidations(): Promise<void> {
    console.log('🚀 UNIT TALK COMPLETE E2E VALIDATION SUITE');
    console.log('==========================================');
    console.log('Running comprehensive validation of entire platform pipeline');
    console.log(`Start Time: ${new Date().toISOString()}`);
    console.log('==========================================\n');

    // Run Enhanced45Factor validation first (identifies core issues)
    await this.runValidation(
      'Enhanced45Factor Scoring System',
      'npx tsx enhanced45factor-scoring-test.ts'
    );

    // Run comprehensive E2E validation
    await this.runValidation(
      'Complete E2E Pipeline',
      'npx tsx comprehensive-e2e-pipeline-test.ts'
    );

    // Generate consolidated report
    this.generateConsolidatedReport();
  }

  private async runValidation(testName: string, command: string): Promise<void> {
    const stepStart = Date.now();
    console.log(`\n🔍 Running: ${testName}`);
    console.log('='.repeat(testName.length + 10));

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 300000, // 5 minute timeout
        cwd: process.cwd()
      });

      const output = stdout + (stderr ? `\nErrors:\n${stderr}` : '');
      const executionTime = Date.now() - stepStart;

      this.recordValidationResult(testName, true, output, executionTime, []);
      console.log(`✅ ${testName} completed successfully in ${(executionTime/1000).toFixed(1)}s`);

    } catch (error) {
      const executionTime = Date.now() - stepStart;
      const errorOutput = error instanceof Error ? error.message : String(error);
      const stdout = (error as any).stdout || '';
      const stderr = (error as any).stderr || '';

      const fullOutput = `${stdout}\n${stderr}\n${errorOutput}`;
      const errors = this.extractErrors(fullOutput);

      this.recordValidationResult(testName, false, fullOutput, executionTime, errors);
      console.log(`❌ ${testName} failed after ${(executionTime/1000).toFixed(1)}s`);

      // Show key errors without full output spam
      if (errors.length > 0) {
        console.log('Key errors found:');
        errors.slice(0, 3).forEach(err => console.log(`   • ${err}`));
        if (errors.length > 3) {
          console.log(`   ... and ${errors.length - 3} more errors`);
        }
      }
    }
  }

  private recordValidationResult(
    testName: string,
    success: boolean,
    output: string,
    executionTimeMs: number,
    errors: string[]
  ): void {
    this.results.push({
      testName,
      success,
      output,
      executionTimeMs,
      errors
    });
  }

  private extractErrors(output: string): string[] {
    const errors: string[] = [];

    // Extract common error patterns
    const errorPatterns = [
      /professional_score is not defined/g,
      /sports_game_odds.*player_name/g,
      /table.*does not exist/gi,
      /column.*does not exist/gi,
      /connection.*failed/gi,
      /service.*not responding/gi,
      /agent.*not running/gi,
      /no props.*graded/gi,
      /scoring.*failed/gi,
      /discord.*integration.*broken/gi
    ];

    for (const pattern of errorPatterns) {
      const matches = output.match(pattern);
      if (matches) {
        errors.push(...matches.slice(0, 2)); // Limit to 2 matches per pattern
      }
    }

    // Extract ERROR/CRITICAL messages
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('❌') || line.includes('CRITICAL') || line.includes('ERROR')) {
        const cleanLine = line.replace(/^\s*[❌⚠️🚨]*\s*/, '').trim();
        if (cleanLine && cleanLine.length > 10) {
          errors.push(cleanLine);
        }
      }
    }

    return errors.slice(0, 10); // Limit to 10 most important errors
  }

  private generateConsolidatedReport(): void {
    const totalTime = Date.now() - this.startTime;
    const successfulTests = this.results.filter(r => r.success).length;
    const failedTests = this.results.filter(r => !r.success).length;
    const overallSuccess = failedTests === 0;

    console.log('\n'.repeat(3));
    console.log('📋 CONSOLIDATED E2E VALIDATION REPORT');
    console.log('=====================================');
    console.log(`Validation Suite: COMPLETE UNIT TALK PLATFORM`);
    console.log(`Executed: ${new Date().toISOString()}`);
    console.log(`Total Duration: ${(totalTime/1000).toFixed(1)} seconds`);
    console.log(`Overall Status: ${overallSuccess ? '✅ SYSTEM HEALTHY' : '❌ CRITICAL ISSUES FOUND'}`);
    console.log(`Test Results: ${successfulTests} passed, ${failedTests} failed`);
    console.log('=====================================\n');

    // Test-by-test summary
    console.log('📊 VALIDATION RESULTS:');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const duration = (result.executionTimeMs/1000).toFixed(1);
      console.log(`   ${status} ${result.testName} (${duration}s)`);

      if (!result.success && result.errors.length > 0) {
        result.errors.slice(0, 2).forEach(error => {
          console.log(`      ⚠️ ${error.substring(0, 80)}${error.length > 80 ? '...' : ''}`);
        });
      }
    });

    // Critical issues summary
    const allErrors = this.results.flatMap(r => r.errors);
    const criticalIssues = this.identifyCriticalIssues(allErrors);

    if (criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES BLOCKING E2E PIPELINE:');
      criticalIssues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }

    // Priority recommendations
    const recommendations = this.generatePriorityRecommendations(allErrors);
    if (recommendations.length > 0) {
      console.log('\n💡 PRIORITY FIX RECOMMENDATIONS:');
      recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }

    // System health assessment
    this.generateSystemHealthAssessment(overallSuccess, criticalIssues.length);

    console.log('\n=====================================');
    console.log(`🎯 NEXT STEPS: ${overallSuccess ? 'System operational - monitor performance' : 'Address critical issues above'}`);
    console.log('=====================================\n');
  }

  private identifyCriticalIssues(errors: string[]): string[] {
    const criticalIssues: string[] = [];

    // Check for database schema issues
    if (errors.some(e => e.includes('player_name') || e.includes('column does not exist'))) {
      criticalIssues.push('Database schema missing required columns - FeedAgent will fail');
    }

    // Check for scoring pipeline issues
    if (errors.some(e => e.includes('professional_score is not defined'))) {
      criticalIssues.push('ScoringAgent has "professional_score is not defined" errors - Enhanced45Factor broken');
    }

    // Check for data ingestion issues
    if (errors.some(e => e.includes('No props') && e.includes('graded'))) {
      criticalIssues.push('No props successfully processed through complete pipeline');
    }

    // Check for service connectivity
    if (errors.some(e => e.includes('connection failed') || e.includes('not responding'))) {
      criticalIssues.push('Core services (database, APIs) not accessible');
    }

    // Check for Discord integration
    if (errors.some(e => e.includes('Discord') && (e.includes('integration') || e.includes('not functioning')))) {
      criticalIssues.push('Discord integration broken - approved props not posting');
    }

    return criticalIssues;
  }

  private generatePriorityRecommendations(errors: string[]): string[] {
    const recommendations: string[] = [];

    // Database fixes (highest priority)
    if (errors.some(e => e.includes('player_name') || e.includes('schema'))) {
      recommendations.push('Run database migration: ALTER TABLE sports_game_odds ADD COLUMN player_name TEXT;');
    }

    // Enhanced45Factor fixes
    if (errors.some(e => e.includes('professional_score is not defined'))) {
      recommendations.push('Set USE_ENHANCED_45_FACTOR=true and restart ScoringAgent service');
    }

    // Service restart recommendations
    if (errors.some(e => e.includes('not running') || e.includes('failed'))) {
      recommendations.push('Restart all agents: ./dev.sh restart');
    }

    // Pipeline flow fixes
    if (errors.some(e => e.includes('No props') || e.includes('unscored'))) {
      recommendations.push('Check FeedAgent ingestion and ScoringAgent processing logs');
    }

    // Discord fixes
    if (errors.some(e => e.includes('Discord'))) {
      recommendations.push('Verify Discord bot permissions and webhook configuration');
    }

    // Environment setup
    if (recommendations.length > 2) {
      recommendations.push('Verify all environment variables are set correctly');
    }

    return recommendations.slice(0, 5); // Top 5 most important
  }

  private generateSystemHealthAssessment(overallSuccess: boolean, criticalIssuesCount: number): void {
    console.log('\n🏥 SYSTEM HEALTH ASSESSMENT:');

    if (overallSuccess) {
      console.log('   🟢 Status: HEALTHY - Complete pipeline operational');
      console.log('   📈 Data Flow: FeedAgent → ScoringAgent → Command Center → Discord');
      console.log('   🎯 Recommendation: Monitor performance and continue normal operations');
    } else if (criticalIssuesCount <= 2) {
      console.log('   🟡 Status: DEGRADED - Pipeline partially functional');
      console.log('   ⚠️ Impact: Some components working, others need attention');
      console.log('   🔧 Recommendation: Address specific issues to restore full functionality');
    } else {
      console.log('   🔴 Status: CRITICAL - Multiple pipeline failures');
      console.log('   🚨 Impact: E2E pipeline likely not functioning');
      console.log('   🆘 Recommendation: Immediate intervention required - follow fix recommendations');
    }
  }
}

// Execute the complete validation suite
async function main() {
  try {
    const runner = new CompleteE2EValidationRunner();
    await runner.runAllValidations();

    // Exit with appropriate code based on results
    const hasFailures = runner['results'].some((r: any) => !r.success);
    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error('❌ Complete E2E validation failed:', (error as Error).message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { CompleteE2EValidationRunner };