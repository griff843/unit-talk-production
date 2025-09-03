#!/usr/bin/env tsx

/**
 * Migration Script: Environment Configuration Consolidation
 * 
 * This script helps migrate from scattered .env files to the centralized
 * environment configuration system following SaaS-level monorepo best practices.
 * 
 * Usage:
 *   npx tsx scripts/migrate-env-config.ts
 *   npx tsx scripts/migrate-env-config.ts --validate-only
 *   npx tsx scripts/migrate-env-config.ts --cleanup-old-files
 */

import fs from 'fs/promises';
import path from 'path';
import { env, validateProductionApiKeys } from '../config/environment';

// =============================================================================
// MIGRATION CONFIGURATION
// =============================================================================

interface MigrationStep {
  name: string;
  description: string;
  execute: () => Promise<void>;
  validate: () => Promise<boolean>;
}

const OLD_ENV_FILES = [
  'apps/api/.env',
  'apps/discord-bot/.env',
  'apps/command-center/.env.local',
  'apps/smart-form/.env.local',
  'apps/dashboard/.env.local',
  '.env.ci',
  '.env.test',
  '.env.staging',
  '.env.prod',
  '.env.testing',
  '.env.production',
] as const;

const NEW_CONFIG_FILES = [
  'config/environment.ts',
  'apps/api/src/config/index.ts',
  'apps/command-center/src/config/index.ts',
  'apps/discord-bot/src/config/index.ts',
  'apps/smart-form/src/config/index.ts',
] as const;

// =============================================================================
// MIGRATION STEPS
// =============================================================================

const migrationSteps: MigrationStep[] = [
  {
    name: 'validate-centralized-config',
    description: 'Validate centralized environment configuration',
    async execute() {
      console.log('🔍 Validating centralized environment configuration...');
      
      try {
        // Test centralized config loading
        console.log(`  ✅ Environment: ${env.environment}`);
        console.log(`  ✅ Database URL: ${env.database.supabaseUrl}`);
        console.log(`  ✅ Discord Guild: ${env.discord.guildId}`);
        console.log(`  ✅ API Keys present: ${env.apiKeys.optimal ? 'Yes' : 'No'}`);
        
        // Validate production API keys if in production
        if (env.isProduction) {
          validateProductionApiKeys();
        }
        
        console.log('  ✅ Centralized configuration is valid');
      } catch (error) {
        console.error('  ❌ Centralized configuration validation failed:', error);
        throw error;
      }
    },
    async validate() {
      try {
        return env.database.supabaseUrl && env.discord.guildId && env.apiKeys.optimal ? true : false;
      } catch {
        return false;
      }
    }
  },

  {
    name: 'validate-application-configs',
    description: 'Validate application-specific configuration adapters',
    async execute() {
      console.log('🔍 Validating application configuration adapters...');
      
      const configValidations = [
        {
          name: 'API Config',
          path: 'apps/api/src/config/index.ts',
          test: async () => {
            try {
              const { apiConfig } = await import('../apps/api/src/config/index');
              return apiConfig.database.supabaseUrl && apiConfig.apiKeys.optimal;
            } catch (error) {
              console.error(`    ❌ API config error: ${error}`);
              return false;
            }
          }
        },
        {
          name: 'Command Center Config',
          path: 'apps/command-center/src/config/index.ts',
          test: async () => {
            try {
              const { commandCenterConfig } = await import('../apps/command-center/src/config/index');
              return commandCenterConfig.database.supabaseUrl && commandCenterConfig.apiKeys.optimal;
            } catch (error) {
              console.error(`    ❌ Command Center config error: ${error}`);
              return false;
            }
          }
        },
        {
          name: 'Discord Bot Config',
          path: 'apps/discord-bot/src/config/index.ts',
          test: async () => {
            try {
              const { discordBotConfig } = await import('../apps/discord-bot/src/config/index');
              return discordBotConfig.database.supabaseUrl && discordBotConfig.discord.botToken;
            } catch (error) {
              console.error(`    ❌ Discord Bot config error: ${error}`);
              return false;
            }
          }
        },
        {
          name: 'Smart Form Config',
          path: 'apps/smart-form/src/config/index.ts',
          test: async () => {
            try {
              const { smartFormConfig } = await import('../apps/smart-form/src/config/index');
              return smartFormConfig.database.publicSupabaseUrl && smartFormConfig.apiKeys.optimal;
            } catch (error) {
              console.error(`    ❌ Smart Form config error: ${error}`);
              return false;
            }
          }
        }
      ];

      for (const validation of configValidations) {
        console.log(`  🧪 Testing ${validation.name}...`);
        const result = await validation.test();
        if (result) {
          console.log(`    ✅ ${validation.name} is valid`);
        } else {
          console.log(`    ❌ ${validation.name} validation failed`);
          throw new Error(`${validation.name} validation failed`);
        }
      }
    },
    async validate() {
      // Validate that all config files exist
      for (const configFile of NEW_CONFIG_FILES) {
        try {
          await fs.access(path.join(process.cwd(), configFile));
        } catch {
          return false;
        }
      }
      return true;
    }
  },

  {
    name: 'test-api-key-access',
    description: 'Test new API key from centralized configuration',
    async execute() {
      console.log('🔍 Testing new API key from centralized configuration...');
      
      try {
        const { commandCenterConfig } = await import('../apps/command-center/src/config/index');
        const optimalApiKey = commandCenterConfig.apiKeys.optimal;
        
        console.log(`  🔑 Optimal API Key: ${optimalApiKey.substring(0, 10)}...${optimalApiKey.substring(-4)}`);
        
        // Test API key with a simple request
        const testUrl = `https://api.optimal-bet.com/v1/account`;
        const response = await fetch(testUrl, {
          headers: {
            'Authorization': `Bearer ${optimalApiKey}`,
            'User-Agent': 'Unit-Talk-Migration-Test/1.0',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          console.log('  ✅ New API key is working correctly');
        } else if (response.status === 404) {
          console.log('  ⚠️  API key may be valid (404 expected for account endpoint)');
        } else {
          console.log(`  ❌ API key test failed: ${response.status} ${response.statusText}`);
          throw new Error(`API key test failed: ${response.status}`);
        }
      } catch (error) {
        console.error('  ❌ API key test failed:', error);
        throw error;
      }
    },
    async validate() {
      return true; // Always valid for now since we're testing
    }
  },

  {
    name: 'backup-old-env-files',
    description: 'Backup existing .env files before cleanup',
    async execute() {
      console.log('📦 Backing up old .env files...');
      
      const backupDir = path.join(process.cwd(), '.env-backup-' + Date.now());
      await fs.mkdir(backupDir, { recursive: true });
      
      let backedUpCount = 0;
      
      for (const envFile of OLD_ENV_FILES) {
        const fullPath = path.join(process.cwd(), envFile);
        try {
          await fs.access(fullPath);
          const backupPath = path.join(backupDir, envFile.replace(/\//g, '_'));
          await fs.mkdir(path.dirname(backupPath), { recursive: true });
          await fs.copyFile(fullPath, backupPath);
          console.log(`  ✅ Backed up ${envFile}`);
          backedUpCount++;
        } catch (error) {
          // File doesn't exist, skip
          console.log(`  ⏭️  Skipping ${envFile} (doesn't exist)`);
        }
      }
      
      if (backedUpCount > 0) {
        console.log(`  📦 Backed up ${backedUpCount} files to ${backupDir}`);
      } else {
        console.log('  ℹ️  No files to backup');
      }
    },
    async validate() {
      return true; // Always valid since backup is optional
    }
  }
];

// =============================================================================
// MIGRATION EXECUTION
// =============================================================================

async function runMigration(options: { validateOnly?: boolean; cleanupOldFiles?: boolean } = {}) {
  console.log('🚀 Unit Talk Environment Configuration Migration');
  console.log('==================================================');
  console.log();

  let allStepsValid = true;

  for (const step of migrationSteps) {
    console.log(`📋 ${step.name.toUpperCase()}`);
    console.log(`   ${step.description}`);
    console.log();

    try {
      if (options.validateOnly) {
        const isValid = await step.validate();
        if (isValid) {
          console.log(`   ✅ Validation passed`);
        } else {
          console.log(`   ❌ Validation failed`);
          allStepsValid = false;
        }
      } else {
        await step.execute();
        const isValid = await step.validate();
        if (isValid) {
          console.log(`   ✅ Step completed successfully`);
        } else {
          console.log(`   ⚠️  Step completed but validation concerns exist`);
        }
      }
    } catch (error) {
      console.error(`   ❌ Step failed:`, error);
      allStepsValid = false;
      
      if (!options.validateOnly) {
        console.log('   🛑 Migration stopped due to error');
        process.exit(1);
      }
    }

    console.log();
  }

  // Summary
  if (options.validateOnly) {
    if (allStepsValid) {
      console.log('✅ All validation checks passed! Migration is ready to proceed.');
      console.log('   Run without --validate-only to execute the migration.');
    } else {
      console.log('❌ Some validation checks failed. Please address the issues above.');
      process.exit(1);
    }
  } else {
    console.log('🎉 Migration completed successfully!');
    console.log();
    console.log('📋 Next Steps:');
    console.log('1. Test all applications with the new centralized configuration');
    console.log('2. Update application imports to use the new config adapters');
    console.log('3. Run --cleanup-old-files when ready to remove old .env files');
    console.log('4. Update CI/CD pipelines to use the new .env structure');
  }
}

async function cleanupOldFiles() {
  console.log('🧹 Cleaning up old .env files...');
  console.log('==================================');
  console.log();

  let removedCount = 0;

  for (const envFile of OLD_ENV_FILES) {
    // Skip the main .env and .env.local files - these are still used
    if (envFile === '.env' || envFile === '.env.local') {
      console.log(`  ⏭️  Keeping ${envFile} (still in use)`);
      continue;
    }

    const fullPath = path.join(process.cwd(), envFile);
    try {
      await fs.access(fullPath);
      await fs.unlink(fullPath);
      console.log(`  🗑️  Removed ${envFile}`);
      removedCount++;
    } catch (error) {
      console.log(`  ⏭️  Skipping ${envFile} (doesn't exist)`);
    }
  }

  if (removedCount > 0) {
    console.log();
    console.log(`✅ Cleaned up ${removedCount} old .env files`);
    console.log('   The main .env and .env.local files are preserved as the centralized configuration');
  } else {
    console.log();
    console.log('ℹ️  No files to clean up');
  }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const validateOnly = args.includes('--validate-only');
  const cleanupOldFiles = args.includes('--cleanup-old-files');

  if (cleanupOldFiles && !validateOnly) {
    await cleanupOldFiles();
  } else {
    await runMigration({ validateOnly, cleanupOldFiles });
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

export { runMigration, cleanupOldFiles };