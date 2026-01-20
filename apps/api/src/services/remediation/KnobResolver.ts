/* eslint-disable max-lines, max-lines-per-function, complexity */
/**
 * @fileoverview Knob Resolver Service
 *
 * Resolves control knobs from CONTROL_KNOBS_INVENTORY.md
 * Determines which knobs exist and can be programmatically toggled.
 *
 * Part of PR8: Auto-Remediation Playbooks
 *
 * @module services/remediation/KnobResolver
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { makeLogger } from '../../utils/logger';
import {
  KnobDefinition,
  KnobResolutionResult,
} from './types';

const logger = makeLogger('KnobResolver');

// ============================================================================
// Knob Inventory (from CONTROL_KNOBS_INVENTORY.md)
// ============================================================================

/**
 * Static inventory of all known control knobs
 * This is the authoritative source derived from CONTROL_KNOBS_INVENTORY.md
 */
const KNOB_INVENTORY: KnobDefinition[] = [
  // Autopilot Control Plane
  {
    knob_id: 'AUTOPILOT_MODE',
    name: 'Autopilot Mode',
    type: 'EXECUTABLE',
    location: 'autopilot_mode_config table',
    description: 'Main autopilot mode: off, log_only, canary, prod',
    safe_to_toggle: true,
    requires_restart: false,
    toggle_function: 'set_autopilot_mode',
  },
  {
    knob_id: 'AUTOPILOT_GLOBAL_FREEZE',
    name: 'Global Autopilot Freeze',
    type: 'EXECUTABLE',
    location: 'autopilot_policy_config table',
    description: 'Freeze all autopilot actions system-wide',
    safe_to_toggle: true,
    requires_restart: false,
    toggle_function: 'set_autopilot_policy',
  },
  {
    knob_id: 'AUTOPILOT_AGENT_FREEZE',
    name: 'Per-Agent Freeze',
    type: 'EXECUTABLE',
    location: 'autopilot_policy_config table',
    description: 'Freeze specific agents',
    safe_to_toggle: true,
    requires_restart: false,
    toggle_function: 'set_autopilot_policy',
  },
  {
    knob_id: 'AUTOPILOT_ACTION_FREEZE',
    name: 'Per-Action Freeze',
    type: 'EXECUTABLE',
    location: 'autopilot_policy_config table',
    description: 'Freeze specific action types',
    safe_to_toggle: true,
    requires_restart: false,
    toggle_function: 'set_autopilot_policy',
  },

  // File-Based Freeze
  {
    knob_id: 'AUTOPILOT_FREEZE_STATE',
    name: 'Autopilot Freeze State',
    type: 'EXECUTABLE',
    location: 'runtime_config/autopilot_state.json',
    description: 'File-based freeze state for autopilot',
    safe_to_toggle: true,
    requires_restart: false,
    toggle_function: 'set-autopilot-mode.ts script',
  },

  // System Config
  {
    knob_id: 'SYSTEM_FREEZE',
    name: 'System Freeze',
    type: 'EXECUTABLE',
    location: 'system_config table',
    description: 'System-wide freeze configuration',
    safe_to_toggle: true,
    requires_restart: false,
    toggle_function: '/api/admin/freeze',
  },
  {
    knob_id: 'SAFE_MODE',
    name: 'Safe Mode',
    type: 'EXECUTABLE',
    location: 'system_config table',
    description: 'Conservative betting mode with restrictions',
    safe_to_toggle: true,
    requires_restart: false,
    toggle_function: '/api/admin/safe-mode',
  },
  {
    knob_id: 'SHADOW_MODE',
    name: 'Shadow Mode',
    type: 'EXECUTABLE',
    location: 'system_config table',
    description: 'Run system in shadow mode (no real actions)',
    safe_to_toggle: true,
    requires_restart: false,
  },
  {
    knob_id: 'ACTIVE_RESTRICTIONS',
    name: 'Active Restrictions',
    type: 'DERIVED',
    location: 'system_config table',
    description: 'Auto-applied restrictions when safe mode is enabled',
    safe_to_toggle: false,
    requires_restart: false,
  },

  // Environment Variables
  {
    knob_id: 'OPS_NOTIFICATION_WORKER_ENABLED',
    name: 'Ops Notification Worker',
    type: 'ENV_VAR',
    location: 'Environment variable',
    description: 'Enable notification worker',
    safe_to_toggle: false,
    requires_restart: true,
  },
  {
    knob_id: 'OPS_POLL_INTERVAL_MS',
    name: 'Ops Poll Interval',
    type: 'ENV_VAR',
    location: 'Environment variable',
    description: 'Polling interval in milliseconds',
    safe_to_toggle: false,
    requires_restart: true,
  },
  {
    knob_id: 'OPS_DISCORD_ALERTS_ENABLED',
    name: 'Discord Alerts',
    type: 'ENV_VAR',
    location: 'Environment variable',
    description: 'Enable Discord alerts',
    safe_to_toggle: false,
    requires_restart: true,
  },
  {
    knob_id: 'OPS_NOTION_LOGGING_ENABLED',
    name: 'Notion Logging',
    type: 'ENV_VAR',
    location: 'Environment variable',
    description: 'Enable Notion logging',
    safe_to_toggle: false,
    requires_restart: true,
  },
  {
    knob_id: 'OPS_DIGEST_ENABLED',
    name: 'Weekly Digest',
    type: 'ENV_VAR',
    location: 'Environment variable',
    description: 'Enable weekly digest',
    safe_to_toggle: false,
    requires_restart: true,
  },

  // Database Control Tables
  {
    knob_id: 'WORKFLOW_STATUS',
    name: 'Workflow Status',
    type: 'EXECUTABLE',
    location: 'workflow_registry table',
    description: 'Control workflow status (pause/stop)',
    safe_to_toggle: true,
    requires_restart: false,
    toggle_function: 'unregister_workflow',
  },
  {
    knob_id: 'AGENT_ENABLED',
    name: 'Agent Enabled',
    type: 'EXECUTABLE',
    location: 'agent_registry table',
    description: 'Enable/disable specific agents',
    safe_to_toggle: true,
    requires_restart: false,
  },
  {
    knob_id: 'SLO_EVALUATION_ENABLED',
    name: 'SLO Evaluation',
    type: 'RECOMMENDATION_ONLY',
    location: 'ops.slos table',
    description: 'Enable/disable SLO evaluation (requires schema verification)',
    safe_to_toggle: false,
    requires_restart: false,
  },
  {
    knob_id: 'RISK_ENGINE_ENABLED',
    name: 'Risk Engine',
    type: 'EXECUTABLE',
    location: 'capital_policy_config table',
    description: 'Enable/disable risk engine',
    safe_to_toggle: true,
    requires_restart: false,
  },

  // API Rate Limiting
  {
    knob_id: 'API_QUOTA_THROTTLE',
    name: 'API Quota Throttle',
    type: 'RECOMMENDATION_ONLY',
    location: 'In-memory (APIQuotaCoordinator)',
    description: 'API rate limiting (in-memory, no persistent toggle)',
    safe_to_toggle: false,
    requires_restart: false,
  },

  // Discord Webhook (for notifications, not a toggle)
  {
    knob_id: 'DISCORD_WEBHOOK',
    name: 'Discord Webhook',
    type: 'EXECUTABLE',
    location: 'Environment variable / Discord API',
    description: 'Send webhooks to Discord (action, not toggle)',
    safe_to_toggle: true,
    requires_restart: false,
  },
];

// ============================================================================
// KnobResolver Class
// ============================================================================

export class KnobResolver {
  private supabase: SupabaseClient;
  private knobCache: Map<string, KnobResolutionResult> = new Map();
  private cacheTimestamp: number = 0;
  private readonly cacheTtlMs: number = 60000; // 1 minute cache

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    logger.info('KnobResolver initialized');
  }

  /**
   * Get the static inventory of all known knobs
   */
  getInventory(): KnobDefinition[] {
    return [...KNOB_INVENTORY];
  }

  /**
   * Get a specific knob definition
   */
  getKnobDefinition(knobId: string): KnobDefinition | undefined {
    return KNOB_INVENTORY.find(k => k.knob_id === knobId);
  }

  /**
   * Resolve a knob - check if it exists and can be executed
   */
  async resolveKnob(knobId: string): Promise<KnobResolutionResult> {
    // Check cache first
    if (this.isCacheValid() && this.knobCache.has(knobId)) {
      return this.knobCache.get(knobId)!;
    }

    const definition = this.getKnobDefinition(knobId);

    if (!definition) {
      const result: KnobResolutionResult = {
        knob_id: knobId,
        exists: false,
        type: 'RECOMMENDATION_ONLY',
        can_execute: false,
        reason: 'Knob not found in inventory',
      };
      this.knobCache.set(knobId, result);
      return result;
    }

    // For EXECUTABLE knobs, verify they're actually available
    if (definition.type === 'EXECUTABLE') {
      const currentValue = await this.getCurrentValue(definition);
      const result: KnobResolutionResult = {
        knob_id: knobId,
        exists: true,
        type: definition.type,
        current_value: currentValue,
        can_execute: definition.safe_to_toggle,
        reason: definition.safe_to_toggle ? undefined : 'Knob is not safe to toggle',
      };
      this.knobCache.set(knobId, result);
      return result;
    }

    // For ENV_VAR and DERIVED knobs
    const result: KnobResolutionResult = {
      knob_id: knobId,
      exists: true,
      type: definition.type,
      can_execute: false,
      reason: definition.type === 'ENV_VAR'
        ? 'Environment variables cannot be changed at runtime'
        : 'Derived knobs are auto-computed',
    };
    this.knobCache.set(knobId, result);
    return result;
  }

  /**
   * Resolve multiple knobs at once
   */
  async resolveKnobs(knobIds: string[]): Promise<Map<string, KnobResolutionResult>> {
    const results = new Map<string, KnobResolutionResult>();

    for (const knobId of knobIds) {
      const result = await this.resolveKnob(knobId);
      results.set(knobId, result);
    }

    return results;
  }

  /**
   * Check if all required knobs exist and are executable
   */
  async canExecutePlaybook(requiredKnobs: string[]): Promise<{
    canExecute: boolean;
    missingKnobs: string[];
    nonExecutableKnobs: string[];
  }> {
    const resolutions = await this.resolveKnobs(requiredKnobs);

    const missingKnobs: string[] = [];
    const nonExecutableKnobs: string[] = [];

    for (const [knobId, resolution] of resolutions) {
      if (!resolution.exists) {
        missingKnobs.push(knobId);
      } else if (!resolution.can_execute) {
        nonExecutableKnobs.push(knobId);
      }
    }

    return {
      canExecute: missingKnobs.length === 0 && nonExecutableKnobs.length === 0,
      missingKnobs,
      nonExecutableKnobs,
    };
  }

  /**
   * Get current value for a knob
   */
  private async getCurrentValue(definition: KnobDefinition): Promise<unknown> {
    try {
      switch (definition.knob_id) {
        case 'AUTOPILOT_MODE': {
          const { data } = await this.supabase.rpc('get_autopilot_mode');
          return data?.[0]?.mode || 'unknown';
        }

        case 'SYSTEM_FREEZE':
        case 'SAFE_MODE':
        case 'SHADOW_MODE': {
          const configKey = definition.knob_id.toLowerCase();
          const { data } = await this.supabase
            .from('system_config')
            .select('value')
            .eq('key', configKey)
            .single();
          return data?.value;
        }

        case 'AGENT_ENABLED': {
          const { data } = await this.supabase
            .from('agent_registry')
            .select('agent_name, enabled')
            .limit(10);
          return data;
        }

        default:
          return undefined;
      }
    } catch (error) {
      logger.warn(`Failed to get current value for ${definition.knob_id}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return undefined;
    }
  }

  /**
   * Toggle a knob value
   */
  async toggleKnob(
    knobId: string,
    newValue: unknown,
    actor: string,
    dryRun: boolean = true
  ): Promise<{
    success: boolean;
    previousValue?: unknown;
    newValue?: unknown;
    error?: string;
  }> {
    const definition = this.getKnobDefinition(knobId);

    if (!definition) {
      return { success: false, error: 'Knob not found in inventory' };
    }

    if (definition.type !== 'EXECUTABLE') {
      return { success: false, error: `Knob type ${definition.type} is not executable` };
    }

    if (!definition.safe_to_toggle) {
      return { success: false, error: 'Knob is not safe to toggle' };
    }

    // Get current value before toggle
    const previousValue = await this.getCurrentValue(definition);

    if (dryRun) {
      logger.info('DRY RUN: Would toggle knob', {
        knobId,
        previousValue,
        newValue,
        actor,
      });
      return { success: true, previousValue, newValue };
    }

    try {
      switch (knobId) {
        case 'AUTOPILOT_MODE': {
          const { error } = await this.supabase.rpc('set_autopilot_mode', {
            p_mode: newValue,
            p_actor: actor,
            p_confirm: true,
            p_canary_percentage: null,
          });
          if (error) throw error;
          break;
        }

        case 'SYSTEM_FREEZE':
        case 'SAFE_MODE':
        case 'SHADOW_MODE': {
          const configKey = knobId.toLowerCase();
          const { error } = await this.supabase
            .from('system_config')
            .upsert({
              key: configKey,
              value: newValue,
              updated_at: new Date().toISOString(),
            })
            .eq('key', configKey);
          if (error) throw error;
          break;
        }

        default:
          return { success: false, error: `Toggle not implemented for ${knobId}` };
      }

      // Invalidate cache
      this.knobCache.delete(knobId);
      this.cacheTimestamp = 0;

      logger.info('Toggled knob', {
        knobId,
        previousValue,
        newValue,
        actor,
      });

      return { success: true, previousValue, newValue };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to toggle knob', { knobId, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Invalidate the cache
   */
  invalidateCache(): void {
    this.knobCache.clear();
    this.cacheTimestamp = 0;
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.cacheTimestamp < this.cacheTtlMs;
  }
}

// ============================================================================
// Factory
// ============================================================================

let resolverInstance: KnobResolver | null = null;

export function getKnobResolver(): KnobResolver {
  if (!resolverInstance) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration for KnobResolver');
    }

    resolverInstance = new KnobResolver(supabaseUrl, supabaseKey);
  }

  return resolverInstance;
}

export function createKnobResolver(
  supabaseUrl: string,
  supabaseServiceKey: string
): KnobResolver {
  return new KnobResolver(supabaseUrl, supabaseServiceKey);
}
