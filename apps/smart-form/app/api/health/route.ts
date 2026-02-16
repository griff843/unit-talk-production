/**
 * Smart Form Health Endpoint
 *
 * PHASE-2-PRODUCTION-READINESS-019: System Reconciliation
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function GET() {
  const startTime = Date.now();
  const checks: any[] = [];
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Check Supabase connectivity
  try {
    const supabase = supabaseServer();
    const { error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      checks.push({
        component: 'supabase',
        status: 'unhealthy',
        error: error.message,
      });
      overallStatus = 'degraded';
    } else {
      checks.push({
        component: 'supabase',
        status: 'healthy',
      });
    }
  } catch (error) {
    checks.push({
      component: 'supabase',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    overallStatus = 'unhealthy';
  }

  return NextResponse.json(
    {
      status: overallStatus,
      service: 'smart-form',
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - startTime,
      checks,
    },
    {
      status: overallStatus === 'healthy' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}

export async function HEAD() {
  try {
    const supabase = supabaseServer();
    const { error } = await supabase.from('users').select('count').limit(1);

    if (error) {
      return new NextResponse(null, { status: 503 });
    }

    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
