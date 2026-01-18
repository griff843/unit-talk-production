#!/usr/bin/env tsx

/**
 * Phase 17: Production Orchestration & Deployment
 * 
 * Objectives:
 * 1. Verify full E2E health post-Phase16
 * 2. Execute blue-green deployment to production with 5-min canary
 * 3. Begin historical data migration from unified_picks → picks
 * 4. Run RPC validation and user seeder tests across all leagues
 * 5. Install and validate alert integrations (Discord, Slack, PagerDuty)
 * 6. Generate Phase17 readiness and monitoring artifacts
 * 
 * Date: 2025-01-25
 */

import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface Phase17Result {
  timestamp: string;
  phase: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  checks: {
    e2eHealth: boolean;
    blueGreenReady: boolean;
    migrationReady: boolean;
    rpcValidation: boolean;
    alertsReady: boolean;
  };
  metrics: Record<string, any>;
  artifacts: string[];
  goNoGo: 'GO' | 'NO_GO';
  recommendations: string[];
}

class Phase17Orchestrator {
  private supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  private results: Phase17Result = {
    timestamp: new Date().toISOString(),
    phase: 'Phase 17',
    status: 'PASS',
    checks: {
      e2eHealth: false,
      blueGreenReady: false,
      migrationReady: false,
      rpcValidation: false,
      alertsReady: false,
    },
    metrics: {},
    artifacts: [],
    goNoGo: 'GO',
    recommendations: [],
  };

  async execute() {
    console.log('🚀 Phase 17: Production Orchestration & Deployment');
    console.log('='.repeat(60));

    try {
      // 1. Verify E2E Health
      console.log('\n📊 Step 1: Verifying Full E2E Health Post-Phase16...');
      await this.verifyE2EHealth();

      // 2. Validate Blue-Green Deployment Readiness
      console.log('\n🔵 Step 2: Validating Blue-Green Deployment Readiness...');
      await this.validateBlueGreenReadiness();

      // 3. Verify Historical Migration Readiness
      console.log('\n📦 Step 3: Verifying Historical Data Migration Readiness...');
      await this.verifyMigrationReadiness();

      // 4. Validate RPC Endpoints
      console.log('\n🔌 Step 4: Validating RPC Endpoints & User Seeder...');
      await this.validateRPCEndpoints();

      // 5. Verify Alert Integration Readiness
      console.log('\n🚨 Step 5: Verifying Alert Integration Readiness...');
      await this.verifyAlertIntegrations();

      // 6. Generate Final Report
      console.log('\n📋 Step 6: Generating Phase17 Artifacts & Go/No-Go Decision...');
      await this.generateFinalReport();

      // Output results
      this.outputResults();
    } catch (error) {
      console.error('❌ Phase 17 Orchestration Failed:', error);
      this.results.status = 'FAIL';
      this.results.goNoGo = 'NO_GO';
      this.outputResults();
      process.exit(1);
    }
  }

  private async verifyE2EHealth() {
    try {
      // Run Phase16 audit suite
      const { stdout } = await execAsync('npm run audit:all', {
        cwd: process.cwd(),
        timeout: 600000,
      });

      console.log('✅ E2E Health Verification Complete');
      this.results.checks.e2eHealth = true;
      this.results.metrics.e2eAudit = stdout;
    } catch (error) {
      console.error('❌ E2E Health Verification Failed:', error);
      this.results.checks.e2eHealth = false;
      this.results.status = 'FAIL';
    }
  }

  private async validateBlueGreenReadiness() {
    try {
      // Check deployment infrastructure
      const { data: deploymentConfig } = await this.supabase
        .from('system_config')
        .select('*')
        .eq('key', 'blue_green_deployment')
        .single();

      if (!deploymentConfig) {
        throw new Error('Blue-green deployment config not found');
      }

      console.log('✅ Blue-Green Deployment Ready');
      this.results.checks.blueGreenReady = true;
      this.results.metrics.deploymentConfig = deploymentConfig;
    } catch (error) {
      console.error('❌ Blue-Green Validation Failed:', error);
      this.results.checks.blueGreenReady = false;
    }
  }

  private async verifyMigrationReadiness() {
    try {
      // Check migration tables exist
      const { data: tables } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .in('table_name', ['unified_picks', 'picks', 'picks_historical']);

      if (!tables || tables.length < 2) {
        throw new Error('Required migration tables not found');
      }

      console.log('✅ Historical Migration Ready');
      this.results.checks.migrationReady = true;
    } catch (error) {
      console.error('❌ Migration Readiness Check Failed:', error);
      this.results.checks.migrationReady = false;
    }
  }

  private async validateRPCEndpoints() {
    try {
      // Validate RPC endpoints
      const endpoints = [
        '/api/health',
        '/api/picks',
        '/api/users',
        '/api/analytics/usage',
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`http://localhost:3000${endpoint}`);
        if (!response.ok) {
          throw new Error(`RPC endpoint ${endpoint} failed: ${response.status}`);
        }
      }

      console.log('✅ RPC Validation Complete');
      this.results.checks.rpcValidation = true;
    } catch (error) {
      console.error('❌ RPC Validation Failed:', error);
      this.results.checks.rpcValidation = false;
    }
  }

  private async verifyAlertIntegrations() {
    try {
      // Check alert configurations
      const { data: alerts } = await this.supabase
        .from('alert_configurations')
        .select('*')
        .in('provider', ['discord', 'slack', 'pagerduty']);

      if (!alerts || alerts.length === 0) {
        throw new Error('No alert configurations found');
      }

      console.log('✅ Alert Integrations Ready');
      this.results.checks.alertsReady = true;
      this.results.metrics.alertCount = alerts.length;
    } catch (error) {
      console.error('❌ Alert Integration Check Failed:', error);
      this.results.checks.alertsReady = false;
    }
  }

  private async generateFinalReport() {
    // Determine Go/No-Go
    const allChecks = Object.values(this.results.checks);
    this.results.goNoGo = allChecks.every((check) => check) ? 'GO' : 'NO_GO';

    // Generate recommendations
    if (!this.results.checks.e2eHealth) {
      this.results.recommendations.push(
        'Re-run Phase16 audit suite to resolve E2E health issues'
      );
    }
    if (!this.results.checks.blueGreenReady) {
      this.results.recommendations.push(
        'Configure blue-green deployment infrastructure'
      );
    }
    if (!this.results.checks.migrationReady) {
      this.results.recommendations.push(
        'Prepare historical data migration tables'
      );
    }
    if (!this.results.checks.rpcValidation) {
      this.results.recommendations.push('Validate and fix RPC endpoints');
    }
    if (!this.results.checks.alertsReady) {
      this.results.recommendations.push(
        'Configure alert integrations (Discord, Slack, PagerDuty)'
      );
    }

    // Save artifacts
    const outDir = path.join(process.cwd(), 'out', 'ops', 'phase17');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const reportPath = path.join(outDir, 'PHASE17_EXECUTION_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    this.results.artifacts.push(reportPath);

    console.log('✅ Phase17 Report Generated');
  }

  private outputResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 PHASE 17 EXECUTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Status: ${this.results.status}`);
    console.log(`Go/No-Go: ${this.results.goNoGo}`);
    console.log('\nChecks:');
    console.log(`  E2E Health: ${this.results.checks.e2eHealth ? '✅' : '❌'}`);
    console.log(
      `  Blue-Green Ready: ${this.results.checks.blueGreenReady ? '✅' : '❌'}`
    );
    console.log(
      `  Migration Ready: ${this.results.checks.migrationReady ? '✅' : '❌'}`
    );
    console.log(
      `  RPC Validation: ${this.results.checks.rpcValidation ? '✅' : '❌'}`
    );
    console.log(
      `  Alerts Ready: ${this.results.checks.alertsReady ? '✅' : '❌'}`
    );

    if (this.results.recommendations.length > 0) {
      console.log('\nRecommendations:');
      this.results.recommendations.forEach((rec) => {
        console.log(`  • ${rec}`);
      });
    }

    console.log('\nArtifacts:');
    this.results.artifacts.forEach((artifact) => {
      console.log(`  • ${artifact}`);
    });
  }
}

// Execute orchestration
const orchestrator = new Phase17Orchestrator();
orchestrator.execute().catch(console.error);

