/**
 * PHASE 5: Burn-In Scheduler API
 *
 * API endpoints for controlling the autonomous burn-in scheduler.
 *
 * Routes:
 * - GET /api/burn-in - Get scheduler status and statistics
 * - POST /api/burn-in/start - Start the scheduler
 * - POST /api/burn-in/stop - Stop the scheduler
 * - POST /api/burn-in/pause - Pause the scheduler
 * - POST /api/burn-in/resume - Resume the scheduler
 *
 * @module api/burn-in
 */

import { NextRequest, NextResponse } from 'next/server';
import { createBurnInScheduler } from '@/lib/burn-in/scheduler';

// Singleton scheduler instance
let schedulerInstance: ReturnType<typeof createBurnInScheduler> | null = null;

/**
 * GET /api/burn-in
 * Get current scheduler status and statistics
 */
export async function GET() {
  if (!schedulerInstance) {
    return NextResponse.json(
      {
        isRunning: false,
        message: 'Scheduler not initialized',
      },
      { status: 200 }
    );
  }

  const stats = schedulerInstance.getStats();
  return NextResponse.json(stats, { status: 200 });
}

/**
 * POST /api/burn-in/start
 * Start the burn-in scheduler with optional configuration overrides
 */
export async function POST(request: NextRequest) {
  const { pathname } = new URL(request.url);

  // Handle /start endpoint
  if (pathname.endsWith('/start')) {
    if (schedulerInstance?.getState().isRunning) {
      return NextResponse.json(
        { error: 'Scheduler is already running' },
        { status: 400 }
      );
    }

    try {
      const body = await request.json().catch(() => ({}));
      const config = body.config || {};

      // Enforce log_only mode for burn-in
      if (config.mode && config.mode !== 'log_only') {
        return NextResponse.json(
          { error: 'Burn-in must run in log_only mode' },
          { status: 400 }
        );
      }

      // Enforce Discord disabled
      if (config.discordEnabled === true) {
        return NextResponse.json(
          { error: 'Discord must be disabled for burn-in' },
          { status: 400 }
        );
      }

      schedulerInstance = createBurnInScheduler(config);
      await schedulerInstance.start();

      return NextResponse.json(
        {
          message: 'Scheduler started successfully',
          config: schedulerInstance.getState().config,
        },
        { status: 200 }
      );
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to start scheduler',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  }

  // Handle /stop endpoint
  if (pathname.endsWith('/stop')) {
    if (!schedulerInstance) {
      return NextResponse.json(
        { error: 'Scheduler not initialized' },
        { status: 400 }
      );
    }

    try {
      await schedulerInstance.stop();
      const finalStats = schedulerInstance.getStats();
      schedulerInstance = null;

      return NextResponse.json(
        {
          message: 'Scheduler stopped successfully',
          finalStats,
        },
        { status: 200 }
      );
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to stop scheduler',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  }

  // Handle /pause endpoint
  if (pathname.endsWith('/pause')) {
    if (!schedulerInstance) {
      return NextResponse.json(
        { error: 'Scheduler not initialized' },
        { status: 400 }
      );
    }

    schedulerInstance.pause();
    return NextResponse.json(
      { message: 'Scheduler paused successfully' },
      { status: 200 }
    );
  }

  // Handle /resume endpoint
  if (pathname.endsWith('/resume')) {
    if (!schedulerInstance) {
      return NextResponse.json(
        { error: 'Scheduler not initialized' },
        { status: 400 }
      );
    }

    schedulerInstance.resume();
    return NextResponse.json(
      { message: 'Scheduler resumed successfully' },
      { status: 200 }
    );
  }

  return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });
}
