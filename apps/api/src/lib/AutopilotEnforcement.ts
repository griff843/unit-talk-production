/**
 * AutopilotEnforcement - Phase 4 Enforcement Wiring
 *
 * This module provides the enforcement layer that wires the Policy Engine
 * into all autopilot-capable code paths.
 *
 * Usage:
 * 1. Wrap any autopilot action with `enforcePolicy()`
 * 2. Policy is evaluated BEFORE action execution
 * 3. Decision is logged to ledger regardless of outcome
 * 4. Action only executes if ALLOW is returned
 * 5. SHADOW mode: evaluates and logs but never executes
 *
 * @module AutopilotEnforcement
 */

import { v4 as uuidv4 } from 'uuid';

import { supabase as supabaseClient } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

import {
  AutopilotPolicyEngine,
  getAutopilotPolicyEngine,
  AutopilotActionType,
  PolicyContext,
  PolicyEvidence,
  PolicyEvaluationResult,
  SystemState,
  AutopilotMode,
} from './AutopilotPolicyEngine';

// ============================================================================
// Types
// ============================================================================

/**
 * Action executor function type
 */
export type ActionExecutor<T> = () => Promise<T>;

/**
 * Enforcement result
 */
export interface EnforcementResult<T> {
  executed: boolean;
  decision: 'ALLOW' | 'DENY' | 'SHADOW_ONLY';
  decision_id: string;
  trace_id: string;
  reason_codes: string[];
  reason_message: string;
  result?: T;
  error?: Error;
  policy_version: string;
  mode: AutopilotMode;
}

/**
 * Options for policy enforcement
 */
export interface EnforcementOptions {
  /** Skip ledger write (for testing only) */
  skipLedger?: boolean;
  /** Skip cooldown application */
  skipCooldown?: boolean;
  /** Custom evidence payload */
  evidenceOverride?: Partial<PolicyEvidence>;
  /** Dry run mode (never execute, but evaluate) */
  dryRun?: boolean;
}

// ============================================================================
// Logger
// ============================================================================

const logger = createLogger('AutopilotEnforcement');

// ============================================================================
// Evidence Collection
// ============================================================================

/**
 * Collect evidence for policy evaluation from system state
 */
async function collectEvidence(
  context: PolicyContext,
  overrides?: Partial<PolicyEvidence>
): Promise<PolicyEvidence> {
  const evidence: PolicyEvidence = {};

  try {
    // Get sample size from historical data
    if (context.capper_id) {
      const { data: pickData } = await supabaseClient
        .from('unified_picks')
        .select('id', { count: 'exact' })
        .eq('user_id', context.capper_id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      evidence.sample_size = pickData?.length || 0;
    }

    // Get confidence metrics from the pick if available
    if (context.pick_id) {
      const { data: pickData } = await supabaseClient
        .from('unified_picks')
        .select('confidence, tier')
        .eq('id', context.pick_id)
        .single();

      if (pickData) {
        evidence.confidence_score = pickData.confidence ? pickData.confidence / 100 : undefined;
        evidence.confidence_tier = pickData.tier as PolicyEvidence['confidence_tier'];
      }
    }

    // Get CLV metrics if capper_id is available
    if (context.capper_id) {
      const { data: clvData } = await supabaseClient
        .from('clv_tracking')
        .select('clv, beatsClosing')
        .eq('userId', context.capper_id)
        .not('closingLine', 'is', null)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (clvData && clvData.length > 0) {
        const positiveClv = clvData.filter(c => c.beatsClosing).length;
        evidence.clv_positive_rate = positiveClv / clvData.length;
      }
    }

    // Get pipeline health from trace spine
    const { data: healthData } = await supabaseClient
      .from('v_trace_spine_health')
      .select('*')
      .single();

    if (healthData) {
      evidence.pipeline_health = healthData.overall_health;
      evidence.sla_pass_rate = healthData.sla_pass_rate;
      evidence.stuck_picks_count = healthData.stuck_count;
    }

    // Apply overrides
    return { ...evidence, ...overrides };
  } catch (err) {
    logger.error('Error collecting evidence', { error: err, context });
    // Return minimal evidence on error (will likely result in DENY)
    return { ...evidence, ...overrides };
  }
}

/**
 * Collect current system state
 */
async function collectSystemState(): Promise<SystemState> {
  try {
    // Get trace spine health
    const { data: healthData } = await supabaseClient
      .from('v_trace_spine_health')
      .select('*')
      .single();

    // Get policy config for mode and freezes
    const { data: configData } = await supabaseClient
      .from('autopilot_policy_config')
      .select('*')
      .eq('id', 'default')
      .single();

    // Get active cooldowns
    const { data: cooldownData } = await supabaseClient
      .from('autopilot_cooldowns')
      .select('*')
      .gt('expires_at', new Date().toISOString());

    // Determine SLO status
    let sloStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
    let platformHealth: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

    if (healthData) {
      platformHealth = healthData.overall_health || 'PASS';
      if (platformHealth === 'FAIL') {
        sloStatus = 'CRITICAL';
      } else if (platformHealth === 'WARN') {
        sloStatus = 'DEGRADED';
      }
    }

    const overrides = configData?.operator_overrides || {};

    return {
      slo_status: sloStatus,
      platform_health: platformHealth,
      global_freeze: overrides.global_freeze || false,
      agent_freezes: Object.keys(overrides.agent_freezes || {}).filter(
        k => overrides.agent_freezes[k]
      ),
      action_freezes: Object.keys(overrides.action_freezes || {}).filter(
        k => overrides.action_freezes[k]
      ) as AutopilotActionType[],
      active_cooldowns: (cooldownData || []).map(
        (c: { entity_id: string; action_type: string; expires_at: string }) => ({
          entity_id: c.entity_id,
          action_type: c.action_type as AutopilotActionType,
          expires_at: c.expires_at,
        })
      ),
      current_mode: (configData?.default_mode || 'SHADOW') as AutopilotMode,
      canary_percentage: configData?.canary_percentage || 10,
    };
  } catch (err) {
    logger.error('Error collecting system state', { error: err });
    // Return restrictive state on error (FAIL-CLOSED)
    return {
      slo_status: 'CRITICAL',
      platform_health: 'FAIL',
      global_freeze: true,
      agent_freezes: [],
      action_freezes: [],
      active_cooldowns: [],
      current_mode: 'OFF',
      canary_percentage: 0,
    };
  }
}

// ============================================================================
// Core Enforcement Functions
// ============================================================================

/**
 * Enforce autopilot policy before executing an action
 *
 * This is the primary enforcement function. All autopilot-capable code paths
 * MUST call this function before executing their action.
 *
 * @param actionType - The type of autopilot action
 * @param context - Context for the action (agent, pick, etc.)
 * @param executor - The action to execute if allowed
 * @param options - Optional enforcement options
 * @returns Enforcement result with execution outcome
 *
 * @example
 * ```typescript
 * const result = await enforcePolicy(
 *   'PUBLISH_PICK',
 *   { agent_id: 'GradingAgent', agent_name: 'GradingAgent', pick_id: 'abc123' },
 *   async () => {
 *     await publishToDiscord(pick);
 *     return { published: true };
 *   }
 * );
 *
 * if (result.executed) {
 *   console.log('Pick published:', result.result);
 * } else {
 *   console.log('Blocked:', result.reason_message);
 * }
 * ```
 */
export async function enforcePolicy<T>(
  actionType: AutopilotActionType,
  context: PolicyContext,
  executor: ActionExecutor<T>,
  options: EnforcementOptions = {}
): Promise<EnforcementResult<T>> {
  const traceId = context.trace_id || uuidv4();
  const policyEngine = getAutopilotPolicyEngine();

  try {
    // 1. Collect evidence
    const evidence = await collectEvidence(context, options.evidenceOverride);

    // 2. Collect system state
    const systemState = await collectSystemState();

    // 3. Evaluate policy
    const evaluation = await policyEngine.evaluate({
      action_type: actionType,
      context: { ...context, trace_id: traceId },
      evidence,
      system_state: systemState,
    });

    // 4. Determine if we should execute
    const shouldExecute = evaluation.decision === 'ALLOW' && !options.dryRun;

    let executionResult: T | undefined;
    let executionError: Error | undefined;
    let executed = false;

    // 5. Execute action if allowed
    if (shouldExecute) {
      try {
        executionResult = await executor();
        executed = true;

        logger.info('Autopilot action executed', {
          action_type: actionType,
          decision_id: evaluation.decision_id,
          trace_id: traceId,
          agent: context.agent_name,
        });
      } catch (err) {
        executionError = err instanceof Error ? err : new Error(String(err));
        logger.error('Autopilot action execution failed', {
          action_type: actionType,
          decision_id: evaluation.decision_id,
          trace_id: traceId,
          error: executionError.message,
        });
      }
    } else {
      // Log shadow/deny decisions
      logger.debug('Autopilot action not executed', {
        action_type: actionType,
        decision: evaluation.decision,
        decision_id: evaluation.decision_id,
        trace_id: traceId,
        reason: evaluation.reason_message,
      });
    }

    // 6. Write to decision ledger
    if (!options.skipLedger) {
      await policyEngine.writeToLedger(evaluation, executed, {
        success: executed && !executionError,
        error: executionError?.message,
        output: executionResult ? { result: 'action_completed' } : undefined,
      });
    }

    // 7. Apply cooldown if executed and configured
    if (executed && !options.skipCooldown) {
      const rule = await getRuleForAction(actionType);
      if (rule?.cooldown_seconds) {
        const entityId = getEntityId(context, rule.cooldown_scope);
        await policyEngine.applyCooldown(actionType, entityId, rule.cooldown_seconds);
      }
    }

    return {
      executed,
      decision: evaluation.decision,
      decision_id: evaluation.decision_id,
      trace_id: traceId,
      reason_codes: evaluation.reason_codes,
      reason_message: evaluation.reason_message,
      result: executionResult,
      error: executionError,
      policy_version: evaluation.policy_version,
      mode: evaluation.mode,
    };
  } catch (err) {
    // FAIL-CLOSED: Any error results in DENY
    logger.error('Enforcement error - FAIL-CLOSED', {
      action_type: actionType,
      error: err,
      trace_id: traceId,
    });

    return {
      executed: false,
      decision: 'DENY',
      decision_id: uuidv4(),
      trace_id: traceId,
      reason_codes: ['POLICY_MALFORMED'],
      reason_message: `Enforcement error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      error: err instanceof Error ? err : new Error(String(err)),
      policy_version: 'unknown',
      mode: 'OFF',
    };
  }
}

/**
 * Check if an action would be allowed (without executing)
 *
 * Useful for UI to show whether an action is available.
 */
export async function checkPolicy(
  actionType: AutopilotActionType,
  context: PolicyContext,
  evidenceOverride?: Partial<PolicyEvidence>
): Promise<PolicyEvaluationResult> {
  const traceId = context.trace_id || uuidv4();
  const policyEngine = getAutopilotPolicyEngine();

  const evidence = await collectEvidence(context, evidenceOverride);
  const systemState = await collectSystemState();

  return policyEngine.evaluate({
    action_type: actionType,
    context: { ...context, trace_id: traceId },
    evidence,
    system_state: systemState,
  });
}

/**
 * Get the current autopilot mode
 */
export async function getAutopilotMode(): Promise<AutopilotMode> {
  const policyEngine = getAutopilotPolicyEngine();
  return policyEngine.getCurrentMode();
}

/**
 * Set the autopilot mode (operator action)
 */
export async function setAutopilotMode(mode: AutopilotMode, operatorId: string): Promise<boolean> {
  const policyEngine = getAutopilotPolicyEngine();
  const success = await policyEngine.setMode(mode, operatorId);

  if (success) {
    logger.info('Autopilot mode changed', { mode, operatorId });
  }

  return success;
}

/**
 * Set global freeze (operator action)
 */
export async function setGlobalFreeze(freeze: boolean, operatorId: string): Promise<boolean> {
  const policyEngine = getAutopilotPolicyEngine();
  const success = await policyEngine.setGlobalFreeze(freeze, operatorId);

  if (success) {
    logger.info('Global freeze changed', { freeze, operatorId });
  }

  return success;
}

/**
 * Set agent freeze (operator action)
 */
export async function setAgentFreeze(
  agentId: string,
  freeze: boolean,
  operatorId: string
): Promise<boolean> {
  const policyEngine = getAutopilotPolicyEngine();
  const success = await policyEngine.setAgentFreeze(agentId, freeze, operatorId);

  if (success) {
    logger.info('Agent freeze changed', { agentId, freeze, operatorId });
  }

  return success;
}

/**
 * Set action freeze (operator action)
 */
export async function setActionFreeze(
  actionType: AutopilotActionType,
  freeze: boolean,
  operatorId: string
): Promise<boolean> {
  const policyEngine = getAutopilotPolicyEngine();
  const success = await policyEngine.setActionFreeze(actionType, freeze, operatorId);

  if (success) {
    logger.info('Action freeze changed', { actionType, freeze, operatorId });
  }

  return success;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get policy rule for an action type
 */
async function getRuleForAction(actionType: AutopilotActionType): Promise<{
  cooldown_seconds?: number;
  cooldown_scope?: string;
} | null> {
  try {
    const { data } = await supabaseClient
      .from('autopilot_policy_config')
      .select('rules')
      .eq('id', 'default')
      .single();

    if (data?.rules) {
      const rules = Array.isArray(data.rules) ? data.rules : [];
      return rules.find((r: { action_type: string }) => r.action_type === actionType) || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get entity ID for cooldown based on scope
 */
function getEntityId(context: PolicyContext, scope?: string): string {
  switch (scope) {
    case 'global':
      return 'global';
    case 'agent':
      return context.agent_id;
    case 'entity':
    default:
      return context.pick_id || context.capper_id || context.agent_id;
  }
}

// ============================================================================
// Decorator for Class Methods
// ============================================================================

/**
 * Decorator to enforce autopilot policy on a method
 *
 * @example
 * ```typescript
 * class MyAgent {
 *   @AutopilotEnforced('PUBLISH_PICK')
 *   async publishPick(pick: Pick): Promise<void> {
 *     await discordClient.post(pick);
 *   }
 * }
 * ```
 */
export function AutopilotEnforced(actionType: AutopilotActionType) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      // Extract context from first arg if it's an object with agent_id
      const firstArg = args[0];
      const context: PolicyContext =
        firstArg && typeof firstArg === 'object' && 'agent_id' in firstArg
          ? (firstArg as PolicyContext)
          : {
              agent_id: (this as { name?: string }).name || 'unknown',
              agent_name: (this as { name?: string }).name || 'unknown',
            };

      const result = await enforcePolicy(actionType, context, () =>
        originalMethod.apply(this, args)
      );

      if (!result.executed) {
        throw new Error(`Autopilot policy denied: ${result.reason_message}`);
      }

      return result.result;
    };

    return descriptor;
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  AutopilotActionType,
  PolicyContext,
  PolicyEvidence,
  AutopilotMode,
} from './AutopilotPolicyEngine';
