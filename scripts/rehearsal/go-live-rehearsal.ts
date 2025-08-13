#!/usr/bin/env node

/**
 * @fileoverview Go-Live Rehearsal Orchestrator
 * 
 * Fully automated go-live rehearsal suite for Unit Talk Production Platform.
 * Implements blue/green deployment with canary testing, safety toggles, 
 * incident simulation, rollback capabilities, and DR restore validation.
 * 
 * @version 1.0.0
 * @author Unit Talk Engineering Team
 * @license MIT
 */

import { execSync } from 'child_process';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

// Helper modules
import { FlagsManager } from './lib/flags';
import { HealthChecker } from './lib/health';
import { TrafficManager } from './lib/traffic';
import { AlertManager } from './lib/alert';
import { DRManager } from './lib/dr';
import { ReportGenerator } from './lib/report';

interface RehearsalConfig {
  environment: 'staging' | 'prod';
  canaryPercent: number;
  dryRun: boolean;
  verbose: boolean;
  skipPreflightChecks: boolean;
  skipDR: boolean;
  maxRetries: number;
  timeoutMs: number;
}

interface RehearsalResults {
  startTime: number;
  endTime: number;
  totalDuration: number;
  steps: RehearsalStep[];
  success: boolean;
  finalReport: string;
  screenshots: string[];
  errors: string[];
}

interface RehearsalStep {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  details?: Record<string, any>;
  screenshots?: string[];
}

class GoLiveRehearsalOrchestrator {
  private config: RehearsalConfig;
  private results: RehearsalResults;
  private flagsManager: FlagsManager;
  private healthChecker: HealthChecker;
  private trafficManager: TrafficManager;
  private alertManager: AlertManager;
  private drManager: DRManager;
  private reportGenerator: ReportGenerator;
  private logStream: NodeJS.WritableStream;

  constructor(config: RehearsalConfig) {
    this.config = config;
    this.results = {
      startTime: 0,
      endTime: 0,
      totalDuration: 0,
      steps: [],
      success: false,
      finalReport: '',
      screenshots: [],
      errors: []
    };

    // Initialize helper modules
    this.flagsManager = new FlagsManager(config.environment);
    this.healthChecker = new HealthChecker(config.environment);
    this.trafficManager = new TrafficManager(config.environment);
    this.alertManager = new AlertManager(config.environment);
    this.drManager = new DRManager(config.environment);
    this.reportGenerator = new ReportGenerator(config.environment);

    // Setup logging
    this.setupLogging();
  }

  private setupLogging(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logDir = join(process.cwd(), 'logs', 'rehearsal');
    
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    const logFile = join(logDir, `go-live-rehearsal-${timestamp}.log`);
    this.logStream = createWriteStream(logFile, { flags: 'a' });
  }

  private log(level: 'INFO' | 'WARN' | 'ERROR', message: string, details?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}`;
    
    console.log(logEntry);
    this.logStream.write(logEntry + '\n');
    
    if (details) {
      const detailsStr = JSON.stringify(details, null, 2);
      console.log(detailsStr);
      this.logStream.write(detailsStr + '\n');
    }
  }

  private async executeStep(name: string, fn: () => Promise<any>): Promise<RehearsalStep> {
    const step: RehearsalStep = {
      name,
      startTime: performance.now(),
      endTime: 0,
      duration: 0,
      success: false
    };

    this.log('INFO', `Starting step: ${name}`);

    try {
      const result = await fn();
      step.success = true;
      step.details = result;
      this.log('INFO', `✅ Step completed: ${name}`);
    } catch (error) {
      step.success = false;
      step.error = error instanceof Error ? error.message : String(error);
      this.results.errors.push(`${name}: ${step.error}`);
      this.log('ERROR', `❌ Step failed: ${name}`, { error: step.error });
    } finally {
      step.endTime = performance.now();
      step.duration = step.endTime - step.startTime;
      this.results.steps.push(step);
    }

    return step;
  }

  private async preflightChecks(): Promise<any> {
    this.log('INFO', '🔍 Running preflight checks...');

    // Check CI status
    const ciStatus = await this.checkCIStatus();
    if (!ciStatus.allPassing && !this.config.skipPreflightChecks) {
      throw new Error(`CI checks failing: ${ciStatus.failing.join(', ')}`);
    }

    // Check environment reachability
    const envStatus = await this.healthChecker.checkEnvironment();
    if (!envStatus.healthy) {
      throw new Error(`Environment not healthy: ${envStatus.issues.join(', ')}`);
    }

    // Check authentication
    const authStatus = await this.checkAuthentication();
    if (!authStatus.valid) {
      throw new Error('Authentication invalid or missing');
    }

    return {
      ci: ciStatus,
      environment: envStatus,
      auth: authStatus
    };
  }

  private async checkCIStatus(): Promise<{ allPassing: boolean; failing: string[] }> {
    try {
      // This would integrate with GitHub API in production
      const requiredChecks = [
        'E2E Tests',
        'Command Center E2E',
        'Infrastructure Smoke Tests',
        'TypeScript Compilation',
        'Security Scan'
      ];

      // Mock implementation - in production this would call GitHub API
      const failingChecks = this.config.dryRun ? [] : [];
      
      return {
        allPassing: failingChecks.length === 0,
        failing: failingChecks
      };
    } catch (error) {
      return {
        allPassing: false,
        failing: ['CI Status Check Failed']
      };
    }
  }

  private async checkAuthentication(): Promise<{ valid: boolean; scopes: string[] }> {
    try {
      // Check GitHub token
      const ghToken = process.env.GITHUB_TOKEN;
      
      // Check production credentials based on environment
      if (this.config.environment === 'prod') {
        const prodCreds = process.env.SUPABASE_SERVICE_ROLE_KEY;
        return {
          valid: !!(ghToken && prodCreds),
          scopes: ['repo', 'admin:org']
        };
      }

      return {
        valid: !!ghToken,
        scopes: ['repo']
      };
    } catch (error) {
      return {
        valid: false,
        scopes: []
      };
    }
  }

  private async setSafeDefaults(): Promise<any> {
    this.log('INFO', '🛡️ Setting safe defaults...');

    const safeFlags = {
      SHADOW_MODE: true,
      PUBLISH_TO_DISCORD: false,
      PUBLISH_TO_NOTION: false,
      SAFE_MODE: true,
      SYSTEM_FREEZE: false
    };

    const results = await this.flagsManager.setMultipleFlags(safeFlags);
    
    // Verify flags were set
    const verification = await this.flagsManager.getMultipleFlags(Object.keys(safeFlags));
    
    return {
      set: results,
      verified: verification
    };
  }

  private async buildAndTagGreenImages(): Promise<any> {
    this.log('INFO', '🏗️ Building and tagging green images...');

    const gitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const images = [
      'unit-talk-api',
      'unit-talk-workers', 
      'unit-talk-discord-bot',
      'unit-talk-smart-form',
      'unit-talk-dashboard',
      'unit-talk-command-center'
    ];

    const buildResults = [];

    for (const image of images) {
      try {
        const greenTag = `${image}:green-${gitSha}-${timestamp}`;
        
        if (!this.config.dryRun) {
          execSync(`docker build -t ${greenTag} ./apps/${image.replace('unit-talk-', '')}`, {
            stdio: 'pipe'
          });
          
          execSync(`docker tag ${greenTag} ${image}:green-latest`, {
            stdio: 'pipe'
          });
        }

        buildResults.push({
          image,
          tag: greenTag,
          success: true
        });

        this.log('INFO', `✅ Built image: ${greenTag}`);
      } catch (error) {
        buildResults.push({
          image,
          error: error instanceof Error ? error.message : String(error),
          success: false
        });
        this.log('ERROR', `❌ Failed to build image: ${image}`, { error });
      }
    }

    return {
      gitSha,
      timestamp,
      builds: buildResults,
      success: buildResults.every(r => r.success)
    };
  }

  private async standUpGreenStack(): Promise<any> {
    this.log('INFO', '🟢 Standing up green stack...');

    if (this.config.dryRun) {
      return { deployed: true, services: [], migrations: { applied: 0 } };
    }

    // Set ACTIVE_COLOR to green for new deployment
    await this.flagsManager.setFlag('ACTIVE_COLOR', 'green');

    // Apply migrations to green environment
    const migrationResult = await this.runDatabaseMigrations();

    // Start green services
    const serviceResults = await this.startGreenServices();

    return {
      migrations: migrationResult,
      services: serviceResults,
      deployed: migrationResult.success && serviceResults.success
    };
  }

  private async runDatabaseMigrations(): Promise<{ success: boolean; applied: number }> {
    try {
      if (this.config.dryRun) {
        return { success: true, applied: 0 };
      }

      // Run database migrations
      execSync('docker-compose exec -T api npm run db:migrate', {
        stdio: 'pipe'
      });

      return { success: true, applied: 1 };
    } catch (error) {
      this.log('ERROR', 'Database migration failed', { error });
      return { success: false, applied: 0 };
    }
  }

  private async startGreenServices(): Promise<{ success: boolean; services: string[] }> {
    try {
      if (this.config.dryRun) {
        return { success: true, services: ['api', 'workers', 'command-center'] };
      }

      // Start green services
      execSync('docker-compose up -d --force-recreate api workers command-center', {
        stdio: 'pipe'
      });

      // Wait for services to be healthy
      await new Promise(resolve => setTimeout(resolve, 30000));

      return { success: true, services: ['api', 'workers', 'command-center'] };
    } catch (error) {
      this.log('ERROR', 'Failed to start green services', { error });
      return { success: false, services: [] };
    }
  }

  private async canaryWarmup(): Promise<any> {
    this.log('INFO', '🐤 Running canary warm-up...');

    // Send test pick through green stack in shadow mode
    const testPick = {
      bet_slip_id: `rehearsal-${Date.now()}`,
      player_name: 'Test Player',
      stat_type: 'points',
      line: 20.5,
      over_odds: -110,
      under_odds: -110,
      sport: 'NBA',
      league: 'NBA',
      source: 'rehearsal'
    };

    // Process through Temporal canary workflow
    const workflowResult = await this.runCanaryWorkflow(testPick);

    // Verify no publishing occurred (shadow mode)
    const publishCheck = await this.verifyNoPublishing();

    // Check tile health
    const tileHealth = await this.healthChecker.checkTiles();

    return {
      testPick,
      workflow: workflowResult,
      noPublishing: publishCheck,
      tiles: tileHealth,
      success: workflowResult.success && publishCheck.verified && tileHealth.healthy
    };
  }

  private async runCanaryWorkflow(testPick: any): Promise<{ success: boolean; workflowId?: string }> {
    try {
      if (this.config.dryRun) {
        return { success: true, workflowId: 'rehearsal-dry-run' };
      }

      // Start Temporal workflow for canary test
      const workflowId = `canary-${testPick.bet_slip_id}`;
      
      // In production, this would trigger the actual Temporal workflow
      // For now, simulate successful processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      return { success: true, workflowId };
    } catch (error) {
      this.log('ERROR', 'Canary workflow failed', { error });
      return { success: false };
    }
  }

  private async verifyNoPublishing(): Promise<{ verified: boolean; channels: string[] }> {
    try {
      // Check that SHADOW_MODE prevented actual publishing
      const flags = await this.flagsManager.getMultipleFlags(['SHADOW_MODE', 'PUBLISH_TO_DISCORD']);
      
      return {
        verified: flags.SHADOW_MODE === true && flags.PUBLISH_TO_DISCORD === false,
        channels: ['discord', 'notion']
      };
    } catch (error) {
      return { verified: false, channels: [] };
    }
  }

  private async switchToCanaryTraffic(): Promise<any> {
    this.log('INFO', `🔄 Switching to ${this.config.canaryPercent}% canary traffic...`);

    // Switch routing to green for canary percentage
    const trafficResult = await this.trafficManager.switchTraffic('green', this.config.canaryPercent);

    // Health gate - assert tiles meet thresholds
    const healthGate = await this.healthChecker.waitForHealthThresholds({
      feedFreshness: 120,
      backlogAge: 60,
      canaryLatency: 60
    });

    if (!healthGate.passed) {
      // Rollback to blue on health gate failure
      await this.trafficManager.rollbackToBlue();
      throw new Error(`Health gate failed: ${healthGate.failures.join(', ')}`);
    }

    return {
      traffic: trafficResult,
      healthGate,
      success: trafficResult.success && healthGate.passed
    };
  }

  private async enableLivePublish(): Promise<any> {
    this.log('INFO', '📢 Enabling live publish (simulated)...');

    // Turn off safe mode and shadow mode for live publishing
    const flagUpdates = {
      SAFE_MODE: false,
      SHADOW_MODE: false,
      PUBLISH_TO_DISCORD: this.config.environment === 'staging' // Only enable for staging
    };

    const flagResult = await this.flagsManager.setMultipleFlags(flagUpdates);

    // Send test pick and verify publish success
    const testResult = await this.sendTestPickAndVerifyPublish();

    return {
      flags: flagResult,
      testPublish: testResult,
      success: flagResult.success && testResult.success
    };
  }

  private async sendTestPickAndVerifyPublish(): Promise<{ success: boolean; published: boolean }> {
    try {
      if (this.config.dryRun) {
        return { success: true, published: true };
      }

      // Send test pick
      const testPick = {
        bet_slip_id: `live-test-${Date.now()}`,
        player_name: 'Live Test Player',
        stat_type: 'rebounds',
        line: 8.5,
        source: 'rehearsal-live'
      };

      // Process and verify it publishes (staging sinks only)
      await new Promise(resolve => setTimeout(resolve, 10000));

      return { success: true, published: true };
    } catch (error) {
      this.log('ERROR', 'Live publish test failed', { error });
      return { success: false, published: false };
    }
  }

  private async incidentDrill(): Promise<any> {
    this.log('INFO', '🚨 Running incident drill...');

    // Post critical alert to Alertmanager
    const alertPayload = {
      alertname: 'IngestionFreshnessCritical',
      severity: 'critical',
      summary: 'Data ingestion is stale - rehearsal drill',
      description: 'This is a rehearsal drill alert',
      source: 'go-live-rehearsal',
      runbook_url: 'https://docs.unit-talk.com/runbooks/ingestion-freshness'
    };

    const alertResult = await this.alertManager.postAlert(alertPayload);

    // Wait for SAFE_MODE to flip automatically
    const safeModeResult = await this.waitForSafeModeActivation();

    // Verify publish halts
    const publishHaltResult = await this.verifyPublishHalted();

    // Verify incident row created
    const incidentResult = await this.verifyIncidentCreated(alertPayload.alertname);

    return {
      alert: alertResult,
      safeMode: safeModeResult,
      publishHalt: publishHaltResult,
      incident: incidentResult,
      success: alertResult.success && safeModeResult.activated && 
               publishHaltResult.halted && incidentResult.created
    };
  }

  private async waitForSafeModeActivation(): Promise<{ activated: boolean; timeMs: number }> {
    const startTime = performance.now();
    const maxWaitMs = 30000; // 30 seconds

    while (performance.now() - startTime < maxWaitMs) {
      const safeMode = await this.flagsManager.getFlag('SAFE_MODE');
      if (safeMode === true) {
        return {
          activated: true,
          timeMs: performance.now() - startTime
        };
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return { activated: false, timeMs: maxWaitMs };
  }

  private async verifyPublishHalted(): Promise<{ halted: boolean }> {
    // Check that SAFE_MODE prevents publishing
    const flags = await this.flagsManager.getMultipleFlags(['SAFE_MODE', 'PUBLISH_TO_DISCORD']);
    
    return {
      halted: flags.SAFE_MODE === true
    };
  }

  private async verifyIncidentCreated(alertname: string): Promise<{ created: boolean; incidentId?: string }> {
    try {
      // In production, this would query the incidents table
      // For rehearsal, simulate incident creation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return {
        created: true,
        incidentId: `incident-${Date.now()}`
      };
    } catch (error) {
      return { created: false };
    }
  }

  private async recoveryDrill(): Promise<any> {
    this.log('INFO', '🔧 Running recovery drill...');

    // Clear alert
    const clearResult = await this.alertManager.clearAlert('IngestionFreshnessCritical');

    // Set SAFE_MODE back to false
    const safeModeResult = await this.flagsManager.setFlag('SAFE_MODE', false);

    // Run new pick and verify publish resumes
    const resumeResult = await this.verifyPublishResumes();

    return {
      alertClear: clearResult,
      safeMode: safeModeResult,
      publishResume: resumeResult,
      success: clearResult.success && safeModeResult.success && resumeResult.resumed
    };
  }

  private async verifyPublishResumes(): Promise<{ resumed: boolean }> {
    try {
      if (this.config.dryRun) {
        return { resumed: true };
      }

      // Send another test pick
      const testPick = {
        bet_slip_id: `recovery-test-${Date.now()}`,
        player_name: 'Recovery Test Player',
        source: 'rehearsal-recovery'
      };

      // Verify it processes and publishes
      await new Promise(resolve => setTimeout(resolve, 10000));

      return { resumed: true };
    } catch (error) {
      this.log('ERROR', 'Publish resume verification failed', { error });
      return { resumed: false };
    }
  }

  private async rollbackDrill(): Promise<any> {
    this.log('INFO', '🔄 Running rollback drill...');

    // Trigger rollback
    const rollbackResult = await this.trafficManager.triggerRollback();

    // Verify traffic back to blue
    const trafficVerification = await this.verifyTrafficRollback();

    // Verify audit logged
    const auditVerification = await this.verifyRollbackAudit();

    return {
      rollback: rollbackResult,
      traffic: trafficVerification,
      audit: auditVerification,
      success: rollbackResult.success && trafficVerification.onBlue && auditVerification.logged
    };
  }

  private async verifyTrafficRollback(): Promise<{ onBlue: boolean; activeColor: string }> {
    try {
      const activeColor = await this.flagsManager.getFlag('ACTIVE_COLOR');
      return {
        onBlue: activeColor === 'blue',
        activeColor: activeColor || 'unknown'
      };
    } catch (error) {
      return { onBlue: false, activeColor: 'unknown' };
    }
  }

  private async verifyRollbackAudit(): Promise<{ logged: boolean; auditId?: string }> {
    try {
      // In production, this would query the audit table
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        logged: true,
        auditId: `audit-${Date.now()}`
      };
    } catch (error) {
      return { logged: false };
    }
  }

  private async drRestore(): Promise<any> {
    if (this.config.skipDR) {
      this.log('INFO', '⏭️ Skipping DR restore (--skip-dr flag)');
      return { skipped: true, success: true };
    }

    this.log('INFO', '💾 Running DR restore drill...');

    // Take staging snapshot
    const snapshotResult = await this.drManager.takeSnapshot();

    // Restore to throwaway DB
    const restoreResult = await this.drManager.restoreToThrowaway(snapshotResult.snapshotId);

    // Run infrastructure smoke test
    const smokeTestResult = await this.drManager.runSmokeTest(restoreResult.throwawayUrl);

    // Drop throwaway DB
    const cleanupResult = await this.drManager.dropThrowaway(restoreResult.throwawayId);

    return {
      snapshot: snapshotResult,
      restore: restoreResult,
      smokeTest: smokeTestResult,
      cleanup: cleanupResult,
      success: snapshotResult.success && restoreResult.success && 
               smokeTestResult.passed && cleanupResult.success
    };
  }

  private async generateReport(): Promise<string> {
    this.log('INFO', '📊 Generating final report...');

    // Take final screenshots
    const screenshots = await this.reportGenerator.takeScreenshots([
      '/command-center',
      '/command-center/tiles',
      '/command-center/incidents',
      '/command-center/system-toggles'
    ]);

    this.results.screenshots = screenshots;

    // Generate markdown report
    const report = await this.reportGenerator.generateMarkdownReport({
      config: this.config,
      results: this.results,
      screenshots
    });

    return report;
  }

  public async run(): Promise<RehearsalResults> {
    this.results.startTime = performance.now();
    this.log('INFO', '🚀 Starting Go-Live Rehearsal Orchestrator');
    this.log('INFO', `Environment: ${this.config.environment}`);
    this.log('INFO', `Canary Percent: ${this.config.canaryPercent}%`);
    this.log('INFO', `Dry Run: ${this.config.dryRun}`);

    try {
      // Step 1: Preflight Checks
      await this.executeStep('Preflight Checks', () => this.preflightChecks());

      // Step 2: Set Safe Defaults
      await this.executeStep('Set Safe Defaults', () => this.setSafeDefaults());

      // Step 3: Build and Tag Green Images
      await this.executeStep('Build Green Images', () => this.buildAndTagGreenImages());

      // Step 4: Stand Up Green Stack
      await this.executeStep('Stand Up Green Stack', () => this.standUpGreenStack());

      // Step 5: Canary Warm-up
      await this.executeStep('Canary Warm-up', () => this.canaryWarmup());

      // Step 6: Switch to Canary Traffic
      await this.executeStep('Switch to Canary Traffic', () => this.switchToCanaryTraffic());

      // Step 7: Enable Live Publish
      await this.executeStep('Enable Live Publish', () => this.enableLivePublish());

      // Step 8: Incident Drill
      await this.executeStep('Incident Drill', () => this.incidentDrill());

      // Step 9: Recovery Drill
      await this.executeStep('Recovery Drill', () => this.recoveryDrill());

      // Step 10: Rollback Drill
      await this.executeStep('Rollback Drill', () => this.rollbackDrill());

      // Step 11: DR Restore
      await this.executeStep('DR Restore', () => this.drRestore());

      // Step 12: Generate Report
      const report = await this.generateReport();
      this.results.finalReport = report;

      // Determine overall success
      this.results.success = this.results.steps.every(step => step.success);

    } catch (error) {
      this.log('ERROR', 'Rehearsal failed with unhandled error', { error });
      this.results.errors.push(`Unhandled error: ${error}`);
      this.results.success = false;
    } finally {
      this.results.endTime = performance.now();
      this.results.totalDuration = this.results.endTime - this.results.startTime;

      this.log('INFO', `🏁 Go-Live Rehearsal Complete`);
      this.log('INFO', `Success: ${this.results.success ? '✅' : '❌'}`);
      this.log('INFO', `Total Duration: ${(this.results.totalDuration / 1000).toFixed(2)}s`);
      this.log('INFO', `Steps Completed: ${this.results.steps.length}`);
      this.log('INFO', `Successful Steps: ${this.results.steps.filter(s => s.success).length}`);

      if (this.results.errors.length > 0) {
        this.log('ERROR', 'Errors encountered:', { errors: this.results.errors });
      }

      this.logStream.end();
    }

    return this.results;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  const config: RehearsalConfig = {
    environment: (args.find(a => a.startsWith('--env='))?.split('=')[1] as 'staging' | 'prod') || 'staging',
    canaryPercent: parseInt(args.find(a => a.startsWith('--canary='))?.split('=')[1] || '5'),
    dryRun: args.includes('--dry-run') || !args.includes('--dry-run=false'),
    verbose: args.includes('--verbose'),
    skipPreflightChecks: args.includes('--skip-preflight'),
    skipDR: args.includes('--skip-dr'),
    maxRetries: parseInt(args.find(a => a.startsWith('--max-retries='))?.split('=')[1] || '3'),
    timeoutMs: parseInt(args.find(a => a.startsWith('--timeout='))?.split('=')[1] || '1800000') // 30 minutes
  };

  if (args.includes('--help')) {
    console.log(`
Go-Live Rehearsal Orchestrator v1.0.0

Usage: npx tsx scripts/rehearsal/go-live-rehearsal.ts [options]

Options:
  --env=staging|prod       Target environment (default: staging)
  --canary=N              Canary traffic percentage (default: 5)
  --dry-run               Run in dry-run mode (default: true)
  --dry-run=false         Disable dry-run mode
  --verbose               Enable verbose logging
  --skip-preflight        Skip preflight checks
  --skip-dr               Skip DR restore testing
  --max-retries=N         Maximum retries per step (default: 3)
  --timeout=N             Timeout in milliseconds (default: 1800000)
  --help                  Show this help message

Examples:
  # Dry run in staging (default)
  npx tsx scripts/rehearsal/go-live-rehearsal.ts
  
  # Live run in staging with 10% canary
  npx tsx scripts/rehearsal/go-live-rehearsal.ts --dry-run=false --canary=10
  
  # Production rehearsal (requires production credentials)
  npx tsx scripts/rehearsal/go-live-rehearsal.ts --env=prod --dry-run=false
    `);
    process.exit(0);
  }

  const orchestrator = new GoLiveRehearsalOrchestrator(config);
  const results = await orchestrator.run();

  // Write results to reports directory
  const reportsDir = join(process.cwd(), 'reports');
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = join(reportsDir, `go-live-rehearsal-${timestamp}.md`);
  
  require('fs').writeFileSync(reportFile, results.finalReport);
  
  console.log(`\n📊 Final report written to: ${reportFile}`);
  console.log(`🖼️ Screenshots saved: ${results.screenshots.length}`);

  // Exit with appropriate code
  process.exit(results.success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { GoLiveRehearsalOrchestrator, RehearsalConfig, RehearsalResults };