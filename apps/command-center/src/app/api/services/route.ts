import { NextRequest, NextResponse } from 'next/server';
import { dockerServiceMonitor } from '@/lib/dockerServiceMonitor';
import { systemMetrics } from '@/lib/systemMetrics';

/**
 * GET /api/services
 * Get current service health and metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeSystem = searchParams.get('system') === 'true';
    const includeDocker = searchParams.get('docker') !== 'false';

    const data: any = {
      timestamp: Date.now(),
    };

    // Collect Docker service metrics
    if (includeDocker) {
      try {
        const dockerMetrics = await dockerServiceMonitor.getCurrentMetrics();
        data.services = dockerMetrics.services;
        data.docker = dockerMetrics.system;
      } catch (error) {
        console.error('Failed to get Docker metrics:', error);
        data.services = [];
        data.docker = {
          total_containers: 0,
          running_containers: 0,
          stopped_containers: 0,
          total_images: 0,
          disk_usage: '0B',
          network_usage: { rx_bytes: 0, tx_bytes: 0 },
        };
      }
    }

    // Collect system metrics
    if (includeSystem) {
      try {
        const systemHealth = await systemMetrics.getSystemHealth();
        data.system = {
          health: systemHealth.status,
          issues: systemHealth.issues,
          metrics: systemHealth.metrics,
        };
      } catch (error) {
        console.error('Failed to get system metrics:', error);
        data.system = {
          health: 'unknown',
          issues: ['Failed to collect system metrics'],
          metrics: null,
        };
      }
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    console.error('Services API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service metrics', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/services
 * Control service actions (start, stop, restart)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { service, action } = body;

    if (!service || !action) {
      return NextResponse.json({ error: 'Service name and action are required' }, { status: 400 });
    }

    if (!['start', 'stop', 'restart'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be start, stop, or restart' },
        { status: 400 }
      );
    }

    const result = await dockerServiceMonitor.controlService(service, action);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        timestamp: Date.now(),
      });
    } else {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }
  } catch (error) {
    console.error('Service control error:', error);
    return NextResponse.json(
      { error: 'Failed to control service', details: error.message },
      { status: 500 }
    );
  }
}
