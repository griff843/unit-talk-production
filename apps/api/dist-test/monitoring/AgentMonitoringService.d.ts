import { EventEmitter } from 'events';
import { BaseAgent } from '../agents/BaseAgent';
import { Logger } from '../shared/logger/types';
import { AgentMetricsCollector } from './AgentMetricsCollector';
import { AgentMonitoringDashboard } from './AgentMonitoringDashboard';
import { AgentMonitoringIntegration } from './AgentMonitoringIntegration';
interface MonitoringConfig {
    enabled: boolean;
    metricsCollectionInterval: number;
    dashboardUpdateInterval: number;
    alertingEnabled: boolean;
    exportFormats: string[];
    retentionPeriod: number;
}
interface ServiceStatus {
    status: 'healthy' | 'degraded' | 'critical' | 'down';
    components: {
        metricsCollector: boolean;
        dashboard: boolean;
        integration: boolean;
        alerting: boolean;
    };
    uptime: number;
    lastUpdate: Date;
    version: string;
}
export declare class AgentMonitoringService extends EventEmitter {
    private readonly logger;
    private readonly config;
    private metricsCollector;
    private dashboard;
    private integration;
    private isInitialized;
    private startTime;
    private healthCheckInterval;
    constructor(logger: Logger, config?: Partial<MonitoringConfig>);
    initialize(): Promise<void>;
    registerAgent(agent: BaseAgent): Promise<void>;
    unregisterAgent(agentName: string): Promise<void>;
    getServiceStatus(): Promise<ServiceStatus>;
    getSystemOverview(): Promise<any>;
    getAgentMetrics(agentName: string, timeframe?: 'last_hour' | 'last_day' | 'last_week'): Promise<any>;
    getAlertSummary(): Promise<any>;
    createAlertRule(rule: any): Promise<string>;
    exportMetrics(agentName: string, format: 'json' | 'csv' | 'prometheus', timeframe: 'last_hour' | 'last_day' | 'last_week'): Promise<string>;
    generatePerformanceReport(agentName?: string, days?: number): Promise<any>;
    createDashboard(layout: any): Promise<string>;
    getDashboards(): Promise<any[]>;
    registerDashboardConnection(connectionId: string): void;
    unregisterDashboardConnection(connectionId: string): void;
    onMetricsUpdate(callback: (metrics: any) => void): void;
    onAlertTriggered(callback: (alert: any) => void): void;
    onSystemHealthChange(callback: (health: any) => void): void;
    private checkComponentHealth;
    private setupEventHandlers;
    private startHealthMonitoring;
    private createDefaultAlertRules;
    private setupCleanupHandlers;
    cleanup(): Promise<void>;
    static create(logger: Logger, config?: Partial<MonitoringConfig>): Promise<AgentMonitoringService>;
    get metrics(): AgentMetricsCollector;
    get dashboardService(): AgentMonitoringDashboard;
    get integrationService(): AgentMonitoringIntegration;
    get configuration(): MonitoringConfig;
    get initialized(): boolean;
}
export {};
//# sourceMappingURL=AgentMonitoringService.d.ts.map