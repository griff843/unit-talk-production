/**
 * Publisher Worker
 *
 * Polls and processes pending outbox publish jobs with:
 * - 10-second polling interval with jitter
 * - Graceful shutdown
 * - Health status tracking
 * - Controlled by PUBLISHER_ENABLED env var
 */

import { logger } from '../shared/logger';
import { OutboxPublisher } from './outbox-publisher';
import { getCircuitBreaker } from './circuit-breaker';

let isRunning = false;
let intervalHandle: NodeJS.Timeout | null = null;
const publisher = new OutboxPublisher();

/**
 * Start publisher loop
 *
 * Polls every ~10 seconds (with 0-2s jitter) and processes pending jobs
 */
export function startPublisherLoop(): void {
  if (isRunning) {
    logger.warn('Publisher loop already running', {
      event: 'publisher_already_running',
    });
    return;
  }

  const enabled = process.env.PUBLISHER_ENABLED !== 'false';

  if (!enabled) {
    logger.info('Publisher loop disabled', {
      event: 'publisher_disabled',
      reason: 'PUBLISHER_ENABLED=false',
    });
    return;
  }

  isRunning = true;

  logger.info('Starting publisher loop', {
    event: 'publisher_loop_start',
    interval: '10s with 0-2s jitter',
  });

  // Immediate first run
  runOnce();

  // Schedule recurring runs
  scheduleNext();
}

/**
 * Stop publisher loop
 */
export function stopPublisherLoop(): void {
  if (!isRunning) {
    return;
  }

  isRunning = false;

  if (intervalHandle) {
    clearTimeout(intervalHandle);
    intervalHandle = null;
  }

  logger.info('Publisher loop stopped', {
    event: 'publisher_loop_stop',
  });
}

/**
 * Run publisher once
 */
async function runOnce(): Promise<void> {
  if (!isRunning) {
    return;
  }

  try {
    const processed = await publisher.runPending(50);

    if (processed > 0) {
      logger.info('Publisher cycle complete', {
        event: 'publisher_cycle',
        processed,
      });
    }
  } catch (error) {
    logger.error('Publisher cycle error', {
      event: 'publisher_cycle_error',
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    // Schedule next run if still running
    if (isRunning) {
      scheduleNext();
    }
  }
}

/**
 * Schedule next publisher run with jitter
 */
function scheduleNext(): void {
  // Base interval: 10 seconds
  // Jitter: 0-2 seconds
  const baseInterval = 10_000;
  const jitter = Math.random() * 2_000;
  const delay = baseInterval + jitter;

  intervalHandle = setTimeout(runOnce, delay);
}

/**
 * Get publisher status for health checks
 */
export function getPublisherStatus(): {
  enabled: boolean;
  running: boolean;
  mode: string;
  circuitBreaker: any;
} {
  const cb = getCircuitBreaker();

  return {
    enabled: process.env.PUBLISHER_ENABLED !== 'false',
    running: isRunning,
    mode: process.env.PUBLISH_MODE || 'outbox',
    circuitBreaker: cb ? null : null, // Will be populated asynchronously
  };
}

/**
 * Get publisher status with circuit breaker state (async)
 */
export async function getPublisherStatusAsync(): Promise<{
  enabled: boolean;
  running: boolean;
  mode: string;
  circuitBreaker: any;
}> {
  const cb = getCircuitBreaker();
  const cbState = await cb.getState();

  return {
    enabled: process.env.PUBLISHER_ENABLED !== 'false',
    running: isRunning,
    mode: process.env.PUBLISH_MODE || 'outbox',
    circuitBreaker: {
      state: cbState.state,
      opens: cbState.opens,
      lastChangeAt: cbState.lastChangeAt.toISOString(),
    },
  };
}
