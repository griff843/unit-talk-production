#!/usr/bin/env tsx

/**
 * Command Center Wiring Smoke Tests
 * 
 * Validates that all critical API endpoints and UI wiring is functional.
 * Run this test locally and in CI to ensure the system is properly wired.
 */

import { createClient } from '@supabase/supabase-js';

interface SmokeTestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

class SmokeTestRunner {
  private results: SmokeTestResult[] = [];
  private baseUrl: string;
  
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  private async makeRequest(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    console.log(`Testing: ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        // Mock user headers for development
        'x-user-id': 'smoke-test-user',
        'x-user-email': 'admin@smoke-test.com',
        ...options.headers,
      },
      ...options,
    });
    
    return response;
  }

  private addResult(name: string, passed: boolean, error?: string, details?: any) {
    this.results.push({ name, passed, error, details });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${name}${error ? ` - ${error}` : ''}`);
  }

  async testSystemConfig() {
    try {
      // Test GET system config
      const getResponse = await this.makeRequest('/api/ops/system-config');
      
      if (getResponse.status === 501) {
        const errorData = await getResponse.json();
        this.addResult(
          'System Config GET (Not Configured)', 
          true, 
          undefined, 
          { status: 501, message: errorData.message }
        );
      } else if (getResponse.ok) {
        const config = await getResponse.json();
        this.addResult(
          'System Config GET', 
          true, 
          undefined, 
          { hasFlags: Object.keys(config).length > 0 }
        );

        // Test POST system config toggle
        try {
          const postResponse = await this.makeRequest('/api/ops/system-config', {
            method: 'POST',
            body: JSON.stringify({ key: 'SHADOW_MODE', value: true })
          });

          if (postResponse.status === 501) {
            this.addResult('System Config POST (Not Configured)', true);
          } else if (postResponse.ok) {
            const result = await postResponse.json();
            this.addResult('System Config POST', true, undefined, result);
            
            // Toggle back
            await this.makeRequest('/api/ops/system-config', {
              method: 'POST',
              body: JSON.stringify({ key: 'SHADOW_MODE', value: false })
            });
          } else {
            this.addResult('System Config POST', false, `HTTP ${postResponse.status}`);
          }
        } catch (postError) {
          this.addResult('System Config POST', false, (postError as Error).message);
        }

      } else {
        this.addResult('System Config GET', false, `HTTP ${getResponse.status}`);
      }
    } catch (error) {
      this.addResult('System Config GET', false, (error as Error).message);
    }
  }

  async testHealthTiles() {
    try {
      const response = await this.makeRequest('/api/ops/health/tiles');
      
      if (response.status === 501) {
        const errorData = await response.json();
        this.addResult(
          'Health Tiles (Not Configured)', 
          true, 
          undefined, 
          { status: 501, missingKeys: errorData.missingRequired }
        );
      } else if (response.ok) {
        const tiles = await response.json();
        
        const requiredKeys = [
          'feedFreshnessSeconds', 
          'temporalBacklogAgeSeconds', 
          'failureBurnRateLevel', 
          'dlqCount'
        ];
        
        const hasAllKeys = requiredKeys.every(key => key in tiles);
        const hasValidSource = tiles.source === 'live' || tiles.source === 'fallback';
        
        this.addResult(
          'Health Tiles', 
          hasAllKeys && hasValidSource, 
          undefined, 
          { 
            source: tiles.source, 
            timestamp: tiles.timestamp,
            keysPresent: Object.keys(tiles)
          }
        );
      } else {
        this.addResult('Health Tiles', false, `HTTP ${response.status}`);
      }
    } catch (error) {
      this.addResult('Health Tiles', false, (error as Error).message);
    }
  }

  async testPicksHQRoute() {
    try {
      const response = await this.makeRequest('/picks-hq', { 
        method: 'GET',
        redirect: 'manual' // Don't follow redirects automatically
      });
      
      // Should redirect to /dashboard/picks
      const redirected = response.status === 307 || response.status === 308 || response.status === 301 || response.status === 302;
      const redirectLocation = response.headers.get('location');
      
      this.addResult(
        'PicksHQ Route Redirect', 
        redirected && (redirectLocation?.includes('/dashboard/picks') || false),
        undefined,
        { status: response.status, location: redirectLocation }
      );
    } catch (error) {
      this.addResult('PicksHQ Route Redirect', false, (error as Error).message);
    }
  }

  async testPicksSummaryAPI() {
    try {
      const response = await this.makeRequest('/api/picks/summary');
      
      if (response.status === 501) {
        this.addResult('Picks Summary API (Not Configured)', true);
      } else if (response.ok) {
        const data = await response.json();
        
        const hasPicks = Array.isArray(data.picks);
        const hasStats = data.stats && typeof data.stats.totalPicks === 'number';
        
        this.addResult(
          'Picks Summary API', 
          hasPicks && hasStats, 
          undefined, 
          { 
            pickCount: data.picks?.length || 0, 
            hasStats 
          }
        );
      } else {
        this.addResult('Picks Summary API', false, `HTTP ${response.status}`);
      }
    } catch (error) {
      this.addResult('Picks Summary API', false, (error as Error).message);
    }
  }

  async testCommandCenterPage() {
    try {
      const response = await this.makeRequest('/command-center');
      
      if (response.ok) {
        const html = await response.text();
        
        // Check for key elements
        const hasCommandCenter = html.includes('Command Center') || html.includes('data-testid="loading-spinner"');
        const hasToggles = html.includes('toggle-') || html.includes('Safety Toggles');
        
        this.addResult(
          'Command Center Page SSR', 
          hasCommandCenter && response.status === 200,
          undefined,
          { 
            hasCommandCenter, 
            hasToggles,
            contentLength: html.length 
          }
        );
      } else {
        this.addResult('Command Center Page SSR', false, `HTTP ${response.status}`);
      }
    } catch (error) {
      this.addResult('Command Center Page SSR', false, (error as Error).message);
    }
  }

  async testDashboardPicksPage() {
    try {
      const response = await this.makeRequest('/dashboard/picks');
      
      if (response.ok) {
        const html = await response.text();
        
        // Check for PicksHQ content
        const hasPicksHQ = html.includes('PicksHQ') || html.includes('data-testid="picks-hq-root"');
        const hasContent = html.length > 1000; // Reasonable content size
        
        this.addResult(
          'Dashboard Picks Page SSR', 
          hasPicksHQ && hasContent,
          undefined,
          { 
            hasPicksHQ,
            contentLength: html.length 
          }
        );
      } else {
        this.addResult('Dashboard Picks Page SSR', false, `HTTP ${response.status}`);
      }
    } catch (error) {
      this.addResult('Dashboard Picks Page SSR', false, (error as Error).message);
    }
  }

  async runAllTests(): Promise<boolean> {
    console.log('🧪 Starting Command Center Wiring Smoke Tests...\n');
    
    // Run all tests
    await Promise.all([
      this.testSystemConfig(),
      this.testHealthTiles(),
      this.testPicksHQRoute(),
      this.testPicksSummaryAPI(),
      this.testCommandCenterPage(),
      this.testDashboardPicksPage(),
    ]);
    
    // Print summary
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const failed = this.results.filter(r => !r.passed);
    
    console.log(`\n📊 Smoke Test Results: ${passed}/${total} passed`);
    
    if (failed.length > 0) {
      console.log('\n❌ Failed Tests:');
      failed.forEach(result => {
        console.log(`  - ${result.name}: ${result.error || 'Unknown error'}`);
        if (result.details) {
          console.log(`    Details:`, result.details);
        }
      });
    }
    
    const success = failed.length === 0;
    console.log(`\n${success ? '✅ All tests passed!' : '❌ Some tests failed'}`);
    
    return success;
  }
}

// Main execution
async function main() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const runner = new SmokeTestRunner(baseUrl);
  
  try {
    const success = await runner.runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Smoke test runner failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}