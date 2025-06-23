import { createTimestamp, createQATestResult } from '../utils/test-utils';
/**
 * Integration Testing Module
 * Tests integration between different system components
 */

import { QAConfig } from '../config/qa-config';
import { QATestResult } from '../types/qa-types';

// Optional playwright import - will be undefined if not installed
let Browser: any, Page: any, chromium: any;
try {
  const playwright = require('playwright');
  Browser = playwright.Browser;
  Page = playwright.Page;
  chromium = playwright.chromium;
} catch (error) {
  // Playwright not available - tests will use mock implementations
}

export class IntegrationTester {
  private config: QAConfig;
  private browser: any | null = null;

  constructor(config: QAConfig) {
    this.config = config;
  }

  async runAllTests(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    
    try {
      this.browser = await chromium.launch({ headless: this.config.test.headless });
      
      results.push(...await this.testAPIIntegration());
      results.push(...await this.testDatabaseIntegration());
      results.push(...await this.testExternalServiceIntegration());
      results.push(...await this.testWorkflowIntegration());

    } catch (error) {
      results.push({
        testName: 'Integration Test Suite',
        status: 'FAIL',
        message: `Integration test suite failed: ${error}`,
        duration: 0,
        timestamp: createTimestamp()
      });
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }

    return results;
  }

  private async testAPIIntegration(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      // Test API endpoints
      const endpoints = [
        '/api/health',
        '/api/picks',
        '/api/user/profile'
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`${this.config.environment.apiUrl}${endpoint}`);
        
        results.push({
          testName: `API Integration - ${endpoint}`,
          status: response.ok ? 'PASS' : 'FAIL',
          message: `${endpoint} returned ${response.status}`,
          duration: Date.now() - startTime,
          timestamp: createTimestamp(),
          metrics: { statusCode: response.status }
        });
      }

    } catch (error) {
      results.push({
        testName: 'API Integration',
        status: 'FAIL',
        message: `Test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testDatabaseIntegration(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      // Test database connectivity through API
      const response = await fetch(`${this.config.environment.apiUrl}/api/health/db`);
      
      results.push({
        testName: 'Database Integration',
        status: response.ok ? 'PASS' : 'FAIL',
        message: response.ok ? 'Database connection healthy' : 'Database connection failed',
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

    } catch (error) {
      results.push({
        testName: 'Database Integration',
        status: 'FAIL',
        message: `Test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testExternalServiceIntegration(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      // Test external service integrations
      const services = ['sportsdata', 'odds', 'notifications'];
      
      for (const service of services) {
        try {
          const response = await fetch(`${this.config.environment.apiUrl}/api/health/${service}`);
          
          results.push({
            testName: `External Service - ${service}`,
            status: response.ok ? 'PASS' : 'WARNING',
            message: response.ok ? `${service} service healthy` : `${service} service unavailable`,
            duration: Date.now() - startTime,
            timestamp: createTimestamp()
          });
        } catch (error) {
          results.push({
            testName: `External Service - ${service}`,
            status: 'WARNING',
            message: `${service} service test failed: ${error}`,
            duration: Date.now() - startTime,
            timestamp: createTimestamp()
          });
        }
      }

    } catch (error) {
      results.push({
        testName: 'External Service Integration',
        status: 'FAIL',
        message: `Test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testWorkflowIntegration(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.browser) throw new Error('Browser not initialized');
      
      const page = await this.browser.newPage();
      await page.goto(this.config.environment.baseUrl);
      
      // Test end-to-end workflow
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');
      
      // Wait for navigation
      await page.waitForTimeout(2000);
      
      const isLoggedIn = await page.$('[data-testid="user-menu"]') !== null;
      
      results.push({
        testName: 'Workflow Integration - Login',
        status: isLoggedIn ? 'PASS' : 'FAIL',
        message: isLoggedIn ? 'Login workflow completed' : 'Login workflow failed',
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
      
      await page.close();

    } catch (error) {
      results.push({
        testName: 'Workflow Integration',
        status: 'FAIL',
        message: `Test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }
}
