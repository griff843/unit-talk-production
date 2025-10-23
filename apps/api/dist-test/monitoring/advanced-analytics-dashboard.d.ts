/**
 * PHASE D: ADVANCED ANALYTICS DASHBOARD & LIVE MONITORING SYSTEM
 *
 * Fortune 100-grade analytics platform with predictive intelligence,
 * real-time performance monitoring, and business intelligence dashboards.
 *
 * Features:
 * - Real-time agent performance analytics
 * - Predictive betting intelligence insights
 * - Live monitoring with automated alerting
 * - Business KPI tracking and forecasting
 * - Interactive data visualization dashboards
 * - Automated report generation and distribution
 */
import { EventEmitter } from 'events';
export interface AnalyticsConfig {
    enabled: boolean;
    realTimeUpdates: boolean;
    predictiveAnalytics: boolean;
    businessIntelligence: boolean;
    customDashboards: boolean;
    automaticReporting: boolean;
    updateInterval: number;
    retentionDays: number;
    alertThresholds: AlertThresholds;
}
export interface AlertThresholds {
    agentResponseTime: number;
    errorRate: number;
    pickAccuracy: number;
    userEngagement: number;
    systemLoad: number;
    diskUsage: number;
}
export interface BusinessMetrics {
    revenue: {
        daily: number;
        weekly: number;
        monthly: number;
        trend: 'up' | 'down' | 'stable';
        forecast: number;
    };
    users: {
        active: number;
        new: number;
        retained: number;
        churnRate: number;
        engagement: number;
    };
    picks: {
        total: number;
        accuracy: number;
        avgROI: number;
        topTier: number;
        conversionRate: number;
    };
    agents: {
        totalOperations: number;
        avgResponseTime: number;
        errorRate: number;
        healthScore: number;
        efficiency: number;
    };
}
export interface PredictiveInsights {
    marketTrends: {
        sport: string;
        prediction: 'bullish' | 'bearish' | 'neutral';
        confidence: number;
        timeframe: string;
        factors: string[];
    }[];
    userBehavior: {
        churnRisk: number;
        engagementTrend: 'increasing' | 'decreasing' | 'stable';
        valueSegment: 'high' | 'medium' | 'low';
        predictedActions: string[];
    };
    systemPerformance: {
        loadForecast: number;
        bottleneckRisk: string[];
        recommendedActions: string[];
        maintenanceWindow: string;
    };
}
export interface LiveMonitoringData {
    timestamp: string;
    system: {
        status: 'healthy' | 'degraded' | 'critical';
        load: number;
        memory: number;
        disk: number;
        network: number;
    };
    agents: {
        [agentName: string]: {
            status: 'online' | 'offline' | 'degraded';
            responseTime: number;
            throughput: number;
            errorRate: number;
            lastUpdate: string;
        };
    };
    business: BusinessMetrics;
    alerts: AlertData[];
}
export interface AlertData {
    id: string;
    severity: 'info' | 'warning' | 'critical';
    category: 'system' | 'business' | 'agent' | 'user';
    title: string;
    description: string;
    timestamp: string;
    acknowledged: boolean;
    source: string;
    metadata: Record<string, any>;
}
export interface DashboardWidget {
    id: string;
    type: 'chart' | 'kpi' | 'table' | 'gauge' | 'timeline' | 'heatmap';
    title: string;
    description: string;
    dataSource: string;
    refreshInterval: number;
    config: {
        chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
        timeRange?: '1h' | '24h' | '7d' | '30d';
        metrics?: string[];
        filters?: Record<string, any>;
        aggregation?: 'sum' | 'avg' | 'max' | 'min' | 'count';
    };
    position: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
/**
 * Advanced Analytics Dashboard System
 */
export declare class AdvancedAnalyticsDashboard extends EventEmitter {
    private config;
    private supabase;
    private metrics;
    private server;
    private wsServer;
    private updateInterval;
    private currentData;
    private connectedClients;
    constructor(config: AnalyticsConfig);
    /**
     * Initialize the advanced analytics system
     */
    initialize(): Promise<void>;
    /**
     * Start the analytics server with REST API and WebSocket support
     */
    private startAnalyticsServer;
    /**
     * Handle HTTP requests for analytics data
     */
    private handleHttpRequest;
    /**
     * Handle WebSocket connections for real-time updates
     */
    private handleWebSocketConnection;
    /**
     * Start real-time monitoring system
     */
    private startRealTimeMonitoring;
    /**
     * Collect live monitoring data
     */
    private collectLiveData;
    /**
     * Get business metrics and KPIs
     */
    private getBusinessMetrics;
    /**
     * Generate predictive insights using analytics
     */
    private getPredictiveInsights;
    /**
     * Get analytics overview
     */
    private getAnalyticsOverview;
    /**
     * Get agent-specific analytics
     */
    private getAgentAnalytics;
    /**
     * Get active alerts
     */
    private getActiveAlerts;
    /**
     * Check alert conditions and trigger notifications
     */
    private checkAlertConditions;
    /**
     * Broadcast data to all connected WebSocket clients
     */
    private broadcastToClients;
    /**
     * Verify database and external service connections
     */
    private verifyConnections;
    /**
     * Start predictive analytics engine
     */
    private startPredictiveAnalytics;
    /**
     * Start business intelligence engine
     */
    private startBusinessIntelligence;
    /**
     * Generate advanced dashboard HTML
     */
    private getAdvancedDashboardHTML;
    /**
     * Stop the analytics system
     */
    stop(): Promise<void>;
}
export declare const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig;
export declare function createAdvancedAnalyticsDashboard(config?: Partial<AnalyticsConfig>): Promise<AdvancedAnalyticsDashboard>;
//# sourceMappingURL=advanced-analytics-dashboard.d.ts.map