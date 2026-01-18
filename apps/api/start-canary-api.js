#!/usr/bin/env node
/**
 * CANARY API Launcher
 *
 * Manually loads .env files in correct precedence and starts API server
 * Bypasses shared-utils build issues for operational testing
 */

const dotenv = require('dotenv');
const path = require('path');
const { spawn } = require('child_process');

// Determine repo root (go up from apps/api to root)
const repoRoot = path.resolve(__dirname, '../..');

console.log('🚀 CANARY API LAUNCHER');
console.log('='.repeat(80));

// Load environment files in precedence order
console.log('\n📋 Loading environment files:\n');

const envFiles = [
  { name: '.env.shared', path: path.join(repoRoot, '.env.shared'), override: false },
  { name: '.env', path: path.join(repoRoot, '.env'), override: true },
  { name: '.env.canary', path: path.join(repoRoot, '.env.canary'), override: true }
];

envFiles.forEach(({ name, path: filePath, override }) => {
  try {
    const result = dotenv.config({ path: filePath, override });
    if (result.error) {
      console.log(`⚠️  ${name} - File not found (optional)`);
    } else {
      console.log(`✅ ${name} loaded (override=${override})`);
    }
  } catch (error) {
    console.log(`❌ ${name} - Error: ${error.message}`);
  }
});

// Verify critical environment variables
console.log('\n🔍 Verifying critical variables:\n');

const criticalVars = [
  'NODE_ENV',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DISCORD_CANARY_CHANNEL_ID'
];

let allPresent = true;
criticalVars.forEach(varName => {
  const value = process.env[varName];
  const isPresent = !!value;
  allPresent = allPresent && isPresent;

  const status = isPresent ? '✅' : '❌';
  const displayValue = varName.includes('KEY') ? (value ? '***' + value.slice(-8) : 'MISSING') : (value || 'MISSING');
  console.log(`${status} ${varName} = ${displayValue}`);
});

if (!allPresent) {
  console.error('\n❌ Missing critical environment variables. Cannot start API.');
  process.exit(1);
}

console.log('\n' + '='.repeat(80));
console.log('✅ Environment loaded successfully');
console.log(`🎯 Mode: ${process.env.NODE_ENV}`);
console.log(`📡 CANARY Channel: ${process.env.DISCORD_CANARY_CHANNEL_ID}`);
console.log('='.repeat(80) + '\n');

// Start API server with npm (uses tsx from package.json)
console.log('🚀 Starting API server with npm...\n');

const apiServer = spawn('npm', ['run', 'api:start'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: process.env,
  shell: true  // Required for Windows npm
});

apiServer.on('error', (error) => {
  console.error('❌ Failed to start API server:', error);
  process.exit(1);
});

apiServer.on('exit', (code) => {
  console.log(`\nAPI server exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Received SIGINT, shutting down API server...');
  apiServer.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received SIGTERM, shutting down API server...');
  apiServer.kill('SIGTERM');
});
