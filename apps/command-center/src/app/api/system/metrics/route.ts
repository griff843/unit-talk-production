import { NextRequest, NextResponse } from 'next/server';

import { requireOperatorIdentity } from '@/lib/auth';
import { redisClient } from '@/lib/redis';
import { systemMetrics } from '@/lib/systemMetrics';

export const dynamic = 'force-dynamic';

/**
 * System Metrics API Endpoint
 * Provides real-time system metrics (CPU, memory, disk, network)
 */

// GET /api/system/metrics - Get current system metrics
export async function GET(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const cached = searchParams.get('cached') === 'true';
    const health = searchParams.get('health') === 'true';

    console.log('📊 GET /api/system/metrics', { format, cached, health });

    // Try to get cached metrics first if requested
    if (cached) {
      const cachedMetrics = await redisClient.getCachedSystemMetrics();
      if (cachedMetrics) {
        console.log('🎯 Using cached system metrics');
        return NextResponse.json({
          success: true,
          data: cachedMetrics,
          cached: true,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Collect fresh metrics
    if (health) {
      const healthData = await systemMetrics.getSystemHealth();

      // Cache the health data
      await redisClient.cacheSystemMetrics(healthData.metrics);

      return NextResponse.json({
        success: true,
        data: {
          health: {
            status: healthData.status,
            issues: healthData.issues,
          },
          metrics: healthData.metrics,
          timestamp: new Date().toISOString(),
        },
        cached: false,
      });
    }

    if (format === 'formatted') {
      const formattedMetrics = await systemMetrics.getFormattedMetrics();

      return NextResponse.json({
        success: true,
        data: formattedMetrics,
        timestamp: new Date().toISOString(),
      });
    }

    // Default: Return raw metrics
    const rawMetrics = await systemMetrics.collectMetrics();

    // Cache the metrics for 30 seconds
    await redisClient.cacheSystemMetrics(rawMetrics);

    // For test compatibility, return metrics directly
    return NextResponse.json(rawMetrics);
  } catch (error) {
    console.error('❌ GET /api/system/metrics error:', error);

    // Return minimal metrics structure for test compatibility
    const errorMetrics = {
      timestamp: new Date().toISOString(),
      system: {
        cpu: 0,
        memory: { total: 0, used: 0, percentage: 0 },
        disk: { total: 0, used: 0, percentage: 0 },
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        cpu: 0,
        memory: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 },
      },
      network: {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0,
      },
    };

    return NextResponse.json(errorMetrics, { status: 500 });
  }
}

// POST /api/system/metrics - Store metrics or trigger collection
export async function POST(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { action, interval } = body;

    if (action === 'collect') {
      const metrics = await systemMetrics.collectMetrics();

      // Store in Redis
      await redisClient.cacheSystemMetrics(metrics);

      // Also add to metrics history stream
      await redisClient.addToStream('system:metrics:history', {
        timestamp: metrics.timestamp.toString(),
        cpu: metrics.system.cpu.toString(),
        memory: metrics.system.memory.percentage.toString(),
        disk: metrics.system.disk.percentage.toString(),
        load1: metrics.system.load.load1.toString(),
        networkIn: metrics.network.bytesIn.toString(),
        networkOut: metrics.network.bytesOut.toString(),
      });

      return NextResponse.json({
        success: true,
        data: metrics,
        message: 'Metrics collected and stored successfully',
      });
    }

    if (action === 'health_check') {
      const healthData = await systemMetrics.getSystemHealth();

      return NextResponse.json({
        success: true,
        data: healthData,
        message: 'System health check completed',
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('❌ POST /api/system/metrics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process metrics request',
      },
      { status: 500 }
    );
  }
}
