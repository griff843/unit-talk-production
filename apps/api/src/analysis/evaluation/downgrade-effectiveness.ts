/**
 * Downgrade Effectiveness Analysis — SPRINT-037
 *
 * Measures whether band downgrades and suppressions actually prevented losses.
 * Answers the question: "Did our downgrades make things better?"
 *
 * Key metrics:
 *   - Downgrade hit: downgraded picks that would have lost at initial band
 *   - Suppression hit: suppressed picks that would have lost
 *   - False downgrade: downgraded picks that would have won at initial band
 *   - Net value: overall value added by downgrade logic
 */

import type { BandTier } from '../promotion/types';

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * A record combining band assignment with outcome for effectiveness analysis.
 */
export interface DowngradeOutcomeRecord {
  /** Initial band before downgrades. */
  initialBand: BandTier;
  /** Final band after downgrades. */
  finalBand: BandTier;
  /** Whether the pick was downgraded (final < initial). */
  wasDowngraded: boolean;
  /** Whether the pick was suppressed. */
  wasSuppressed: boolean;
  /** Downgrade reason codes from band-downgrade-rules. */
  downgradeReasons: string[];
  /** Suppression reason codes. */
  suppressionReasons: string[];
  /** Actual outcome: WIN, LOSS, PUSH. */
  outcome: 'WIN' | 'LOSS' | 'PUSH';
  /** Flat-bet result: +100 for WIN, -110 for LOSS, 0 for PUSH. */
  flatBetResult: number;
}

/**
 * Effectiveness metrics for a single downgrade reason category.
 */
export interface ReasonEffectiveness {
  reason: string;
  total: number;
  losses_prevented: number;
  wins_prevented: number;
  pushes: number;
  loss_prevention_rate: number;
  net_flat_bet_impact: number;
}

/**
 * Full downgrade effectiveness report.
 */
export interface DowngradeEffectivenessReport {
  report_version: string;

  /** Total records analyzed. */
  total_records: number;

  /** Records that were downgraded (band changed, not suppressed). */
  downgraded: {
    total: number;
    outcomes_won: number;
    outcomes_lost: number;
    outcomes_pushed: number;
    /** Losses among downgraded picks — these are "downgrades that caught bad picks". */
    loss_rate_pct: number;
    /** Net flat-bet value of downgraded picks (negative = downgrades saved money). */
    net_flat_bet: number;
  };

  /** Records that were suppressed entirely. */
  suppressed: {
    total: number;
    outcomes_won: number;
    outcomes_lost: number;
    outcomes_pushed: number;
    /** Losses among suppressed picks — higher = suppression is effective. */
    loss_rate_pct: number;
    /** Net flat-bet value of suppressed picks (negative = suppression saved money). */
    net_flat_bet: number;
  };

  /** Records that passed through without downgrade. */
  unchanged: {
    total: number;
    outcomes_won: number;
    outcomes_lost: number;
    outcomes_pushed: number;
    hit_rate_pct: number;
    net_flat_bet: number;
  };

  /** Effectiveness breakdown by downgrade reason. */
  by_reason: ReasonEffectiveness[];

  /** Summary diagnostics. */
  diagnostics: {
    /** True if suppressed picks have a worse loss rate than published picks. */
    suppression_effective: boolean;
    /** True if downgraded picks have a worse profile than unchanged picks. */
    downgrade_effective: boolean;
    /** Estimated flat-bet savings from suppression + downgrades. */
    estimated_savings: number;
    /** Top reason category driving value. */
    top_reason: string | null;
  };
}

// ── Core Computation ────────────────────────────────────────────────────────

/**
 * Build a DowngradeOutcomeRecord from raw inputs.
 */
export function buildDowngradeRecord(
  initialBand: BandTier,
  finalBand: BandTier,
  downgradeReasons: string[],
  suppressionReasons: string[],
  outcome: 'WIN' | 'LOSS' | 'PUSH'
): DowngradeOutcomeRecord {
  const bandOrder: BandTier[] = ['A+', 'A', 'B', 'C', 'SUPPRESS'];
  const wasDowngraded =
    finalBand !== 'SUPPRESS' && bandOrder.indexOf(finalBand) > bandOrder.indexOf(initialBand);
  const wasSuppressed = finalBand === 'SUPPRESS' && initialBand !== 'SUPPRESS';

  let flatBetResult = 0;
  if (outcome === 'WIN') flatBetResult = 100;
  else if (outcome === 'LOSS') flatBetResult = -110;

  return {
    initialBand,
    finalBand,
    wasDowngraded,
    wasSuppressed,
    downgradeReasons,
    suppressionReasons,
    outcome,
    flatBetResult,
  };
}

/**
 * Generate a downgrade effectiveness report from outcome records.
 */
export function analyzeDowngradeEffectiveness(
  records: DowngradeOutcomeRecord[]
): DowngradeEffectivenessReport {
  const downgraded = records.filter(r => r.wasDowngraded);
  const suppressed = records.filter(r => r.wasSuppressed);
  const unchanged = records.filter(r => !r.wasDowngraded && !r.wasSuppressed);

  const downgradedMetrics = computeGroupMetrics(downgraded);
  const suppressedMetrics = computeGroupMetrics(suppressed);
  const unchangedMetrics = computeGroupMetrics(unchanged);

  const byReason = computeReasonEffectiveness(records);

  const unchangedNonPush = unchanged.filter(r => r.outcome !== 'PUSH');
  const suppressedNonPush = suppressed.filter(r => r.outcome !== 'PUSH');
  const unchangedLossRate =
    unchangedNonPush.length > 0
      ? unchangedNonPush.filter(r => r.outcome === 'LOSS').length / unchangedNonPush.length
      : 0;
  const suppressedLossRate =
    suppressedNonPush.length > 0
      ? suppressedNonPush.filter(r => r.outcome === 'LOSS').length / suppressedNonPush.length
      : 0;

  const suppressionEffective = suppressed.length > 0 && suppressedLossRate > unchangedLossRate;
  const downgradeEffective =
    downgraded.length > 0 && downgradedMetrics.lossRatePct > unchangedMetrics.lossRatePct;

  // Estimated savings: negative flat-bet value of suppressed + downgraded picks
  // (if they would have been bet at initial band level)
  const estimatedSavings = -(suppressedMetrics.netFlatBet + downgradedMetrics.netFlatBet);

  const topReason =
    byReason.length > 0
      ? byReason.reduce((best, r) => (r.net_flat_bet_impact < best.net_flat_bet_impact ? r : best))
          .reason
      : null;

  return {
    report_version: 'downgrade-effectiveness-v1.0',
    total_records: records.length,
    downgraded: {
      total: downgraded.length,
      outcomes_won: downgradedMetrics.wins,
      outcomes_lost: downgradedMetrics.losses,
      outcomes_pushed: downgradedMetrics.pushes,
      loss_rate_pct: round4(downgradedMetrics.lossRatePct),
      net_flat_bet: downgradedMetrics.netFlatBet,
    },
    suppressed: {
      total: suppressed.length,
      outcomes_won: suppressedMetrics.wins,
      outcomes_lost: suppressedMetrics.losses,
      outcomes_pushed: suppressedMetrics.pushes,
      loss_rate_pct: round4(suppressedMetrics.lossRatePct),
      net_flat_bet: suppressedMetrics.netFlatBet,
    },
    unchanged: {
      total: unchanged.length,
      outcomes_won: unchangedMetrics.wins,
      outcomes_lost: unchangedMetrics.losses,
      outcomes_pushed: unchangedMetrics.pushes,
      hit_rate_pct: round4(
        unchangedNonPush.length > 0 ? (unchangedMetrics.wins / unchangedNonPush.length) * 100 : 0
      ),
      net_flat_bet: unchangedMetrics.netFlatBet,
    },
    by_reason: byReason,
    diagnostics: {
      suppression_effective: suppressionEffective,
      downgrade_effective: downgradeEffective,
      estimated_savings: estimatedSavings,
      top_reason: topReason,
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function computeGroupMetrics(records: DowngradeOutcomeRecord[]) {
  const wins = records.filter(r => r.outcome === 'WIN').length;
  const losses = records.filter(r => r.outcome === 'LOSS').length;
  const pushes = records.filter(r => r.outcome === 'PUSH').length;
  const nonPush = records.filter(r => r.outcome !== 'PUSH');
  const lossRatePct = nonPush.length > 0 ? (losses / nonPush.length) * 100 : 0;
  const netFlatBet = records.reduce((s, r) => s + r.flatBetResult, 0);
  return { wins, losses, pushes, lossRatePct, netFlatBet };
}

function computeReasonEffectiveness(records: DowngradeOutcomeRecord[]): ReasonEffectiveness[] {
  const reasonMap = new Map<string, DowngradeOutcomeRecord[]>();

  for (const r of records) {
    const reasons = [...r.downgradeReasons, ...r.suppressionReasons];
    for (const reason of reasons) {
      // Extract category from reason code (before the first ':')
      const category = reason.split(':')[0];
      if (!reasonMap.has(category)) reasonMap.set(category, []);
      reasonMap.get(category)!.push(r);
    }
  }

  const results: ReasonEffectiveness[] = [];
  for (const [reason, recs] of reasonMap.entries()) {
    const total = recs.length;
    const lossesPrevented = recs.filter(r => r.outcome === 'LOSS').length;
    const winsPrevented = recs.filter(r => r.outcome === 'WIN').length;
    const pushes = recs.filter(r => r.outcome === 'PUSH').length;
    const nonPush = recs.filter(r => r.outcome !== 'PUSH');
    const lossPreventionRate = nonPush.length > 0 ? lossesPrevented / nonPush.length : 0;
    const netFlatBetImpact = recs.reduce((s, r) => s + r.flatBetResult, 0);

    results.push({
      reason,
      total,
      losses_prevented: lossesPrevented,
      wins_prevented: winsPrevented,
      pushes,
      loss_prevention_rate: round4(lossPreventionRate),
      net_flat_bet_impact: netFlatBetImpact,
    });
  }

  return results.sort((a, b) => a.net_flat_bet_impact - b.net_flat_bet_impact);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
