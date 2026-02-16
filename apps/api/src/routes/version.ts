/**
 * Version Endpoint
 *
 * PHASE-2-PRODUCTION-READINESS-019: System Reconciliation
 * Provides canonical build/version info for runtime verification
 */

import { Router } from 'express';
import { getBuildInfo } from '../lib/buildInfo';

const router = Router();

/**
 * GET /version
 * Returns build information for runtime verification
 */
router.get('/', (_req, res) => {
  const buildInfo = getBuildInfo('api');

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({
    service: buildInfo.service,
    branch: buildInfo.branch,
    commit: buildInfo.commitShort,
    commitFull: buildInfo.commit,
    buildTime: buildInfo.buildTime,
    nodeVersion: buildInfo.nodeVersion,
    environment: buildInfo.environment,
    timestamp: new Date().toISOString(),
  });
});

export default router;
