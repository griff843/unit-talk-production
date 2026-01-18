/**
 * POST /api/burn-in/run-once
 * Execute one full burn-in cycle for testing
 */

import { NextResponse } from 'next/server';
import { burnInRunner } from '@/lib/burn-in/runner';

export async function POST() {
  try {
    const result = await burnInRunner.runFullCycle();

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute burn-in cycle',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
