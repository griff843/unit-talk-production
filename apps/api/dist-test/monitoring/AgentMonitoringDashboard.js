"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentMonitoringDashboard = void 0;
const events_1 = require("events");
const enhanced_cache_1 = require("../cache/enhanced-cache");
class AgentMonitoringDashboard extends events_1.EventEmitter {
    constructor(logger, metricsCollector) {
        super();
        this.dashboardLayouts = new Map();
        this.activeConnections = new Set();
        this.updateInterval = null;
        this.logger = logger;
        this.metricsCollector = metricsCollector;
    }
    async initialize() {
        this.logger.info('📊 Initializing AgentMonitoringDashboard');
        await this.loadDashboardLayouts();
        await this.createDefaultLayouts();
        this.setupMetricsCollectorListeners();
        this.startPeriodicUpdates();
        this.logger.info('✅ AgentMonitoringDashboard initialized');
    }
    async getSystemOverview() {
        const agentStatuses = await this.metricsCollector.getAllAgentsStatus();
        const agentNames = Object.keys(agentStatuses);
        let healthyAgents = 0;
        let degradedAgents = 0;
        let criticalAgents = 0;
        let downAgents = 0;
        let totalOperations = 0;
        let totalResponseTime = 0;
        let responseTimeCount = 0;
        for (const [agentName, status] of Object.entries(agentStatuses)) {
            switch (status.status) {
                case 'healthy':
                    healthyAgents++;
                    break;
                case 'degraded':
                    degradedAgents++;
                    break;
                case 'critical':
                    criticalAgents++;
                    break;
                case 'down':
                    downAgents++;
                    break;
            }
            // Get recent metrics for operations and response time
            try {
                const recentMetrics = await this.metricsCollector.getAgentMetrics(agentName, 'last_hour');
                if (recentMetrics.length > 0) {
                    const latest = recentMetrics[recentMetrics.length - 1];
                    totalOperations += latest.business.operationsCompleted;
                    totalResponseTime += latest.performance.responseTime;
                    responseTimeCount++;
                }
            }
            catch (error) {
                this.logger.warn('Failed to get recent metrics for overview', { agentName, error });
            }
        }
        const averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
        const systemHealth = agentNames.length > 0 ? (healthyAgents / agentNames.length) * 100 : 100;
        return {
            totalAgents: agentNames.length,
            healthyAgents,
            degradedAgents,
            criticalAgents,
            downAgents,
            totalOperations,
            averageResponseTime,
            systemHealth,
            uptime: process.uptime()
        };
    }
    async getAlertSummary() {
        try {
            const alertKeys = await enhanced_cache_1.redisCache.getPattern('agent_alert:*');
            const alerts = [];
            for (const [key, data] of alertKeys) {
                try {
                    const alert = JSON.parse(data);
                    alerts.push(alert);
                }
                catch (error) {
                    this.logger.warn('Failed to parse alert data', { key, error });
                }
            }
            // Sort by timestamp (most recent first)
            alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            const summary = {
                total: alerts.length,
                critical: alerts.filter(a => a.severity === 'critical').length,
                high: alerts.filter(a => a.severity === 'high').length,
                medium: alerts.filter(a => a.severity === 'medium').length,
                low: alerts.filter(a => a.severity === 'low').length,
                recent: alerts.slice(0, 10).map(alert => ({
                    id: alert.id,
                    agentName: alert.agentName,
                    severity: alert.severity,
                    message: alert.message,
                    timestamp: new Date(alert.timestamp)
                }))
            };
            return summary;
        }
        catch (error) {
            this.logger.error('Failed to get alert summary', { error });
            return {
                total: 0,
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                recent: []
            };
        }
    }
    async getAgentDetailedMetrics(agentName, timeframe = 'last_hour') {
        try {
            const [rawMetrics, aggregatedMetrics] = await Promise.all([
                this.metricsCollector.getAgentMetrics(agentName, timeframe),
                this.metricsCollector.getAggregatedMetrics(agentName, timeframe)
            ]);
            // Calculate additional insights
            const insights = this.calculateAgentInsights(rawMetrics);
            return {
                agent: agentName,
                timeframe,
                rawMetrics: rawMetrics.slice(-100), // Last 100 data points for charts
                aggregated: aggregatedMetrics,
                insights,
                lastUpdated: new Date()
            };
        }
        catch (error) {
            this.logger.error('Failed to get detailed metrics', { agentName, timeframe, error });
            return null;
        }
    }
    async createDashboardLayout(layout) {
        const id = `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const dashboardLayout = {
            ...layout,
            id,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.dashboardLayouts.set(id, dashboardLayout);
        await this.saveDashboardLayouts();
        this.logger.info('Dashboard layout created', { id, name: layout.name });
        return id;
    }
    async updateDashboardLayout(id, updates) {
        const layout = this.dashboardLayouts.get(id);
        if (!layout)
            return false;
        Object.assign(layout, updates, { updatedAt: new Date() });
        await this.saveDashboardLayouts();
        this.logger.info('Dashboard layout updated', { id, updates });
        return true;
    }
    async deleteDashboardLayout(id) {
        const deleted = this.dashboardLayouts.delete(id);
        if (deleted) {
            await this.saveDashboardLayouts();
            this.logger.info('Dashboard layout deleted', { id });
        }
        return deleted;
    }
    async getDashboardLayouts() {
        return Array.from(this.dashboardLayouts.values());
    }
    async getDashboardLayout(id) {
        return this.dashboardLayouts.get(id) || null;
    }
    async exportDashboardData(format) {
        const overview = await this.getSystemOverview();
        const alerts = await this.getAlertSummary();
        const agentStatuses = await this.metricsCollector.getAllAgentsStatus();
        const exportData = {
            timestamp: new Date(),
            overview,
            alerts,
            agents: agentStatuses,
            metadata: {
                format,
                exportedBy: 'AgentMonitoringDashboard',
                version: '1.0.0'
            }
        };
        switch (format) {
            case 'json':
                return JSON.stringify(exportData, null, 2);
            case 'excel':
                return this.convertToExcel(exportData);
            case 'pdf':
                return this.convertToPDF(exportData);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    async getPerformanceReport(agentName, days = 7) {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
        const agentsToAnalyze = agentName ? [agentName] : Object.keys(await this.metricsCollector.getAllAgentsStatus());
        const report = {
            timeframe: { startDate, endDate, days },
            agents: [],
            summary: {
                totalAgents: agentsToAnalyze.length,
                averagePerformanceScore: 0,
                totalOperations: 0,
                averageResponseTime: 0,
                systemReliability: 0
            }
        };
        let totalPerformanceScore = 0;
        let totalOperations = 0;
        let totalResponseTime = 0;
        let healthyPeriods = 0;
        let totalPeriods = 0;
        for (const agent of agentsToAnalyze) {
            try {
                const metrics = await this.metricsCollector.getAgentMetrics(agent, 'last_week');
                const insights = this.calculateAgentInsights(metrics);
                const agentReport = {
                    agentName: agent,
                    performanceScore: insights.performanceScore,
                    reliability: insights.reliability,
                    totalOperations: insights.totalOperations,
                    averageResponseTime: insights.averageResponseTime,
                    trends: insights.trends,
                    recommendations: this.generateRecommendations(insights)
                };
                report.agents.push(agentReport);
                totalPerformanceScore += insights.performanceScore;
                totalOperations += insights.totalOperations;
                totalResponseTime += insights.averageResponseTime;
                healthyPeriods += metrics.filter(m => m.health.status === 'healthy').length;
                totalPeriods += metrics.length;
            }
            catch (error) {
                this.logger.error('Failed to generate report for agent', { agent, error });
            }
        }
        report.summary.averagePerformanceScore = totalPerformanceScore / agentsToAnalyze.length;
        report.summary.totalOperations = totalOperations;
        report.summary.averageResponseTime = totalResponseTime / agentsToAnalyze.length;
        report.summary.systemReliability = totalPeriods > 0 ? (healthyPeriods / totalPeriods) * 100 : 100;
        return report;
    }
    registerConnection(connectionId) {
        this.activeConnections.add(connectionId);
        this.logger.debug('Dashboard connection registered', { connectionId, totalConnections: this.activeConnections.size });
    }
    unregisterConnection(connectionId) {
        this.activeConnections.delete(connectionId);
        this.logger.debug('Dashboard connection unregistered', { connectionId, totalConnections: this.activeConnections.size });
    }
    broadcastUpdate(data) {
        if (this.activeConnections.size > 0) {
            this.emit('dashboard_update', data);
            this.logger.debug('Dashboard update broadcasted', { connections: this.activeConnections.size });
        }
    }
    calculateAgentInsights(metrics) {
        if (metrics.length === 0) {
            return {
                performanceScore: 0,
                reliability: 0,
                totalOperations: 0,
                averageResponseTime: 0,
                trends: { performance: 'stable', memory: 'stable', throughput: 'stable' }
            };
        }
        const totalOperations = metrics.reduce((sum, m) => sum + m.business.operationsCompleted, 0);
        const totalResponseTime = metrics.reduce((sum, m) => sum + m.performance.responseTime, 0);
        const averageResponseTime = totalResponseTime / metrics.length;
        const healthyCount = metrics.filter(m => m.health.status === 'healthy').length;
        const reliability = (healthyCount / metrics.length) * 100;
        const avgErrorRate = metrics.reduce((sum, m) => sum + m.performance.errorRate, 0) / metrics.length;
        const avgMemoryUsage = metrics.reduce((sum, m) => sum + m.performance.memoryUsage, 0) / metrics.length;
        const performanceScore = Math.max(0, Math.min(100, (100 - (averageResponseTime / 10)) * 0.3 +
            (100 - (avgErrorRate * 100)) * 0.4 +
            reliability * 0.3));
        // Calculate trends (simplified)
        const recentMetrics = metrics.slice(-10);
        const olderMetrics = metrics.slice(-20, -10);
        const trends = {
            performance: this.calculateTrend(olderMetrics.map(m => m.performance.responseTime), recentMetrics.map(m => m.performance.responseTime)),
            memory: this.calculateTrend(olderMetrics.map(m => m.performance.memoryUsage), recentMetrics.map(m => m.performance.memoryUsage)),
            throughput: this.calculateTrend(olderMetrics.map(m => m.performance.throughput), recentMetrics.map(m => m.performance.throughput))
        };
        return {
            performanceScore,
            reliability,
            totalOperations,
            averageResponseTime,
            avgErrorRate,
            avgMemoryUsage,
            trends
        };
    }
    calculateTrend(oldValues, newValues) {
        if (oldValues.length === 0 || newValues.length === 0)
            return 'stable';
        const oldAvg = oldValues.reduce((sum, val) => sum + val, 0) / oldValues.length;
        const newAvg = newValues.reduce((sum, val) => sum + val, 0) / newValues.length;
        const change = (newAvg - oldAvg) / oldAvg;
        if (change > 0.1)
            return 'degrading'; // 10% increase (worse for response time, memory)
        if (change < -0.1)
            return 'improving'; // 10% decrease (better)
        return 'stable';
    }
    generateRecommendations(insights) {
        const recommendations = [];
        if (insights.performanceScore < 70) {
            recommendations.push('Consider performance optimization - professional_score below 70%');
        }
        if (insights.reliability < 95) {
            recommendations.push('Investigate reliability issues - availability below 95%');
        }
        if (insights.averageResponseTime > 500) {
            recommendations.push('High response time detected - consider optimization');
        }
        if (insights.avgErrorRate > 0.02) {
            recommendations.push('Error rate above 2% - review error handling');
        }
        if (insights.trends.memory === 'degrading') {
            recommendations.push('Memory usage trending upward - check for leaks');
        }
        if (insights.trends.performance === 'degrading') {
            recommendations.push('Performance degrading - analyze recent changes');
        }
        return recommendations;
    }
    setupMetricsCollectorListeners() {
        this.metricsCollector.on('metrics_collected', (metrics) => {
            this.broadcastUpdate({ type: 'metrics_update', data: metrics });
        });
        this.metricsCollector.on('alert_triggered', (alert) => {
            this.broadcastUpdate({ type: 'alert_triggered', data: alert });
        });
    }
    startPeriodicUpdates() {
        // Update dashboard every 30 seconds
        this.updateInterval = setInterval(async () => {
            try {
                const overview = await this.getSystemOverview();
                this.broadcastUpdate({ type: 'overview_update', data: overview });
            }
            catch (error) {
                this.logger.error('Failed to send periodic dashboard update', { error });
            }
        }, 30000);
    }
    async createDefaultLayouts() {
        const defaultLayouts = [
            {
                name: 'System Overview',
                description: 'High-level system health and performance overview',
                widgets: [
                    {
                        id: 'overview-1',
                        type: 'status',
                        title: 'System Health',
                        config: { showAgentCount: true, showHealth: true },
                        position: { x: 0, y: 0, width: 4, height: 2 }
                    },
                    {
                        id: 'overview-2',
                        type: 'chart',
                        title: 'Response Time Trend',
                        config: { chartType: 'line', timeframe: 'last_hour' },
                        position: { x: 4, y: 0, width: 8, height: 4 }
                    },
                    {
                        id: 'overview-3',
                        type: 'alert',
                        title: 'Recent Alerts',
                        config: { maxAlerts: 10, severityFilter: 'all' },
                        position: { x: 0, y: 2, width: 4, height: 4 }
                    }
                ]
            },
            {
                name: 'Agent Performance',
                description: 'Detailed performance metrics for all agents',
                widgets: [
                    {
                        id: 'perf-1',
                        type: 'table',
                        title: 'Agent Status Table',
                        config: { columns: ['name', 'status', 'responseTime', 'operations'] },
                        position: { x: 0, y: 0, width: 12, height: 6 }
                    }
                ]
            }
        ];
        for (const layout of defaultLayouts) {
            const existingLayouts = await this.getDashboardLayouts();
            if (!existingLayouts.some(l => l.name === layout.name)) {
                await this.createDashboardLayout(layout);
            }
        }
    }
    convertToExcel(data) {
        // Simplified Excel export (would use a library like exceljs in real implementation)
        return JSON.stringify(data, null, 2);
    }
    convertToPDF(data) {
        // Simplified PDF export (would use a library like pdfkit in real implementation)
        return JSON.stringify(data, null, 2);
    }
    async loadDashboardLayouts() {
        try {
            const cached = await enhanced_cache_1.redisCache.get('dashboard_layouts');
            if (cached) {
                const layouts = JSON.parse(cached);
                for (const layout of layouts) {
                    this.dashboardLayouts.set(layout.id, layout);
                }
            }
        }
        catch (error) {
            this.logger.warn('Failed to load dashboard layouts', { error });
        }
    }
    async saveDashboardLayouts() {
        try {
            const layouts = Array.from(this.dashboardLayouts.values());
            await enhanced_cache_1.redisCache.set('dashboard_layouts', JSON.stringify(layouts), 86400);
        }
        catch (error) {
            this.logger.error('Failed to save dashboard layouts', { error });
        }
    }
    async cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        await this.saveDashboardLayouts();
        this.removeAllListeners();
        this.activeConnections.clear();
        this.logger.info('🧹 AgentMonitoringDashboard cleanup completed');
    }
}
exports.AgentMonitoringDashboard = AgentMonitoringDashboard;
