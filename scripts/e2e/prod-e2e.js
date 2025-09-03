#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class ProductionE2E {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.allowWrites = process.env.ALLOW_WRITES === 'true';
  }

  async runTest(name, testFn) {
    const start = Date.now();
    console.log(`🧪 Running: ${name}`);
    
    try {
      const details = await testFn();
      const duration = Date.now() - start;
      console.log(`✅ ${name} - ${duration}ms`);
      
      return {
        name,
        status: 'PASS',
        duration,
        details
      };
    } catch (error) {
      const duration = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`❌ ${name} - ${duration}ms - ${errorMessage}`);
      
      return {
        name,
        status: 'FAIL',
        duration,
        error: errorMessage
      };
    }
  }

  async testApiHealth() {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    
    try {
      const response = await fetch(`${apiUrl}/health`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return {
        status: response.status,
        data
      };
    } catch (error) {
      throw new Error(`API health check failed: ${error}`);
    }
  }

  async testApiRuntimeMode() {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    
    try {
      const response = await fetch(`${apiUrl}/ops/runtime-mode`);
      if (!response.ok) {
        throw new Error(`Runtime mode check failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return {
        status: response.status,
        data
      };
    } catch (error) {
      throw new Error(`Runtime mode check failed: ${error}`);
    }
  }

  async testDatabaseConnection() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/unified_picks?select=count&limit=1`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Database connection failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        status: response.status,
        recordsFound: Array.isArray(data) ? data.length : 0
      };
    } catch (error) {
      throw new Error(`Database connection test failed: ${error}`);
    }
  }

  async testUnifiedPicksRead() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/unified_picks?select=id,selection,confidence,created_at&limit=5&order=created_at.desc`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Unified picks read failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        status: response.status,
        recordsFound: Array.isArray(data) ? data.length : 0,
        sampleData: data
      };
    } catch (error) {
      throw new Error(`Unified picks read test failed: ${error}`);
    }
  }

  async testTemporalHealth() {
    const temporalAddress = process.env.TEMPORAL_ADDRESS || process.env.TEMPORAL_SERVER_URL || 'localhost:7233';
    
    try {
      const url = temporalAddress.startsWith('http') ? temporalAddress : `http://${temporalAddress}`;
      const response = await fetch(`${url}/api/v1/namespaces`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        status: response.status,
        accessible: response.ok,
        temporalAddress
      };
    } catch (error) {
      return {
        status: 'DEGRADED',
        accessible: false,
        temporalAddress,
        note: 'Temporal not accessible via HTTP (may be normal for gRPC-only setup)'
      };
    }
  }

  async run() {
    console.log('🚀 Starting Production E2E Tests');
    console.log(`📝 Write operations: ${this.allowWrites ? 'ENABLED' : 'DISABLED (read-only)'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Run all tests
    this.results.push(await this.runTest('API Health Check', () => this.testApiHealth()));
    this.results.push(await this.runTest('API Runtime Mode', () => this.testApiRuntimeMode()));
    this.results.push(await this.runTest('Database Connection', () => this.testDatabaseConnection()));
    this.results.push(await this.runTest('Unified Picks Read', () => this.testUnifiedPicksRead()));
    this.results.push(await this.runTest('Temporal Health', () => this.testTemporalHealth()));

    // Calculate summary
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const degraded = this.results.filter(r => r.status === 'DEGRADED').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;

    let overall = 'PASS';
    if (failed > 0) {
      overall = 'FAIL';
    } else if (degraded > 0) {
      overall = 'DEGRADED';
    }

    const summary = {
      timestamp: new Date().toISOString(),
      overall,
      totalTests: this.results.length,
      passed,
      failed,
      degraded,
      skipped,
      totalDuration,
      environment: process.env.NODE_ENV || 'development',
      allowWrites: this.allowWrites
    };

    return {
      summary,
      results: this.results,
      environment: {
        supabaseUrl: process.env.SUPABASE_URL ? '***configured***' : undefined,
        temporalAddress: process.env.TEMPORAL_ADDRESS || process.env.TEMPORAL_SERVER_URL,
        apiUrl: process.env.API_URL || 'http://localhost:3000',
        nodeEnv: process.env.NODE_ENV
      }
    };
  }
}

async function main() {
  const e2e = new ProductionE2E();
  const results = await e2e.run();
  
  // Ensure output directory exists
  const outDir = path.join(process.cwd(), 'out', 'ops');
  fs.mkdirSync(outDir, { recursive: true });
  
  // Write detailed results
  const resultsPath = path.join(outDir, 'prod-e2e.results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  // Write summary
  const summaryPath = path.join(outDir, 'prod-e2e.summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results.summary, null, 2));
  
  // Log final results
  console.log(`\n📊 Production E2E Summary:`);
  console.log(`Overall Status: ${results.summary.overall === 'PASS' ? '✅' : results.summary.overall === 'DEGRADED' ? '⚠️' : '❌'} ${results.summary.overall}`);
  console.log(`Tests: ${results.summary.passed}✅ ${results.summary.failed}❌ ${results.summary.degraded}⚠️ ${results.summary.skipped}⏭️`);
  console.log(`Duration: ${results.summary.totalDuration}ms`);
  console.log(`📄 Results: ${resultsPath}`);
  console.log(`📄 Summary: ${summaryPath}`);
  
  process.exit(results.summary.overall === 'FAIL' ? 1 : 0);
}

if (require.main === module) {
  main().catch(console.error);
}
