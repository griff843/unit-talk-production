#!/usr/bin/env node
/**
 * POST-TOOL PROOF AUTO-CAPTURE
 * Claude Code PostToolUse hook.
 *
 * Automatically captures output from gate commands (test, type-check, build,
 * lifecycle gate) to out/session/ for proof artifacts.
 *
 * Configured in: .claude/settings.json → hooks.PostToolUse
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

const CAPTURE_PATTERNS = [
  { pattern: /npm run test|npx vitest/, slug: 'test' },
  { pattern: /npm run type-check|npx tsc --noEmit/, slug: 'typecheck' },
  { pattern: /npm run build/, slug: 'build' },
  { pattern: /lifecycle:single-writer/, slug: 'gate' },
];

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

let input;
try {
  input = JSON.parse(await readStdin());
} catch {
  process.exit(0);
}

if (input.tool_name !== 'Bash') {
  process.exit(0);
}

const command = input.tool_input?.command || '';
const output = input.tool_output?.stdout || input.tool_output || '';

let matchedSlug = null;
for (const { pattern, slug } of CAPTURE_PATTERNS) {
  if (pattern.test(command)) {
    matchedSlug = slug;
    break;
  }
}

if (!matchedSlug) {
  process.exit(0);
}

// Build proof file path
const sessionDir = path.join(process.cwd(), 'out', 'session');
if (!existsSync(sessionDir)) {
  mkdirSync(sessionDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
const filename = `proof_${matchedSlug}_${timestamp}.txt`;
const filepath = path.join(sessionDir, filename);

const content = [
  `# Proof: ${matchedSlug}`,
  `# Command: ${command}`,
  `# Captured: ${new Date().toISOString()}`,
  '',
  typeof output === 'string' ? output : JSON.stringify(output, null, 2),
].join('\n');

try {
  writeFileSync(filepath, content, 'utf8');
  console.log(JSON.stringify({
    type: 'system',
    content: `Proof captured: ${path.relative(process.cwd(), filepath)}`,
  }));
} catch {
  // Write failed (permissions, disk) — don't block the session
}

process.exit(0);
