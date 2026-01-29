/**
 * canaryRouter.ts — Canary Routing for ScoringEngine V2
 *
 * Decides whether a scoring request should use V1, V2, or shadow mode.
 * Pure function: deterministic, no side effects, no DB calls.
 *
 * Priority order:
 * 1. Kill switch ON  → always V1
 * 2. V2 master OFF   → always V1
 * 3. Shadow ON        → shadow (compute both, return V1)
 * 4. Sport-gated      → V2 if sport in allowed list
 * 5. Percent-gated    → V2 if stable hash(pick_id) falls within percent
 * 6. Otherwise        → V1
 *
 * Created: 2026-01-29 (Tranche 6 — Canary Routing)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type CanaryMode = 'v1' | 'v2' | 'shadow';

export interface CanaryDecision {
  mode: CanaryMode;
  reason: string;
}

export interface CanaryConfig {
  /** Master V2 enable (SCORING_ENGINE_V2) */
  v2Enabled: boolean;
  /** Force V1 regardless of all other flags (SCORING_KILL_SWITCH) */
  killSwitch: boolean;
  /** Compute both, return V1, log drift (SCORING_SHADOW) */
  shadowEnabled: boolean;
  /** CSV of sports allowed for V2 canary (SCORING_CANARY_SPORTS) */
  canarySports: string[];
  /** Percent of traffic for V2 canary 0-100 (SCORING_CANARY_PERCENT) */
  canaryPercent: number;
}

// ─── Environment Parsing ────────────────────────────────────────────────────

/**
 * Parse canary configuration from environment variables.
 * All flags default to OFF / V1 behavior when unset.
 */
export function parseCanaryConfig(
  env: Record<string, string | undefined> = process.env
): CanaryConfig {
  const v2Enabled = env.SCORING_ENGINE_V2 === 'true';
  const killSwitch = env.SCORING_KILL_SWITCH === 'true';
  const shadowEnabled = env.SCORING_SHADOW === 'true';

  const canarySportsRaw = env.SCORING_CANARY_SPORTS || '';
  const canarySports = canarySportsRaw
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(s => s.length > 0);

  const canaryPercentRaw = parseInt(env.SCORING_CANARY_PERCENT || '0', 10);
  const canaryPercent = Number.isNaN(canaryPercentRaw)
    ? 0
    : Math.max(0, Math.min(100, canaryPercentRaw));

  return { v2Enabled, killSwitch, shadowEnabled, canarySports, canaryPercent };
}

// ─── Stable Hash ────────────────────────────────────────────────────────────

/**
 * Deterministic hash of a string to a number in [0, 99].
 * Uses djb2 algorithm — fast, deterministic, no crypto dependency.
 * Same pick_id always produces the same bucket.
 */
export function stableHash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0; // hash * 33 + c
  }
  // Map to 0-99
  return ((hash % 100) + 100) % 100;
}

// ─── Router ─────────────────────────────────────────────────────────────────

/**
 * Decide whether to use V1, V2, or shadow mode for a scoring request.
 *
 * @param sport  - The sport (e.g. 'NBA', 'MLB')
 * @param pickId - Unique identifier for the pick (used for percent hashing)
 * @param config - Canary configuration (defaults to env parsing)
 */
export function canaryDecide(sport: string, pickId: string, config?: CanaryConfig): CanaryDecision {
  const cfg = config || parseCanaryConfig();

  // 1. Kill switch: force V1 regardless
  if (cfg.killSwitch) {
    return { mode: 'v1', reason: 'kill_switch' };
  }

  // 2. V2 master flag off: always V1
  if (!cfg.v2Enabled) {
    return { mode: 'v1', reason: 'v2_disabled' };
  }

  // 3. Shadow mode: compute both, return V1
  if (cfg.shadowEnabled) {
    return { mode: 'shadow', reason: 'shadow_mode' };
  }

  // 4. Sport-gated canary
  const sportUpper = (sport || '').toUpperCase();
  const sportAllowed = cfg.canarySports.length === 0 || cfg.canarySports.includes(sportUpper);

  // 5. Percent-gated canary
  const bucket = stableHash(pickId);
  const percentAllowed = cfg.canaryPercent > 0 && bucket < cfg.canaryPercent;

  // Both gates must pass for V2
  if (sportAllowed && percentAllowed) {
    return {
      mode: 'v2',
      reason: `canary_sport=${sportUpper}_bucket=${bucket}_percent=${cfg.canaryPercent}`,
    };
  }

  // 6. V1 fallback — sport or percent gate did not pass
  return {
    mode: 'v1',
    reason: `canary_denied_sport=${sportUpper}_bucket=${bucket}_percent=${cfg.canaryPercent}`,
  };
}
