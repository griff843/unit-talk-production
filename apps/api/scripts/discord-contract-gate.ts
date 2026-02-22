#!/usr/bin/env npx tsx
/* eslint-disable no-console, max-lines-per-function, security/detect-non-literal-fs-filename */
/**
 * SPRINT-109A: Discord Contract Gate CI Enforcement
 *
 * This script checks for bypass paths in the Discord posting system.
 * Run as part of CI to ensure no direct webhook calls or contract bypasses.
 *
 * Usage:
 *   npx tsx scripts/discord-contract-gate.ts [--strict]
 *
 * Exit codes:
 *   0 - All checks pass
 *   1 - Violations detected
 */

import * as fs from 'fs';
import * as path from 'path';

import * as glob from 'glob';

interface Violation {
  file: string;
  line: number;
  pattern: string;
  description: string;
  severity: 'error' | 'warning';
}

const STRICT_MODE = process.argv.includes('--strict');
const SRC_DIR = path.join(__dirname, '..', 'src');

// Files that are allowed to have certain patterns (allowlist)
const ALLOWLIST = {
  // Files allowed to call axios.post to Discord webhook
  webhookCalls: [
    'agents/DiscordPromotionAgent/index.ts',
    'consumers/DiscordTicketWorker.ts',
    'monitoring/alerts.ts', // Alert system uses webhooks
    'agents/RecapAgent/index.ts', // Recap posting (not picks)
  ],
  // Files allowed to query unified_picks for posting purposes
  unifiedPicksQueries: [
    'agents/DiscordPromotionAgent/index.ts', // Must have CONTRACT-GUARDED comment
    'workers/BridgeWorker.ts', // Must have CONTRACT-GUARDED comment
    'lib/lifecycle/', // Lifecycle adapters
  ],
};

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function checkFileForPatterns(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = readFile(filePath);
  const lines = content.split('\n');
  const relativePath = path.relative(SRC_DIR, filePath);

  // Check 1: Direct webhook calls outside allowlist
  const webhookPattern = /axios\.post\s*\(\s*[`'"]?\$?\{?DISCORD_WEBHOOK_URL/;
  const isWebhookAllowed = ALLOWLIST.webhookCalls.some(p => relativePath.includes(p));

  lines.forEach((line, index) => {
    if (webhookPattern.test(line) && !isWebhookAllowed) {
      violations.push({
        file: relativePath,
        line: index + 1,
        pattern: 'DISCORD_WEBHOOK_URL',
        description: 'Direct Discord webhook call outside allowlist. Use posting agent instead.',
        severity: 'error',
      });
    }
  });

  // Check 2: unified_picks queries without CONTRACT-GUARDED comment
  if (
    relativePath.includes('agents/DiscordPromotionAgent') ||
    relativePath.includes('workers/BridgeWorker') ||
    relativePath.includes('consumers/DiscordTicketWorker')
  ) {
    const hasContractGuarded = content.includes('CONTRACT-GUARDED');
    if (!hasContractGuarded) {
      violations.push({
        file: relativePath,
        line: 1,
        pattern: 'CONTRACT-GUARDED',
        description: 'Missing CONTRACT-GUARDED comment in posting surface file',
        severity: 'error',
      });
    }

    // Check that assertDiscordContract is imported
    const hasAssertImport = content.includes('assertDiscordContract');
    if (!hasAssertImport) {
      violations.push({
        file: relativePath,
        line: 1,
        pattern: 'assertDiscordContract',
        description: 'Missing assertDiscordContract import in posting surface file',
        severity: 'error',
      });
    }
  }

  // Check 3: Embed creation without contract import
  const embedBuildPattern = /buildEmbed|EmbedBuilder|buildTicketEmbed|buildParlayEmbed/;
  if (embedBuildPattern.test(content)) {
    const hasContractImport =
      content.includes('assertDiscordContract') || content.includes('embedPresentationContract');
    if (!hasContractImport && !relativePath.includes('__tests__')) {
      violations.push({
        file: relativePath,
        line: 1,
        pattern: 'embed without contract',
        description: 'File builds embeds but does not import contract enforcement',
        severity: 'warning',
      });
    }
  }

  return violations;
}

function runGate(): void {
  console.log('🔍 DISCORD CONTRACT GATE');
  console.log(`   Scanning: ${SRC_DIR}`);
  console.log(`   Mode: ${STRICT_MODE ? 'STRICT' : 'NORMAL'}`);
  console.log('');

  // Find all TypeScript files
  const files = glob.sync('**/*.ts', {
    cwd: SRC_DIR,
    ignore: ['**/__tests__/**', '**/*.test.ts', '**/*.spec.ts', '**/node_modules/**'],
  });

  let allViolations: Violation[] = [];

  for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    const violations = checkFileForPatterns(filePath);
    allViolations = allViolations.concat(violations);
  }

  // Filter by severity in non-strict mode
  const relevantViolations = STRICT_MODE
    ? allViolations
    : allViolations.filter(v => v.severity === 'error');

  // Output results
  console.log('📊 Results:');
  console.log(`   Files scanned: ${files.length}`);
  console.log(`   Violations found: ${relevantViolations.length}`);
  console.log('');

  if (relevantViolations.length > 0) {
    console.log('❌ GATE FAILED\n');

    for (const violation of relevantViolations) {
      const icon = violation.severity === 'error' ? '❌' : '⚠️';
      console.log(`${icon} ${violation.file}:${violation.line}`);
      console.log(`   Pattern: ${violation.pattern}`);
      console.log(`   ${violation.description}`);
      console.log('');
    }

    process.exit(1);
  }

  console.log('✅ GATE PASSED');
  console.log('   All posting surfaces have contract enforcement');
  process.exit(0);
}

runGate();
