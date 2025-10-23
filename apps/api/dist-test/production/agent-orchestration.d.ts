/**
 * Agent Orchestration System - Phase 8 Production Implementation
 *
 * Manages all agents for high-throughput processing:
 * - ScoringAgent: Enhanced 45-Factor scoring at scale
 * - AlertAgent: Real-time notifications and hedge detection
 * - FeedAgent: Dual-API data ingestion optimization
 * - RecapAgent: Performance analytics and reporting
 * - OperatorAgent: System health and maintenance
 *
 * Target: 1000+ props/hour with coordinated agent processing
 */
import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { Worker } from '@temporalio/worker';
import { BaseAgent } from '../agents/BaseAgent';
import { RealTimeScoringPipeline } from './real-time-scoring-pipeline';
interface AgentOrchestrationConfig {
    agents: {
        scoring: {
            instances: number;
            batchSize: number;
            processingTimeout: number;
        };
        alerts: {
            instances: number;
            subscriptions: string[];
            notificationChannels: string[];
        };
        feed: {
            instances: number;
            pollInterval: number;
            apiSources: string[];
        };
        recap: {
            instances: number;
            reportInterval: number;
            metricsRetention: number;
        };
        operator: {
            instances: number;
            healthCheckInterval: number;
            maintenanceSchedule: string;
        };
    };
    temporal: {
        taskQueue: string;
        maxConcurrentWorkflows: number;
        maxConcurrentActivities: number;
    };
    performance: {
        targetThroughputPerHour: number;
        maxLatencyMs: number;
        errorThreshold: number;
        healthCheckInterval: number;
    };
    coordination: {
        messageQueue: string;
        eventBus: string;
        stateSync: string;
        leaderElection: boolean;
    };
}
interface AgentMetrics {
    agentType: string;
    instanceId: string;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'stopped';
    processedCount: number;
    errorCount: number;
    averageProcessingTime: number;
    lastActivityAt: Date;
    memoryUsage: number;
    cpuUsage: number;
}
interface OrchestrationMetrics {
    totalAgents: number;
    healthyAgents: number;
    totalThroughput: number;
    overallLatency: number;
    errorRate: number;
    systemLoad: number;
    coordinationLatency: number;
}
interface AgentInstance {
    id: string;
    type: string;
    agent: BaseAgent;
    worker?: Worker;
    metrics: AgentMetrics;
    lastHeartbeat: Date;
}
export declare class AgentOrchestrationSystem extends EventEmitter {
    private config;
    private logger;
    private redis;
    private temporalConnection;
    private temporalClient;
    private scoringPipeline;
    private agents;
    private orchestrationMetrics;
    private isRunning;
    private healthCheckInterval?;
    private metricsInterval?;
    private coordinationChannel;
    constructor(config: AgentOrchestrationConfig, logger: Logger, scoringPipeline: RealTimeScoringPipeline);
    /**
     * Initialize the agent orchestration system
     */
    initialize(): Promise<void>;
    /**
     * Deploy all agent instances based on configuration
     */
    private deployAllAgents;
    /**
     * Deploy multiple ScoringAgent instances for high throughput
     */
    private deployScoringAgents;
    /**
     * Deploy AlertAgent instances for real-time notifications
     */
    private deployAlertAgents;
    /**
     * Deploy FeedAgent instances for data ingestion
     */
    private deployFeedAgents;
    /**
     * Deploy RecapAgent instances for analytics
     */
    private deployRecapAgents;
    /**
     * Deploy OperatorAgent instances for system maintenance
     */
    private deployOperatorAgents;
    /**
     * Create a Temporal worker for an agent
     */
    private createTemporalWorker;
    /**
     * Register an agent instance in the orchestration system
     */
    private registerAgentInstance;
    /**
     * Setup event listeners for agent instances
     */
    private setupAgentEventListeners;
    /**
     * Setup inter-agent coordination
     */
    private setupAgentCoordination;
    /**
     * Handle coordination events between agents
     */
    private handleCoordinationEvent;
    /**
     * Route high-priority props to available scoring agents
     */
    private routeHighPriorityProps;
    /**
     * Start health monitoring for all agents
     */
    private startHealthMonitoring;
    /**
     * Perform health checks on all agents
     */
    private performHealthChecks;
    /**
     * Start metrics collection
     */
    private startMetricsCollection;
    /**
     * Collect and emit orchestration metrics
     */
    private collectAndEmitMetrics;
    /**
     * Update orchestration-level metrics
     */
    private updateOrchestrationMetrics;
    /**
     * Publish coordination heartbeat
     */
    private publishCoordinationHeartbeat;
    private initializeTemporalConnection;
    private setupRedisConnection;
    private calculateTotalInstances;
    private initializeMetrics;
    private handleMarketChange;
    private handleSystemAlert;
    private handleLoadBalancing;
    /**
     * Get orchestration system status
     */
    getStatus(): {
        isRunning: boolean;
        orchestrationMetrics: OrchestrationMetrics;
        agents: {
            id: string;
            type: string;
            status: "healthy" | "unhealthy" | "degraded" | "stopped";
            processedCount: number;
            errorCount: number;
            lastActivity: Date;
        }[];
        config: AgentOrchestrationConfig;
    };
    /**
     * Scale agent instances up or down
     */
    scaleAgents(agentType: string, targetInstances: number): Promise<void>;
    /**
     * Shutdown the orchestration system gracefully
     */
    shutdown(): Promise<void>;
}
export declare const createProductionOrchestrationConfig: () => AgentOrchestrationConfig;
export type { AgentOrchestrationConfig, AgentMetrics, OrchestrationMetrics, AgentInstance };
//# sourceMappingURL=agent-orchestration.d.ts.map