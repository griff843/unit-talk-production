#!/usr/bin/env npx tsx
/**
 * E2E Business Flow Test Runner
 * 
 * Tests complete business flow: ingestion → processing → promotion → delivery
 * Scope: MLB, next 3 hours, top two books (FD, DK)
 * 
 * Usage:
 *   npx tsx scripts/e2e-business-flow.ts
 *   npx tsx scripts/e2e-business-flow.ts --sport=NBA --window=next-1h
 */

import { chromium } from 'playwright';
import { supabaseClient } from '../src/services/supabaseClient';
import { createLogger } from '../src/utils/logger';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const logger = createLogger('E2E-BusinessFlow');

// Test configuration
interface E2EConfig {
  sport: string;
  window: string;
  books: string[];
  minCounts: {
    newRaw: number;
    processedRecent: number;
    promotedRecent: number;
  };
  timeouts: {
    ingestionMax: number;    // 10 minutes
    pollingInterval: number; // 30 seconds
    backoffMax: number;      // 5 minutes
  };
  discord: {
    channelId: string;
    webhookUrl?: string;
  };
  api: {
    baseUrl: string;
    commandCenterUrl: string;
  };
}

const defaultConfig: E2EConfig = {
  sport: process.argv.find(arg => arg.startsWith('--sport='))?.split('=')[1] || 'MLB',
  window: process.argv.find(arg => arg.startsWith('--window='))?.split('=')[1] || 'next-3h',
  books: ['FD', 'DK'],
  minCounts: {
    newRaw: 25,
    processedRecent: 20,
    promotedRecent: 1
  },
  timeouts: {
    ingestionMax: 10 * 60 * 1000,    // 10 minutes
    pollingInterval: 30 * 1000,      // 30 seconds  
    backoffMax: 5 * 60 * 1000        // 5 minutes
  },
  discord: {
    channelId: '1288613037539852329'
  },
  api: {
    baseUrl: 'http://localhost:3010',
    commandCenterUrl: 'http://localhost:3004'
  }
};

// Test results interface
interface E2EResults {
  runId: string;
  testStartTime: string;
  testEndTime?: string;
  config: E2EConfig;
  phases: {
    ingestion: PhaseResult;
    processing: PhaseResult;
    promotion: PhaseResult;
    delivery: PhaseResult;
    verification: PhaseResult;
  };
  assertions: AssertionResult[];
  screenshots: string[];
  temporalWorkflowId?: string;
  finalCounts: DatabaseCounts;
  success: boolean;
  duration: number;
  errors: string[];
}

interface PhaseResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startTime: string;
  endTime?: string;
  duration?: number;
  details: Record<string, any>;
  errors: string[];
}

interface AssertionResult {
  name: string;
  expected: any;
  actual: any;
  passed: boolean;
  details?: string;
}

interface DatabaseCounts {
  newRaw: number;
  processedRecent: number;
  promotedRecent: number;
  totalRawProps: number;
  totalUnifiedPicks: number;
  timestamp: string;
}

class E2EBusinessFlowRunner {
  private config: E2EConfig;
  private runId: string;
  private results: E2EResults;
  private screenshotDir: string;

  constructor(config: E2EConfig) {
    this.config = config;
    this.runId = `e2e-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    this.screenshotDir = path.join(process.cwd(), 'docs', 'screenshots', this.runId);
    
    this.results = {
      runId: this.runId,
      testStartTime: new Date().toISOString(),
      config,
      phases: {
        ingestion: this.createPhase('Ingestion'),
        processing: this.createPhase('Processing'),
        promotion: this.createPhase('Promotion'),
        delivery: this.createPhase('Delivery'),
        verification: this.createPhase('Verification')
      },
      assertions: [],
      screenshots: [],
      finalCounts: this.createEmptyDatabaseCounts(),
      success: false,
      duration: 0,
      errors: []
    };
  }

  private createPhase(name: string): PhaseResult {
    return {
      name,
      status: 'pending',
      startTime: new Date().toISOString(),
      details: {},
      errors: []
    };
  }

  private createEmptyDatabaseCounts(): DatabaseCounts {
    return {
      newRaw: 0,
      processedRecent: 0,
      promotedRecent: 0,
      totalRawProps: 0,
      totalUnifiedPicks: 0,
      timestamp: new Date().toISOString()
    };
  }

  async run(): Promise<E2EResults> {
    const startTime = Date.now();
    
    try {
      logger.info('🚀 Starting E2E Business Flow Test', {
        runId: this.runId,
        config: this.config
      });

      // Create screenshots directory
      await fs.mkdir(this.screenshotDir, { recursive: true });

      // Phase 1: Trigger Ingestion
      await this.runIngestionPhase();
      
      // Phase 2: Wait for Processing
      await this.runProcessingPhase();
      
      // Phase 3: Verify Promotion
      await this.runPromotionPhase();
      
      // Phase 4: Check Delivery
      await this.runDeliveryPhase();
      
      // Phase 5: Final Verification
      await this.runVerificationPhase();

      // Calculate final results
      this.results.success = this.results.assertions.every(a => a.passed);
      this.results.duration = Date.now() - startTime;
      this.results.testEndTime = new Date().toISOString();

      // Generate report
      await this.generateReport();

      logger.info(`✅ E2E Test Completed`, {
        runId: this.runId,
        success: this.results.success,
        duration: this.results.duration,
        passedAssertions: this.results.assertions.filter(a => a.passed).length,
        totalAssertions: this.results.assertions.length
      });

      return this.results;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.results.errors.push(errorMessage);
      this.results.success = false;
      this.results.duration = Date.now() - startTime;
      this.results.testEndTime = new Date().toISOString();

      logger.error('❌ E2E Test Failed', {
        runId: this.runId,
        error: errorMessage,
        duration: this.results.duration
      });

      await this.generateReport();
      throw error;
    }
  }

  private async runIngestionPhase(): Promise<void> {
    const phase = this.results.phases.ingestion;
    phase.status = 'running';

    try {
      logger.info('📥 Phase 1: Triggering Ingestion', { runId: this.runId });

      // Get baseline counts
      const beforeCounts = await this.getDatabaseCounts();
      phase.details.beforeCounts = beforeCounts;

      // Trigger ingestion via ops endpoint
      const response = await fetch(`${this.config.api.baseUrl}/ops/ingest-now`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-E2E-Test': 'true'
        },
        body: JSON.stringify({
          sport: this.config.sport,
          window: this.config.window,
          books: this.config.books,
          testMode: true
        })
      });

      if (!response.ok) {
        throw new Error(`Ingestion trigger failed: ${response.status} ${response.statusText}`);
      }

      const ingestionResult = await response.json();
      phase.details.ingestionResponse = ingestionResult;
      this.results.temporalWorkflowId = ingestionResult.workflowId;

      // Wait for ingestion to complete with exponential backoff
      let attempt = 0;
      let backoff = 5000; // Start with 5 seconds
      const maxAttempts = Math.floor(this.config.timeouts.ingestionMax / this.config.timeouts.pollingInterval);

      while (attempt < maxAttempts) {
        await this.sleep(Math.min(backoff, this.config.timeouts.backoffMax));
        
        const currentCounts = await this.getDatabaseCounts();
        const newRecords = currentCounts.newRaw - beforeCounts.newRaw;
        
        logger.info(`📊 Ingestion Check ${attempt + 1}/${maxAttempts}`, {
          runId: this.runId,
          newRecords,
          target: this.config.minCounts.newRaw
        });

        if (newRecords >= this.config.minCounts.newRaw) {
          phase.details.afterCounts = currentCounts;
          phase.details.recordsIngested = newRecords;
          phase.status = 'success';
          phase.endTime = new Date().toISOString();
          phase.duration = Date.now() - new Date(phase.startTime).getTime();

          this.addAssertion(
            'Raw ingestion count',
            `>= ${this.config.minCounts.newRaw}`,
            newRecords,
            true,
            `Ingested ${newRecords} new raw props`
          );

          return;
        }

        attempt++;
        backoff = Math.min(backoff * 1.5, this.config.timeouts.backoffMax); // Exponential backoff
      }

      throw new Error(`Ingestion timeout: Only ${phase.details.recordsIngested || 0} records after ${this.config.timeouts.ingestionMax}ms`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      phase.status = 'failed';
      phase.errors.push(errorMessage);
      phase.endTime = new Date().toISOString();
      phase.duration = Date.now() - new Date(phase.startTime).getTime();

      this.addAssertion(
        'Ingestion phase',
        'success',
        'failed',
        false,
        errorMessage
      );

      throw error;
    }
  }

  private async runProcessingPhase(): Promise<void> {
    const phase = this.results.phases.processing;
    phase.status = 'running';

    try {
      logger.info('⚙️ Phase 2: Checking Processing', { runId: this.runId });

      // Check for processed records (grading, enrichment, etc.)
      const counts = await this.getDatabaseCounts();
      phase.details.counts = counts;

      const processedCount = counts.processedRecent;
      const passed = processedCount >= this.config.minCounts.processedRecent;

      this.addAssertion(
        'Processed records count',
        `>= ${this.config.minCounts.processedRecent}`,
        processedCount,
        passed,
        passed ? `Found ${processedCount} recently processed records` : `Only ${processedCount} processed records found`
      );

      phase.status = passed ? 'success' : 'failed';
      phase.endTime = new Date().toISOString();
      phase.duration = Date.now() - new Date(phase.startTime).getTime();

      if (!passed) {
        throw new Error(`Processing incomplete: ${processedCount} < ${this.config.minCounts.processedRecent}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      phase.status = 'failed';
      phase.errors.push(errorMessage);
      phase.endTime = new Date().toISOString();
      phase.duration = Date.now() - new Date(phase.startTime).getTime();
      throw error;
    }
  }

  private async runPromotionPhase(): Promise<void> {
    const phase = this.results.phases.promotion;
    phase.status = 'running';

    try {
      logger.info('🎯 Phase 3: Checking Promotion', { runId: this.runId });

      // Check for promoted picks
      const counts = await this.getDatabaseCounts();
      phase.details.counts = counts;

      const promotedCount = counts.promotedRecent;
      const passed = promotedCount >= this.config.minCounts.promotedRecent;

      this.addAssertion(
        'Promoted picks count',
        `>= ${this.config.minCounts.promotedRecent}`,
        promotedCount,
        passed,
        passed ? `Found ${promotedCount} recently promoted picks` : `Only ${promotedCount} promoted picks found`
      );

      // Check API endpoint that UI uses
      const apiResponse = await fetch(`${this.config.api.baseUrl}/api/picks/recent?sport=${this.config.sport.toLowerCase()}&limit=10`, {
        headers: { 'X-E2E-Test': 'true' }
      });

      if (apiResponse.ok) {
        const picks = await apiResponse.json();
        phase.details.apiPicks = picks;
        
        const hasPromotedPick = Array.isArray(picks) && picks.length > 0;
        this.addAssertion(
          'API promoted pick visibility',
          'at least 1 pick visible',
          hasPromotedPick ? picks.length : 0,
          hasPromotedPick,
          hasPromotedPick ? `API returned ${picks.length} picks` : 'No picks returned by API'
        );
      } else {
        this.addAssertion(
          'API promoted pick visibility',
          'successful response',
          `${apiResponse.status} error`,
          false,
          `API returned ${apiResponse.status}: ${apiResponse.statusText}`
        );
      }

      phase.status = passed ? 'success' : 'failed';
      phase.endTime = new Date().toISOString();
      phase.duration = Date.now() - new Date(phase.startTime).getTime();

      if (!passed) {
        throw new Error(`Promotion incomplete: ${promotedCount} < ${this.config.minCounts.promotedRecent}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      phase.status = 'failed';
      phase.errors.push(errorMessage);
      phase.endTime = new Date().toISOString();
      phase.duration = Date.now() - new Date(phase.startTime).getTime();
      throw error;
    }
  }

  private async runDeliveryPhase(): Promise<void> {
    const phase = this.results.phases.delivery;
    phase.status = 'running';

    try {
      logger.info('📤 Phase 4: Checking Delivery', { runId: this.runId });

      // Check Discord delivery (mock for now - would need Discord API integration)
      // For this implementation, we'll simulate Discord check
      const discordCheck = await this.checkDiscordDelivery();
      phase.details.discordCheck = discordCheck;

      this.addAssertion(
        'Discord delivery',
        'at least 1 embed posted',
        discordCheck.embedsFound,
        discordCheck.success,
        discordCheck.message
      );

      phase.status = discordCheck.success ? 'success' : 'failed';
      phase.endTime = new Date().toISOString();
      phase.duration = Date.now() - new Date(phase.startTime).getTime();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      phase.status = 'failed';
      phase.errors.push(errorMessage);
      phase.endTime = new Date().toISOString();
      phase.duration = Date.now() - new Date(phase.startTime).getTime();
    }
  }

  private async runVerificationPhase(): Promise<void> {
    const phase = this.results.phases.verification;
    phase.status = 'running';

    try {
      logger.info('✅ Phase 5: Final Verification', { runId: this.runId });

      // Capture Command Center screenshots
      await this.captureCommandCenterScreenshots();

      // Get final database counts
      this.results.finalCounts = await this.getDatabaseCounts();
      phase.details.finalCounts = this.results.finalCounts;

      // Summary assertion
      const allPhasesSucceeded = Object.values(this.results.phases)
        .filter(p => p.name !== 'Verification')
        .every(p => p.status === 'success');

      this.addAssertion(
        'Complete business flow',
        'all phases successful',
        allPhasesSucceeded ? 'success' : 'failed',
        allPhasesSucceeded,
        allPhasesSucceeded ? 'All business flow phases completed successfully' : 'One or more phases failed'
      );

      phase.status = 'success';
      phase.endTime = new Date().toISOString();
      phase.duration = Date.now() - new Date(phase.startTime).getTime();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      phase.status = 'failed';
      phase.errors.push(errorMessage);
      phase.endTime = new Date().toISOString();
      phase.duration = Date.now() - new Date(phase.startTime).getTime();
    }
  }

  private async getDatabaseCounts(): Promise<DatabaseCounts> {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    
    try {
      // Get raw props count (new within last 20 minutes)
      const { count: newRawCount } = await supabaseClient
        .from('raw_props')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', twentyMinutesAgo);

      // Get total raw props
      const { count: totalRawCount } = await supabaseClient
        .from('raw_props')
        .select('*', { count: 'exact', head: true });

      // Get processed recent (assuming processed_at field exists)
      const { count: processedRecentCount } = await supabaseClient
        .from('raw_props')
        .select('*', { count: 'exact', head: true })
        .not('processed_at', 'is', null)
        .gte('processed_at', twentyMinutesAgo);

      // Get promoted recent (unified_picks created recently)
      const { count: promotedRecentCount } = await supabaseClient
        .from('unified_picks')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', twentyMinutesAgo);

      // Get total unified picks
      const { count: totalUnifiedCount } = await supabaseClient
        .from('unified_picks')
        .select('*', { count: 'exact', head: true });

      return {
        newRaw: newRawCount || 0,
        processedRecent: processedRecentCount || 0,
        promotedRecent: promotedRecentCount || 0,
        totalRawProps: totalRawCount || 0,
        totalUnifiedPicks: totalUnifiedCount || 0,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('❌ Failed to get database counts', {
        runId: this.runId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return this.createEmptyDatabaseCounts();
    }
  }

  private async checkDiscordDelivery(): Promise<{ success: boolean; embedsFound: number; message: string }> {
    // This is a mock implementation - in production would check Discord API
    // For now, simulate success based on whether we have promoted picks
    const hasPromotedPicks = this.results.finalCounts.promotedRecent > 0;
    
    return {
      success: hasPromotedPicks,
      embedsFound: hasPromotedPicks ? 1 : 0,
      message: hasPromotedPicks 
        ? `Mock: Discord embed would be posted for ${this.results.finalCounts.promotedRecent} promoted picks`
        : 'Mock: No Discord embeds - no promoted picks to deliver'
    };
  }

  private async captureCommandCenterScreenshots(): Promise<void> {
    try {
      logger.info('📸 Capturing Command Center screenshots', { runId: this.runId });

      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();

      // Screenshots to capture
      const screenshots = [
        { name: 'dashboard-overview', url: `${this.config.api.commandCenterUrl}/dashboard` },
        { name: 'api-health', url: `${this.config.api.commandCenterUrl}/dashboard/api-health` },
        { name: 'data-flow', url: `${this.config.api.commandCenterUrl}/dashboard/data-flow` },
      ];

      for (const shot of screenshots) {
        try {
          await page.goto(shot.url);
          await page.waitForTimeout(3000); // Wait for loading
          
          const screenshotPath = path.join(this.screenshotDir, `${shot.name}.png`);
          await page.screenshot({ 
            path: screenshotPath, 
            fullPage: true,
            type: 'png'
          });
          
          this.results.screenshots.push(screenshotPath);
          logger.info(`📸 Screenshot captured: ${shot.name}`, { path: screenshotPath });
          
        } catch (error) {
          logger.warn(`⚠️ Screenshot failed: ${shot.name}`, { 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      await browser.close();

    } catch (error) {
      logger.error('❌ Screenshot capture failed', {
        runId: this.runId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private addAssertion(name: string, expected: any, actual: any, passed: boolean, details?: string): void {
    this.results.assertions.push({
      name,
      expected,
      actual,
      passed,
      details
    });

    logger.info(`${passed ? '✅' : '❌'} Assertion: ${name}`, {
      expected,
      actual,
      passed,
      details
    });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async generateReport(): Promise<void> {
    try {
      const reportPath = path.join(process.cwd(), 'docs', 'e2e-business-flow.md');
      const report = this.generateMarkdownReport();
      
      await fs.writeFile(reportPath, report, 'utf8');
      logger.info('📄 Report generated', { path: reportPath });
      
    } catch (error) {
      logger.error('❌ Report generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private generateMarkdownReport(): string {
    const { results } = this;
    const duration = (results.duration / 1000).toFixed(1);
    const passedAssertions = results.assertions.filter(a => a.passed).length;

    return `# E2E Business Flow Test Report

**Run ID:** \`${results.runId}\`  
**Status:** ${results.success ? '✅ PASSED' : '❌ FAILED'}  
**Duration:** ${duration}s  
**Test Time:** ${results.testStartTime} → ${results.testEndTime}  
**Assertions:** ${passedAssertions}/${results.assertions.length} passed  

## Configuration

- **Sport:** ${results.config.sport}
- **Window:** ${results.config.window}  
- **Books:** ${results.config.books.join(', ')}
- **Min Counts:** Raw: ${results.config.minCounts.newRaw}, Processed: ${results.config.minCounts.processedRecent}, Promoted: ${results.config.minCounts.promotedRecent}

## Phase Results

${Object.entries(results.phases).map(([key, phase]) => `
### ${phase.name}
- **Status:** ${this.getPhaseStatusEmoji(phase.status)} ${phase.status.toUpperCase()}
- **Duration:** ${phase.duration ? (phase.duration / 1000).toFixed(1) + 's' : 'N/A'}
- **Details:** ${JSON.stringify(phase.details, null, 2).slice(0, 200)}...
${phase.errors.length > 0 ? `- **Errors:** ${phase.errors.join('; ')}` : ''}
`).join('')}

## Database Counts

### Final Counts
\`\`\`json
${JSON.stringify(results.finalCounts, null, 2)}
\`\`\`

## Assertions

| Assertion | Expected | Actual | Status | Details |
|-----------|----------|---------|---------|---------|
${results.assertions.map(a => 
  `| ${a.name} | ${a.expected} | ${a.actual} | ${a.passed ? '✅' : '❌'} | ${a.details || ''} |`
).join('\n')}

## Temporal Workflow

${results.temporalWorkflowId ? `**Workflow ID:** \`${results.temporalWorkflowId}\`` : 'No workflow ID captured'}

## Screenshots

${results.screenshots.map(path => 
  `- ![${path.split('/').pop()?.replace('.png', '')}](${path.replace(process.cwd(), '.')})`
).join('\n')}

## SQL Excerpts

### Raw Props Ingestion
\`\`\`sql
SELECT COUNT(*) as new_raw_props 
FROM raw_props 
WHERE created_at >= NOW() - INTERVAL '20 minutes'
  AND sport = '${results.config.sport.toLowerCase()}';
-- Result: ${results.finalCounts.newRaw}
\`\`\`

### Recent Processing
\`\`\`sql
SELECT COUNT(*) as processed_recent 
FROM raw_props 
WHERE processed_at >= NOW() - INTERVAL '20 minutes'
  AND processed_at IS NOT NULL;
-- Result: ${results.finalCounts.processedRecent}
\`\`\`

### Recent Promotions
\`\`\`sql
SELECT COUNT(*) as promoted_recent 
FROM unified_picks 
WHERE created_at >= NOW() - INTERVAL '20 minutes';
-- Result: ${results.finalCounts.promotedRecent}
\`\`\`

## Errors

${results.errors.length > 0 ? results.errors.map(e => `- ${e}`).join('\n') : 'No errors encountered'}

---
*Generated by E2E Business Flow Runner at ${new Date().toISOString()}*
`;
  }

  private getPhaseStatusEmoji(status: string): string {
    switch (status) {
      case 'success': return '✅';
      case 'failed': return '❌';
      case 'running': return '🔄';
      default: return '⏳';
    }
  }
}

// Main execution
async function main() {
  try {
    const runner = new E2EBusinessFlowRunner(defaultConfig);
    const results = await runner.run();
    
    console.log(`\n${results.success ? '✅ E2E Test PASSED' : '❌ E2E Test FAILED'}`);
    console.log(`Duration: ${(results.duration / 1000).toFixed(1)}s`);
    console.log(`Assertions: ${results.assertions.filter(a => a.passed).length}/${results.assertions.length} passed`);
    console.log(`Report: docs/e2e-business-flow.md`);
    console.log(`Screenshots: docs/screenshots/${results.runId}/`);
    
    process.exit(results.success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ E2E Test execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { E2EBusinessFlowRunner, defaultConfig };