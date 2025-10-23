/**
 * =============================================================================
 * INCIDENT MANAGEMENT SERVICE - Fortune 100 Grade Implementation
 * =============================================================================
 *
 * Comprehensive incident management system that provides:
 * - Automated incident creation from SLO violations
 * - Incident lifecycle management with escalation rules
 * - Real-time incident tracking and notifications
 * - MTTR (Mean Time To Recovery) measurement
 * - Integration with external systems (PagerDuty, Slack, StatusPage)
 *
 * Key Features:
 * - P0/P1/P2/P3 severity classification
 * - Automated escalation after time thresholds
 * - Complete audit trail with timeline tracking
 * - Error budget tracking integration
 * - Root cause analysis workflow
 * - Post-incident review automation
 */
import { EventEmitter } from 'events';
interface SystemIncident {
    id: string;
    incident_id: string;
    incident_type: 'slo_violation' | 'performance_degradation' | 'service_outage' | 'data_quality' | 'security_breach' | 'integration_failure' | 'capacity_limit' | 'user_reported' | 'maintenance' | 'other';
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    priority: number;
    status: 'open' | 'acknowledged' | 'investigating' | 'identified' | 'fixing' | 'monitoring' | 'resolved' | 'closed';
    title: string;
    description: string;
    affected_services: string[];
    affected_components?: string[];
    start_time: string;
    end_time?: string;
    acknowledged_time?: string;
    resolved_time?: string;
    closed_time?: string;
    slo_name?: string;
    slo_threshold?: number;
    actual_value?: number;
    assigned_to?: string;
    assigned_team?: string;
    reporter_id?: string;
    auto_created: boolean;
    escalation_rules_applied: boolean;
    customer_impact?: string;
    resolution_summary?: string;
    root_cause?: string;
}
interface IncidentTimeline {
    id: string;
    incident_id: string;
    timestamp: string;
    event_type: 'created' | 'acknowledged' | 'escalated' | 'assigned' | 'investigating' | 'update_posted' | 'fix_applied' | 'monitoring' | 'resolved' | 'closed' | 'reopened' | 'priority_changed' | 'severity_changed' | 'comment_added';
    description: string;
    performed_by?: string;
    automated: boolean;
    field_changed?: string;
    old_value?: string;
    new_value?: string;
}
interface IncidentMetrics {
    total_incidents_24h: number;
    critical_incidents_active: number;
    avg_resolution_time_minutes: number;
    avg_acknowledgment_time_minutes: number;
    incidents_by_severity: Record<string, number>;
    incidents_by_service: Record<string, number>;
    escalated_incidents: number;
    slo_violation_incidents: number;
}
export declare class IncidentManagementService extends EventEmitter {
    private logger;
    private metrics;
    private isRunning;
    private escalationInterval?;
    private readonly ESCALATION_RULES;
    constructor();
    /**
     * Start incident management service
     */
    start(): Promise<void>;
    /**
     * Stop incident management service
     */
    stop(): Promise<void>;
    /**
     * Create new incident
     */
    createIncident(incidentData: Partial<SystemIncident>): Promise<SystemIncident>;
    /**
     * Create incident from SLO violation
     */
    createIncidentFromSLOViolation(violation: any): Promise<SystemIncident>;
    /**
     * Update incident status
     */
    updateIncidentStatus(incidentId: string, status: SystemIncident['status'], performedBy?: string): Promise<void>;
    /**
     * Assign incident to user/team
     */
    assignIncident(incidentId: string, assigneeId: string, assignedBy?: string): Promise<void>;
    /**
     * Add comment to incident
     */
    addIncidentComment(incidentId: string, comment: string, authorId?: string): Promise<void>;
    /**
     * Get active incidents
     */
    getActiveIncidents(): Promise<SystemIncident[]>;
    /**
     * Get incident by ID
     */
    getIncident(incidentId: string): Promise<SystemIncident | null>;
    /**
     * Get incident timeline
     */
    getIncidentTimeline(incidentId: string): Promise<IncidentTimeline[]>;
    /**
     * Get incident metrics for dashboard
     */
    getIncidentMetrics(): Promise<IncidentMetrics>;
    /**
     * Start escalation monitoring
     */
    private startEscalationMonitoring;
    /**
     * Process incident escalations
     */
    private processEscalations;
    /**
     * Escalate incident
     */
    private escalateIncident;
    private getNextIncidentSequence;
    private getIncidentCount;
    private getIncidentCountSince;
    private getCriticalIncidentsActive;
    private getAverageResolutionTime;
    private getAverageAcknowledgmentTime;
    private getIncidentsBySeverity;
    private getIncidentsByService;
    private getEscalatedIncidents;
    private getSLOViolationIncidents;
    private getUnacknowledgedIncidents;
    private getUnresolvedIncidents;
    private addTimelineEntry;
    private autoAssignIncident;
    private sendIncidentNotifications;
    private getDefaultTeamForService;
    private getSeverityPriority;
    private generateCustomerImpactDescription;
    /**
     * Get service health status
     */
    isHealthy(): boolean;
    /**
     * Get comprehensive service status
     */
    getStatus(): any;
}
export default IncidentManagementService;
//# sourceMappingURL=IncidentManagementService.d.ts.map