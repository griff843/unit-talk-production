/**
 * =============================================================================
 * OPERATOR DASHBOARD SERVICE - Fortune 100 Grade Implementation
 * =============================================================================
 *
 * Comprehensive operator dashboard service providing:
 * - Real-time system health monitoring with SLO tracking
 * - Manual override controls (safe-mode, agent controls, circuit breakers)
 * - Deep dive analytics and performance trends
 * - Incident management interface with MTTR tracking
 * - System-wide controls for emergency situations
 *
 * Key Features:
 * - Live SLO status with P99 tracking and error budget monitoring
 * - Manual override capabilities for all critical systems
 * - Performance analytics with capacity planning insights
 * - Automated alert management with escalation controls
 * - Resource utilization monitoring (CPU, Memory, Database)
 * - Emergency circuit breakers with rollback capabilities
 */
import { EventEmitter } from 'events';
import SLOMonitoringService from './SLOMonitoringService';
import IncidentManagementService from './IncidentManagementService';
interface DashboardMetrics {
    system_health: {
        overall_status: 'healthy' | 'degraded' | 'critical';
        services_healthy: number;
        services_total: number;
        uptime_percentage: number;
    };
    slo_status: {
        slos_meeting_targets: number;
        slos_total: number;
        critical_violations: number;
        error_budget_alerts: number;
    };
    performance: {
        api_response_time_p99: number;
        database_query_time_p95: number;
        grading_throughput: number;
        alert_latency_p99: number;
    };
    incidents: {
        active_critical: number;
        active_total: number;
        resolved_24h: number;
        avg_resolution_time: number;
    };
    resources: {
        cpu_usage_percentage: number;
        memory_usage_percentage: number;
        disk_usage_percentage: number;
        database_connections: number;
    };
}
interface SystemControls {
    safe_mode: {
        enabled: boolean;
        reason?: string;
        enabled_at?: string;
        enabled_by?: string;
    };
    circuit_breakers: {
        [service: string]: {
            enabled: boolean;
            failure_threshold: number;
            current_failures: number;
            last_failure_time?: string;
        };
    };
    agent_controls: {
        [agent: string]: {
            status: 'running' | 'stopped' | 'paused';
            last_action_time?: string;
            controlled_by?: string;
        };
    };
    feature_flags: {
        [flag: string]: {
            enabled: boolean;
            rollout_percentage: number;
            last_modified?: string;
        };
    };
}
interface OperatorAction {
    id: string;
    action_type: 'safe_mode_toggle' | 'agent_control' | 'circuit_breaker' | 'feature_flag' | 'system_restart' | 'emergency_stop';
    target_service?: string;
    target_agent?: string;
    action_data: any;
    performed_by: string;
    performed_at: string;
    reason: string;
    rollback_available: boolean;
    rollback_data?: any;
}
export declare class OperatorDashboardService extends EventEmitter {
    private logger;
    private metrics;
    private sloService?;
    private incidentService?;
    private isRunning;
    private metricsInterval?;
    private systemControls;
    constructor(sloService?: SLOMonitoringService, incidentService?: IncidentManagementService);
    /**
     * Start operator dashboard service
     */
    start(): Promise<void>;
    /**
     * Stop operator dashboard service
     */
    stop(): Promise<void>;
    /**
     * Get comprehensive dashboard metrics
     */
    getDashboardMetrics(): Promise<DashboardMetrics>;
    /**
     * Get real-time system health overview
     */
    private getSystemHealth;
    /**
     * Get SLO status overview
     */
    private getSLOStatus;
    /**
     * Get performance metrics
     */
    private getPerformanceMetrics;
    /**
     * Get incident metrics
     */
    private getIncidentMetrics;
    /**
     * Get resource utilization metrics
     */
    private getResourceMetrics;
    /**
     * Toggle safe mode
     */
    toggleSafeMode(enabled: boolean, reason: string, operatorId: string): Promise<void>;
    /**
     * Control agent (start/stop/pause/restart)
     */
    controlAgent(agentName: string, action: 'start' | 'stop' | 'pause' | 'restart', operatorId: string, reason: string): Promise<void>;
    /**
     * Toggle circuit breaker
     */
    toggleCircuitBreaker(serviceName: string, enabled: boolean, operatorId: string, reason: string): Promise<void>;
    /**
     * Get system controls state
     */
    getSystemControls(): SystemControls;
    /**
     * Get operator action history
     */
    getOperatorActionHistory(limit?: number): Promise<OperatorAction[]>;
    /**
     * Emergency stop all systems
     */
    emergencyStop(operatorId: string, reason: string): Promise<void>;
    /**
     * Get historical performance data
     */
    getPerformanceTrends(hours?: number): Promise<any[]>;
    private loadSystemControls;
    private getDefaultSystemControls;
    private startMetricsCollection;
    private recordOperatorAction;
    private pauseAllAgents;
    private updateAgentStatus;
    private getReverseAction;
    private generateActionId;
    private getAPIResponseTimeP99;
    private getDatabaseQueryTimeP95;
    private getGradingThroughput;
    private getAlertLatencyP99;
    /**
     * Get service health status
     */
    isHealthy(): boolean;
    /**
     * Get comprehensive service status
     */
    getStatus(): any;
}
export default OperatorDashboardService;
//# sourceMappingURL=OperatorDashboardService.d.ts.map