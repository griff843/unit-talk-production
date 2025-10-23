import { EventEmitter } from 'events';
import { Logger } from '../shared/logger/types';
import { AgentMetricsCollector } from './AgentMetricsCollector';
interface DashboardWidget {
    id: string;
    type: 'chart' | 'gauge' | 'table' | 'alert' | 'status';
    title: string;
    agentName?: string;
    metricName?: string;
    config: Record<string, any>;
    position: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
interface DashboardLayout {
    id: string;
    name: string;
    description: string;
    widgets: DashboardWidget[];
    createdAt: Date;
    updatedAt: Date;
}
interface AlertSummary {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    recent: Array<{
        id: string;
        agentName: string;
        severity: string;
        message: string;
        timestamp: Date;
    }>;
}
interface SystemOverview {
    totalAgents: number;
    healthyAgents: number;
    degradedAgents: number;
    criticalAgents: number;
    downAgents: number;
    totalOperations: number;
    averageResponseTime: number;
    systemHealth: number;
    uptime: number;
}
export declare class AgentMonitoringDashboard extends EventEmitter {
    private readonly logger;
    private readonly metricsCollector;
    private dashboardLayouts;
    private activeConnections;
    private updateInterval;
    constructor(logger: Logger, metricsCollector: AgentMetricsCollector);
    initialize(): Promise<void>;
    getSystemOverview(): Promise<SystemOverview>;
    getAlertSummary(): Promise<AlertSummary>;
    getAgentDetailedMetrics(agentName: string, timeframe?: 'last_hour' | 'last_day' | 'last_week'): Promise<any>;
    createDashboardLayout(layout: Omit<DashboardLayout, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
    updateDashboardLayout(id: string, updates: Partial<DashboardLayout>): Promise<boolean>;
    deleteDashboardLayout(id: string): Promise<boolean>;
    getDashboardLayouts(): Promise<DashboardLayout[]>;
    getDashboardLayout(id: string): Promise<DashboardLayout | null>;
    exportDashboardData(format: 'json' | 'excel' | 'pdf'): Promise<string>;
    getPerformanceReport(agentName?: string, days?: number): Promise<any>;
    registerConnection(connectionId: string): void;
    unregisterConnection(connectionId: string): void;
    broadcastUpdate(data: any): void;
    private calculateAgentInsights;
    private calculateTrend;
    private generateRecommendations;
    private setupMetricsCollectorListeners;
    private startPeriodicUpdates;
    private createDefaultLayouts;
    private convertToExcel;
    private convertToPDF;
    private loadDashboardLayouts;
    private saveDashboardLayouts;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=AgentMonitoringDashboard.d.ts.map