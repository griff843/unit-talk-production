#!/usr/bin/env node
/**
 * TypeScript LSP MCP Wrapper
 * Sprint: SPRINT-CLAUDE-OS-SESSION-ENFORCEMENT-110A
 *
 * Provides MCP-style interface to TypeScript:
 * - getDiagnostics()
 * - getCompilerOptions()
 * - summarizeErrors()
 *
 * Note: For IDE integration, use mcp__ide__getDiagnostics directly.
 * This wrapper provides fallback via tsc for non-IDE contexts.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';

const ROOT = process.cwd();

/**
 * Find all tsconfig files in the project
 */
function findTsConfigs() {
  const configs = [];

  // Check root
  if (existsSync(path.join(ROOT, 'tsconfig.json'))) {
    configs.push({ path: 'tsconfig.json', root: true });
  }

  // Check apps
  const appsDir = path.join(ROOT, 'apps');
  if (existsSync(appsDir)) {
    for (const app of readdirSync(appsDir, { withFileTypes: true })) {
      if (app.isDirectory()) {
        const tsconfig = path.join(appsDir, app.name, 'tsconfig.json');
        if (existsSync(tsconfig)) {
          configs.push({ path: `apps/${app.name}/tsconfig.json`, app: app.name });
        }
      }
    }
  }

  // Check packages
  const packagesDir = path.join(ROOT, 'packages');
  if (existsSync(packagesDir)) {
    for (const pkg of readdirSync(packagesDir, { withFileTypes: true })) {
      if (pkg.isDirectory()) {
        const tsconfig = path.join(packagesDir, pkg.name, 'tsconfig.json');
        if (existsSync(tsconfig)) {
          configs.push({ path: `packages/${pkg.name}/tsconfig.json`, package: pkg.name });
        }
      }
    }
  }

  return configs;
}

/**
 * Run tsc --noEmit and parse diagnostics
 * @param {string} tsconfigPath - Path to tsconfig.json
 */
function runTsc(tsconfigPath = 'tsconfig.json') {
  const fullPath = path.join(ROOT, tsconfigPath);
  if (!existsSync(fullPath)) {
    return { success: false, error: `tsconfig not found: ${tsconfigPath}` };
  }

  try {
    execSync(`npx tsc --noEmit -p ${tsconfigPath}`, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, errors: [], errorCount: 0 };
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    const errors = parseTscOutput(output);
    return {
      success: false,
      errors,
      errorCount: errors.length,
      raw: output,
    };
  }
}

/**
 * Parse tsc output into structured errors
 */
function parseTscOutput(output) {
  const errors = [];
  const lines = output.split('\n');

  const errorRegex = /^(.+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/;

  for (const line of lines) {
    const match = line.match(errorRegex);
    if (match) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        code: match[4],
        message: match[5],
      });
    }
  }

  return errors;
}

/**
 * Get diagnostics for the full workspace
 */
export function getDiagnostics(options = {}) {
  const { workspace = null, includeApps = true, includePackages = true } = options;

  const configs = findTsConfigs();
  const results = [];
  let totalErrors = 0;

  for (const config of configs) {
    // Filter by workspace if specified
    if (workspace) {
      if (config.app !== workspace && config.package !== workspace) {
        continue;
      }
    }

    // Filter by type
    if (!includeApps && config.app) continue;
    if (!includePackages && config.package) continue;

    const result = runTsc(config.path);
    results.push({
      config: config.path,
      workspace: config.app || config.package || 'root',
      ...result,
    });

    if (result.errorCount) {
      totalErrors += result.errorCount;
    }
  }

  return {
    success: true,
    totalErrors,
    configsChecked: results.length,
    results,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Summarize errors by code/type
 */
export function summarizeErrors(diagnostics) {
  const errorsByCode = {};
  const errorsByFile = {};

  for (const result of diagnostics.results) {
    if (!result.errors) continue;

    for (const error of result.errors) {
      // By code
      if (!errorsByCode[error.code]) {
        errorsByCode[error.code] = { count: 0, message: error.message, examples: [] };
      }
      errorsByCode[error.code].count++;
      if (errorsByCode[error.code].examples.length < 3) {
        errorsByCode[error.code].examples.push({
          file: error.file,
          line: error.line,
        });
      }

      // By file
      const relFile = path.relative(ROOT, error.file);
      if (!errorsByFile[relFile]) {
        errorsByFile[relFile] = { count: 0, codes: new Set() };
      }
      errorsByFile[relFile].count++;
      errorsByFile[relFile].codes.add(error.code);
    }
  }

  // Convert sets to arrays for JSON
  for (const file in errorsByFile) {
    errorsByFile[file].codes = Array.from(errorsByFile[file].codes);
  }

  // Sort by count
  const sortedByCode = Object.entries(errorsByCode)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([code, data]) => ({ code, ...data }));

  const sortedByFile = Object.entries(errorsByFile)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([file, data]) => ({ file, ...data }));

  return {
    totalErrors: diagnostics.totalErrors,
    uniqueErrorCodes: Object.keys(errorsByCode).length,
    filesWithErrors: Object.keys(errorsByFile).length,
    byCode: sortedByCode,
    byFile: sortedByFile,
  };
}

/**
 * Get compiler options from tsconfig
 */
export function getCompilerOptions(tsconfigPath = 'tsconfig.json') {
  const fullPath = path.join(ROOT, tsconfigPath);
  if (!existsSync(fullPath)) {
    return { success: false, error: `tsconfig not found: ${tsconfigPath}` };
  }

  try {
    const content = readFileSync(fullPath, 'utf8');
    const config = JSON.parse(content);
    return {
      success: true,
      compilerOptions: config.compilerOptions || {},
      extends: config.extends,
      include: config.include,
      exclude: config.exclude,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Run full diagnostics and generate summary
 */
export async function runFullDiagnostics() {
  const diagnostics = getDiagnostics();
  const summary = summarizeErrors(diagnostics);

  return {
    success: true,
    timestamp: new Date().toISOString(),
    totalErrors: diagnostics.totalErrors,
    summary,
    workspaceResults: diagnostics.results.map(r => ({
      workspace: r.workspace,
      config: r.config,
      errorCount: r.errorCount,
      topErrors: r.errors?.slice(0, 5) || [],
    })),
  };
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith('typescript-lsp-mcp.mjs')) {
  const command = process.argv[2] || 'diagnostics';

  (async () => {
    let result;
    switch (command) {
      case 'diagnostics':
        result = await runFullDiagnostics();
        break;
      case 'configs':
        result = { success: true, configs: findTsConfigs() };
        break;
      case 'options':
        result = getCompilerOptions(process.argv[3] || 'tsconfig.json');
        break;
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }

    console.log(JSON.stringify(result, null, 2));
  })();
}
