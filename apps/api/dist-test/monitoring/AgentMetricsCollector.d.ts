import { EventEmitter } from 'events';
import { Logger } from '../shared/logger/types';
interface AgentMetrics {
    agentName: string;
    timestamp: Date;
    performance: {
        cpuUsage: number;
        memoryUsage: number;
        responseTime: number;
        throughput: number;
        errorRate: number;
        successRate: number;
    };
    business: {
        operationsCompleted: number;
        predictionsGenerated?: number;
        usersProcessed?: number;
        optimizationsApplied?: number;
        alertsTriggered?: number;
        behaviorEventsTracked?: number;
        conversationsGenerated?: number;
        churnPredictionsGenerated?: number;
        segmentationUpdates?: number;
    };
    health: {
        status: 'healthy' | 'degraded' | 'critical' | 'down';
        score: number;
        dependencies: Record<string, 'healthy' | 'degraded' | 'critical'>;
        lastHealthCheck: Date;
    };
    cache: {
        hitRate: number;
        missRate: number;
        operations: number;
        averageLatency: number;
    };
    circuitBreaker: {
        state: 'closed' | 'open' | 'half-open';
        failures: number;
        successes: number;
        lastFailure?: Date;
    };
}
interface MetricsAggregation {
    agentName: string;
    timeframe: string;
    avgResponseTime: number;
    totalOperations: number;
    errorRate: number;
    availabilityPercentage: number;
    throughputTrend: number[];
    memoryTrend: number[];
    performanceScore: number;
}
interface AlertRule {
    id: string;
    agentName: string;
    metricName: string;
    threshold: number;
    operator: '>' | '<' | '=' | '>=' | '<=';
    severity: 'low' | 'medium' | 'high' | 'critical';
    enabled: boolean;
    cooldownMinutes: number;
    lastTriggered?: Date;
}
export declare class AgentMetricsCollector extends EventEmitter {
    private readonly logger;
    private metricsBuffer;
    private alertRules;
    private collectionInterval;
    private aggregationInterval;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    collectMetrics(agentName: string, metrics: Partial<AgentMetrics>): Promise<void>;
    getAgentMetrics(agentName: string, timeframe?: 'last_hour' | 'last_day' | 'last_week'): Promise<AgentMetrics[]>;
    getAggregatedMetrics(agentName: string, timeframe: string): Promise<MetricsAggregation | null>;
    getAllAgentsStatus(): Promise<Record<string, {
        status: string;
        score: number;
        lastUpdate: Date;
    }>>;
    createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<string>;
    updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<boolean>;
    deleteAlertRule(id: string): Promise<boolean>;
    getAlertRules(agentName?: string): Promise<AlertRule[]>;
    exportMetrics(agentName: string, format: 'json' | 'csv' | 'prometheus', timeframe: 'last_hour' | 'last_day' | 'last_week'): Promise<string>;
    private storeMetricsInCache;
    private checkAlertRules;
    private evaluateAlertRule;
    private getMetricValue;
    private triggerAlert;
    private calculateAggregation;
    private startMetricsCollection;
    private startMetricsAggregation;
    private collectSystemMetrics;
    private performMetricsAggregation;
    private convertToCSV;
    private convertToPrometheus;
    private setupDefaultAlertRules;
    private loadAlertRules;
    private saveAlertRules;
    cleanup(): Promise<void>;
    isHealthy(): Promise<boolean>;
}
export {};
//# sourceMappingURL=AgentMetricsCollector.d.ts.map