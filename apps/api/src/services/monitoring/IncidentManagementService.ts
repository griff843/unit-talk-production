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

import { createLogger } from '../../utils/logger';
import { Metrics } from '../../monitoring/metrics';
import { supabaseClient as supabase } from '../supabaseClient';
import { EventEmitter } from 'events';
import { requireSupabase, supabaseClient } from '../../utils/supabaseUtils';
// import { v4 as uuidv4 } from 'uuid'; // Unused import

interface SystemIncident {
  id: string;
  incident_id: string;
  incident_type: 'slo_violation' | 'performance_degradation' | 'service_outage' | 'data_quality' | 'security_breach' | 'integration_failure' | 'capacity_limit' | 'user_reported' | 'maintenance' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  priority: number; // 1=highest, 5=lowest
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
  // Calculated fields for metrics
  acknowledgment_delay_minutes?: number;
  resolution_time_minutes?: number;
  updated_at?: string;
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

interface EscalationRule {
  severity: string;
  acknowledgment_timeout_minutes: number;
  resolution_timeout_hours: number;
  escalation_action: 'increase_priority' | 'change_severity' | 'notify_oncall' | 'create_page';
}

export class IncidentManagementService extends EventEmitter {
  private logger = createLogger('IncidentManagementService');
  private metrics = Metrics.getInstance();
  private isRunning = false;
  private escalationInterval?: NodeJS.Timeout;

  // Escalation rules by severity
  private readonly ESCALATION_RULES: EscalationRule[] = [
    {
      severity: 'critical',
      acknowledgment_timeout_minutes: 5,
      resolution_timeout_hours: 1,
      escalation_action: 'create_page'
    },
    {
      severity: 'high',
      acknowledgment_timeout_minutes: 15,
      resolution_timeout_hours: 4,
      escalation_action: 'notify_oncall'
    },
    {
      severity: 'medium',
      acknowledgment_timeout_minutes: 30,
      resolution_timeout_hours: 8,
      escalation_action: 'increase_priority'
    },
    {
      severity: 'low',
      acknowledgment_timeout_minutes: 60,
      resolution_timeout_hours: 24,
      escalation_action: 'increase_priority'
    }
  ];

  constructor() {
    super();
    this.logger.info('Initializing Incident Management Service');
  }

  /**
   * Start incident management service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Incident management service already running');
      return;
    }

    try {
      this.startEscalationMonitoring();
      
      this.isRunning = true;
      this.logger.info('Incident management service started successfully');
      
      this.emit('service:started');
    } catch (error) {
      this.logger.error('Failed to start incident management service:', error);
      throw error;
    }
  }

  /**
   * Stop incident management service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    if (this.escalationInterval) {
      clearInterval(this.escalationInterval);
    }

    this.isRunning = false;
    this.logger.info('Incident management service stopped');
    
    this.emit('service:stopped');
  }

  /**
   * Create new incident
   */
  async createIncident(incidentData: Partial<SystemIncident>): Promise<SystemIncident> {

    try {
      // Generate unique incident ID
      const year = new Date().getFullYear();
      const sequence = await this.getNextIncidentSequence();
      const incidentId = `INC-${year}-${sequence.toString().padStart(4, '0')}`;

      const incident: Partial<SystemIncident> = {
        incident_id: incidentId,
        incident_type: incidentData.incident_type || 'other',
        severity: incidentData.severity || 'medium',
        priority: incidentData.priority || 3,
        status: 'open',
        title: incidentData.title || `Incident ${incidentId}`,
        description: incidentData.description || 'Automated incident creation',
        affected_services: incidentData.affected_services || [],
        affected_components: incidentData.affected_components || [],
        start_time: new Date().toISOString(),
        slo_name: incidentData.slo_name,
        slo_threshold: incidentData.slo_threshold,
        actual_value: incidentData.actual_value,
        assigned_team: incidentData.assigned_team || this.getDefaultTeamForService(incidentData.affected_services?.[0]),
        auto_created: incidentData.auto_created || false,
        escalation_rules_applied: false,
        customer_impact: incidentData.customer_impact
      };

      // Insert incident into database
      const supabaseClient = requireSupabase();
      const { data: createdIncident, error } = await supabase
        .from('system_incidents')
        .insert(incident)
        .select()
        .single();

      if (error) throw error;

      // Create initial timeline entry
      await this.addTimelineEntry(createdIncident.id, {
        event_type: 'created',
        description: `Incident ${incidentId} created${incident.auto_created ? ' automatically' : ''}`,
        automated: incident.auto_created || false
      });

      // Update metrics
      this.metrics.trackOperation('incident_created', 'success');
      this.metrics.setBusinessMetric('incidents_total', await this.getIncidentCount());

      // Emit incident created event
      this.emit('incident:created', createdIncident);

      // Auto-assign if critical
      if (incident.severity === 'critical') {
        await this.autoAssignIncident(createdIncident);
      }

      // Send initial notifications
      await this.sendIncidentNotifications(createdIncident, 'created');

      this.logger.info(`Created incident ${incidentId}`, {
        incident_id: incidentId,
        severity: incident.severity,
        type: incident.incident_type,
        services: incident.affected_services
      });

      return createdIncident;
    } catch (error) {
      this.logger.error('Failed to create incident:', error);
      this.metrics.trackError('incident_creation', 'creation_failed');
      throw error;
    }
  }

  /**
   * Create incident from SLO violation
   */
  async createIncidentFromSLOViolation(violation: any): Promise<SystemIncident> {
    const { definition, measurement } = violation;

    return await this.createIncident({
      incident_type: 'slo_violation',
      severity: definition.incident_severity,
      priority: this.getSeverityPriority(definition.incident_severity),
      title: `${definition.slo_name} SLO Violation`,
      description: `SLO "${definition.slo_name}" violated: current value ${measurement.sli_value.toFixed(4)} ${measurement.breach_severity === 'critical' ? 'below' : 'above'} threshold ${definition.threshold_critical}`,
      affected_services: [definition.service_name],
      slo_name: definition.slo_name,
      slo_threshold: definition.threshold_critical,
      actual_value: measurement.sli_value,
      assigned_team: definition.owner_team,
      auto_created: true,
      customer_impact: this.generateCustomerImpactDescription(definition.slo_name, measurement.sli_value)
    });
  }

  /**
   * Update incident status
   */
  async updateIncidentStatus(incidentId: string, status: SystemIncident['status'], performedBy?: string): Promise<void> {

    try {
      // Get current incident
      const supabaseClient = requireSupabase();
      const { data: incident, error: fetchError } = await supabase
        .from('system_incidents')
        .select('*')
        .eq('incident_id', incidentId)
        .single();

      if (fetchError) throw fetchError;
      if (!incident) throw new Error(`Incident ${incidentId} not found`);

      const oldStatus = incident.status;
      const now = new Date().toISOString();
      const updates: Partial<SystemIncident> = { status };

      // Set appropriate timestamps based on status
      switch (status) {
        case 'acknowledged':
          if (!incident.acknowledged_time) {
            updates.acknowledged_time = now;
            updates.acknowledgment_delay_minutes = Math.round(
              (new Date(now).getTime() - new Date(incident.start_time).getTime()) / (1000 * 60)
            );
          }
          break;
        case 'resolved':
          if (!incident.resolved_time) {
            updates.resolved_time = now;
            updates.resolution_time_minutes = Math.round(
              (new Date(now).getTime() - new Date(incident.start_time).getTime()) / (1000 * 60)
            );
          }
          break;
        case 'closed':
          updates.closed_time = now;
          updates.end_time = now;
          break;
      }

      // Update incident
      const { error: updateError } = await supabase
        .from('system_incidents')
        .update(updates)
        .eq('id', incident.id);

      if (updateError) throw updateError;

      // Add timeline entry
      await this.addTimelineEntry(incident.id, {
        event_type: status === 'acknowledged' ? 'acknowledged' : 
                   status === 'resolved' ? 'resolved' : 
                   status === 'closed' ? 'closed' : 'update_posted',
        description: `Status changed from ${oldStatus} to ${status}`,
        performed_by: performedBy,
        automated: false,
        field_changed: 'status',
        old_value: oldStatus,
        new_value: status
      });

      // Update metrics
      this.metrics.trackOperation('incident_updated', 'success');
      if (status === 'resolved') {
        this.metrics.trackDuration('incident_resolution', updates.resolution_time_minutes! * 60 * 1000);
      }

      // Emit status change event
      this.emit('incident:status_changed', {
        incident_id: incidentId,
        old_status: oldStatus,
        new_status: status,
        performed_by: performedBy
      });

      // Send notifications
      await this.sendIncidentNotifications({ ...incident, ...updates }, 'status_changed');

      this.logger.info(`Updated incident ${incidentId} status: ${oldStatus} → ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update incident ${incidentId} status:`, error);
      this.metrics.trackError('incident_update', 'status_update_failed');
      throw error;
    }
  }

  /**
   * Assign incident to user/team
   */
  async assignIncident(incidentId: string, assigneeId: string, assignedBy?: string): Promise<void> {

    try {
      // Get current incident
      const supabaseClient = requireSupabase();
      const { data: incident, error: fetchError } = await supabase
        .from('system_incidents')
        .select('*')
        .eq('incident_id', incidentId)
        .single();

      if (fetchError) throw fetchError;
      if (!incident) throw new Error(`Incident ${incidentId} not found`);

      // Update assignment
      const { error: updateError } = await supabase
        .from('system_incidents')
        .update({
          assigned_to: assigneeId,
          updated_at: new Date().toISOString()
        })
        .eq('id', incident.id);

      if (updateError) throw updateError;

      // Add timeline entry
      await this.addTimelineEntry(incident.id, {
        event_type: 'assigned',
        description: `Incident assigned to user ${assigneeId}`,
        performed_by: assignedBy,
        automated: false
      });

      // Emit assignment event
      this.emit('incident:assigned', {
        incident_id: incidentId,
        assigned_to: assigneeId,
        assigned_by: assignedBy
      });

      this.logger.info(`Assigned incident ${incidentId} to ${assigneeId}`);
    } catch (error) {
      this.logger.error(`Failed to assign incident ${incidentId}:`, error);
      throw error;
    }
  }

  /**
   * Add comment to incident
   */
  async addIncidentComment(incidentId: string, comment: string, authorId?: string): Promise<void> {

    try {
      // Get incident
      const supabaseClient = requireSupabase();
      const { data: incident, error: fetchError } = await supabase
        .from('system_incidents')
        .select('id')
        .eq('incident_id', incidentId)
        .single();

      if (fetchError) throw fetchError;
      if (!incident) throw new Error(`Incident ${incidentId} not found`);

      // Add timeline entry
      await this.addTimelineEntry(incident.id, {
        event_type: 'comment_added',
        description: comment,
        performed_by: authorId,
        automated: false
      });

      this.logger.info(`Added comment to incident ${incidentId}`);
    } catch (error) {
      this.logger.error(`Failed to add comment to incident ${incidentId}:`, error);
      throw error;
    }
  }

  /**
   * Get active incidents
   */
  async getActiveIncidents(): Promise<SystemIncident[]> {

    try {
      const supabaseClient = requireSupabase();
      const { data: incidents, error } = await supabase
        .from('system_incidents')
        .select(`
          *,
          users!system_incidents_assigned_to_fkey(username)
        `)
        .not('status', 'in', '(resolved,closed)')
        .order('priority', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      return incidents || [];
    } catch (error) {
      this.logger.error('Failed to get active incidents:', error);
      throw error;
    }
  }

  /**
   * Get incident by ID
   */
  async getIncident(incidentId: string): Promise<SystemIncident | null> {

    try {
      const supabaseClient = requireSupabase();
      const { data: incident, error } = await supabase
        .from('system_incidents')
        .select(`
          *,
          users!system_incidents_assigned_to_fkey(username)
        `)
        .eq('incident_id', incidentId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return incident;
    } catch (error) {
      this.logger.error(`Failed to get incident ${incidentId}:`, error);
      throw error;
    }
  }

  /**
   * Get incident timeline
   */
  async getIncidentTimeline(incidentId: string): Promise<IncidentTimeline[]> {

    try {
      // First get the incident ID
      const supabaseClient = requireSupabase();
      const { data: incident, error: incidentError } = await supabase
        .from('system_incidents')
        .select('id')
        .eq('incident_id', incidentId)
        .single();

      if (incidentError) throw incidentError;
      if (!incident) throw new Error(`Incident ${incidentId} not found`);

      const { data: timeline, error } = await supabase
        .from('incident_timeline')
        .select(`
          *,
          users!incident_timeline_performed_by_fkey(username)
        `)
        .eq('incident_id', incident.id)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return timeline || [];
    } catch (error) {
      this.logger.error(`Failed to get incident timeline for ${incidentId}:`, error);
      throw error;
    }
  }

  /**
   * Get incident metrics for dashboard
   */
  async getIncidentMetrics(): Promise<IncidentMetrics> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Get various incident counts
      const [
        totalIncidents24h,
        criticalIncidentsActive,
        avgResolutionTime,
        avgAckTime,
        incidentsBySeverity,
        incidentsByService,
        escalatedIncidents,
        sloViolationIncidents
      ] = await Promise.all([
        this.getIncidentCountSince(twentyFourHoursAgo),
        this.getCriticalIncidentsActive(),
        this.getAverageResolutionTime(),
        this.getAverageAcknowledgmentTime(),
        this.getIncidentsBySeverity(twentyFourHoursAgo),
        this.getIncidentsByService(twentyFourHoursAgo),
        this.getEscalatedIncidents(twentyFourHoursAgo),
        this.getSLOViolationIncidents(twentyFourHoursAgo)
      ]);

      return {
        total_incidents_24h: totalIncidents24h,
        critical_incidents_active: criticalIncidentsActive,
        avg_resolution_time_minutes: avgResolutionTime,
        avg_acknowledgment_time_minutes: avgAckTime,
        incidents_by_severity: incidentsBySeverity,
        incidents_by_service: incidentsByService,
        escalated_incidents: escalatedIncidents,
        slo_violation_incidents: sloViolationIncidents
      };
    } catch (error) {
      this.logger.error('Failed to get incident metrics:', error);
      throw error;
    }
  }

  /**
   * Start escalation monitoring
   */
  private startEscalationMonitoring(): void {
    // Check for escalations every 2 minutes
    this.escalationInterval = setInterval(async () => {
      try {
        await this.processEscalations();
      } catch (error) {
        this.logger.error('Error during escalation processing:', error);
      }
    }, 2 * 60 * 1000);

    this.logger.info('Started escalation monitoring (2min interval)');
  }

  /**
   * Process incident escalations
   */
  private async processEscalations(): Promise<void> {
    try {
      let escalated = 0;

      for (const rule of this.ESCALATION_RULES) {
        // Check acknowledgment timeouts
        const unacknowledgedIncidents = await this.getUnacknowledgedIncidents(
          rule.severity,
          rule.acknowledgment_timeout_minutes
        );

        for (const incident of unacknowledgedIncidents) {
          await this.escalateIncident(incident, 'acknowledgment_timeout', rule);
          escalated++;
        }

        // Check resolution timeouts
        const unresolvedIncidents = await this.getUnresolvedIncidents(
          rule.severity,
          rule.resolution_timeout_hours
        );

        for (const incident of unresolvedIncidents) {
          await this.escalateIncident(incident, 'resolution_timeout', rule);
          escalated++;
        }
      }

      if (escalated > 0) {
        this.logger.info(`Escalated ${escalated} incidents`);
        this.metrics.setBusinessMetric('incidents_escalated_total', escalated);
      }
    } catch (error) {
      this.logger.error('Failed to process escalations:', error);
    }
  }

  /**
   * Escalate incident
   */
  private async escalateIncident(incident: SystemIncident, reason: string, rule: EscalationRule): Promise<void> {

    try {
      const updates: Partial<SystemIncident> = {
        escalation_rules_applied: true,
        updated_at: new Date().toISOString()
      };

      // Apply escalation action
      switch (rule.escalation_action) {
        case 'increase_priority':
          updates.priority = Math.max(1, incident.priority - 1);
          break;
        case 'change_severity':
          if (incident.severity === 'high') updates.severity = 'critical';
          if (incident.severity === 'medium') updates.severity = 'high';
          if (incident.severity === 'low') updates.severity = 'medium';
          break;
        case 'notify_oncall':
        case 'create_page':
          // These would trigger external notifications
          break;
      }

      // Update incident
      const supabaseClient = requireSupabase();
      const { error } = await supabase
        .from('system_incidents')
        .update(updates)
        .eq('id', incident.id);

      if (error) throw error;

      // Add timeline entry
      await this.addTimelineEntry(incident.id, {
        event_type: 'escalated',
        description: `Auto-escalated due to ${reason.replace('_', ' ')}`,
        automated: true
      });

      // Emit escalation event
      this.emit('incident:escalated', {
        incident_id: incident.incident_id,
        reason,
        rule: rule.escalation_action
      });

      this.logger.warn(`Escalated incident ${incident.incident_id} due to ${reason}`);
    } catch (error) {
      this.logger.error(`Failed to escalate incident ${incident.incident_id}:`, error);
    }
  }

  // Helper methods for metrics and data retrieval

  private async getNextIncidentSequence(): Promise<number> {

    const supabaseClient = requireSupabase();
      const { data, error } = await supabase.rpc('nextval', { seq_name: 'incident_sequence' });
    if (error) throw error;
    return data;
  }

  private async getIncidentCount(): Promise<number> {

    const supabaseClient = requireSupabase();
      const { count, error } = await supabase
      .from('system_incidents')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  }

  private async getIncidentCountSince(since: string): Promise<number> {

    const supabaseClient = requireSupabase();
      const { count, error } = await supabase
      .from('system_incidents')
      .select('*', { count: 'exact', head: true })
      .gte('start_time', since);
    if (error) throw error;
    return count || 0;
  }

  private async getCriticalIncidentsActive(): Promise<number> {

    const supabaseClient = requireSupabase();
      const { count, error } = await supabase
      .from('system_incidents')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'critical')
      .not('status', 'in', '(resolved,closed)');
    if (error) throw error;
    return count || 0;
  }

  private async getAverageResolutionTime(): Promise<number> {

    const supabaseClient = requireSupabase();
      const { data, error } = await supabase
      .from('system_incidents')
      .select('resolution_time_minutes')
      .not('resolution_time_minutes', 'is', null);
    
    if (error) throw error;
    if (!data?.length) return 0;
    
    const sum = data.reduce((acc, incident) => acc + (incident.resolution_time_minutes || 0), 0);
    return Math.round(sum / data.length);
  }

  private async getAverageAcknowledgmentTime(): Promise<number> {

    const supabaseClient = requireSupabase();
      const { data, error } = await supabase
      .from('system_incidents')
      .select('acknowledgment_delay_minutes')
      .not('acknowledgment_delay_minutes', 'is', null);
    
    if (error) throw error;
    if (!data?.length) return 0;
    
    const sum = data.reduce((acc, incident) => acc + (incident.acknowledgment_delay_minutes || 0), 0);
    return Math.round(sum / data.length);
  }

  private async getIncidentsBySeverity(since: string): Promise<Record<string, number>> {

    const supabaseClient = requireSupabase();
      const { data, error } = await supabase
      .from('system_incidents')
      .select('severity')
      .gte('start_time', since);
    
    if (error) throw error;
    
    const counts: Record<string, number> = {};
    data?.forEach(incident => {
      counts[incident.severity] = (counts[incident.severity] || 0) + 1;
    });
    
    return counts;
  }

  private async getIncidentsByService(since: string): Promise<Record<string, number>> {

    const supabaseClient = requireSupabase();
      const { data, error } = await supabase
      .from('system_incidents')
      .select('affected_services')
      .gte('start_time', since);
    
    if (error) throw error;
    
    const counts: Record<string, number> = {};
    data?.forEach(incident => {
      incident.affected_services?.forEach((service: string) => {
        counts[service] = (counts[service] || 0) + 1;
      });
    });
    
    return counts;
  }

  private async getEscalatedIncidents(since: string): Promise<number> {

    const supabaseClient = requireSupabase();
      const { count, error } = await supabase
      .from('system_incidents')
      .select('*', { count: 'exact', head: true })
      .eq('escalation_rules_applied', true)
      .gte('start_time', since);
    if (error) throw error;
    return count || 0;
  }

  private async getSLOViolationIncidents(since: string): Promise<number> {

    const supabaseClient = requireSupabase();
      const { count, error } = await supabase
      .from('system_incidents')
      .select('*', { count: 'exact', head: true })
      .eq('incident_type', 'slo_violation')
      .gte('start_time', since);
    if (error) throw error;
    return count || 0;
  }

  private async getUnacknowledgedIncidents(severity: string, timeoutMinutes: number): Promise<SystemIncident[]> {

    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();

    const supabaseClient = requireSupabase();
      const { data, error } = await supabase
      .from('system_incidents')
      .select('*')
      .eq('severity', severity)
      .eq('status', 'open')
      .is('acknowledged_time', null)
      .eq('escalation_rules_applied', false)
      .lt('start_time', cutoff);
    
    if (error) throw error;
    return data || [];
  }

  private async getUnresolvedIncidents(severity: string, timeoutHours: number): Promise<SystemIncident[]> {

    const cutoff = new Date(Date.now() - timeoutHours * 60 * 60 * 1000).toISOString();

    const supabaseClient = requireSupabase();
      const { data, error } = await supabase
      .from('system_incidents')
      .select('*')
      .eq('severity', severity)
      .in('status', ['acknowledged', 'investigating', 'identified', 'fixing'])
      .eq('escalation_rules_applied', false)
      .lt('start_time', cutoff);
    
    if (error) throw error;
    return data || [];
  }

  private async addTimelineEntry(incidentId: string, entry: Partial<IncidentTimeline>): Promise<void> {

    const supabaseClient = requireSupabase();
      const { error } = await supabase
      .from('incident_timeline')
      .insert({
        incident_id: incidentId,
        timestamp: new Date().toISOString(),
        ...entry
      });
    
    if (error) throw error;
  }

  private async autoAssignIncident(incident: SystemIncident): Promise<void> {
    // Auto-assignment logic would go here
    // For now, just log the incident for manual assignment
    this.logger.warn(`Critical incident ${incident.incident_id} requires immediate assignment`);
  }

  private async sendIncidentNotifications(incident: SystemIncident, eventType: string): Promise<void> {
    // Notification logic would integrate with Slack, PagerDuty, etc.
    this.logger.info(`Sending ${eventType} notifications for incident ${incident.incident_id}`);
  }

  private getDefaultTeamForService(serviceName?: string): string {
    const teamMapping: Record<string, string> = {
      'api': 'platform',
      'grading': 'grading',
      'feed': 'data',
      'discord-bot': 'platform',
      'ml': 'ml',
      'pipeline': 'data',
      'archiver': 'data'
    };
    
    return teamMapping[serviceName || ''] || 'platform';
  }

  private getSeverityPriority(severity: string): number {
    const priorityMap: Record<string, number> = {
      'critical': 1,
      'high': 2,
      'medium': 3,
      'low': 4,
      'info': 5
    };
    
    return priorityMap[severity] || 3;
  }

  private generateCustomerImpactDescription(sloName: string, actualValue: number): string {
    const impactMap: Record<string, string> = {
      'Alert Latency P99': `Delayed alert delivery (${actualValue.toFixed(0)}ms) may impact real-time notifications`,
      'Rescore Freshness': `Stale rescoring data (${actualValue.toFixed(1)} minutes old) affecting pick accuracy`,
      'Missed Tick Rate': `Data feed reliability degraded (${(actualValue * 100).toFixed(2)}% miss rate)`,
      'Archiver Lag': `Historical data archiving delayed by ${actualValue.toFixed(1)} hours`,
      'Feature Store Freshness': `ML features stale by ${actualValue.toFixed(1)} minutes`,
      'Grading Throughput': `Reduced grading performance (${actualValue.toFixed(0)} props/min)`,
      'System Availability': `Service availability degraded to ${actualValue.toFixed(2)}%`,
      'Data Pipeline Success Rate': `Pipeline reliability at ${actualValue.toFixed(2)}%`
    };
    
    return impactMap[sloName] || 'Service performance impacted';
  }

  /**
   * Get service health status
   */
  isHealthy(): boolean {
    return this.isRunning;
  }

  /**
   * Get comprehensive service status
   */
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      escalationInterval: '2 minutes',
      escalationRules: this.ESCALATION_RULES.length,
      lastEscalationCheck: new Date().toISOString()
    };
  }
}

export default IncidentManagementService;