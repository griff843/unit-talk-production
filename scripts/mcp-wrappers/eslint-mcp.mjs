#!/usr/bin/env node
/**
 * ESLint MCP Wrapper
 * Sprint: SPRINT-CLAUDE-OS-SESSION-ENFORCEMENT-110A
 *
 * Provides MCP-style interface to ESLint:
 * - lint(files)
 * - lintAndFix(files)
 * - summarizeByRule()
 * - summarizeByFile()
 */

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

const ROOT = process.cwd();

/**
 * Run ESLint on specified files/patterns
 * @param {string[]} files - Files or patterns to lint
 * @param {boolean} fix - Whether to auto-fix
 * @returns {object} Lint results
 */
export async function lint(files = ['.'], fix = false) {
  const args = [
    'eslint',
    ...files,
    '--format', 'json',
    '--no-error-on-unmatched-pattern',
  ];

  if (fix) {
    args.push('--fix');
  }

  try {
    const result = execSync(`npx ${args.join(' ')}`, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(result || '[]');
  } catch (error) {
    // ESLint exits with code 1 when there are errors
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout);
      } catch {
        return { error: 'Failed to parse ESLint output', raw: error.stdout };
      }
    }
    return { error: error.message };
  }
}

/**
 * Lint and fix files
 * @param {string[]} files - Files to lint and fix
 */
export async function lintAndFix(files = ['.']) {
  return lint(files, true);
}

/**
 * Summarize lint results by rule
 * @param {object[]} results - ESLint results array
 * @returns {object} Summary by rule
 */
export function summarizeByRule(results) {
  const ruleCounts = {};
  const ruleExamples = {};

  for (const file of results) {
    if (!file.messages) continue;
    for (const msg of file.messages) {
      const rule = msg.ruleId || 'unknown';
      ruleCounts[rule] = (ruleCounts[rule] || 0) + 1;
      if (!ruleExamples[rule]) {
        ruleExamples[rule] = {
          file: file.filePath,
          line: msg.line,
          message: msg.message,
          severity: msg.severity === 2 ? 'error' : 'warning',
        };
      }
    }
  }

  // Sort by count descending
  const sorted = Object.entries(ruleCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([rule, count]) => ({
      rule,
      count,
      severity: ruleExamples[rule]?.severity || 'unknown',
      example: ruleExamples[rule],
    }));

  const totalErrors = sorted.filter(r => r.severity === 'error').reduce((a, r) => a + r.count, 0);
  const totalWarnings = sorted.filter(r => r.severity === 'warning').reduce((a, r) => a + r.count, 0);

  return {
    totalErrors,
    totalWarnings,
    totalIssues: totalErrors + totalWarnings,
    ruleBreakdown: sorted,
  };
}

/**
 * Summarize lint results by file
 * @param {object[]} results - ESLint results array
 * @returns {object} Summary by file
 */
export function summarizeByFile(results) {
  const fileSummaries = results
    .filter(f => f.errorCount > 0 || f.warningCount > 0)
    .map(f => ({
      file: path.relative(ROOT, f.filePath),
      errors: f.errorCount,
      warnings: f.warningCount,
      total: f.errorCount + f.warningCount,
      fixable: f.fixableErrorCount + f.fixableWarningCount,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    filesWithIssues: fileSummaries.length,
    totalFiles: results.length,
    summary: fileSummaries.slice(0, 20), // Top 20 files
  };
}

/**
 * Run full ESLint analysis and return comprehensive summary
 */
export async function runFullAnalysis(patterns = ['apps/', 'packages/', 'scripts/']) {
  const results = await lint(patterns);

  if (results.error) {
    return { success: false, error: results.error };
  }

  const byRule = summarizeByRule(results);
  const byFile = summarizeByFile(results);

  return {
    success: true,
    timestamp: new Date().toISOString(),
    summary: {
      totalErrors: byRule.totalErrors,
      totalWarnings: byRule.totalWarnings,
      filesWithIssues: byFile.filesWithIssues,
      totalFilesScanned: byFile.totalFiles,
    },
    byRule,
    byFile,
  };
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith('eslint-mcp.mjs')) {
  const command = process.argv[2] || 'analyze';

  (async () => {
    switch (command) {
      case 'analyze':
        const analysis = await runFullAnalysis();
        console.log(JSON.stringify(analysis, null, 2));
        break;
      case 'lint':
        const files = process.argv.slice(3);
        const result = await lint(files.length ? files : ['.']);
        console.log(JSON.stringify(result, null, 2));
        break;
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  })();
}
