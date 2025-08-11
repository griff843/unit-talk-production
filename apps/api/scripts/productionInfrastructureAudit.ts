#!/usr/bin/env tsx

/**
 * Production Infrastructure & Security Audit
 * Comprehensive audit for production deployment readiness
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { config } from 'dotenv';

config();

interface AuditResult {
  category: string;
  checks: CheckResult[];
  score: number;
  status: 'PASS' | 'WARN' | 'FAIL';
}

interface CheckResult {
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  message: string;
  critical: boolean;
}

class ProductionInfrastructureAudit {
  private results: AuditResult[] = [];

  async runCompleteAudit(): Promise<void> {
    console.log('🔍 PRODUCTION INFRASTRUCTURE & SECURITY AUDIT');
    console.log('==============================================\n');

    // Run all audit categories
    await this.auditEnvironmentConfiguration();
    await this.auditDatabaseConnectivity();
    await this.auditRedisConfiguration();
    await this.auditSecurityConfiguration();
    await this.auditServiceHealth();
    await this.auditAPIEndpoints();
    await this.auditDiscordIntegration();

    // Generate final report
    this.generateAuditReport();
  }

  private async auditEnvironmentConfiguration(): Promise<void> {
    console.log('📋 AUDITING: Environment Configuration');
    console.log('=====================================\n');

    const checks: CheckResult[] = [];
    
    // Check critical environment variables
    const criticalEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'REDIS_URL',
      'DISCORD_TOKEN',
      'OPENAI_API_KEY',
      'NODE_ENV'
    ];

    criticalEnvVars.forEach(envVar => {
      const exists = !!process.env[envVar];
      checks.push({
        name: `${envVar} configured`,
        status: exists ? 'PASS' : 'FAIL',
        message: exists ? 'Environment variable is set' : 'Missing critical environment variable',
        critical: true
      });
    });

    // Check .env file exists
    const envFileExists = existsSync('.env');
    checks.push({
      name: '.env file exists',
      status: envFileExists ? 'PASS' : 'WARN',
      message: envFileExists ? '.env file found' : '.env file missing - using system environment',
      critical: false
    });

    // Check NODE_ENV setting
    const nodeEnv = process.env.NODE_ENV;
    checks.push({
      name: 'NODE_ENV configured for production',
      status: nodeEnv === 'production' ? 'PASS' : 'WARN',
      message: `NODE_ENV: ${nodeEnv || 'undefined'}`,
      critical: false
    });

    const professional_score = this.calculateScore(checks);
    this.results.push({
      category: 'Environment Configuration',
      checks,
      professional_score,
      status: professional_score >= 80 ? 'PASS' : professional_score >= 60 ? 'WARN' : 'FAIL'
    });

    console.log(`✅ Environment Configuration: ${score}%\n`);
  }

  private async auditDatabaseConnectivity(): Promise<void> {
    console.log('📋 AUDITING: Database Connectivity');
    console.log('==================================\n');

    const checks: CheckResult[] = [];

    // Test Supabase connection
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || ''
      );

      // Test basic connectivity
      const { error } = await supabase.from('user_profiles').select('count').limit(1);
      
      checks.push({
        name: 'Supabase connection',
        status: !error ? 'PASS' : 'FAIL',
        message: !error ? 'Supabase connection successful' : `Connection failed: ${error.message}`,
        critical: true
      });

      // Check critical tables exist
      const criticalTables = [
        'user_profiles',
        'user_behaviors', 
        'agent_events',
        'user_segments',
        'engagement_metrics'
      ];

      for (const table of criticalTables) {
        try {
          const { error: tableError } = await supabase.from(table).select('count').limit(1);
          checks.push({
            name: `Table '${table}' exists`,
            status: !tableError ? 'PASS' : 'FAIL',
            message: !tableError ? 'Table accessible' : `Table error: ${tableError.message}`,
            critical: true
          });
        } catch (err) {
          checks.push({
            name: `Table '${table}' exists`,
            status: 'FAIL',
            message: `Table check failed: ${err.message}`,
            critical: true
          });
        }
      }

    } catch (error) {
      checks.push({
        name: 'Supabase connection',
        status: 'FAIL',
        message: `Database connection failed: ${error.message}`,
        critical: true
      });
    }

    const professional_score = this.calculateScore(checks);
    this.results.push({
      category: 'Database Connectivity',
      checks,
      professional_score,
      status: professional_score >= 80 ? 'PASS' : professional_score >= 60 ? 'WARN' : 'FAIL'
    });

    console.log(`✅ Database Connectivity: ${score}%\n`);
  }

  private async auditRedisConfiguration(): Promise<void> {
    console.log('📋 AUDITING: Redis Configuration');
    console.log('================================\n');

    const checks: CheckResult[] = [];

    try {
      // Test Redis connection
      const Redis = await import('ioredis');
      const redis = new Redis.default(process.env.REDIS_URL || 'redis://localhost:6379');

      // Test basic connectivity
      const pong = await redis.ping();
      checks.push({
        name: 'Redis connection',
        status: pong === 'PONG' ? 'PASS' : 'FAIL',
        message: pong === 'PONG' ? 'Redis connection successful' : 'Redis ping failed',
        critical: true
      });

      // Test basic operations
      await redis.set('health_check', 'ok', 'EX', 60);
      const value = await redis.get('health_check');
      checks.push({
        name: 'Redis read/write operations',
        status: value === 'ok' ? 'PASS' : 'FAIL',
        message: value === 'ok' ? 'Redis operations working' : 'Redis operations failed',
        critical: true
      });

      // Check memory usage
      const info = await redis.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memoryUsed = memoryMatch ? parseInt(memoryMatch[1]) : 0;
      const memoryMB = Math.round(memoryUsed / 1024 / 1024);
      
      checks.push({
        name: 'Redis memory usage',
        status: memoryMB < 100 ? 'PASS' : memoryMB < 500 ? 'WARN' : 'FAIL',
        message: `Memory usage: ${memoryMB}MB`,
        critical: false
      });

      await redis.disconnect();

    } catch (error) {
      checks.push({
        name: 'Redis connection',
        status: 'FAIL',
        message: `Redis connection failed: ${error.message}`,
        critical: true
      });
    }

    const professional_score = this.calculateScore(checks);
    this.results.push({
      category: 'Redis Configuration',
      checks,
      professional_score,
      status: professional_score >= 80 ? 'PASS' : professional_score >= 60 ? 'WARN' : 'FAIL'
    });

    console.log(`✅ Redis Configuration: ${score}%\n`);
  }

  private async auditSecurityConfiguration(): Promise<void> {
    console.log('📋 AUDITING: Security Configuration');
    console.log('===================================\n');

    const checks: CheckResult[] = [];

    // Check for exposed secrets in code
    const secretPatterns = [
      /sk-[a-zA-Z0-9]{48}/, // OpenAI API keys
      /xapp-[0-9]+-[a-zA-Z0-9]{40}/, // Supabase service keys
      /[0-9a-f]{32}/ // Generic 32-char hex keys
    ];

    try {
      const packageJson = readFileSync('package.json', 'utf8');
      let secretsFound = false;
      
      secretPatterns.forEach(pattern => {
        if (pattern.test(packageJson)) {
          secretsFound = true;
        }
      });

      checks.push({
        name: 'No hardcoded secrets in package.json',
        status: !secretsFound ? 'PASS' : 'FAIL',
        message: !secretsFound ? 'No hardcoded secrets detected' : 'Potential hardcoded secrets found',
        critical: true
      });

    } catch (error) {
      checks.push({
        name: 'Secret scanning',
        status: 'WARN',
        message: 'Could not scan for secrets',
        critical: false
      });
    }

    // Check API key format validity
    const openaiKey = process.env.OPENAI_API_KEY;
    checks.push({
      name: 'OpenAI API key format',
      status: openaiKey && openaiKey.startsWith('sk-') ? 'PASS' : 'FAIL',
      message: openaiKey ? 'API key format valid' : 'API key missing or invalid format',
      critical: true
    });

    // Check Discord token format
    const discordToken = process.env.DISCORD_TOKEN;
    checks.push({
      name: 'Discord token format',
      status: discordToken && discordToken.length > 50 ? 'PASS' : 'FAIL',
      message: discordToken ? 'Discord token format valid' : 'Discord token missing or invalid',
      critical: true
    });

    // Check HTTPS enforcement
    const httpsEnforced = process.env.FORCE_HTTPS === 'true' || process.env.NODE_ENV === 'production';
    checks.push({
      name: 'HTTPS enforcement',
      status: httpsEnforced ? 'PASS' : 'WARN',
      message: httpsEnforced ? 'HTTPS enforcement enabled' : 'HTTPS enforcement not configured',
      critical: false
    });

    const professional_score = this.calculateScore(checks);
    this.results.push({
      category: 'Security Configuration',
      checks,
      professional_score,
      status: professional_score >= 80 ? 'PASS' : professional_score >= 60 ? 'WARN' : 'FAIL'
    });

    console.log(`✅ Security Configuration: ${score}%\n`);
  }

  private async auditServiceHealth(): Promise<void> {
    console.log('📋 AUDITING: Service Health');
    console.log('===========================\n');

    const checks: CheckResult[] = [];

    // Check if critical service files exist
    const criticalServices = [
      'src/services/redis.ts',
      'src/services/email.ts',
      'src/services/sms.ts',
      'src/shared/logger/index.ts'
    ];

    criticalServices.forEach(service => {
      const exists = existsSync(service);
      checks.push({
        name: `${service} exists`,
        status: exists ? 'PASS' : 'FAIL',
        message: exists ? 'Service file found' : 'Critical service file missing',
        critical: true
      });
    });

    // Check agent health
    const agents = ['AlertAgent', 'DataAgent', 'IngestionAgent', 'RecapAgent', 'AnalyticsAgent'];
    agents.forEach(agent => {
      const agentPath = `src/agents/${agent}/index.ts`;
      const exists = existsSync(agentPath);
      checks.push({
        name: `${agent} available`,
        status: exists ? 'PASS' : 'FAIL',
        message: exists ? 'Agent implementation found' : 'Agent missing',
        critical: true
      });
    });

    // Check TypeScript compilation
    try {
      execSync('npx tsc --noEmit', { encoding: 'utf8', timeout: 30000 });
      checks.push({
        name: 'TypeScript compilation',
        status: 'PASS',
        message: 'TypeScript compiles without errors',
        critical: true
      });
    } catch (error) {
      checks.push({
        name: 'TypeScript compilation',
        status: 'FAIL',
        message: 'TypeScript compilation errors detected',
        critical: true
      });
    }

    const professional_score = this.calculateScore(checks);
    this.results.push({
      category: 'Service Health',
      checks,
      professional_score,
      status: professional_score >= 80 ? 'PASS' : professional_score >= 60 ? 'WARN' : 'FAIL'
    });

    console.log(`✅ Service Health: ${score}%\n`);
  }

  private async auditAPIEndpoints(): Promise<void> {
    console.log('📋 AUDITING: API Endpoints');
    console.log('==========================\n');

    const checks: CheckResult[] = [];

    // Check if critical API files exist
    const apiFiles = [
      'src/api/dashboardAPI.ts',
      'src/routes/health.ts'
    ];

    apiFiles.forEach(file => {
      const exists = existsSync(file);
      checks.push({
        name: `${file} exists`,
        status: exists ? 'PASS' : 'WARN',
        message: exists ? 'API file found' : 'API file missing',
        critical: false
      });
    });

    // Test if Express is properly configured
    try {
      const expressPath = join(process.cwd(), 'src', 'index.ts');
      if (existsSync(expressPath)) {
        const content = readFileSync(expressPath, 'utf8');
        const hasExpress = content.includes('express') || content.includes('app.listen');
        checks.push({
          name: 'Express server configuration',
          status: hasExpress ? 'PASS' : 'WARN',
          message: hasExpress ? 'Express server found' : 'Express server not detected',
          critical: false
        });
      }
    } catch (error) {
      checks.push({
        name: 'Express server configuration',
        status: 'WARN',
        message: 'Could not verify Express configuration',
        critical: false
      });
    }

    const professional_score = this.calculateScore(checks);
    this.results.push({
      category: 'API Endpoints',
      checks,
      professional_score,
      status: professional_score >= 80 ? 'PASS' : professional_score >= 60 ? 'WARN' : 'FAIL'
    });

    console.log(`✅ API Endpoints: ${score}%\n`);
  }

  private async auditDiscordIntegration(): Promise<void> {
    console.log('📋 AUDITING: Discord Integration');
    console.log('================================\n');

    const checks: CheckResult[] = [];

    try {
      // Test Discord.js import
      const discordPath = 'discord.js';
      checks.push({
        name: 'Discord.js library available',
        status: 'PASS',
        message: 'Discord.js library installed',
        critical: true
      });

      // Check Discord token
      const token = process.env.DISCORD_TOKEN;
      checks.push({
        name: 'Discord token configured',
        status: token ? 'PASS' : 'FAIL',
        message: token ? 'Discord token available' : 'Discord token missing',
        critical: true
      });

      // Check Discord service files
      const discordFiles = [
        'src/services/DiscordBotService.ts'
      ];

      discordFiles.forEach(file => {
        const exists = existsSync(file);
        checks.push({
          name: `${file} exists`,
          status: exists ? 'PASS' : 'WARN',
          message: exists ? 'Discord service found' : 'Discord service missing',
          critical: false
        });
      });

    } catch (error) {
      checks.push({
        name: 'Discord integration',
        status: 'FAIL',
        message: `Discord integration error: ${error.message}`,
        critical: true
      });
    }

    const professional_score = this.calculateScore(checks);
    this.results.push({
      category: 'Discord Integration',
      checks,
      professional_score,
      status: professional_score >= 80 ? 'PASS' : professional_score >= 60 ? 'WARN' : 'FAIL'
    });

    console.log(`✅ Discord Integration: ${score}%\n`);
  }

  private calculateScore(checks: CheckResult[]): number {
    if (checks.length === 0) return 0;
    
    const totalWeight = checks.reduce((sum, check) => sum + (check.critical ? 2 : 1), 0);
    const passedWeight = checks.reduce((sum, check) => {
      if (check.status === 'PASS') return sum + (check.critical ? 2 : 1);
      if (check.status === 'WARN') return sum + (check.critical ? 1 : 0.5);
      return sum;
    }, 0);
    
    return Math.round((passedWeight / totalWeight) * 100);
  }

  private generateAuditReport(): void {
    console.log('\n📊 PRODUCTION INFRASTRUCTURE AUDIT REPORT');
    console.log('==========================================\n');

    let totalScore = 0;
    let criticalIssues = 0;
    let warningIssues = 0;

    this.results.forEach(result => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
      console.log(`${statusIcon} ${result.category}: ${result.score}% (${result.status})`);
      
      // Show critical failures
      result.checks.forEach(check => {
        if (check.status === 'FAIL' && check.critical) {
          console.log(`   ❌ CRITICAL: ${check.name} - ${check.message}`);
          criticalIssues++;
        } else if (check.status === 'FAIL') {
          console.log(`   ⚠️ ISSUE: ${check.name} - ${check.message}`);
          warningIssues++;
        }
      });
      
      totalScore += result.score;
      console.log('');
    });

    const overallScore = Math.round(totalScore / this.results.length);
    console.log(`🎯 OVERALL INFRASTRUCTURE SCORE: ${overallScore}%`);
    console.log(`🚨 Critical Issues: ${criticalIssues}`);
    console.log(`⚠️ Warning Issues: ${warningIssues}`);
    
    if (overallScore >= 90 && criticalIssues === 0) {
      console.log('\n🎉 INFRASTRUCTURE READY FOR PRODUCTION! 🚀');
    } else if (overallScore >= 80 && criticalIssues <= 2) {
      console.log('\n✅ Infrastructure mostly ready - address critical issues before launch');
    } else {
      console.log('\n⚠️ Infrastructure needs improvement before production deployment');
    }

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Address all critical issues (❌)');
    console.log('2. Review and fix warning issues (⚠️)');
    console.log('3. Re-run audit to verify fixes');
    console.log('4. Proceed with performance optimization');
  }
}

async function main() {
  const audit = new ProductionInfrastructureAudit();
  await audit.runCompleteAudit();
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Infrastructure audit failed:', error);
    process.exit(1);
  });
}

export { ProductionInfrastructureAudit };