/**
 * Phase 1 — Environment Validation (NO SECRET LEAKS)
 *
 * Validates required environment variables are SET (not their values)
 * Writes results to evidence directory without exposing secrets
 */

import { loadRootEnv } from '../packages/shared-utils/src/loadRootEnv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment exactly as the API does
loadRootEnv();

// Required environment variables for CANARY production testing
const REQUIRED_VARS = [
  // Core
  'NODE_ENV',
  'PORT',

  // Database
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',

  // Discord
  'DISCORD_TOKEN',
  'DISCORD_WEBHOOK_URL',

  // Picks System
  'PICK_DRIVER',
  'PUBLISH_MODE',
  'DEFAULT_TENANT_ID',

  // Canary Channel Mapping
  'CANARY_CHANNEL_ID',

  // Optional but recommended
  'REDIS_URL',
  'TEMPORAL_ADDRESS',
];

function maskSecret(value: string | undefined): string {
  if (!value) return 'NOT SET';
  if (value.length <= 8) return `${value.substring(0, 2)}***`;
  return `${value.substring(0, 4)}***${value.substring(value.length - 4)}`;
}

function validateEnv() {
  console.log('=== Phase 1 — Environment Validation ===\n');
  console.log('Checking environment variable status (NO SECRET VALUES)\n');

  const results: any = {
    timestamp: new Date().toISOString(),
    loadOrder: ['.env.shared', '.env', '.env.canary (highest priority)'],
    required: {},
    optional: {},
    summary: {
      totalRequired: REQUIRED_VARS.length,
      set: 0,
      notSet: 0,
    },
  };

  REQUIRED_VARS.forEach((varName) => {
    const value = process.env[varName];
    const isSet = !!value;

    if (isSet) {
      results.summary.set++;
      console.log(`✅ ${varName}: SET`);
    } else {
      results.summary.notSet++;
      console.log(`❌ ${varName}: NOT SET`);
    }

    results.required[varName] = {
      status: isSet ? 'SET' : 'NOT SET',
      masked: maskSecret(value),
      length: value?.length || 0,
    };
  });

  // Additional environment context (safe to expose)
  results.context = {
    nodeEnv: process.env.NODE_ENV,
    pickDriver: process.env.PICK_DRIVER,
    publishMode: process.env.PUBLISH_MODE,
    supabaseUrl: process.env.SUPABASE_URL, // URL is safe to show
    port: process.env.PORT,
  };

  console.log(`\n=== Summary ===`);
  console.log(`Required vars SET: ${results.summary.set}/${results.summary.totalRequired}`);
  console.log(`Required vars NOT SET: ${results.summary.notSet}/${results.summary.totalRequired}`);

  if (results.summary.notSet > 0) {
    console.log('\n⚠️ MISSING REQUIRED VARIABLES - System may not function properly');
    return { success: false, results };
  } else {
    console.log('\n✅ ALL REQUIRED VARIABLES SET - System ready');
    return { success: true, results };
  }
}

// Run validation
const { success, results } = validateEnv();

// Write to evidence directory
const evidenceDir = path.join(__dirname, '..', 'docs', 'ops', 'live_fire_run_2025-12-12');
const outputPath = path.join(evidenceDir, 'phase1_env_validation.json');

fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\n📄 Evidence written to: ${outputPath}`);

// Exit with appropriate code
process.exit(success ? 0 : 1);
