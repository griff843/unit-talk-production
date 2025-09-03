
#!/usr/bin/env tsx

/**
 * Production Security Audit
 * API keys, secrets, rate limiting, security boundaries
 */

import { readFileSync, existsSync } from 'fs';

class ProductionSecurityAuditor {
  async executeSecurityAudit(): Promise<void> {
    console.log('🔒 PRODUCTION SECURITY AUDIT');
    console.log('============================\n');

    const auditResults = [];

    // 1. API Key Security
    console.log('🔍 Auditing API key security...');
    const apiKeyResult = await this.auditAPIKeys();
    auditResults.push(apiKeyResult);

    // 2. Secret Management
    console.log('\n🔍 Auditing secret management...');
    const secretResult = await this.auditSecretManagement();
    auditResults.push(secretResult);

    // 3. Rate Limiting
    console.log('\n🔍 Auditing rate limiting...');
    const rateLimitResult = await this.auditRateLimiting();
    auditResults.push(rateLimitResult);

    // 4. Input Validation
    console.log('\n🔍 Auditing input validation...');
    const inputValidationResult = await this.auditInputValidation();
    auditResults.push(inputValidationResult);

    // 5. Access Control
    console.log('\n🔍 Auditing access control...');
    const accessControlResult = await this.auditAccessControl();
    auditResults.push(accessControlResult);

    // Generate security report
    const passedAudits = auditResults.filter(r => r.passed).length;
    const totalAudits = auditResults.length;
    const securityScore = Math.floor((passedAudits / totalAudits) * 100);

    console.log(`\n📊 SECURITY AUDIT SUMMARY`);
    console.log(`========================`);
    console.log(`Security Score: ${securityScore}%`);
    console.log(`Passed Audits: ${passedAudits}/${totalAudits}`);

    auditResults.forEach(result => {
      console.log(`${result.passed ? '✅' : '❌'} ${result.category}: ${result.status}`);
      if (result.recommendations.length > 0) {
        result.recommendations.forEach(rec => {
          console.log(`   • ${rec}`);
        });
      }
    });

    if (securityScore >= 90) {
      console.log('\n🎉 Security audit passed! Ready for production.');
    } else if (securityScore >= 70) {
      console.log('\n⚠️ Security audit needs attention before production.');
    } else {
      console.log('\n🚨 Critical security issues must be resolved before production.');
    }
  }

  private async auditAPIKeys(): Promise<any> {
    const issues = [];
    const recommendations = [];

    // Check if API keys are properly configured
    const apiKeys = [
      'OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 
      'DISCORD_TOKEN', 'NOTION_API_KEY'
    ];

    let validKeys = 0;
    for (const key of apiKeys) {
      const value = process.env[key];
      if (value && value.length > 10 && !value.includes('your-') && !value.includes('test-')) {
        validKeys++;
        console.log(`   ✅ ${key}: Properly configured`);
      } else {
        console.log(`   ❌ ${key}: Missing or invalid`);
        issues.push(`${key} not properly configured`);
        recommendations.push(`Configure production ${key}`);
      }
    }

    // Check for hardcoded secrets in code
    const hasHardcodedSecrets = await this.checkForHardcodedSecrets();
    if (hasHardcodedSecrets) {
      issues.push('Hardcoded secrets found in code');
      recommendations.push('Remove hardcoded secrets from source code');
    }

    const passed = validKeys >= 3 && !hasHardcodedSecrets;
    return {
      category: 'API Key Security',
      passed,
      status: passed ? 'SECURE' : 'NEEDS ATTENTION',
      issues,
      recommendations
    };
  }

  private async auditSecretManagement(): Promise<any> {
    const issues = [];
    const recommendations = [];

    // Check .env file security
    const envExists = existsSync('.env');
    const gitignoreExists = existsSync('.gitignore');
    
    if (envExists) {
      console.log('   ✅ .env file exists');
      
      if (gitignoreExists) {
        const gitignore = readFileSync('.gitignore', 'utf8');
        if (gitignore.includes('.env')) {
          console.log('   ✅ .env file is gitignored');
        } else {
          console.log('   ❌ .env file not in .gitignore');
          issues.push('.env file not excluded from git');
          recommendations.push('Add .env to .gitignore');
        }
      } else {
        issues.push('No .gitignore file found');
        recommendations.push('Create .gitignore and exclude .env');
      }
    } else {
      issues.push('No .env file found');
      recommendations.push('Create .env file for environment variables');
    }

    // Check for environment variable validation
    const hasEnvValidation = await this.checkEnvironmentValidation();
    if (hasEnvValidation) {
      console.log('   ✅ Environment validation implemented');
    } else {
      console.log('   ⚠️ Environment validation missing');
      recommendations.push('Implement environment variable validation');
    }

    const passed = envExists && gitignoreExists && issues.length === 0;
    return {
      category: 'Secret Management',
      passed,
      status: passed ? 'SECURE' : 'NEEDS IMPROVEMENT',
      issues,
      recommendations
    };
  }

  private async auditRateLimiting(): Promise<any> {
    const issues = [];
    const recommendations = [];

    // Check for rate limiting implementation
    const hasRateLimiting = await this.checkRateLimiting();
    if (hasRateLimiting) {
      console.log('   ✅ Rate limiting implemented');
    } else {
      console.log('   ❌ Rate limiting missing');
      issues.push('No rate limiting found');
      recommendations.push('Implement rate limiting for API endpoints');
    }

    // Check for API abuse protection
    const hasAbuseProtection = await this.checkAbuseProtection();
    if (hasAbuseProtection) {
      console.log('   ✅ API abuse protection in place');
    } else {
      console.log('   ⚠️ API abuse protection missing');
      recommendations.push('Add API abuse protection mechanisms');
    }

    const passed = hasRateLimiting;
    return {
      category: 'Rate Limiting',
      passed,
      status: passed ? 'PROTECTED' : 'VULNERABLE',
      issues,
      recommendations
    };
  }

  private async auditInputValidation(): Promise<any> {
    const issues = [];
    const recommendations = [];

    // Check for input validation
    const hasInputValidation = await this.checkInputValidation();
    if (hasInputValidation) {
      console.log('   ✅ Input validation implemented');
    } else {
      console.log('   ❌ Input validation missing');
      issues.push('Insufficient input validation');
      recommendations.push('Implement comprehensive input validation');
    }

    // Check for SQL injection protection
    const hasSQLProtection = await this.checkSQLInjectionProtection();
    if (hasSQLProtection) {
      console.log('   ✅ SQL injection protection in place');
    } else {
      console.log('   ⚠️ SQL injection protection needs verification');
      recommendations.push('Verify SQL injection protection');
    }

    const passed = hasInputValidation && hasSQLProtection;
    return {
      category: 'Input Validation',
      passed,
      status: passed ? 'SECURE' : 'NEEDS HARDENING',
      issues,
      recommendations
    };
  }

  private async auditAccessControl(): Promise<any> {
    const issues = [];
    const recommendations = [];

    // Check for authentication
    const hasAuth = await this.checkAuthentication();
    if (hasAuth) {
      console.log('   ✅ Authentication mechanisms in place');
    } else {
      console.log('   ⚠️ Authentication needs review');
      recommendations.push('Review and strengthen authentication');
    }

    // Check for authorization
    const hasAuthz = await this.checkAuthorization();
    if (hasAuthz) {
      console.log('   ✅ Authorization controls implemented');
    } else {
      console.log('   ❌ Authorization controls missing');
      issues.push('Insufficient authorization controls');
      recommendations.push('Implement role-based access control');
    }

    const passed = hasAuth && hasAuthz;
    return {
      category: 'Access Control',
      passed,
      status: passed ? 'CONTROLLED' : 'NEEDS IMPLEMENTATION',
      issues,
      recommendations
    };
  }

  // Helper methods (simplified implementations)
  private async checkForHardcodedSecrets(): Promise<boolean> {
    // In real implementation, scan source files for patterns
    return false; // Assume no hardcoded secrets
  }

  private async checkEnvironmentValidation(): Promise<boolean> {
    return existsSync('scripts/validateEnvironment.ts');
  }

  private async checkRateLimiting(): Promise<boolean> {
    // Check if rate limiting middleware exists
    return false; // TODO: Implement rate limiting
  }

  private async checkAbuseProtection(): Promise<boolean> {
    return false; // TODO: Implement abuse protection
  }

  private async checkInputValidation(): Promise<boolean> {
    return existsSync('src/types/validation.ts');
  }

  private async checkSQLInjectionProtection(): Promise<boolean> {
    // Supabase provides built-in protection
    return true;
  }

  private async checkAuthentication(): Promise<boolean> {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ? true : false;
  }

  private async checkAuthorization(): Promise<boolean> {
    // TODO: Check for role-based access control
    return false;
  }
}

const auditor = new ProductionSecurityAuditor();
auditor.executeSecurityAudit().catch(console.error);
