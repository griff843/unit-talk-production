#!/usr/bin/env node
/**
 * Claude Session Baseline Script
 * Sprint: SPRINT-CLAUDE-OS-SESSION-ENFORCEMENT-110A
 *
 * This script MUST be run before any sprint or code modification.
 * It performs a comprehensive diagnostic sweep and generates baseline artifacts.
 *
 * Usage:
 *   node scripts/claude-session-baseline.mjs
 *   pnpm session:baseline
 *
 * Output:
 *   out/session-baseline/<timestamp>/baseline.json
 *   out/session-baseline/<timestamp>/baseline-summary.md
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const BASELINE_DIR = path.join(ROOT, 'out', 'session-baseline');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('');
  log(`${'═'.repeat(60)}`, 'cyan');
  log(`  ${title}`, 'bold');
  log(`${'═'.repeat(60)}`, 'cyan');
}

/**
 * Import MCP wrapper dynamically
 */
async function loadMcpWrapper(name) {
  const wrapperPath = path.join(ROOT, 'scripts', 'mcp-wrappers', `${name}.mjs`);
  if (!existsSync(wrapperPath)) {
    throw new Error(`MCP wrapper not found: ${name}`);
  }
  return await import(`file://${wrapperPath.replace(/\\/g, '/')}`);
}

/**
 * Run Git status and diff
 */
async function runGitBaseline() {
  logSection('GIT STATUS');

  const gitMcp = await loadMcpWrapper('git-mcp');
  const status = gitMcp.status();
  const diff = gitMcp.diff();
  const branch = gitMcp.branch();
  const recentCommits = gitMcp.log(5);

  if (status.clean) {
    log('  ✓ Working tree is clean', 'green');
  } else {
    log(`  ⚠ Working tree has changes:`, 'yellow');
    log(`    - Staged: ${status.staged}`, 'yellow');
    log(`    - Modified: ${status.modified}`, 'yellow');
    log(`    - Untracked: ${status.untracked}`, 'yellow');
  }

  log(`  Branch: ${branch.current}`, 'blue');

  return {
    status,
    diff,
    branch,
    recentCommits: recentCommits.commits,
    clean: status.clean,
  };
}

/**
 * Run TypeScript diagnostics
 */
async function runTypeScriptBaseline() {
  logSection('TYPESCRIPT DIAGNOSTICS');

  const tsMcp = await loadMcpWrapper('typescript-lsp-mcp');
  const diagnostics = await tsMcp.runFullDiagnostics();

  if (diagnostics.totalErrors === 0) {
    log('  ✓ No TypeScript errors', 'green');
  } else {
    log(`  ✗ ${diagnostics.totalErrors} TypeScript errors found`, 'red');

    // Show top error codes
    const topCodes = diagnostics.summary.byCode.slice(0, 5);
    for (const code of topCodes) {
      log(`    ${code.code}: ${code.count} occurrences`, 'red');
    }
  }

  return diagnostics;
}

/**
 * Run ESLint analysis
 */
async function runEslintBaseline() {
  logSection('ESLINT ANALYSIS');

  const eslintMcp = await loadMcpWrapper('eslint-mcp');
  const analysis = await eslintMcp.runFullAnalysis();

  if (!analysis.success) {
    log(`  ⚠ ESLint analysis failed: ${analysis.error}`, 'yellow');
    return { success: false, error: analysis.error };
  }

  const { totalErrors, totalWarnings } = analysis.summary;

  if (totalErrors === 0 && totalWarnings === 0) {
    log('  ✓ No ESLint issues', 'green');
  } else if (totalErrors === 0) {
    log(`  ⚠ ${totalWarnings} ESLint warnings`, 'yellow');
  } else {
    log(`  ✗ ${totalErrors} errors, ${totalWarnings} warnings`, 'red');

    // Show top rules
    const topRules = analysis.byRule.ruleBreakdown.slice(0, 5);
    for (const rule of topRules) {
      const severity = rule.severity === 'error' ? 'red' : 'yellow';
      log(`    ${rule.rule}: ${rule.count}`, severity);
    }
  }

  return analysis;
}

/**
 * Run workspace analysis
 */
async function runWorkspaceBaseline(gitStatus) {
  logSection('WORKSPACE ANALYSIS');

  const workspaceMcp = await loadMcpWrapper('pnpm-workspace-mcp');
  const summary = workspaceMcp.summary();

  log(`  Total packages: ${summary.totalPackages}`, 'blue');
  log(`  Apps: ${summary.apps.join(', ')}`, 'blue');

  // Get affected packages if there are changes
  let affected = null;
  if (!gitStatus.clean && gitStatus.status.files) {
    const changedFiles = gitStatus.status.files.map(f => f.file);
    affected = workspaceMcp.getAffectedPackages(changedFiles);

    if (affected.directlyAffected.length > 0) {
      log(`  ⚠ Affected packages: ${affected.directlyAffected.join(', ')}`, 'yellow');
    }
  }

  return { summary, affected };
}

/**
 * Run Supabase schema analysis
 */
async function runSupabaseBaseline() {
  logSection('SUPABASE SCHEMA');

  const supabaseMcp = await loadMcpWrapper('supabase-schema-mcp');
  const summary = supabaseMcp.summary();
  const hash = supabaseMcp.getSchemaHash();
  const drift = supabaseMcp.diffSchemaVsTypes();

  log(`  Schema hash: ${hash.hash}`, 'blue');
  log(`  Tables: ${summary.schema.tables}, Functions: ${summary.schema.functions}`, 'blue');
  log(`  Latest migration: ${summary.latestMigration}`, 'blue');

  if (drift.hasDrift === true) {
    log('  ✗ Schema drift detected!', 'red');
    if (drift.inSchemaNotTypes.length > 0) {
      log(`    Missing in types: ${drift.inSchemaNotTypes.join(', ')}`, 'red');
    }
    if (drift.inTypesNotSchema.length > 0) {
      log(`    Missing in schema: ${drift.inTypesNotSchema.join(', ')}`, 'yellow');
    }
  } else if (drift.typesStale) {
    log('  ⚠ Types file may be stale', 'yellow');
  } else if (drift.hasDrift === false) {
    log('  ✓ No schema drift', 'green');
  } else {
    log(`  ⚠ ${drift.reason}`, 'yellow');
  }

  return { summary, hash, drift };
}

/**
 * Generate baseline summary markdown
 */
function generateMarkdownSummary(baseline) {
  const { git, typescript, eslint, workspace, supabase, timestamp, status } = baseline;

  let md = `# Session Baseline Report

**Generated**: ${timestamp}
**Status**: ${status.overall}

---

## Summary

| Check | Status | Details |
|-------|--------|---------|
| Git | ${git.clean ? '✅ Clean' : '⚠️ Dirty'} | ${git.branch.current} |
| TypeScript | ${typescript.totalErrors === 0 ? '✅ Pass' : `❌ ${typescript.totalErrors} errors`} | ${typescript.summary?.uniqueErrorCodes || 0} unique codes |
| ESLint | ${eslint.success && eslint.summary?.totalErrors === 0 ? '✅ Pass' : `❌ ${eslint.summary?.totalErrors || 0} errors`} | ${eslint.summary?.totalWarnings || 0} warnings |
| Supabase | ${supabase.drift.hasDrift === false ? '✅ Synced' : supabase.drift.hasDrift === true ? '❌ Drift' : '⚠️ Unknown'} | Hash: ${supabase.hash.hash} |

---

## Git Status

- **Branch**: ${git.branch.current}
- **Clean**: ${git.clean}
`;

  if (!git.clean) {
    md += `- **Changes**:
  - Staged: ${git.status.staged}
  - Modified: ${git.status.modified}
  - Untracked: ${git.status.untracked}
`;
  }

  md += `
---

## TypeScript Diagnostics

- **Total Errors**: ${typescript.totalErrors}
- **Configs Checked**: ${typescript.workspaceResults?.length || 0}

`;

  if (typescript.totalErrors > 0 && typescript.summary?.byCode) {
    md += `### Top Error Codes

| Code | Count | Example |
|------|-------|---------|
`;
    for (const code of typescript.summary.byCode.slice(0, 10)) {
      const example = code.examples?.[0];
      md += `| ${code.code} | ${code.count} | ${example ? `${example.file}:${example.line}` : ''} |\n`;
    }
  }

  md += `
---

## ESLint Analysis

- **Total Errors**: ${eslint.summary?.totalErrors || 0}
- **Total Warnings**: ${eslint.summary?.totalWarnings || 0}
- **Files with Issues**: ${eslint.byFile?.filesWithIssues || 0}

`;

  if (eslint.byRule?.ruleBreakdown?.length > 0) {
    md += `### Top Rules

| Rule | Count | Severity |
|------|-------|----------|
`;
    for (const rule of eslint.byRule.ruleBreakdown.slice(0, 10)) {
      md += `| ${rule.rule} | ${rule.count} | ${rule.severity} |\n`;
    }
  }

  md += `
---

## Workspace Analysis

- **Total Packages**: ${workspace.summary.totalPackages}
- **Apps**: ${workspace.summary.apps.join(', ')}

`;

  if (workspace.affected?.directlyAffected?.length > 0) {
    md += `### Affected Packages

${workspace.affected.directlyAffected.map(p => `- ${p}`).join('\n')}
`;
  }

  md += `
---

## Supabase Schema

- **Hash**: ${supabase.hash.hash}
- **Tables**: ${supabase.summary.schema.tables}
- **Functions**: ${supabase.summary.schema.functions}
- **Latest Migration**: ${supabase.summary.latestMigration}
- **Schema Drift**: ${supabase.drift.hasDrift === false ? 'None' : supabase.drift.hasDrift === true ? 'DETECTED' : 'Unknown'}

`;

  if (supabase.drift.hasDrift === true) {
    md += `### Drift Details

- In schema but not types: ${supabase.drift.inSchemaNotTypes?.join(', ') || 'none'}
- In types but not schema: ${supabase.drift.inTypesNotSchema?.join(', ') || 'none'}

**Recommendation**: ${supabase.drift.recommendation}
`;
  }

  md += `
---

## Sprint Readiness

`;

  const blockers = [];

  if (!git.clean) {
    blockers.push('- ⚠️ Working tree is dirty. Commit or stash changes before sprint.');
  }
  if (typescript.totalErrors > 0) {
    blockers.push(`- ❌ ${typescript.totalErrors} TypeScript errors must be addressed.`);
  }
  if (eslint.summary?.totalErrors > 0) {
    blockers.push(`- ❌ ${eslint.summary.totalErrors} ESLint errors should be reviewed.`);
  }
  if (supabase.drift.hasDrift === true) {
    blockers.push('- ❌ Schema drift detected. Regenerate types before proceeding.');
  }

  if (blockers.length === 0) {
    md += `✅ **Ready to begin sprint.**\n`;
  } else {
    md += `### Blockers

${blockers.join('\n')}

**Status**: NOT READY - Address blockers before proceeding.
`;
  }

  return md;
}

/**
 * Main baseline function
 */
async function runBaseline() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputDir = path.join(BASELINE_DIR, timestamp);

  log('\n' + '═'.repeat(60), 'cyan');
  log('  CLAUDE SESSION BASELINE', 'bold');
  log('  Sprint: SPRINT-CLAUDE-OS-SESSION-ENFORCEMENT-110A', 'blue');
  log('═'.repeat(60), 'cyan');
  log(`\nTimestamp: ${timestamp}`);

  // Create output directory
  mkdirSync(outputDir, { recursive: true });

  const results = {
    timestamp: new Date().toISOString(),
    outputDir,
    status: {
      overall: 'unknown',
      git: 'unknown',
      typescript: 'unknown',
      eslint: 'unknown',
      supabase: 'unknown',
    },
  };

  try {
    // 1. Git status
    results.git = await runGitBaseline();
    results.status.git = results.git.clean ? 'pass' : 'warn';

    // 2. TypeScript diagnostics
    results.typescript = await runTypeScriptBaseline();
    results.status.typescript = results.typescript.totalErrors === 0 ? 'pass' : 'fail';

    // 3. ESLint analysis
    results.eslint = await runEslintBaseline();
    results.status.eslint = results.eslint.success && results.eslint.summary?.totalErrors === 0 ? 'pass' : 'fail';

    // 4. Workspace analysis
    results.workspace = await runWorkspaceBaseline(results.git);

    // 5. Supabase schema
    results.supabase = await runSupabaseBaseline();
    results.status.supabase = results.supabase.drift.hasDrift === false ? 'pass' : results.supabase.drift.hasDrift === true ? 'fail' : 'warn';

    // Determine overall status
    const statuses = Object.values(results.status).filter(s => s !== 'unknown');
    if (statuses.includes('fail')) {
      results.status.overall = 'fail';
    } else if (statuses.includes('warn')) {
      results.status.overall = 'warn';
    } else {
      results.status.overall = 'pass';
    }

    // Write JSON output
    const jsonPath = path.join(outputDir, 'baseline.json');
    writeFileSync(jsonPath, JSON.stringify(results, null, 2));

    // Write markdown summary
    const mdPath = path.join(outputDir, 'baseline-summary.md');
    const markdown = generateMarkdownSummary(results);
    writeFileSync(mdPath, markdown);

    // Print final summary
    logSection('BASELINE COMPLETE');
    log(`  Status: ${results.status.overall.toUpperCase()}`, results.status.overall === 'pass' ? 'green' : results.status.overall === 'warn' ? 'yellow' : 'red');
    log(`  Output: ${outputDir}`, 'blue');
    log('');

    // Return results for programmatic use
    return results;

  } catch (error) {
    log(`\n  ✗ Baseline failed: ${error.message}`, 'red');
    console.error(error);
    results.status.overall = 'error';
    results.error = error.message;

    // Still write what we have
    const jsonPath = path.join(outputDir, 'baseline.json');
    writeFileSync(jsonPath, JSON.stringify(results, null, 2));

    process.exit(1);
  }
}

// CLI entry point
runBaseline().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
