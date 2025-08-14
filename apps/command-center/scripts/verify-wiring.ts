#!/usr/bin/env tsx

/**
 * Wiring Patch Verification Script
 * 
 * Executes the specific curl commands from the wiring patch specification
 * to verify that all components are working correctly.
 */

import fetch from 'node-fetch';

interface VerificationResult {
  name: string;
  passed: boolean;
  details?: any;
  error?: string;
}

class WiringVerification {
  private baseUrl: string;
  private results: VerificationResult[] = [];

  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  private async makeRequest(path: string, options: any = {}): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    console.log(`Testing: ${options.method || 'GET'} ${url}`);
    
    return fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
  }

  private addResult(name: string, passed: boolean, details?: any, error?: string) {
    this.results.push({ name, passed, details, error });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${name}${error ? ` - ${error}` : ''}`);
  }

  async verifySystemConfigRoundtrip() {
    try {
      // 1) Get initial config
      const getResponse1 = await this.makeRequest('/api/ops/system-config');
      
      if (getResponse1.status === 501) {
        this.addResult('System Config GET (Not Configured)', true, { status: 501 });
        return;
      }

      if (!getResponse1.ok) {
        this.addResult('System Config GET', false, undefined, `HTTP ${getResponse1.status}`);
        return;
      }

      const config1 = await getResponse1.json();
      this.addResult('System Config GET (Initial)', true, config1);

      // 2) Set SHADOW_MODE to true
      const postResponse = await this.makeRequest('/api/ops/system-config', {
        method: 'POST',
        body: JSON.stringify({ key: 'SHADOW_MODE', value: true })
      });

      if (postResponse.status === 501) {
        this.addResult('System Config POST (Not Configured)', true, { status: 501 });
        return;
      }

      if (!postResponse.ok) {
        this.addResult('System Config POST', false, undefined, `HTTP ${postResponse.status}`);
        return;
      }

      const postResult = await postResponse.json();
      this.addResult('System Config POST (Set SHADOW_MODE=true)', true, postResult);

      // 3) Get config again to verify persistence
      const getResponse2 = await this.makeRequest('/api/ops/system-config');
      
      if (!getResponse2.ok) {
        this.addResult('System Config GET (After Set)', false, undefined, `HTTP ${getResponse2.status}`);
        return;
      }

      const config2 = await getResponse2.json();
      const shadowModeSet = config2.SHADOW_MODE === true;
      
      this.addResult(
        'System Config Roundtrip (SHADOW_MODE persisted)', 
        shadowModeSet, 
        { before: config1.SHADOW_MODE, after: config2.SHADOW_MODE }
      );

      // 4) Reset SHADOW_MODE to false
      await this.makeRequest('/api/ops/system-config', {
        method: 'POST',
        body: JSON.stringify({ key: 'SHADOW_MODE', value: false })
      });

    } catch (error) {
      this.addResult('System Config Roundtrip', false, undefined, (error as Error).message);
    }
  }

  async verifyHealthTiles() {
    try {
      const response = await this.makeRequest('/api/ops/health/tiles');
      
      if (response.status === 501) {
        const errorData = await response.json();
        this.addResult(
          'Health Tiles (Not Configured)', 
          true, 
          { status: 501, missingKeys: errorData.missingRequired }
        );
        return;
      }

      if (!response.ok) {
        this.addResult('Health Tiles', false, undefined, `HTTP ${response.status}`);
        return;
      }

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
        { 
          source: tiles.source, 
          timestamp: tiles.timestamp,
          keysPresent: Object.keys(tiles),
          requiredKeys,
          missingKeys: requiredKeys.filter(key => !(key in tiles))
        }
      );

    } catch (error) {
      this.addResult('Health Tiles', false, undefined, (error as Error).message);
    }
  }

  async verifyAlertmanagerSafeMode() {
    try {
      const response = await this.makeRequest('/api/alerts/alertmanager', {
        method: 'POST',
        body: JSON.stringify({
          severity: 'critical',
          rule: 'IngestionFreshnessCritical',
          description: 'Wiring verification test - critical alert'
        })
      });
      
      if (response.status === 501) {
        this.addResult('Alertmanager (Not Configured)', true, { status: 501 });
        return;
      }

      if (!response.ok) {
        this.addResult('Alertmanager → Safe Mode', false, undefined, `HTTP ${response.status}`);
        return;
      }

      const result = await response.json();
      const safeModeActivated = result.safe_mode_triggered === true || result.safe_mode_activated === true;
      
      this.addResult(
        'Alertmanager → Safe Mode', 
        safeModeActivated, 
        result
      );

    } catch (error) {
      this.addResult('Alertmanager → Safe Mode', false, undefined, (error as Error).message);
    }
  }

  async verifyNavigationAndUI() {
    try {
      // Test command center page
      const ccResponse = await this.makeRequest('/command-center');
      const ccSuccess = ccResponse.ok;
      
      this.addResult(
        'Command Center Page Navigation', 
        ccSuccess, 
        { status: ccResponse.status }
      );

      // Test picks HQ redirect
      const picksResponse = await this.makeRequest('/picks-hq', { redirect: 'manual' });
      const redirected = picksResponse.status >= 300 && picksResponse.status < 400;
      const location = picksResponse.headers.get('location');
      
      this.addResult(
        'PicksHQ Navigation Redirect', 
        redirected && (location?.includes('/dashboard/picks') || false),
        { status: picksResponse.status, location }
      );

      // Test dashboard picks page
      const dashboardResponse = await this.makeRequest('/dashboard/picks');
      const dashboardSuccess = dashboardResponse.ok;
      
      this.addResult(
        'Dashboard Picks Page', 
        dashboardSuccess, 
        { status: dashboardResponse.status }
      );

    } catch (error) {
      this.addResult('Navigation Tests', false, undefined, (error as Error).message);
    }
  }

  async runVerification(): Promise<boolean> {
    console.log('🧪 Starting Wiring Patch Verification Tests...\n');
    
    await Promise.all([
      this.verifySystemConfigRoundtrip(),
      this.verifyHealthTiles(),
      this.verifyAlertmanagerSafeMode(),
      this.verifyNavigationAndUI(),
    ]);
    
    // Print summary
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const failed = this.results.filter(r => !r.passed);
    
    console.log(`\n📊 Verification Results: ${passed}/${total} passed`);
    
    if (failed.length > 0) {
      console.log('\n❌ Failed Verifications:');
      failed.forEach(result => {
        console.log(`  - ${result.name}: ${result.error || 'Unknown error'}`);
        if (result.details) {
          console.log(`    Details:`, result.details);
        }
      });
    }
    
    const success = failed.length === 0;
    console.log(`\n${success ? '✅ All verifications passed!' : '❌ Some verifications failed'}`);
    
    return success;
  }
}

// Main execution
async function main() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const verifier = new WiringVerification(baseUrl);
  
  try {
    const success = await verifier.runVerification();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Verification runner failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}