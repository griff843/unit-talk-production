/**
 * Promotion Guardrails — Stage 5
 *
 * Pure-function guardrails that prevent obviously bad promotions.
 * All thresholds are env-tunable with fail-closed (conservative) defaults.
 * No DB schema changes, no new endpoints, no side effects.
 *
 * Guardrails:
 *   G-01  Invalid/missing odds (reject)
 *   G-02  Invalid line value (reject)
 *   G-03  Stale price timestamp — if field exists (reject)
 *   G-04  Missing team/player identifiers for bet type (reject)
 *   G-05  Contradictory volatility/steam flags (reject)
 *   G-06  Minimum edge threshold — post-score (reject)
 */

export interface GuardrailResult {
  gate: string;
  passed: boolean;
  reason: string;
}

/** Env-tunable config with conservative fail-closed defaults */
function getConfig() {
  return {
    maxOdds: Number(process.env['PROMO_GUARD_MAX_ODDS']) || 5000,
    maxStaleMinutes: Number(process.env['PROMO_GUARD_MAX_STALE_MINUTES']) || 120,
    minEdgePct: Number(process.env['PROMO_GUARD_MIN_EDGE_PCT']) || 1,
  };
}

/**
 * Pre-score guardrails: run BEFORE applyScoringLogic.
 * Pure function — deterministic, no side effects.
 */
export function runPreScoreGuardrails(prop: any): GuardrailResult[] {
  const config = getConfig();
  const results: GuardrailResult[] = [];

  // G-01: Invalid/missing odds
  const odds = prop.odds;
  if (
    odds === undefined ||
    odds === null ||
    typeof odds !== 'number' ||
    isNaN(odds) ||
    odds === 0
  ) {
    results.push({
      gate: 'G-01:invalid_odds',
      passed: false,
      reason: `Odds invalid or missing: ${odds}`,
    });
  } else if (Math.abs(odds) > config.maxOdds) {
    results.push({
      gate: 'G-01:odds_range',
      passed: false,
      reason: `|Odds| ${Math.abs(odds)} exceeds max ${config.maxOdds}`,
    });
  }

  // G-02: Invalid line (if present and non-numeric)
  const line = prop.line;
  if (line !== undefined && line !== null && line !== '') {
    const numLine = typeof line === 'number' ? line : Number(line);
    if (isNaN(numLine)) {
      results.push({
        gate: 'G-02:invalid_line',
        passed: false,
        reason: `Line not a valid number: ${line}`,
      });
    }
  }

  // G-03: Stale price timestamp (if such field exists)
  const priceTs = prop.price_updated_at ?? prop.odds_updated_at;
  if (priceTs) {
    const priceDate = new Date(priceTs);
    if (!isNaN(priceDate.getTime())) {
      const ageMinutes = (Date.now() - priceDate.getTime()) / (1000 * 60);
      if (ageMinutes > config.maxStaleMinutes) {
        results.push({
          gate: 'G-03:stale_price',
          passed: false,
          reason: `Price ${Math.round(ageMinutes)}m old (max ${config.maxStaleMinutes}m)`,
        });
      }
    }
  }

  // G-04: Missing team for team-based bet types
  const betType = (prop.bet_type || '').toLowerCase();
  if (['spread', 'moneyline', 'total', 'team_total'].includes(betType)) {
    if (!prop.team && !prop.team_name) {
      results.push({
        gate: 'G-04:missing_team',
        passed: false,
        reason: `Bet type "${betType}" requires team identifier`,
      });
    }
  }

  // G-05: Contradictory volatility flags
  if (prop.is_volatile === true && prop.is_stable === true) {
    results.push({
      gate: 'G-05:contradictory_volatility',
      passed: false,
      reason: 'is_volatile and is_stable both true',
    });
  }

  // G-05b: Contradictory steam flags
  if (prop.steam_for === true && prop.steam_against === true) {
    results.push({
      gate: 'G-05:contradictory_steam',
      passed: false,
      reason: 'steam_for and steam_against both true',
    });
  }

  return results;
}

/**
 * Post-score guardrails: run AFTER applyScoringLogic.
 * Pure function — deterministic, no side effects.
 */
export function runPostScoreGuardrails(scored: any): GuardrailResult[] {
  const config = getConfig();
  const results: GuardrailResult[] = [];

  // G-06: Minimum edge threshold
  const evPct = scored.ev_percent ?? 0;
  if (evPct < config.minEdgePct) {
    results.push({
      gate: 'G-06:below_min_edge',
      passed: false,
      reason: `EV ${evPct}% below minimum ${config.minEdgePct}%`,
    });
  }

  return results;
}

/** Check if any guardrail result is a rejection (any failed rule) */
export function hasRejection(results: GuardrailResult[]): boolean {
  return results.some(r => !r.passed);
}
