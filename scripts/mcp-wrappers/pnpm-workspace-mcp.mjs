#!/usr/bin/env node
/**
 * pnpm Workspace MCP Wrapper
 * Sprint: SPRINT-CLAUDE-OS-SESSION-ENFORCEMENT-110A
 *
 * Provides MCP-style interface to pnpm workspace:
 * - getAffectedPackages(changedFiles)
 * - dependencyGraph()
 * - runInWorkspace(workspace, command)
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';

const ROOT = process.cwd();

/**
 * Get workspace configuration
 */
function getWorkspaces() {
  const packageJsonPath = path.join(ROOT, 'package.json');
  const pnpmWorkspacePath = path.join(ROOT, 'pnpm-workspace.yaml');

  const workspaces = [];

  // Check pnpm-workspace.yaml
  if (existsSync(pnpmWorkspacePath)) {
    const content = readFileSync(pnpmWorkspacePath, 'utf8');
    const patterns = content.match(/- ['"]?([^'"]+)['"]?/g) || [];
    for (const pattern of patterns) {
      const cleaned = pattern.replace(/^- ['"]?/, '').replace(/['"]?$/, '');
      workspaces.push(cleaned);
    }
  }

  // Check package.json workspaces
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      if (pkg.workspaces) {
        workspaces.push(...(Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces.packages || []));
      }
    } catch {}
  }

  return [...new Set(workspaces)];
}

/**
 * Get all workspace packages
 */
export function listPackages() {
  try {
    const result = execSync('pnpm list -r --json --depth 0', {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });

    const packages = JSON.parse(result);
    return {
      success: true,
      packages: packages.map(p => ({
        name: p.name,
        version: p.version,
        path: p.path,
        private: p.private,
      })),
    };
  } catch (error) {
    // Fallback: scan directories
    const workspacePatterns = getWorkspaces();
    const packages = [];

    for (const pattern of workspacePatterns) {
      const baseDir = pattern.replace('/*', '').replace('/**', '');
      const fullPath = path.join(ROOT, baseDir);

      if (existsSync(fullPath)) {
        const dirs = readdirSync(fullPath, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name);

        for (const dir of dirs) {
          const pkgPath = path.join(fullPath, dir, 'package.json');
          if (existsSync(pkgPath)) {
            try {
              const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
              packages.push({
                name: pkg.name,
                version: pkg.version,
                path: path.join(fullPath, dir),
                private: pkg.private,
              });
            } catch {}
          }
        }
      }
    }

    return { success: true, packages, fallback: true };
  }
}

/**
 * Get affected packages based on changed files
 * @param {string[]} changedFiles - List of changed file paths
 */
export function getAffectedPackages(changedFiles = []) {
  const packages = listPackages();
  if (!packages.success) return packages;

  const affectedSet = new Set();
  const fileToPackage = {};

  for (const file of changedFiles) {
    const normalizedFile = file.replace(/\\/g, '/');

    for (const pkg of packages.packages) {
      const pkgRelPath = path.relative(ROOT, pkg.path).replace(/\\/g, '/');

      if (normalizedFile.startsWith(pkgRelPath + '/') || normalizedFile === pkgRelPath) {
        affectedSet.add(pkg.name);
        fileToPackage[file] = pkg.name;
      }
    }

    // Check root-level files
    if (!fileToPackage[file]) {
      if (normalizedFile.startsWith('scripts/') || normalizedFile.startsWith('docs/')) {
        affectedSet.add('@root');
        fileToPackage[file] = '@root';
      }
    }
  }

  // Get dependencies of affected packages
  const dependents = getDependents(Array.from(affectedSet));

  return {
    success: true,
    directlyAffected: Array.from(affectedSet),
    potentiallyAffected: dependents,
    fileToPackage,
    totalAffected: new Set([...affectedSet, ...dependents]).size,
  };
}

/**
 * Get dependency graph
 */
export function dependencyGraph() {
  const packages = listPackages();
  if (!packages.success) return packages;

  const graph = {};
  const reverseGraph = {};

  for (const pkg of packages.packages) {
    graph[pkg.name] = { dependencies: [], devDependencies: [], path: pkg.path };
    reverseGraph[pkg.name] = [];

    const pkgJsonPath = path.join(pkg.path, 'package.json');
    if (existsSync(pkgJsonPath)) {
      try {
        const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
        const deps = Object.keys(pkgJson.dependencies || {});
        const devDeps = Object.keys(pkgJson.devDependencies || {});

        // Filter to workspace packages only
        const workspacePackageNames = packages.packages.map(p => p.name);
        graph[pkg.name].dependencies = deps.filter(d => workspacePackageNames.includes(d));
        graph[pkg.name].devDependencies = devDeps.filter(d => workspacePackageNames.includes(d));
      } catch {}
    }
  }

  // Build reverse graph (dependents)
  for (const [pkgName, data] of Object.entries(graph)) {
    for (const dep of [...data.dependencies, ...data.devDependencies]) {
      if (!reverseGraph[dep]) reverseGraph[dep] = [];
      reverseGraph[dep].push(pkgName);
    }
  }

  return {
    success: true,
    packages: Object.keys(graph),
    graph,
    reverseGraph,
  };
}

/**
 * Get packages that depend on given packages
 */
export function getDependents(packageNames) {
  const graphResult = dependencyGraph();
  if (!graphResult.success) return [];

  const dependents = new Set();
  const queue = [...packageNames];
  const visited = new Set();

  while (queue.length > 0) {
    const pkg = queue.shift();
    if (visited.has(pkg)) continue;
    visited.add(pkg);

    const deps = graphResult.reverseGraph[pkg] || [];
    for (const dep of deps) {
      dependents.add(dep);
      queue.push(dep);
    }
  }

  return Array.from(dependents);
}

/**
 * Run command in specific workspace
 * @param {string} workspace - Workspace name
 * @param {string} command - Command to run
 */
export function runInWorkspace(workspace, command) {
  try {
    const result = execSync(`pnpm --filter ${workspace} ${command}`, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout };
  }
}

/**
 * Get workspace summary
 */
export function summary() {
  const packages = listPackages();
  const graph = dependencyGraph();

  if (!packages.success) return packages;

  const apps = packages.packages.filter(p => p.path.includes('/apps/'));
  const pkgs = packages.packages.filter(p => p.path.includes('/packages/'));

  return {
    success: true,
    totalPackages: packages.packages.length,
    apps: apps.map(a => a.name),
    packages: pkgs.map(p => p.name),
    workspacePatterns: getWorkspaces(),
  };
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith('pnpm-workspace-mcp.mjs')) {
  const command = process.argv[2] || 'summary';

  let result;
  switch (command) {
    case 'list':
      result = listPackages();
      break;
    case 'affected':
      const files = process.argv.slice(3);
      result = getAffectedPackages(files);
      break;
    case 'graph':
      result = dependencyGraph();
      break;
    case 'dependents':
      const pkgs = process.argv.slice(3);
      result = { success: true, dependents: getDependents(pkgs) };
      break;
    case 'run':
      const workspace = process.argv[3];
      const cmd = process.argv.slice(4).join(' ');
      result = runInWorkspace(workspace, cmd);
      break;
    case 'summary':
    default:
      result = summary();
  }

  console.log(JSON.stringify(result, null, 2));
}
