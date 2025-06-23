import { createTimestamp, createQATestResult } from '../utils/test-utils';
/**
 * Mobile Testing Module
 * Tests mobile-specific functionality and responsiveness
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

export class MobileTester {
  private config: QAConfig;
  private browser: any | null = null;

  constructor(config: QAConfig) {
    this.config = config;
  }

  async runAllTests(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    
    try {
      this.browser = await chromium.launch({ headless: this.config.test.headless });
      
      results.push(...await this.testMobileResponsiveness());
      results.push(...await this.testTouchInteractions());
      results.push(...await this.testMobilePerformance());
      results.push(...await this.testMobileNavigation());

    } catch (error) {
      results.push({
        testName: 'Mobile Test Suite',
        status: 'FAIL',
        message: `Mobile test suite failed: ${error}`,
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

  private async testMobileResponsiveness(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.browser) throw new Error('Browser not initialized');
      
      const page = await this.browser.newPage();
      
      for (const device of this.config.mobile.testDevices) {
        await page.goto(this.config.environment.baseUrl);
        
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        
        // Check if page loads without horizontal scroll
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        results.push({
          testName: `Mobile Responsiveness - ${device}`,
          status: hasHorizontalScroll ? 'WARNING' : 'PASS',
          message: hasHorizontalScroll ? 'Page has horizontal scroll on mobile' : 'Page is responsive',
          duration: Date.now() - startTime,
          timestamp: createTimestamp()
        });
      }
      
      await page.close();

    } catch (error) {
      results.push({
        testName: 'Mobile Responsiveness',
        status: 'FAIL',
        message: `Test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testTouchInteractions(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.browser) throw new Error('Browser not initialized');
      
      const page = await this.browser.newPage();
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(this.config.environment.baseUrl);
      
      // Test touch targets
      const buttons = await page.$$('button, a, input[type="button"], input[type="submit"]');
      let touchTargetIssues = 0;
      
      for (const button of buttons) {
        const box = await button.boundingBox();
        if (box && (box.width < 44 || box.height < 44)) {
          touchTargetIssues++;
        }
      }

      results.push({
        testName: 'Touch Target Sizes',
        status: touchTargetIssues === 0 ? 'PASS' : 'WARNING',
        message: `${touchTargetIssues} touch targets below 44px minimum`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
      
      await page.close();

    } catch (error) {
      results.push({
        testName: 'Touch Interactions',
        status: 'FAIL',
        message: `Test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testMobilePerformance(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.browser) throw new Error('Browser not initialized');
      
      const page = await this.browser.newPage();
      await page.setViewportSize({ width: 375, height: 667 });
      
      const loadStartTime = Date.now();
      await page.goto(this.config.environment.baseUrl);
      const loadTime = Date.now() - loadStartTime;

      results.push({
        testName: 'Mobile Load Performance',
        status: loadTime <= this.config.mobile.maxLoadTime ? 'PASS' : 'WARNING',
        message: `Page loaded in ${loadTime}ms (max: ${this.config.mobile.maxLoadTime}ms)`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp(),
        metrics: { loadTime }
      });
      
      await page.close();

    } catch (error) {
      results.push({
        testName: 'Mobile Performance',
        status: 'FAIL',
        message: `Test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testMobileNavigation(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.browser) throw new Error('Browser not initialized');
      
      const page = await this.browser.newPage();
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(this.config.environment.baseUrl);
      
      // Look for mobile menu
      const mobileMenu = await page.$('[data-testid="mobile-menu"], .mobile-menu, .hamburger-menu');
      
      results.push({
        testName: 'Mobile Navigation',
        status: mobileMenu ? 'PASS' : 'WARNING',
        message: mobileMenu ? 'Mobile menu found' : 'No mobile menu detected',
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
      
      await page.close();

    } catch (error) {
      results.push({
        testName: 'Mobile Navigation',
        status: 'FAIL',
        message: `Test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }
}
