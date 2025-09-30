/**
 * Test SGO API Authentication and Configuration
 *
 * This script validates that the SGO API key configuration is working correctly
 * and tests various authentication scenarios.
 */

import { fetchSGOEvents } from '../logic/providers/sgoFetcher';
import { sgoApiKeyManager } from '../utils/sgoApiKeyManager';
import { sgoApiMonitoring } from '../services/SGOApiMonitoring';
import { logger } from '../utils/logger';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  duration?: number;
  data?: any;
}

class SGOAuthenticationTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting SGO API Authentication Tests');
    console.log('=====================================\n');

    // Reset monitoring to get clean metrics
    sgoApiMonitoring.resetMetrics();

    // Test 1: API Key Configuration
    await this.testApiKeyConfiguration();

    // Test 2: API Key Validation
    await this.testApiKeyValidation();

    // Test 3: Basic API Request
    await this.testBasicApiRequest();

    // Test 4: Authentication Error Handling
    await this.testAuthenticationErrorHandling();

    // Test 5: Rate Limit Monitoring
    await this.testRateLimitMonitoring();

    // Test 6: Circuit Breaker Functionality
    await this.testCircuitBreaker();

    // Print summary
    this.printTestSummary();
  }

  private async testApiKeyConfiguration(): Promise<void> {
    const testName = 'API Key Configuration';
    const startTime = Date.now();

    try {
      // Test environment variable access
      const hasConfig = !!process.env.SGO_API_KEY || !!process.env.SPORTSGAMEODDS_KEY;

      if (!hasConfig) {
        throw new Error('No SGO API key found in environment variables');
      }

      // Test API key manager
      const apiKey = sgoApiKeyManager.getSGOApiKey();

      if (!apiKey) {
        throw new Error('API key manager returned empty key');
      }

      this.results.push({
        name: testName,
        success: true,
        message: 'API key configuration found and accessible',
        duration: Date.now() - startTime,
        data: { keyLength: apiKey.length, keyPrefix: apiKey.substring(0, 4) + '...' }
      });

      console.log('✅', testName, 'PASSED');

    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });

      console.log('❌', testName, 'FAILED:', error instanceof Error ? error.message : error);
    }
  }

  private async testApiKeyValidation(): Promise<void> {
    const testName = 'API Key Validation';
    const startTime = Date.now();

    try {
      const config = await sgoApiKeyManager.getSGOApiConfig();

      if (!config.isValidated) {
        throw new Error('API key validation failed');
      }

      this.results.push({
        name: testName,
        success: true,
        message: 'API key validation successful',
        duration: Date.now() - startTime,
        data: { isValidated: config.isValidated, lastUsed: config.lastUsed }
      });

      console.log('✅', testName, 'PASSED');

    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });

      console.log('❌', testName, 'FAILED:', error instanceof Error ? error.message : error);
    }
  }

  private async testBasicApiRequest(): Promise<void> {
    const testName = 'Basic API Request';
    const startTime = Date.now();

    try {
      // Make a simple request to test authentication
      const events = await fetchSGOEvents({
        leagueID: 'NFL',
        limit: 1,
        oddsAvailable: false // Don't require odds to minimize API usage
      });

      if (!Array.isArray(events)) {
        throw new Error('API returned non-array response');
      }

      this.results.push({
        name: testName,
        success: true,
        message: `API request successful, returned ${events.length} events`,
        duration: Date.now() - startTime,
        data: { eventCount: events.length }
      });

      console.log('✅', testName, 'PASSED');

    } catch (error) {
      // Check if this is an authentication error
      const isAuthError = error instanceof Error &&
        (error.message.includes('Authentication failed') ||
         error.message.includes('Access forbidden') ||
         error.message.includes('Invalid API key'));

      this.results.push({
        name: testName,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        data: { isAuthError }
      });

      if (isAuthError) {
        console.log('❌', testName, 'FAILED (AUTH):', error instanceof Error ? error.message : error);
      } else {
        console.log('❌', testName, 'FAILED:', error instanceof Error ? error.message : error);
      }
    }
  }

  private async testAuthenticationErrorHandling(): Promise<void> {
    const testName = 'Authentication Error Handling';
    const startTime = Date.now();

    try {
      // Test with invalid API key
      try {
        await fetchSGOEvents({
          apiKey: 'invalid_test_key',
          leagueID: 'NFL',
          limit: 1
        });

        // If we get here, the test failed
        throw new Error('Expected authentication error but request succeeded');

      } catch (apiError) {
        const expectedAuthError = apiError instanceof Error &&
          (apiError.message.includes('Authentication failed') ||
           apiError.message.includes('Access forbidden'));

        if (!expectedAuthError) {
          throw new Error(`Expected auth error but got: ${apiError instanceof Error ? apiError.message : apiError}`);
        }

        // Check if monitoring recorded the error correctly
        const metrics = sgoApiMonitoring.getDetailedMetrics();
        if (metrics.authErrors === 0) {
          throw new Error('Authentication error not recorded in monitoring');
        }
      }

      this.results.push({
        name: testName,
        success: true,
        message: 'Authentication error handling working correctly',
        duration: Date.now() - startTime
      });

      console.log('✅', testName, 'PASSED');

    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });

      console.log('❌', testName, 'FAILED:', error instanceof Error ? error.message : error);
    }
  }

  private async testRateLimitMonitoring(): Promise<void> {
    const testName = 'Rate Limit Monitoring';
    const startTime = Date.now();

    try {
      // Check initial monitoring state
      const initialMetrics = sgoApiMonitoring.getDetailedMetrics();
      const initialRequestCount = initialMetrics.requestCount;

      // Make a test request
      try {
        await fetchSGOEvents({
          leagueID: 'NFL',
          limit: 1,
          oddsAvailable: false
        });
      } catch (error) {
        // We expect this might fail in some environments, but we're testing monitoring
        logger.debug('Expected test request failure for monitoring test');
      }

      // Check if monitoring was updated
      const finalMetrics = sgoApiMonitoring.getDetailedMetrics();

      if (finalMetrics.requestCount <= initialRequestCount) {
        throw new Error('Request count not updated in monitoring');
      }

      this.results.push({
        name: testName,
        success: true,
        message: 'Rate limit monitoring functioning correctly',
        duration: Date.now() - startTime,
        data: {
          initialRequests: initialRequestCount,
          finalRequests: finalMetrics.requestCount
        }
      });

      console.log('✅', testName, 'PASSED');

    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });

      console.log('❌', testName, 'FAILED:', error instanceof Error ? error.message : error);
    }
  }

  private async testCircuitBreaker(): Promise<void> {
    const testName = 'Circuit Breaker Functionality';
    const startTime = Date.now();

    try {
      // Get initial circuit breaker state
      const initialHealth = sgoApiMonitoring.getHealthStatus();

      // Test that circuit breaker allows requests initially
      const shouldAllow = sgoApiMonitoring.shouldAllowRequest();

      if (!shouldAllow && initialHealth.circuitState === 'CLOSED') {
        throw new Error('Circuit breaker blocking requests when it should be closed');
      }

      this.results.push({
        name: testName,
        success: true,
        message: 'Circuit breaker functioning correctly',
        duration: Date.now() - startTime,
        data: {
          circuitState: initialHealth.circuitState,
          shouldAllowRequests: shouldAllow
        }
      });

      console.log('✅', testName, 'PASSED');

    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });

      console.log('❌', testName, 'FAILED:', error instanceof Error ? error.message : error);
    }
  }

  private printTestSummary(): void {
    console.log('\n📊 Test Summary');
    console.log('================');

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => r.success === false).length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total:  ${this.results.length}\n`);

    // Detailed results
    console.log('📋 Detailed Results:');
    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = result.duration ? `(${result.duration}ms)` : '';
      console.log(`${index + 1}. ${status} ${result.name} ${duration}`);
      console.log(`   ${result.message}`);
      if (result.data) {
        console.log(`   Data:`, JSON.stringify(result.data, null, 2));
      }
      console.log('');
    });

    // API Health Status
    const health = sgoApiMonitoring.getHealthStatus();
    console.log('🏥 API Health Status:');
    console.log(`   Status: ${health.status}`);
    console.log(`   Circuit: ${health.circuitState}`);
    if (health.issues.length > 0) {
      console.log(`   Issues: ${health.issues.join(', ')}`);
    }

    const metrics = sgoApiMonitoring.getDetailedMetrics();
    console.log(`   Requests: ${metrics.requestCount} (${metrics.successCount} success, ${metrics.errorCount} error)`);
    console.log(`   Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n⚠️  Some tests failed. Check configuration and API key validity.');
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed! SGO API authentication is configured correctly.');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new SGOAuthenticationTester();
  tester.runAllTests().catch(error => {
    console.error('💥 Test runner error:', error);
    process.exit(1);
  });
}

export { SGOAuthenticationTester };