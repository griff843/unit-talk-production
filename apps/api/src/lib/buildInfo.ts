/**
 * Build Information Service
 *
 * Provides centralized build metadata for /version endpoints,
 * embed footers, and runtime verification.
 *
 * PHASE-2-PRODUCTION-READINESS-019: System Reconciliation
 */

import { execSync } from 'child_process';

export interface BuildInfo {
  service: string;
  branch: string;
  commit: string;
  commitShort: string;
  buildTime: string;
  nodeVersion: string;
  environment: string;
}

let cachedBuildInfo: BuildInfo | null = null;

/**
 * Get git commit SHA
 */
function getGitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return process.env.GIT_COMMIT || 'unknown';
  }
}

/**
 * Get git short SHA
 */
function getGitCommitShort(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return process.env.GIT_COMMIT_SHORT || 'unknown';
  }
}

/**
 * Get git branch
 */
function getGitBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return process.env.GIT_BRANCH || 'unknown';
  }
}

/**
 * Get build information for a service
 */
export function getBuildInfo(serviceName: string): BuildInfo {
  if (cachedBuildInfo && cachedBuildInfo.service === serviceName) {
    return cachedBuildInfo;
  }

  const buildInfo: BuildInfo = {
    service: serviceName,
    branch: getGitBranch(),
    commit: getGitCommit(),
    commitShort: getGitCommitShort(),
    buildTime: process.env.BUILD_TIME || new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
  };

  cachedBuildInfo = buildInfo;
  return buildInfo;
}

/**
 * Format build info for embed footer
 * Format: build:<shortsha> | env:<env> | run:<gauntlet_id>
 */
export function formatEmbedFooter(buildInfo: BuildInfo, gauntletRunId?: string): string {
  const parts = [`build:${buildInfo.commitShort}`, `env:${buildInfo.environment}`];

  if (gauntletRunId) {
    parts.push(`run:${gauntletRunId}`);
  }

  return parts.join(' | ');
}

/**
 * Validate that build info matches running commit
 * Used in gauntlet verification
 */
export function validateBuildInfo(expected: Partial<BuildInfo>): boolean {
  const actual = getBuildInfo('validator');

  if (expected.commit && expected.commit !== actual.commit) {
    return false;
  }

  if (expected.branch && expected.branch !== actual.branch) {
    return false;
  }

  return true;
}

export default {
  getBuildInfo,
  formatEmbedFooter,
  validateBuildInfo,
};
