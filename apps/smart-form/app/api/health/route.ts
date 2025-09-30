import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface SmartFormHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: ServiceStatus;
    application: ServiceStatus;
    environment: ServiceStatus;
  };
  version: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheck: string;
  error?: string;
  details?: Record<string, any>;
}

async function checkDatabaseConnectivity(): Promise<ServiceStatus> {
  const startTime = Date.now();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: 'Missing Supabase configuration',
        details: { config: 'invalid' }
      };
    }

    // Use native fetch for better Node.js 18 compatibility
    const response = await Promise.race([
      fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json'
        }
      }),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 3000)
      )
    ]);

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        status: 'down',
        responseTime,
        lastCheck: new Date().toISOString(),
        error: `HTTP ${response.status}: ${response.statusText}`,
        details: { connection: 'failed', httpStatus: response.status }
      };
    }

    return {
      status: responseTime > 2000 ? 'degraded' : 'up',
      responseTime,
      lastCheck: new Date().toISOString(),
      details: {
        connection: 'successful',
        responseTime: `${responseTime}ms`,
        httpStatus: response.status
      }
    };
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Database check failed',
      details: { connection: 'error' }
    };
  }
}

function checkApplicationHealth(): ServiceStatus {
  const startTime = Date.now();

  try {
    // Check critical environment variables
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ];

    const missing = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
        error: `Missing environment variables: ${missing.join(', ')}`,
        details: { missingVars: missing }
      };
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const memoryPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    return {
      status: memoryPercentage > 90 ? 'degraded' : 'up',
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details: {
        memoryUsage: `${memoryPercentage.toFixed(1)}%`,
        uptime: `${process.uptime()}s`,
        nodeVersion: process.version
      }
    };
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Application check failed',
      details: { application: 'error' }
    };
  }
}

function checkEnvironment(): ServiceStatus {
  const startTime = Date.now();

  try {
    const details: Record<string, any> = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      env: process.env.NODE_ENV || 'development'
    };

    // Check if we're in a supported Node.js version
    const nodeVersionMatch = process.version.match(/v(\d+)\./);
    const majorVersion = nodeVersionMatch ? parseInt(nodeVersionMatch[1]) : 0;

    const status = majorVersion < 20 ? 'degraded' : 'up';

    if (majorVersion < 20) {
      details.warning = 'Node.js version is deprecated. Please upgrade to Node.js 20+';
    }

    return {
      status,
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details
    };
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Environment check failed',
      details: { environment: 'error' }
    };
  }
}

export async function GET(_request: NextRequest) {
  const startTime = Date.now();

  try {
    // Run health checks with faster timeouts
    const [dbHealth, appHealth, envHealth] = await Promise.allSettled([
      checkDatabaseConnectivity(),
      Promise.resolve(checkApplicationHealth()),
      Promise.resolve(checkEnvironment())
    ]);

    // Extract results or create error status
    const services = {
      database: dbHealth.status === 'fulfilled'
        ? dbHealth.value
        : {
            status: 'down' as const,
            responseTime: Date.now() - startTime,
            lastCheck: new Date().toISOString(),
            error: 'Health check failed',
            details: { error: 'check_failed' }
          },
      application: appHealth.status === 'fulfilled'
        ? appHealth.value
        : {
            status: 'down' as const,
            responseTime: Date.now() - startTime,
            lastCheck: new Date().toISOString(),
            error: 'Health check failed',
            details: { error: 'check_failed' }
          },
      environment: envHealth.status === 'fulfilled'
        ? envHealth.value
        : {
            status: 'down' as const,
            responseTime: Date.now() - startTime,
            lastCheck: new Date().toISOString(),
            error: 'Health check failed',
            details: { error: 'check_failed' }
          }
    };

    // Calculate overall status with special handling for database connectivity issues
    const serviceStatuses = Object.values(services).map(s => s.status);
    const downServices = serviceStatuses.filter(s => s === 'down').length;
    const degradedServices = serviceStatuses.filter(s => s === 'degraded').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

    // If only database is down due to connectivity, treat as degraded (form can still work for display)
    if (downServices === 1 && services.database.status === 'down' &&
        services.application.status !== 'down' && services.environment.status !== 'down') {
      overallStatus = 'degraded';
    } else if (downServices > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedServices > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    // Get system metrics
    const memUsage = process.memoryUsage();
    const memory = {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
    };

    const healthStatus: SmartFormHealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
      version: process.env.APP_VERSION || '3.0.0',
      uptime: process.uptime(),
      memory
    };

    const statusCode = overallStatus === 'healthy' ? 200 :
                      overallStatus === 'degraded' ? 200 : 503;

    console.log(`[Smart Form Health] Health check completed in ${Date.now() - startTime}ms - Status: ${overallStatus}`);

    return NextResponse.json(healthStatus, { status: statusCode });

  } catch (error) {
    console.error('[Smart Form Health] Health check system failure:', error);

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check system failure',
      services: {
        database: { status: 'down', lastCheck: new Date().toISOString() },
        application: { status: 'down', lastCheck: new Date().toISOString() },
        environment: { status: 'down', lastCheck: new Date().toISOString() }
      },
      version: process.env.APP_VERSION || '3.0.0',
      uptime: process.uptime(),
      memory: { used: 0, total: 0, percentage: 0 }
    }, { status: 503 });
  }
}

// Liveness probe for Kubernetes/Docker health checks
export async function HEAD(_request: NextRequest) {
  return NextResponse.json({ status: 'alive' }, { status: 200 });
}