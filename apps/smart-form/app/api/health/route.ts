/**
 * Smart Form Health Endpoint
 *
 * PHASE-2-PRODUCTION-READINESS-019: System Reconciliation
 * SPRINT-SUPABASE-ENDPOINT-TRUTH-LOCK-110A: Canonical endpoint validation
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { validateSupabaseEndpoint, CANONICAL_SUPABASE_HOST } from '@/lib/env';

export async function GET() {
  const startTime = Date.now();
  const checks: any[] = [];
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // SPRINT-SUPABASE-ENDPOINT-TRUTH-LOCK-110A: Validate canonical endpoint
  const endpointValidation = validateSupabaseEndpoint();
  if (!endpointValidation.valid) {
    checks.push({
      component: 'supabase_endpoint',
      status: 'unhealthy',
      error: endpointValidation.error,
      expected_host: CANONICAL_SUPABASE_HOST,
    });
    overallStatus = 'unhealthy';

    // Return immediately - wrong database is a critical failure
    return NextResponse.json(
      {
        status: overallStatus,
        service: 'smart-form',
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - startTime,
        checks,
        critical_error: 'SPRINT-110A: Unauthorized Supabase endpoint detected',
      },
      { status: 503 }
    );
  }

  checks.push({
    component: 'supabase_endpoint',
    status: 'healthy',
    message: `Verified canonical host: ${CANONICAL_SUPABASE_HOST}`,
  });

  // Check Supabase connectivity
  try {
    const supabase = supabaseServer();
    const { error } = await supabase.from('users').select('count').limit(1);

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
