#!/usr/bin/env npx tsx
/* eslint-disable no-console, complexity, max-lines-per-function, security/detect-non-literal-fs-filename */
/**
 * Environment Audit Script
 *
 * SPRINT-FOUNDATION-TRUTH-LOCK-094A
 *
 * Validates environment configuration against docs/ENV_CONTRACT.md
 * Detects missing keys, mismatched Supabase URLs, and configuration drift.
 *
 * Usage:
 *   npx tsx scripts/ops/env-audit.ts
 *   npm run env:audit
 */

import { readFileSync, existsSync } from 'fs';

import { config } from 'dotenv';

// Load root .env
config({ path: '.env' });

// ============================================================================
// KEY DEFINITIONS
// ============================================================================

interface KeyDef {
  name: string;
  required: boolean;
  category: 'supabase' | 'discord' | 'temporal' | 'redis' | 'api' | 'security' | 'runtime';
  usedBy: string[];
  failureMode: string;
}

const REQUIRED_KEYS: KeyDef[] = [
  // Supabase (Critical)
  {
    name: 'SUPABASE_URL',
    required: true,
    category: 'supabase',
    usedBy: ['API', 'Workers'],
    failureMode: 'Boot fails',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    category: 'supabase',
    usedBy: ['API', 'Workers'],
    failureMode: 'DB writes fail',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    category: 'supabase',
    usedBy: ['Smart Form', 'CC'],
    failureMode: 'Client fails',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    category: 'supabase',
    usedBy: ['Smart Form', 'CC'],
    failureMode: 'Auth fails',
  },

  // Discord (Pipeline Critical)
  {
    name: 'DISCORD_WEBHOOK_URL',
    required: false,
    category: 'discord',
    usedBy: ['Worker'],
    failureMode: 'Posts fail (WEBHOOK_MISSING)',
  },
  {
    name: 'DEFAULT_DISCORD_TICKET_CHANNEL_ID',
    required: false,
    category: 'discord',
    usedBy: ['Smart Form'],
    failureMode: 'Enqueue fails (ROUTE_MISSING)',
  },
  {
    name: 'ENABLE_DISCORD_TICKET_WORKER',
    required: false,
    category: 'discord',
    usedBy: ['API'],
    failureMode: 'Worker disabled',
  },

  // Discord Bot
  {
    name: 'DISCORD_TOKEN',
    required: false,
    category: 'discord',
    usedBy: ['Discord Bot'],
    failureMode: 'Bot offline',
  },
  {
    name: 'DISCORD_CLIENT_ID',
    required: false,
    category: 'discord',
    usedBy: ['Discord Bot'],
    failureMode: 'Bot auth fails',
  },

  // Temporal
  {
    name: 'TEMPORAL_ADDRESS',
    required: false,
    category: 'temporal',
    usedBy: ['API', 'Workers'],
    failureMode: 'Workflows fail',
  },

  // Redis
  {
    name: 'REDIS_URL',
    required: false,
    category: 'redis',
    usedBy: ['API', 'Workers'],
    failureMode: 'Caching unavailable',
  },

  // External APIs
  {
    name: 'OPTIMAL_API_KEY',
    required: false,
    category: 'api',
    usedBy: ['FeedAgent'],
    failureMode: 'Optimal unavailable',
  },
  {
    name: 'ODDS_API_KEY',
    required: false,
    category: 'api',
    usedBy: ['FeedAgent'],
    failureMode: 'Uses fallback',
  },
  {
    name: 'OPENAI_API_KEY',
    required: false,
    category: 'api',
    usedBy: ['AI features'],
    failureMode: 'AI disabled',
  },
];

// ============================================================================
// ENV FILE PARSING
// ============================================================================

function parseEnvFile(path: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!existsSync(path)) return result;

  const content = readFileSync(path, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (key) {
      result.set(key.trim(), valueParts.join('=').trim());
    }
  }
  return result;
}

function extractSupabaseFingerprint(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  return match ? match[1] : null;
}

// ============================================================================
// AUDIT LOGIC
// ============================================================================

interface AuditResult {
  pass: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
  keyStatus: Map<string, 'present' | 'missing' | 'empty'>;
  supabaseFingerprints: Map<string, string | null>;
}

function runAudit(): AuditResult {
  const result: AuditResult = {
    pass: true,
    errors: [],
    warnings: [],
    info: [],
    keyStatus: new Map(),
    supabaseFingerprints: new Map(),
  };

  // Load env files
  const rootEnv = parseEnvFile('.env');
  const smartFormEnv = parseEnvFile('apps/smart-form/.env.local');
  const commandCenterEnv = parseEnvFile('apps/command-center/.env.local');

  // Check required keys
  for (const keyDef of REQUIRED_KEYS) {
    const value = process.env[keyDef.name];
    if (!value) {
      result.keyStatus.set(keyDef.name, 'missing');
      if (keyDef.required) {
        result.errors.push(`MISSING (required): ${keyDef.name} - ${keyDef.failureMode}`);
        result.pass = false;
      } else {
        result.warnings.push(`MISSING (optional): ${keyDef.name} - ${keyDef.failureMode}`);
      }
    } else if (value.trim() === '') {
      result.keyStatus.set(keyDef.name, 'empty');
      if (keyDef.required) {
        result.errors.push(`EMPTY (required): ${keyDef.name} - ${keyDef.failureMode}`);
        result.pass = false;
      } else {
        result.warnings.push(`EMPTY (optional): ${keyDef.name}`);
      }
    } else {
      result.keyStatus.set(keyDef.name, 'present');
      result.info.push(`OK: ${keyDef.name}`);
    }
  }

  // Check Supabase URL consistency
  const rootFingerprint = extractSupabaseFingerprint(rootEnv.get('SUPABASE_URL'));
  const rootPublicFingerprint = extractSupabaseFingerprint(rootEnv.get('NEXT_PUBLIC_SUPABASE_URL'));
  const smartFormFingerprint = extractSupabaseFingerprint(
    smartFormEnv.get('NEXT_PUBLIC_SUPABASE_URL')
  );
  const commandCenterFingerprint = extractSupabaseFingerprint(
    commandCenterEnv.get('NEXT_PUBLIC_SUPABASE_URL')
  );

  result.supabaseFingerprints.set('root/.env', rootFingerprint);
  result.supabaseFingerprints.set('root/.env (public)', rootPublicFingerprint);
  result.supabaseFingerprints.set('smart-form/.env.local', smartFormFingerprint);
  result.supabaseFingerprints.set('command-center/.env.local', commandCenterFingerprint);

  // Verify all point to same Supabase
  const fingerprints = [
    rootFingerprint,
    rootPublicFingerprint,
    smartFormFingerprint,
    commandCenterFingerprint,
  ].filter(Boolean);
  const uniqueFingerprints = new Set(fingerprints);

  if (uniqueFingerprints.size > 1) {
    result.errors.push(
      `SUPABASE MISMATCH: Multiple Supabase instances detected: ${[...uniqueFingerprints].join(', ')}`
    );
    result.pass = false;
  } else if (uniqueFingerprints.size === 1) {
    result.info.push(`SUPABASE: All apps point to same instance (${[...uniqueFingerprints][0]})`);
  }

  // Discord worker specific checks
  const workerEnabled = process.env['ENABLE_DISCORD_TICKET_WORKER'] === 'true';
  const webhookSet = !!process.env['DISCORD_WEBHOOK_URL'];
  const channelSet = !!process.env['DEFAULT_DISCORD_TICKET_CHANNEL_ID'];

  if (workerEnabled) {
    if (!webhookSet) {
      result.warnings.push(
        'DISCORD: Worker enabled but DISCORD_WEBHOOK_URL not set - posts will fail'
      );
    }
    if (!channelSet) {
      result.warnings.push(
        'DISCORD: Worker enabled but DEFAULT_DISCORD_TICKET_CHANNEL_ID not set - enqueue will fail'
      );
    }
    if (webhookSet && channelSet) {
      result.info.push('DISCORD: Worker fully configured');
    }
  } else {
    result.info.push('DISCORD: Worker disabled (ENABLE_DISCORD_TICKET_WORKER != true)');
  }

  return result;
}

// ============================================================================
// OUTPUT
// ============================================================================

function printResult(result: AuditResult): void {
  console.log('\n========================================');
  console.log('  ENVIRONMENT AUDIT');
  console.log('  SPRINT-FOUNDATION-TRUTH-LOCK-094A');
  console.log('========================================\n');

  // Key Status Summary
  const categories = new Map<string, KeyDef[]>();
  for (const keyDef of REQUIRED_KEYS) {
    const cat = categories.get(keyDef.category) || [];
    cat.push(keyDef);
    categories.set(keyDef.category, cat);
  }

  console.log('=== KEY STATUS BY CATEGORY ===\n');
  for (const [category, keys] of categories) {
    console.log(`[${category.toUpperCase()}]`);
    for (const keyDef of keys) {
      const status = result.keyStatus.get(keyDef.name) || 'missing';
      const icon = status === 'present' ? '✓' : status === 'empty' ? '○' : '✗';
      console.log(`  ${icon} ${keyDef.name}: ${status}`);
    }
    console.log('');
  }

  // Supabase Fingerprints
  console.log('=== SUPABASE FINGERPRINTS ===\n');
  for (const [source, fingerprint] of result.supabaseFingerprints) {
    console.log(`  ${source}: ${fingerprint || 'NOT SET'}`);
  }
  console.log('');

  // Errors
  if (result.errors.length > 0) {
    console.log('=== ERRORS ===\n');
    for (const err of result.errors) {
      console.log(`  ✗ ${err}`);
    }
    console.log('');
  }

  // Warnings
  if (result.warnings.length > 0) {
    console.log('=== WARNINGS ===\n');
    for (const warn of result.warnings) {
      console.log(`  ⚠ ${warn}`);
    }
    console.log('');
  }

  // Summary
  console.log('========================================');
  console.log(`  RESULT: ${result.pass ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Errors: ${result.errors.length}`);
  console.log(`  Warnings: ${result.warnings.length}`);
  console.log('========================================\n');
}

// ============================================================================
// MAIN
// ============================================================================

const result = runAudit();
printResult(result);

// Exit with appropriate code
process.exit(result.pass ? 0 : 1);
