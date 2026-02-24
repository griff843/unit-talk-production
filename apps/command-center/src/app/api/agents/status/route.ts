import { NextRequest, NextResponse } from 'next/server';

import { agentMonitor } from '@/lib/agentMonitoring';
import { redisClient } from '@/lib/redis';
import { Agent, getSupabaseClient } from '@/lib/supabase';

/**
 * Agent Status API Endpoint
 * SPRINT-DEMO-MODE-REMOVAL: All mock fallbacks removed.
 * Fail-closed: If database unavailable, return explicit error.
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('id');
    const agentName = searchParams.get('name');
    const liveHealth = searchParams.get('live') === 'true';
    const includeMetrics = searchParams.get('metrics') === 'true';
    const includeHistory = searchParams.get('history') === 'true';

    console.log('[CC] GET /api/agents/status', { agentId, agentName, liveHealth, includeMetrics });

    const client = getSupabaseClient();

    // Get specific agent status
    if (agentId || agentName) {
      const identifier = agentId ? 'id' : 'agent';
      const value = agentId || agentName;

      const { data: agent, error } = await client
        .from('agent_health')
        .select('*')
        .eq(identifier, value)
        .single();

      if (error) {
        console.error('[CC] Agent status query failed:', error.message);
        return NextResponse.json(
          { success: false, error: error.code === 'PGRST116' ? 'Agent not found' : error.message },
          { status: error.code === 'PGRST116' ? 404 : 500 }
        );
      }

      // Get live health if requested
      let liveStatus = null;
      if (liveHealth) {
        try {
          liveStatus = await agentMonitor.checkAgent(agent.agent as string);
          await redisClient.cacheAgentStatus(agent.agent as string, liveStatus);
        } catch (healthError) {
          console.warn('[CC] Live health check failed:', healthError);
        }
      }

      // Get metrics history if requested
      let metricsHistory = null;
      if (includeHistory) {
        try {
          const { data: history } = await client
            .from('agent_metrics')
            .select('*')
            .eq('agent', agent.agent)
            .order('created_at', { ascending: false })
            .limit(100);

          metricsHistory = history;
        } catch (historyError) {
          console.warn('[CC] Failed to fetch metrics history:', historyError);
        }
      }

      const details = (agent.details || {}) as Record<string, unknown>;
      const response = {
        id: agent.id,
        name: agent.agent,
        type: 'system',
        status: liveStatus?.status || agent.status,
        health: liveStatus
          ? {
              status: liveStatus.status,
              uptime: liveStatus.details.uptime,
              lastCheck: liveStatus.lastCheck,
              responseTime: liveStatus.responseTime,
              details: liveStatus.details,
            }
          : null,
        metrics: includeMetrics
          ? {
              success_rate: details.success_rate,
              avg_response_time: details.response_time_ms,
              total_operations: details.total_operations,
              last_run: agent.last_heartbeat,
            }
          : null,
        history: metricsHistory,
        configuration: details,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
      };

      return NextResponse.json({
        success: true,
        data: response,
        source: liveHealth ? 'database+live' : 'database',
      });
    }

    // Get all agents status
    const cacheKey = `agents:status:${liveHealth ? 'live' : 'db'}`;
    let agentsStatus: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      last_run: string;
      success_rate: number;
      avg_response_time: number;
      total_operations: number;
      liveHealth?: {
        uptime: number;
        lastCheck: Date;
        responseTime: number;
        errors: string[];
      };
    }> = [];

    if (!liveHealth) {
      const cached = await redisClient.get<typeof agentsStatus>(cacheKey);
      if (cached) {
        console.log('[CC] Using cached agents status');
        agentsStatus = cached;
      }
    }

    if (agentsStatus.length === 0) {
      const { data: agents, error } = await client.from('agent_health').select('*').order('agent');

      if (error) {
        console.error('[CC] Agent status query failed:', error.message);
        return NextResponse.json(
          { success: false, error: `Database query failed: ${error.message}` },
          { status: 500 }
        );
      }

      agentsStatus = (agents || []).map(agent => {
        const details = (agent.details || {}) as Record<string, unknown>;
        return {
          id: agent.id as string,
          name: agent.agent as string,
          type: 'system',
          status: agent.status as string,
          last_run: agent.last_heartbeat as string,
          success_rate: (details.success_rate as number) ?? 0,
          avg_response_time: (details.response_time_ms as number) ?? 0,
          total_operations: (details.total_operations as number) ?? 0,
        };
      });

      // If live health requested, enhance with real-time data
      if (liveHealth) {
        try {
          console.log('[CC] Performing live health checks for all agents...');
          const liveStatuses = await agentMonitor.checkAllAgents();

          // Merge live health data
          agentsStatus = agentsStatus.map(agent => {
            const liveStatus = liveStatuses.find(live => live.name === agent.name);
            if (liveStatus) {
              return {
                ...agent,
                status: liveStatus.status,
                liveHealth: {
                  uptime: liveStatus.details.uptime,
                  lastCheck: liveStatus.lastCheck,
                  responseTime: liveStatus.responseTime,
                  errors: liveStatus.details.errors,
                },
              };
            }
            return agent;
          });

          // Cache individual statuses
          for (const status of liveStatuses) {
            await redisClient.cacheAgentStatus(status.name, status);
          }
        } catch (healthError) {
          console.warn('[CC] Live health checks failed:', healthError);
        }
      } else {
        // Cache database results for 2 minutes
        await redisClient.set(cacheKey, agentsStatus, 120);
      }
    }

    // Calculate summary metrics
    const total = agentsStatus.length;
    const summary = {
      total,
      healthy: agentsStatus.filter(a => a.status === 'healthy').length,
      warning: agentsStatus.filter(a => a.status === 'warning').length,
      error: agentsStatus.filter(a => a.status === 'error').length,
      inactive: agentsStatus.filter(a => a.status === 'inactive').length,
      avgSuccessRate:
        total > 0 ? agentsStatus.reduce((sum, a) => sum + a.success_rate, 0) / total : 0,
      avgResponseTime:
        total > 0 ? agentsStatus.reduce((sum, a) => sum + a.avg_response_time, 0) / total : 0,
    };

    const response = includeMetrics
      ? {
          agents: agentsStatus,
          summary,
          lastUpdated: new Date().toISOString(),
        }
      : agentsStatus;

    return NextResponse.json({
      success: true,
      data: response,
      count: agentsStatus.length,
      source: liveHealth ? 'database+live' : 'database',
    });
  } catch (error) {
    console.error('[CC] GET /api/agents/status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// POST /api/agents/status - Bulk status update or health check trigger
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, agents } = body;

    console.log('[CC] POST /api/agents/status - Action:', action);

    if (action === 'health-check') {
      // Trigger health check for all or specific agents
      const agentNames = agents || [];

      try {
        const results =
          agentNames.length > 0
            ? await Promise.all(agentNames.map((name: string) => agentMonitor.checkAgent(name)))
            : await agentMonitor.checkAllAgents();

        // Cache results
        for (const result of results) {
          await redisClient.cacheAgentStatus(result.name, result);
        }

        return NextResponse.json({
          success: true,
          data: results,
          message: `Health check completed for ${results.length} agents`,
        });
      } catch (healthError) {
        console.error('[CC] Health check failed:', healthError);
        return NextResponse.json(
          {
            success: false,
            error: healthError instanceof Error ? healthError.message : 'Health check failed',
          },
          { status: 500 }
        );
      }
    }

    if (action === 'bulk-update') {
      // Bulk status update
      const updates = body.updates || [];

      const client = getSupabaseClient();

      const results = [];
      for (const update of updates) {
        const { data, error } = await client
          .from('agent_health')
          .update({
            status: update.status,
            last_heartbeat: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('agent', update.name)
          .select()
          .single();

        if (error) {
          console.error('[CC] Bulk update failed for agent:', update.name, error.message);
        } else {
          results.push(data);
        }
      }

      return NextResponse.json({
        success: true,
        data: results,
        message: `Updated ${results.length} agents`,
        source: 'database',
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action. Must be one of: health-check, bulk-update',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('[CC] POST /api/agents/status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
