#!/usr/bin/env node
/**
 * SESSION BASELINE FRESHNESS CHECK
 * Sprint: SPRINT-CLAUDE-OS-COS005-SESSION-BASELINE-HOOK
 *
 * Claude Code UserPromptSubmit hook. Checks if session:baseline was run
 * within the last 30 minutes. Emits a warning if stale so Claude sees it
 * as a system message before processing any prompt.
 *
 * Configured in: .claude/settings.json -> hooks.UserPromptSubmit
 * Reference: docs/02_architecture/claude_os_ceiling_blueprint.md section 10 COS-005
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const BASELINE_DIR = path.join(ROOT, 'out', 'session-baseline');
const MAX_AGE_MINUTES = 30;

function findLatestBaseline() {
  if (!existsSync(BASELINE_DIR)) return null;

  const dirs = readdirSync(BASELINE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => ({
      name: d.name,
      path: path.join(BASELINE_DIR, d.name),
      mtime: statSync(path.join(BASELINE_DIR, d.name)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  for (const dir of dirs) {
    const baselinePath = path.join(dir.path, 'baseline.json');
    if (!existsSync(baselinePath)) {
      continue;
    }

    try {
      const content = JSON.parse(readFileSync(baselinePath, 'utf8'));
      const timestamp = content.timestamp;
      const parsedTimestamp = new Date(timestamp).getTime();

      if (!timestamp || Number.isNaN(parsedTimestamp)) {
        continue;
      }

      return {
        name: dir.name,
        timestamp,
      };
    } catch {
      continue;
    }
  }

  return null;
}

function ageMinutes(timestamp) {
  return (Date.now() - new Date(timestamp).getTime()) / 60000;
}

const latest = findLatestBaseline();

if (!latest) {
  console.log(
    JSON.stringify({
      type: 'system',
      content: [
        'SESSION BASELINE NOT RUN',
        'No session baseline found. Per CLAUDE.md section 11, you MUST run:',
        '  pnpm session:baseline',
        'before any code modification. Run it now before proceeding.',
      ].join('\n'),
    })
  );
  process.exit(0);
}

const age = ageMinutes(latest.timestamp);

if (age > MAX_AGE_MINUTES) {
  const ageStr = age < 60 ? `${Math.round(age)} minutes` : `${(age / 60).toFixed(1)} hours`;

  console.log(
    JSON.stringify({
      type: 'system',
      content: [
        `SESSION BASELINE STALE (${ageStr} old)`,
        `Last run: ${latest.name}`,
        'Per CLAUDE.md section 11, baseline must be fresh before code changes.',
        'Run: pnpm session:baseline',
      ].join('\n'),
    })
  );
}

process.exit(0);
