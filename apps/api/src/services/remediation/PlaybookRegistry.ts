/* eslint-disable max-lines-per-function */
/**
 * @fileoverview Playbook Registry
 *
 * Singleton registry for all remediation playbooks.
 * Manages playbook lifecycle and lookup.
 *
 * Part of PR8: Auto-Remediation Playbooks
 *
 * @module services/remediation/PlaybookRegistry
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { makeLogger } from '../../utils/logger';
import {
  IPlaybook,
  PlaybookDefinition,
  PlaybookId,
  PlaybookStatus,
} from './types';

const logger = makeLogger('PlaybookRegistry');

// ============================================================================
// PlaybookRegistry Class
// ============================================================================

export class PlaybookRegistry {
  private static instance: PlaybookRegistry | null = null;
  private playbooks: Map<PlaybookId, IPlaybook> = new Map();
  private definitions: Map<PlaybookId, PlaybookDefinition> = new Map();
  private supabase: SupabaseClient;
  private initialized: boolean = false;

  private constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Get the singleton instance
   */
  static getInstance(supabaseUrl?: string, supabaseServiceKey?: string): PlaybookRegistry {
    if (!PlaybookRegistry.instance) {
      const url = supabaseUrl || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = supabaseServiceKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!url || !key) {
        throw new Error('Missing Supabase configuration for PlaybookRegistry');
      }

      PlaybookRegistry.instance = new PlaybookRegistry(url, key);
    }

    return PlaybookRegistry.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static resetInstance(): void {
    PlaybookRegistry.instance = null;
  }

  /**
   * Initialize the registry by loading playbook definitions from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing PlaybookRegistry');

      // Load playbook definitions from database
      await this.loadDefinitions();

      this.initialized = true;
      logger.info('PlaybookRegistry initialized', {
        playbookCount: this.definitions.size,
        playbooks: Array.from(this.definitions.keys()),
      });
    } catch (error) {
      logger.error('Failed to initialize PlaybookRegistry', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Load playbook definitions from the database
   */
  private async loadDefinitions(): Promise<void> {
    const { data, error } = await this.supabase
      .from('ops.remediation_playbooks')
      .select('*')
      .eq('status', 'active');

    if (error) {
      // Try without schema prefix in case ops schema doesn't exist yet
      const { data: fallbackData, error: fallbackError } = await this.supabase
        .from('remediation_playbooks')
        .select('*')
        .eq('status', 'active');

      if (fallbackError) {
        logger.warn('Could not load playbook definitions from database, using defaults', {
          error: fallbackError.message,
        });
        this.loadDefaultDefinitions();
        return;
      }

      if (fallbackData) {
        for (const def of fallbackData) {
          this.definitions.set(def.playbook_id as PlaybookId, def as PlaybookDefinition);
        }
      }
      return;
    }

    if (data) {
      for (const def of data) {
        this.definitions.set(def.playbook_id as PlaybookId, def as PlaybookDefinition);
      }
    }
  }

  /**
   * Load default playbook definitions if database is unavailable
   */
  private loadDefaultDefinitions(): void {
    const defaults: PlaybookDefinition[] = [
      {
        playbook_id: 'MV_REFRESH_LAG',
        name: 'Materialized View Refresh Lag',
        description: 'Handle stale materialized views causing SLO breaches',
        execution_type: 'RECOMMENDATION_ONLY',
        required_knobs: ['SLO_EVALUATION_ENABLED'],
        default_action: {
          recommendation: 'Manually run REFRESH MATERIALIZED VIEW CONCURRENTLY',
        },
        cooldown_seconds: 900,
        max_per_hour: 4,
        status: 'active',
        version: 1,
      },
      {
        playbook_id: 'PIPELINE_LAG_THROTTLE',
        name: 'Pipeline Lag Throttle',
        description: 'Reduce pipeline throughput when processing falls behind',
        execution_type: 'EXECUTABLE',
        required_knobs: ['AUTOPILOT_MODE'],
        default_action: {
          action: 'set_autopilot_mode',
          target_mode: 'log_only',
        },
        cooldown_seconds: 300,
        max_per_hour: 6,
        status: 'active',
        version: 1,
      },
      {
        playbook_id: 'CREDIT_BURN_THROTTLE',
        name: 'API Credit Burn Throttle',
        description: 'Reduce API usage when approaching credit limits',
        execution_type: 'RECOMMENDATION_ONLY',
        required_knobs: ['API_QUOTA_THROTTLE'],
        default_action: {
          recommendation: 'Reduce API call frequency or contact provider',
        },
        cooldown_seconds: 1800,
        max_per_hour: 2,
        status: 'active',
        version: 1,
      },
      {
        playbook_id: 'DISCORD_BACKLOG_NUDGE',
        name: 'Discord Backlog Nudge',
        description: 'Alert ops team when Discord notification backlog grows',
        execution_type: 'EXECUTABLE',
        required_knobs: ['DISCORD_WEBHOOK'],
        default_action: {
          action: 'send_discord_notification',
          channel: 'ops',
        },
        cooldown_seconds: 600,
        max_per_hour: 3,
        status: 'active',
        version: 1,
      },
      {
        playbook_id: 'SLO_EVALUATOR_STUCK',
        name: 'SLO Evaluator Stuck',
        description: 'Handle stuck or unresponsive SLO evaluator',
        execution_type: 'EXECUTABLE',
        required_knobs: ['WORKFLOW_STATUS', 'AGENT_ENABLED'],
        default_action: {
          action: 'restart_agent',
          target_agent: 'SLOEvaluator',
        },
        cooldown_seconds: 600,
        max_per_hour: 3,
        status: 'active',
        version: 1,
      },
    ];

    for (const def of defaults) {
      this.definitions.set(def.playbook_id, def);
    }
  }

  /**
   * Register a playbook implementation
   */
  register(playbook: IPlaybook): void {
    if (this.playbooks.has(playbook.id)) {
      logger.warn(`Playbook ${playbook.id} is already registered, overwriting`);
    }

    this.playbooks.set(playbook.id, playbook);
    logger.info(`Registered playbook: ${playbook.id}`);
  }

  /**
   * Unregister a playbook
   */
  unregister(playbookId: PlaybookId): boolean {
    const result = this.playbooks.delete(playbookId);
    if (result) {
      logger.info(`Unregistered playbook: ${playbookId}`);
    }
    return result;
  }

  /**
   * Get a playbook by ID
   */
  get(playbookId: PlaybookId): IPlaybook | undefined {
    return this.playbooks.get(playbookId);
  }

  /**
   * Get a playbook definition by ID
   */
  getDefinition(playbookId: PlaybookId): PlaybookDefinition | undefined {
    return this.definitions.get(playbookId);
  }

  /**
   * Check if a playbook is registered
   */
  has(playbookId: PlaybookId): boolean {
    return this.playbooks.has(playbookId);
  }

  /**
   * Get all registered playbook IDs
   */
  getRegisteredIds(): PlaybookId[] {
    return Array.from(this.playbooks.keys());
  }

  /**
   * Get all playbook definitions
   */
  getAllDefinitions(): PlaybookDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Get playbooks by status
   */
  getByStatus(status: PlaybookStatus): PlaybookDefinition[] {
    return Array.from(this.definitions.values()).filter(d => d.status === status);
  }

  /**
   * Update a playbook definition in the database
   */
  async updateDefinition(
    playbookId: PlaybookId,
    updates: Partial<Omit<PlaybookDefinition, 'playbook_id'>>
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('ops.remediation_playbooks')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('playbook_id', playbookId);

      if (error) {
        // Try without schema prefix
        const { error: fallbackError } = await this.supabase
          .from('remediation_playbooks')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('playbook_id', playbookId);

        if (fallbackError) throw fallbackError;
      }

      // Update local cache
      const existing = this.definitions.get(playbookId);
      if (existing) {
        this.definitions.set(playbookId, { ...existing, ...updates });
      }

      logger.info(`Updated playbook definition: ${playbookId}`, { updates });
      return true;
    } catch (error) {
      logger.error(`Failed to update playbook definition: ${playbookId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Enable or disable a playbook
   */
  async setStatus(playbookId: PlaybookId, status: PlaybookStatus): Promise<boolean> {
    return this.updateDefinition(playbookId, { status });
  }

  /**
   * Get registry status
   */
  getStatus(): {
    initialized: boolean;
    registeredPlaybooks: number;
    definedPlaybooks: number;
    activePlaybooks: number;
  } {
    return {
      initialized: this.initialized,
      registeredPlaybooks: this.playbooks.size,
      definedPlaybooks: this.definitions.size,
      activePlaybooks: Array.from(this.definitions.values()).filter(d => d.status === 'active').length,
    };
  }

  /**
   * Reload definitions from database
   */
  async reload(): Promise<void> {
    this.definitions.clear();
    await this.loadDefinitions();
    logger.info('Reloaded playbook definitions', {
      count: this.definitions.size,
    });
  }
}

// ============================================================================
// Factory
// ============================================================================

export function getPlaybookRegistry(): PlaybookRegistry {
  return PlaybookRegistry.getInstance();
}

export function createPlaybookRegistry(
  supabaseUrl: string,
  supabaseServiceKey: string
): PlaybookRegistry {
  return PlaybookRegistry.getInstance(supabaseUrl, supabaseServiceKey);
}
