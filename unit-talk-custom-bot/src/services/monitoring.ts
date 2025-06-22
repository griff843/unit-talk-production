import { supabaseService } from './supabase';
import { agentService } from './agents';
import { logger } from '../utils/logger';

export interface AgentHealthStatus {
  agentId: string;
  status: 'healthy' | 'error';
  lastHeartbeat: Date;
  errorCount: number;
  responseTime: number;
  metadata?: Record<string, any>;
}

export interface HealthCheckResult {
  agentId: string;
  timestamp: Date;
  status: 'healthy' | 'error';
  responseTime: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export class AgentMonitoringService {
  private agents: Map<string, AgentHealthStatus> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private readonly checkInterval = 60000; // 1 minute
  private readonly errorThreshold = 3;

  /**
   * Start monitoring system
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.checkInterval);

    logger.info('Agent monitoring started');
  }

  /**
   * Stop monitoring system
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null as any;
    }

    logger.info('Agent monitoring stopped');
  }

  /**
   * Register agent for monitoring
   */
  registerAgent(agentId: string, metadata?: Record<string, any>): void {
    this.agents.set(agentId, {
      agentId,
      status: 'healthy',
      lastHeartbeat: new Date(),
      errorCount: 0,
      responseTime: 0,
      metadata: metadata || {}
    });

    logger.info(`Agent registered for monitoring: ${agentId}`);
  }

  /**
   * Record heartbeat from agent
   */
  async recordHeartbeat(agentId: string, metadata?: Record<string, any>): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      this.registerAgent(agentId, metadata);
      return;
    }

    agent.lastHeartbeat = new Date();
    agent.status = 'healthy';
    agent.errorCount = 0;
    if (metadata) {
      agent.metadata = { ...agent.metadata, ...metadata };
    }

    // Store health check result
    const healthResult: HealthCheckResult = {
      agentId,
      timestamp: new Date(),
      status: 'healthy',
      responseTime: 0,
      metadata: metadata || {}
    };

    await this.storeHealthCheckResult(healthResult);
  }

  /**
   * Record error from agent
   */
  async recordError(agentId: string, error: Error, metadata?: Record<string, any>): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      this.registerAgent(agentId);
    }

    const agentStatus = this.agents.get(agentId)!;
    agentStatus.status = 'error';
    agentStatus.errorCount++;
    agentStatus.lastHeartbeat = new Date();
    if (metadata) {
      agentStatus.metadata = { ...agentStatus.metadata, ...metadata };
    }

    // Store health check result
    const healthResult: HealthCheckResult = {
      agentId,
      timestamp: new Date(),
      status: 'error',
      responseTime: 0,
      errorMessage: error.message,
      metadata: metadata || {}
    };

    await this.storeHealthCheckResult(healthResult);

    // Trigger self-healing if error threshold exceeded
    if (agentStatus.errorCount >= this.errorThreshold) {
      await this.triggerSelfHealing(agentId, error);
    }

    logger.error(`Agent error recorded: ${agentId}`, error);
  }

  /**
   * Perform health checks on all agents
   */
  private async performHealthChecks(): Promise<void> {
    const promises = Array.from(this.agents.keys()).map(agentId => 
      this.performSingleHealthCheck(agentId)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Perform health check on single agent
   */
  private async performSingleHealthCheck(agentId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response = await agentService.getAgentStatus(agentId);
      const responseTime = Date.now() - startTime;

      const agent = this.agents.get(agentId);
      if (!agent) return;

      agent.responseTime = responseTime;

      if (response.success) {
        agent.status = 'healthy';
        agent.errorCount = 0;
        agent.lastHeartbeat = new Date();

        await this.storeHealthCheckResult({
          agentId,
          timestamp: new Date(),
          status: 'healthy',
          responseTime,
          metadata: response.data || {}
        });
      } else {
        agent.status = 'error';
        agent.errorCount++;

        await this.storeHealthCheckResult({
          agentId,
          timestamp: new Date(),
          status: 'error',
          responseTime,
          errorMessage: response.error || 'Health check failed',
          metadata: {}
        });

        if (agent.errorCount >= this.errorThreshold) {
          await this.triggerSelfHealing(agentId, new Error(response.error || 'Health check failed'));
        }
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const agent = this.agents.get(agentId);
      
      if (agent) {
        agent.status = 'error';
        agent.errorCount++;
        agent.responseTime = responseTime;

        await this.storeHealthCheckResult({
          agentId,
          timestamp: new Date(),
          status: 'error',
          responseTime,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          metadata: {}
        });

        if (agent.errorCount >= this.errorThreshold) {
          await this.triggerSelfHealing(agentId, error as Error);
        }
      }
    }
  }

  /**
   * Trigger self-healing for problematic agent
   */
  private async triggerSelfHealing(agentId: string, error: Error): Promise<void> {
    try {
      logger.warn(`Triggering self-healing for agent: ${agentId}`);

      // Attempt to restart the agent
      const restartResult = await agentService.restartAgent(agentId);
      
      if (restartResult.success) {
        logger.info(`Agent ${agentId} restarted successfully`);
        
        // Reset error count
        const agent = this.agents.get(agentId);
        if (agent) {
          agent.errorCount = 0;
          agent.status = 'healthy';
        }

        // Notify OperatorAgent of successful recovery
        await agentService.notifyOperator(
          `Agent ${agentId} has been automatically restarted and recovered.`,
          'info'
        );
      } else {
        logger.error(`Failed to restart agent ${agentId}:`, restartResult.error);
        
        // Notify OperatorAgent of failed recovery
        await agentService.notifyOperator(
          `CRITICAL: Agent ${agentId} failed to restart. Manual intervention required. Error: ${error.message}`,
          'error'
        );
      }

    } catch (healingError) {
      logger.error(`Self-healing failed for agent ${agentId}:`, healingError);
      
      // Notify OperatorAgent of self-healing failure
      await agentService.notifyOperator(
        `CRITICAL: Self-healing failed for agent ${agentId}. Manual intervention required.`,
        'error'
      );
    }
  }

  /**
   * Store health check result in database
   */
  private async storeHealthCheckResult(result: HealthCheckResult): Promise<void> {
    try {
      await supabaseService.client
        .from('agent_health_checks')
        .insert({
          agent_id: result.agentId,
          timestamp: result.timestamp.toISOString(),
          status: result.status,
          response_time: result.responseTime,
          error_message: result.errorMessage,
          metadata: result.metadata || {}
        });

    } catch (error) {
      logger.error('Error storing health check result:', error);
    }
  }

  /**
   * Get health status for all agents
   */
  getHealthStatus(): AgentHealthStatus[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get health status for specific agent
   */
  getAgentHealthStatus(agentId: string): AgentHealthStatus | null {
    return this.agents.get(agentId) || null;
  }

  /**
   * Get health check history from database
   */
  async getHealthCheckHistory(agentId?: string, hours: number = 24): Promise<HealthCheckResult[]> {
    try {
      let query = supabaseService.client
        .from('agent_health_checks')
        .select('*')
        .gte('timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false });

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data } = await query;

      if (!data) return [];

      return data.map(record => ({
        agentId: record.agent_id,
        timestamp: new Date(record.timestamp),
        status: record.status as 'healthy' | 'error',
        responseTime: record.response_time,
        errorMessage: record.error_message,
        metadata: record.metadata || {}
      }));

    } catch (error) {
      logger.error('Error getting health check history:', error);
      return [];
    }
  }
}

export const agentMonitoringService = new AgentMonitoringService();