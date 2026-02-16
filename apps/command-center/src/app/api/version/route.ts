/**
 * Command Center Version Endpoint
 *
 * PHASE-2-PRODUCTION-READINESS-019: System Reconciliation
 * Provides canonical build/version info for runtime verification
 */

import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

function getGitInfo() {
  try {
    const commit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    const commitShort = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    return { commit, commitShort, branch };
  } catch {
    return {
      commit: process.env.GIT_COMMIT || 'unknown',
      commitShort: process.env.GIT_COMMIT_SHORT || 'unknown',
      branch: process.env.GIT_BRANCH || 'unknown',
    };
  }
}

export async function GET() {
  const gitInfo = getGitInfo();

  const versionInfo = {
    service: 'command-center',
    branch: gitInfo.branch,
    commit: gitInfo.commitShort,
    commitFull: gitInfo.commit,
    buildTime: process.env.BUILD_TIME || new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(versionInfo, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
