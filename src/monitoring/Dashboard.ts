import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';
import { HealthCheckResult, AgentStatus } from '../types/agent';

interface DashboardMetrics {
  agents: {
    [key: string]: {
      status: AgentStatus;
      health: HealthCheckResult;
      metrics: Record<string, any>;
      errors: Error[];
    };
  };
  system: {
    totalAgents: number;
    healthyAgents: number;
    degradedAgents: number;
    failedAgents: number;
    totalErrors24h: number;
    cpuUsage: number;
    memoryUsage: number;
  };
  business: {
    picksProcessed24h: number;
    successRate24h: number;
    averageProcessingTime: number;
    activeContests: number;
    totalParticipants: number;
  };
}

export class Dashboard {
  private static instance: Dashboard;
  private metrics: DashboardMetrics;
  private readonly updateInterval: number = 60000; // 1 minute
  private readonly logger: Logger;

  private constructor(private supabase: SupabaseClient) {
    this.logger = new Logger('Dashboard');
    this.initializeMetrics();
  }

  public static getInstance(supabase: SupabaseClient): Dashboard {
    if (!Dashboard.instance) {
      Dashboard.instance = new Dashboard(supabase);
    }
    return Dashboard.instance;
  }

  private initializeMetrics(): void {
    this.metrics = {
      agents: {},
      system: {
        totalAgents: 0,
        healthyAgents: 0,
        degradedAgents: 0,
        failedAgents: 0,
        totalErrors24h: 0,
        cpuUsage: 0,
        memoryUsage: 0
      },
      business: {
        picksProcessed24h: 0,
        successRate24h: 0,
        averageProcessingTime: 0,
        activeContests: 0,
        totalParticipants: 0
      }
    };
  }

  public async start(): Promise<void> {
    try {
      await this.updateMetrics();
      setInterval(() => this.updateMetrics(), this.updateInterval);
      this.logger.info('Dashboard started successfully');
    } catch (error) {
      this.logger.error('Failed to start dashboard:', error);
      throw error;
    }
  }

  private async updateMetrics(): Promise<void> {
    try {
      await Promise.all([
        this.updateAgentMetrics(),
        this.updateSystemMetrics(),
        this.updateBusinessMetrics()
      ]);

      await this.persistMetrics();
      await this.checkAlerts();
    } catch (error) {
      this.logger.error('Failed to update metrics:', error);
    }
  }

  private async updateAgentMetrics(): Promise<void> {
    const { data: agentHealth } = await this.supabase
      .from('agent_health')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1);

    const { data: agentMetrics } = await this.supabase
      .from('agent_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1);

    const { data: agentErrors } = await this.supabase
      .from('agent_errors')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Process and update metrics
    this.processAgentData(agentHealth, agentMetrics, agentErrors);
  }

  private async updateSystemMetrics(): Promise<void> {
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();

    this.metrics.system = {
      ...this.metrics.system,
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000,
      memoryUsage: memoryUsage.heapUsed / memoryUsage.heapTotal
    };
  }

  private async updateBusinessMetrics(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get picks processed in last 24h
    const { data: picks } = await this.supabase
      .from('daily_picks')
      .select('count')
      .gte('created_at', oneDayAgo)
      .single();

    // Get active contests
    const { data: contests } = await this.supabase
      .from('contests')
      .select('count')
      .eq('status', 'active')
      .single();

    // Update business metrics
    this.metrics.business = {
      ...this.metrics.business,
      picksProcessed24h: picks?.count || 0,
      activeContests: contests?.count || 0
    };
  }

  private async persistMetrics(): Promise<void> {
    await this.supabase
      .from('dashboard_metrics')
      .insert({
        metrics: this.metrics,
        timestamp: new Date().toISOString()
      });
  }

  private async checkAlerts(): Promise<void> {
    const alerts = [];

    // Check system health
    if (this.metrics.system.failedAgents > 0) {
      alerts.push({
        severity: 'high',
        message: `${this.metrics.system.failedAgents} agents in failed state`
      });
    }

    // Check business metrics
    if (this.metrics.business.successRate24h < 0.95) {
      alerts.push({
        severity: 'medium',
        message: `Success rate below 95%: ${this.metrics.business.successRate24h * 100}%`
      });
    }

    // Persist alerts
    if (alerts.length > 0) {
      await this.supabase
        .from('dashboard_alerts')
        .insert(alerts.map(alert => ({
          ...alert,
          timestamp: new Date().toISOString()
        })));
    }
  }

  private processAgentData(
    health: any[],
    metrics: any[],
    errors: any[]
  ): void {
    // Process and aggregate agent data
    const agentMap = new Map();
    
    health?.forEach(h => {
      agentMap.set(h.agent, {
        ...agentMap.get(h.agent),
        health: h.details
      });
    });

    metrics?.forEach(m => {
      agentMap.set(m.agent, {
        ...agentMap.get(m.agent),
        metrics: m.metrics
      });
    });

    errors?.forEach(e => {
      const agent = agentMap.get(e.agent) || {};
      agent.errors = [...(agent.errors || []), e];
      agentMap.set(e.agent, agent);
    });

    this.metrics.agents = Object.fromEntries(agentMap);
  }

  public getMetrics(): DashboardMetrics {
    return { ...this.metrics };
  }
} 