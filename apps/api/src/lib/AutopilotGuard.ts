/**
 * AutopilotGuard - Unified side-effect control plane
 *
 * Phase 6.5: Autopilot as sole authority for side effects
 *
 * This guard is the SINGLE CHOKE-POINT for all external side effects.
 * Every Discord post, notification, webhook call, etc. MUST go through
 * this guard before execution.
 *
 * Modes:
 * - OFF: All side effects blocked (dry-run)
 * - LOG_ONLY: Side effects blocked but logged for analysis
 * - CANARY: Limited side effects allowed (percentage-based)
 * - PROD: Full side effects allowed
 *
 * Evidence Logging:
 * Every decision is logged to `autopilot_decisions` table for audit trail.
 */

import { createLogger } from '../utils/logger';
import { supabase as supabaseClient } from '../services/supabaseClient';
import { shadowMode } from '../shadow/ShadowMode';
import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type SideEffectAction =
  | 'DISCORD_POST'
  | 'DISCORD_ALERT'
  | 'NOTIFICATION_SEND'
  | 'DB_POSTED_MUTATION'
  | 'WEBHOOK_CALL'
  | 'SMS_SEND'
  | 'EMAIL_SEND'
  | 'VIP_CHANNEL_POST'
  | 'GAME_THREAD_POST'
  | 'COACHING_DM'
  | 'PROMO_PUBLISH';

export type AutopilotMode = 'off' | 'log_only' | 'canary' | 'prod';

export type GuardDecision = 'ALLOW' | 'REJECT' | 'UNKNOWN';

export interface SideEffectContext {
  action: SideEffectAction;
  pick_id?: string;
  agent_name: string;
  channel_id?: string;
  recipient_id?: string;
  correlation_id?: string;
  run_id?: string;
  workflow_id?: string;
  metadata?: Record<string, unknown>;
}

export interface GuardResult {
  allowed: boolean;
  decision: GuardDecision;
  reason: string;
  mode: AutopilotMode;
  evidence_id?: string;
}

export interface AutopilotDecisionRow {
  action_type: SideEffectAction;
  context_hash: string;
  agent_name: string;
  correlation_id?: string;
  run_id?: string;
  pick_id?: string;
  decision: GuardDecision;
  mode: AutopilotMode;
  reason: string;
  gate_snapshot_json: Record<string, unknown>;
  created_at?: string;
}

// ============================================================================
// AutopilotGuard Service
// ============================================================================

export class AutopilotGuard {
  private static instance: AutopilotGuard;
  private logger: ReturnType<typeof createLogger>;
  private mode: AutopilotMode;
  private canaryPercentage: number;

  private constructor() {
    this.logger = createLogger('AutopilotGuard');
    this.mode = this.determineMode();
    this.canaryPercentage = this.getCanaryPercentage();

    this.logger.info('AutopilotGuard initialized', {
      mode: this.mode,
      canaryPercentage: this.canaryPercentage,
      shadowMode: shadowMode.isShadowMode()
    });
  }

  public static getInstance(): AutopilotGuard {
    if (!AutopilotGuard.instance) {
      AutopilotGuard.instance = new AutopilotGuard();
    }
    return AutopilotGuard.instance;
  }

  /**
   * MAIN ENTRY POINT: Assert that a side effect may be performed
   *
   * This is the unified gate that MUST be called before any external side effect.
   * It handles mode-based decisions, evidence logging, and fail-closed behavior.
   *
   * @param context - The side effect context including action type and agent info
   * @returns GuardResult with allowed status and evidence trail
   * @throws Error if evaluation fails (fail-closed behavior)
   */
  public async assertMayPerformSideEffect(context: SideEffectContext): Promise<GuardResult> {
    const startTime = Date.now();
    let result: GuardResult;
    let contextHash = 'unknown';

    try {
      // Compute context hash (inside try for fail-closed behavior)
      contextHash = this.computeContextHash(context);

      this.logger.debug('Evaluating side effect', {
        action: context.action,
        agent: context.agent_name,
        contextHash
      });

      // Determine decision based on mode
      result = await this.evaluateDecision(context);

      // Log evidence to database
      const evidenceId = await this.logEvidence(context, result, contextHash);
      result.evidence_id = evidenceId;

      const duration = Date.now() - startTime;
      this.logger.info('Side effect decision', {
        action: context.action,
        agent: context.agent_name,
        decision: result.decision,
        allowed: result.allowed,
        mode: result.mode,
        reason: result.reason,
        evidenceId,
        durationMs: duration
      });

      return result;

    } catch (error) {
      // FAIL-CLOSED: On any error, reject the side effect
      this.logger.error('AutopilotGuard evaluation failed - REJECTING (fail-closed)', {
        action: context?.action ?? 'unknown',
        agent: context?.agent_name ?? 'unknown',
        error: error instanceof Error ? error.message : String(error)
      });

      result = {
        allowed: false,
        decision: 'UNKNOWN',
        reason: `Evaluation error (fail-closed): ${error instanceof Error ? error.message : String(error)}`,
        mode: this.mode
      };

      // Still try to log the failure (only if context is valid)
      if (context) {
        try {
          const evidenceId = await this.logEvidence(context, result, contextHash);
          result.evidence_id = evidenceId;
        } catch {
          // Ignore logging errors in fail-closed path
        }
      }

      return result;
    }
  }

  /**
   * Convenience method to check and throw if not allowed
   */
  public async assertOrThrow(context: SideEffectContext): Promise<GuardResult> {
    const result = await this.assertMayPerformSideEffect(context);

    if (!result.allowed) {
      throw new Error(`Side effect blocked: ${result.reason} [mode=${result.mode}]`);
    }

    return result;
  }

  /**
   * Evaluate decision based on current mode
   */
  private async evaluateDecision(context: SideEffectContext): Promise<GuardResult> {
    const mode = this.mode;

    // Fast-path rejections for OFF and LOG_ONLY modes
    if (mode === 'off') {
      return {
        allowed: false,
        decision: 'REJECT',
        reason: 'Autopilot mode is OFF - all side effects blocked',
        mode
      };
    }

    if (mode === 'log_only') {
      return {
        allowed: false,
        decision: 'REJECT',
        reason: 'Autopilot mode is LOG_ONLY - side effects logged but not executed',
        mode
      };
    }

    // For CANARY mode, use percentage-based rollout
    if (mode === 'canary') {
      const shouldAllow = this.evaluateCanary(context);
      return {
        allowed: shouldAllow,
        decision: shouldAllow ? 'ALLOW' : 'REJECT',
        reason: shouldAllow
          ? `Canary mode - action allowed (${this.canaryPercentage}% rollout)`
          : `Canary mode - action not in rollout group (${this.canaryPercentage}% rollout)`,
        mode
      };
    }

    // PROD mode - check shadowMode as final gate
    if (mode === 'prod') {
      // Integrate with existing shadowMode for backwards compatibility
      const shadowBlocked = shadowMode.shouldSkipPublicAction(
        this.mapActionToShadowType(context.action)
      );

      if (shadowBlocked) {
        return {
          allowed: false,
          decision: 'REJECT',
          reason: 'Shadow mode is active - public actions blocked',
          mode
        };
      }

      return {
        allowed: true,
        decision: 'ALLOW',
        reason: 'Autopilot mode is PROD - side effect allowed',
        mode
      };
    }

    // UNKNOWN mode - fail closed
    return {
      allowed: false,
      decision: 'UNKNOWN',
      reason: `Unknown autopilot mode: ${mode}`,
      mode
    };
  }

  /**
   * Evaluate canary rollout decision
   */
  private evaluateCanary(context: SideEffectContext): boolean {
    // Use context hash to determine consistent canary bucket
    const hash = this.computeContextHash(context);
    const bucket = parseInt(hash.substring(0, 8), 16) % 100;
    return bucket < this.canaryPercentage;
  }

  /**
   * Log evidence to autopilot_decisions table
   */
  private async logEvidence(
    context: SideEffectContext,
    result: GuardResult,
    contextHash: string
  ): Promise<string | undefined> {
    try {
      const row: AutopilotDecisionRow = {
        action_type: context.action,
        context_hash: contextHash,
        agent_name: context.agent_name,
        correlation_id: context.correlation_id,
        run_id: context.run_id,
        pick_id: context.pick_id,
        decision: result.decision,
        mode: result.mode,
        reason: result.reason,
        gate_snapshot_json: {
          shadowMode: shadowMode.isShadowMode(),
          canaryPercentage: this.canaryPercentage,
          workflowId: context.workflow_id,
          channelId: context.channel_id,
          recipientId: context.recipient_id,
          metadata: context.metadata,
          evaluatedAt: new Date().toISOString()
        }
      };

      const { data, error } = await supabaseClient
        .from('autopilot_decisions')
        .insert(row)
        .select('id')
        .single();

      if (error) {
        this.logger.warn('Failed to log autopilot decision', { error: error.message });
        return undefined;
      }

      return data?.id;
    } catch (error) {
      this.logger.warn('Error logging autopilot decision', {
        error: error instanceof Error ? error.message : String(error)
      });
      return undefined;
    }
  }

  /**
   * Compute deterministic hash of context for deduplication and canary bucketing
   */
  private computeContextHash(context: SideEffectContext): string {
    const hashInput = JSON.stringify({
      action: context.action,
      pick_id: context.pick_id,
      agent_name: context.agent_name,
      channel_id: context.channel_id,
      recipient_id: context.recipient_id
    });
    return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  }

  /**
   * Map SideEffectAction to shadow mode action type
   */
  private mapActionToShadowType(action: SideEffectAction): 'publish' | 'alert' | 'webhook' {
    switch (action) {
      case 'DISCORD_POST':
      case 'VIP_CHANNEL_POST':
      case 'GAME_THREAD_POST':
      case 'PROMO_PUBLISH':
        return 'publish';
      case 'DISCORD_ALERT':
      case 'NOTIFICATION_SEND':
      case 'SMS_SEND':
      case 'EMAIL_SEND':
      case 'COACHING_DM':
        return 'alert';
      case 'WEBHOOK_CALL':
      case 'DB_POSTED_MUTATION':
      default:
        return 'webhook';
    }
  }

  /**
   * Determine autopilot mode from environment
   */
  private determineMode(): AutopilotMode {
    const envMode = process.env.AUTOPILOT_MODE?.toLowerCase();

    if (envMode === 'off' || envMode === 'log_only' || envMode === 'canary' || envMode === 'prod') {
      return envMode;
    }

    // Default to log_only if shadow mode is enabled
    if (shadowMode.isShadowMode()) {
      return 'log_only';
    }

    // Default to off for safety
    return 'off';
  }

  /**
   * Get canary percentage from environment
   */
  private getCanaryPercentage(): number {
    const envPercentage = parseInt(process.env.AUTOPILOT_CANARY_PERCENTAGE || '0', 10);
    return Math.max(0, Math.min(100, envPercentage));
  }

  /**
   * Get current mode (for monitoring/debugging)
   */
  public getMode(): AutopilotMode {
    return this.mode;
  }

  /**
   * Set mode programmatically (for testing)
   */
  public setMode(mode: AutopilotMode): void {
    this.logger.info('Autopilot mode changed', { from: this.mode, to: mode });
    this.mode = mode;
  }

  /**
   * Get guard status for health checks
   */
  public getStatus(): {
    mode: AutopilotMode;
    canaryPercentage: number;
    shadowMode: boolean;
    ready: boolean;
  } {
    return {
      mode: this.mode,
      canaryPercentage: this.canaryPercentage,
      shadowMode: shadowMode.isShadowMode(),
      ready: true
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export const autopilotGuard = AutopilotGuard.getInstance();

// Convenience function for inline usage
export async function assertMayPerformSideEffect(
  context: SideEffectContext
): Promise<GuardResult> {
  return autopilotGuard.assertMayPerformSideEffect(context);
}

export default AutopilotGuard;
