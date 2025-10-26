import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../lib/supabase-server';

/**
 * Smart Form Health Check Endpoint
 * Date: 2025-10-26
 * 
 * Provides health status for Smart Form application including:
 * - Database connectivity
 * - Configuration validation
 * - Service availability
 */

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    database: {
      status: 'pass' | 'fail';
      responseTime?: number;
      message: string;
    };
    configuration: {
      status: 'pass' | 'fail';
      message: string;
      details?: Record<string, boolean>;
    };
  };
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      database: {
        status: 'fail',
        message: 'Not checked',
      },
      configuration: {
        status: 'fail',
        message: 'Not checked',
      },
    },
  };

  // Check 1: Database Connectivity
  const dbStartTime = Date.now();
  try {
    const { error } = await supabaseServer.from('unified_picks').select('count').limit(1).single();
    
    const dbResponseTime = Date.now() - dbStartTime;
    
    if (error) {
      result.checks.database = {
        status: 'fail',
        responseTime: dbResponseTime,
        message: `Database query failed: ${error.message}`,
      };
      result.status = 'unhealthy';
    } else {
      result.checks.database = {
        status: 'pass',
        responseTime: dbResponseTime,
        message: dbResponseTime > 1000 ? 'Database slow but connected' : 'Database healthy',
      };
      
      if (dbResponseTime > 1000) {
        result.status = 'degraded';
      }
    }
  } catch (error) {
    result.checks.database = {
      status: 'fail',
      responseTime: Date.now() - dbStartTime,
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
    result.status = 'unhealthy';
  }

  // Check 2: Configuration
  const configChecks = {
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const allConfigValid = Object.values(configChecks).every(v => v);
  
  result.checks.configuration = {
    status: allConfigValid ? 'pass' : 'fail',
    message: allConfigValid ? 'All required configuration present' : 'Missing required configuration',
    details: configChecks,
  };

  if (!allConfigValid && result.status === 'healthy') {
    result.status = 'degraded';
  }

  // Determine HTTP status code
  const httpStatus = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;

  return NextResponse.json(result, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Response-Time': `${Date.now() - startTime}ms`,
    },
  });
}

// HEAD request for simple health checks (load balancers)
export async function HEAD(): Promise<NextResponse> {
  try {
    const { error } = await supabaseServer.from('unified_picks').select('count').limit(1).single();
    
    if (error) {
      return new NextResponse(null, { status: 503 });
    }
    
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}

