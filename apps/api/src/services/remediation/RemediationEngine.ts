/* eslint-disable max-lines, max-lines-per-function, complexity */
/**
 * @fileoverview Remediation Engine
 *
 * Main orchestration engine for auto-remediation playbooks.
 * Handles playbook execution, approval workflow, and audit logging.
 *
 * Part of PR8: Auto-Remediation Playbooks
 *
 * CRITICAL: Default to DRY RUN ONLY. No destructive actions without explicit approval.
 *
 * @module services/remediation/RemediationEngine
 */

import * as crypto from 'crypto';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

import { makeLogger } from '../../utils/logger';

import { KnobResolver, getKnobResolver } from './KnobResolver';
import { PlaybookRegistry, getPlaybookRegistry } from './PlaybookRegistry';
import {
  ExecutionContext,
  ExecutionRecord,
  ExecutionResult,
  ExecutionStatus,
  IRemediationEngine,
  PlaybookId,
  RemediationConfig,
  RemediationStats,
} from './types';

const logger = makeLogger('RemediationEngine');

// ============================================================================
// Default Configuration
// ============================================================================

function getDefaultConfig(): RemediationConfig {
  return {
    // Feature flags - EVERYTHING OFF BY DEFAULT
    enabled: process.env.REMEDIATION_ENABLED === 'true',
    dry_run_only: process.env.REMEDIATION_DRY_RUN_ONLY !== 'false', // Default TRUE
    require_approval: process.env.REMEDIATION_REQUIRE_APPROVAL !== 'false', // Default TRUE

    // Rate limiting
    global_max_per_hour: parseInt(process.env.REMEDIATION_MAX_PER_HOUR || '10', 10),
    cooldown_between_runs_seconds: parseInt(process.env.REMEDIATION_COOLDOWN_SECONDS || '60', 10),

    // Execution settings
    max_concurrent_executions: parseInt(process.env.REMEDIATION_MAX_CONCURRENT || '1', 10),
    execution_timeout_seconds: parseInt(process.env.REMEDIATION_TIMEOUT_SECONDS || '300', 10),

    // Notification settings
    notify_on_execution: process.env.REMEDIATION_NOTIFY_EXECUTION === 'true',
    notify_on_recommendation: process.env.REMEDIATION_NOTIFY_RECOMMENDATION === 'true',
    discord_channel_id: process.env.REMEDIATION_DISCORD_CHANNEL_ID,

    // Environment
    environment: process.env.NODE_ENV || 'development',
    command_center_url: process.env.COMMAND_CENTER_URL || 'http://localhost:3004',
  };
}

// ============================================================================
// RemediationEngine Class
// ============================================================================

export class RemediationEngine implements IRemediationEngine {
  private supabase: SupabaseClient;
  private config: RemediationConfig;
  private registry: PlaybookRegistry;
  private knobResolver: KnobResolver;
  private initialized: boolean = false;

  constructor(
    supabaseUrl: string,
    supabaseServiceKey: string,
    config?: Partial<RemediationConfig>,
    registry?: PlaybookRegistry,
    knobResolver?: KnobResolver
  ) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.config = { ...getDefaultConfig(), ...config };
    this.registry = registry || getPlaybookRegistry();
    this.knobResolver = knobResolver || getKnobResolver();

    logger.info('RemediationEngine created', {
      enabled: this.config.enabled,
      dryRunOnly: this.config.dry_run_only,
      requireApproval: this.config.require_approval,
      environment: this.config.environment,
    });
  }

  /**
   * Initialize the engine
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.registry.initialize();
      this.initialized = true;
      logger.info('RemediationEngine initialized');
    } catch (error) {
      logger.error('Failed to initialize RemediationEngine', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Execute a playbook for an incident
   */
  async executePlaybook(
    playbookId: PlaybookId,
    context: ExecutionContext,
    options: { dryRun?: boolean; skipApproval?: boolean } = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = uuidv4();
    const dryRun = options.dryRun ?? this.config.dry_run_only;

    logger.info('Executing playbook', {
      executionId,
      playbookId,
      incidentId: context.incident_id,
      correlationId: context.correlation_id,
      dryRun,
    });

    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if engine is enabled
    if (!this.config.enabled) {
      return this.createSkippedResult(
        executionId,
        playbookId,
        'RECOMMENDATION_ONLY',
        'Remediation engine is disabled',
        startTime,
        dryRun
      );
    }

    // Get playbook
    const playbook = this.registry.get(playbookId);
    const definition = this.registry.getDefinition(playbookId);

    if (!playbook || !definition) {
      return this.createFailedResult(
        executionId,
        playbookId,
        `Playbook ${playbookId} not found or not registered`,
        startTime,
        dryRun
      );
    }

    // Check cooldown and rate limits
    const canExecute = await this.checkExecutionLimits(playbookId, context.incident_id);
    if (!canExecute.allowed) {
      return this.createSkippedResult(
        executionId,
        playbookId,
        definition.execution_type,
        canExecute.reason,
        startTime,
        dryRun
      );
    }

    // Resolve required knobs
    const knobs = await this.knobResolver.resolveKnobs(playbook.requiredKnobs);
    const knobCheck = await this.knobResolver.canExecutePlaybook(playbook.requiredKnobs);

    // Determine execution type based on knob availability
    const effectiveExecutionType = knobCheck.canExecute
      ? definition.execution_type
      : 'RECOMMENDATION_ONLY';

    // Create execution record
    const executionKey = this.generateExecutionKey(playbookId, context);
    await this.createExecutionRecord(
      executionId,
      playbookId,
      context,
      effectiveExecutionType,
      dryRun,
      executionKey
    );

    // If RECOMMENDATION_ONLY, return recommendations without executing
    if (effectiveExecutionType === 'RECOMMENDATION_ONLY' || !playbook.canExecute(knobs)) {
      const recommendations = playbook.getRecommendations(context);

      if (knobCheck.missingKnobs.length > 0) {
        recommendations.unshift(`Missing knobs: ${knobCheck.missingKnobs.join(', ')}`);
      }
      if (knobCheck.nonExecutableKnobs.length > 0) {
        recommendations.unshift(`Non-executable knobs: ${knobCheck.nonExecutableKnobs.join(', ')}`);
      }

      await this.updateExecutionRecord(executionId, 'skipped', {
        recommendations,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      });

      return {
        success: true,
        execution_id: executionId,
        playbook_id: playbookId,
        execution_type: 'RECOMMENDATION_ONLY',
        status: 'skipped',
        actions_taken: [],
        recommendations,
        duration_ms: Date.now() - startTime,
        dry_run: dryRun,
      };
    }

    // If approval is required and not skipped
    if (this.config.require_approval && !options.skipApproval) {
      await this.updateExecutionRecord(executionId, 'pending');

      return {
        success: true,
        execution_id: executionId,
        playbook_id: playbookId,
        execution_type: effectiveExecutionType,
        status: 'pending',
        actions_taken: [],
        recommendations: ['Awaiting approval. Use approveRemediation() to execute.'],
        duration_ms: Date.now() - startTime,
        dry_run: dryRun,
      };
    }

    // Execute the playbook
    try {
      await this.updateExecutionRecord(executionId, 'executed', {
        started_at: new Date().toISOString(),
      });

      const result = await playbook.execute(context, dryRun);

      await this.updateExecutionRecord(executionId, result.success ? 'executed' : 'failed', {
        actions_taken: result.actions_taken,
        rollback_steps: result.rollback_steps,
        error_message: result.error,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      });

      logger.info('Playbook execution completed', {
        executionId,
        playbookId,
        success: result.success,
        dryRun,
        durationMs: Date.now() - startTime,
      });

      return {
        ...result,
        execution_id: executionId,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.updateExecutionRecord(executionId, 'failed', {
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      });

      logger.error('Playbook execution failed', {
        executionId,
        playbookId,
        error: errorMessage,
      });

      return this.createFailedResult(executionId, playbookId, errorMessage, startTime, dryRun);
    }
  }

  /**
   * Get pending remediations awaiting approval
   */
  async getPendingRemediations(): Promise<ExecutionRecord[]> {
    const { data, error } = await this.supabase.rpc('get_pending_remediations');

    if (error) {
      logger.error('Failed to get pending remediations', { error: error.message });
      return [];
    }

    return (data || []) as ExecutionRecord[];
  }

  /**
   * Approve a pending remediation and execute it
   */
  async approveRemediation(executionId: string, approvedBy: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    logger.info('Approving remediation', { executionId, approvedBy });

    // Get the execution record
    const { data: record, error } = await this.supabase.rpc('approve_remediation', {
      p_execution_id: executionId,
      p_approved_by: approvedBy,
    });

    if (error || !record || record.length === 0) {
      return this.createFailedResult(
        executionId,
        'PIPELINE_LAG_THROTTLE' as PlaybookId, // Fallback
        error?.message || 'Execution record not found',
        startTime,
        false
      );
    }

    const executionRecord = record[0] as ExecutionRecord;

    // Re-execute the playbook
    const context: ExecutionContext = {
      incident_id: executionRecord.incident_id,
      triggered_by: executionRecord.triggered_by as ExecutionContext['triggered_by'],
      trigger_value: executionRecord.trigger_value,
      trigger_threshold: executionRecord.trigger_threshold,
      evidence: {},
      correlation_id: executionRecord.correlation_id,
      environment: this.config.environment,
    };

    return this.executePlaybook(executionRecord.playbook_id, context, {
      dryRun: executionRecord.dry_run,
      skipApproval: true,
    });
  }

  /**
   * Get execution history
   */
  async getExecutionHistory(
    options: {
      playbookId?: PlaybookId;
      incidentId?: string;
      limit?: number;
    } = {}
  ): Promise<ExecutionRecord[]> {
    let query = this.supabase
      .from('ops.remediation_executions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(options.limit || 50);

    if (options.playbookId) {
      query = query.eq('playbook_id', options.playbookId);
    }

    if (options.incidentId) {
      query = query.eq('incident_id', options.incidentId);
    }

    const { data, error } = await query;

    if (error) {
      // Try without schema prefix
      let fallbackQuery = this.supabase
        .from('remediation_executions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(options.limit || 50);

      if (options.playbookId) {
        fallbackQuery = fallbackQuery.eq('playbook_id', options.playbookId);
      }

      if (options.incidentId) {
        fallbackQuery = fallbackQuery.eq('incident_id', options.incidentId);
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;

      if (fallbackError) {
        logger.error('Failed to get execution history', { error: fallbackError.message });
        return [];
      }

      return (fallbackData || []) as ExecutionRecord[];
    }

    return (data || []) as ExecutionRecord[];
  }

  /**
   * Get remediation statistics
   */
  async getStats(hoursBack: number = 24): Promise<RemediationStats> {
    const { data, error } = await this.supabase.rpc('get_remediation_stats', {
      p_hours_back: hoursBack,
    });

    if (error) {
      logger.error('Failed to get remediation stats', { error: error.message });
      return this.getEmptyStats();
    }

    const stats = data?.[0];
    if (!stats) {
      return this.getEmptyStats();
    }

    return stats as RemediationStats;
  }

  /**
   * Get engine status
   */
  getStatus(): {
    config: RemediationConfig;
    registryStatus: ReturnType<PlaybookRegistry['getStatus']>;
    initialized: boolean;
  } {
    return {
      config: this.config,
      registryStatus: this.registry.getStatus(),
      initialized: this.initialized,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Check execution limits (cooldown and rate limits)
   */
  private async checkExecutionLimits(
    playbookId: PlaybookId,
    incidentId: string
  ): Promise<{ allowed: boolean; reason: string }> {
    const { data, error } = await this.supabase.rpc('should_execute_playbook', {
      p_playbook_id: playbookId,
      p_incident_id: incidentId,
    });

    if (error) {
      logger.warn('Failed to check execution limits, allowing execution', {
        error: error.message,
      });
      return { allowed: true, reason: 'check_failed' };
    }

    const result = data?.[0];
    return {
      allowed: result?.should_execute ?? true,
      reason: result?.reason ?? 'unknown',
    };
  }

  /**
   * Generate idempotency key for execution
   */
  private generateExecutionKey(playbookId: PlaybookId, context: ExecutionContext): string {
    const keyData = `${playbookId}:${context.incident_id}:${context.correlation_id}`;
    return crypto.createHash('sha256').update(keyData).digest('hex').substring(0, 32);
  }

  /**
   * Create execution record in database
   */
  private async createExecutionRecord(
    executionId: string,
    playbookId: PlaybookId,
    context: ExecutionContext,
    executionType: string,
    dryRun: boolean,
    executionKey: string
  ): Promise<void> {
    const { error } = await this.supabase.rpc('create_remediation_execution', {
      p_execution_id: executionId,
      p_playbook_id: playbookId,
      p_incident_id: context.incident_id,
      p_correlation_id: context.correlation_id,
      p_execution_key: executionKey,
      p_execution_type: executionType,
      p_triggered_by: context.triggered_by,
      p_trigger_value: context.trigger_value,
      p_trigger_threshold: context.trigger_threshold,
      p_dry_run: dryRun,
    });

    if (error) {
      logger.error('Failed to create execution record', { error: error.message });
    }
  }

  /**
   * Update execution record status
   */
  private async updateExecutionRecord(
    executionId: string,
    status: ExecutionStatus,
    updates?: Partial<ExecutionRecord>
  ): Promise<void> {
    const { error } = await this.supabase.rpc('update_execution_status', {
      p_execution_id: executionId,
      p_status: status,
      p_actions_taken: updates?.actions_taken || null,
      p_recommendations: updates?.recommendations || null,
      p_rollback_steps: updates?.rollback_steps || null,
      p_error_message: updates?.error_message || null,
      p_completed_at: updates?.completed_at || null,
      p_duration_ms: updates?.duration_ms || null,
    });

    if (error) {
      logger.error('Failed to update execution record', { error: error.message });
    }
  }

  /**
   * Create a skipped result
   */
  private createSkippedResult(
    executionId: string,
    playbookId: PlaybookId,
    executionType: string,
    reason: string,
    startTime: number,
    dryRun: boolean
  ): ExecutionResult {
    return {
      success: true,
      execution_id: executionId,
      playbook_id: playbookId,
      execution_type: executionType as ExecutionResult['execution_type'],
      status: 'skipped',
      actions_taken: [],
      recommendations: [reason],
      duration_ms: Date.now() - startTime,
      dry_run: dryRun,
    };
  }

  /**
   * Create a failed result
   */
  private createFailedResult(
    executionId: string,
    playbookId: PlaybookId,
    error: string,
    startTime: number,
    dryRun: boolean
  ): ExecutionResult {
    return {
      success: false,
      execution_id: executionId,
      playbook_id: playbookId,
      execution_type: 'RECOMMENDATION_ONLY',
      status: 'failed',
      actions_taken: [],
      error,
      duration_ms: Date.now() - startTime,
      dry_run: dryRun,
    };
  }

  /**
   * Get empty stats structure
   */
  private getEmptyStats(): RemediationStats {
    return {
      total_executions: 0,
      successful: 0,
      failed: 0,
      pending_approval: 0,
      recommendations_given: 0,
      by_playbook: {} as RemediationStats['by_playbook'],
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

let engineInstance: RemediationEngine | null = null;

export function getRemediationEngine(): RemediationEngine {
  if (!engineInstance) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration for RemediationEngine');
    }

    engineInstance = new RemediationEngine(supabaseUrl, supabaseKey);
  }

  return engineInstance;
}

export function createRemediationEngine(
  supabaseUrl: string,
  supabaseServiceKey: string,
  config?: Partial<RemediationConfig>
): RemediationEngine {
  return new RemediationEngine(supabaseUrl, supabaseServiceKey, config);
}
