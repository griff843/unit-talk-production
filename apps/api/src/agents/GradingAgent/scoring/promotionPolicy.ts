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
 */

import type { ComputeScoreV2Result, FeatureAuditEntry } from './computeScoreV2';
import { getRegistryEntry } from './featureRegistry';
import { stableHash } from './canaryRouter';

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
  /** Minimum EV for HARD band as decimal (0.01 = 1%) (PROMOTION_HARD_MIN_EV) */
  hardMinEv: number;
  /** Minimum confidence for HARD band on 0-10 scale (PROMOTION_HARD_MIN_CONF) */
  hardMinConf: number;
  /** Percent of picks routed through promotion policy 0-100 (PROMOTION_CANARY_PERCENT) */
  canaryPercent: number;
  /** CSV of sports allowed for promotion canary (PROMOTION_CANARY_SPORTS) */
  canarySports: string[];
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

  const hardMinEvRaw = parseFloat(env.PROMOTION_HARD_MIN_EV || '0.01');
  const hardMinEv = Number.isNaN(hardMinEvRaw) ? 0.01 : Math.max(0, hardMinEvRaw);

  const hardMinConfRaw = parseFloat(env.PROMOTION_HARD_MIN_CONF || '7');
  const hardMinConf = Number.isNaN(hardMinConfRaw) ? 7 : Math.max(0, Math.min(10, hardMinConfRaw));

  const canaryPercentRaw = parseInt(env.PROMOTION_CANARY_PERCENT || '0', 10);
  const canaryPercent = Number.isNaN(canaryPercentRaw) ? 0 : Math.max(0, Math.min(100, canaryPercentRaw));

  const canarySportsRaw = env.PROMOTION_CANARY_SPORTS || '';
  const canarySports = canarySportsRaw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);

  return {
    policyEnabled,
    killSwitch,
    softEnable,
    hardMinEv,
    hardMinConf,
    canaryPercent,
    canarySports,
  };
}

// ─── Critical Data Gap Detection ────────────────────────────────────────────

/** Feature groups where fallback data disqualifies HARD/SOFT promotion */
const CRITICAL_GROUPS = ['market', 'core'] as const;

/**
 * Check if any critical-group features used fallback values.
 * Returns the list of features with data gaps.
 */
export function findCriticalDataGaps(
  featureAudit: Record<string, FeatureAuditEntry>
): string[] {
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
 * @param result  - V2 scoring result from computeScoreV2
 * @param sport   - Sport code (e.g. 'NBA')
 * @param pickId  - Unique pick identifier (for canary hashing)
 * @param config  - Policy configuration (defaults to env parsing)
 */
export function evaluatePromotion(
  result: ComputeScoreV2Result,
  sport: string,
  pickId: string,
  config?: PromotionPolicyConfig
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
