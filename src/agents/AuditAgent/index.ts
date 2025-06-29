import { AuditIncident, AuditIncidentSchema } from './types';
import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, HealthStatus, BaseMetrics } from '../BaseAgent/types';
import * as crypto from 'crypto';

/**
 * AuditAgent
 * Runs health/integrity checks across core data tables (picks, users, etc).
 * Logs incidents and escalates red flags to OperatorAgent or incident tables.
 */
export class AuditAgent extends BaseAgent {
  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    // Initialize agent-specific properties here
  }

  /**
   * Run all core audits and log/escalate results.
   */
  async runAudit(): Promise<void> {
    try {
      this.logger.info('AuditAgent: Starting system audit...');
      const incidents: AuditIncident[] = [];

      // 1. Picks with missing required fields
      incidents.push(...await this.checkForMissingFields());
      // 2. Picks stuck in invalid statuses or missing grades
      incidents.push(...await this.checkForStuckOrUngraded());
      // 3. Duplicate external_ids in picks
      incidents.push(...await this.checkForDuplicatePicks());
      // 4. Stale or orphaned records (e.g. old, ungraded, not updated)
      incidents.push(...await this.checkForStaleRecords());
      // 5. (Optional) Any failed/incomplete agent tasks
      incidents.push(...await this.checkForFailedTasks());

      // Log all incidents to Supabase
      for (const incident of incidents) {
        await this.requireSupabase().from('audit_incidents').insert([incident]);
      }

      // Send to OperatorAgent/escalation queue if critical
      const critical = incidents.filter(i => i.severity === 'critical');
      if (critical.length > 0) {
        await this.notifyOperatorAgent(critical);
      }

      this.logger.info(`AuditAgent: Audit complete. Total incidents: ${incidents.length}, Critical: ${critical.length}`);
    } catch (err) {
      this.logger.error('AuditAgent: Audit failed', {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
      throw err;
    }
  }

  /** Create an audit incident with default values */
  private createAuditIncident(data: Partial<AuditIncident>): AuditIncident {
    return AuditIncidentSchema.parse({
      id: data.id || crypto.randomUUID(),
      table: data.table || 'default_table',
      severity: data.severity || 'low',
      description: data.description || 'Unspecified audit incident',
      timestamp: data.timestamp || new Date(),
      ...data
    });
  }

  private async checkForMissingFields(): Promise<AuditIncident[]> {
    const incidents: AuditIncident[] = [];
    if (!this.supabase) {
      throw new Error('Supabase client is required for AuditAgent');
    }
    const { data, error } = await this.supabase
      .from('final_picks')
      .select('id, capper, player_name, line, odds, outcome')
      .is('player_name', null)
      .or('line.is.null,odds.is.null');

    if (error) {
      this.logger.error('checkForMissingFields failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
    for (const row of data ?? []) {
      incidents.push(this.createAuditIncident({
        id: `missing_field_${row.id}`,
        type: 'integrity',
        tableName: 'final_picks',
        row_id: row.id,
        description: `Pick is missing required field(s): ${!row.player_name ? 'player_name' : ''}${!row.line ? ', line' : ''}${!row.odds ? ', odds' : ''}`,
        severity: 'warning',
        detectedAt: new Date().toISOString()
      }));
    }
    return incidents;
  }

  /** Example: Picks stuck in pending or missing grading */
  private async checkForStuckOrUngraded(): Promise<AuditIncident[]> {
    const incidents: AuditIncident[] = [];
    if (!this.supabase) {
      throw new Error('Supabase client is required for AuditAgent');
    }
    const { data, error } = await this.supabase
      .from('final_picks')
      .select('id, capper, status, outcome, settled_at, created_at')
      .in('status', ['pending', 'in_progress'])
      .lte('created_at', new Date(Date.now() - 48 * 3600 * 1000).toISOString()); // older than 48h

    if (error) {
      this.logger.error('checkForStuckOrUngraded failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
    for (const row of data ?? []) {
      incidents.push(this.createAuditIncident({
        id: `stuck_pending_${row.id}`,
        type: 'integrity',
        tableName: 'final_picks',
        row_id: row.id,
        description: `Pick stuck in ${row.status} >48h`,
        severity: 'critical',
        detectedAt: new Date().toISOString()
      }));
    }
    return incidents;
  }

  /** Example: Detect duplicate external_ids in picks */
  private async checkForDuplicatePicks(): Promise<AuditIncident[]> {
    const incidents: AuditIncident[] = [];
    if (!this.supabase) {
      throw new Error('Supabase client is required for AuditAgent');
    }
    const { data, error } = await this.supabase.rpc('find_duplicate_external_ids');

    if (error) {
      this.logger.error('checkForDuplicatePicks failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
    for (const row of data ?? []) {
      incidents.push(this.createAuditIncident({
        id: `duplicate_external_id_${row.id}`,
        type: 'integrity',
        tableName: 'final_picks',
        row_id: row.id,
        description: `Duplicate external_id found: ${row.external_id}`,
        severity: 'critical',
        detectedAt: new Date().toISOString()
      }));
    }
    return incidents;
  }

  /** Example: Stale or ungraded records older than 72h */
  private async checkForStaleRecords(): Promise<AuditIncident[]> {
    const incidents: AuditIncident[] = [];
    if (!this.supabase) {
      throw new Error('Supabase client is required for AuditAgent');
    }
    const { data, error } = await this.supabase
      .from('final_picks')
      .select('id, capper, status, created_at')
      .in('status', ['pending', 'in_progress'])
      .lte('created_at', new Date(Date.now() - 72 * 3600 * 1000).toISOString());

    if (error) {
      this.logger.error('checkForStaleRecords failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
    for (const row of data ?? []) {
      incidents.push(this.createAuditIncident({
        id: `stale_pick_${row.id}`,
        type: 'integrity',
        tableName: 'final_picks',
        row_id: row.id,
        description: `Stale pick: status=${row.status}, created_at=${row.created_at}`,
        severity: 'warning',
        detectedAt: new Date().toISOString()
      }));
    }
    return incidents;
  }

  /** Example: Failed/incomplete agent tasks */
  private async checkForFailedTasks(): Promise<AuditIncident[]> {
    const incidents: AuditIncident[] = [];
    if (!this.supabase) {
      throw new Error('Supabase client is required for AuditAgent');
    }
    const { data, error } = await this.supabase
      .from('agent_tasks')
      .select('id, agent, status, error_message, updated_at')
      .in('status', ['failed', 'error']);

    if (error) {
      this.logger.error('checkForFailedTasks failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
    for (const row of data ?? []) {
      incidents.push(this.createAuditIncident({
        id: `failed_agent_task_${row.id}`,
        type: 'integrity',
        tableName: 'agent_tasks',
        row_id: row.id,
        description: `Agent task failed: ${row.agent} - ${row.error_message ?? ''}`,
        severity: 'critical',
        detectedAt: new Date().toISOString()
      }));
    }
    return incidents;
  }

  /** Notify OperatorAgent/escalation channel with critical issues */
  private async notifyOperatorAgent(criticalIncidents: AuditIncident[]) {
    // (Stub) You can push to a queue, send webhook, or upsert to a monitored table.
    this.logger.info('Escalating critical audit incidents to OperatorAgent', {
      incident_count: criticalIncidents.length,
      ids: criticalIncidents.map(i => i.row_id)
    });
    // Example: await this.supabase.from('operator_incidents').insert(criticalIncidents)
    // Or: trigger webhook/alert/Discord
  }

  protected async initialize(): Promise<void> {
    // TODO: Restore business logic here after base migration (initialize)
  }

  protected async process(): Promise<void> {
    // TODO: Restore business logic here after base migration (process)
  }

  protected async cleanup(): Promise<void> {
    // TODO: Restore business logic here after base migration (cleanup)
  }

  public async checkHealth(): Promise<HealthStatus> {
    // TODO: Restore business logic here after base migration (checkHealth)
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      details: {}
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    // TODO: Restore business logic here after base migration (collectMetrics)
    return {
      agentName: this.config.name,
      successCount: 0,
      errorCount: 0,
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }
}