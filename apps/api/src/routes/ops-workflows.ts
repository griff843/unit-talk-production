/**
 * Operator Workflow Discovery Routes
 *
 * SPRINT-052-LAYER3-PHASE11-OPERATOR-WORKFLOW-FOUNDATION
 * Layer/Phase: Layer 3 / Phase 11 — Workflow Optimization
 *
 * GET /ops/workflows          → list all registered workflows (optional ?category= filter)
 * GET /ops/workflows/:name    → get a single workflow by name
 *
 * Auth: operatorAuth (JWT)
 * Audit: operatorAuditLog (read operations logged for traceability)
 */

import { type IRouter, Router } from 'express';

import {
  findWorkflow,
  getAllWorkflows,
  getCategories,
  getCategoryCounts,
  getWorkflowsByCategory,
} from '../lib/workflow-registry';
import { operatorAuditLog } from '../middleware/operatorAuditLog';
import { operatorAuth } from '../middleware/operatorAuth';
import { createLogger } from '../utils/logger';

import type { WorkflowCategory } from '../lib/workflow-registry';

const router: IRouter = Router();
const logger = createLogger('ops-workflows');

// Auth + audit for all workflow routes
router.use('/workflows', operatorAuth, operatorAuditLog);

/**
 * GET /ops/workflows
 * Returns the workflow registry, optionally filtered by category.
 *
 * Query params:
 *   category — filter by category (analysis | backfill | feed | health | settlement | ops)
 */
router.get('/workflows', (req, res) => {
  try {
    const { category } = req.query;

    const workflows =
      category && typeof category === 'string'
        ? getWorkflowsByCategory(category as WorkflowCategory)
        : getAllWorkflows();

    const categories = getCategories();
    const counts = getCategoryCounts();

    logger.info('Workflow registry queried', {
      filter: category ?? 'all',
      returned: workflows.length,
    });

    return res.json({
      workflows,
      meta: {
        total: getAllWorkflows().length,
        returned: workflows.length,
        categories,
        categoryCounts: counts,
      },
    });
  } catch (err) {
    logger.error('Failed to list workflows', { error: err });
    return res.status(500).json({ error: 'Failed to retrieve workflow registry' });
  }
});

/**
 * GET /ops/workflows/:name
 * Returns a single workflow entry by name.
 */
router.get('/workflows/:name', (req, res) => {
  try {
    const { name } = req.params;
    const workflow = findWorkflow(name);

    if (!workflow) {
      return res.status(404).json({
        error: `Workflow '${name}' not found`,
        availableNames: getAllWorkflows().map(w => w.name),
      });
    }

    return res.json({ workflow });
  } catch (err) {
    logger.error('Failed to get workflow', { name: req.params.name, error: err });
    return res.status(500).json({ error: 'Failed to retrieve workflow' });
  }
});

export default router;
