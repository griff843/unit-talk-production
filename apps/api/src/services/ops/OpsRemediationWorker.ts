/**
 * @fileoverview Ops Remediation Worker
 *
 * Extends OpsNotificationWorker to add auto-remediation capabilities.
 * Polls for SLO incidents and triggers appropriate playbooks.
 *
 * Part of PR8: Auto-Remediation Playbooks
 *
 * CRITICAL: All executions are DRY RUN by default until explicitly enabled.
 *
 * @module services/ops/OpsRemediationWorker
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { makeLogger } from '../../utils/logger';
import {
  RemediationEngine,
  getRemediationEngine,
  PlaybookRegistry,
  getPlaybookRegistry,
  registerAllPlaybooks,
  PlaybookId,
  ExecutionContext,
  ExecutionResult,
} from '../remediation';

const logger = makeLogger('OpsRemediationWorker');

// ============================================================================
// Types
// ============================================================================

export interface OpsRemediationWorkerConfig {
  // Feature flags
  enabled: boolean;
  dryRunOnly: boolean;

  // Polling
  pollIntervalMs: number;
  batchSize: number;

  // Rate limiting
  maxRemediationsPerHour: number;
  cooldownBetweenRunsMs: number;

  // Environment
  environment: string;
}

export interface SLOIncident {
  incident_id: string;
  slo_id: string;
  slo_name: string;
  severity: 'warning' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved';
  trigger_value: number;
  trigger_threshold: number;
  evidence: Record<string, unknown>;
  opened_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  auto_remediation_eligible: boolean;
  auto_remediation_playbook: string | null;
}

export interface RemediationCycleResult {
  processed: number;
  triggered: number;
  skipped: number;
  errors: number;
  results: ExecutionResult[];
}

// ============================================================================
// Default Configuration
// ============================================================================

function getDefaultConfig(): OpsRemediationWorkerConfig {
  return {
    // Feature flags - ALL OFF BY DEFAULT
    enabled: process.env.OPS_REMEDIATION_WORKER_ENABLED === 'true',
    dryRunOnly: process.env.OPS_REMEDIATION_DRY_RUN_ONLY !== 'false', // Default TRUE

    // Polling
    pollIntervalMs: parseInt(process.env.OPS_REMEDIATION_POLL_INTERVAL_MS || '60000', 10),
    batchSize: parseInt(process.env.OPS_REMEDIATION_BATCH_SIZE || '10', 10),

    // Rate limiting
    maxRemediationsPerHour: parseInt(process.env.OPS_REMEDIATION_MAX_PER_HOUR || '10', 10),
    cooldownBetweenRunsMs: parseInt(process.env.OPS_REMEDIATION_COOLDOWN_MS || '5000', 10),

    // Environment
    environment: process.env.NODE_ENV || 'development',
  };
}

// ============================================================================
// SLO to Playbook Mapping
// ============================================================================

const SLO_PLAYBOOK_MAPPING: Record<string, PlaybookId> = {
  // Materialized view staleness
  'mv_freshness': 'MV_REFRESH_LAG',
  'materialized_view_lag': 'MV_REFRESH_LAG',

  // Pipeline processing
  'pipeline_latency': 'PIPELINE_LAG_THROTTLE',
  'event_processing_lag': 'PIPELINE_LAG_THROTTLE',
  'bridge_outbox_backlog': 'PIPELINE_LAG_THROTTLE',

  // API credits
  'api_credit_burn': 'CREDIT_BURN_THROTTLE',
  'api_quota_usage': 'CREDIT_BURN_THROTTLE',

  // Discord
  'discord_notification_backlog': 'DISCORD_BACKLOG_NUDGE',
  'notification_delivery_lag': 'DISCORD_BACKLOG_NUDGE',

  // SLO evaluation
  'slo_evaluator_lag': 'SLO_EVALUATOR_STUCK',
  'slo_evaluation_freshness': 'SLO_EVALUATOR_STUCK',
};

// ============================================================================
// OpsRemediationWorker Class
// ============================================================================

export class OpsRemediationWorker {
  private supabase: SupabaseClient;
  private config: OpsRemediationWorkerConfig;
  private engine: RemediationEngine;
  private registry: PlaybookRegistry;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;
  private lastRunAt: number = 0;
  private remediationsThisHour: number = 0;
  private hourlyResetInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    supabaseUrl: string,
    supabaseServiceKey: string,
    config?: Partial<OpsRemediationWorkerConfig>
  ) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.config = { ...getDefaultConfig(), ...config };
    this.engine = getRemediationEngine();
    this.registry = getPlaybookRegistry();

    logger.info('OpsRemediationWorker created', {
      enabled: this.config.enabled,
      dryRunOnly: this.config.dryRunOnly,
      pollIntervalMs: this.config.pollIntervalMs,
      environment: this.config.environment,
    });
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('OpsRemediationWorker is disabled, not starting');
      return;
    }

    if (this.isRunning) {
      logger.warn('OpsRemediationWorker is already running');
      return;
    }

    try {
      // Initialize engine and register playbooks
      await this.engine.initialize();
      await registerAllPlaybooks(this.registry);

      this.isRunning = true;

      // Start hourly reset interval
      this.hourlyResetInterval = setInterval(() => {
        this.remediationsThisHour = 0;
      }, 60 * 60 * 1000);

      // Start polling
      this.pollInterval = setInterval(
        () => this.runCycle(),
        this.config.pollIntervalMs
      );

      // Run initial cycle
      await this.runCycle();

      logger.info('OpsRemediationWorker started', {
        pollIntervalMs: this.config.pollIntervalMs,
        dryRunOnly: this.config.dryRunOnly,
      });
    } catch (error) {
      logger.error('Failed to start OpsRemediationWorker', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.hourlyResetInterval) {
      clearInterval(this.hourlyResetInterval);
      this.hourlyResetInterval = null;
    }

    this.isRunning = false;
    logger.info('OpsRemediationWorker stopped');
  }

  /**
   * Check if cycle should be skipped due to cooldown or rate limit
   */
  private shouldSkipCycle(): { skip: boolean; reason?: string } {
    if (Date.now() - this.lastRunAt < this.config.cooldownBetweenRunsMs) {
      return { skip: true, reason: 'cooldown' };
    }
    if (this.remediationsThisHour >= this.config.maxRemediationsPerHour) {
      return { skip: true, reason: 'rate_limit' };
    }
    return { skip: false };
  }

  /**
   * Process a single incident for remediation
   */
  private async processIncident(
    incident: SLOIncident,
    correlationId: string
  ): Promise<{ status: 'triggered' | 'skipped' | 'error'; result?: ExecutionResult }> {
    const playbookId = this.mapIncidentToPlaybook(incident);
    if (!playbookId) {
      return { status: 'skipped' };
    }

    const context: ExecutionContext = {
      incident_id: incident.incident_id,
      slo_id: incident.slo_id,
      triggered_by: 'slo_incident',
      trigger_value: incident.trigger_value,
      trigger_threshold: incident.trigger_threshold,
      evidence: incident.evidence,
      correlation_id: correlationId,
      environment: this.config.environment,
    };

    const executionResult = await this.engine.executePlaybook(
      playbookId,
      context,
      { dryRun: this.config.dryRunOnly }
    );

    if (executionResult.success) {
      await this.markRemediationAttempted(incident.incident_id, executionResult);
      return { status: 'triggered', result: executionResult };
    }
    return { status: 'error', result: executionResult };
  }

  /**
   * Run a single remediation cycle
   */
  async runCycle(): Promise<RemediationCycleResult> {
    const correlationId = uuidv4();
    logger.info('Starting remediation cycle', { correlationId });

    const result: RemediationCycleResult = {
      processed: 0, triggered: 0, skipped: 0, errors: 0, results: [],
    };

    const skipCheck = this.shouldSkipCycle();
    if (skipCheck.skip) {
      logger.debug(`Skipping cycle: ${skipCheck.reason}`);
      return result;
    }

    const incidents = await this.getEligibleIncidents();
    result.processed = incidents.length;

    for (const incident of incidents) {
      if (this.remediationsThisHour >= this.config.maxRemediationsPerHour) {
        result.skipped++;
        continue;
      }
      try {
        const outcome = await this.processIncident(incident, correlationId);
        if (outcome.result) result.results.push(outcome.result);
        if (outcome.status === 'triggered') {
          result.triggered++;
          this.remediationsThisHour++;
        } else if (outcome.status === 'error') {
          result.errors++;
        } else {
          result.skipped++;
        }
      } catch (error) {
        result.errors++;
        logger.error('Failed to process incident', {
          correlationId,
          incidentId: incident.incident_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.lastRunAt = Date.now();
    logger.info('Remediation cycle complete', { correlationId, ...result });
    return result;
  }

  /**
   * Get incidents eligible for auto-remediation
   */
  private async getEligibleIncidents(): Promise<SLOIncident[]> {
    const { data, error } = await this.supabase
      .from('ops.slo_incidents')
      .select('*')
      .eq('status', 'open')
      .eq('auto_remediation_eligible', true)
      .is('auto_remediation_attempted_at', null)
      .order('opened_at', { ascending: true })
      .limit(this.config.batchSize);

    if (error) {
      // Try without schema prefix
      const { data: fallbackData, error: fallbackError } = await this.supabase
        .from('slo_incidents')
        .select('*')
        .eq('status', 'open')
        .eq('auto_remediation_eligible', true)
        .is('auto_remediation_attempted_at', null)
        .order('opened_at', { ascending: true })
        .limit(this.config.batchSize);

      if (fallbackError) {
        logger.warn('Failed to fetch eligible incidents', { error: fallbackError.message });
        return [];
      }

      return (fallbackData || []) as unknown as SLOIncident[];
    }

    return (data || []) as unknown as SLOIncident[];
  }

  /**
   * Map SLO incident to appropriate playbook
   */
  private mapIncidentToPlaybook(incident: SLOIncident): PlaybookId | null {
    // First check if incident has explicit playbook mapping
    if (incident.auto_remediation_playbook) {
      const playbookId = incident.auto_remediation_playbook as PlaybookId;
      if (this.registry.has(playbookId)) {
        return playbookId;
      }
    }

    // Otherwise, use SLO-based mapping with safe lookup
    const sloKey = incident.slo_id.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(SLO_PLAYBOOK_MAPPING, sloKey)) {
      return SLO_PLAYBOOK_MAPPING[sloKey];
    }
    return null;
  }

  /**
   * Mark incident as remediation attempted
   */
  private async markRemediationAttempted(
    incidentId: string,
    result: ExecutionResult
  ): Promise<void> {
    const { error } = await this.supabase
      .from('slo_incidents')
      .update({
        auto_remediation_attempted_at: new Date().toISOString(),
        auto_remediation_execution_id: result.execution_id,
        auto_remediation_result: result.success ? 'success' : 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('incident_id', incidentId);

    if (error) {
      logger.warn('Failed to mark remediation attempted', {
        incidentId,
        error: error.message,
      });
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerManualCycle(): Promise<RemediationCycleResult> {
    logger.info('Manual remediation cycle triggered');
    return this.runCycle();
  }

  /**
   * Get worker status
   */
  getStatus(): {
    isRunning: boolean;
    config: OpsRemediationWorkerConfig;
    stats: {
      remediationsThisHour: number;
      lastRunAt: number;
      maxPerHour: number;
    };
    engineStatus: ReturnType<RemediationEngine['getStatus']>;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      stats: {
        remediationsThisHour: this.remediationsThisHour,
        lastRunAt: this.lastRunAt,
        maxPerHour: this.config.maxRemediationsPerHour,
      },
      engineStatus: this.engine.getStatus(),
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

let workerInstance: OpsRemediationWorker | null = null;

export function getOpsRemediationWorker(): OpsRemediationWorker {
  if (!workerInstance) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration for OpsRemediationWorker');
    }

    workerInstance = new OpsRemediationWorker(supabaseUrl, supabaseKey);
  }

  return workerInstance;
}

export function createOpsRemediationWorker(
  supabaseUrl: string,
  supabaseServiceKey: string,
  config?: Partial<OpsRemediationWorkerConfig>
): OpsRemediationWorker {
  return new OpsRemediationWorker(supabaseUrl, supabaseServiceKey, config);
}
