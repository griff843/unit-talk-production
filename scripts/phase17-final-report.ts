#!/usr/bin/env tsx

/**
 * Phase 17: Final Report Generator
 * Consolidates all Phase 17 artifacts and generates Go/No-Go decision
 *
 * Date: 2025-01-25
 */

import * as fs from 'fs';
import * as path from 'path';

interface Phase17GoNoGo {
  timestamp: string;
  phase: 'Phase 17';
  decision: 'GO' | 'NO_GO';
  readinessScore: number;
  checks: {
    e2eHealth: { status: boolean; weight: number };
    blueGreenDeployment: { status: boolean; weight: number };
    historicalMigration: { status: boolean; weight: number };
    rpcValidation: { status: boolean; weight: number };
    alertIntegrations: { status: boolean; weight: number };
  };
  criticalIssues: string[];
  warnings: string[];
  recommendations: string[];
  nextSteps: string[];
  artifacts: string[];
}

class Phase17ReportGenerator {
  private report: Phase17GoNoGo = {
    timestamp: new Date().toISOString(),
    phase: 'Phase 17',
    decision: 'GO',
    readinessScore: 0,
    checks: {
      e2eHealth: { status: false, weight: 0.25 },
      blueGreenDeployment: { status: false, weight: 0.2 },
      historicalMigration: { status: false, weight: 0.2 },
      rpcValidation: { status: false, weight: 0.2 },
      alertIntegrations: { status: false, weight: 0.15 },
    },
    criticalIssues: [],
    warnings: [],
    recommendations: [],
    nextSteps: [],
    artifacts: [],
  };

  async execute() {
    console.log('🚀 Phase 17: Final Report Generation');
    console.log('='.repeat(60));

    try {
      // 1. Load all artifacts
      console.log('\n📂 Step 1: Loading Phase 17 Artifacts...');
      await this.loadArtifacts();

      // 2. Analyze results
      console.log('\n📊 Step 2: Analyzing Results...');
      this.analyzeResults();

      // 3. Calculate readiness score
      console.log('\n📈 Step 3: Calculating Readiness Score...');
      this.calculateReadinessScore();

      // 4. Make Go/No-Go decision
      console.log('\n🎯 Step 4: Making Go/No-Go Decision...');
      this.makeGoNoGoDecision();

      // 5. Generate final report
      console.log('\n📋 Step 5: Generating Final Report...');
      await this.generateFinalReport();

      this.outputSummary();
    } catch (error) {
      console.error('❌ Report Generation Failed:', error);
      process.exit(1);
    }
  }

  private async loadArtifacts() {
    const outDir = path.join(process.cwd(), 'out', 'ops', 'phase17');

    const artifacts = [
      'PHASE17_EXECUTION_REPORT.json',
      'HISTORICAL_MIGRATION_LOG.json',
      'RPC_VALIDATION_SUMMARY.json',
      'ALERTS_INSTALLATION_STATUS.md',
    ];

    for (const artifact of artifacts) {
      const artifactPath = path.join(outDir, artifact);
      if (fs.existsSync(artifactPath)) {
        this.report.artifacts.push(artifactPath);
        console.log(`  ✅ Loaded ${artifact}`);
      } else {
        console.log(`  ⚠️ Missing ${artifact}`);
      }
    }
  }

  private analyzeResults() {
    // Analyze E2E Health
    const e2eReportPath = path.join(
      process.cwd(),
      'out',
      'ops',
      'phase17',
      'PHASE17_EXECUTION_REPORT.json'
    );
    if (fs.existsSync(e2eReportPath)) {
      const e2eReport = JSON.parse(fs.readFileSync(e2eReportPath, 'utf-8'));
      this.report.checks.e2eHealth.status = e2eReport.checks.e2eHealth;
      if (!e2eReport.checks.e2eHealth) {
        this.report.criticalIssues.push('E2E health verification failed');
      }
    }

    // Analyze Migration
    const migrationPath = path.join(
      process.cwd(),
      'out',
      'ops',
      'phase17',
      'HISTORICAL_MIGRATION_LOG.json'
    );
    if (fs.existsSync(migrationPath)) {
      const migrationLog = JSON.parse(
        fs.readFileSync(migrationPath, 'utf-8')
      );
      this.report.checks.historicalMigration.status =
        migrationLog.status === 'SUCCESS';
      if (migrationLog.failedRecords > 0) {
        this.report.warnings.push(
          `${migrationLog.failedRecords} records failed to migrate`
        );
      }
    }
  }

  private calculateReadinessScore() {
    let score = 0;
    for (const [, check] of Object.entries(this.report.checks)) {
      if (check.status) {
        score += check.weight * 100;
      }
    }
    this.report.readinessScore = Math.round(score);
  }

  private makeGoNoGoDecision() {
    // Critical issues = NO_GO
    if (this.report.criticalIssues.length > 0) {
      this.report.decision = 'NO_GO';
      return;
    }

    // Readiness score >= 80% = GO
    if (this.report.readinessScore >= 80) {
      this.report.decision = 'GO';
    } else {
      this.report.decision = 'NO_GO';
    }
  }

  private async generateFinalReport() {
    const outDir = path.join(process.cwd(), 'out', 'ops', 'phase17');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // JSON report
    const jsonPath = path.join(outDir, 'FINAL_PHASE17_GO_NO_GO.json');
    fs.writeFileSync(jsonPath, JSON.stringify(this.report, null, 2));

    console.log(`✅ Final report generated: ${jsonPath}`);
  }

  private outputSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 PHASE 17 FINAL DECISION');
    console.log('='.repeat(60));
    console.log(
      `Decision: ${this.report.decision === 'GO' ? '✅ GO' : '❌ NO_GO'}`
    );
    console.log(`Readiness Score: ${this.report.readinessScore}%`);
  }
}

// Execute report generation
const generator = new Phase17ReportGenerator();
generator.execute().catch(console.error);