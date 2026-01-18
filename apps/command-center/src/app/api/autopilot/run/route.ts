/**
 * Phase 4: Autopilot Run API
 * POST /api/autopilot/run - Trigger autopilot evaluation
 */

import { NextRequest, NextResponse } from 'next/server';
import { autopilotEvaluator } from '@/lib/autopilot/evaluator';
import type { AutopilotMode } from '@/lib/autopilot/types';

export async function POST(request: NextRequest) {
  try {
    // Get mode from environment or request body
    const body = await request.json().catch(() => ({}));
    const mode: AutopilotMode = body.mode || (process.env.AUTOPILOT_MODE as AutopilotMode) || 'log_only';

    // Validate mode
    const validModes: AutopilotMode[] = ['off', 'log_only', 'canary', 'prod'];
    if (!validModes.includes(mode)) {
      return NextResponse.json({ error: `Invalid mode: ${mode}. Must be one of: ${validModes.join(', ')}` }, { status: 400 });
    }

    // Don't run if mode is 'off'
    if (mode === 'off') {
      return NextResponse.json(
        {
          success: false,
          message: 'Autopilot is disabled (mode=off)',
          evaluation_run_id: null,
          summary: {
            total_evaluated: 0,
            approved: 0,
            rejected: 0,
            unknown: 0,
            would_publish: 0,
          },
        },
        { status: 200 }
      );
    }

    console.log(`[API /autopilot/run] Running autopilot in mode: ${mode}`);

    // Run autopilot evaluation
    const result = await autopilotEvaluator.runEvaluation(mode);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Autopilot evaluation failed',
          evaluation_run_id: result.evaluation_run_id,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        mode,
        evaluation_run_id: result.evaluation_run_id,
        summary: result.summary,
        execution_time_ms: result.execution_time_ms,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API /autopilot/run] Exception:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      message: 'POST /api/autopilot/run to trigger autopilot evaluation',
      current_mode: process.env.AUTOPILOT_MODE || 'off',
      valid_modes: ['off', 'log_only', 'canary', 'prod'],
    },
    { status: 200 }
  );
}
