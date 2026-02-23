#!/usr/bin/env node
/**
 * Generate .env.smoke from existing environment sources
 * SPRINT-RUNTIME-TRUTH-008: Deterministic smoke env profile
 *
 * Priority order:
 * 1. Root .env.local (if exists)
 * 2. Root .env (if exists)
 *
 * This script extracts only the variables needed for smoke tests.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

// Required variables for smoke tests
const REQUIRED_VARS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

// Optional variables (will include if found)
const OPTIONAL_VARS = ['DISCORD_WEBHOOK_URL_SMOKE'];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const vars = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, '');
      vars[key] = cleanValue;
    }
  }

  return vars;
}

function main() {
  console.log('='.repeat(60));
  console.log('GENERATE SMOKE ENV');
  console.log('Sprint: SPRINT-RUNTIME-TRUTH-008');
  console.log('='.repeat(60));

  // Load env files in priority order
  const envSources = [
    path.join(ROOT_DIR, '.env.local'),
    path.join(ROOT_DIR, '.env'),
  ];

  let foundVars = {};

  for (const envPath of envSources) {
    const relativePath = path.relative(ROOT_DIR, envPath);
    const vars = parseEnvFile(envPath);

    if (vars) {
      console.log(`[INFO] Reading from: ${relativePath}`);
      foundVars = { ...foundVars, ...vars };
    } else {
      console.log(`[SKIP] Not found: ${relativePath}`);
    }
  }

  // Check for required variables
  const missing = [];
  for (const varName of REQUIRED_VARS) {
    if (!foundVars[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('\n[ERROR] Missing required variables:');
    for (const varName of missing) {
      console.error(`  - ${varName}`);
    }
    console.error('\nPlease add these variables to your .env or .env.local file.');
    process.exit(1);
  }

  // Build output content
  const lines = [
    '# =============================================================================',
    '# UNIT TALK E2E SMOKE TEST - GENERATED ENVIRONMENT',
    '# =============================================================================',
    `# Generated: ${new Date().toISOString()}`,
    '# Sprint: SPRINT-RUNTIME-TRUTH-008',
    '#',
    '# DO NOT COMMIT THIS FILE - it contains secrets',
    '# =============================================================================',
    '',
  ];

  // Add required vars
  lines.push('# Required Variables');
  for (const varName of REQUIRED_VARS) {
    lines.push(`${varName}=${foundVars[varName]}`);
  }

  // Add optional vars if found
  const foundOptional = OPTIONAL_VARS.filter((v) => foundVars[v]);
  if (foundOptional.length > 0) {
    lines.push('');
    lines.push('# Optional Variables');
    for (const varName of foundOptional) {
      lines.push(`${varName}=${foundVars[varName]}`);
    }
  }

  lines.push('');

  // Write output
  const outputPath = path.join(ROOT_DIR, '.env.smoke');
  fs.writeFileSync(outputPath, lines.join('\n'));

  console.log('');
  console.log(`[SUCCESS] Generated: .env.smoke`);
  console.log('');
  console.log('Required variables found:');
  for (const varName of REQUIRED_VARS) {
    const value = foundVars[varName];
    const redacted = value.substring(0, 20) + '...' + value.substring(value.length - 10);
    console.log(`  - ${varName}: ${redacted}`);
  }
  console.log('');
  console.log('Run smoke tests with: pnpm e2e:smoke:full');
}

main();
