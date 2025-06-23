import { createTimestamp, createQATestResult } from '../qa/utils/test-utils';
/**
 * Mobile Accessibility Tester
 * Tests mobile-specific accessibility features and compliance
 */

// Playwright imports handled conditionally
import { QAConfig } from '../qa/config/qa-config';
import { QATestResult } from '../qa/types/qa-types';

export class MobileAccessibilityTester {
  private config: QAConfig;
  private browser?: any;
  private page?: any;

  constructor(config: QAConfig) {
    this.config = config;
  }

  async runAllTests(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    
    try {
      // Try to use chromium if available, otherwise skip browser tests
      let chromium: any;
      try {
        chromium = require('playwright').chromium;
        this.browser = await chromium.launch({ headless: this.config.test.headless });
        this.page = await this.browser.newPage();
      } catch (error) {
        console.warn('Playwright/Chromium not available - skipping browser-based tests');
        this.browser = null;
        this.page = null;
      }

      // Run all mobile accessibility tests
      results.push(...await this.testTouchTargetSizes());
      results.push(...await this.testMobileNavigation());
      results.push(...await this.testScreenReaderCompatibility());
      results.push(...await this.testMobileKeyboardNavigation());
      results.push(...await this.testMobileViewportAccessibility());
      results.push(...await this.testMobileFormAccessibility());

    } catch (error) {
      results.push({
        testName: 'Mobile Accessibility Test Suite',
        status: 'FAIL',
        message: `Test suite failed: ${error}`,
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

  private async testTouchTargetSizes(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.page) throw new Error('Page not initialized');

      await this.page.goto(this.config.environment.baseUrl);
      await this.page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

      // Test interactive elements have minimum touch target size
      const interactiveElements = await this.page.$$('button, a, input, select, textarea, [role="button"], [role="link"]');
      
      let passCount = 0;
      let failCount = 0;

      for (const element of interactiveElements) {
        const box = await element.boundingBox();
        if (box) {
          const minSize = Math.min(box.width, box.height);
          if (minSize >= this.config.mobile.minTouchTargetSize) {
            passCount++;
          } else {
            failCount++;
          }
        }
      }

      results.push({
        testName: 'Touch Target Sizes',
        status: failCount === 0 ? 'PASS' : 'WARNING',
        message: `${passCount} elements passed, ${failCount} elements below minimum size (${this.config.mobile.minTouchTargetSize}px)`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp(),
        metrics: {
          passCount,
          failCount,
          totalElements: interactiveElements.length
        }
      });

    } catch (error) {
      results.push({
        testName: 'Touch Target Sizes',
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
      if (!this.page) throw new Error('Page not initialized');

      await this.page.setViewportSize({ width: 375, height: 667 });
      
      // Test mobile menu accessibility
      const mobileMenuButton = await this.page.$('[data-testid="mobile-menu-button"], .mobile-menu-toggle, .hamburger-menu');
      
      if (mobileMenuButton) {
        // Check if menu button has proper ARIA attributes
        const ariaLabel = await mobileMenuButton.getAttribute('aria-label');
        const ariaExpanded = await mobileMenuButton.getAttribute('aria-expanded');
        
        const hasProperAria = ariaLabel && ariaExpanded !== null;
        
        results.push({
          testName: 'Mobile Menu Accessibility',
          status: hasProperAria ? 'PASS' : 'WARNING',
          message: hasProperAria ? 'Mobile menu has proper ARIA attributes' : 'Mobile menu missing ARIA attributes',
          duration: Date.now() - startTime,
          timestamp: createTimestamp()
        });
      } else {
        results.push({
          testName: 'Mobile Menu Accessibility',
          status: 'WARNING',
          message: 'No mobile menu button found',
          duration: Date.now() - startTime,
          timestamp: createTimestamp()
        });
      }

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

  private async testScreenReaderCompatibility(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.page) throw new Error('Page not initialized');

      // Test for proper heading structure
      const headings = await this.page.$$('h1, h2, h3, h4, h5, h6');
      const h1Count = await this.page.$$eval('h1', els => els.length);
      
      // Check for skip links
      const skipLinks = await this.page.$$('a[href^="#"], [data-testid="skip-link"]');
      
      // Check for proper form labels
      const inputs = await this.page.$$('input, select, textarea');
      let labeledInputs = 0;
      
      for (const input of inputs) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        
        if (id) {
          const label = await this.page.$(`label[for="${id}"]`);
          if (label || ariaLabel || ariaLabelledBy) {
            labeledInputs++;
          }
        } else if (ariaLabel || ariaLabelledBy) {
          labeledInputs++;
        }
      }

      const labelingScore = inputs.length > 0 ? (labeledInputs / inputs.length) * 100 : 100;

      results.push({
        testName: 'Screen Reader Compatibility',
        status: h1Count === 1 && skipLinks.length > 0 && labelingScore >= 90 ? 'PASS' : 'WARNING',
        message: `H1 count: ${h1Count}, Skip links: ${skipLinks.length}, Form labeling: ${labelingScore.toFixed(1)}%`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp(),
        metrics: {
          h1Count,
          skipLinksCount: skipLinks.length,
          labelingScore,
          totalInputs: inputs.length,
          labeledInputs
        }
      });

    } catch (error) {
      results.push({
        testName: 'Screen Reader Compatibility',
        status: 'FAIL',
        message: `Test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testMobileKeyboardNavigation(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.page) throw new Error('Page not initialized');

      await this.page.setViewportSize({ width: 375, height: 667 });
      
      // Test tab navigation
      const focusableElements = await this.page.$$('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      
      let tabNavigationWorks = true;
      let currentIndex = 0;
      
      // Test first few elements for tab navigation
      const testCount = Math.min(5, focusableElements.length);
      
      for (let i = 0; i < testCount; i++) {
        await this.page.keyboard.press('Tab');
        const activeElement = await this.page.evaluate(() => document.activeElement?.tagName);
        
        if (!activeElement || !['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(activeElement)) {
          tabNavigationWorks = false;
          break;
        }
      }

      results.push({
        testName: 'Mobile Keyboard Navigation',
        status: tabNavigationWorks ? 'PASS' : 'WARNING',
        message: tabNavigationWorks ? 'Tab navigation works correctly' : 'Tab navigation issues detected',
        duration: Date.now() - startTime,
        timestamp: createTimestamp(),
        metrics: {
          focusableElements: focusableElements.length,
          testedElements: testCount
        }
      });

    } catch (error) {
      results.push({
        testName: 'Mobile Keyboard Navigation',
        status: 'FAIL',
        message: `Test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testMobileViewportAccessibility(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.page) throw new Error('Page not initialized');

      const viewports = [
        { width: 320, height: 568, name: 'iPhone 5' },
        { width: 375, height: 667, name: 'iPhone SE' },
        { width: 414, height: 896, name: 'iPhone 11' }
      ];

      for (const viewport of viewports) {
        await this.page.setViewportSize(viewport);
        await this.page.goto(this.config.environment.baseUrl);
        
        // Check for horizontal scrolling
        const hasHorizontalScroll = await this.page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        
        // Check for content overflow
        const overflowingElements = await this.page.$$eval('*', elements => {
          return elements.filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.right > window.innerWidth;
          }).length;
        });

        results.push({
          testName: `Viewport Accessibility - ${viewport.name}`,
          status: !hasHorizontalScroll && overflowingElements === 0 ? 'PASS' : 'WARNING',
          message: `Horizontal scroll: ${hasHorizontalScroll}, Overflowing elements: ${overflowingElements}`,
          duration: Date.now() - startTime,
          timestamp: createTimestamp(),
          metrics: {
            viewport: viewport.name,
            hasHorizontalScroll,
            overflowingElements
          }
        });
      }

    } catch (error) {
      results.push({
        testName: 'Mobile Viewport Accessibility',
        status: 'FAIL',
        message: `Test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testMobileFormAccessibility(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.page) throw new Error('Page not initialized');

      await this.page.setViewportSize({ width: 375, height: 667 });
      
      // Look for forms
      const forms = await this.page.$$('form');
      
      if (forms.length === 0) {
        results.push({
          testName: 'Mobile Form Accessibility',
          status: 'WARNING',
          message: 'No forms found to test',
          duration: Date.now() - startTime,
          timestamp: createTimestamp()
        });
        return results;
      }

      let totalInputs = 0;
      let accessibleInputs = 0;

      for (const form of forms) {
        const inputs = await form.$$('input, select, textarea');
        totalInputs += inputs.length;

        for (const input of inputs) {
          const type = await input.getAttribute('type');
          const autocomplete = await input.getAttribute('autocomplete');
          const inputmode = await input.getAttribute('inputmode');
          
          // Check for appropriate input types and attributes
          let isAccessible = true;
          
          if (type === 'email' || autocomplete === 'email') {
            isAccessible = inputmode === 'email' || type === 'email';
          } else if (type === 'tel' || autocomplete === 'tel') {
            isAccessible = inputmode === 'tel' || type === 'tel';
          } else if (type === 'number') {
            isAccessible = inputmode === 'numeric' || inputmode === 'decimal';
          }
          
          if (isAccessible) {
            accessibleInputs++;
          }
        }
      }

      const accessibilityScore = totalInputs > 0 ? (accessibleInputs / totalInputs) * 100 : 100;

      results.push({
        testName: 'Mobile Form Accessibility',
        status: accessibilityScore >= 80 ? 'PASS' : 'WARNING',
        message: `${accessibleInputs}/${totalInputs} inputs have proper mobile attributes (${accessibilityScore.toFixed(1)}%)`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp(),
        metrics: {
          totalInputs,
          accessibleInputs,
          accessibilityScore,
          formsCount: forms.length
        }
      });

    } catch (error) {
      results.push({
        testName: 'Mobile Form Accessibility',
        status: 'FAIL',
        message: `Test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }
}

export default MobileAccessibilityTester;