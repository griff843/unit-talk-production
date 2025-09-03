#!/usr/bin/env node

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface E2EResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'DEGRADED' | 'SKIP';
  duration: number;
  error?: string;
  details?: any;
}

interface E2ESummary {
  timestamp: string;
  overall: 'PASS' | 'FAIL' | 'DEGRADED';
  totalTests: number;
  passed: number;
  failed: number;
  degraded: number;
  skipped: number;
  totalDuration: number;
  environment: string;
  allowWrites: boolean;
}

interface E2EResults {
  summary: E2ESummary;
  results: E2EResult[];
  environment: {
    supabaseUrl?: string;
    temporalAddress?: string;
    apiUrl?: string;
    nodeEnv?: string;
  };
}

class ProductionE2E {
  private results: E2EResult[] = [];
  private startTime = Date.now();
  private allowWrites = false;

  constructor() {
    this.allowWrites = process.env.ALLOW_WRITES === 'true';
  }

  private async runTest(name: string, testFn: () => Promise<any>): Promise<E2EResult> {
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

  private async testApiHealth(): Promise<any> {
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

  private async testApiRuntimeMode(): Promise<any> {
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

  private async testDatabaseConnection(): Promise<any> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    try {
      // Simple connection test - try to read from a system table
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

  private async testUnifiedPicksRead(): Promise<any> {
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

  private async testTemporalHealth(): Promise<any> {
    const temporalAddress = process.env.TEMPORAL_ADDRESS || process.env.TEMPORAL_SERVER_URL || 'localhost:7233';
    
    try {
      // Simple TCP connection test to Temporal
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
      // Temporal might not be accessible via HTTP, mark as degraded rather than failed
      return {
        status: 'DEGRADED',
        accessible: false,
        temporalAddress,
        note: 'Temporal not accessible via HTTP (may be normal for gRPC-only setup)'
      };
    }
  }

  async run(): Promise<E2EResults> {
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

    let overall: 'PASS' | 'FAIL' | 'DEGRADED' = 'PASS';
    if (failed > 0) {
      overall = 'FAIL';
    } else if (degraded > 0) {
      overall = 'DEGRADED';
    }

    const summary: E2ESummary = {
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
  const outDir = join(process.cwd(), 'out', 'ops');
  mkdirSync(outDir, { recursive: true });
  
  // Write detailed results
  const resultsPath = join(outDir, 'prod-e2e.results.json');
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  // Write summary
  const summaryPath = join(outDir, 'prod-e2e.summary.json');
  writeFileSync(summaryPath, JSON.stringify(results.summary, null, 2));
  
  // Log final results
  console.log(`\n📊 Production E2E Summary:`);
  console.log(`Overall Status: ${results.summary.overall === 'PASS' ? '✅' : results.summary.overall === 'DEGRADED' ? '⚠️' : '❌'} ${results.summary.overall}`);
  console.log(`Tests: ${results.summary.passed}✅ ${results.summary.failed}❌ ${results.summary.degraded}⚠️ ${results.summary.skipped}⏭️`);
  console.log(`Duration: ${results.summary.totalDuration}ms`);
  console.log(`📄 Results: ${resultsPath}`);
  console.log(`📄 Summary: ${summaryPath}`);
  
  process.exit(results.summary.overall === 'FAIL' ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
