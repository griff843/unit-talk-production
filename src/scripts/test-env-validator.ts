#!/usr/bin/env node

import 'dotenv/config';
import { createLogger } from '../utils/logger';
import { createSupabaseClient } from '../utils/supabase';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger('TestEnvironmentValidator');

interface ValidationResult {
  category: string;
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

/**
 * TEST ENVIRONMENT VALIDATOR
 * Validates all prerequisites for running E2E tests
 */
export class TestEnvironmentValidator {
  private results: ValidationResult[] = [];

  async validate(): Promise<boolean> {
    logger.info('🔍 Validating test environment...');
    
    await this.validateEnvironmentVariables();
    await this.validateDependencies();
    await this.validateDatabaseConnection();
    await this.validateApiEndpoints();
    await this.validateTemporalSetup();
    await this.validateDiscordWebhooks();
    await this.validateFileSystem();
    
    return this.generateReport();
  }

  private async validateEnvironmentVariables(): Promise<void> {
    const requiredVars = [
      { key: 'SUPABASE_URL', description: 'Supabase database URL' },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase service role key' },
      { key: 'OPTIMAL_API_KEY', description: 'Optimal API key for primary data source' },
      { key: 'SGO_API_KEY', description: 'SGO API key for fallback' },
      { key: 'ODDS_API_KEY', description: 'OddsAPI key for fallback' },
      { key: 'DISCORD_APPROVED_WEBHOOK_URL', description: 'Discord webhook for approved picks' },
      { key: 'DISCORD_OPERATOR_WEBHOOK_URL', description: 'Discord webhook for operator alerts' },
      { key: 'TEMPORAL_TASK_QUEUE', description: 'Temporal task queue name' }
    ];

    const optionalVars = [
      { key: 'TEMPORAL_ADDRESS', description: 'Temporal server address', default: 'localhost:7233' },
      { key: 'TEMPORAL_NAMESPACE', description: 'Temporal namespace', default: 'default' },
      { key: 'NODE_ENV', description: 'Node environment', default: 'development' }
    ];

    // Check required variables
    for (const envVar of requiredVars) {
      const value = process.env[envVar.key];
      if (!value) {
        this.addResult('Environment', envVar.key, 'fail', `Missing required environment variable: ${envVar.description}`);
      } else if (value.length < 10) {
        this.addResult('Environment', envVar.key, 'warning', `Environment variable seems too short: ${envVar.description}`);
      } else {
        this.addResult('Environment', envVar.key, 'pass', `Environment variable present: ${envVar.description}`);
      }
    }

    // Check optional variables
    for (const envVar of optionalVars) {
      const value = process.env[envVar.key];
      if (!value) {
        this.addResult('Environment', envVar.key, 'warning', `Optional variable not set, using default: ${envVar.default}`);
      } else {
        this.addResult('Environment', envVar.key, 'pass', `Optional variable set: ${envVar.description}`);
      }
    }
  }

  private async validateDependencies(): Promise<void> {
    try {
      // Check if package.json exists
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      const requiredDeps = [
        '@temporalio/client',
        '@temporalio/worker',
        '@supabase/supabase-js',
        'dotenv'
      ];

      for (const dep of requiredDeps) {
        if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
          this.addResult('Dependencies', dep, 'pass', `Dependency found in package.json`);
        } else {
          this.addResult('Dependencies', dep, 'fail', `Missing required dependency`);
        }
      }

      // Check if node_modules exists
      try {
        await fs.access(path.join(process.cwd(), 'node_modules'));
        this.addResult('Dependencies', 'node_modules', 'pass', 'Dependencies installed');
      } catch {
        this.addResult('Dependencies', 'node_modules', 'fail', 'Dependencies not installed - run npm install');
      }

    } catch (error) {
      this.addResult('Dependencies', 'package.json', 'fail', `Failed to read package.json: ${error}`);
    }
  }

  private async validateDatabaseConnection(): Promise<void> {
    try {
      const supabase = createSupabaseClient();
      
      // Test basic connection
      const { error } = await supabase.from('raw_props').select('count').limit(1);
      
      if (error) {
        this.addResult('Database', 'connection', 'fail', `Database connection failed: ${error.message}`);
        return;
      }

      this.addResult('Database', 'connection', 'pass', 'Database connection successful');

      // Test required tables
      const requiredTables = ['raw_props', 'final_picks', 'games'];

      for (const table of requiredTables) {
        try {
          const { error: tableError } = await supabase.from(table).select('*').limit(1);
          if (tableError) {
            this.addResult('Database', table, 'fail', `Table access failed: ${tableError.message}`);
          } else {
            this.addResult('Database', table, 'pass', `Table accessible`);
          }
        } catch (error) {
          this.addResult('Database', table, 'fail', `Table validation error: ${error}`);
        }
      }

    } catch (error) {
      this.addResult('Database', 'setup', 'fail', `Database setup error: ${error}`);
    }
  }

  private async validateApiEndpoints(): Promise<void> {
    // Test Optimal API
    if (process.env['OPTIMAL_API_KEY']) {
      try {
        // This would make a real API call in production
        // For now, just validate the key format
        const key = process.env['OPTIMAL_API_KEY'];
        if (key.length > 20) {
          this.addResult('API', 'optimal', 'pass', 'Optimal API key format valid');
        } else {
          this.addResult('API', 'optimal', 'warning', 'Optimal API key seems short');
        }
      } catch (error) {
        this.addResult('API', 'optimal', 'fail', `Optimal API validation failed: ${error}`);
      }
    }

    // Test SGO API
    if (process.env['SGO_API_KEY']) {
      const key = process.env['SGO_API_KEY'];
      if (key.length > 10) {
        this.addResult('API', 'sgo', 'pass', 'SGO API key format valid');
      } else {
        this.addResult('API', 'sgo', 'warning', 'SGO API key seems short');
      }
    }

    // Test OddsAPI
    if (process.env['ODDS_API_KEY']) {
      const key = process.env['ODDS_API_KEY'];
      if (key.length > 10) {
        this.addResult('API', 'oddsapi', 'pass', 'OddsAPI key format valid');
      } else {
        this.addResult('API', 'oddsapi', 'warning', 'OddsAPI key seems short');
      }
    }
  }

  private async validateTemporalSetup(): Promise<void> {
    try {
      // Check if Temporal is running (this would need actual connection test)
      const temporalAddress = process.env['TEMPORAL_ADDRESS'] || 'localhost:7233';

      // For now, just validate configuration
      this.addResult('Temporal', 'address', 'pass', `Temporal address configured: ${temporalAddress}`);

      const taskQueue = process.env['TEMPORAL_TASK_QUEUE'];
      if (taskQueue) {
        this.addResult('Temporal', 'task_queue', 'pass', `Task queue configured: ${taskQueue}`);
      } else {
        this.addResult('Temporal', 'task_queue', 'warning', 'Task queue not configured, using default');
      }

      // Check if workflow files exist
      const workflowsPath = path.join(process.cwd(), 'src', 'workflows');
      try {
        await fs.access(workflowsPath);
        this.addResult('Temporal', 'workflows', 'pass', 'Workflows directory exists');
      } catch {
        this.addResult('Temporal', 'workflows', 'fail', 'Workflows directory not found');
      }

      // Check if activities files exist
      const activitiesPath = path.join(process.cwd(), 'src', 'activities');
      try {
        await fs.access(activitiesPath);
        this.addResult('Temporal', 'activities', 'pass', 'Activities directory exists');
      } catch {
        this.addResult('Temporal', 'activities', 'fail', 'Activities directory not found');
      }

    } catch (error) {
      this.addResult('Temporal', 'setup', 'fail', `Temporal setup validation failed: ${error}`);
    }
  }

  private async validateDiscordWebhooks(): Promise<void> {
    const webhooks = [
      { key: 'DISCORD_APPROVED_WEBHOOK_URL', name: 'approved_picks' },
      { key: 'DISCORD_OPERATOR_WEBHOOK_URL', name: 'operator_alerts' }
    ];

    for (const webhook of webhooks) {
      const url = process.env[webhook.key];
      if (!url) {
        this.addResult('Discord', webhook.name, 'fail', `Missing Discord webhook URL`);
        continue;
      }

      // Validate webhook URL format
      if (url.startsWith('https://discord.com/api/webhooks/') || url.startsWith('https://discordapp.com/api/webhooks/')) {
        this.addResult('Discord', webhook.name, 'pass', 'Discord webhook URL format valid');
      } else {
        this.addResult('Discord', webhook.name, 'fail', 'Invalid Discord webhook URL format');
      }
    }
  }

  private async validateFileSystem(): Promise<void> {
    // Check if logs directory can be created
    const logsDir = path.join(process.cwd(), 'logs');
    try {
      await fs.mkdir(logsDir, { recursive: true });
      this.addResult('FileSystem', 'logs_directory', 'pass', 'Logs directory accessible');
    } catch (error) {
      this.addResult('FileSystem', 'logs_directory', 'fail', `Cannot create logs directory: ${error}`);
    }

    // Check if config directory exists
    const configDir = path.join(process.cwd(), 'config');
    try {
      await fs.access(configDir);
      this.addResult('FileSystem', 'config_directory', 'pass', 'Config directory exists');
    } catch {
      this.addResult('FileSystem', 'config_directory', 'warning', 'Config directory not found');
    }

    // Check write permissions
    try {
      const testFile = path.join(process.cwd(), 'test-write-permissions.tmp');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      this.addResult('FileSystem', 'write_permissions', 'pass', 'Write permissions available');
    } catch (error) {
      this.addResult('FileSystem', 'write_permissions', 'fail', `No write permissions: ${error}`);
    }
  }

  private addResult(category: string, name: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any): void {
    this.results.push({ category, name, status, message, details });
  }

  private generateReport(): boolean {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;

    console.log('\n' + '='.repeat(80));
    console.log('🔍 TEST ENVIRONMENT VALIDATION REPORT');
    console.log('='.repeat(80));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log('');

    // Group results by category
    const categories = [...new Set(this.results.map(r => r.category))];
    
    for (const category of categories) {
      console.log(`📁 ${category.toUpperCase()}`);
      console.log('-'.repeat(40));
      
      const categoryResults = this.results.filter(r => r.category === category);
      for (const result of categoryResults) {
        const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
        console.log(`${icon} ${result.name}: ${result.message}`);
      }
      console.log('');
    }

    // Print recommendations
    if (failed > 0) {
      console.log('🚨 CRITICAL ISSUES TO FIX:');
      console.log('-'.repeat(40));
      const failedResults = this.results.filter(r => r.status === 'fail');
      for (const result of failedResults) {
        console.log(`• ${result.category}/${result.name}: ${result.message}`);
      }
      console.log('');
    }

    if (warnings > 0) {
      console.log('⚠️  WARNINGS TO REVIEW:');
      console.log('-'.repeat(40));
      const warningResults = this.results.filter(r => r.status === 'warning');
      for (const result of warningResults) {
        console.log(`• ${result.category}/${result.name}: ${result.message}`);
      }
      console.log('');
    }

    // Overall status
    const isReady = failed === 0;
    console.log('='.repeat(80));
    if (isReady) {
      console.log('🎉 ENVIRONMENT READY FOR TESTING');
      console.log('You can now run: npm run test:e2e-local');
    } else {
      console.log('❌ ENVIRONMENT NOT READY');
      console.log('Please fix the critical issues above before running tests.');
    }
    console.log('='.repeat(80));

    return isReady;
  }
}

// CLI execution
if (require.main === module) {
  const validator = new TestEnvironmentValidator();
  validator.validate().then((isReady) => {
    process.exit(isReady ? 0 : 1);
  }).catch((error) => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
}

export default TestEnvironmentValidator;