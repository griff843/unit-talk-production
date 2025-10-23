import { BaseAgent } from '../agents/BaseAgent';
import { Logger } from '../shared/logger/types';
import { AgentMetricsCollector } from './AgentMetricsCollector';
export declare class AgentMonitoringIntegration {
    private readonly logger;
    private readonly metricsCollector;
    private adapters;
    private monitoringInterval;
    private registeredAgents;
    constructor(logger: Logger, metricsCollector: AgentMetricsCollector);
    initialize(): Promise<void>;
    registerAgent(agent: BaseAgent): void;
    unregisterAgent(agentName: string): void;
    collectAllAgentMetrics(): Promise<void>;
    private collectAgentMetrics;
    private getPerformanceMetrics;
    private measureResponseTime;
    private calculateThroughput;
    private calculateErrorRate;
    private calculateSuccessRate;
    private getCircuitBreakerMetrics;
    private setupAdapters;
    private setupAgentEventListeners;
    private setupOnboardingAgentListeners;
    private setupRetentionAgentListeners;
    private setupRiskAgentListeners;
    private setupPredictiveAgentListeners;
    private setupPerformanceAgentListeners;
    private startMonitoring;
    getIntegrationStatus(): Promise<any>;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=AgentMonitoringIntegration.d.ts.map