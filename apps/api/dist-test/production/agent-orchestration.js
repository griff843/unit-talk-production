"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProductionOrchestrationConfig = exports.AgentOrchestrationSystem = void 0;
const events_1 = require("events");
const worker_1 = require("@temporalio/worker");
const client_1 = require("@temporalio/client");
const ScoringAgent_1 = require("../agents/ScoringAgent/ScoringAgent");
const AlertAgent_1 = require("../agents/AlertAgent/AlertAgent");
const FeedAgent_1 = require("../agents/FeedAgent/FeedAgent");
const RecapAgent_1 = require("../agents/RecapAgent/RecapAgent");
const OperatorAgent_1 = require("../agents/OperatorAgent/OperatorAgent");
const ioredis_1 = __importDefault(require("ioredis"));
class AgentOrchestrationSystem extends events_1.EventEmitter {
    constructor(config, logger, scoringPipeline) {
        super();
        this.agents = new Map();
        this.isRunning = false;
        this.config = config;
        this.logger = logger;
        this.scoringPipeline = scoringPipeline;
        this.coordinationChannel = config.coordination.eventBus;
        this.initializeMetrics();
        this.setupRedisConnection();
    }
    /**
     * Initialize the agent orchestration system
     */
    async initialize() {
        this.logger.info('🤖 Initializing Agent Orchestration System', {
            totalAgentInstances: this.calculateTotalInstances(),
            targetThroughput: this.config.performance.targetThroughputPerHour,
            maxLatency: this.config.performance.maxLatencyMs
        });
        try {
            // Initialize Temporal connection
            await this.initializeTemporalConnection();
            this.logger.info('✅ Temporal connection established');
            // Initialize Redis for coordination
            await this.redis.ping();
            this.logger.info('✅ Redis coordination layer ready');
            // Deploy all agent types
            await this.deployAllAgents();
            this.logger.info('✅ All agents deployed');
            // Setup inter-agent coordination
            await this.setupAgentCoordination();
            this.logger.info('✅ Agent coordination configured');
            // Start health monitoring
            this.startHealthMonitoring();
            this.logger.info('✅ Health monitoring started');
            // Start metrics collection
            this.startMetricsCollection();
            this.logger.info('✅ Metrics collection started');
            this.isRunning = true;
            this.emit('orchestration:initialized');
            this.logger.info('🎯 Agent Orchestration System fully operational');
        }
        catch (error) {
            this.logger.error('❌ Failed to initialize agent orchestration', { error });
            throw error;
        }
    }
    /**
     * Deploy all agent instances based on configuration
     */
    async deployAllAgents() {
        this.logger.info('🚀 Deploying all agent instances...');
        // Deploy Scoring Agents (multiple instances for high throughput)
        await this.deployScoringAgents();
        // Deploy Alert Agents (event-driven processing)
        await this.deployAlertAgents();
        // Deploy Feed Agents (data ingestion optimization)
        await this.deployFeedAgents();
        // Deploy Recap Agents (analytics and reporting)
        await this.deployRecapAgents();
        // Deploy Operator Agents (system maintenance)
        await this.deployOperatorAgents();
        this.logger.info(`✅ Deployed ${this.agents.size} agent instances across ${Object.keys(this.config.agents).length} agent types`);
    }
    /**
     * Deploy multiple ScoringAgent instances for high throughput
     */
    async deployScoringAgents() {
        const { instances, batchSize, processingTimeout } = this.config.agents.scoring;
        for (let i = 0; i < instances; i++) {
            const instanceId = `scoring-agent-${i + 1}`;
            try {
                // Create agent configuration
                const agentConfig = {
                    agentId: instanceId,
                    agentType: 'ScoringAgent',
                    processInterval: 5000, // 5 second processing cycle
                    healthCheckInterval: this.config.performance.healthCheckInterval,
                    retryPolicy: {
                        maxAttempts: 3,
                        backoffMultiplier: 2,
                        maxBackoffMs: 30000
                    },
                    // Production-optimized settings
                    batchSize,
                    processingTimeout,
                    parallelProcessing: true,
                    enhanced45Factor: true
                };
                // Create agent dependencies
                const dependencies = {
                    logger: this.logger.child({ agentId: instanceId }),
                    supabase: null, // Will be injected by agent
                    redis: this.redis,
                    temporal: {
                        connection: this.temporalConnection,
                        client: this.temporalClient
                    }
                };
                // Create and initialize agent
                const agent = new ScoringAgent_1.ScoringAgent(agentConfig, dependencies);
                await agent.initialize();
                // Create Temporal worker for this agent
                const worker = await this.createTemporalWorker(instanceId, agent);
                // Register agent instance
                this.registerAgentInstance(instanceId, 'ScoringAgent', agent, worker);
                this.logger.info(`✅ ScoringAgent instance ${instanceId} deployed`, {
                    batchSize,
                    processingTimeout,
                    enhanced45Factor: true
                });
            }
            catch (error) {
                this.logger.error(`❌ Failed to deploy ScoringAgent instance ${instanceId}`, { error });
                throw error;
            }
        }
    }
    /**
     * Deploy AlertAgent instances for real-time notifications
     */
    async deployAlertAgents() {
        const { instances, subscriptions, notificationChannels } = this.config.agents.alerts;
        for (let i = 0; i < instances; i++) {
            const instanceId = `alert-agent-${i + 1}`;
            try {
                const agentConfig = {
                    agentId: instanceId,
                    agentType: 'AlertAgent',
                    processInterval: 1000, // 1 second for real-time alerts
                    healthCheckInterval: this.config.performance.healthCheckInterval,
                    retryPolicy: {
                        maxAttempts: 3,
                        backoffMultiplier: 1.5,
                        maxBackoffMs: 15000
                    },
                    // Alert-specific configuration
                    subscriptions,
                    notificationChannels,
                    realTimeProcessing: true
                };
                const dependencies = {
                    logger: this.logger.child({ agentId: instanceId }),
                    supabase: null,
                    redis: this.redis,
                    temporal: {
                        connection: this.temporalConnection,
                        client: this.temporalClient
                    }
                };
                const agent = new AlertAgent_1.AlertAgent(agentConfig, dependencies);
                await agent.initialize();
                const worker = await this.createTemporalWorker(instanceId, agent);
                this.registerAgentInstance(instanceId, 'AlertAgent', agent, worker);
                this.logger.info(`✅ AlertAgent instance ${instanceId} deployed`, {
                    subscriptions: subscriptions.length,
                    notificationChannels: notificationChannels.length
                });
            }
            catch (error) {
                this.logger.error(`❌ Failed to deploy AlertAgent instance ${instanceId}`, { error });
                throw error;
            }
        }
    }
    /**
     * Deploy FeedAgent instances for data ingestion
     */
    async deployFeedAgents() {
        const { instances, pollInterval, apiSources } = this.config.agents.feed;
        for (let i = 0; i < instances; i++) {
            const instanceId = `feed-agent-${i + 1}`;
            try {
                const agentConfig = {
                    agentId: instanceId,
                    agentType: 'FeedAgent',
                    processInterval: pollInterval,
                    healthCheckInterval: this.config.performance.healthCheckInterval,
                    retryPolicy: {
                        maxAttempts: 5,
                        backoffMultiplier: 2,
                        maxBackoffMs: 60000
                    },
                    // Feed-specific configuration
                    apiSources,
                    dualApiOptimization: true,
                    dataValidation: true
                };
                const dependencies = {
                    logger: this.logger.child({ agentId: instanceId }),
                    supabase: null,
                    redis: this.redis,
                    temporal: {
                        connection: this.temporalConnection,
                        client: this.temporalClient
                    }
                };
                const agent = new FeedAgent_1.FeedAgent(agentConfig, dependencies);
                await agent.initialize();
                const worker = await this.createTemporalWorker(instanceId, agent);
                this.registerAgentInstance(instanceId, 'FeedAgent', agent, worker);
                this.logger.info(`✅ FeedAgent instance ${instanceId} deployed`, {
                    pollInterval,
                    apiSources: apiSources.length
                });
            }
            catch (error) {
                this.logger.error(`❌ Failed to deploy FeedAgent instance ${instanceId}`, { error });
                throw error;
            }
        }
    }
    /**
     * Deploy RecapAgent instances for analytics
     */
    async deployRecapAgents() {
        const { instances, reportInterval, metricsRetention } = this.config.agents.recap;
        for (let i = 0; i < instances; i++) {
            const instanceId = `recap-agent-${i + 1}`;
            try {
                const agentConfig = {
                    agentId: instanceId,
                    agentType: 'RecapAgent',
                    processInterval: reportInterval,
                    healthCheckInterval: this.config.performance.healthCheckInterval,
                    retryPolicy: {
                        maxAttempts: 3,
                        backoffMultiplier: 2,
                        maxBackoffMs: 30000
                    },
                    // Recap-specific configuration
                    metricsRetention,
                    analyticsEnabled: true,
                    performanceTracking: true
                };
                const dependencies = {
                    logger: this.logger.child({ agentId: instanceId }),
                    supabase: null,
                    redis: this.redis,
                    temporal: {
                        connection: this.temporalConnection,
                        client: this.temporalClient
                    }
                };
                const agent = new RecapAgent_1.RecapAgent(agentConfig, dependencies);
                await agent.initialize();
                const worker = await this.createTemporalWorker(instanceId, agent);
                this.registerAgentInstance(instanceId, 'RecapAgent', agent, worker);
                this.logger.info(`✅ RecapAgent instance ${instanceId} deployed`, {
                    reportInterval,
                    metricsRetention
                });
            }
            catch (error) {
                this.logger.error(`❌ Failed to deploy RecapAgent instance ${instanceId}`, { error });
                throw error;
            }
        }
    }
    /**
     * Deploy OperatorAgent instances for system maintenance
     */
    async deployOperatorAgents() {
        const { instances, healthCheckInterval, maintenanceSchedule } = this.config.agents.operator;
        for (let i = 0; i < instances; i++) {
            const instanceId = `operator-agent-${i + 1}`;
            try {
                const agentConfig = {
                    agentId: instanceId,
                    agentType: 'OperatorAgent',
                    processInterval: healthCheckInterval,
                    healthCheckInterval: this.config.performance.healthCheckInterval,
                    retryPolicy: {
                        maxAttempts: 2,
                        backoffMultiplier: 1.5,
                        maxBackoffMs: 10000
                    },
                    // Operator-specific configuration
                    maintenanceSchedule,
                    systemMonitoring: true,
                    autoRepair: true
                };
                const dependencies = {
                    logger: this.logger.child({ agentId: instanceId }),
                    supabase: null,
                    redis: this.redis,
                    temporal: {
                        connection: this.temporalConnection,
                        client: this.temporalClient
                    }
                };
                const agent = new OperatorAgent_1.OperatorAgent(agentConfig, dependencies);
                await agent.initialize();
                const worker = await this.createTemporalWorker(instanceId, agent);
                this.registerAgentInstance(instanceId, 'OperatorAgent', agent, worker);
                this.logger.info(`✅ OperatorAgent instance ${instanceId} deployed`, {
                    healthCheckInterval,
                    maintenanceSchedule
                });
            }
            catch (error) {
                this.logger.error(`❌ Failed to deploy OperatorAgent instance ${instanceId}`, { error });
                throw error;
            }
        }
    }
    /**
     * Create a Temporal worker for an agent
     */
    async createTemporalWorker(instanceId, agent) {
        const worker = await worker_1.Worker.create({
            connection: this.temporalConnection,
            taskQueue: `${this.config.temporal.taskQueue}-${instanceId}`,
            workflowsPath: require.resolve('../workflows'),
            activitiesPath: require.resolve('../activities'),
            maxConcurrentWorkflowTaskExecutions: this.config.temporal.maxConcurrentWorkflows,
            maxConcurrentActivityTaskExecutions: this.config.temporal.maxConcurrentActivities,
            identity: instanceId
        });
        return worker;
    }
    /**
     * Register an agent instance in the orchestration system
     */
    registerAgentInstance(instanceId, agentType, agent, worker) {
        const agentInstance = {
            id: instanceId,
            type: agentType,
            agent,
            worker,
            metrics: {
                agentType,
                instanceId,
                status: 'healthy',
                processedCount: 0,
                errorCount: 0,
                averageProcessingTime: 0,
                lastActivityAt: new Date(),
                memoryUsage: 0,
                cpuUsage: 0
            },
            lastHeartbeat: new Date()
        };
        this.agents.set(instanceId, agentInstance);
        // Setup agent event listeners
        this.setupAgentEventListeners(agentInstance);
    }
    /**
     * Setup event listeners for agent instances
     */
    setupAgentEventListeners(agentInstance) {
        const { agent, metrics } = agentInstance;
        // Listen for agent processing events
        agent.on('processed', (data) => {
            metrics.processedCount += data.count || 1;
            metrics.averageProcessingTime = (metrics.averageProcessingTime + data.processingTime) / 2;
            metrics.lastActivityAt = new Date();
            agentInstance.lastHeartbeat = new Date();
        });
        // Listen for agent errors
        agent.on('error', (error) => {
            metrics.errorCount++;
            metrics.lastActivityAt = new Date();
            this.logger.warn(`⚠️ Agent ${agentInstance.id} reported error`, {
                agentType: agentInstance.type,
                error: error.message
            });
        });
        // Listen for health status changes
        agent.on('health-changed', (status) => {
            metrics.status = status;
            this.logger.info(`🏥 Agent ${agentInstance.id} health changed to ${status}`);
        });
    }
    /**
     * Setup inter-agent coordination
     */
    async setupAgentCoordination() {
        this.logger.info('🔗 Setting up inter-agent coordination...');
        // Setup Redis pub/sub for agent coordination
        const coordinationRedis = this.redis.duplicate();
        // Subscribe to coordination events
        await coordinationRedis.subscribe(this.coordinationChannel);
        coordinationRedis.on('message', async (channel, message) => {
            try {
                const event = JSON.parse(message);
                await this.handleCoordinationEvent(event);
            }
            catch (error) {
                this.logger.error('❌ Failed to handle coordination event', { error, message });
            }
        });
        // Setup periodic coordination heartbeat
        setInterval(() => {
            this.publishCoordinationHeartbeat();
        }, 30000); // 30 seconds
        this.logger.info('✅ Inter-agent coordination established');
    }
    /**
     * Handle coordination events between agents
     */
    async handleCoordinationEvent(event) {
        const { type, sourceAgent, targetAgent, data } = event;
        switch (type) {
            case 'high_priority_props':
                // Alert scoring agents about high-priority props
                await this.routeHighPriorityProps(data.props);
                break;
            case 'market_change':
                // Notify relevant agents about market changes
                await this.handleMarketChange(data);
                break;
            case 'system_alert':
                // Handle system-level alerts
                await this.handleSystemAlert(data);
                break;
            case 'load_balancing':
                // Handle load balancing between agent instances
                await this.handleLoadBalancing(data);
                break;
            default:
                this.logger.debug('🔗 Unknown coordination event type', { type, event });
        }
    }
    /**
     * Route high-priority props to available scoring agents
     */
    async routeHighPriorityProps(props) {
        const scoringAgents = Array.from(this.agents.values())
            .filter(agent => agent.type === 'ScoringAgent' && agent.metrics.status === 'healthy');
        if (scoringAgents.length === 0) {
            this.logger.error('❌ No healthy scoring agents available for high-priority props');
            return;
        }
        // Distribute props across available scoring agents
        const propsPerAgent = Math.ceil(props.length / scoringAgents.length);
        for (let i = 0; i < scoringAgents.length; i++) {
            const agentProps = props.slice(i * propsPerAgent, (i + 1) * propsPerAgent);
            if (agentProps.length > 0) {
                // Use scoring pipeline for optimal processing
                await this.scoringPipeline.addHighPriorityProps(agentProps);
            }
        }
        this.logger.info('🔥 Routed high-priority props to scoring agents', {
            totalProps: props.length,
            availableAgents: scoringAgents.length
        });
    }
    /**
     * Start health monitoring for all agents
     */
    startHealthMonitoring() {
        this.healthCheckInterval = setInterval(async () => {
            await this.performHealthChecks();
        }, this.config.performance.healthCheckInterval);
    }
    /**
     * Perform health checks on all agents
     */
    async performHealthChecks() {
        for (const [instanceId, agentInstance] of this.agents.entries()) {
            try {
                const healthResult = await agentInstance.agent.checkHealth();
                agentInstance.metrics.status = healthResult.status;
                // Check for stale agents (no heartbeat)
                const lastHeartbeat = agentInstance.lastHeartbeat.getTime();
                const staleThreshold = Date.now() - (this.config.performance.healthCheckInterval * 3);
                if (lastHeartbeat < staleThreshold) {
                    agentInstance.metrics.status = 'unhealthy';
                    this.logger.warn(`⚠️ Agent ${instanceId} appears stale`, {
                        lastHeartbeat: agentInstance.lastHeartbeat,
                        agentType: agentInstance.type
                    });
                }
            }
            catch (error) {
                agentInstance.metrics.status = 'unhealthy';
                this.logger.error(`❌ Health check failed for agent ${instanceId}`, { error });
            }
        }
        // Update orchestration metrics
        this.updateOrchestrationMetrics();
    }
    /**
     * Start metrics collection
     */
    startMetricsCollection() {
        this.metricsInterval = setInterval(() => {
            this.collectAndEmitMetrics();
        }, 30000); // 30 seconds
    }
    /**
     * Collect and emit orchestration metrics
     */
    collectAndEmitMetrics() {
        this.updateOrchestrationMetrics();
        // Emit metrics for monitoring
        this.emit('orchestration:metrics', {
            orchestration: this.orchestrationMetrics,
            agents: Array.from(this.agents.values()).map(agent => agent.metrics)
        });
        // Log key metrics
        this.logger.info('📊 Orchestration metrics', {
            totalAgents: this.orchestrationMetrics.totalAgents,
            healthyAgents: this.orchestrationMetrics.healthyAgents,
            totalThroughput: this.orchestrationMetrics.totalThroughput,
            overallLatency: this.orchestrationMetrics.overallLatency,
            errorRate: this.orchestrationMetrics.errorRate
        });
    }
    /**
     * Update orchestration-level metrics
     */
    updateOrchestrationMetrics() {
        const agents = Array.from(this.agents.values());
        this.orchestrationMetrics.totalAgents = agents.length;
        this.orchestrationMetrics.healthyAgents = agents.filter(a => a.metrics.status === 'healthy').length;
        // Calculate aggregate throughput (props per hour)
        const totalProcessed = agents.reduce((sum, a) => sum + a.metrics.processedCount, 0);
        const avgProcessingTime = agents.reduce((sum, a) => sum + a.metrics.averageProcessingTime, 0) / agents.length;
        this.orchestrationMetrics.totalThroughput = Math.round((totalProcessed / (avgProcessingTime / 1000)) * 3600);
        this.orchestrationMetrics.overallLatency = avgProcessingTime;
        // Calculate error rate
        const totalErrors = agents.reduce((sum, a) => sum + a.metrics.errorCount, 0);
        this.orchestrationMetrics.errorRate = totalProcessed > 0 ? (totalErrors / totalProcessed) * 100 : 0;
        // System load (simplified calculation)
        this.orchestrationMetrics.systemLoad = (this.orchestrationMetrics.healthyAgents / this.orchestrationMetrics.totalAgents) * 100;
    }
    /**
     * Publish coordination heartbeat
     */
    async publishCoordinationHeartbeat() {
        const heartbeat = {
            type: 'orchestration_heartbeat',
            timestamp: new Date().toISOString(),
            metrics: this.orchestrationMetrics,
            agentSummary: {
                total: this.orchestrationMetrics.totalAgents,
                healthy: this.orchestrationMetrics.healthyAgents,
                throughput: this.orchestrationMetrics.totalThroughput
            }
        };
        await this.redis.publish(this.coordinationChannel, JSON.stringify(heartbeat));
    }
    // Helper methods
    async initializeTemporalConnection() {
        this.temporalConnection = await client_1.Connection.connect({
            address: process.env.TEMPORAL_SERVER_URL || 'localhost:7233'
        });
        this.temporalClient = new client_1.Client({
            connection: this.temporalConnection
        });
    }
    setupRedisConnection() {
        this.redis = new ioredis_1.default({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            maxRetriesPerRequest: 3,
            lazyConnect: true
        });
        this.redis.on('error', (error) => {
            this.logger.error('❌ Redis orchestration connection error', { error });
        });
    }
    calculateTotalInstances() {
        return Object.values(this.config.agents).reduce((sum, agentConfig) => sum + agentConfig.instances, 0);
    }
    initializeMetrics() {
        this.orchestrationMetrics = {
            totalAgents: 0,
            healthyAgents: 0,
            totalThroughput: 0,
            overallLatency: 0,
            errorRate: 0,
            systemLoad: 0,
            coordinationLatency: 0
        };
    }
    async handleMarketChange(data) {
        // Implement market change handling
        this.logger.info('📈 Handling market change', { data });
    }
    async handleSystemAlert(data) {
        // Implement system alert handling
        this.logger.warn('🚨 System alert received', { data });
    }
    async handleLoadBalancing(data) {
        // Implement load balancing logic
        this.logger.info('⚖️ Handling load balancing', { data });
    }
    /**
     * Get orchestration system status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            orchestrationMetrics: this.orchestrationMetrics,
            agents: Array.from(this.agents.values()).map(agent => ({
                id: agent.id,
                type: agent.type,
                status: agent.metrics.status,
                processedCount: agent.metrics.processedCount,
                errorCount: agent.metrics.errorCount,
                lastActivity: agent.metrics.lastActivityAt
            })),
            config: this.config
        };
    }
    /**
     * Scale agent instances up or down
     */
    async scaleAgents(agentType, targetInstances) {
        this.logger.info(`🔧 Scaling ${agentType} agents to ${targetInstances} instances`);
        const currentInstances = Array.from(this.agents.values())
            .filter(agent => agent.type === agentType).length;
        if (targetInstances > currentInstances) {
            // Scale up
            const instancesToAdd = targetInstances - currentInstances;
            // Implementation for scaling up specific agent types
            this.logger.info(`📈 Scaling up ${agentType} by ${instancesToAdd} instances`);
        }
        else if (targetInstances < currentInstances) {
            // Scale down
            const instancesToRemove = currentInstances - targetInstances;
            // Implementation for scaling down specific agent types
            this.logger.info(`📉 Scaling down ${agentType} by ${instancesToRemove} instances`);
        }
    }
    /**
     * Shutdown the orchestration system gracefully
     */
    async shutdown() {
        this.logger.info('🛑 Shutting down Agent Orchestration System...');
        this.isRunning = false;
        // Stop monitoring intervals
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        // Shutdown all agents
        for (const [instanceId, agentInstance] of this.agents.entries()) {
            try {
                await agentInstance.agent.cleanup();
                if (agentInstance.worker) {
                    agentInstance.worker.shutdown();
                }
                this.logger.info(`✅ Agent ${instanceId} shutdown completed`);
            }
            catch (error) {
                this.logger.error(`❌ Failed to shutdown agent ${instanceId}`, { error });
            }
        }
        // Close connections
        this.redis.disconnect();
        this.temporalConnection.close();
        this.emit('orchestration:shutdown');
        this.logger.info('✅ Agent Orchestration System shutdown completed');
    }
}
exports.AgentOrchestrationSystem = AgentOrchestrationSystem;
// Default production configuration
const createProductionOrchestrationConfig = () => ({
    agents: {
        scoring: {
            instances: 4,
            batchSize: 50,
            processingTimeout: 5000
        },
        alerts: {
            instances: 2,
            subscriptions: ['injury_alerts', 'steam_moves', 'hedge_opportunities'],
            notificationChannels: ['discord', 'webhook']
        },
        feed: {
            instances: 2,
            pollInterval: 60000, // 1 minute
            apiSources: ['optimal', 'odds-api']
        },
        recap: {
            instances: 1,
            reportInterval: 300000, // 5 minutes
            metricsRetention: 86400000 // 24 hours
        },
        operator: {
            instances: 1,
            healthCheckInterval: 30000, // 30 seconds
            maintenanceSchedule: '0 2 * * *' // 2 AM daily
        }
    },
    temporal: {
        taskQueue: 'unit-talk-production',
        maxConcurrentWorkflows: 100,
        maxConcurrentActivities: 200
    },
    performance: {
        targetThroughputPerHour: 1000,
        maxLatencyMs: 2000,
        errorThreshold: 5.0,
        healthCheckInterval: 30000
    },
    coordination: {
        messageQueue: 'agent-coordination',
        eventBus: 'orchestration-events',
        stateSync: 'agent-state',
        leaderElection: true
    }
});
exports.createProductionOrchestrationConfig = createProductionOrchestrationConfig;
