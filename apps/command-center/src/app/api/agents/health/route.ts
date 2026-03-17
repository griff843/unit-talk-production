import { NextRequest, NextResponse } from 'next/server';

import { agentMonitor } from '@/lib/agentMonitoring';
import { requireOperatorIdentity } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Agent Health Check API Endpoint
 * Provides real-time health status of platform agents
 */

// GET /api/agents/health - Get health status of all agents or specific agent
export async function GET(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const agentName = searchParams.get('agent');
    const refresh = searchParams.get('refresh') === 'true';
    const timeout = parseInt(searchParams.get('timeout') || '10000');

    console.log('🏥 GET /api/agents/health', { agentName, refresh, timeout });

    // If specific agent requested
    if (agentName) {
      try {
        let status;

        if (refresh) {
          console.log(`🔄 Refreshing health for agent: ${agentName}`);
          status = await agentMonitor.refreshAgent(agentName);
        } else {
          status = agentMonitor.getAgentStatus(agentName);

          // If no cached status, perform fresh check
          if (!status) {
            console.log(`📡 No cached status for ${agentName}, performing fresh check`);
            status = await agentMonitor.refreshAgent(agentName);
          }
        }

        if (!status) {
          return NextResponse.json(
            {
              success: false,
              error: `Agent ${agentName} not found or not configured for monitoring`,
            },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: status,
          cached: !refresh,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`❌ Health check failed for ${agentName}:`, error);
        return NextResponse.json(
          {
            success: false,
            error: `Health check failed for ${agentName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            agent: agentName,
          },
          { status: 500 }
        );
      }
    }

    // Get health status for all agents
    try {
      let statuses;

      if (refresh) {
        console.log('🔄 Refreshing health for all agents');
        statuses = await agentMonitor.checkAllAgents();
      } else {
        statuses = agentMonitor.getCachedStatuses();

        // If no cached statuses, perform fresh check
        if (statuses.length === 0) {
          console.log('📡 No cached statuses, performing fresh check for all agents');
          statuses = await agentMonitor.checkAllAgents();
        }
      }

      // Calculate summary metrics
      const summary = {
        total: statuses.length,
        healthy: statuses.filter(s => s.status === 'healthy').length,
        warning: statuses.filter(s => s.status === 'warning').length,
        error: statuses.filter(s => s.status === 'error').length,
        inactive: statuses.filter(s => s.status === 'inactive').length,
      };

      const summaryWithHealth = {
        ...summary,
        healthPercentage:
          statuses.length > 0 ? Math.round((summary.healthy / summary.total) * 100) : 0,
      };

      const avgResponseTime =
        statuses.length > 0
          ? Math.round(statuses.reduce((sum, s) => sum + s.responseTime, 0) / statuses.length)
          : 0;

      return NextResponse.json({
        success: true,
        data: {
          agents: statuses,
          summary: summaryWithHealth,
          performance: {
            avgResponseTime,
            totalAgents: statuses.length,
            lastHealthCheck:
              statuses.length > 0 ? Math.max(...statuses.map(s => s.lastCheck.getTime())) : null,
          },
        },
        cached: !refresh,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('❌ Health check failed for all agents:', error);
      return NextResponse.json(
        {
          success: false,
          error: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: error instanceof Error ? error.stack : undefined,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ GET /api/agents/health error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// POST /api/agents/health - Start/stop monitoring or trigger health check
export async function POST(request: NextRequest) {
  const identity = requireOperatorIdentity(request);
  if (!identity) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { action, agent, interval } = body;

    console.log('🎬 POST /api/agents/health', { action, agent, interval });

    const validActions = ['start_monitoring', 'stop_monitoring', 'check_now', 'refresh_agent'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
        },
        { status: 400 }
      );
    }

    try {
      switch (action) {
        case 'start_monitoring':
          const monitoringInterval = interval || 30000; // Default 30 seconds
          agentMonitor.startMonitoring(monitoringInterval);
          return NextResponse.json({
            success: true,
            message: `Agent monitoring started with ${monitoringInterval}ms interval`,
            data: {
              action: 'start_monitoring',
              interval: monitoringInterval,
              timestamp: new Date().toISOString(),
            },
          });

        case 'stop_monitoring':
          agentMonitor.stopMonitoring();
          return NextResponse.json({
            success: true,
            message: 'Agent monitoring stopped',
            data: {
              action: 'stop_monitoring',
              timestamp: new Date().toISOString(),
            },
          });

        case 'check_now':
          const statuses = await agentMonitor.checkAllAgents();
          return NextResponse.json({
            success: true,
            message: 'Health check completed for all agents',
            data: {
              agents: statuses,
              count: statuses.length,
              timestamp: new Date().toISOString(),
            },
          });

        case 'refresh_agent':
          if (!agent) {
            return NextResponse.json(
              {
                success: false,
                error: 'Agent name is required for refresh_agent action',
              },
              { status: 400 }
            );
          }

          const agentStatus = await agentMonitor.refreshAgent(agent);
          return NextResponse.json({
            success: true,
            message: `Health check completed for agent: ${agent}`,
            data: agentStatus,
          });

        default:
          return NextResponse.json(
            {
              success: false,
              error: 'Unknown action',
            },
            { status: 400 }
          );
      }
    } catch (error) {
      console.error(`❌ Health action failed:`, error);
      return NextResponse.json(
        {
          success: false,
          error: `Health action failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          action,
          agent,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ POST /api/agents/health error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
