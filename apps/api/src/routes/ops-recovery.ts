/**
 * Operator Recovery Routes — Incident Recovery via Replay
 * Sprint: SPRINT-044-LAYER2-PHASE8-RECOVERY-REPLAY
 * Layer/Phase: Layer 2 / Phase 8 — Recovery & Replay
 *
 * POST /ops/recovery/replay  → run deterministic replay from a journal file
 * GET  /ops/recovery/replays → list recent replay proof bundles
 *
 * Auth: adminAuth (Bearer admin-* token)
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';

import express, { Router } from 'express';

import {
  JournalEventStore,
  NullNotificationAdapter,
  RecordingPublishAdapter,
  RecordingRecapAdapter,
  ReplayFeedAdapter,
  ReplayOrchestrator,
  ReplayProofWriter,
  ReplaySettlementAdapter,
  VirtualEventClock,
} from '../lib/verification';
import { createLogger } from '../utils/logger';

const logger = createLogger('OpsRecovery');
const router: Router = express.Router();

// Repo root — route file is at apps/api/src/routes/, repo root is 4 levels up
const REPO_ROOT = resolve(__dirname, '../../../..');

// Auth middleware — same pattern as ops-control.ts
const adminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (process.env.NODE_ENV === 'test' && req.headers['x-e2e-test'] === 'true') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer admin-')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Admin access required',
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

router.use(adminAuth);

/**
 * POST /ops/recovery/replay
 *
 * Trigger a deterministic replay from a production event journal.
 * Writes a proof bundle to out/replay-runs/<replayId>/.
 *
 * Body: {
 *   journalPath: string,          // Absolute path to .jsonl journal file
 *   eventWindow: { from: string, to: string }  // ISO 8601 date strings
 * }
 *
 * Returns: { replayId, divergences, proofPath, status: "PASS" | "FAIL" }
 */
router.post('/recovery/replay', async (req, res) => {
  const { journalPath, eventWindow } = req.body as {
    journalPath?: unknown;
    eventWindow?: { from?: unknown; to?: unknown };
  };

  // ── Input validation ──────────────────────────────────────
  if (!journalPath || typeof journalPath !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'journalPath is required and must be a string',
      timestamp: new Date().toISOString(),
    });
  }

  if (!eventWindow || typeof eventWindow !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'eventWindow is required with from and to ISO date strings',
      timestamp: new Date().toISOString(),
    });
  }

  const fromStr = eventWindow.from;
  const toStr = eventWindow.to;

  if (!fromStr || typeof fromStr !== 'string' || !toStr || typeof toStr !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'eventWindow.from and eventWindow.to must be ISO 8601 date strings',
      timestamp: new Date().toISOString(),
    });
  }

  const fromDate = new Date(fromStr);
  const toDate = new Date(toStr);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return res.status(400).json({
      success: false,
      error: 'eventWindow.from and eventWindow.to must be valid ISO 8601 date strings',
      timestamp: new Date().toISOString(),
    });
  }

  if (fromDate >= toDate) {
    return res.status(400).json({
      success: false,
      error: 'eventWindow.from must be before eventWindow.to',
      timestamp: new Date().toISOString(),
    });
  }

  if (!existsSync(journalPath)) {
    return res.status(404).json({
      success: false,
      error: `Journal file not found: ${journalPath}`,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Replay execution ──────────────────────────────────────
  const replayId = `replay-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;

  try {
    logger.info('Starting incident recovery replay', {
      replayId,
      journalPath,
      from: fromStr,
      to: toStr,
    });

    // Load events from production journal
    const store = JournalEventStore.loadFromFile(journalPath);

    // Initialize VirtualEventClock at window start (1 min buffer)
    const clockStart = new Date(fromDate.getTime() - 60_000);
    const clock = new VirtualEventClock(clockStart);

    // Build non-production adapter manifest (replay mode)
    const adapters = {
      mode: 'replay' as const,
      publish: new RecordingPublishAdapter('replay'),
      notification: new NullNotificationAdapter('replay'),
      feed: new ReplayFeedAdapter('replay', store),
      settlement: new ReplaySettlementAdapter('replay', store),
      recap: new RecordingRecapAdapter('replay'),
    };

    // Run orchestrator
    const orchestrator = new ReplayOrchestrator({
      runId: replayId,
      eventStore: store,
      clock,
      adapters,
      from: fromDate,
      to: toDate,
    });

    const result = await orchestrator.run();

    // Write proof bundle
    const writer = new ReplayProofWriter(REPO_ROOT);
    const events = store.getEventsBetween(fromDate, toDate);
    const proofPath = writer.write(result, [...events]);

    const divergences = result.errors.length;
    const status: 'PASS' | 'FAIL' = divergences === 0 ? 'PASS' : 'FAIL';

    logger.info('Incident recovery replay complete', {
      replayId,
      eventsProcessed: result.eventsProcessed,
      divergences,
      status,
      proofPath,
    });

    return res.json({
      success: true,
      data: {
        replayId,
        divergences,
        proofPath,
        status,
        eventsProcessed: result.eventsProcessed,
        durationMs: result.durationMs,
        determinismHash: result.determinismHash,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Incident recovery replay failed', {
      replayId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return res.status(500).json({
      success: false,
      error: `Replay failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      replayId,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /ops/recovery/replays
 *
 * List recent replay proof bundles from out/replay-runs/.
 * Returns runs sorted by most recent first (up to 20).
 */
router.get('/recovery/replays', (_req, res) => {
  try {
    const replaysDir = resolve(REPO_ROOT, 'out', 'replay-runs');

    if (!existsSync(replaysDir)) {
      return res.json({
        success: true,
        data: { runs: [], total: 0 },
        timestamp: new Date().toISOString(),
      });
    }

    const entries = readdirSync(replaysDir)
      .map(name => {
        const fullPath = resolve(replaysDir, name);
        try {
          const stat = statSync(fullPath);
          return { name, path: fullPath, mtime: stat.mtime };
        } catch {
          return null;
        }
      })
      .filter((e): e is { name: string; path: string; mtime: Date } => e !== null)
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .slice(0, 20);

    const runs = entries.map(e => ({
      replayId: e.name,
      proofPath: e.path,
      ranAt: e.mtime.toISOString(),
    }));

    return res.json({
      success: true,
      data: { runs, total: runs.length },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to list replay runs', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to list replay runs',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
