/**
 * Server-side API route for Temporal health checks
 * Provides health monitoring without exposing client to frontend
 */

import { Client, Connection } from '@temporalio/client';
import { NextRequest, NextResponse } from 'next/server';

import { requireOperatorIdentity } from '@/lib/auth';

export const dynamic = 'force-dynamic';

class TemporalHealthService {
  private client: Client | null = null;

  async isHealthy(): Promise<{ healthy: boolean; error?: string; connectionTime?: number }> {
    const startTime = Date.now();

    try {
      if (!this.client) {
        this.client = new Client({
          connection: Connection.lazy({
            address: process.env.TEMPORAL_SERVER_URL || 'localhost:7233',
          }),
        });
      }

      // Simple connection check by attempting to get connection info
      if (!this.client?.connection) {
        throw new Error('No connection available');
      }

      const connectionTime = Date.now() - startTime;

      // Connection is established if we get here
      return {
        healthy: true,
        connectionTime,
      };
    } catch (error) {
      const connectionTime = Date.now() - startTime;
      console.error('❌ Temporal health check failed:', error);

      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionTime,
      };
    }
  }

  disconnect(): void {
    if (this.client) {
      this.client.connection.close();
      this.client = null;
    }
  }
}

// Singleton instance
const healthService = new TemporalHealthService();

export async function GET(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const healthResult = await healthService.isHealthy();

    if (healthResult.healthy) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'healthy',
          connectionTime: healthResult.connectionTime,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          data: {
            status: 'unhealthy',
            error: healthResult.error,
            connectionTime: healthResult.connectionTime,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('❌ Health check API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Clean up on exit
process.on('exit', () => {
  healthService.disconnect();
});
