/**
 * Capper Command Center - Ranking Engine (Server-Side Only)
 * Sprint: CAPPER-COMMAND-CENTER-MVP-001
 *
 * SPEC CONFORMANCE:
 * - CAPPER_COMMAND_CENTER_SPEC_v1.0.md Section 7: Ranking (Internal Only)
 * - Deterministic, versioned ranking
 * - Score is internal only, never exposed to UI
 */

// ============================================================================
// RANKING CONFIGURATION (v1)
// ============================================================================

export const RANKING_VERSION = 'ccc_rank_v1.0.0';

/**
 * Ranking weights (internal only, do not expose)
 * Per spec: these are moat-protected constants
 */
const WEIGHTS = {
  EDGE: 100, // Positive weight for edge_final
  CLV: 50, // Positive weight for clv_forecast
  BOOKS: 20, // Positive weight for books strength
  UNCERTAINTY: -80, // Penalty for uncertainty
} as const;

/**
 * Books strength scoring
 */
function computeBooksStrength(booksUsed: number): number {
  if (booksUsed >= 4) return 1.0;
  if (booksUsed === 3) return 0.8;
  if (booksUsed === 2) return 0.5;
  return 0; // Should not reach here if gates are enforced
}

// ============================================================================
// AUTO-DISQUALIFICATION GATES (v1)
// ============================================================================

export interface GateConfig {
  EDGE_MIN: number;
  U_MAX: number;
  CLV_GATE_ENABLED: boolean;
  MIN_BOOKS: number;
}

export const DEFAULT_GATE_CONFIG: GateConfig = {
  EDGE_MIN: 0.01, // 1% minimum edge
  U_MAX: 0.2, // 20% maximum uncertainty
  CLV_GATE_ENABLED: false, // Per spec: optional, default OFF
  MIN_BOOKS: 2,
};

export type EliminationReason =
  | 'NO_EVENT_LINK'
  | 'MISSING_PRIMITIVE'
  | 'INSUFFICIENT_BOOKS'
  | 'HIGH_UNCERTAINTY'
  | 'LOW_EDGE'
  | 'NEGATIVE_CLV';

export interface EliminationResult {
  eliminated: boolean;
  reason?: EliminationReason;
  detail?: string;
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Raw scored leg from view_scored_legs_latest
 */
export interface ScoredLegInput {
  scored_leg_id: string;
  leg_id: string;
  ticket_id: string;

  // Identity fields
  bet_slip_id?: string;
  selection?: string;
  provider_line?: number;
  provider_odds?: number;
  provider?: string;
  leg_status?: string;
  ticket_status?: string;

  // Event linkage (EVENT-LINKED-COVERAGE-RAISE-006)
  event_id?: string | null;

  // Scoring fields
  model_name?: string;
  model_version?: string;
  edge_score?: number;
  confidence_score?: number;
  tier?: string;
  promotion_band?: string;
  kelly_fraction?: number;
  expected_value?: number;

  // Probability primitives (required for CCC)
  p_final?: number | null;
  uncertainty_final?: number | null;
  edge_final?: number | null;
  clv_forecast?: number | null;
  p_market_devig?: number | null;
  devig_method?: string | null;
  consensus_weights_json?: Record<string, unknown> | null;
  probability_model_version?: string | null;
}

/**
 * Ranked play for CCC display
 */
export interface RankedPlay {
  // Identity
  scoredLegId: string;
  legId: string;
  ticketId: string;
  betSlipId?: string;

  // Display fields
  selection: string;
  providerLine?: number;
  providerOdds?: number;
  provider?: string;
  tier?: string;
  promotionBand?: string;

  // Probability display (per spec Section 5)
  edgeFinalPct: number; // edge_final as percentage
  pFinal: number;
  pMarketDevig: number;
  delta: number; // p_final - p_market_devig
  uncertaintyBadge: 'Low' | 'Med' | 'High';
  clvBadge: '+' | '0' | '-';
  booksUsed: number;
  consensusBadge: 'Weak' | 'Normal' | 'Strong';
  executionSuggestion: 'FIRE_NOW' | 'WAIT' | 'AVOID';

  // Ranking (position only, not score)
  rank: number;
}

/**
 * CCC API response
 */
export interface CCCResponse {
  plays: RankedPlay[];
  eliminationBanner: {
    totalRemoved: number;
    removedByReason: Record<EliminationReason, number>;
  };
  configUsed: GateConfig & { RANKING_VERSION: string };
  timestamp: string;
}

// ============================================================================
// GATE FUNCTIONS
// ============================================================================

/**
 * Check if a leg passes all auto-disqualification gates
 */
export function checkGates(leg: ScoredLegInput, config: GateConfig): EliminationResult {
  // Gate 0: No event link — manual leg cannot have consensus-scored primitives (fail-closed)
  // EVENT-LINKED-COVERAGE-RAISE-006: Classify manual legs explicitly before generic MISSING_PRIMITIVE
  if (leg.event_id == null) {
    return {
      eliminated: true,
      reason: 'NO_EVENT_LINK',
      detail: 'Manual leg — no event_id, cannot compute market consensus',
    };
  }

  // Gate 1: Missing primitives (fail-closed)
  if (
    leg.p_final == null ||
    leg.p_market_devig == null ||
    leg.uncertainty_final == null ||
    leg.edge_final == null
  ) {
    const missing: string[] = [];
    if (leg.p_final == null) missing.push('p_final');
    if (leg.p_market_devig == null) missing.push('p_market_devig');
    if (leg.uncertainty_final == null) missing.push('uncertainty_final');
    if (leg.edge_final == null) missing.push('edge_final');

    return {
      eliminated: true,
      reason: 'MISSING_PRIMITIVE',
      detail: `Missing: ${missing.join(', ')}`,
    };
  }

  // Gate 2: Insufficient books
  const booksUsed = getBooksUsed(leg);
  if (booksUsed < config.MIN_BOOKS) {
    return {
      eliminated: true,
      reason: 'INSUFFICIENT_BOOKS',
      detail: `books_used=${booksUsed}, min=${config.MIN_BOOKS}`,
    };
  }

  // Gate 3: High uncertainty
  if (leg.uncertainty_final > config.U_MAX) {
    return {
      eliminated: true,
      reason: 'HIGH_UNCERTAINTY',
      detail: `uncertainty=${(leg.uncertainty_final * 100).toFixed(1)}%, max=${(config.U_MAX * 100).toFixed(0)}%`,
    };
  }

  // Gate 4: Low edge
  if (leg.edge_final < config.EDGE_MIN) {
    return {
      eliminated: true,
      reason: 'LOW_EDGE',
      detail: `edge=${(leg.edge_final * 100).toFixed(2)}%, min=${(config.EDGE_MIN * 100).toFixed(0)}%`,
    };
  }

  // Gate 5: Negative CLV (optional)
  if (config.CLV_GATE_ENABLED && (leg.clv_forecast ?? 0) < 0) {
    return {
      eliminated: true,
      reason: 'NEGATIVE_CLV',
      detail: `clv_forecast=${(leg.clv_forecast ?? 0).toFixed(4)}`,
    };
  }

  return { eliminated: false };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getBooksUsed(leg: ScoredLegInput): number {
  if (leg.consensus_weights_json && typeof leg.consensus_weights_json === 'object') {
    return Object.keys(leg.consensus_weights_json).length;
  }
  return 0;
}

function getUncertaintyBadge(uncertainty: number): 'Low' | 'Med' | 'High' {
  if (uncertainty <= 0.08) return 'Low';
  if (uncertainty <= 0.15) return 'Med';
  return 'High';
}

function getClvBadge(clvForecast: number | null | undefined): '+' | '0' | '-' {
  if (clvForecast == null) return '0';
  if (clvForecast > 0.005) return '+';
  if (clvForecast < -0.005) return '-';
  return '0';
}

function getConsensusBadge(booksUsed: number): 'Weak' | 'Normal' | 'Strong' {
  if (booksUsed >= 4) return 'Strong';
  if (booksUsed >= 3) return 'Normal';
  return 'Weak';
}

function getExecutionSuggestion(
  edgeFinal: number,
  clvForecast: number | null | undefined,
  uncertainty: number
): 'FIRE_NOW' | 'WAIT' | 'AVOID' {
  // Rule-based v1 per spec
  if (edgeFinal >= 0.03 && (clvForecast ?? 0) >= 0 && uncertainty <= 0.1) {
    return 'FIRE_NOW';
  }
  if (edgeFinal < 0.015 || uncertainty > 0.18) {
    return 'AVOID';
  }
  return 'WAIT';
}

// ============================================================================
// RANKING ENGINE
// ============================================================================

/**
 * Compute internal ranking score (never exposed to UI)
 */
function computeRankingScore(leg: ScoredLegInput): number {
  const edgeFinal = leg.edge_final ?? 0;
  const clvForecast = leg.clv_forecast ?? 0;
  const uncertainty = leg.uncertainty_final ?? 1;
  const booksStrength = computeBooksStrength(getBooksUsed(leg));

  // Guard against NaN
  const score =
    edgeFinal * WEIGHTS.EDGE +
    clvForecast * WEIGHTS.CLV +
    booksStrength * WEIGHTS.BOOKS +
    uncertainty * WEIGHTS.UNCERTAINTY;

  return Number.isNaN(score) ? -Infinity : score;
}

/**
 * Transform scored leg to ranked play for display
 */
function toRankedPlay(leg: ScoredLegInput, rank: number): RankedPlay {
  const pFinal = leg.p_final ?? 0;
  const pMarketDevig = leg.p_market_devig ?? 0;
  const edgeFinal = leg.edge_final ?? 0;
  const uncertainty = leg.uncertainty_final ?? 0;
  const clvForecast = leg.clv_forecast ?? null;
  const booksUsed = getBooksUsed(leg);

  return {
    scoredLegId: leg.scored_leg_id,
    legId: leg.leg_id,
    ticketId: leg.ticket_id,
    betSlipId: leg.bet_slip_id,
    selection: leg.selection ?? 'Unknown',
    providerLine: leg.provider_line,
    providerOdds: leg.provider_odds,
    provider: leg.provider,
    tier: leg.tier,
    promotionBand: leg.promotion_band,
    edgeFinalPct: edgeFinal * 100,
    pFinal,
    pMarketDevig,
    delta: pFinal - pMarketDevig,
    uncertaintyBadge: getUncertaintyBadge(uncertainty),
    clvBadge: getClvBadge(clvForecast),
    booksUsed,
    consensusBadge: getConsensusBadge(booksUsed),
    executionSuggestion: getExecutionSuggestion(edgeFinal, clvForecast, uncertainty),
    rank,
  };
}

// ============================================================================
// MAIN ENGINE FUNCTION
// ============================================================================

/**
 * Process scored legs through gates and ranking
 *
 * @param legs - Raw scored legs from view_scored_legs_latest
 * @param config - Gate configuration (optional, uses defaults)
 * @param topN - Number of top plays to return (default 10)
 */
export function processPlays(
  legs: ScoredLegInput[],
  config: GateConfig = DEFAULT_GATE_CONFIG,
  topN: number = 10
): CCCResponse {
  const eliminationCounts: Record<EliminationReason, number> = {
    NO_EVENT_LINK: 0,
    MISSING_PRIMITIVE: 0,
    INSUFFICIENT_BOOKS: 0,
    HIGH_UNCERTAINTY: 0,
    LOW_EDGE: 0,
    NEGATIVE_CLV: 0,
  };

  // Apply gates
  const eligible: ScoredLegInput[] = [];
  for (const leg of legs) {
    const result = checkGates(leg, config);
    if (result.eliminated && result.reason) {
      eliminationCounts[result.reason]++;
    } else {
      eligible.push(leg);
    }
  }

  // Rank eligible plays (deterministic)
  const ranked = eligible
    .map(leg => ({ leg, score: computeRankingScore(leg) }))
    .sort((a, b) => b.score - a.score) // Higher score = better
    .slice(0, topN)
    .map((item, index) => toRankedPlay(item.leg, index + 1));

  const totalRemoved = Object.values(eliminationCounts).reduce((a, b) => a + b, 0);

  return {
    plays: ranked,
    eliminationBanner: {
      totalRemoved,
      removedByReason: eliminationCounts,
    },
    configUsed: {
      ...config,
      RANKING_VERSION,
    },
    timestamp: new Date().toISOString(),
  };
}
