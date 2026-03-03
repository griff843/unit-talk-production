/**
 * AutopilotPolicyEngine - Phase 4 Policy-Based Decision Control
 *
 * This is the central policy evaluator for all autopilot actions.
 * It determines WHAT the system is allowed to do, WHEN it is allowed,
 * and WHAT EVIDENCE is required — with fail-closed enforcement.
 *
 * Core Principles:
 * 1. DEFAULT = DENY - Missing policy, malformed, or ambiguous → blocked
 * 2. EVIDENCE-BASED - No action without sufficient evidence
 * 3. MODE-GATED - Explicit mode required (OFF/SHADOW/CANARY/AUTO)
 * 4. TRACEABLE - Every decision logged with full evidence
 * 5. OPERATOR OVERRIDE WINS - Freeze/override immediately blocks
 *
 * @module AutopilotPolicyEngine
 */

import { v4 as uuidv4 } from 'uuid';

import { supabase as supabaseClient } from '../services/supabaseClient';
import { createLogger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Autopilot action types that can be policy-controlled
 */
export type AutopilotActionType =
  | 'PUBLISH_PICK'
  | 'PUBLISH_ALERT'
  | 'ADJUST_SIZING'
  | 'GENERATE_HEDGE_ALERT'
  | 'DEMOTE_CAPPER'
  | 'PAUSE_AGENT'
  | 'AUTO_PROMOTE'
  | 'SEND_NOTIFICATION'
  | 'APPLY_COOLDOWN'
  | 'UPDATE_TIER';

/**
 * Autopilot operating modes
 * - OFF: No autopilot actions allowed
 * - SHADOW: Evaluate + log only, never execute
 * - CANARY: Restricted scope (percentage or specific agents)
 * - AUTO: Full allowed actions per policy
 */
export type AutopilotMode = 'OFF' | 'SHADOW' | 'CANARY' | 'AUTO';

/**
 * Policy evaluation result
 */
export type PolicyDecision = 'ALLOW' | 'DENY' | 'SHADOW_ONLY';

/**
 * Reason codes for policy decisions
 */
export type PolicyReasonCode =
  | 'POLICY_NOT_FOUND'
  | 'POLICY_MALFORMED'
  | 'MODE_OFF'
  | 'MODE_SHADOW'
  | 'CANARY_NOT_SELECTED'
  | 'OPERATOR_FREEZE_ACTIVE'
  | 'OPERATOR_OVERRIDE'
  | 'INSUFFICIENT_SAMPLE_SIZE'
  | 'CONFIDENCE_BELOW_THRESHOLD'
  | 'CLV_REQUIREMENT_NOT_MET'
  | 'PLATFORM_DEGRADED'
  | 'SLO_VIOLATION'
  | 'COOLDOWN_ACTIVE'
  | 'EXPOSURE_LIMIT_EXCEEDED'
  | 'ACTION_TYPE_DISABLED'
  | 'AGENT_FREEZE_ACTIVE'
  | 'EVIDENCE_MISSING'
  | 'ALLOWED_BY_POLICY';

/**
 * Evidence payload for policy evaluation
 */
export interface PolicyEvidence {
  // Sample size metrics
  sample_size?: number;
  min_sample_required?: number;

  // Confidence metrics
  confidence_score?: number;
  confidence_tier?: 'S' | 'A' | 'B' | 'C' | 'D';

  // CLV metrics
  clv_percentage?: number;
  clv_positive_rate?: number;

  // Performance metrics
  win_rate?: number;
  roi?: number;

  // Risk metrics
  exposure_current?: number;
  exposure_max?: number;
  correlation_count?: number;

  // System metrics
  pipeline_health?: 'PASS' | 'WARN' | 'FAIL';
  sla_pass_rate?: number;
  stuck_picks_count?: number;
}

/**
 * System state for policy evaluation
 */
export interface SystemState {
  // SLO status
  slo_status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

  // Platform health
  platform_health: 'PASS' | 'WARN' | 'FAIL';

  // Active freezes
  global_freeze: boolean;
  agent_freezes: string[]; // List of frozen agent IDs
  action_freezes: AutopilotActionType[]; // List of frozen action types

  // Cooldowns
  active_cooldowns: {
    entity_id: string;
    action_type: AutopilotActionType;
    expires_at: string;
  }[];

  // Current mode
  current_mode: AutopilotMode;
  canary_percentage: number;
}

/**
 * Context for policy evaluation
 */
export interface PolicyContext {
  agent_id: string;
  agent_name: string;
  pick_id?: string;
  trace_id?: string;
  sport?: string;
  tier?: string;
  capper_id?: string;
  correlation_id?: string;
}

/**
 * Policy evaluation request
 */
export interface PolicyEvaluationRequest {
  action_type: AutopilotActionType;
  context: PolicyContext;
  evidence: PolicyEvidence;
  system_state: SystemState;
}

/**
 * Policy evaluation result
 */
export interface PolicyEvaluationResult {
  decision_id: string;
  trace_id: string;
  decision: PolicyDecision;
  reason_codes: PolicyReasonCode[];
  reason_message: string;
  policy_version: string;
  mode: AutopilotMode;
  requires_escalation: boolean;
  escalation_reason?: string;
  evidence_snapshot: PolicyEvidence;
  inputs_snapshot: {
    action_type: AutopilotActionType;
    context: PolicyContext;
  };
  rollback_hint?: string;
  evaluated_at: string;
}

/**
 * Decision ledger entry
 */
export interface DecisionLedgerEntry {
  decision_id: string;
  trace_id: string;
  action_type: AutopilotActionType;
  policy_version: string;
  mode: AutopilotMode;
  inputs: {
    context: PolicyContext;
    evidence: PolicyEvidence;
    system_state: Partial<SystemState>;
  };
  evidence: PolicyEvidence;
  evaluation_result: PolicyDecision;
  reason_codes: PolicyReasonCode[];
  reason_message: string;
  executed: boolean;
  execution_result?: {
    success: boolean;
    error?: string;
    output?: Record<string, unknown>;
  };
  operator_override?: {
    override_id: string;
    override_type: 'FREEZE' | 'ALLOW' | 'DENY';
    override_by: string;
    override_at: string;
  };
  rollback_hint?: string;
  created_at: string;
}

/**
 * Policy rule definition
 */
export interface PolicyRule {
  id: string;
  action_type: AutopilotActionType;
  enabled: boolean;

  // Mode requirements
  allowed_modes: AutopilotMode[];

  // Evidence requirements
  min_sample_size?: number;
  min_confidence_score?: number;
  min_confidence_tier?: 'S' | 'A' | 'B' | 'C' | 'D';
  min_clv_positive_rate?: number;

  // Exposure limits
  max_exposure?: number;
  max_correlation_count?: number;

  // Platform requirements
  require_healthy_platform?: boolean;
  require_slo_compliance?: boolean;
  max_slo_degradation?: number;

  // Cooldown requirements
  cooldown_seconds?: number;
  cooldown_scope?: 'global' | 'agent' | 'entity';
}

/**
 * Complete policy configuration
 */
export interface PolicyConfig {
  version: string;
  updated_at: string;
  updated_by: string;

  // Global settings
  default_mode: AutopilotMode;
  canary_percentage: number;
  fail_closed: boolean;

  // Rules by action type
  rules: PolicyRule[];

  // Operator overrides
  operator_overrides: {
    global_freeze: boolean;
    agent_freezes: Record<string, boolean>;
    action_freezes: Record<AutopilotActionType, boolean>;
  };
}

// ============================================================================
// Default Policy Configuration
// ============================================================================

const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  version: '1.0.0',
  updated_at: new Date().toISOString(),
  updated_by: 'system',

  default_mode: 'SHADOW', // Safe default
  canary_percentage: 10,
  fail_closed: true,

  rules: [
    {
      id: 'publish-pick',
      action_type: 'PUBLISH_PICK',
      enabled: true,
      allowed_modes: ['CANARY', 'AUTO'],
      min_sample_size: 30,
      min_confidence_score: 0.65,
      min_confidence_tier: 'A',
      min_clv_positive_rate: 0.55,
      require_healthy_platform: true,
      require_slo_compliance: true,
      cooldown_seconds: 60,
      cooldown_scope: 'entity',
    },
    {
      id: 'publish-alert',
      action_type: 'PUBLISH_ALERT',
      enabled: true,
      allowed_modes: ['CANARY', 'AUTO'],
      min_sample_size: 10,
      min_confidence_score: 0.5,
      require_healthy_platform: true,
      cooldown_seconds: 300,
      cooldown_scope: 'entity',
    },
    {
      id: 'adjust-sizing',
      action_type: 'ADJUST_SIZING',
      enabled: true,
      allowed_modes: ['AUTO'], // Sizing only in AUTO mode
      min_sample_size: 50,
      min_confidence_score: 0.7,
      min_clv_positive_rate: 0.6,
      max_exposure: 0.2,
      require_healthy_platform: true,
      require_slo_compliance: true,
    },
    {
      id: 'generate-hedge-alert',
      action_type: 'GENERATE_HEDGE_ALERT',
      enabled: true,
      allowed_modes: ['CANARY', 'AUTO'],
      min_sample_size: 20,
      min_confidence_score: 0.6,
      require_healthy_platform: true,
      cooldown_seconds: 300,
      cooldown_scope: 'entity',
    },
    {
      id: 'demote-capper',
      action_type: 'DEMOTE_CAPPER',
      enabled: true,
      allowed_modes: ['AUTO'], // Demotion only in AUTO mode
      min_sample_size: 100,
      min_confidence_score: 0.8,
      require_healthy_platform: true,
      require_slo_compliance: true,
    },
    {
      id: 'pause-agent',
      action_type: 'PAUSE_AGENT',
      enabled: true,
      allowed_modes: ['CANARY', 'AUTO'],
      require_healthy_platform: false, // Can pause even when degraded
    },
    {
      id: 'auto-promote',
      action_type: 'AUTO_PROMOTE',
      enabled: true,
      allowed_modes: ['AUTO'],
      min_sample_size: 30,
      min_confidence_score: 0.75,
      min_confidence_tier: 'A',
      min_clv_positive_rate: 0.6,
      require_healthy_platform: true,
      require_slo_compliance: true,
    },
    {
      id: 'send-notification',
      action_type: 'SEND_NOTIFICATION',
      enabled: true,
      allowed_modes: ['CANARY', 'AUTO'],
      require_healthy_platform: true,
      cooldown_seconds: 60,
      cooldown_scope: 'entity',
    },
    {
      id: 'apply-cooldown',
      action_type: 'APPLY_COOLDOWN',
      enabled: true,
      allowed_modes: ['CANARY', 'AUTO'],
    },
    {
      id: 'update-tier',
      action_type: 'UPDATE_TIER',
      enabled: true,
      allowed_modes: ['AUTO'],
      min_sample_size: 50,
      min_confidence_score: 0.7,
      require_healthy_platform: true,
      require_slo_compliance: true,
    },
  ],

  operator_overrides: {
    global_freeze: false,
    agent_freezes: {},
    action_freezes: {} as Record<AutopilotActionType, boolean>,
  },
};

// ============================================================================
// Tier ranking for comparison
// ============================================================================

const TIER_RANK: Record<string, number> = {
  S: 5,
  A: 4,
  B: 3,
  C: 2,
  D: 1,
};

// ============================================================================
// AutopilotPolicyEngine Class
// ============================================================================

export class AutopilotPolicyEngine {
  private static instance: AutopilotPolicyEngine;
  private logger: ReturnType<typeof createLogger>;
  private policyConfig: PolicyConfig;
  private policyConfigCache: PolicyConfig | null = null;
  private policyConfigCacheExpiry: number = 0;
  private static readonly POLICY_CACHE_TTL_MS = 10000; // 10 seconds

  private constructor() {
    this.logger = createLogger('AutopilotPolicyEngine');
    this.policyConfig = DEFAULT_POLICY_CONFIG;
    this.logger.info('AutopilotPolicyEngine initialized', {
      policy_version: this.policyConfig.version,
      default_mode: this.policyConfig.default_mode,
      fail_closed: this.policyConfig.fail_closed,
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AutopilotPolicyEngine {
    if (!AutopilotPolicyEngine.instance) {
      AutopilotPolicyEngine.instance = new AutopilotPolicyEngine();
    }
    return AutopilotPolicyEngine.instance;
  }

  /**
   * Reset instance for testing
   */
  public static resetInstance(): void {
    AutopilotPolicyEngine.instance = null as unknown as AutopilotPolicyEngine;
  }

  /**
   * Load policy configuration from database or use defaults
   */
  private async loadPolicyConfig(): Promise<PolicyConfig> {
    const now = Date.now();

    // Return cached config if still valid
    if (this.policyConfigCache && now < this.policyConfigCacheExpiry) {
      return this.policyConfigCache;
    }

    try {
      const { data, error } = await supabaseClient
        .from('autopilot_policy_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        this.logger.warn('No policy config in database, using defaults', { error });
        return DEFAULT_POLICY_CONFIG;
      }

      const config: PolicyConfig = {
        version: data.version,
        updated_at: data.updated_at,
        updated_by: data.updated_by,
        default_mode: data.default_mode,
        canary_percentage: data.canary_percentage,
        fail_closed: data.fail_closed ?? true,
        rules: data.rules || DEFAULT_POLICY_CONFIG.rules,
        operator_overrides: data.operator_overrides || DEFAULT_POLICY_CONFIG.operator_overrides,
      };

      this.policyConfigCache = config;
      this.policyConfigCacheExpiry = now + AutopilotPolicyEngine.POLICY_CACHE_TTL_MS;

      return config;
    } catch (err) {
      this.logger.error('Failed to load policy config', { error: err });
      // FAIL-CLOSED: Return default (restrictive) config on error
      return DEFAULT_POLICY_CONFIG;
    }
  }

  /**
   * Get current system state for policy evaluation
   */
  private async getSystemState(): Promise<SystemState> {
    try {
      // Check trace spine health
      const { data: healthData } = await supabaseClient
        .from('v_trace_spine_health')
        .select('*')
        .single();

      // Check active freezes from system_config
      const { data: freezeData } = await supabaseClient
        .from('system_config')
        .select('*')
        .eq('key', 'autopilot_freezes')
        .single();

      // Check active cooldowns
      const { data: cooldownData } = await supabaseClient
        .from('autopilot_cooldowns')
        .select('*')
        .gt('expires_at', new Date().toISOString());

      const config = await this.loadPolicyConfig();

      // Determine SLO status from health data
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

      return {
        slo_status: sloStatus,
        platform_health: platformHealth,
        global_freeze: freezeData?.value?.global_freeze || config.operator_overrides.global_freeze,
        agent_freezes: Object.keys(
          freezeData?.value?.agent_freezes || config.operator_overrides.agent_freezes || {}
        ).filter(
          k => freezeData?.value?.agent_freezes?.[k] || config.operator_overrides.agent_freezes?.[k]
        ),
        action_freezes: Object.keys(
          freezeData?.value?.action_freezes || config.operator_overrides.action_freezes || {}
        ).filter(
          k =>
            freezeData?.value?.action_freezes?.[k as AutopilotActionType] ||
            config.operator_overrides.action_freezes?.[k as AutopilotActionType]
        ) as AutopilotActionType[],
        active_cooldowns: (cooldownData || []).map(
          (c: { entity_id: string; action_type: AutopilotActionType; expires_at: string }) => ({
            entity_id: c.entity_id,
            action_type: c.action_type,
            expires_at: c.expires_at,
          })
        ),
        current_mode: config.default_mode,
        canary_percentage: config.canary_percentage,
      };
    } catch (err) {
      this.logger.error('Failed to get system state, using restrictive defaults', { error: err });
      // FAIL-CLOSED: Return restrictive state on error
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

  /**
   * Evaluate policy for an autopilot action
   *
   * @param request - Policy evaluation request
   * @returns Policy evaluation result
   */
  public async evaluate(request: PolicyEvaluationRequest): Promise<PolicyEvaluationResult> {
    const decisionId = uuidv4();
    const traceId = request.context.trace_id || uuidv4();
    const evaluatedAt = new Date().toISOString();
    const reasonCodes: PolicyReasonCode[] = [];

    try {
      const config = await this.loadPolicyConfig();

      // Find applicable rule
      const rule = config.rules.find(r => r.action_type === request.action_type);

      // FAIL-CLOSED: Missing policy = DENY
      if (!rule) {
        reasonCodes.push('POLICY_NOT_FOUND');
        return this.createResult(
          decisionId,
          traceId,
          'DENY',
          reasonCodes,
          `No policy rule found for action type: ${request.action_type}`,
          config.version,
          request.system_state.current_mode,
          request,
          false
        );
      }

      // Check if action type is enabled
      if (!rule.enabled) {
        reasonCodes.push('ACTION_TYPE_DISABLED');
        return this.createResult(
          decisionId,
          traceId,
          'DENY',
          reasonCodes,
          `Action type ${request.action_type} is disabled in policy`,
          config.version,
          request.system_state.current_mode,
          request,
          false
        );
      }

      // Check global freeze (OPERATOR OVERRIDE WINS)
      if (request.system_state.global_freeze) {
        reasonCodes.push('OPERATOR_FREEZE_ACTIVE');
        return this.createResult(
          decisionId,
          traceId,
          'DENY',
          reasonCodes,
          'Global autopilot freeze is active',
          config.version,
          request.system_state.current_mode,
          request,
          false,
          'Wait for operator to lift global freeze'
        );
      }

      // Check agent-level freeze
      if (request.system_state.agent_freezes.includes(request.context.agent_id)) {
        reasonCodes.push('AGENT_FREEZE_ACTIVE');
        return this.createResult(
          decisionId,
          traceId,
          'DENY',
          reasonCodes,
          `Agent ${request.context.agent_name} is frozen`,
          config.version,
          request.system_state.current_mode,
          request,
          false,
          `Lift freeze for agent: ${request.context.agent_id}`
        );
      }

      // Check action-level freeze
      if (request.system_state.action_freezes.includes(request.action_type)) {
        reasonCodes.push('OPERATOR_OVERRIDE');
        return this.createResult(
          decisionId,
          traceId,
          'DENY',
          reasonCodes,
          `Action type ${request.action_type} is frozen`,
          config.version,
          request.system_state.current_mode,
          request,
          false,
          `Lift freeze for action: ${request.action_type}`
        );
      }

      // Check mode
      const currentMode = request.system_state.current_mode;

      if (currentMode === 'OFF') {
        reasonCodes.push('MODE_OFF');
        return this.createResult(
          decisionId,
          traceId,
          'DENY',
          reasonCodes,
          'Autopilot mode is OFF - no actions allowed',
          config.version,
          currentMode,
          request,
          false
        );
      }

      if (currentMode === 'SHADOW') {
        reasonCodes.push('MODE_SHADOW');
        return this.createResult(
          decisionId,
          traceId,
          'SHADOW_ONLY',
          reasonCodes,
          'Autopilot mode is SHADOW - evaluate + log only',
          config.version,
          currentMode,
          request,
          false
        );
      }

      // Check if current mode is allowed for this action
      if (!rule.allowed_modes.includes(currentMode)) {
        reasonCodes.push('CANARY_NOT_SELECTED');
        return this.createResult(
          decisionId,
          traceId,
          'DENY',
          reasonCodes,
          `Action ${request.action_type} not allowed in ${currentMode} mode (requires: ${rule.allowed_modes.join(', ')})`,
          config.version,
          currentMode,
          request,
          false
        );
      }

      // CANARY mode: percentage-based routing
      if (currentMode === 'CANARY') {
        const bucket = this.calculateCanaryBucket(request.context);
        if (bucket > request.system_state.canary_percentage) {
          reasonCodes.push('CANARY_NOT_SELECTED');
          return this.createResult(
            decisionId,
            traceId,
            'SHADOW_ONLY',
            reasonCodes,
            `Canary bucket ${bucket} exceeds percentage ${request.system_state.canary_percentage}`,
            config.version,
            currentMode,
            request,
            false
          );
        }
      }

      // Check platform health requirements
      if (rule.require_healthy_platform) {
        if (request.system_state.platform_health === 'FAIL') {
          reasonCodes.push('PLATFORM_DEGRADED');
          return this.createResult(
            decisionId,
            traceId,
            'DENY',
            reasonCodes,
            'Platform health is FAIL - action blocked',
            config.version,
            currentMode,
            request,
            false,
            'Wait for platform health to recover'
          );
        }
      }

      // Check SLO compliance requirements
      if (rule.require_slo_compliance) {
        if (request.system_state.slo_status === 'CRITICAL') {
          reasonCodes.push('SLO_VIOLATION');
          return this.createResult(
            decisionId,
            traceId,
            'DENY',
            reasonCodes,
            'SLO status is CRITICAL - action blocked',
            config.version,
            currentMode,
            request,
            false,
            'Wait for SLO status to recover'
          );
        }
      }

      // Check cooldowns
      if (rule.cooldown_seconds) {
        const entityId = this.getCooldownEntityId(request, rule);
        const activeCooldown = request.system_state.active_cooldowns.find(
          c => c.entity_id === entityId && c.action_type === request.action_type
        );
        if (activeCooldown) {
          reasonCodes.push('COOLDOWN_ACTIVE');
          return this.createResult(
            decisionId,
            traceId,
            'DENY',
            reasonCodes,
            `Cooldown active for ${entityId} until ${activeCooldown.expires_at}`,
            config.version,
            currentMode,
            request,
            false,
            `Wait until: ${activeCooldown.expires_at}`
          );
        }
      }

      // EVIDENCE-BASED CHECKS

      // Check sample size
      if (rule.min_sample_size !== undefined) {
        if (!request.evidence.sample_size || request.evidence.sample_size < rule.min_sample_size) {
          reasonCodes.push('INSUFFICIENT_SAMPLE_SIZE');
          return this.createResult(
            decisionId,
            traceId,
            'DENY',
            reasonCodes,
            `Sample size ${request.evidence.sample_size || 0} below minimum ${rule.min_sample_size}`,
            config.version,
            currentMode,
            request,
            true,
            'Escalate to operator for manual review'
          );
        }
      }

      // Check confidence score
      if (rule.min_confidence_score !== undefined) {
        if (
          !request.evidence.confidence_score ||
          request.evidence.confidence_score < rule.min_confidence_score
        ) {
          reasonCodes.push('CONFIDENCE_BELOW_THRESHOLD');
          return this.createResult(
            decisionId,
            traceId,
            'DENY',
            reasonCodes,
            `Confidence score ${request.evidence.confidence_score || 0} below minimum ${rule.min_confidence_score}`,
            config.version,
            currentMode,
            request,
            true,
            'Escalate to operator for manual review'
          );
        }
      }

      // Check confidence tier
      if (rule.min_confidence_tier !== undefined && request.evidence.confidence_tier) {
        const requiredRank = TIER_RANK[rule.min_confidence_tier] || 0;
        const actualRank = TIER_RANK[request.evidence.confidence_tier] || 0;
        if (actualRank < requiredRank) {
          reasonCodes.push('CONFIDENCE_BELOW_THRESHOLD');
          return this.createResult(
            decisionId,
            traceId,
            'DENY',
            reasonCodes,
            `Confidence tier ${request.evidence.confidence_tier} below minimum ${rule.min_confidence_tier}`,
            config.version,
            currentMode,
            request,
            true,
            'Escalate to operator for manual review'
          );
        }
      }

      // Check CLV positive rate
      if (rule.min_clv_positive_rate !== undefined) {
        if (
          !request.evidence.clv_positive_rate ||
          request.evidence.clv_positive_rate < rule.min_clv_positive_rate
        ) {
          reasonCodes.push('CLV_REQUIREMENT_NOT_MET');
          return this.createResult(
            decisionId,
            traceId,
            'DENY',
            reasonCodes,
            `CLV positive rate ${request.evidence.clv_positive_rate || 0} below minimum ${rule.min_clv_positive_rate}`,
            config.version,
            currentMode,
            request,
            true,
            'Escalate to operator for manual review'
          );
        }
      }

      // Check exposure limits
      if (rule.max_exposure !== undefined) {
        if (
          request.evidence.exposure_current &&
          request.evidence.exposure_current > rule.max_exposure
        ) {
          reasonCodes.push('EXPOSURE_LIMIT_EXCEEDED');
          return this.createResult(
            decisionId,
            traceId,
            'DENY',
            reasonCodes,
            `Current exposure ${request.evidence.exposure_current} exceeds maximum ${rule.max_exposure}`,
            config.version,
            currentMode,
            request,
            false,
            'Reduce exposure before proceeding'
          );
        }
      }

      // All checks passed - ALLOW
      reasonCodes.push('ALLOWED_BY_POLICY');
      return this.createResult(
        decisionId,
        traceId,
        'ALLOW',
        reasonCodes,
        'All policy requirements satisfied',
        config.version,
        currentMode,
        request,
        false
      );
    } catch (err) {
      this.logger.error('Policy evaluation error', { error: err, request });

      // FAIL-CLOSED: On any error, DENY
      reasonCodes.push('POLICY_MALFORMED');
      return this.createResult(
        decisionId,
        traceId,
        'DENY',
        reasonCodes,
        `Policy evaluation error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        this.policyConfig.version,
        'OFF',
        request,
        true,
        'Escalate to operator - policy evaluation failed'
      );
    }
  }

  /**
   * Create policy evaluation result
   */
  private createResult(
    decisionId: string,
    traceId: string,
    decision: PolicyDecision,
    reasonCodes: PolicyReasonCode[],
    reasonMessage: string,
    policyVersion: string,
    mode: AutopilotMode,
    request: PolicyEvaluationRequest,
    requiresEscalation: boolean,
    rollbackHint?: string
  ): PolicyEvaluationResult {
    return {
      decision_id: decisionId,
      trace_id: traceId,
      decision,
      reason_codes: reasonCodes,
      reason_message: reasonMessage,
      policy_version: policyVersion,
      mode,
      requires_escalation: requiresEscalation,
      escalation_reason: requiresEscalation ? reasonMessage : undefined,
      evidence_snapshot: request.evidence,
      inputs_snapshot: {
        action_type: request.action_type,
        context: request.context,
      },
      rollback_hint: rollbackHint,
      evaluated_at: new Date().toISOString(),
    };
  }

  /**
   * Calculate deterministic canary bucket (0-100)
   */
  private calculateCanaryBucket(context: PolicyContext): number {
    const hashInput = `${context.agent_id}:${context.pick_id || 'global'}:${context.trace_id || 'default'}`;
    const hash = require('crypto').createHash('sha256').update(hashInput).digest('hex');
    return parseInt(hash.substring(0, 8), 16) % 100;
  }

  /**
   * Get cooldown entity ID based on scope
   */
  private getCooldownEntityId(request: PolicyEvaluationRequest, rule: PolicyRule): string {
    switch (rule.cooldown_scope) {
      case 'global':
        return 'global';
      case 'agent':
        return request.context.agent_id;
      case 'entity':
      default:
        return request.context.pick_id || request.context.capper_id || request.context.agent_id;
    }
  }

  /**
   * Write decision to ledger (append-only)
   */
  public async writeToLedger(
    result: PolicyEvaluationResult,
    executed: boolean,
    executionResult?: {
      success: boolean;
      error?: string;
      output?: Record<string, unknown>;
    }
  ): Promise<void> {
    try {
      const entry: Partial<DecisionLedgerEntry> = {
        decision_id: result.decision_id,
        trace_id: result.trace_id,
        action_type: result.inputs_snapshot.action_type,
        policy_version: result.policy_version,
        mode: result.mode,
        inputs: {
          context: result.inputs_snapshot.context,
          evidence: result.evidence_snapshot,
          system_state: {}, // Minimal to avoid bloat
        },
        evidence: result.evidence_snapshot,
        evaluation_result: result.decision,
        reason_codes: result.reason_codes,
        reason_message: result.reason_message,
        executed,
        execution_result: executionResult,
        rollback_hint: result.rollback_hint,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabaseClient.from('autopilot_decisions').insert(entry);

      if (error) {
        this.logger.error('Failed to write to decision ledger', { error, entry });
      } else {
        this.logger.debug('Decision written to ledger', { decision_id: result.decision_id });
      }
    } catch (err) {
      this.logger.error('Error writing to decision ledger', { error: err });
    }
  }

  /**
   * Apply cooldown after action execution
   */
  public async applyCooldown(
    actionType: AutopilotActionType,
    entityId: string,
    durationSeconds: number
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();

      await supabaseClient.from('autopilot_cooldowns').upsert(
        {
          entity_id: entityId,
          action_type: actionType,
          expires_at: expiresAt,
        },
        {
          onConflict: 'entity_id,action_type',
        }
      );

      this.logger.debug('Cooldown applied', { actionType, entityId, expiresAt });
    } catch (err) {
      this.logger.error('Failed to apply cooldown', { error: err });
    }
  }

  /**
   * Get current policy version
   */
  public async getPolicyVersion(): Promise<string> {
    const config = await this.loadPolicyConfig();
    return config.version;
  }

  /**
   * Get current mode
   */
  public async getCurrentMode(): Promise<AutopilotMode> {
    const state = await this.getSystemState();
    return state.current_mode;
  }

  /**
   * Update policy configuration
   */
  public async updatePolicy(config: Partial<PolicyConfig>, updatedBy: string): Promise<boolean> {
    try {
      const currentConfig = await this.loadPolicyConfig();
      const newConfig: PolicyConfig = {
        ...currentConfig,
        ...config,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      };

      const { error } = await supabaseClient.from('autopilot_policy_config').upsert({
        id: 'default',
        ...newConfig,
      });

      if (error) {
        this.logger.error('Failed to update policy', { error });
        return false;
      }

      // Invalidate cache
      this.policyConfigCache = null;
      this.policyConfigCacheExpiry = 0;

      this.logger.info('Policy updated', { version: newConfig.version, updatedBy });
      return true;
    } catch (err) {
      this.logger.error('Error updating policy', { error: err });
      return false;
    }
  }

  /**
   * Set global freeze (operator override)
   */
  public async setGlobalFreeze(freeze: boolean, operatorId: string): Promise<boolean> {
    return this.updatePolicy(
      {
        operator_overrides: {
          ...this.policyConfig.operator_overrides,
          global_freeze: freeze,
        },
      },
      operatorId
    );
  }

  /**
   * Set agent freeze (operator override)
   */
  public async setAgentFreeze(
    agentId: string,
    freeze: boolean,
    operatorId: string
  ): Promise<boolean> {
    const currentConfig = await this.loadPolicyConfig();
    return this.updatePolicy(
      {
        operator_overrides: {
          ...currentConfig.operator_overrides,
          agent_freezes: {
            ...currentConfig.operator_overrides.agent_freezes,
            [agentId]: freeze,
          },
        },
      },
      operatorId
    );
  }

  /**
   * Set action freeze (operator override)
   */
  public async setActionFreeze(
    actionType: AutopilotActionType,
    freeze: boolean,
    operatorId: string
  ): Promise<boolean> {
    const currentConfig = await this.loadPolicyConfig();
    return this.updatePolicy(
      {
        operator_overrides: {
          ...currentConfig.operator_overrides,
          action_freezes: {
            ...currentConfig.operator_overrides.action_freezes,
            [actionType]: freeze,
          },
        },
      },
      operatorId
    );
  }

  /**
   * Set autopilot mode
   */
  public async setMode(mode: AutopilotMode, operatorId: string): Promise<boolean> {
    return this.updatePolicy({ default_mode: mode }, operatorId);
  }
}

// Export singleton getter
export const getAutopilotPolicyEngine = (): AutopilotPolicyEngine => {
  return AutopilotPolicyEngine.getInstance();
};
