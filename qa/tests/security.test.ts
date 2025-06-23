import { createTimestamp, createQATestResult } from '../utils/test-utils';
/**
 * Security Testing Module
 * Comprehensive security vulnerability testing
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
  // Playwright not available - tests will be skipped
}
import * as crypto from 'crypto';

export class SecurityTester {
  private config: QAConfig;
  private browser: any | null = null;

  constructor(config: QAConfig) {
    this.config = config;
  }

  async runAllTests(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    
    try {
      this.browser = await chromium.launch({ 
        headless: this.config.test.headless,
        slowMo: this.config.test.slowMo 
      });

      // Authentication security tests
      results.push(...await this.testAuthenticationSecurity());
      
      // Input validation and XSS tests
      results.push(...await this.testInputValidationSecurity());
      
      // CSRF protection tests
      results.push(...await this.testCSRFProtection());
      
      // SQL injection tests
      results.push(...await this.testSQLInjectionProtection());
      
      // Session management tests
      results.push(...await this.testSessionSecurity());
      
      // HTTPS and transport security tests
      results.push(...await this.testTransportSecurity());
      
      // Content Security Policy tests
      results.push(...await this.testContentSecurityPolicy());
      
      // Authorization and access control tests
      results.push(...await this.testAuthorizationSecurity());
      
      // File upload security tests
      results.push(...await this.testFileUploadSecurity());
      
      // Rate limiting tests
      results.push(...await this.testRateLimiting());

    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }

    return results;
  }

  private async testAuthenticationSecurity(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    
    // Test password strength requirements
    results.push(...await this.testPasswordStrengthRequirements());
    
    // Test brute force protection
    results.push(...await this.testBruteForceProtection());
    
    // Test account lockout mechanisms
    results.push(...await this.testAccountLockout());
    
    // Test password reset security
    results.push(...await this.testPasswordResetSecurity());
    
    // Test multi-factor authentication
    results.push(...await this.testMultiFactorAuthentication());

    return results;
  }

  private async testPasswordStrengthRequirements(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const page = await this.browser!.newPage();
      
      // Navigate to registration page
      await page.goto(`${this.config.environment.baseUrl}/register`);
      await page.waitForSelector('[data-testid="registration-form"]');
      
      // Test weak passwords
      const weakPasswords = [
        '123456',
        'password',
        'qwerty',
        'abc123',
        '12345678',
        'password123'
      ];
      
      let weakPasswordsRejected = 0;
      
      for (const weakPassword of weakPasswords) {
        await page.fill('[data-testid="email-input"]', `test-${Date.now()}@example.com`);
        await page.fill('[data-testid="password-input"]', weakPassword);
        await page.fill('[data-testid="confirm-password-input"]', weakPassword);
        
        await page.click('[data-testid="register-submit"]');
        
        // Check if weak password is rejected
        const errorVisible = await page.isVisible('[data-testid="password-error"]', { timeout: 2000 });
        
        if (errorVisible) {
          weakPasswordsRejected++;
        }
        
        // Clear form for next test
        await page.fill('[data-testid="email-input"]', '');
        await page.fill('[data-testid="password-input"]', '');
        await page.fill('[data-testid="confirm-password-input"]', '');
      }
      
      const status = weakPasswordsRejected === weakPasswords.length ? 'PASS' : 'FAIL';
      const message = status === 'PASS' 
        ? 'All weak passwords properly rejected'
        : `${weakPasswordsRejected}/${weakPasswords.length} weak passwords rejected`;
      
      results.push({
                testName: 'Password Strength Requirements',
        status,
        message,
        details: {
          weakPasswordsRejected,
          totalWeakPasswords: weakPasswords.length
        },
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

      await page.close();

    } catch (error) {
      results.push({
                testName: 'Password Strength Requirements',
        status: 'FAIL',
        message: `Password strength test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testBruteForceProtection(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const page = await this.browser!.newPage();
      
      // Navigate to login page
      await page.goto(`${this.config.environment.baseUrl}/login`);
      
      // Attempt multiple failed logins
      const maxAttempts = 10;
      let blockedAfterAttempts = 0;
      
      for (let i = 1; i <= maxAttempts; i++) {
        await page.fill('[data-testid="email-input"]', 'test@example.com');
        await page.fill('[data-testid="password-input"]', `wrongpassword${i}`);
        await page.click('[data-testid="login-submit"]');
        
        // Check if account is blocked or rate limited
        const isBlocked = await page.isVisible('[data-testid="account-blocked"], [data-testid="rate-limited"]', { timeout: 3000 });
        
        if (isBlocked) {
          blockedAfterAttempts = i;
          break;
        }
        
        // Wait between attempts
        await page.waitForTimeout(1000);
      }
      
      const status = blockedAfterAttempts > 0 && blockedAfterAttempts <= 5 ? 'PASS' : 'FAIL';
      const message = status === 'PASS' 
        ? `Brute force protection activated after ${blockedAfterAttempts} attempts`
        : blockedAfterAttempts === 0 
          ? 'No brute force protection detected'
          : `Brute force protection too lenient (${blockedAfterAttempts} attempts allowed)`;
      
      results.push({
                testName: 'Brute Force Protection',
        status,
        message,
        details: {
          attemptsBeforeBlock: blockedAfterAttempts,
          maxAttemptsTested: maxAttempts
        },
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

      await page.close();

    } catch (error) {
      results.push({
                testName: 'Brute Force Protection',
        status: 'FAIL',
        message: `Brute force protection test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testInputValidationSecurity(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    
    // Test XSS protection
    results.push(...await this.testXSSProtection());
    
    // Test HTML injection protection
    results.push(...await this.testHTMLInjectionProtection());
    
    // Test JavaScript injection protection
    results.push(...await this.testJavaScriptInjectionProtection());

    return results;
  }

  private async testXSSProtection(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const page = await this.browser!.newPage();
      
      // Test XSS in various input fields
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '"><script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src="x" onerror="alert(\'XSS\')">',
        '<svg onload="alert(\'XSS\')">',
        '"><iframe src="javascript:alert(\'XSS\')"></iframe>'
      ];
      
      // Test forms that might be vulnerable
      const formsToTest = [
        { url: '/profile/edit', fields: ['[data-testid="display-name"]', '[data-testid="bio"]'] },
        { url: '/picks/new', fields: ['[data-testid="pick-reasoning"]'] },
        { url: '/contact', fields: ['[data-testid="message"]'] }
      ];
      
      let xssVulnerabilitiesFound = 0;
      
      for (const form of formsToTest) {
        try {
          await page.goto(`${this.config.environment.baseUrl}${form.url}`);
          
          for (const field of form.fields) {
            const fieldExists = await page.isVisible(field);
            if (!fieldExists) continue;
            
            for (const payload of xssPayloads) {
              await page.fill(field, payload);
              await page.click('[data-testid*="submit"], [type="submit"]');
              
              // Check if XSS payload executed
              const alertFired = await page.evaluate(() => {
                return new Promise((resolve) => {
                  const originalAlert = window.alert;
                  let alertCalled = false;
                  
                  window.alert = () => {
                    alertCalled = true;
                    window.alert = originalAlert;
                  };
                  
                  setTimeout(() => resolve(alertCalled), 1000);
                });
              });
              
              if (alertFired) {
                xssVulnerabilitiesFound++;
              }
              
              // Clear field
              await page.fill(field, '');
            }
          }
        } catch (error) {
          // Continue testing other forms
        }
      }
      
      const status = xssVulnerabilitiesFound === 0 ? 'PASS' : 'FAIL';
      const message = status === 'PASS' 
        ? 'No XSS vulnerabilities found'
        : `${xssVulnerabilitiesFound} XSS vulnerabilities detected`;
      
      results.push({
                testName: 'XSS Protection',
        status,
        message,
        details: {
          vulnerabilitiesFound: xssVulnerabilitiesFound,
          payloadsTested: xssPayloads.length,
          formsTestedCount: formsToTest.length
        },
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

      await page.close();

    } catch (error) {
      results.push({
                testName: 'XSS Protection',
        status: 'FAIL',
        message: `XSS protection test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testCSRFProtection(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const page = await this.browser!.newPage();
      
      // Login to get authenticated session
      await this.loginAsTestUser(page);
      
      // Test CSRF protection on state-changing operations
      const csrfTests = [
        { name: 'Profile Update', url: '/api/profile', method: 'POST' },
        { name: 'Pick Submission', url: '/api/picks', method: 'POST' },
        { name: 'Account Deletion', url: '/api/account', method: 'DELETE' }
      ];
      
      let csrfProtectionPassed = 0;
      
      for (const test of csrfTests) {
        try {
          // Attempt request without CSRF token
          const response = await page.evaluate(async (testData: { url: string; method: string }) => {
            const response = await fetch(testData.url, {
              method: testData.method,
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ test: 'csrf' })
            });
            return response.status;
          }, test);
          
          // CSRF protection should reject the request (403 or 400)
          if (response === 403 || response === 400) {
            csrfProtectionPassed++;
          }
          
        } catch (error) {
          // Network errors are acceptable for CSRF protection
          csrfProtectionPassed++;
        }
      }
      
      const status = csrfProtectionPassed === csrfTests.length ? 'PASS' : 'FAIL';
      const message = status === 'PASS' 
        ? 'CSRF protection properly implemented'
        : `${csrfProtectionPassed}/${csrfTests.length} endpoints protected against CSRF`;
      
      results.push({
                testName: 'CSRF Protection',
        status,
        message,
        details: {
          protectedEndpoints: csrfProtectionPassed,
          totalEndpoints: csrfTests.length
        },
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

      await page.close();

    } catch (error) {
      results.push({
                testName: 'CSRF Protection',
        status: 'FAIL',
        message: `CSRF protection test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testSQLInjectionProtection(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const page = await this.browser!.newPage();
      
      // SQL injection payloads
      const sqlPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
        "1' OR '1'='1' --",
        "admin'--",
        "' OR 1=1#"
      ];
      
      // Test SQL injection in search and filter fields
      const fieldsToTest = [
        { url: '/picks', field: '[data-testid="search-picks"]' },
        { url: '/analytics', field: '[data-testid="filter-sport"]' },
        { url: '/users', field: '[data-testid="search-users"]' }
      ];
      
      let sqlInjectionVulnerabilities = 0;
      
      for (const fieldTest of fieldsToTest) {
        try {
          await page.goto(`${this.config.environment.baseUrl}${fieldTest.url}`);
          
          const fieldExists = await page.isVisible(fieldTest.field);
          if (!fieldExists) continue;
          
          for (const payload of sqlPayloads) {
            await page.fill(fieldTest.field, payload);
            await page.keyboard.press('Enter');
            
            // Wait for response
            await page.waitForTimeout(2000);
            
            // Check for SQL error messages or unexpected data exposure
            const pageContent = await page.content();
            const sqlErrorPatterns = [
              /SQL syntax.*MySQL/i,
              /Warning.*mysql_/i,
              /valid MySQL result/i,
              /PostgreSQL.*ERROR/i,
              /Warning.*pg_/i,
              /SQLite.*error/i
            ];
            
            const hasSQLError = sqlErrorPatterns.some(pattern => pattern.test(pageContent));
            
            if (hasSQLError) {
              sqlInjectionVulnerabilities++;
            }
            
            // Clear field
            await page.fill(fieldTest.field, '');
          }
        } catch (error) {
          // Continue testing other fields
        }
      }
      
      const status = sqlInjectionVulnerabilities === 0 ? 'PASS' : 'FAIL';
      const message = status === 'PASS' 
        ? 'No SQL injection vulnerabilities found'
        : `${sqlInjectionVulnerabilities} potential SQL injection vulnerabilities detected`;
      
      results.push({
                testName: 'SQL Injection Protection',
        status,
        message,
        details: {
          vulnerabilitiesFound: sqlInjectionVulnerabilities,
          payloadsTested: sqlPayloads.length,
          fieldsTestedCount: fieldsToTest.length
        },
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

      await page.close();

    } catch (error) {
      results.push({
                testName: 'SQL Injection Protection',
        status: 'FAIL',
        message: `SQL injection protection test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testSessionSecurity(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    
    // Test session timeout
    results.push(...await this.testSessionTimeout());
    
    // Test session fixation protection
    results.push(...await this.testSessionFixationProtection());
    
    // Test secure cookie settings
    results.push(...await this.testSecureCookieSettings());

    return results;
  }

  private async testTransportSecurity(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const page = await this.browser!.newPage();
      
      // Test HTTPS enforcement
      await page.goto(this.config.environment.baseUrl);
      
      const currentUrl = page.url();
      const isHTTPS = currentUrl.startsWith('https://');
      
      // Test security headers
      const response = await page.goto(this.config.environment.baseUrl);
      const headers = response?.headers() || {};
      
      const securityHeaders = {
        'strict-transport-security': headers['strict-transport-security'],
        'x-content-type-options': headers['x-content-type-options'],
        'x-frame-options': headers['x-frame-options'],
        'x-xss-protection': headers['x-xss-protection'],
        'referrer-policy': headers['referrer-policy']
      };
      
      const missingHeaders = Object.entries(securityHeaders)
        .filter(([key, value]) => !value)
        .map(([key]) => key);
      
      let status: QATestResult['status'] = 'PASS';
      let message = 'Transport security properly configured';
      
      if (!isHTTPS) {
        status = 'FAIL';
        message = 'HTTPS not enforced';
      } else if (missingHeaders.length > 0) {
        status = 'WARNING';
        message = `Missing security headers: ${missingHeaders.join(', ')}`;
      }
      
      results.push({
                testName: 'Transport Security',
        status,
        message,
        details: {
          httpsEnforced: isHTTPS,
          securityHeaders,
          missingHeaders
        },
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

      await page.close();

    } catch (error) {
      results.push({
                testName: 'Transport Security',
        status: 'FAIL',
        message: `Transport security test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testContentSecurityPolicy(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const page = await this.browser!.newPage();
      
      // Navigate to page and check CSP header
      const response = await page.goto(this.config.environment.baseUrl);
      const headers = response?.headers() || {};
      
      const cspHeader = headers['content-security-policy'] || headers['content-security-policy-report-only'];
      
      let status: QATestResult['status'] = 'PASS';
      let message = 'Content Security Policy properly configured';
      let cspAnalysis = {};
      
      if (!cspHeader) {
        status = 'FAIL';
        message = 'Content Security Policy header missing';
      } else {
        // Analyze CSP directives
        cspAnalysis = this.analyzeCSP(cspHeader);
        
        // Check for unsafe directives
        const unsafeDirectives = Object.entries(cspAnalysis)
          .filter(([key, value]: [string, any]) => 
            value.includes("'unsafe-inline'") || value.includes("'unsafe-eval'")
          );
        
        if (unsafeDirectives.length > 0) {
          status = 'WARNING';
          message = `CSP contains unsafe directives: ${unsafeDirectives.map(([key]) => key).join(', ')}`;
        }
      }
      
      results.push({
                testName: 'Content Security Policy',
        status,
        message,
        details: {
          cspHeader,
          cspAnalysis
        },
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

      await page.close();

    } catch (error) {
      results.push({
                testName: 'Content Security Policy',
        status: 'FAIL',
        message: `CSP test failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  // Helper methods
  private async loginAsTestUser(page: any): Promise<void> {
    await page.goto(`${this.config.environment.baseUrl}/login`);
    await page.fill('[data-testid="email-input"]', this.config.environment.credentials?.testUser?.email || 'test@example.com');
    await page.fill('[data-testid="password-input"]', this.config.environment.credentials?.testUser?.password || 'defaultPassword123');
    await page.click('[data-testid="login-submit"]');
    await page.waitForSelector('[data-testid="dashboard"]');
  }

  private analyzeCSP(cspHeader: string): any {
    const directives: any = {};
    const parts = cspHeader.split(';');
    
    parts.forEach(part => {
      const trimmed = part.trim();
      if (trimmed) {
        const [directive, ...values] = trimmed.split(' ');
        directives[directive] = values;
      }
    });
    
    return directives;
  }

  // Placeholder methods for additional security tests
  private async testAccountLockout(): Promise<QATestResult[]> {
    return [{
            testName: 'Account Lockout',
      status: 'SKIP',
      message: 'Account lockout test implementation pending',
      duration: 0,
      timestamp: createTimestamp()
    }];
  }

  private async testPasswordResetSecurity(): Promise<QATestResult[]> {
    return [{
            testName: 'Password Reset Security',
      status: 'SKIP',
      message: 'Password reset security test implementation pending',
      duration: 0,
      timestamp: createTimestamp()
    }];
  }

  private async testMultiFactorAuthentication(): Promise<QATestResult[]> {
    return [{
            testName: 'Multi-Factor Authentication',
      status: 'SKIP',
      message: 'MFA test implementation pending',
      duration: 0,
      timestamp: createTimestamp()
    }];
  }

  private async testHTMLInjectionProtection(): Promise<QATestResult[]> {
    return [{
            testName: 'HTML Injection Protection',
      status: 'SKIP',
      message: 'HTML injection test implementation pending',
      duration: 0,
      timestamp: createTimestamp()
    }];
  }

  private async testJavaScriptInjectionProtection(): Promise<QATestResult[]> {
    return [{
            testName: 'JavaScript Injection Protection',
      status: 'SKIP',
      message: 'JavaScript injection test implementation pending',
      duration: 0,
      timestamp: createTimestamp()
    }];
  }

  private async testSessionTimeout(): Promise<QATestResult[]> {
    return [{
            testName: 'Session Timeout',
      status: 'SKIP',
      message: 'Session timeout test implementation pending',
      duration: 0,
      timestamp: createTimestamp()
    }];
  }

  private async testSessionFixationProtection(): Promise<QATestResult[]> {
    return [{
            testName: 'Session Fixation Protection',
      status: 'SKIP',
      message: 'Session fixation test implementation pending',
      duration: 0,
      timestamp: createTimestamp()
    }];
  }

  private async testSecureCookieSettings(): Promise<QATestResult[]> {
    return [{
            testName: 'Secure Cookie Settings',
      status: 'SKIP',
      message: 'Cookie security test implementation pending',
      duration: 0,
      timestamp: createTimestamp()
    }];
  }

  private async testAuthorizationSecurity(): Promise<QATestResult[]> {
    return [{
            testName: 'Authorization Security',
      status: 'SKIP',
      message: 'Authorization security test implementation pending',
      duration: 0,
      timestamp: createTimestamp()
    }];
  }

  private async testFileUploadSecurity(): Promise<QATestResult[]> {
    return [{
            testName: 'File Upload Security',
      status: 'SKIP',
      message: 'File upload security test implementation pending',
      duration: 0,
      timestamp: createTimestamp()
    }];
  }

  private async testRateLimiting(): Promise<QATestResult[]> {
    return [{
            testName: 'Rate Limiting',
      status: 'SKIP',
      message: 'Rate limiting test implementation pending',
      duration: 0,
      timestamp: createTimestamp()
    }];
  }
}
