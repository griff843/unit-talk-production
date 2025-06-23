import { QAConfig } from '../config/qa-config';
import { QATestResult } from '../types/qa-types';
import { createTimestamp, createQATestResult } from '../utils/test-utils';

// Optional playwright import - will be undefined if not installed
let Browser: any, Page: any, chromium: any, injectAxe: any, getViolations: any;
try {
  const playwright = require('playwright');
  Browser = playwright.Browser;
  Page = playwright.Page;
  chromium = playwright.chromium;
  
  // Try to import axe-core
  try {
    const axe = require('@axe-core/playwright');
    injectAxe = axe.injectAxe;
    getViolations = axe.getViolations;
  } catch (error) {
    // Axe not available
  }
} catch (error) {
  // Playwright not available - tests will use mock implementations
}

export class AccessibilityTester {
  private config: QAConfig;
  private browser: typeof Browser | null = null;

  constructor(config: QAConfig) {
    this.config = config;
  }

  async runAllTests(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    
    try {
      if (chromium) {
        this.browser = await chromium.launch({ headless: this.config.test.headless });
      }
      
      results.push(...await this.testPageAccessibility());
      results.push(...await this.testFormAccessibility());
      results.push(...await this.testNavigationAccessibility());
      results.push(...await this.testInteractiveElementsAccessibility());
      results.push(...await this.testColorContrast());
      results.push(...await this.testKeyboardNavigation());
      results.push(...await this.testScreenReaderCompatibility());
      results.push(...await this.testFocusManagement());

    } catch (error) {
      results.push(createQATestResult(
        'Accessibility Test Suite',
        'FAIL',
        `Accessibility test suite failed: ${error}`,
        0
      ));
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }

    return results;
  }

  private async testPageAccessibility(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.browser) {
        results.push(createQATestResult(
          'Page Accessibility',
          'SKIP',
          'Browser not available',
          Date.now() - startTime
        ));
        return results;
      }

      const page = await this.browser.newPage();
      await page.goto(this.config.environment.baseUrl);

      if (injectAxe && getViolations) {
        await injectAxe(page);
        const violations = await getViolations(page);
        
        const criticalViolations = violations.filter((v: any) => v.impact === 'critical');
        const seriousViolations = violations.filter((v: any) => v.impact === 'serious');
        const moderateViolations = violations.filter((v: any) => v.impact === 'moderate');
        const minorViolations = violations.filter((v: any) => v.impact === 'minor');

        results.push(createQATestResult(
          'Page Accessibility',
          violations.length === 0 ? 'PASS' : 'FAIL',
          `Found ${violations.length} accessibility violations (${criticalViolations.length} critical, ${seriousViolations.length} serious)`,
          Date.now() - startTime,
          { violations: violations.map((v: any) => ({ id: v.id, impact: v.impact, description: v.description })) }
        ));
      } else {
        results.push(createQATestResult(
          'Page Accessibility',
          'SKIP',
          'Axe-core not available',
          Date.now() - startTime
        ));
      }

      await page.close();

    } catch (error) {
      results.push(createQATestResult(
        'Page Accessibility',
        'FAIL',
        `Test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }

  private async testFormAccessibility(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.browser) {
        results.push(createQATestResult(
          'Form Accessibility',
          'SKIP',
          'Browser not available',
          Date.now() - startTime
        ));
        return results;
      }

      const formsToTest = [
        { name: 'Login Form', url: '/login', formSelector: 'form[data-testid="login-form"]' },
        { name: 'Registration Form', url: '/register', formSelector: 'form[data-testid="register-form"]' },
        { name: 'Contact Form', url: '/contact', formSelector: 'form[data-testid="contact-form"]' }
      ];

      for (const formTest of formsToTest) {
        const page = await this.browser.newPage();
        await page.goto(`${this.config.environment.baseUrl}${formTest.url}`);

        const issues = await this.checkFormAccessibility(page, formTest.formSelector);
        
        results.push(createQATestResult(
          `Form Accessibility - ${formTest.name}`,
          issues.length === 0 ? 'PASS' : 'WARNING',
          `Found ${issues.length} form accessibility issues`,
          Date.now() - startTime,
          { issues }
        ));

        await page.close();
      }

    } catch (error) {
      results.push(createQATestResult(
        'Form Accessibility',
        'FAIL',
        `Test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }

  private async testNavigationAccessibility(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.browser) {
        results.push(createQATestResult(
          'Navigation Accessibility',
          'SKIP',
          'Browser not available',
          Date.now() - startTime
        ));
        return results;
      }

      const page = await this.browser.newPage();
      await page.goto(this.config.environment.baseUrl);

      const navIssues = await this.checkNavigationAccessibility(page);
      
      results.push(createQATestResult(
        'Navigation Accessibility',
        navIssues.length === 0 ? 'PASS' : 'WARNING',
        `Found ${navIssues.length} navigation accessibility issues`,
        Date.now() - startTime,
        { issues: navIssues }
      ));

      await page.close();

    } catch (error) {
      results.push(createQATestResult(
        'Navigation Accessibility',
        'FAIL',
        `Test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }

  private async testInteractiveElementsAccessibility(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.browser) {
        results.push(createQATestResult(
          'Interactive Elements Accessibility',
          'SKIP',
          'Browser not available',
          Date.now() - startTime
        ));
        return results;
      }

      const page = await this.browser.newPage();
      await page.goto(this.config.environment.baseUrl);

      const interactiveIssues = await this.checkInteractiveElementsAccessibility(page);
      
      results.push(createQATestResult(
        'Interactive Elements Accessibility',
        interactiveIssues.length === 0 ? 'PASS' : 'WARNING',
        `Found ${interactiveIssues.length} interactive element accessibility issues`,
        Date.now() - startTime,
        { issues: interactiveIssues }
      ));

      await page.close();

    } catch (error) {
      results.push(createQATestResult(
        'Interactive Elements Accessibility',
        'FAIL',
        `Test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }

  private async testColorContrast(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.browser || !injectAxe || !getViolations) {
        results.push(createQATestResult(
          'Color Contrast',
          'SKIP',
          'Browser or axe-core not available',
          Date.now() - startTime
        ));
        return results;
      }

      const page = await this.browser.newPage();
      await page.goto(this.config.environment.baseUrl);

      await injectAxe(page);
      const violations = await getViolations(page, { tags: ['wcag2aa'] });
      
      const contrastViolations = violations.filter((v: any) => v.id.includes('color-contrast'));
      
      results.push(createQATestResult(
        'Color Contrast',
        contrastViolations.length === 0 ? 'PASS' : 'FAIL',
        `Found ${contrastViolations.length} color contrast violations`,
        Date.now() - startTime,
        { violations: contrastViolations.map((v: any) => ({ id: v.id, description: v.description })) }
      ));

      await page.close();

    } catch (error) {
      results.push(createQATestResult(
        'Color Contrast',
        'FAIL',
        `Test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }

  private async testKeyboardNavigation(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.browser) {
        results.push(createQATestResult(
          'Keyboard Navigation',
          'SKIP',
          'Browser not available',
          Date.now() - startTime
        ));
        return results;
      }

      const page = await this.browser.newPage();
      await page.goto(this.config.environment.baseUrl);

      const keyboardIssues = await this.checkKeyboardNavigation(page);
      
      results.push(createQATestResult(
        'Keyboard Navigation',
        keyboardIssues.length === 0 ? 'PASS' : 'WARNING',
        `Found ${keyboardIssues.length} keyboard navigation issues`,
        Date.now() - startTime,
        { issues: keyboardIssues }
      ));

      await page.close();

    } catch (error) {
      results.push(createQATestResult(
        'Keyboard Navigation',
        'FAIL',
        `Test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }

  private async testScreenReaderCompatibility(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.browser) {
        results.push(createQATestResult(
          'Screen Reader Compatibility',
          'SKIP',
          'Browser not available',
          Date.now() - startTime
        ));
        return results;
      }

      const page = await this.browser.newPage();
      await page.goto(this.config.environment.baseUrl);

      const screenReaderIssues = await this.checkScreenReaderCompatibility(page);
      
      results.push(createQATestResult(
        'Screen Reader Compatibility',
        screenReaderIssues.length === 0 ? 'PASS' : 'WARNING',
        `Found ${screenReaderIssues.length} screen reader compatibility issues`,
        Date.now() - startTime,
        { issues: screenReaderIssues }
      ));

      await page.close();

    } catch (error) {
      results.push(createQATestResult(
        'Screen Reader Compatibility',
        'FAIL',
        `Test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }

  private async testFocusManagement(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      if (!this.browser) {
        results.push(createQATestResult(
          'Focus Management',
          'SKIP',
          'Browser not available',
          Date.now() - startTime
        ));
        return results;
      }

      const page = await this.browser.newPage();
      await page.goto(this.config.environment.baseUrl);

      const focusIssues = await this.checkFocusManagement(page);
      
      results.push(createQATestResult(
        'Focus Management',
        focusIssues.length === 0 ? 'PASS' : 'WARNING',
        `Found ${focusIssues.length} focus management issues`,
        Date.now() - startTime,
        { issues: focusIssues }
      ));

      await page.close();

    } catch (error) {
      results.push(createQATestResult(
        'Focus Management',
        'FAIL',
        `Test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }

  // Helper methods
  private async checkFormAccessibility(page: any, formSelector: string): Promise<any[]> {
    const issues: any[] = [];
    
    try {
      // Check for form labels
      const inputs = await page.$$(`${formSelector} input, ${formSelector} textarea, ${formSelector} select`);
      
      for (const input of inputs) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        
        if (!id && !ariaLabel && !ariaLabelledBy) {
          issues.push('Input without proper labeling found');
        }
      }

      // Check for fieldsets
      const fieldsets = await page.$$(`${formSelector} fieldset`);
      for (const fieldset of fieldsets) {
        const legend = await fieldset.$('legend');
        if (!legend) {
          issues.push('Fieldset without legend found');
        }
      }

    } catch (error) {
      issues.push(`Form accessibility check failed: ${error}`);
    }

    return issues;
  }

  private async checkNavigationAccessibility(page: any): Promise<any[]> {
    const issues: any[] = [];
    
    try {
      // Check for navigation landmarks
      const nav = await page.$('nav');
      if (!nav) {
        issues.push('No navigation landmark found');
      }

      // Check for skip links
      const skipLink = await page.$('a[href="#main"], a[href="#content"]');
      if (!skipLink) {
        issues.push('No skip link found');
      }

      // Check navigation links
      const navLinks = await page.$$('nav a');
      for (const link of navLinks) {
        const text = await link.textContent();
        if (!text || text.trim().length === 0) {
          issues.push('Navigation link without text found');
        }
      }

    } catch (error) {
      issues.push(`Navigation accessibility check failed: ${error}`);
    }

    return issues;
  }

  private async checkInteractiveElementsAccessibility(page: any): Promise<any[]> {
    const issues: any[] = [];
    
    try {
      // Check buttons
      const buttons = await page.$$('button');
      for (const button of buttons) {
        const text = await button.textContent();
        const ariaLabel = await button.getAttribute('aria-label');
        if (!text && !ariaLabel) {
          issues.push('Button without accessible text found');
        }
      }

      // Check interactive elements for proper roles
      const interactiveElements = await page.$$('[onclick], [onkeydown], [onkeyup]');
      for (const element of interactiveElements) {
        const role = await element.getAttribute('role');
        const tabindex = await element.getAttribute('tabindex');
        if (!role && !tabindex) {
          issues.push('Interactive element without proper role or tabindex found');
        }
      }

    } catch (error) {
      issues.push(`Interactive elements accessibility check failed: ${error}`);
    }

    return issues;
  }

  private async checkKeyboardNavigation(page: any): Promise<any[]> {
    const issues: any[] = [];
    
    try {
      // Test tab navigation
      await page.keyboard.press('Tab');
      const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
      
      if (!firstFocused || firstFocused === 'BODY') {
        issues.push('No focusable element found on first tab');
      }

      // Test escape key functionality
      await page.keyboard.press('Escape');
      
      // Additional keyboard navigation tests would go here

    } catch (error) {
      issues.push(`Keyboard navigation check failed: ${error}`);
    }

    return issues;
  }

  private async checkScreenReaderCompatibility(page: any): Promise<any[]> {
    const issues: any[] = [];
    
    try {
      // Check heading structure
      const headings = await page.$$('h1, h2, h3, h4, h5, h6');
      let previousLevel = 0;
      
      for (const heading of headings) {
        const level = parseInt(await heading.evaluate((el: any) => el.tagName.charAt(1)));
        if (level > previousLevel + 1) {
          issues.push(`Heading level skip detected: h${previousLevel} to h${level}`);
        }
        previousLevel = level;
      }

      // Check images for alt text
      const images = await page.$$('img');
      for (const img of images) {
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');
        if (alt === null && role !== 'presentation') {
          issues.push('Image without alt text found');
        }
      }

      // Check ARIA elements
      const ariaElements = await page.$$('[aria-label], [aria-labelledby], [aria-describedby]');
      for (const element of ariaElements) {
        const ariaLabel = await element.getAttribute('aria-label');
        const ariaLabelledBy = await element.getAttribute('aria-labelledby');
        
        if (ariaLabelledBy) {
          const referencedElement = await page.$(`#${ariaLabelledBy}`);
          if (!referencedElement) {
            issues.push(`aria-labelledby references non-existent element: ${ariaLabelledBy}`);
          }
        }
        
        if (ariaLabel && ariaLabel.trim().length === 0) {
          issues.push('Empty aria-label found');
        }
      }

    } catch (error) {
      issues.push(`Screen reader compatibility check failed: ${error}`);
    }

    return issues;
  }

  private async checkFocusManagement(page: any): Promise<any[]> {
    const issues: any[] = [];
    
    try {
      // Check modal focus management
      const modalTriggers = await page.$$('[data-toggle="modal"], [aria-haspopup="dialog"]');
      
      for (const trigger of modalTriggers) {
        await trigger.click();
        await page.waitForTimeout(500);
        
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        if (!focusedElement || focusedElement === 'BODY') {
          issues.push('Modal does not manage focus properly');
        }
        
        // Close modal
        await page.keyboard.press('Escape');
      }

      // Check form focus management
      const forms = await page.$$('form');
      for (const form of forms) {
        // Test form submission focus management
        const submitButton = await form.$('button[type="submit"], input[type="submit"]');
        if (submitButton) {
          await submitButton.focus();
          const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
          if (!focusedElement) {
            issues.push('Form submit button not focusable');
          }
        }
      }

    } catch (error) {
      issues.push(`Focus management check failed: ${error}`);
    }

    return issues;
  }
}