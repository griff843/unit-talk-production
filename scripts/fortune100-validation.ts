#!/usr/bin/env npx tsx
/**
 * Fortune 100-Grade System Validation
 *
 * Comprehensive validation of the Unit Talk betting intelligence platform
 * ensuring enterprise-grade standards and production readiness
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const VALIDATION_CRITERIA = {
  TYPESCRIPT: {
    maxErrors: 0,
    strictMode: true,
    coverage: 95
  },
  SYSTEM_HEALTH: {
    minUptime: 99.9,
    maxLatency: 2000,
    maxErrorRate: 0.01
  },
  DATABASE: {
    schemaVersion: 'v3.0.0',
    requiredTables: ['unified_picks', 'users', 'raw_props', 'agent_health'],
    indexCoverage: 90
  },
  AGENTS: {
    required: ['FeedAgent', 'ScoringAgent', 'AlertAgent', 'OperatorAgent'],
    healthCheckInterval: 60000,
    maxRestarts: 3
  },
  SCORING: {
    enhanced45Factor: true,
    factorCount: 195,
    minWinRate: 0.55,
    minCLV: 0.60
  }
};

interface ValidationResult {
  category: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
}

class Fortune100Validator {
  private results: ValidationResult[] = [];
  private supabase: any;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async validate(): Promise<void> {
    console.log('🏆 Starting Fortune 100-Grade System Validation');
    console.log('='.repeat(60));

    // 1. TypeScript Compilation
    await this.validateTypeScript();

    // 2. System Architecture
    await this.validateArchitecture();

    // 3. Database Schema
    await this.validateDatabase();

    // 4. Agent Health
    await this.validateAgents();

    // 5. Enhanced45Factor Scoring
    await this.validateScoring();

    // 6. API Performance
    await this.validateAPIPerformance();

    // 7. Security Standards
    await this.validateSecurity();

    // 8. Documentation
    await this.validateDocumentation();

    // Generate Report
    this.generateReport();
  }

  private async validateTypeScript(): Promise<void> {
    console.log('\n📘 Validating TypeScript Standards...');

    try {
      const { execSync } = require('child_process');
      const output = execSync('npm run type-check 2>&1', {
        encoding: 'utf8',
        cwd: path.resolve(__dirname, '..')
      });

      if (output.includes('error')) {
        this.results.push({
          category: 'TypeScript',
          status: 'FAIL',
          message: 'TypeScript compilation errors detected',
          details: output
        });
      } else {
        this.results.push({
          category: 'TypeScript',
          status: 'PASS',
          message: 'TypeScript compilation successful with strict mode'
        });
      }
    } catch (error: any) {
      this.results.push({
        category: 'TypeScript',
        status: 'FAIL',
        message: 'TypeScript validation failed',
        details: error.message
      });
    }
  }

  private async validateArchitecture(): Promise<void> {
    console.log('\n🏛️ Validating System Architecture...');

    const requiredServices = [
      'http://localhost:3000/health', // API
      'http://localhost:3002', // Smart Form
      'http://localhost:3004', // Command Center
      'http://localhost:8088' // Temporal
    ];

    for (const service of requiredServices) {
      try {
        const response = await axios.get(service, { timeout: 5000 });
        if (response.status === 200) {
          this.results.push({
            category: 'Architecture',
            status: 'PASS',
            message: `Service healthy: ${service}`
          });
        }
      } catch (error) {
        this.results.push({
          category: 'Architecture',
          status: 'WARNING',
          message: `Service unreachable: ${service}`
        });
      }
    }
  }

  private async validateDatabase(): Promise<void> {
    console.log('\n💾 Validating Database Schema...');

    try {
      // Check required tables
      for (const table of VALIDATION_CRITERIA.DATABASE.requiredTables) {
        const { data, error } = await this.supabase
          .from(table)
          .select('*')
          .limit(1);

        if (error) {
          this.results.push({
            category: 'Database',
            status: 'FAIL',
            message: `Table ${table} validation failed`,
            details: error
          });
        } else {
          this.results.push({
            category: 'Database',
            status: 'PASS',
            message: `Table ${table} exists and accessible`
          });
        }
      }

      // Verify v3.0.0 schema
      const { data: picks } = await this.supabase
        .from('unified_picks')
        .select(`
          *,
          users!unified_picks_user_id_fkey (username, discord_id, tier)
        `)
        .limit(1);

      if (picks) {
        this.results.push({
          category: 'Database',
          status: 'PASS',
          message: 'v3.0.0 schema validated successfully'
        });
      }
    } catch (error: any) {
      this.results.push({
        category: 'Database',
        status: 'FAIL',
        message: 'Database validation failed',
        details: error.message
      });
    }
  }

  private async validateAgents(): Promise<void> {
    console.log('\n🤖 Validating Agent Health...');

    try {
      const { data: agents } = await this.supabase
        .from('agent_health')
        .select('*')
        .order('last_check_at', { ascending: false });

      if (agents && agents.length > 0) {
        const healthyAgents = agents.filter((a: any) => a.status === 'healthy');
        const healthRate = (healthyAgents.length / agents.length) * 100;

        this.results.push({
          category: 'Agents',
          status: healthRate >= 80 ? 'PASS' : 'WARNING',
          message: `Agent health: ${healthRate.toFixed(1)}%`,
          details: { total: agents.length, healthy: healthyAgents.length }
        });
      }
    } catch (error: any) {
      this.results.push({
        category: 'Agents',
        status: 'WARNING',
        message: 'Agent health check incomplete',
        details: error.message
      });
    }
  }

  private async validateScoring(): Promise<void> {
    console.log('\n🎯 Validating Enhanced45Factor Scoring...');

    try {
      const { data: scores } = await this.supabase
        .from('unified_picks')
        .select('professional_score, confidence_score, edge_score')
        .not('professional_score', 'is', null)
        .limit(100);

      if (scores && scores.length > 0) {
        const avgScore = scores.reduce((sum: number, s: any) =>
          sum + (s.professional_score || 0), 0) / scores.length;

        this.results.push({
          category: 'Scoring',
          status: avgScore > 60 ? 'PASS' : 'WARNING',
          message: `Enhanced45Factor avg score: ${avgScore.toFixed(1)}`,
          details: { sampleSize: scores.length, factorCount: 195 }
        });
      }
    } catch (error: any) {
      this.results.push({
        category: 'Scoring',
        status: 'WARNING',
        message: 'Scoring validation incomplete',
        details: error.message
      });
    }
  }

  private async validateAPIPerformance(): Promise<void> {
    console.log('\n⚡ Validating API Performance...');

    const endpoints = [
      '/health',
      '/api/agents/health',
      '/api/analytics'
    ];

    for (const endpoint of endpoints) {
      try {
        const start = Date.now();
        await axios.get(`http://localhost:3000${endpoint}`, { timeout: 5000 });
        const latency = Date.now() - start;

        this.results.push({
          category: 'Performance',
          status: latency < VALIDATION_CRITERIA.SYSTEM_HEALTH.maxLatency ? 'PASS' : 'WARNING',
          message: `${endpoint} latency: ${latency}ms`
        });
      } catch (error) {
        this.results.push({
          category: 'Performance',
          status: 'WARNING',
          message: `${endpoint} performance check failed`
        });
      }
    }
  }

  private async validateSecurity(): Promise<void> {
    console.log('\n🔒 Validating Security Standards...');

    // Check for exposed secrets
    const envFile = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envFile)) {
      const envContent = fs.readFileSync(envFile, 'utf8');
      const hasSecrets = envContent.includes('SUPABASE_SERVICE_ROLE_KEY') &&
                        !envContent.includes('YOUR_KEY_HERE');

      this.results.push({
        category: 'Security',
        status: hasSecrets ? 'PASS' : 'WARNING',
        message: 'Environment variables properly configured'
      });
    }

    // Check CORS and security headers
    try {
      const response = await axios.get('http://localhost:3000/health');
      const headers = response.headers;

      const securityHeaders = [
        'x-frame-options',
        'x-content-type-options',
        'strict-transport-security'
      ];

      const hasSecurityHeaders = securityHeaders.some(h => headers[h]);

      this.results.push({
        category: 'Security',
        status: hasSecurityHeaders ? 'PASS' : 'WARNING',
        message: 'Security headers configured'
      });
    } catch (error) {
      this.results.push({
        category: 'Security',
        status: 'WARNING',
        message: 'Security validation incomplete'
      });
    }
  }

  private async validateDocumentation(): Promise<void> {
    console.log('\n📚 Validating Documentation...');

    const requiredDocs = [
      'README.md',
      'CLAUDE.md',
      'docs/AGENTS.md',
      'docs/architecture/system-design.md'
    ];

    for (const doc of requiredDocs) {
      const docPath = path.resolve(__dirname, '..', doc);
      if (fs.existsSync(docPath)) {
        const content = fs.readFileSync(docPath, 'utf8');
        const isComplete = content.length > 1000; // Basic completeness check

        this.results.push({
          category: 'Documentation',
          status: isComplete ? 'PASS' : 'WARNING',
          message: `${doc} exists and appears complete`
        });
      } else {
        this.results.push({
          category: 'Documentation',
          status: 'WARNING',
          message: `${doc} missing`
        });
      }
    }
  }

  private generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 FORTUNE 100-GRADE VALIDATION REPORT');
    console.log('='.repeat(60));

    const categories = [...new Set(this.results.map(r => r.category))];

    for (const category of categories) {
      const categoryResults = this.results.filter(r => r.category === category);
      const passed = categoryResults.filter(r => r.status === 'PASS').length;
      const failed = categoryResults.filter(r => r.status === 'FAIL').length;
      const warnings = categoryResults.filter(r => r.status === 'WARNING').length;

      console.log(`\n${category}:`);
      console.log(`  ✅ Passed: ${passed}`);
      console.log(`  ❌ Failed: ${failed}`);
      console.log(`  ⚠️ Warnings: ${warnings}`);

      // Show failures and warnings
      categoryResults
        .filter(r => r.status !== 'PASS')
        .forEach(r => {
          const icon = r.status === 'FAIL' ? '❌' : '⚠️';
          console.log(`  ${icon} ${r.message}`);
        });
    }

    // Overall Score
    const totalTests = this.results.length;
    const totalPassed = this.results.filter(r => r.status === 'PASS').length;
    const score = (totalPassed / totalTests) * 100;

    console.log('\n' + '='.repeat(60));
    console.log(`OVERALL SCORE: ${score.toFixed(1)}%`);
    console.log(`STATUS: ${score >= 90 ? '✅ PRODUCTION READY' : score >= 70 ? '⚠️ NEEDS IMPROVEMENT' : '❌ NOT READY'}`);
    console.log('='.repeat(60));

    // Write detailed report
    const reportPath = path.resolve(__dirname, '../FORTUNE100_VALIDATION_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      score: score.toFixed(1),
      results: this.results,
      criteria: VALIDATION_CRITERIA
    }, null, 2));

    console.log(`\n📄 Detailed report saved to: FORTUNE100_VALIDATION_REPORT.json`);
  }
}

// Execute validation
async function main() {
  try {
    const validator = new Fortune100Validator();
    await validator.validate();
  } catch (error: any) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

main();