/**
 * Environment Validator - Production Safety Guardrails
 *
 * CRITICAL SAFETY: Prevents local/dev/test environments from accidentally
 * connecting to production databases, causing data corruption or loss.
 *
 * This module MUST be imported and called at the start of every application
 * entry point (API, workers, bots, etc.) to enforce environment isolation.
 */

import chalk from 'chalk';

export interface EnvironmentConfig {
  nodeEnv: string;
  supabaseUrl: string;
  supabaseKey: string;
  temporalAddress?: string;
  discordWebhook?: string;
  redisUrl?: string;
}

export interface EnvironmentValidationResult {
  isValid: boolean;
  environment: 'local' | 'staging' | 'production' | 'unknown';
  errors: string[];
  warnings: string[];
  config: EnvironmentConfig;
}

/**
 * Known production identifiers - UPDATE THESE when production infrastructure changes
 */
const PRODUCTION_IDENTIFIERS = {
  supabaseProjects: [
    'cqfnsozknjzvyiziwicl.supabase.co', // Current production Supabase
  ],
  temporalHosts: [
    'temporal.unit-talk.com',
    'prod-temporal.unit-talk.com',
  ],
  discordChannels: [
    // Add production Discord webhook URLs here
    'discord.com/api/webhooks/production',
  ],
};

/**
 * Staging identifiers - UPDATE THESE when staging is created
 */
const STAGING_IDENTIFIERS = {
  supabaseProjects: [
    // To be populated when staging Supabase is created
    // Example: 'abcd1234staging.supabase.co'
  ],
  temporalHosts: [
    'staging-temporal.unit-talk.com',
  ],
  discordChannels: [
    // Staging Discord webhook URLs
    'discord.com/api/webhooks/staging',
  ],
};

/**
 * Detects which environment the configuration is pointing to
 */
export function detectEnvironment(config: EnvironmentConfig): 'local' | 'staging' | 'production' | 'unknown' {
  const { supabaseUrl, temporalAddress, discordWebhook } = config;

  // Check for production identifiers
  const isProductionSupabase = PRODUCTION_IDENTIFIERS.supabaseProjects.some(
    project => supabaseUrl?.includes(project)
  );
  const isProductionTemporal = temporalAddress && PRODUCTION_IDENTIFIERS.temporalHosts.some(
    host => temporalAddress.includes(host)
  );
  const isProductionDiscord = discordWebhook && PRODUCTION_IDENTIFIERS.discordChannels.some(
    channel => discordWebhook.includes(channel)
  );

  if (isProductionSupabase || isProductionTemporal || isProductionDiscord) {
    return 'production';
  }

  // Check for staging identifiers
  const isStagingSupabase = STAGING_IDENTIFIERS.supabaseProjects.some(
    project => supabaseUrl?.includes(project)
  );
  const isStagingTemporal = temporalAddress && STAGING_IDENTIFIERS.temporalHosts.some(
    host => temporalAddress.includes(host)
  );

  if (isStagingSupabase || isStagingTemporal) {
    return 'staging';
  }

  // Check for local identifiers
  const isLocalSupabase = supabaseUrl?.includes('localhost') || supabaseUrl?.includes('127.0.0.1');
  const isLocalTemporal = temporalAddress?.includes('localhost') || temporalAddress?.includes('127.0.0.1');
  const isLocalRedis = config.redisUrl?.includes('localhost') || config.redisUrl?.includes('127.0.0.1');

  if (isLocalSupabase || isLocalTemporal || isLocalRedis) {
    return 'local';
  }

  return 'unknown';
}

/**
 * Validates that the environment configuration is safe for the current NODE_ENV
 */
export function validateEnvironment(config: EnvironmentConfig): EnvironmentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const detectedEnv = detectEnvironment(config);
  const nodeEnv = config.nodeEnv.toLowerCase();

  // CRITICAL SAFETY CHECK: Prevent local/dev/test from touching production
  if ((nodeEnv === 'development' || nodeEnv === 'test' || nodeEnv === 'local') && detectedEnv === 'production') {
    errors.push(
      `🚨 CRITICAL SAFETY VIOLATION: NODE_ENV="${config.nodeEnv}" but configuration points to PRODUCTION infrastructure!`
    );
    errors.push(
      `   Supabase URL: ${maskSensitive(config.supabaseUrl)}`
    );
    errors.push(
      `   This could cause PRODUCTION DATA CORRUPTION or LOSS.`
    );
    errors.push(
      `   ACTION REQUIRED: Update .env to use local or staging infrastructure.`
    );
  }

  // Prevent staging from accidentally using production
  if (nodeEnv === 'staging' && detectedEnv === 'production') {
    errors.push(
      `⚠️  ENVIRONMENT MISMATCH: NODE_ENV="staging" but configuration points to PRODUCTION infrastructure!`
    );
    errors.push(
      `   This could affect production users or data.`
    );
  }

  // Prevent test runs from using non-local infrastructure
  if (nodeEnv === 'test') {
    if (detectedEnv === 'production') {
      errors.push(
        `🚨 TEST SAFETY VIOLATION: Tests must NEVER run against PRODUCTION infrastructure!`
      );
    } else if (detectedEnv === 'staging') {
      warnings.push(
        `⚠️  Running tests against STAGING infrastructure. Consider using local test database.`
      );
    }
  }

  // Warn about unknown environment
  if (detectedEnv === 'unknown') {
    warnings.push(
      `⚠️  Could not determine environment from configuration. Please verify settings.`
    );
    warnings.push(
      `   Supabase URL: ${maskSensitive(config.supabaseUrl)}`
    );
  }

  // Warn if production is not using production NODE_ENV
  if (detectedEnv === 'production' && nodeEnv !== 'production') {
    warnings.push(
      `⚠️  Configuration points to PRODUCTION but NODE_ENV="${config.nodeEnv}". Consider setting NODE_ENV=production.`
    );
  }

  return {
    isValid: errors.length === 0,
    environment: detectedEnv,
    errors,
    warnings,
    config,
  };
}

/**
 * Validates environment and exits process if invalid (for application startup)
 */
export function validateEnvironmentOrExit(config: EnvironmentConfig): void {
  const result = validateEnvironment(config);

  // Always log environment detection
  console.log(chalk.blue('\n🔍 Environment Detection:'));
  console.log(chalk.blue(`   NODE_ENV: ${config.nodeEnv}`));
  console.log(chalk.blue(`   Detected Environment: ${result.environment}`));
  console.log(chalk.blue(`   Supabase: ${maskSensitive(config.supabaseUrl)}`));

  if (config.temporalAddress) {
    console.log(chalk.blue(`   Temporal: ${config.temporalAddress}`));
  }

  // Log warnings
  if (result.warnings.length > 0) {
    console.log(chalk.yellow('\n⚠️  WARNINGS:'));
    result.warnings.forEach(warning => console.log(chalk.yellow(warning)));
  }

  // If there are errors, log them and EXIT immediately
  if (!result.isValid) {
    console.error(chalk.red.bold('\n🚨 ENVIRONMENT VALIDATION FAILED:\n'));
    result.errors.forEach(error => console.error(chalk.red(error)));
    console.error(chalk.red.bold('\n❌ APPLICATION STARTUP BLOCKED FOR SAFETY\n'));
    console.error(chalk.yellow('To fix this:'));
    console.error(chalk.yellow('1. Review your .env file'));
    console.error(chalk.yellow('2. Ensure NODE_ENV matches your infrastructure'));
    console.error(chalk.yellow('3. Use .env.local for local development'));
    console.error(chalk.yellow('4. Use .env.staging for staging environment'));
    console.error(chalk.yellow('5. Never use production credentials in local/dev/test\n'));

    process.exit(1);
  }

  console.log(chalk.green('\n✅ Environment validation passed\n'));
}

/**
 * Helper to mask sensitive data in logs
 */
function maskSensitive(value: string | undefined): string {
  if (!value) return '<not set>';

  // Show first 20 chars, mask the rest
  if (value.length > 20) {
    return `${value.substring(0, 20)}...${value.substring(value.length - 8)}`;
  }

  return value;
}

/**
 * Gets the current environment configuration from process.env
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '',
    temporalAddress: process.env.TEMPORAL_ADDRESS || process.env.TEMPORAL_SERVER_URL,
    discordWebhook: process.env.DISCORD_WEBHOOK_URL,
    redisUrl: process.env.REDIS_URL,
  };
}

/**
 * Quick check for E2E/Playwright tests
 */
export function validateTestEnvironment(): void {
  const config = {
    nodeEnv: 'test',
    supabaseUrl: process.env.E2E_SUPABASE_URL || process.env.SUPABASE_URL || '',
    supabaseKey: process.env.E2E_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    temporalAddress: process.env.E2E_TEMPORAL_URL || process.env.TEMPORAL_ADDRESS,
  };

  const result = validateEnvironment(config);

  if (!result.isValid) {
    console.error(chalk.red.bold('\n🚨 TEST ENVIRONMENT VALIDATION FAILED:\n'));
    result.errors.forEach(error => console.error(chalk.red(error)));
    console.error(chalk.red.bold('\n❌ TESTS BLOCKED FOR SAFETY\n'));
    throw new Error('Test environment validation failed - refusing to run tests against production');
  }

  if (result.environment === 'production') {
    throw new Error('🚨 CRITICAL: Tests attempted to run against PRODUCTION infrastructure. Aborting.');
  }

  console.log(chalk.green(`✅ Test environment validated: ${result.environment}`));
}
