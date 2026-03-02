/**
 * promotionPolicy.ts — V2 Promotion Governance Layer
 *
 * Decides whether a V2 scoring result is eligible for promotion (posting).
 * This is a POLICY layer — it does NOT change scoring math, weights, or tiers.
 *
 * Band classification:
 *   HARD  — auto-promote eligible (high confidence, high EV, top tier, no data gaps)
 *   SOFT  — requires review/ops approval (moderate signals, optional auto via env flag)
 *   NONE  — not eligible for promotion
 *
 * Fail-closed: missing required fields → NONE band, promote=false.
 *
 * Created: 2026-01-29 (Tranche 7 — Promotion Governance)
 * Updated: 2026-01-29 (Tranche 10 — Controlled Promotion Enablement)
 */

import { UNCERTAINTY_THRESHOLDS } from '../../../lib/probability';

import { stableHash } from './canaryRouter';
import { getRegistryEntry } from './featureRegistry';

import type { ComputeScoreV2Result, FeatureAuditEntry } from './computeScoreV2';

// =============================================================================
// PROBABILITY GATES (INTELLIGENCE-PROBABILITY-FOUNDATION-001)
// =============================================================================

/**
 * Probability primitives required for promotion.
 * All fields are fail-closed: if any is missing or invalid, promotion is blocked.
 */
export interface ProbabilityPrimitives {
  /** Calibrated model probability (0-1) */
  pFinal: number | null;
  /** Model uncertainty (0-1, lower is better) */
  uncertaintyFinal: number | null;
  /** Devigged market consensus probability (0-1) */
  pMarketDevig: number | null;
  /** True edge = P_final - P_market_devig */
  edgeFinal: number | null;
  /** Predicted CLV (-1 to 1) */
  clvForecast: number | null;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type PromotionBand = 'HARD' | 'SOFT' | 'NONE';

export interface PromotionDecision {
  /** Whether the pick should be promoted/posted */
  promote: boolean;
  /** Band classification */
  band: PromotionBand;
  /** Machine-readable reason codes explaining the decision */
  reason_codes: string[];
  /** Human-readable notes for audit */
  notes: string[];
}

export interface PromotionPolicyConfig {
  /** Master enable for V2 promotion policy (PROMOTION_POLICY_V2) */
  policyEnabled: boolean;
  /** Emergency kill switch — forces promote=false for all (PROMOTION_KILL_SWITCH) */
  killSwitch: boolean;
  /** Allow SOFT band to auto-promote (PROMOTION_SOFT_ENABLE) */
  softEnable: boolean;
  /** Only allow HARD band to promote — blocks SOFT even if softEnable=true (PROMOTION_HARD_ONLY) */
  hardOnly: boolean;
  /** Minimum EV for HARD band as decimal (0.01 = 1%) (PROMOTION_HARD_MIN_EV) */
  hardMinEv: number;
  /** Minimum confidence for HARD band on 0-10 scale (PROMOTION_HARD_MIN_CONF) */
  hardMinConf: number;
  /** Percent of picks routed through promotion policy 0-100 (PROMOTION_CANARY_PERCENT) */
  canaryPercent: number;
  /** CSV of sports allowed for promotion canary (PROMOTION_CANARY_SPORTS) */
  canarySports: string[];
  // DATA-MOAT-ACTIVATION-002: Feature snapshot gate is now CONSTITUTIONAL
  // Always enforced in production. Cannot be disabled.
  // Legacy flag kept for backwards compatibility but ignored.
  /** @deprecated Always true. Feature snapshot required for promotion. */
  featureSnapshotGateEnabled: true;
}

// ─── Environment Parsing ────────────────────────────────────────────────────

/**
 * Parse promotion policy configuration from environment variables.
 * All flags default to OFF / no-promote behavior when unset.
 */
export function parsePromotionPolicyConfig(
  env: Record<string, string | undefined> = process.env
): PromotionPolicyConfig {
  const policyEnabled = env.PROMOTION_POLICY_V2 === 'true';
  const killSwitch = env.PROMOTION_KILL_SWITCH === 'true';
  const softEnable = env.PROMOTION_SOFT_ENABLE === 'true';
  const hardOnly = env.PROMOTION_HARD_ONLY === 'true';

  const hardMinEvRaw = parseFloat(env.PROMOTION_HARD_MIN_EV || '0.01');
  const hardMinEv = Number.isNaN(hardMinEvRaw) ? 0.01 : Math.max(0, hardMinEvRaw);

  const hardMinConfRaw = parseFloat(env.PROMOTION_HARD_MIN_CONF || '7');
  const hardMinConf = Number.isNaN(hardMinConfRaw) ? 7 : Math.max(0, Math.min(10, hardMinConfRaw));

  const canaryPercentRaw = parseInt(env.PROMOTION_CANARY_PERCENT || '0', 10);
  const canaryPercent = Number.isNaN(canaryPercentRaw)
    ? 0
    : Math.max(0, Math.min(100, canaryPercentRaw));

  const canarySportsRaw = env.PROMOTION_CANARY_SPORTS || '';
  const canarySports = canarySportsRaw
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(s => s.length > 0);

  // DATA-MOAT-ACTIVATION-002: Feature snapshot gate is CONSTITUTIONAL
  // Always enabled. Cannot be disabled in production.
  // Env var ignored - kept only for documentation that it was once optional.
  const featureSnapshotGateEnabled = true as const;

  return {
    policyEnabled,
    killSwitch,
    softEnable,
    hardOnly,
    hardMinEv,
    hardMinConf,
    canaryPercent,
    canarySports,
    featureSnapshotGateEnabled,
  };
}

// ─── Critical Data Gap Detection ────────────────────────────────────────────

/** Feature groups where fallback data disqualifies HARD/SOFT promotion */
const CRITICAL_GROUPS = ['market', 'core'] as const;

/**
 * Check if any critical-group features used fallback values.
 * Returns the list of features with data gaps.
 */
export function findCriticalDataGaps(featureAudit: Record<string, FeatureAuditEntry>): string[] {
  const gaps: string[] = [];
  for (const [name, entry] of Object.entries(featureAudit)) {
    if (!entry.fallbackUsed) continue;
    const reg = getRegistryEntry(name);
    if (!reg) continue;
    if ((CRITICAL_GROUPS as readonly string[]).includes(reg.group)) {
      gaps.push(name);
    }
  }
  return gaps;
}

// ─── Confidence Mapping ─────────────────────────────────────────────────────

/**
 * Map V2 composite score (0-100) to confidence on 0-10 scale.
 * score 70 = confidence 7.0, score 85 = confidence 8.5, etc.
 */
export function scoreToConfidence(score: number): number {
  return Math.round((score / 10) * 100) / 100;
}

/**
 * Convert V2 ev (percent, e.g. 5 = +5%) to decimal (e.g. 0.05).
 */
export function evToDecimal(evPercent: number): number {
  return evPercent / 100;
}

// ─── Probability Validation (INTELLIGENCE-PROBABILITY-FOUNDATION-001) ───────

/**
 * Validate probability primitives for promotion.
 * Returns validation errors if any required field is missing or invalid.
 *
 * CONSTITUTIONAL GATE: Probability primitives are REQUIRED for promotion.
 * This is fail-closed: missing primitives = promotion blocked.
 */
// eslint-disable-next-line complexity
export function validateProbabilityPrimitives(
  primitives: ProbabilityPrimitives | undefined,
  band: PromotionBand
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!primitives) {
    errors.push('probability_primitives_missing');
    return { valid: false, errors };
  }

  // Gate 8a: P_final must be present and in valid range
  if (primitives.pFinal === null || primitives.pFinal === undefined) {
    errors.push('p_final_missing');
  } else if (primitives.pFinal < 0 || primitives.pFinal > 1) {
    errors.push('p_final_invalid_range');
  }

  // Gate 8b: uncertainty_final must be present and within band threshold
  if (primitives.uncertaintyFinal === null || primitives.uncertaintyFinal === undefined) {
    errors.push('uncertainty_final_missing');
  } else if (primitives.uncertaintyFinal < 0 || primitives.uncertaintyFinal > 1) {
    errors.push('uncertainty_final_invalid_range');
  } else {
    // Band-specific uncertainty thresholds
    if (band === 'HARD' && primitives.uncertaintyFinal > UNCERTAINTY_THRESHOLDS.HARD_MAX) {
      errors.push(
        `uncertainty_exceeds_hard_threshold:${primitives.uncertaintyFinal.toFixed(4)}>${UNCERTAINTY_THRESHOLDS.HARD_MAX}`
      );
    } else if (band === 'SOFT' && primitives.uncertaintyFinal > UNCERTAINTY_THRESHOLDS.SOFT_MAX) {
      errors.push(
        `uncertainty_exceeds_soft_threshold:${primitives.uncertaintyFinal.toFixed(4)}>${UNCERTAINTY_THRESHOLDS.SOFT_MAX}`
      );
    }
  }

  // Gate 8c: p_market_devig must be present
  if (primitives.pMarketDevig === null || primitives.pMarketDevig === undefined) {
    errors.push('p_market_devig_missing');
  } else if (primitives.pMarketDevig < 0 || primitives.pMarketDevig > 1) {
    errors.push('p_market_devig_invalid_range');
  }

  // Gate 8d: edge_final should be consistent with p_final - p_market_devig
  if (
    primitives.edgeFinal !== null &&
    primitives.pFinal !== null &&
    primitives.pMarketDevig !== null
  ) {
    const expectedEdge = primitives.pFinal - primitives.pMarketDevig;
    const edgeDiff = Math.abs(primitives.edgeFinal - expectedEdge);
    if (edgeDiff > 0.001) {
      errors.push(
        `edge_inconsistent:expected=${expectedEdge.toFixed(4)},got=${primitives.edgeFinal.toFixed(4)}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Canary Gating ──────────────────────────────────────────────────────────

/**
 * Check if a pick passes the promotion canary gate.
 * Both sport gate AND percent gate must pass.
 */
export function passesPromotionCanary(
  sport: string,
  pickId: string,
  config: PromotionPolicyConfig
): boolean {
  const sportUpper = (sport || '').toUpperCase();
  const sportOk = config.canarySports.length === 0 || config.canarySports.includes(sportUpper);
  const bucket = stableHash(pickId);
  const percentOk = config.canaryPercent > 0 && bucket < config.canaryPercent;
  return sportOk && percentOk;
}

// ─── Band Classification ────────────────────────────────────────────────────

/**
 * Classify a V2 scoring result into HARD, SOFT, or NONE band.
 * This is pure classification — does not consider env flags or canary.
 */
// eslint-disable-next-line complexity
export function classifyBand(
  result: ComputeScoreV2Result,
  config: PromotionPolicyConfig
): { band: PromotionBand; reasons: string[] } {
  const { tier, ev } = result;
  const confidence = scoreToConfidence(result.score);
  const evDecimal = evToDecimal(ev);
  const gaps = findCriticalDataGaps(result.feature_audit);
  const reasons: string[] = [];

  // Critical data gaps block HARD and SOFT
  if (gaps.length > 0) {
    reasons.push(`critical_data_gaps:${gaps.join(',')}`);
    return { band: 'NONE', reasons };
  }

  // HARD band: tier S/A + EV >= threshold + confidence >= threshold
  const tierHardOk = tier === 'S' || tier === 'A';
  const evHardOk = evDecimal >= config.hardMinEv;
  const confHardOk = confidence >= config.hardMinConf;

  if (tierHardOk && evHardOk && confHardOk) {
    reasons.push(`hard:tier=${tier},ev=${evDecimal.toFixed(4)},conf=${confidence.toFixed(1)}`);
    return { band: 'HARD', reasons };
  }

  // SOFT band: tier A/B + EV in [0, threshold) OR confidence in [6, threshold)
  const tierSoftOk = tier === 'A' || tier === 'B';
  const evSoftOk = evDecimal >= 0 && evDecimal < config.hardMinEv;
  const confSoftRange = confidence >= 6 && confidence < config.hardMinConf;

  if (tierSoftOk && (evSoftOk || confSoftRange)) {
    reasons.push(`soft:tier=${tier},ev=${evDecimal.toFixed(4)},conf=${confidence.toFixed(1)}`);
    return { band: 'SOFT', reasons };
  }

  // NONE band: everything else
  reasons.push(`none:tier=${tier},ev=${evDecimal.toFixed(4)},conf=${confidence.toFixed(1)}`);
  return { band: 'NONE', reasons };
}

// ─── Main Policy Evaluation ─────────────────────────────────────────────────

/**
 * Evaluate promotion eligibility for a V2 scoring result.
 *
 * Fail-closed: if policy is disabled, kill switch is on, or required fields
 * are missing → promote=false, band=NONE.
 *
 * INTELLIGENCE-PROBABILITY-FOUNDATION-001:
 * Probability primitives (p_final, uncertainty_final, p_market_devig) are now
 * REQUIRED for promotion. This is a CONSTITUTIONAL gate that cannot be disabled.
 *
 * @param result      - V2 scoring result from computeScoreV2
 * @param sport       - Sport code (e.g. 'NBA')
 * @param pickId      - Unique pick identifier (for canary hashing)
 * @param config      - Policy configuration (defaults to env parsing)
 * @param probability - Probability primitives (REQUIRED for promotion)
 */
// eslint-disable-next-line max-lines-per-function, max-params, complexity
export function evaluatePromotion(
  result: ComputeScoreV2Result,
  sport: string,
  pickId: string,
  config?: PromotionPolicyConfig,
  probability?: ProbabilityPrimitives
): PromotionDecision {
  const cfg = config || parsePromotionPolicyConfig();
  const reasons: string[] = [];
  const notes: string[] = [];

  // Gate 1: Kill switch
  if (cfg.killSwitch) {
    return {
      promote: false,
      band: 'NONE',
      reason_codes: ['kill_switch'],
      notes: ['Promotion kill switch is active — all promotions blocked'],
    };
  }

  // Gate 2: Policy not enabled
  if (!cfg.policyEnabled) {
    return {
      promote: false,
      band: 'NONE',
      reason_codes: ['policy_disabled'],
      notes: ['PROMOTION_POLICY_V2 is not enabled — no V2 promotions'],
    };
  }

  // Gate 3: Validate result has required fields
  if (!result || typeof result.score !== 'number' || !result.tier || !result.feature_audit) {
    return {
      promote: false,
      band: 'NONE',
      reason_codes: ['missing_required_fields'],
      notes: ['V2 result missing score, tier, or feature_audit — fail-closed'],
    };
  }

  // Gate 4: Canary gate (sport + percent)
  if (!passesPromotionCanary(sport, pickId, cfg)) {
    const bucket = stableHash(pickId);
    reasons.push(`canary_denied:sport=${sport},bucket=${bucket},percent=${cfg.canaryPercent}`);
    return {
      promote: false,
      band: 'NONE',
      reason_codes: reasons,
      notes: ['Pick did not pass promotion canary gate'],
    };
  }

  // Gate 5: Classify band
  const { band, reasons: bandReasons } = classifyBand(result, cfg);
  reasons.push(...bandReasons);

  const confidence = scoreToConfidence(result.score);
  const evDecimal = evToDecimal(result.ev);
  notes.push(
    `score=${result.score},tier=${result.tier},ev=${evDecimal.toFixed(4)},conf=${confidence.toFixed(1)}`
  );

  // Gate 6: Hard-only enforcement (Tranche 10)
  if (cfg.hardOnly && band !== 'HARD') {
    reasons.push('hard_only_enforced');
    notes.push(`PROMOTION_HARD_ONLY=true — only HARD band can promote (got: ${band})`);
    return { promote: false, band, reason_codes: reasons, notes };
  }

  // Gate 7: Feature snapshot integrity (CONSTITUTIONAL - DATA-MOAT-ACTIVATION-002)
  // ALWAYS ENFORCED. This gate cannot be disabled in production.
  // Fail-closed: require feature_snapshot_id for data moat compliance
  // This is a non-negotiable invariant for the promotion system.
  if (!result.featureSnapshotId) {
    reasons.push('feature_snapshot_missing');
    notes.push(
      'CONSTITUTIONAL GATE: No feature_snapshot_id linked — fail-closed for data moat integrity'
    );
    return { promote: false, band, reason_codes: reasons, notes };
  }
  if (!result.featureVectorHash) {
    reasons.push('feature_hash_missing');
    notes.push(
      'CONSTITUTIONAL GATE: Feature vector hash not computed — fail-closed for reproducibility'
    );
    return { promote: false, band, reason_codes: reasons, notes };
  }
  notes.push(
    `data_moat:snapshot_id=${result.featureSnapshotId.slice(0, 8)}...,hash=${result.featureVectorHash.slice(0, 8)}...`
  );

  // Gate 8: Probability primitives (CONSTITUTIONAL - INTELLIGENCE-PROBABILITY-FOUNDATION-001)
  // ALWAYS ENFORCED. This gate cannot be disabled in production.
  // Fail-closed: require p_final, uncertainty_final, p_market_devig for Intelligence Superiority.
  const probValidation = validateProbabilityPrimitives(probability, band);
  if (!probValidation.valid) {
    reasons.push(...probValidation.errors);
    notes.push(
      'CONSTITUTIONAL GATE: Probability primitives missing or invalid — fail-closed for Intelligence Superiority'
    );
    return { promote: false, band, reason_codes: reasons, notes };
  }
  // Log probability metrics for audit trail
  if (probability) {
    notes.push(
      `probability:p_final=${probability.pFinal?.toFixed(4)},uncertainty=${probability.uncertaintyFinal?.toFixed(4)},edge=${probability.edgeFinal?.toFixed(4)}`
    );
  }

  // Decision based on band
  if (band === 'HARD') {
    return { promote: true, band, reason_codes: reasons, notes };
  }

  if (band === 'SOFT') {
    const promote = cfg.softEnable;
    if (!promote) {
      reasons.push('soft_auto_disabled');
      notes.push('SOFT band — requires PROMOTION_SOFT_ENABLE=true for auto-promote');
    }
    return { promote, band, reason_codes: reasons, notes };
  }

  // NONE band
  return { promote: false, band: 'NONE', reason_codes: reasons, notes };
}
