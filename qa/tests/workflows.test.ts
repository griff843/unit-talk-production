import { createTimestamp, createQATestResult } from '../utils/test-utils';
/**
 * Workflow Testing Module
 * Tests critical user journeys and business processes
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

export class WorkflowTester {
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

      // Core user workflows
      results.push(...await this.testUserRegistrationWorkflow());
      results.push(...await this.testUserOnboardingWorkflow());
      results.push(...await this.testPickSubmissionWorkflow());
      results.push(...await this.testParlayCreationWorkflow());
      results.push(...await this.testPaymentWorkflow());
      results.push(...await this.testAnalyticsWorkflow());
      
      // Discord integration workflows
      results.push(...await this.testDiscordPickSubmissionWorkflow());
      results.push(...await this.testDiscordBotInteractionWorkflow());
      
      // Admin workflows
      results.push(...await this.testAdminWorkflows());
      
      // Error handling workflows
      results.push(...await this.testErrorHandlingWorkflows());

    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }

    return results;
  }

  private async testUserRegistrationWorkflow(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const page = await this.browser!.newPage();
      
      // Test complete registration flow
      await page.goto(this.config.environment.baseUrl);
      
      // Step 1: Navigate to registration
      await page.click('[data-testid="register-button"]');
      await page.waitForSelector('[data-testid="registration-form"]');
      
      // Step 2: Fill registration form
      const testEmail = `qa-workflow-${Date.now()}@unittalk.com`;
      await page.fill('[data-testid="email-input"]', testEmail);
      await page.fill('[data-testid="password-input"]', 'TestPassword123!');
      await page.fill('[data-testid="confirm-password-input"]', 'TestPassword123!');
      await page.check('[data-testid="terms-checkbox"]');
      
      // Step 3: Submit registration
      await page.click('[data-testid="register-submit"]');
      
      // Step 4: Verify email verification flow
      await page.waitForSelector('[data-testid="email-verification-sent"]', { timeout: 10000 });
      
      // Step 5: Simulate email verification (in test environment)
      if (this.config.environment.name !== 'production') {
        await this.simulateEmailVerification(page, testEmail);
      }
      
      // Step 6: Verify successful login
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 15000 });
      
      results.push({
                testName: 'User Registration Workflow',
        status: 'PASS',
        message: 'Complete user registration workflow successful',
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

      await page.close();

    } catch (error) {
      results.push({
                testName: 'User Registration Workflow',
        status: 'FAIL',
        message: `Registration workflow failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testUserOnboardingWorkflow(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const page = await this.browser!.newPage();
      
      // Login as new user
      await this.loginAsTestUser(page);
      
      // Step 1: Welcome screen
      await page.waitForSelector('[data-testid="onboarding-welcome"]');
      await page.click('[data-testid="start-onboarding"]');
      
      // Step 2: Profile setup
      await page.waitForSelector('[data-testid="profile-setup"]');
      await page.fill('[data-testid="display-name"]', 'QA Test User');
      await page.selectOption('[data-testid="favorite-sport"]', 'NFL');
      await page.click('[data-testid="continue-profile"]');
      
      // Step 3: Preferences setup
      await page.waitForSelector('[data-testid="preferences-setup"]');
      await page.check('[data-testid="email-notifications"]');
      await page.check('[data-testid="discord-notifications"]');
      await page.click('[data-testid="continue-preferences"]');
      
      // Step 4: Tutorial walkthrough
      await page.waitForSelector('[data-testid="tutorial-start"]');
      await page.click('[data-testid="start-tutorial"]');
      
      // Navigate through tutorial steps
      for (let i = 1; i <= 5; i++) {
        await page.waitForSelector(`[data-testid="tutorial-step-${i}"]`);
        await page.click('[data-testid="tutorial-next"]');
      }
      
      // Step 5: Complete onboarding
      await page.waitForSelector('[data-testid="onboarding-complete"]');
      await page.click('[data-testid="finish-onboarding"]');
      
      // Verify dashboard access
      await page.waitForSelector('[data-testid="dashboard"]');
      
      results.push({
                testName: 'User Onboarding Workflow',
        status: 'PASS',
        message: 'Complete user onboarding workflow successful',
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

      await page.close();

    } catch (error) {
      results.push({
                testName: 'User Onboarding Workflow',
        status: 'FAIL',
        message: `Onboarding workflow failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testPickSubmissionWorkflow(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const page = await this.browser!.newPage();
      
      // Login as test user
      await this.loginAsTestUser(page);
      
      // Navigate to picks page
      await page.goto(`${this.config.environment.baseUrl}/picks`);
      
      // Step 1: Create new pick
      await page.click('[data-testid="create-pick-button"]');
      await page.waitForSelector('[data-testid="pick-form"]');
      
      // Step 2: Fill pick details
      await page.selectOption('[data-testid="pick-sport"]', 'NFL');
      await page.selectOption('[data-testid="pick-league"]', 'NFL');
      await page.fill('[data-testid="pick-game"]', 'Chiefs vs Bills');
      await page.selectOption('[data-testid="pick-bet-type"]', 'Moneyline');
      await page.fill('[data-testid="pick-selection"]', 'Kansas City Chiefs');
      await page.fill('[data-testid="pick-odds"]', '-150');
      await page.fill('[data-testid="pick-stake"]', '25');
      await page.fill('[data-testid="pick-confidence"]', '8');
      await page.fill('[data-testid="pick-reasoning"]', 'Chiefs have strong home field advantage');
      
      // Step 3: Submit pick
      await page.click('[data-testid="submit-pick"]');
      
      // Step 4: Verify pick submission
      await page.waitForSelector('[data-testid="pick-submitted-success"]');
      
      // Step 5: Verify pick appears in picks list
      await page.goto(`${this.config.environment.baseUrl}/picks`);
      await page.waitForSelector('[data-testid="picks-list"]');
      
      const pickExists = await page.isVisible('[data-testid="pick-item"]:has-text("Chiefs vs Bills")');
      
      if (!pickExists) {
        throw new Error('Submitted pick not found in picks list');
      }
      
      results.push({
                testName: 'Pick Submission Workflow',
        status: 'PASS',
        message: 'Complete pick submission workflow successful',
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

      await page.close();

    } catch (error) {
      results.push({
                testName: 'Pick Submission Workflow',
        status: 'FAIL',
        message: `Pick submission workflow failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testParlayCreationWorkflow(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const page = await this.browser!.newPage();
      
      // Login as test user
      await this.loginAsTestUser(page);
      
      // Navigate to parlays page
      await page.goto(`${this.config.environment.baseUrl}/parlays`);
      
      // Step 1: Create new parlay
      await page.click('[data-testid="create-parlay-button"]');
      await page.waitForSelector('[data-testid="parlay-form"]');
      
      // Step 2: Add picks to parlay
      await page.fill('[data-testid="parlay-name"]', 'QA Test Parlay');
      
      // Add first pick
      await page.click('[data-testid="add-pick-to-parlay"]');
      await page.selectOption('[data-testid="parlay-pick-1-sport"]', 'NFL');
      await page.fill('[data-testid="parlay-pick-1-selection"]', 'Chiefs ML');
      await page.fill('[data-testid="parlay-pick-1-odds"]', '-150');
      
      // Add second pick
      await page.click('[data-testid="add-another-pick"]');
      await page.selectOption('[data-testid="parlay-pick-2-sport"]', 'NBA');
      await page.fill('[data-testid="parlay-pick-2-selection"]', 'Lakers ML');
      await page.fill('[data-testid="parlay-pick-2-odds"]', '+120');
      
      // Step 3: Set parlay stake
      await page.fill('[data-testid="parlay-stake"]', '50');
      
      // Step 4: Submit parlay
      await page.click('[data-testid="submit-parlay"]');
      
      // Step 5: Verify parlay submission
      await page.waitForSelector('[data-testid="parlay-submitted-success"]');
      
      // Step 6: Verify parlay appears in parlays list
      await page.goto(`${this.config.environment.baseUrl}/parlays`);
      await page.waitForSelector('[data-testid="parlays-list"]');
      
      const parlayExists = await page.isVisible('[data-testid="parlay-item"]:has-text("QA Test Parlay")');
      
      if (!parlayExists) {
        throw new Error('Submitted parlay not found in parlays list');
      }
      
      results.push({
                testName: 'Parlay Creation Workflow',
        status: 'PASS',
        message: 'Complete parlay creation workflow successful',
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

      await page.close();

    } catch (error) {
      results.push({
                testName: 'Parlay Creation Workflow',
        status: 'FAIL',
        message: `Parlay creation workflow failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testPaymentWorkflow(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const page = await this.browser!.newPage();
      
      // Login as test user
      await this.loginAsTestUser(page);
      
      // Navigate to subscription page
      await page.goto(`${this.config.environment.baseUrl}/subscription`);
      
      // Step 1: Select VIP plan
      await page.click('[data-testid="select-vip-plan"]');
      await page.waitForSelector('[data-testid="payment-form"]');
      
      // Step 2: Fill payment details (test mode)
      if (this.config.environment.name !== 'production') {
        await page.fill('[data-testid="card-number"]', '4242424242424242');
        await page.fill('[data-testid="card-expiry"]', '12/25');
        await page.fill('[data-testid="card-cvc"]', '123');
        await page.fill('[data-testid="card-name"]', 'QA Test User');
        
        // Step 3: Submit payment
        await page.click('[data-testid="submit-payment"]');
        
        // Step 4: Verify payment success
        await page.waitForSelector('[data-testid="payment-success"]', { timeout: 15000 });
        
        // Step 5: Verify tier upgrade
        await page.goto(`${this.config.environment.baseUrl}/profile`);
        const tierElement = await page.textContent('[data-testid="user-tier"]');
        
        if (!tierElement?.includes('VIP')) {
          throw new Error('User tier not upgraded after payment');
        }
      }
      
      results.push({
                testName: 'Payment Workflow',
        status: this.config.environment.name === 'production' ? 'SKIP' : 'PASS',
        message: this.config.environment.name === 'production' 
          ? 'Payment workflow skipped in production' 
          : 'Complete payment workflow successful',
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

      await page.close();

    } catch (error) {
      results.push({
                testName: 'Payment Workflow',
        status: 'FAIL',
        message: `Payment workflow failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testAnalyticsWorkflow(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const page = await this.browser!.newPage();
      
      // Login as test user
      await this.loginAsTestUser(page);
      
      // Navigate to analytics page
      await page.goto(`${this.config.environment.baseUrl}/analytics`);
      
      // Step 1: Verify analytics dashboard loads
      await page.waitForSelector('[data-testid="analytics-dashboard"]');
      
      // Step 2: Test date range selection
      await page.click('[data-testid="date-range-selector"]');
      await page.click('[data-testid="last-30-days"]');
      await page.waitForSelector('[data-testid="analytics-loading"]', { state: 'hidden' });
      
      // Step 3: Test sport filter
      await page.selectOption('[data-testid="sport-filter"]', 'NFL');
      await page.waitForSelector('[data-testid="analytics-loading"]', { state: 'hidden' });
      
      // Step 4: Verify charts and data
      const chartExists = await page.isVisible('[data-testid="performance-chart"]');
      const statsExist = await page.isVisible('[data-testid="performance-stats"]');
      
      if (!chartExists || !statsExist) {
        throw new Error('Analytics charts or stats not displayed');
      }
      
      // Step 5: Test data export
      await page.click('[data-testid="export-data"]');
      await page.waitForSelector('[data-testid="export-success"]');
      
      results.push({
                testName: 'Analytics Workflow',
        status: 'PASS',
        message: 'Complete analytics workflow successful',
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

      await page.close();

    } catch (error) {
      results.push({
                testName: 'Analytics Workflow',
        status: 'FAIL',
        message: `Analytics workflow failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testDiscordPickSubmissionWorkflow(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      // Note: This would require Discord bot testing setup
      // For now, we'll test the Discord integration UI
      
      const page = await this.browser!.newPage();
      
      // Login as test user
      await this.loginAsTestUser(page);
      
      // Navigate to Discord integration page
      await page.goto(`${this.config.environment.baseUrl}/discord`);
      
      // Step 1: Verify Discord connection status
      await page.waitForSelector('[data-testid="discord-status"]');
      
      // Step 2: Test Discord pick submission format
      await page.click('[data-testid="test-discord-format"]');
      await page.waitForSelector('[data-testid="discord-format-preview"]');
      
      // Step 3: Verify pick formatting
      const formatPreview = await page.textContent('[data-testid="discord-format-preview"]');
      
      if (!formatPreview?.includes('🏈') || !formatPreview?.includes('Confidence:')) {
        throw new Error('Discord pick format incorrect');
      }
      
      results.push({
                testName: 'Discord Pick Submission Workflow',
        status: 'PASS',
        message: 'Discord integration workflow successful',
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

      await page.close();

    } catch (error) {
      results.push({
                testName: 'Discord Pick Submission Workflow',
        status: 'FAIL',
        message: `Discord workflow failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testDiscordBotInteractionWorkflow(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    
    // This would require actual Discord bot testing
    // For now, return a placeholder result
    results.push({
            testName: 'Discord Bot Interaction Workflow',
      status: 'SKIP',
      message: 'Discord bot testing requires separate test environment',
      duration: 0,
      timestamp: createTimestamp()
    });

    return results;
  }

  private async testAdminWorkflows(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const page = await this.browser!.newPage();
      
      // Login as admin user
      await this.loginAsAdminUser(page);
      
      // Navigate to admin panel
      await page.goto(`${this.config.environment.baseUrl}/admin`);
      
      // Step 1: Verify admin access
      await page.waitForSelector('[data-testid="admin-dashboard"]');
      
      // Step 2: Test user management
      await page.click('[data-testid="user-management"]');
      await page.waitForSelector('[data-testid="users-list"]');
      
      // Step 3: Test pick moderation
      await page.click('[data-testid="pick-moderation"]');
      await page.waitForSelector('[data-testid="pending-picks"]');
      
      // Step 4: Test analytics overview
      await page.click('[data-testid="admin-analytics"]');
      await page.waitForSelector('[data-testid="platform-metrics"]');
      
      results.push({
                testName: 'Admin Workflows',
        status: 'PASS',
        message: 'Admin workflow tests successful',
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

      await page.close();

    } catch (error) {
      results.push({
                testName: 'Admin Workflows',
        status: 'FAIL',
        message: `Admin workflow failed: ${error}`,
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });
    }

    return results;
  }

  private async testErrorHandlingWorkflows(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();

    try {
      const page = await this.browser!.newPage();
      
      // Test 1: Invalid login
      await page.goto(`${this.config.environment.baseUrl}/login`);
      await page.fill('[data-testid="email-input"]', 'invalid@email.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-submit"]');
      
      const errorMessage = await page.isVisible('[data-testid="login-error"]');
      if (!errorMessage) {
        throw new Error('Login error not displayed for invalid credentials');
      }
      
      // Test 2: Network error handling
      await page.route('**/api/**', (route: { abort: () => void }) => route.abort());
      await page.goto(`${this.config.environment.baseUrl}/picks`);
      
      const networkError = await page.isVisible('[data-testid="network-error"]');
      if (!networkError) {
        throw new Error('Network error not handled properly');
      }
      
      results.push({
                testName: 'Error Handling Workflows',
        status: 'PASS',
        message: 'Error handling workflows successful',
        duration: Date.now() - startTime,
        timestamp: createTimestamp()
      });

      await page.close();

    } catch (error) {
      results.push({
                testName: 'Error Handling Workflows',
        status: 'FAIL',
        message: `Error handling workflow failed: ${error}`,
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
    await page.fill('[data-testid="password-input"]', this.config.environment.credentials?.testUser?.password || 'password');
    await page.click('[data-testid="login-submit"]');
    await page.waitForSelector('[data-testid="dashboard"]');
  }

  private async loginAsAdminUser(page: any): Promise<void> {
    await page.goto(`${this.config.environment.baseUrl}/login`);
    await page.fill('[data-testid="email-input"]', this.config.environment.credentials?.adminUser?.email || 'admin@example.com');
    await page.fill('[data-testid="password-input"]', this.config.environment.credentials?.adminUser?.password || 'admin123');
    await page.click('[data-testid="login-submit"]');
    await page.waitForSelector('[data-testid="dashboard"]');
  }

  private async simulateEmailVerification(page: any, email: string): Promise<void> {
    // In test environment, simulate email verification
    if (this.config.environment.name !== 'production') {
      await page.goto(`${this.config.environment.baseUrl}/verify-email?token=test-token&email=${encodeURIComponent(email)}`);
      await page.waitForSelector('[data-testid="email-verified"]');
    }
  }
}
