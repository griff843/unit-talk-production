#!/usr/bin/env node
/**
 * PRE-TOOL DESTRUCTIVE COMMAND GUARD
 * Claude Code PreToolUse hook.
 *
 * Blocks destructive Bash commands that could cause irreversible damage.
 * Only activates for the Bash tool. Exits non-zero to block; 0 to allow.
 *
 * Configured in: .claude/settings.json → hooks.PreToolUse
 */

const DESTRUCTIVE_PATTERNS = [
  { pattern: /git\s+push\s+.*--force/, label: 'git push --force' },
  { pattern: /git\s+push\s+-f\b/, label: 'git push -f' },
  { pattern: /git\s+reset\s+--hard/, label: 'git reset --hard' },
  { pattern: /git\s+clean\s+-f/, label: 'git clean -f' },
  { pattern: /git\s+checkout\s+\.\s*$/, label: 'git checkout . (discard all changes)' },
  { pattern: /\brm\s+-rf\s+[\/\\.](?:\s|$)/, label: 'rm -rf on root or current directory' },
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
  // No stdin or invalid JSON — allow (don't block on parse errors)
  process.exit(0);
}

if (input.tool_name !== 'Bash') {
  process.exit(0);
}

const command = input.tool_input?.command || '';

for (const { pattern, label } of DESTRUCTIVE_PATTERNS) {
  if (pattern.test(command)) {
    console.log(JSON.stringify({
      type: 'system',
      content: [
        `BLOCKED: Destructive command detected — ${label}`,
        `Command: ${command}`,
        'This command was blocked by the pre-tool guard (scripts/pre-tool-guard.mjs).',
        'If you need to run this command, ask the user for explicit approval first.',
      ].join('\n'),
    }));
    process.exit(2);
  }
}

// No destructive pattern matched — allow silently
process.exit(0);
