import { NextRequest, NextResponse } from 'next/server';
import { dbOperations, Agent, getSupabaseClient } from '@/lib/supabase';
import { mockAgents, simulateAgentStatusUpdate } from '@/lib/mockData';
import { agentMonitor } from '@/lib/agentMonitoring';
import { redisClient } from '@/lib/redis';

/**
 * Agent Status API Endpoint
 * Provides detailed agent status information with live health checks
 * Falls back to mock data when database is unavailable
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('id');
    const agentName = searchParams.get('name');
    const liveHealth = searchParams.get('live') === 'true';
    const includeMetrics = searchParams.get('metrics') === 'true';
    const includeHistory = searchParams.get('history') === 'true';

    console.log('📊 GET /api/agents/status', { agentId, agentName, liveHealth, includeMetrics });

    // Get specific agent status
    if (agentId || agentName) {
      try {
        const client = getSupabaseClient();
        if (!client) throw new Error('Database unavailable');

        const identifier = agentId ? 'id' : 'name';
        const value = agentId || agentName;

        const { data: agent, error } = await client
          .from('agents')
          .select('*')
          .eq(identifier, value)
          .single();

        if (error) throw error;

        // Get live health if requested
        let liveStatus = null;
        if (liveHealth) {
          try {
            liveStatus = await agentMonitor.checkAgent(agent.name as string);

            // Cache the live status
            await redisClient.cacheAgentStatus(agent.name as string, liveStatus);
          } catch (healthError) {
            console.warn('⚠️ Live health check failed:', healthError);
          }
        }

        // Get metrics history if requested
        let metricsHistory = null;
        if (includeHistory) {
          try {
            const { data: history } = await client
              .from('agent_metrics')
              .select('*')
              .eq('agent_name', agent.name)
              .order('created_at', { ascending: false })
              .limit(100);

            metricsHistory = history;
          } catch (historyError) {
            console.warn('⚠️ Failed to fetch metrics history:', historyError);
          }
        }

        const response = {
          id: agent.id,
          name: agent.name,
          type: agent.type,
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
                success_rate: agent.success_rate,
                avg_response_time: agent.avg_response_time,
                total_operations: agent.total_operations,
                last_run: agent.last_run,
              }
            : null,
          history: metricsHistory,
          configuration: agent.configuration,
          created_at: agent.created_at,
          updated_at: agent.updated_at,
        };

        return NextResponse.json({
          success: true,
          data: response,
          source: liveHealth ? 'database+live' : 'database',
        });
      } catch (error) {
        console.log('⚠️ Database unavailable, using mock data');
        const mockAgent = mockAgents.find(
          a => (agentId && a.id === agentId) || (agentName && a.name === agentName)
        );

        if (!mockAgent) {
          return NextResponse.json(
            {
              success: false,
              error: 'Agent not found',
            },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: mockAgent,
          source: 'mock',
        });
      }
    }

    // Get all agents status
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Database unavailable');

      // Try to get cached status first
      const cacheKey = `agents:status:${liveHealth ? 'live' : 'db'}`;
      let agentsStatus = [];

      if (!liveHealth) {
        const cached = await redisClient.get<any[]>(cacheKey);
        if (cached) {
          console.log('🎯 Using cached agents status');
          agentsStatus = cached;
        }
      }

      if (agentsStatus.length === 0) {
        // Get all agents from database
        const { data: agents, error } = await client.from('agents').select('*').order('name');

        if (error) throw error;

        agentsStatus = agents.map(agent => ({
          id: agent.id,
          name: agent.name,
          type: agent.type,
          status: agent.status,
          last_run: agent.last_run,
          success_rate: agent.success_rate,
          avg_response_time: agent.avg_response_time,
          total_operations: agent.total_operations,
        }));

        // If live health requested, enhance with real-time data
        if (liveHealth) {
          try {
            console.log('🏥 Performing live health checks for all agents...');
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
            console.warn('⚠️ Live health checks failed:', healthError);
          }
        } else {
          // Cache database results for 2 minutes
          await redisClient.set(cacheKey, agentsStatus, 120);
        }
      }

      // Calculate summary metrics
      const summary = {
        total: agentsStatus.length,
        healthy: agentsStatus.filter(a => a.status === 'healthy').length,
        warning: agentsStatus.filter(a => a.status === 'warning').length,
        error: agentsStatus.filter(a => a.status === 'error').length,
        inactive: agentsStatus.filter(a => a.status === 'inactive').length,
        avgSuccessRate:
          agentsStatus.reduce((sum, a) => sum + a.success_rate, 0) / agentsStatus.length,
        avgResponseTime:
          agentsStatus.reduce((sum, a) => sum + a.avg_response_time, 0) / agentsStatus.length,
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
      console.log('⚠️ Database unavailable, using mock data');
      let agentsStatus = [...mockAgents];

      // Simulate updates for mock data
      agentsStatus.forEach(agent => {
        if (Math.random() < 0.1) {
          // 10% chance to update
          simulateAgentStatusUpdate(agent.id);
        }
      });

      const summary = {
        total: agentsStatus.length,
        healthy: agentsStatus.filter(a => a.status === 'healthy').length,
        warning: agentsStatus.filter(a => a.status === 'warning').length,
        error: agentsStatus.filter(a => a.status === 'error').length,
        inactive: agentsStatus.filter(a => a.status === 'inactive').length,
        avgSuccessRate:
          agentsStatus.reduce((sum, a) => sum + a.success_rate, 0) / agentsStatus.length,
        avgResponseTime:
          agentsStatus.reduce((sum, a) => sum + a.avg_response_time, 0) / agentsStatus.length,
      };

      const response = includeMetrics
        ? {
            agents: agentsStatus,
            summary,
          }
        : agentsStatus;

      return NextResponse.json({
        success: true,
        data: response,
        count: agentsStatus.length,
        source: 'mock',
      });
    }
  } catch (error) {
    console.error('❌ GET /api/agents/status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
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

    console.log('🎬 POST /api/agents/status - Action:', action);

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
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: 'Health check failed',
          },
          { status: 500 }
        );
      }
    }

    if (action === 'bulk-update') {
      // Bulk status update
      const updates = body.updates || [];

      try {
        const client = getSupabaseClient();
        if (!client) throw new Error('Database unavailable');

        const results = [];
        for (const update of updates) {
          const { data, error } = await client
            .from('agents')
            .update({
              status: update.status,
              last_run: new Date().toISOString(),
            })
            .eq('name', update.name)
            .select()
            .single();

          if (!error) {
            results.push(data);
          }
        }

        return NextResponse.json({
          success: true,
          data: results,
          message: `Updated ${results.length} agents`,
        });
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: 'Bulk update failed',
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('❌ POST /api/agents/status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
