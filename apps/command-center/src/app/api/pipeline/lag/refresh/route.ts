/**
 * @fileoverview Pipeline Lag Materialized View Refresh Endpoint
 * Secure server-only endpoint to refresh mv_pipeline_lag_24h
 */

export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server';
import { getTypedSupabaseClient } from '@/lib/supabase';
import { RBACService } from '@/lib/rbac';

/**
 * POST /api/pipeline/lag/refresh
 * Secure endpoint to refresh the materialized view mv_pipeline_lag_24h
 * Requires internal authentication header
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // Verify internal authentication token
    const authToken = request.headers.get('x-internal-token');
    const expectedToken = process.env.INTERNAL_REFRESH_TOKEN;
    
    if (!authToken || !expectedToken || authToken !== expectedToken) {
      console.warn('❌ Unauthorized materialized view refresh attempt');
      
      // Log security event
      await RBACService.logAudit({
        actor: 'system',
        actor_type: 'system',
        action: 'UNAUTHORIZED_REFRESH_ATTEMPT',
        resource_type: 'materialized_view',
        resource_id: 'mv_pipeline_lag_24h',
        payload: {
          provided_token: authToken ? 'provided' : 'missing',
          source_ip: request.headers.get('x-forwarded-for') || 'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
        },
        status: 'error',
        duration_ms: Date.now() - startTime,
      });
      
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('🔄 Starting materialized view refresh: mv_pipeline_lag_24h');
    
    // Execute REFRESH MATERIALIZED VIEW CONCURRENTLY
    // This allows concurrent reads while refreshing
    const client = getTypedSupabaseClient()
    if (!client) throw new Error('Database unavailable')
    const { error } = await client.rpc('refresh_pipeline_lag_materialized_view');
    
    if (error) {
      console.error('❌ Materialized view refresh failed:', error);
      
      // Log failure
      await RBACService.logAudit({
        actor: 'system',
        actor_type: 'system',
        action: 'REFRESH_MV_FAILED',
        resource_type: 'materialized_view',
        resource_id: 'mv_pipeline_lag_24h',
        payload: {
          error: error.message,
          error_code: error.code,
        },
        status: 'error',
        duration_ms: Date.now() - startTime,
      });
      
      throw new Error(`Materialized view refresh failed: ${error.message}`);
    }
    
    const responseTime = Date.now() - startTime;
    const refreshedAt = new Date().toISOString();
    
    console.log(`✅ Successfully refreshed mv_pipeline_lag_24h in ${responseTime}ms`);
    
    // Log successful refresh
    await RBACService.logAudit({
      actor: 'system',
      actor_type: 'system', 
      action: 'REFRESH_MV_SUCCESS',
      resource_type: 'materialized_view',
      resource_id: 'mv_pipeline_lag_24h',
      payload: {
        refreshed_at: refreshedAt,
      },
      status: 'success',
      duration_ms: responseTime,
    });
    
    return NextResponse.json({
      ok: true,
      refreshedAt,
      duration_ms: responseTime,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Refresh-Time': `${responseTime}ms`,
      },
    });
    
  } catch (error) {
    console.error('Materialized view refresh error:', error);
    
    const responseTime = Date.now() - startTime;
    const errorResponse = {
      ok: false,
      error: error instanceof Error ? error.message : 'Refresh failed',
      timestamp: new Date().toISOString(),
      duration_ms: responseTime,
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Only allow POST method
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}