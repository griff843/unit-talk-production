#!/usr/bin/env tsx

/**
 * Phase 17: RPC Validation & User Seeder Tests
 * Validate all RPC endpoints and run user seeder tests across all leagues
 * 
 * Date: 2025-01-25
 */

import * as fs from 'fs';
import * as path from 'path';

interface RPCValidationResult {
  timestamp: string;
  endpoints: {
    [key: string]: {
      status: 'PASS' | 'FAIL';
      statusCode?: number;
      responseTime: number;
      error?: string;
    };
  };
  userSeederTests: {
    [league: string]: {
      status: 'PASS' | 'FAIL';
      usersCreated: number;
      error?: string;
    };
  };
  summary: {
    totalEndpoints: number;
    passedEndpoints: number;
    totalLeagues: number;
    passedLeagues: number;
    overallStatus: 'PASS' | 'FAIL';
  };
}

class RPCValidator {
  private results: RPCValidationResult = {
    timestamp: new Date().toISOString(),
    endpoints: {},
    userSeederTests: {},
    summary: {
      totalEndpoints: 0,
      passedEndpoints: 0,
      totalLeagues: 0,
      passedLeagues: 0,
      overallStatus: 'PASS',
    },
  };

  private endpoints = [
    { path: '/api/health', method: 'GET' },
    { path: '/api/picks', method: 'GET' },
    { path: '/api/picks', method: 'POST' },
    { path: '/api/users', method: 'GET' },
    { path: '/api/users/seed', method: 'POST' },
    { path: '/api/analytics/usage', method: 'GET' },
    { path: '/api/leagues', method: 'GET' },
    { path: '/api/grading/status', method: 'GET' },
  ];

  private leagues = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB'];

  async execute() {
    console.log('🚀 Phase 17: RPC Validation & User Seeder Tests');
    console.log('='.repeat(60));

    try {
      // 1. Validate RPC endpoints
      console.log('\n🔌 Step 1: Validating RPC Endpoints...');
      await this.validateEndpoints();

      // 2. Run user seeder tests
      console.log('\n👥 Step 2: Running User Seeder Tests...');
      await this.runUserSeederTests();

      // 3. Generate report
      console.log('\n📋 Step 3: Generating RPC Validation Report...');
      await this.generateReport();

      this.results.summary.overallStatus = this.isAllPassed() ? 'PASS' : 'FAIL';
    } catch (error) {
      console.error('❌ RPC Validation Failed:', error);
      this.results.summary.overallStatus = 'FAIL';
      await this.generateReport();
      process.exit(1);
    }
  }

  private async validateEndpoints() {
    this.results.summary.totalEndpoints = this.endpoints.length;

    for (const endpoint of this.endpoints) {
      try {
        const startTime = Date.now();
        const response = await fetch(
          `http://localhost:3000${endpoint.path}`,
          {
            method: endpoint.method,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        const responseTime = Date.now() - startTime;

        const key = `${endpoint.method} ${endpoint.path}`;
        if (response.ok) {
          this.results.endpoints[key] = {
            status: 'PASS',
            statusCode: response.status,
            responseTime,
          };
          this.results.summary.passedEndpoints++;
          console.log(`  ✅ ${key} (${responseTime}ms)`);
        } else {
          this.results.endpoints[key] = {
            status: 'FAIL',
            statusCode: response.status,
            responseTime,
            error: `HTTP ${response.status}`,
          };
          console.log(`  ❌ ${key} (${response.status})`);
        }
      } catch (error) {
        const key = `${endpoint.method} ${endpoint.path}`;
        this.results.endpoints[key] = {
          status: 'FAIL',
          responseTime: 0,
          error: String(error),
        };
        console.log(`  ❌ ${key} (${error})`);
      }
    }
  }

  private async runUserSeederTests() {
    this.results.summary.totalLeagues = this.leagues.length;

    for (const league of this.leagues) {
      try {
        console.log(`  Testing ${league}...`);

        // Call user seeder endpoint
        const response = await fetch('http://localhost:3000/api/users/seed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            league,
            count: 10,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          this.results.userSeederTests[league] = {
            status: 'PASS',
            usersCreated: data.count || 10,
          };
          this.results.summary.passedLeagues++;
          console.log(`    ✅ ${league}: ${data.count || 10} users created`);
        } else {
          this.results.userSeederTests[league] = {
            status: 'FAIL',
            usersCreated: 0,
            error: `HTTP ${response.status}`,
          };
          console.log(`    ❌ ${league}: Failed (${response.status})`);
        }
      } catch (error) {
        this.results.userSeederTests[league] = {
          status: 'FAIL',
          usersCreated: 0,
          error: String(error),
        };
        console.log(`    ❌ ${league}: ${error}`);
      }
    }
  }

  private async generateReport() {
    const outDir = path.join(process.cwd(), 'out', 'ops', 'phase17');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const reportPath = path.join(outDir, 'RPC_VALIDATION_SUMMARY.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

    console.log(`✅ RPC validation report saved to ${reportPath}`);
    console.log('\n' + '='.repeat(60));
    console.log('📋 RPC VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(
      `Endpoints: ${this.results.summary.passedEndpoints}/${this.results.summary.totalEndpoints} passed`
    );
    console.log(
      `Leagues: ${this.results.summary.passedLeagues}/${this.results.summary.totalLeagues} passed`
    );
    console.log(`Overall Status: ${this.results.summary.overallStatus}`);
  }

  private isAllPassed(): boolean {
    return (
      this.results.summary.passedEndpoints ===
        this.results.summary.totalEndpoints &&
      this.results.summary.passedLeagues === this.results.summary.totalLeagues
    );
  }
}

// Execute validation
const validator = new RPCValidator();
validator.execute().catch(console.error);

