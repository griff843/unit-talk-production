/**
 * Global Setup for E2E Tests
 *
 * CRITICAL SAFETY: Validates that E2E tests are NOT running against production
 * infrastructure before any tests execute.
 *
 * Runs once before all tests to:
 * - Verify environment configuration (PRODUCTION PROTECTION)
 * - Check service availability
 * - Set up test database connections
 */

// Load environment from repo root FIRST (before any other imports)
import { loadRootEnv } from '@unit-talk/shared';
loadRootEnv();

import { validateTestEnvironment } from '../../../packages/shared/src/env-validator';

async function globalSetup() {
  console.log('🚀 Starting E2E Test Suite Global Setup');
  console.log('Environment:', process.env.E2E_ENVIRONMENT || 'staging');

  // 🚨 CRITICAL SAFETY CHECK: Validate test environment FIRST
  // This will throw an error and prevent tests from running if production infrastructure is detected
  try {
    console.log('\n🔍 Validating test environment safety...');
    validateTestEnvironment();
    console.log('✅ Environment validation passed - tests are safe to run\n');
  } catch (error) {
    console.error('\n🚨 E2E ENVIRONMENT VALIDATION FAILED:\n');
    console.error(error);
    console.error('\n❌ Tests have been BLOCKED for safety');
    console.error('\nTo fix this:');
    console.error('1. Set E2E_SUPABASE_URL to a local or staging Supabase instance');
    console.error('2. Set E2E_TEMPORAL_URL to localhost:7233 or staging');
    console.error('3. NEVER use production credentials in E2E tests\n');
    throw error; // Re-throw to prevent tests from running
  }

  // Verify required environment variables
  const requiredEnvVars = ['E2E_BASE_URL', 'E2E_SUPABASE_URL', 'E2E_SUPABASE_KEY'];

  const missing = requiredEnvVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please set these in your .env file or environment');
    process.exit(1);
  }

  // Verify service availability
  try {
    const baseUrl = process.env.E2E_BASE_URL!;
    console.log(`🔍 Checking service availability at ${baseUrl}/api/health`);

    const response = await fetch(`${baseUrl}/api/health`);

    if (!response.ok) {
      console.error('❌ Health check failed:', response.status, response.statusText);
      process.exit(1);
    }

    const health = await response.json();
    console.log('✅ Service health check passed:', JSON.stringify(health, null, 2));
  } catch (error) {
    console.error('❌ Failed to connect to service:', error);
    process.exit(1);
  }

  // Verify database connectivity
  try {
    const supabaseUrl = process.env.E2E_SUPABASE_URL!;
    const supabaseKey = process.env.E2E_SUPABASE_KEY!;

    console.log('🔍 Checking database connectivity');

    const response = await fetch(`${supabaseUrl}/rest/v1/users?limit=1`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (!response.ok) {
      console.error('❌ Database connection failed:', response.status, response.statusText);
      process.exit(1);
    }

    console.log('✅ Database connection verified');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }

  console.log('✅ Global setup completed successfully\n');
}

export default globalSetup;
