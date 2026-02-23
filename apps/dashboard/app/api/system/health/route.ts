import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// SPRINT-SCHEMA-ENV-GATES-002: Lazy Supabase initialization
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    // SPRINT-SUPABASE-ENDPOINT-TRUTH-LOCK-110A: Fail-closed - no hardcoded fallbacks
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'SPRINT-110A: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required'
      );
    }
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  services: Array<{
    name: string;
    status: 'up' | 'down' | 'degraded';
    responseTime?: number;
    lastCheck: string;
    uptime: number;
    version?: string;
  }>;
  database: {
    status: 'connected' | 'slow' | 'disconnected';
    responseTime: number;
    activeConnections?: number;
  };
  apis: Array<{
    name: string;
    endpoint: string;
    status: 'operational' | 'slow' | 'down';
    responseTime?: number;
    lastCheck: string;
  }>;
  metrics: {
    totalRequests: number;
    errorRate: number;
    avgResponseTime: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };
}

async function checkDatabaseHealth(): Promise<{
  status: 'connected' | 'slow' | 'disconnected';
  responseTime: number;
}> {
  const startTime = Date.now();

  try {
    // SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007: Use unified_picks (canonical)
    const { data: _data, error } = await getSupabase().from('unified_picks').select('id').limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      console.error('[Health Check] Database error:', error);
      return { status: 'disconnected', responseTime };
    }

    return {
      status: responseTime > 1000 ? 'slow' : 'connected',
      responseTime,
    };
  } catch (error) {
    console.error('[Health Check] Database connection failed:', error);
    return { status: 'disconnected', responseTime: Date.now() - startTime };
  }
}

async function checkExternalAPI(
  name: string,
  endpoint: string
): Promise<{
  name: string;
  endpoint: string;
  status: 'operational' | 'slow' | 'down';
  responseTime?: number;
  lastCheck: string;
}> {
  const startTime = Date.now();
  const now = new Date().toISOString();

  try {
    // For external APIs, we'll mock the health check for now
    // In production, you'd make actual requests to health endpoints
    const mockResponseTime = Math.random() * 200 + 50; // 50-250ms

    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to simulate

    return {
      name,
      endpoint,
      status: mockResponseTime > 200 ? 'slow' : 'operational',
      responseTime: mockResponseTime,
      lastCheck: now,
    };
  } catch (error) {
    return {
      name,
      endpoint,
      status: 'down',
      responseTime: Date.now() - startTime,
      lastCheck: now,
    };
  }
}

export async function GET(_request: NextRequest) {
  try {
    console.log('[Health API] Performing system health check...');

    const startTime = Date.now();

    // Check database health
    const dbHealth = await checkDatabaseHealth();

    // Check external APIs
    const apiChecks = await Promise.all([
      checkExternalAPI('Optimal API', 'https://api.optimal-bet.com/v1/health'),
      checkExternalAPI('Odds API', 'https://api.the-odds-api.com/v4/sports'),
      checkExternalAPI('Discord API', 'https://discord.com/api/v10/gateway'),
      // SPRINT-SUPABASE-ENDPOINT-TRUTH-LOCK-110A: Use env var, not hardcoded URL
      checkExternalAPI('Supabase API', `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`),
    ]);

    // SPRINT-DAILY-PICKS-CANONICAL-ENFORCEMENT-007: Use unified_picks (canonical)
    const { data: recentActivity, error: activityError } = await getSupabase()
      .from('unified_picks')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    const { data: smartFormActivity, error: smartFormError } = await getSupabase()
      .from('smart_tickets')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    // Calculate system metrics
    const totalRequests = (recentActivity?.length || 0) + (smartFormActivity?.length || 0);
    const errorRate = activityError || smartFormError ? 5.0 : 0.5; // Mock error rate
    const avgResponseTime =
      (dbHealth.responseTime + apiChecks.reduce((sum, api) => sum + (api.responseTime || 0), 0)) /
      (apiChecks.length + 1);

    // Define system services
    const services = [
      {
        name: 'Smart Form API',
        status: 'up' as const,
        responseTime: 45,
        lastCheck: new Date().toISOString(),
        uptime: 99.8,
        version: '3.0.0',
      },
      {
        name: 'Grading Engine',
        status: 'up' as const,
        responseTime: 12,
        lastCheck: new Date().toISOString(),
        uptime: 99.9,
        version: '3.1.0',
      },
      {
        name: 'Discord Bot',
        status: 'degraded' as const,
        responseTime: 120,
        lastCheck: new Date().toISOString(),
        uptime: 95.2,
        version: '2.1.0',
      },
      {
        name: 'Alert System',
        status: 'up' as const,
        responseTime: 65,
        lastCheck: new Date().toISOString(),
        uptime: 99.7,
        version: '3.0.0',
      },
      {
        name: 'Analytics Engine',
        status: 'up' as const,
        responseTime: 85,
        lastCheck: new Date().toISOString(),
        uptime: 99.5,
        version: '3.0.0',
      },
    ];

    // Determine overall health
    // Cast to allow for dynamic health states
    const criticalServices = services.filter(s => (s.status as string) === 'down').length;
    const degradedServices = services.filter(s => s.status === 'degraded').length;
    const downAPIs = apiChecks.filter(api => api.status === 'down').length;

    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (criticalServices > 0 || dbHealth.status === 'disconnected' || downAPIs > 1) {
      overallStatus = 'critical';
    } else if (degradedServices > 0 || dbHealth.status === 'slow' || downAPIs > 0) {
      overallStatus = 'warning';
    }

    const healthData: SystemHealth = {
      overall: overallStatus,
      services,
      database: {
        status: dbHealth.status,
        responseTime: dbHealth.responseTime,
        activeConnections: 5, // Mock data
      },
      apis: apiChecks,
      metrics: {
        totalRequests,
        errorRate,
        avgResponseTime: Math.round(avgResponseTime),
        memoryUsage: Math.random() * 30 + 40, // Mock 40-70% memory usage
        cpuUsage: Math.random() * 20 + 10, // Mock 10-30% CPU usage
      },
    };

    console.log(`[Health API] System health check completed in ${Date.now() - startTime}ms`);
    console.log(`[Health API] Overall status: ${overallStatus}`);

    return NextResponse.json({
      success: true,
      health: healthData,
      timestamp: new Date().toISOString(),
      checkDuration: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[Health API] Health check failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Health check failed',
        health: {
          overall: 'critical',
          services: [],
          database: { status: 'disconnected', responseTime: 0 },
          apis: [],
          metrics: { totalRequests: 0, errorRate: 100, avgResponseTime: 0 },
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
