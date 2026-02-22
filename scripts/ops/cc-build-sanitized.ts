#!/usr/bin/env npx tsx
/* eslint-disable no-console, max-lines-per-function */
/**
 * SPRINT-COMMAND-CENTER-BUILD-TRUTH-002
 * Command Center Build Sanitized Gate
 *
 * Verifies that Command Center builds successfully with only BUILD profile
 * environment variables (NEXT_PUBLIC_* placeholders).
 *
 * Purpose:
 * - Ensure no runtime env vars are accessed at build time
 * - Catch module-level env access that breaks builds
 * - Enforce lazy initialization pattern
 */

import { execSync } from 'child_process';
import * as path from 'path';

const CC_PATH = path.resolve(__dirname, '../../apps/command-center');

// BUILD profile: Only NEXT_PUBLIC_* with placeholder values
const BUILD_ENV = {
  NODE_ENV: 'production',
  CI: 'true',
  NEXT_TELEMETRY_DISABLED: '1',
  // Placeholders for build-time vars
  NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
  NEXT_PUBLIC_API_URL: 'https://placeholder-api.example.com',
  NEXT_PUBLIC_PLATFORM_API_URL: 'https://placeholder-platform.example.com',
  // Explicitly unset runtime vars (they should not be needed at build)
  SUPABASE_SERVICE_ROLE_KEY: '',
  REDIS_URL: '',
  DISCORD_TOKEN: '',
};

async function runBuildSanitizedGate(): Promise<void> {
  console.log('🔍 COMMAND CENTER BUILD-SANITIZED GATE');
  console.log('   Sprint: SPRINT-COMMAND-CENTER-BUILD-TRUTH-002');
  console.log('   Verifying: Build succeeds with only BUILD profile env\n');

  console.log('📦 Build Profile Environment:');
  console.log('   NODE_ENV=production');
  console.log('   CI=true');
  console.log('   NEXT_PUBLIC_* = placeholders');
  console.log('   Runtime vars = UNSET\n');

  try {
    // Clean previous build
    console.log('🧹 Cleaning previous build...');
    try {
      execSync('rm -rf .next', { cwd: CC_PATH, stdio: 'pipe' });
    } catch {
      // Ignore errors if .next doesn't exist
    }

    // Run build with sanitized env
    console.log('🔨 Running build with BUILD profile...\n');

    const envString = Object.entries(BUILD_ENV)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');

    // Use cross-env for Windows compatibility
    const buildCmd = `npx cross-env ${envString} next build`;

    execSync(buildCmd, {
      cwd: CC_PATH,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...BUILD_ENV,
      },
    });

    console.log('\n✅ GATE PASSED');
    console.log('   Command Center builds successfully with BUILD profile.');
    console.log('   No runtime env vars required at build time.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ GATE FAILED');
    console.error('   Command Center build failed with BUILD profile.');
    console.error('   This indicates runtime env access at build time.\n');
    console.error('   Common causes:');
    console.error('   - Module-level env access (not lazy)');
    console.error('   - Singleton initialization in constructor');
    console.error('   - Top-level URL construction from env vars\n');
    console.error('   Fix: Use lazy initialization pattern (getRuntimeConfig())');
    process.exit(1);
  }
}

runBuildSanitizedGate();
