/**
 * Load environment variables from repository root
 * Works regardless of current working directory
 *
 * Call this at the very top of any entrypoint BEFORE importing anything that reads env
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, join, dirname } from 'path';

import { config } from 'dotenv';

let envLoaded = false;

/**
 * Find repository root by walking up directories until we find root package.json
 */
function findRepoRoot(startDir: string = __dirname): string {
  let currentDir = startDir;

  // Walk up max 10 levels to prevent infinite loops
  for (let i = 0; i < 10; i++) {
    const packageJsonPath = join(currentDir, 'package.json');

    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

        // Root package.json has "workspaces" field in monorepo
        if (packageJson.workspaces || packageJson.name === 'unit-talk-platform') {
          return currentDir;
        }
      } catch (err) {
        // Invalid JSON, keep searching
      }
    }

    const parentDir = dirname(currentDir);

    // Reached filesystem root
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  // Fallback: assume we're somewhere in repo, go up 4 levels from shared-utils
  // packages/shared-utils/src/loadRootEnv.ts -> ../../../../
  return resolve(__dirname, '../../../../');
}

/**
 * Load environment variables from repo root .env and .env.shared
 * Idempotent - safe to call multiple times
 */
export function loadRootEnv(): void {
  if (envLoaded) {
    return; // Already loaded, skip
  }

  const repoRoot = findRepoRoot();

  // Load .env.shared first (lower priority)
  const sharedEnvPath = join(repoRoot, '.env.shared');
  if (existsSync(sharedEnvPath)) {
    config({ path: sharedEnvPath });
  }

  // Load .env (higher priority, overrides .env.shared)
  const mainEnvPath = join(repoRoot, '.env');
  if (existsSync(mainEnvPath)) {
    config({ path: mainEnvPath, override: true });
  }

  // Load .env.canary (highest priority, for CANARY testing mode)
  // This allows safe production testing without modifying .env
  const canaryEnvPath = join(repoRoot, '.env.canary');
  if (existsSync(canaryEnvPath)) {
    config({ path: canaryEnvPath, override: true });
  }

  envLoaded = true;

  // Debug log in non-production (check current NODE_ENV after all loads)
  if (process.env['NODE_ENV'] !== 'production') {
    const sharedExists = existsSync(sharedEnvPath) ? '✓' : '✗';
    const mainExists = existsSync(mainEnvPath) ? '✓' : '✗';
    const canaryExists = existsSync(canaryEnvPath) ? '✓' : '✗';
    console.log(`[loadRootEnv] Loaded from ${repoRoot}`);
    console.log(`[loadRootEnv]   .env.shared ${sharedExists}`);
    console.log(`[loadRootEnv]   .env ${mainExists}`);
    console.log(`[loadRootEnv]   .env.canary ${canaryExists}`);
  }
}

// Auto-load when this module is imported (unless explicitly disabled)
if (process.env['DISABLE_AUTO_ENV_LOAD'] !== 'true') {
  loadRootEnv();
}
