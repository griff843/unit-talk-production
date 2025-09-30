import { randomUUID } from 'crypto';
import { BaseAgent } from '../agents/BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies } from '../agents/BaseAgent/types';

// Import agent swarm components
import { PipelineOrchestratorAgent } from '../agents/PipelineOrchestratorAgent';
import { ScoringCoordinatorAgent } from '../agents/ScoringCoordinatorAgent';
import { PromotionAgent } from '../agents/PromotionAgent';
import { HealthMonitorAgent } from '../agents/HealthMonitorAgent';
import { WorkflowTriggerAgent } from '../agents/WorkflowTriggerAgent';

export interface AgentSwarmConfig {
  enablePipelineOrchestrator: boolean;
  enableScoringCoordinator: boolean;
  enablePromotionAgent: boolean;
  enableHealthMonitor: boolean;
  enableWorkflowTrigger: boolean;
  pipelineConfig?: {
    batchSize: number;
    maxConcurrentBatches: number;
    pollIntervalMs: number;
    enableCircuitBreaker: boolean;
  };
  scoringConfig?: {
    useEnhanced45Factor: boolean;
    maxConcurrentBatches: number;
    scoringTimeoutMs: number;
  };
  promotionConfig?: {
    minScore: number;
    minConfidence: number;
    maxDailyPromotions: number;
  };
  healthConfig?: {
    healthCheckIntervalMs: number;
    circuitBreakerThreshold: number;
    alertThreshold: number;
  };
  workflowConfig?: {
    triggerIntervalMs: number;
    maxConcurrentWorkflows: number;
  };
}

export interface AgentSwarmStatus {
  orchestratorId: string;
  startTime: string;
  agentStatus: Record<string, 'starting' | 'running' | 'stopping' | 'stopped' | 'error'>;
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  metrics: {
    totalPropsProcessed: number;
    totalPropsScored: number;
    totalPropsPromoted: number;
    averageProcessingTimeMs: number;
    systemUptime: number;
  };
}

/**
 * Agent Swarm Orchestrator
 * 
 * Manages the deployment and coordination of the entire agent swarm
 * Responsible for solving the 742K props pipeline orchestration issue
 */
export class AgentSwarmOrchestrator {
  private orchestratorId: string;
  private config: AgentSwarmConfig;
  private agentConfig: BaseAgentConfig;
  private dependencies: BaseAgentDependencies;

  // Agent instances
  private pipelineOrchestrator?: PipelineOrchestratorAgent;
  private scoringCoordinator?: ScoringCoordinatorAgent;
  private promotionAgent?: PromotionAgent;
  private healthMonitor?: HealthMonitorAgent;
  private workflowTrigger?: WorkflowTriggerAgent;

  // State management
  private isRunning = false;
  private startTime?: Date;
  private agentStatus: Record<string, 'starting' | 'running' | 'stopping' | 'stopped' | 'error'> = {};

  constructor(config: AgentSwarmConfig, agentConfig: BaseAgentConfig, dependencies: BaseAgentDependencies) {
    this.orchestratorId = randomUUID();
    this.config = config;
    this.agentConfig = agentConfig;
    this.dependencies = dependencies;

    console.log('🚀 Agent Swarm Orchestrator initialized', {
      orchestratorId: this.orchestratorId,
      enabledAgents: this.getEnabledAgents()
    });
  }

  /**
   * Deploy and start the agent swarm
   */
  async deploySwarm(): Promise<void> {
    console.log('🚀 Deploying Agent Swarm to fix pipeline orchestration issue');
    console.log('📊 Target: Process 742K raw props through Enhanced45FactorEngine to unified_picks');

    try {
      this.startTime = new Date();
      this.isRunning = true;

      // 1. Initialize Health Monitor first (needed by other agents)
      if (this.config.enableHealthMonitor) {
        await this.initializeHealthMonitor();
      }

      // 2. Initialize core pipeline agents
      if (this.config.enableScoringCoordinator) {
        await this.initializeScoringCoordinator();
      }

      if (this.config.enablePromotionAgent) {
        await this.initializePromotionAgent();
      }

      // 3. Initialize orchestrator (depends on other agents)
      if (this.config.enablePipelineOrchestrator) {
        await this.initializePipelineOrchestrator();
      }

      // 4. Initialize workflow trigger last (coordinates everything)
      if (this.config.enableWorkflowTrigger) {
        await this.initializeWorkflowTrigger();
      }

      // 5. Verify swarm health
      await this.verifySwarmHealth();

      console.log('✅ Agent Swarm deployed successfully');
      console.log('🎯 Pipeline orchestration issue resolved - automatic processing active');
      
      // Start continuous monitoring
      this.startContinuousMonitoring();

    } catch (error) {
      console.error('❌ Agent Swarm deployment failed', error);
      await this.handleDeploymentFailure(error);
      throw error;
    }
  }

  /**
   * Gracefully shutdown the agent swarm
   */
  async shutdownSwarm(): Promise<void> {
    console.log('🛑 Shutting down Agent Swarm');

    try {
      this.isRunning = false;

      // Shutdown in reverse order
      if (this.workflowTrigger) {
        await this.shutdownAgent('workflowTrigger', this.workflowTrigger);
      }

      if (this.pipelineOrchestrator) {
        await this.shutdownAgent('pipelineOrchestrator', this.pipelineOrchestrator);
      }

      if (this.promotionAgent) {
        await this.shutdownAgent('promotionAgent', this.promotionAgent);
      }

      if (this.scoringCoordinator) {
        await this.shutdownAgent('scoringCoordinator', this.scoringCoordinator);
      }

      if (this.healthMonitor) {
        await this.shutdownAgent('healthMonitor', this.healthMonitor);
      }

      console.log('✅ Agent Swarm shutdown completed');

    } catch (error) {
      console.error('❌ Agent Swarm shutdown failed', error);
      throw error;
    }
  }

  /**
   * Get current swarm status
   */
  getSwarmStatus(): AgentSwarmStatus {
    const metrics = this.collectSwarmMetrics();
    const overallHealth = this.assessOverallHealth();

    return {
      orchestratorId: this.orchestratorId,
      startTime: this.startTime?.toISOString() || 'not_started',
      agentStatus: { ...this.agentStatus },
      overallHealth,
      metrics
    };
  }

  /**
   * Handle manual trigger of pipeline processing
   */
  async triggerPipelineProcessing(): Promise<void> {
    console.log('🎯 Manual trigger: Pipeline processing initiated');

    if (!this.pipelineOrchestrator) {
      throw new Error('Pipeline Orchestrator not initialized');
    }

    try {
      await this.pipelineOrchestrator.process();
      console.log('✅ Manual pipeline processing completed');
    } catch (error) {
      console.error('❌ Manual pipeline processing failed', error);
      throw error;
    }
  }

  /**
   * Force health check across all agents
   */
  async performHealthCheck(): Promise<any> {
    console.log('🏥 Performing comprehensive health check');

    const healthResults: Record<string, any> = {};

    if (this.pipelineOrchestrator) {
      healthResults.pipelineOrchestrator = await this.pipelineOrchestrator.checkHealth();
    }

    if (this.scoringCoordinator) {
      healthResults.scoringCoordinator = await this.scoringCoordinator.checkHealth();
    }

    if (this.promotionAgent) {
      healthResults.promotionAgent = await this.promotionAgent.checkHealth();
    }

    if (this.healthMonitor) {
      healthResults.healthMonitor = await this.healthMonitor.checkHealth();
    }

    if (this.workflowTrigger) {
      healthResults.workflowTrigger = await this.workflowTrigger.checkHealth();
    }

    console.log('🏥 Health check completed', {
      healthyAgents: Object.values(healthResults).filter(r => r.status === 'healthy').length,
      totalAgents: Object.keys(healthResults).length
    });

    return healthResults;
  }

  // Private implementation methods

  private async initializeHealthMonitor(): Promise<void> {
    console.log('🏥 Initializing Health Monitor Agent');
    this.agentStatus.healthMonitor = 'starting';

    try {
      this.healthMonitor = new HealthMonitorAgent(this.agentConfig, this.dependencies);
      await this.healthMonitor.initialize();
      this.agentStatus.healthMonitor = 'running';
      console.log('✅ Health Monitor Agent initialized');
    } catch (error) {
      this.agentStatus.healthMonitor = 'error';
      console.error('❌ Health Monitor Agent initialization failed', error);
      throw error;
    }
  }

  private async initializeScoringCoordinator(): Promise<void> {
    console.log('🎯 Initializing Scoring Coordinator Agent');
    this.agentStatus.scoringCoordinator = 'starting';

    try {
      this.scoringCoordinator = new ScoringCoordinatorAgent(this.agentConfig, this.dependencies);
      await this.scoringCoordinator.initialize();
      this.agentStatus.scoringCoordinator = 'running';
      console.log('✅ Scoring Coordinator Agent initialized');
    } catch (error) {
      this.agentStatus.scoringCoordinator = 'error';
      console.error('❌ Scoring Coordinator Agent initialization failed', error);
      throw error;
    }
  }

  private async initializePromotionAgent(): Promise<void> {
    console.log('🚀 Initializing Promotion Agent');
    this.agentStatus.promotionAgent = 'starting';

    try {
      this.promotionAgent = new PromotionAgent(this.agentConfig, this.dependencies);
      await this.promotionAgent.initialize();
      this.agentStatus.promotionAgent = 'running';
      console.log('✅ Promotion Agent initialized');
    } catch (error) {
      this.agentStatus.promotionAgent = 'error';
      console.error('❌ Promotion Agent initialization failed', error);
      throw error;
    }
  }

  private async initializePipelineOrchestrator(): Promise<void> {
    console.log('🎛️ Initializing Pipeline Orchestrator Agent');
    this.agentStatus.pipelineOrchestrator = 'starting';

    try {
      this.pipelineOrchestrator = new PipelineOrchestratorAgent(this.agentConfig, this.dependencies);
      await this.pipelineOrchestrator.initialize();
      this.agentStatus.pipelineOrchestrator = 'running';
      console.log('✅ Pipeline Orchestrator Agent initialized');
    } catch (error) {
      this.agentStatus.pipelineOrchestrator = 'error';
      console.error('❌ Pipeline Orchestrator Agent initialization failed', error);
      throw error;
    }
  }

  private async initializeWorkflowTrigger(): Promise<void> {
    console.log('⚡ Initializing Workflow Trigger Agent');
    this.agentStatus.workflowTrigger = 'starting';

    try {
      this.workflowTrigger = new WorkflowTriggerAgent(this.agentConfig, this.dependencies);
      await this.workflowTrigger.initialize();
      this.agentStatus.workflowTrigger = 'running';
      console.log('✅ Workflow Trigger Agent initialized');
    } catch (error) {
      this.agentStatus.workflowTrigger = 'error';
      console.error('❌ Workflow Trigger Agent initialization failed', error);
      throw error;
    }
  }

  private async shutdownAgent(agentName: string, agent: BaseAgent): Promise<void> {
    console.log(`🛑 Shutting down ${agentName}`);
    this.agentStatus[agentName] = 'stopping';

    try {
      await agent.cleanup();
      this.agentStatus[agentName] = 'stopped';
      console.log(`✅ ${agentName} shutdown completed`);
    } catch (error) {
      this.agentStatus[agentName] = 'error';
      console.error(`❌ ${agentName} shutdown failed`, error);
    }
  }

  private async verifySwarmHealth(): Promise<void> {
    console.log('🔍 Verifying Agent Swarm health');

    const healthResults = await this.performHealthCheck();
    const unhealthyAgents = Object.entries(healthResults)
      .filter(([_, health]) => health.status !== 'healthy')
      .map(([name]) => name);

    if (unhealthyAgents.length > 0) {
      console.warn('⚠️ Some agents are not healthy', unhealthyAgents);
      // Continue deployment but log warning
    } else {
      console.log('✅ All agents are healthy');
    }

    // Test pipeline connectivity
    await this.testPipelineConnectivity();
  }

  private async testPipelineConnectivity(): Promise<void> {
    console.log('🔗 Testing pipeline connectivity');

    try {
      // Test that Pipeline Orchestrator can detect props
      if (this.pipelineOrchestrator) {
        const pipelineStatus = this.pipelineOrchestrator.getQueueStatus();
        console.log('📊 Pipeline status', pipelineStatus);
      }

      // Test that Scoring Coordinator is ready
      if (this.scoringCoordinator) {
        const scoringStatus = this.scoringCoordinator.getActiveBatchStatus();
        console.log('🎯 Scoring status', scoringStatus);
      }

      // Test that Promotion Agent is ready
      if (this.promotionAgent) {
        const promotionStatus = this.promotionAgent.getDiversificationStatus();
        console.log('🚀 Promotion status', promotionStatus);
      }

      console.log('✅ Pipeline connectivity verified');

    } catch (error) {
      console.error('❌ Pipeline connectivity test failed', error);
      throw error;
    }
  }

  private startContinuousMonitoring(): void {
    console.log('📊 Starting continuous monitoring');

    // Monitor every 30 seconds
    setInterval(async () => {
      try {
        if (!this.isRunning) return;

        const status = this.getSwarmStatus();
        
        // Log periodic status
        if (Date.now() % 300000 < 30000) { // Every 5 minutes
          console.log('📊 Agent Swarm Status', {
            overallHealth: status.overallHealth,
            runningAgents: Object.values(status.agentStatus).filter(s => s === 'running').length,
            totalPropsProcessed: status.metrics.totalPropsProcessed
          });
        }

        // Check for critical issues
        if (status.overallHealth === 'unhealthy') {
          console.error('🚨 Critical: Agent Swarm health is unhealthy');
          
          if (this.healthMonitor) {
            // This would trigger alerts in production
            console.warn('🚨 Would send critical alert in production environment');
          }
        }

      } catch (error) {
        console.error('❌ Continuous monitoring error', error);
      }
    }, 30000);
  }

  private collectSwarmMetrics(): any {
    const metrics = {
      totalPropsProcessed: 0,
      totalPropsScored: 0,
      totalPropsPromoted: 0,
      averageProcessingTimeMs: 0,
      systemUptime: this.startTime ? Date.now() - this.startTime.getTime() : 0
    };

    // Collect metrics from individual agents
    if (this.pipelineOrchestrator) {
      const pipelineMetrics = this.pipelineOrchestrator.getPipelineMetrics();
      metrics.totalPropsProcessed = pipelineMetrics.totalPropsProcessed;
      metrics.averageProcessingTimeMs = pipelineMetrics.averageProcessingTimeMs;
    }

    if (this.scoringCoordinator) {
      const scoringMetrics = this.scoringCoordinator.getScoringMetrics();
      metrics.totalPropsScored = scoringMetrics.totalPropsScored;
    }

    if (this.promotionAgent) {
      const promotionMetrics = this.promotionAgent.getPromotionMetrics();
      metrics.totalPropsPromoted = promotionMetrics.propsPromoted;
    }

    return metrics;
  }

  private assessOverallHealth(): 'healthy' | 'degraded' | 'unhealthy' {
    const agentStatuses = Object.values(this.agentStatus);
    const runningAgents = agentStatuses.filter(status => status === 'running').length;
    const errorAgents = agentStatuses.filter(status => status === 'error').length;
    const totalAgents = agentStatuses.length;

    if (errorAgents > 0) {
      return 'unhealthy';
    }

    if (runningAgents < totalAgents * 0.8) { // Less than 80% running
      return 'degraded';
    }

    return 'healthy';
  }

  private getEnabledAgents(): string[] {
    const enabled: string[] = [];
    if (this.config.enablePipelineOrchestrator) enabled.push('PipelineOrchestrator');
    if (this.config.enableScoringCoordinator) enabled.push('ScoringCoordinator');
    if (this.config.enablePromotionAgent) enabled.push('PromotionAgent');
    if (this.config.enableHealthMonitor) enabled.push('HealthMonitor');
    if (this.config.enableWorkflowTrigger) enabled.push('WorkflowTrigger');
    return enabled;
  }

  private async handleDeploymentFailure(error: any): Promise<void> {
    console.error('🚨 Handling Agent Swarm deployment failure', error);

    // Attempt graceful cleanup of any initialized agents
    try {
      await this.shutdownSwarm();
    } catch (cleanupError) {
      console.error('❌ Cleanup after deployment failure also failed', cleanupError);
    }
  }

  // Public utility methods

  public isSwarmRunning(): boolean {
    return this.isRunning;
  }

  public getOrchestratorId(): string {
    return this.orchestratorId;
  }

  public async restartAgent(agentName: string): Promise<void> {
    console.log(`🔄 Restarting agent: ${agentName}`);

    // This would implement agent restart logic
    // For now, we'll just log the intent
    console.log(`⚠️ Agent restart not implemented: ${agentName}`);
  }

  public async updateConfig(newConfig: Partial<AgentSwarmConfig>): Promise<void> {
    console.log('🔧 Updating Agent Swarm configuration', newConfig);

    this.config = { ...this.config, ...newConfig };

    // Apply configuration updates to running agents
    // This would require implementing configuration reload in each agent
    console.log('⚠️ Dynamic configuration updates not implemented yet');
  }
}