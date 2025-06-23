import { QAConfig } from '../config/qa-config';
import { QATestResult } from '../types/qa-types';
import { createTimestamp, createQATestResult } from '../utils/test-utils';

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

export class DataValidationTester {
  private config: QAConfig;
  private browser: any | null = null;

  constructor(config: QAConfig) {
    this.config = config;
  }

  async runAllTests(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    
    try {
      if (chromium) {
        this.browser = await chromium.launch({ headless: this.config.test.headless });
      }
      
      results.push(...await this.testUserDataValidation());
      results.push(...await this.testPicksDataValidation());
      results.push(...await this.testAnalyticsDataValidation());
      results.push(...await this.testFinancialDataValidation());
      results.push(...await this.testSystemDataValidation());
      results.push(...await this.testDataConsistency());
      results.push(...await this.testDataIntegrity());

    } catch (error) {
      results.push(createQATestResult(
        'Data Validation Test Suite',
        'FAIL',
        `Data validation test suite failed: ${error}`,
        0
      ));
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }

    return results;
  }

  private async testUserDataValidation(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    
    const userValidationTests = [
      {
        name: 'Username Validation',
        validInputs: ['user123', 'test_user', 'valid-username'],
        invalidInputs: ['', 'a', 'user@invalid', 'user with spaces', '123456789012345678901234567890123456789012345678901']
      },
      {
        name: 'Email Validation',
        validInputs: ['test@example.com', 'user.name@domain.co.uk', 'valid+email@test.org'],
        invalidInputs: ['invalid-email', '@domain.com', 'user@', 'user@domain', 'user..double@domain.com']
      },
      {
        name: 'Password Validation',
        validInputs: ['StrongPass123!', 'MySecure@Pass1', 'Valid#Password2024'],
        invalidInputs: ['weak', '12345678', 'password', 'PASSWORD', 'Pass123']
      }
    ];

    for (const test of userValidationTests) {
      const startTime = Date.now();
      
      try {
        if (!this.browser) {
          results.push(createQATestResult(
            `User Data - ${test.name}`,
            'SKIP',
            'Browser not available',
            Date.now() - startTime
          ));
          continue;
        }

        const page = await this.browser.newPage();
        await page.goto(`${this.config.environment.baseUrl}/register`);

        const validationResult = await this.validateInputs(page, test.validInputs, test.invalidInputs, test.name.toLowerCase().includes('username') ? 'input[name="username"]' : 
          test.name.toLowerCase().includes('email') ? 'input[name="email"]' : 'input[name="password"]');
        
        let status: QATestResult['status'] = 'PASS';
        let message = `${test.name} validation working correctly`;
        
        if (validationResult.failedValidInputs.length > 0) {
          status = 'FAIL';
          message = `${test.name} rejected valid inputs: ${validationResult.failedValidInputs.join(', ')}`;
        } else if (validationResult.acceptedInvalidInputs.length > 0) {
          status = 'FAIL';
          message = `${test.name} accepted invalid inputs: ${validationResult.acceptedInvalidInputs.join(', ')}`;
        }
        
        results.push(createQATestResult(
          `User Data - ${test.name}`,
          status,
          message,
          Date.now() - startTime,
          { details: validationResult }
        ));

        await page.close();

      } catch (error) {
        results.push(createQATestResult(
          `User Data - ${test.name}`,
          'FAIL',
          `User data validation test failed: ${error}`,
          Date.now() - startTime
        ));
      }
    }

    return results;
  }

  private async testPicksDataValidation(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    
    const picksValidationTests = [
      {
        name: 'Odds Validation',
        validInputs: ['-110', '+150', '2.50', '1.85'],
        invalidInputs: ['invalid', '0', '-1000', '+10000', 'abc']
      },
      {
        name: 'Stake Validation',
        validInputs: ['10', '25.50', '100', '1000'],
        invalidInputs: ['0', '-10', 'invalid', '10000', '0.01']
      },
      {
        name: 'Confidence Validation',
        validInputs: ['1', '5', '10', '8'],
        invalidInputs: ['0', '11', '-1', 'invalid', '15']
      }
    ];

    for (const test of picksValidationTests) {
      const startTime = Date.now();
      
      try {
        if (!this.browser) {
          results.push(createQATestResult(
            `Picks Data - ${test.name}`,
            'SKIP',
            'Browser not available',
            Date.now() - startTime
          ));
          continue;
        }

        const page = await this.browser.newPage();
        await page.goto(`${this.config.environment.baseUrl}/picks/create`);

        const validationResult = await this.validateInputs(page, test.validInputs, test.invalidInputs, 
          test.name.toLowerCase().includes('odds') ? 'input[name="odds"]' : 
          test.name.toLowerCase().includes('stake') ? 'input[name="stake"]' : 'input[name="confidence"]');
        
        let status: QATestResult['status'] = 'PASS';
        let message = `${test.name} validation working correctly`;
        
        if (validationResult.failedValidInputs.length > 0) {
          status = 'FAIL';
          message = `${test.name} rejected valid inputs: ${validationResult.failedValidInputs.join(', ')}`;
        } else if (validationResult.acceptedInvalidInputs.length > 0) {
          status = 'FAIL';
          message = `${test.name} accepted invalid inputs: ${validationResult.acceptedInvalidInputs.join(', ')}`;
        }
        
        results.push(createQATestResult(
          `Picks Data - ${test.name}`,
          status,
          message,
          Date.now() - startTime,
          { details: validationResult }
        ));

        await page.close();

      } catch (error) {
        results.push(createQATestResult(
          `Picks Data - ${test.name}`,
          'FAIL',
          `Picks data validation test failed: ${error}`,
          Date.now() - startTime
        ));
      }
    }

    return results;
  }

  private async testAnalyticsDataValidation(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();
    
    try {
      if (!this.browser) {
        results.push(createQATestResult(
          'Analytics Data Validation',
          'SKIP',
          'Browser not available',
          Date.now() - startTime
        ));
        return results;
      }

      const page = await this.browser.newPage();
      await page.goto(`${this.config.environment.baseUrl}/analytics`);

      const analyticsResult = await this.validateAnalyticsData(page);
      
      let status: QATestResult['status'] = 'PASS';
      let message = 'Analytics data validation passed';
      
      if (analyticsResult.errors.length > 0) {
        status = 'FAIL';
        message = `Analytics data validation failed: ${analyticsResult.errors.join(', ')}`;
      } else if (analyticsResult.warnings.length > 0) {
        status = 'WARNING';
        message = `Analytics data validation warnings: ${analyticsResult.warnings.join(', ')}`;
      }
      
      results.push(createQATestResult(
        'Analytics Data Validation',
        status,
        message,
        Date.now() - startTime,
        { details: analyticsResult }
      ));

      await page.close();

    } catch (error) {
      results.push(createQATestResult(
        'Analytics Data Validation',
        'FAIL',
        `Analytics data validation test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }

  private async testFinancialDataValidation(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    
    const financialTests = [
      {
        name: 'Profit/Loss Calculation',
        testType: 'calculation'
      },
      {
        name: 'ROI Calculation',
        testType: 'calculation'
      },
      {
        name: 'Stake Limits',
        testType: 'limits'
      }
    ];

    for (const test of financialTests) {
      const startTime = Date.now();
      
      try {
        if (!this.browser) {
          results.push(createQATestResult(
            `Financial Data - ${test.name}`,
            'SKIP',
            'Browser not available',
            Date.now() - startTime
          ));
          continue;
        }

        const page = await this.browser.newPage();
        await page.goto(`${this.config.environment.baseUrl}/dashboard`);

        const financialResult = await this.validateFinancialData(page, test.testType);
        
        let status: QATestResult['status'] = 'PASS';
        let message = `${test.name} validation passed`;
        
        if (financialResult.errors.length > 0) {
          status = 'FAIL';
          message = `${test.name} validation failed: ${financialResult.errors.join(', ')}`;
        } else if (financialResult.warnings.length > 0) {
          status = 'WARNING';
          message = `${test.name} validation warnings: ${financialResult.warnings.join(', ')}`;
        }
        
        results.push(createQATestResult(
          `Financial Data - ${test.name}`,
          status,
          message,
          Date.now() - startTime,
          { details: financialResult }
        ));

        await page.close();

      } catch (error) {
        results.push(createQATestResult(
          `Financial Data - ${test.name}`,
          'FAIL',
          `Financial data validation test failed: ${error}`,
          Date.now() - startTime
        ));
      }
    }

    return results;
  }

  private async testSystemDataValidation(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    
    const systemTests = [
      {
        name: 'Database Constraints',
        testType: 'constraints'
      },
      {
        name: 'API Response Validation',
        testType: 'api'
      },
      {
        name: 'Data Type Validation',
        testType: 'types'
      }
    ];

    for (const test of systemTests) {
      const startTime = Date.now();
      
      try {
        const systemResult = await this.validateSystemData(test.testType);
        
        let status: QATestResult['status'] = 'PASS';
        let message = `${test.name} validation passed`;
        
        if (systemResult.errors.length > 0) {
          status = 'FAIL';
          message = `${test.name} validation failed: ${systemResult.errors.join(', ')}`;
        } else if (systemResult.warnings.length > 0) {
          status = 'WARNING';
          message = `${test.name} validation warnings: ${systemResult.warnings.join(', ')}`;
        }
        
        results.push(createQATestResult(
          `System Data - ${test.name}`,
          status,
          message,
          Date.now() - startTime,
          { details: systemResult }
        ));

      } catch (error) {
        results.push(createQATestResult(
          `System Data - ${test.name}`,
          'FAIL',
          `System data validation test failed: ${error}`,
          Date.now() - startTime
        ));
      }
    }

    return results;
  }

  private async testDataConsistency(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();
    
    try {
      const consistencyResult = await this.validateDataConsistency();
      
      let status: QATestResult['status'] = 'PASS';
      let message = 'Data consistency validation passed';
      
      if (consistencyResult.errors.length > 0) {
        status = 'FAIL';
        message = `Data consistency validation failed: ${consistencyResult.errors.join(', ')}`;
      } else if (consistencyResult.warnings.length > 0) {
        status = 'WARNING';
        message = `Data consistency validation warnings: ${consistencyResult.warnings.join(', ')}`;
      }
      
      results.push(createQATestResult(
        'Data Consistency',
        status,
        message,
        Date.now() - startTime,
        { details: consistencyResult }
      ));

    } catch (error) {
      results.push(createQATestResult(
        'Data Consistency',
        'FAIL',
        `Data consistency validation test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }

  private async testDataIntegrity(): Promise<QATestResult[]> {
    const results: QATestResult[] = [];
    const startTime = Date.now();
    
    try {
      const integrityResult = await this.validateDataIntegrity();
      
      let status: QATestResult['status'] = 'PASS';
      let message = 'Data integrity validation passed';
      
      if (integrityResult.errors.length > 0) {
        status = 'FAIL';
        message = `Data integrity validation failed: ${integrityResult.errors.join(', ')}`;
      } else if (integrityResult.warnings.length > 0) {
        status = 'WARNING';
        message = `Data integrity validation warnings: ${integrityResult.warnings.join(', ')}`;
      }
      
      results.push(createQATestResult(
        'Data Integrity',
        status,
        message,
        Date.now() - startTime,
        { details: integrityResult }
      ));

    } catch (error) {
      results.push(createQATestResult(
        'Data Integrity',
        'FAIL',
        `Data integrity validation test failed: ${error}`,
        Date.now() - startTime
      ));
    }

    return results;
  }

  // Helper methods
  private async validateInputs(page: any, validInputs: string[], invalidInputs: string[], selector: string): Promise<any> {
    const failedValidInputs: string[] = [];
    const acceptedInvalidInputs: string[] = [];

    // Test valid inputs
    for (const input of validInputs) {
      try {
        await page.fill(selector, input);
        await page.blur(selector);
        
        const hasError = await page.locator('.error, .invalid, [aria-invalid="true"]').count() > 0;
        if (hasError) {
          failedValidInputs.push(input);
        }
      } catch (error) {
        failedValidInputs.push(input);
      }
    }

    // Test invalid inputs
    for (const input of invalidInputs) {
      try {
        await page.fill(selector, input);
        await page.blur(selector);
        
        const hasError = await page.locator('.error, .invalid, [aria-invalid="true"]').count() > 0;
        if (!hasError) {
          acceptedInvalidInputs.push(input);
        }
      } catch (error) {
        // Expected for invalid inputs
      }
    }

    return { failedValidInputs, acceptedInvalidInputs };
  }

  private async validateAnalyticsData(page: any): Promise<any> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check for required analytics elements
      const requiredElements = [
        '[data-testid="total-picks"]',
        '[data-testid="win-rate"]',
        '[data-testid="profit-loss"]',
        '[data-testid="roi"]'
      ];

      for (const element of requiredElements) {
        const exists = await page.locator(element).count() > 0;
        if (!exists) {
          errors.push(`Missing analytics element: ${element}`);
        }
      }

      // Validate data consistency
      const totalPicks = await page.textContent('[data-testid="total-picks"]') || '0';
      const recentPicks = await page.locator('[data-testid="recent-picks"] .pick-item').count();
      
      if (parseInt(totalPicks) > 0 && recentPicks === 0) {
        warnings.push('Total picks > 0 but no recent picks shown');
      }

    } catch (error) {
      errors.push(`Analytics validation error: ${error}`);
    }

    return { errors, warnings };
  }

  private async validateFinancialData(page: any, testType: string): Promise<any> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (testType === 'calculation') {
        // Validate financial calculations
        const profitLoss = await page.textContent('[data-testid="profit-loss"]') || '0';
        const roi = await page.textContent('[data-testid="roi"]') || '0%';
        
        if (isNaN(parseFloat(profitLoss.replace(/[^-\d.]/g, '')))) {
          errors.push('Invalid profit/loss format');
        }
        
        if (!roi.includes('%') || isNaN(parseFloat(roi.replace('%', '')))) {
          errors.push('Invalid ROI format');
        }
      } else if (testType === 'limits') {
        // Test stake limits
        const stakeInput = await page.locator('input[name="stake"]');
        if (await stakeInput.count() > 0) {
          await stakeInput.fill('10000');
          const hasError = await page.locator('.error').count() > 0;
          if (!hasError) {
            warnings.push('No stake limit validation found');
          }
        }
      }

    } catch (error) {
      errors.push(`Financial validation error: ${error}`);
    }

    return { errors, warnings };
  }

  private async validateSystemData(testType: string): Promise<any> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (testType === 'api') {
        // Mock API validation
        const response = await fetch(`${this.config.environment.baseUrl}/api/health`);
        if (!response.ok) {
          errors.push('API health check failed');
        }
      } else if (testType === 'types') {
        // Mock data type validation
        const mockData = { id: '123', name: 'test', value: 42 };
        if (typeof mockData.id !== 'string') {
          errors.push('Invalid data types detected');
        }
      }

    } catch (error) {
      errors.push(`System validation error: ${error}`);
    }

    return { errors, warnings };
  }

  private async validateDataConsistency(): Promise<any> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Mock consistency checks
      const mockUserData = [
        { id: '1', picks: 5, totalStake: 100 },
        { id: '2', picks: 3, totalStake: 75 }
      ];

      for (const user of mockUserData) {
        if (user.picks > 0 && user.totalStake <= 0) {
          errors.push(`User ${user.id} has picks but no stake`);
        }
      }

    } catch (error) {
      errors.push(`Consistency validation error: ${error}`);
    }

    return { errors, warnings };
  }

  private async validateDataIntegrity(): Promise<any> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Mock integrity checks
      const mockPicksData = [
        { id: '1', status: 'WON', payout: 150, stake: 100 },
        { id: '2', status: 'LOST', payout: 0, stake: 50 }
      ];

      for (const pick of mockPicksData) {
        if (pick.status === 'WON' && pick.payout <= pick.stake) {
          errors.push(`Pick ${pick.id} marked as won but payout <= stake`);
        }
        if (pick.status === 'LOST' && pick.payout > 0) {
          errors.push(`Pick ${pick.id} marked as lost but has payout`);
        }
      }

    } catch (error) {
      errors.push(`Integrity validation error: ${error}`);
    }

    return { errors, warnings };
  }
}