#!/usr/bin/env node
/**
 * Git MCP Wrapper
 * Sprint: SPRINT-CLAUDE-OS-SESSION-ENFORCEMENT-110A
 *
 * Provides MCP-style interface to Git:
 * - status()
 * - diff()
 * - branch()
 * - log()
 * - show()
 */

import { execSync } from 'child_process';

const ROOT = process.cwd();

function runGit(args, options = {}) {
  try {
    const result = execSync(`git ${args}`, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      ...options,
    });
    return { success: true, output: result.trim() };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout?.trim() || '' };
  }
}

/**
 * Get current git status
 */
export function status() {
  const result = runGit('status --porcelain');
  if (!result.success) return result;

  const lines = result.output.split('\n').filter(Boolean);
  const files = lines.map(line => ({
    status: line.substring(0, 2).trim(),
    file: line.substring(3),
  }));

  const staged = files.filter(f => f.status.startsWith('A') || f.status.startsWith('M') || f.status.startsWith('D'));
  const modified = files.filter(f => f.status.endsWith('M') || f.status === '??');
  const untracked = files.filter(f => f.status === '??');

  return {
    success: true,
    clean: lines.length === 0,
    staged: staged.length,
    modified: modified.length,
    untracked: untracked.length,
    files,
  };
}

/**
 * Get git diff
 * @param {boolean} staged - Whether to show staged changes
 */
export function diff(staged = false) {
  const args = staged ? 'diff --cached --stat' : 'diff --stat';
  const result = runGit(args);

  if (!result.success) return result;

  // Also get full diff for detailed analysis
  const fullArgs = staged ? 'diff --cached' : 'diff';
  const fullResult = runGit(fullArgs);

  const lines = result.output.split('\n').filter(Boolean);
  const changedFiles = lines.slice(0, -1).map(line => {
    const match = line.match(/^\s*([^\s|]+)/);
    return match ? match[1] : line;
  });

  return {
    success: true,
    staged,
    changedFiles,
    stat: result.output,
    hasChanges: lines.length > 0,
    linesAdded: 0, // Would need to parse summary line
    linesRemoved: 0,
  };
}

/**
 * Get current branch info
 */
export function branch() {
  const current = runGit('branch --show-current');
  const all = runGit('branch -a --format="%(refname:short)"');
  const remote = runGit('rev-parse --abbrev-ref @{upstream} 2>/dev/null || echo "none"');

  return {
    success: true,
    current: current.output,
    upstream: remote.output !== 'none' ? remote.output : null,
    branches: all.output.split('\n').filter(Boolean),
  };
}

/**
 * Get git log
 * @param {number} count - Number of commits to show
 * @param {string} format - Output format
 */
export function log(count = 10, format = 'oneline') {
  const formats = {
    oneline: '--oneline',
    full: '--format="%H|%an|%ae|%s|%ai"',
    json: '--format={"hash":"%H","author":"%an","email":"%ae","subject":"%s","date":"%ai"}',
  };

  const result = runGit(`log -${count} ${formats[format] || formats.oneline}`);
  if (!result.success) return result;

  if (format === 'json') {
    const commits = result.output.split('\n').filter(Boolean).map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
    return { success: true, commits };
  }

  return {
    success: true,
    commits: result.output.split('\n').filter(Boolean),
  };
}

/**
 * Show a specific commit
 * @param {string} ref - Commit ref to show
 */
export function show(ref = 'HEAD') {
  const result = runGit(`show ${ref} --stat`);
  return result;
}

/**
 * Get repository info
 */
export function info() {
  const statusResult = status();
  const branchResult = branch();
  const headResult = runGit('rev-parse HEAD');
  const remoteResult = runGit('remote get-url origin 2>/dev/null || echo "none"');

  return {
    success: true,
    head: headResult.output,
    branch: branchResult.current,
    upstream: branchResult.upstream,
    remote: remoteResult.output !== 'none' ? remoteResult.output : null,
    clean: statusResult.clean,
    status: statusResult,
  };
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith('git-mcp.mjs')) {
  const command = process.argv[2] || 'info';

  let result;
  switch (command) {
    case 'status':
      result = status();
      break;
    case 'diff':
      result = diff(process.argv.includes('--staged'));
      break;
    case 'branch':
      result = branch();
      break;
    case 'log':
      result = log(parseInt(process.argv[3]) || 10, process.argv[4] || 'oneline');
      break;
    case 'show':
      result = show(process.argv[3] || 'HEAD');
      break;
    case 'info':
    default:
      result = info();
  }

  console.log(JSON.stringify(result, null, 2));
}
