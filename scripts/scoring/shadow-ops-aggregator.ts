/* eslint-disable */
/**
 * shadow-ops-aggregator.ts — Tranche 8 Ops Metrics Aggregator
 *
 * Consumes shadow drift logs + promotion decision logs and produces:
 *   - Band distribution (% HARD / SOFT / NONE)
 *   - Promotion-eligible rate (HARD only)
 *   - Promotion-impacting delta rate
 *   - Average score/tier delta by sport
 *   - Anomaly flags
 *
 * Input: Array of ShadowRecord (drift log + promotion decision combined)
 * Output: JSON metrics + Markdown summaries (daily / weekly)
 *
 * No DB writes — pure computation on log data.
 *
 * Created: 2026-01-29 (Tranche 8 — Prod Shadow Monitoring)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DriftLogEntry {
  type: 'scoring_drift';
  timestamp: string;
  trace_id: string;
  pick_id: string;
  sport: string;
  mode: string;
  v1: { score: number; tier: string; ev: number };
  v2: {
    score: number;
    tier: string;
    ev: number;
    weights_source: string;
    top_contributors: Array<{ feature: string; contribution: number }>;
  } | null;
  deltas: { score: number; tier_changed: boolean; ev: number } | null;
  promotion_impacting: boolean;
}

export interface PromotionDecisionLog {
  type: 'promotion_decision_shadow' | 'promotion_decision';
  pick_id: string;
  promote: boolean;
  band: 'HARD' | 'SOFT' | 'NONE';
  reason_codes: string[];
  notes: string[];
}

export interface ShadowRecord {
  drift: DriftLogEntry;
  promotion: PromotionDecisionLog | null;
}

// ─── Metrics Types ──────────────────────────────────────────────────────────

export interface BandDistribution {
  hard: number;
  soft: number;
  none: number;
  total: number;
  hard_pct: number;
  soft_pct: number;
  none_pct: number;
}

export interface SportMetrics {
  sport: string;
  count: number;
  avg_score_delta: number;
  avg_ev_delta: number;
  tier_change_count: number;
  tier_change_pct: number;
  promotion_impacting_count: number;
  promotion_impacting_pct: number;
  band_distribution: BandDistribution;
}

export interface AnomalyFlag {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
}

export interface OpsMetrics {
  generated_at: string;
  period: string;
  period_start: string;
  period_end: string;
  total_picks: number;
  shadow_mode_active: boolean;
  band_distribution: BandDistribution;
  promotion_eligible_rate: number;
  promotion_impacting_rate: number;
  avg_score_delta: number;
  avg_ev_delta: number;
  tier_change_rate: number;
  by_sport: SportMetrics[];
  anomalies: AnomalyFlag[];
  recommendation: 'HOLD' | 'EXPAND' | 'ROLLBACK';
  recommendation_reasons: string[];
}

// ─── Alert Thresholds ───────────────────────────────────────────────────────

export const ALERT_THRESHOLDS = {
  /** HARD band rate above this triggers investigation */
  hard_rate_max: 30,
  /** HARD band rate below this is expected (informational) */
  hard_rate_min: 0,
  /** SOFT band rate above this triggers concern */
  soft_rate_max: 25,
  /** Promotion-impacting delta rate above this triggers warning */
  promotion_impacting_max: 40,
  /** Tier change rate above this triggers warning */
  tier_change_rate_max: 50,
  /** Average absolute score delta above this triggers warning */
  avg_score_delta_max: 25,
  /** Minimum picks for valid analysis */
  min_picks_for_analysis: 10,
  /** HARD rate above this is critical */
  hard_rate_critical: 50,
  /** Data gap rate (picks with critical fallback) above this */
  data_gap_rate_max: 30,
};

// ─── Core Aggregation ───────────────────────────────────────────────────────

export function computeBandDistribution(records: ShadowRecord[]): BandDistribution {
  const total = records.length;
  if (total === 0) return { hard: 0, soft: 0, none: 0, total: 0, hard_pct: 0, soft_pct: 0, none_pct: 0 };

  let hard = 0, soft = 0, none = 0;
  for (const r of records) {
    if (r.promotion) {
      switch (r.promotion.band) {
        case 'HARD': hard++; break;
        case 'SOFT': soft++; break;
        default: none++; break;
      }
    } else {
      none++;
    }
  }

  return {
    hard,
    soft,
    none,
    total,
    hard_pct: round2((hard / total) * 100),
    soft_pct: round2((soft / total) * 100),
    none_pct: round2((none / total) * 100),
  };
}

export function computeSportMetrics(records: ShadowRecord[]): SportMetrics[] {
  const bySport: Record<string, ShadowRecord[]> = {};
  for (const r of records) {
    const sport = r.drift.sport || 'UNKNOWN';
    if (!bySport[sport]) bySport[sport] = [];
    bySport[sport].push(r);
  }

  return Object.entries(bySport)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sport, recs]) => {
      const count = recs.length;
      const scoreDeltaSum = recs.reduce((sum, r) => sum + (r.drift.deltas?.score ?? 0), 0);
      const evDeltaSum = recs.reduce((sum, r) => sum + (r.drift.deltas?.ev ?? 0), 0);
      const tierChanges = recs.filter(r => r.drift.deltas?.tier_changed).length;
      const promoImpacting = recs.filter(r => r.drift.promotion_impacting).length;

      return {
        sport,
        count,
        avg_score_delta: round2(scoreDeltaSum / count),
        avg_ev_delta: round2(evDeltaSum / count),
        tier_change_count: tierChanges,
        tier_change_pct: round2((tierChanges / count) * 100),
        promotion_impacting_count: promoImpacting,
        promotion_impacting_pct: round2((promoImpacting / count) * 100),
        band_distribution: computeBandDistribution(recs),
      };
    });
}

export function detectAnomalies(records: ShadowRecord[], bands: BandDistribution): AnomalyFlag[] {
  const anomalies: AnomalyFlag[] = [];

  if (bands.total < ALERT_THRESHOLDS.min_picks_for_analysis) {
    anomalies.push({
      type: 'insufficient_data',
      severity: 'info',
      message: `Only ${bands.total} picks analyzed (minimum ${ALERT_THRESHOLDS.min_picks_for_analysis})`,
      value: bands.total,
      threshold: ALERT_THRESHOLDS.min_picks_for_analysis,
    });
    return anomalies;
  }

  // HARD rate checks
  if (bands.hard_pct > ALERT_THRESHOLDS.hard_rate_critical) {
    anomalies.push({
      type: 'hard_rate_critical',
      severity: 'critical',
      message: `HARD band rate ${bands.hard_pct}% exceeds critical threshold ${ALERT_THRESHOLDS.hard_rate_critical}%`,
      value: bands.hard_pct,
      threshold: ALERT_THRESHOLDS.hard_rate_critical,
    });
  } else if (bands.hard_pct > ALERT_THRESHOLDS.hard_rate_max) {
    anomalies.push({
      type: 'hard_rate_high',
      severity: 'warning',
      message: `HARD band rate ${bands.hard_pct}% exceeds warning threshold ${ALERT_THRESHOLDS.hard_rate_max}%`,
      value: bands.hard_pct,
      threshold: ALERT_THRESHOLDS.hard_rate_max,
    });
  }

  // SOFT rate check
  if (bands.soft_pct > ALERT_THRESHOLDS.soft_rate_max) {
    anomalies.push({
      type: 'soft_rate_high',
      severity: 'warning',
      message: `SOFT band rate ${bands.soft_pct}% exceeds threshold ${ALERT_THRESHOLDS.soft_rate_max}%`,
      value: bands.soft_pct,
      threshold: ALERT_THRESHOLDS.soft_rate_max,
    });
  }

  // Promotion-impacting rate
  const promoImpactingCount = records.filter(r => r.drift.promotion_impacting).length;
  const promoImpactingPct = round2((promoImpactingCount / records.length) * 100);
  if (promoImpactingPct > ALERT_THRESHOLDS.promotion_impacting_max) {
    anomalies.push({
      type: 'promotion_impacting_high',
      severity: 'warning',
      message: `Promotion-impacting delta rate ${promoImpactingPct}% exceeds threshold ${ALERT_THRESHOLDS.promotion_impacting_max}%`,
      value: promoImpactingPct,
      threshold: ALERT_THRESHOLDS.promotion_impacting_max,
    });
  }

  // Tier change rate
  const tierChanges = records.filter(r => r.drift.deltas?.tier_changed).length;
  const tierChangePct = round2((tierChanges / records.length) * 100);
  if (tierChangePct > ALERT_THRESHOLDS.tier_change_rate_max) {
    anomalies.push({
      type: 'tier_change_rate_high',
      severity: 'warning',
      message: `Tier change rate ${tierChangePct}% exceeds threshold ${ALERT_THRESHOLDS.tier_change_rate_max}%`,
      value: tierChangePct,
      threshold: ALERT_THRESHOLDS.tier_change_rate_max,
    });
  }

  // Score delta magnitude
  const avgAbsScoreDelta = round2(
    records.reduce((sum, r) => sum + Math.abs(r.drift.deltas?.score ?? 0), 0) / records.length
  );
  if (avgAbsScoreDelta > ALERT_THRESHOLDS.avg_score_delta_max) {
    anomalies.push({
      type: 'score_delta_high',
      severity: 'warning',
      message: `Average absolute score delta ${avgAbsScoreDelta} exceeds threshold ${ALERT_THRESHOLDS.avg_score_delta_max}`,
      value: avgAbsScoreDelta,
      threshold: ALERT_THRESHOLDS.avg_score_delta_max,
    });
  }

  return anomalies;
}

export function computeRecommendation(
  bands: BandDistribution,
  anomalies: AnomalyFlag[],
  records: ShadowRecord[]
): { recommendation: 'HOLD' | 'EXPAND' | 'ROLLBACK'; reasons: string[] } {
  const reasons: string[] = [];

  // ROLLBACK conditions
  const criticals = anomalies.filter(a => a.severity === 'critical');
  if (criticals.length > 0) {
    reasons.push(...criticals.map(a => a.message));
    return { recommendation: 'ROLLBACK', reasons };
  }

  // HOLD conditions
  const warnings = anomalies.filter(a => a.severity === 'warning');
  if (warnings.length > 0) {
    reasons.push(...warnings.map(a => a.message));
    return { recommendation: 'HOLD', reasons };
  }

  if (bands.total < ALERT_THRESHOLDS.min_picks_for_analysis) {
    reasons.push(`Insufficient data: ${bands.total} picks (need ${ALERT_THRESHOLDS.min_picks_for_analysis}+)`);
    return { recommendation: 'HOLD', reasons };
  }

  // EXPAND conditions
  const promoImpacting = records.filter(r => r.drift.promotion_impacting).length;
  const promoImpactPct = round2((promoImpacting / records.length) * 100);

  if (bands.hard_pct <= ALERT_THRESHOLDS.hard_rate_max &&
      bands.soft_pct <= ALERT_THRESHOLDS.soft_rate_max &&
      promoImpactPct <= ALERT_THRESHOLDS.promotion_impacting_max) {
    reasons.push(`HARD rate ${bands.hard_pct}% within limits`);
    reasons.push(`SOFT rate ${bands.soft_pct}% within limits`);
    reasons.push(`Promotion-impacting rate ${promoImpactPct}% within limits`);
    reasons.push(`No anomalies detected across ${bands.total} picks`);
    return { recommendation: 'EXPAND', reasons };
  }

  reasons.push('Metrics within acceptable range but not all conditions met for EXPAND');
  return { recommendation: 'HOLD', reasons };
}

export function aggregateMetrics(
  records: ShadowRecord[],
  period: string = 'daily',
  periodStart?: string,
  periodEnd?: string
): OpsMetrics {
  const now = new Date().toISOString();
  const bands = computeBandDistribution(records);
  const sportMetrics = computeSportMetrics(records);
  const anomalies = detectAnomalies(records, bands);
  const { recommendation, reasons } = computeRecommendation(bands, anomalies, records);

  const promoImpacting = records.filter(r => r.drift.promotion_impacting).length;
  const tierChanges = records.filter(r => r.drift.deltas?.tier_changed).length;

  return {
    generated_at: now,
    period,
    period_start: periodStart || now,
    period_end: periodEnd || now,
    total_picks: records.length,
    shadow_mode_active: true,
    band_distribution: bands,
    promotion_eligible_rate: bands.hard_pct,
    promotion_impacting_rate: records.length > 0 ? round2((promoImpacting / records.length) * 100) : 0,
    avg_score_delta: records.length > 0
      ? round2(records.reduce((sum, r) => sum + (r.drift.deltas?.score ?? 0), 0) / records.length)
      : 0,
    avg_ev_delta: records.length > 0
      ? round2(records.reduce((sum, r) => sum + (r.drift.deltas?.ev ?? 0), 0) / records.length)
      : 0,
    tier_change_rate: records.length > 0 ? round2((tierChanges / records.length) * 100) : 0,
    by_sport: sportMetrics,
    anomalies,
    recommendation,
    recommendation_reasons: reasons,
  };
}

// ─── Markdown Generation ────────────────────────────────────────────────────

export function generateDailySummary(metrics: OpsMetrics, date: string): string {
  const lines: string[] = [];
  lines.push(`# Daily Promotion Shadow Summary — ${date}`);
  lines.push('');
  lines.push(`**Generated**: ${metrics.generated_at}`);
  lines.push(`**Period**: ${metrics.period_start} to ${metrics.period_end}`);
  lines.push(`**Total Picks**: ${metrics.total_picks}`);
  lines.push(`**Shadow Mode**: ${metrics.shadow_mode_active ? 'ACTIVE' : 'INACTIVE'}`);
  lines.push(`**Recommendation**: **${metrics.recommendation}**`);
  lines.push('');

  lines.push('---');
  lines.push('');

  // Band distribution
  lines.push('## Band Distribution');
  lines.push('');
  lines.push('| Band | Count | Percentage |');
  lines.push('|------|-------|------------|');
  lines.push(`| HARD | ${metrics.band_distribution.hard} | ${metrics.band_distribution.hard_pct}% |`);
  lines.push(`| SOFT | ${metrics.band_distribution.soft} | ${metrics.band_distribution.soft_pct}% |`);
  lines.push(`| NONE | ${metrics.band_distribution.none} | ${metrics.band_distribution.none_pct}% |`);
  lines.push(`| **Total** | **${metrics.band_distribution.total}** | **100%** |`);
  lines.push('');

  // Key metrics
  lines.push('## Key Metrics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Promotion-Eligible Rate (HARD) | ${metrics.promotion_eligible_rate}% |`);
  lines.push(`| Promotion-Impacting Delta Rate | ${metrics.promotion_impacting_rate}% |`);
  lines.push(`| Tier Change Rate | ${metrics.tier_change_rate}% |`);
  lines.push(`| Avg Score Delta (V2 - V1) | ${metrics.avg_score_delta > 0 ? '+' : ''}${metrics.avg_score_delta} |`);
  lines.push(`| Avg EV Delta (V2 - V1) | ${metrics.avg_ev_delta > 0 ? '+' : ''}${metrics.avg_ev_delta}% |`);
  lines.push('');

  // Per-sport
  lines.push('## Per-Sport Breakdown');
  lines.push('');
  lines.push('| Sport | Picks | Avg Score Delta | Avg EV Delta | Tier Changes | Promo-Impacting | HARD | SOFT | NONE |');
  lines.push('|-------|-------|-----------------|--------------|--------------|-----------------|------|------|------|');
  for (const s of metrics.by_sport) {
    const sd = s.avg_score_delta > 0 ? `+${s.avg_score_delta}` : `${s.avg_score_delta}`;
    const ed = s.avg_ev_delta > 0 ? `+${s.avg_ev_delta}` : `${s.avg_ev_delta}`;
    lines.push(`| ${s.sport} | ${s.count} | ${sd} | ${ed}% | ${s.tier_change_count} (${s.tier_change_pct}%) | ${s.promotion_impacting_count} (${s.promotion_impacting_pct}%) | ${s.band_distribution.hard} | ${s.band_distribution.soft} | ${s.band_distribution.none} |`);
  }
  lines.push('');

  // Anomalies
  lines.push('## Anomalies');
  lines.push('');
  if (metrics.anomalies.length === 0) {
    lines.push('No anomalies detected.');
  } else {
    lines.push('| Severity | Type | Message |');
    lines.push('|----------|------|---------|');
    for (const a of metrics.anomalies) {
      const icon = a.severity === 'critical' ? 'CRITICAL' : a.severity === 'warning' ? 'WARNING' : 'INFO';
      lines.push(`| ${icon} | ${a.type} | ${a.message} |`);
    }
  }
  lines.push('');

  // Recommendation
  lines.push('## Recommendation');
  lines.push('');
  lines.push(`**${metrics.recommendation}**`);
  lines.push('');
  for (const r of metrics.recommendation_reasons) {
    lines.push(`- ${r}`);
  }
  lines.push('');

  return lines.join('\n');
}

export function generateWeeklySummary(dailyMetrics: OpsMetrics[], weekLabel: string): string {
  const lines: string[] = [];
  lines.push(`# Weekly Promotion Shadow Summary — ${weekLabel}`);
  lines.push('');
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push(`**Days Covered**: ${dailyMetrics.length}`);
  lines.push('');

  if (dailyMetrics.length === 0) {
    lines.push('No daily data available for this week.');
    return lines.join('\n');
  }

  const totalPicks = dailyMetrics.reduce((sum, m) => sum + m.total_picks, 0);
  const totalHard = dailyMetrics.reduce((sum, m) => sum + m.band_distribution.hard, 0);
  const totalSoft = dailyMetrics.reduce((sum, m) => sum + m.band_distribution.soft, 0);
  const totalNone = dailyMetrics.reduce((sum, m) => sum + m.band_distribution.none, 0);

  lines.push('---');
  lines.push('');

  // Weekly aggregated band distribution
  lines.push('## Weekly Band Distribution');
  lines.push('');
  lines.push('| Band | Count | Percentage |');
  lines.push('|------|-------|------------|');
  lines.push(`| HARD | ${totalHard} | ${totalPicks > 0 ? round2((totalHard / totalPicks) * 100) : 0}% |`);
  lines.push(`| SOFT | ${totalSoft} | ${totalPicks > 0 ? round2((totalSoft / totalPicks) * 100) : 0}% |`);
  lines.push(`| NONE | ${totalNone} | ${totalPicks > 0 ? round2((totalNone / totalPicks) * 100) : 0}% |`);
  lines.push(`| **Total** | **${totalPicks}** | **100%** |`);
  lines.push('');

  // Weekly key metrics
  const avgPromoEligible = round2(dailyMetrics.reduce((sum, m) => sum + m.promotion_eligible_rate, 0) / dailyMetrics.length);
  const avgPromoImpacting = round2(dailyMetrics.reduce((sum, m) => sum + m.promotion_impacting_rate, 0) / dailyMetrics.length);
  const avgScoreDelta = round2(dailyMetrics.reduce((sum, m) => sum + m.avg_score_delta, 0) / dailyMetrics.length);
  const avgEvDelta = round2(dailyMetrics.reduce((sum, m) => sum + m.avg_ev_delta, 0) / dailyMetrics.length);
  const avgTierChange = round2(dailyMetrics.reduce((sum, m) => sum + m.tier_change_rate, 0) / dailyMetrics.length);

  lines.push('## Weekly Averages');
  lines.push('');
  lines.push('| Metric | Weekly Avg |');
  lines.push('|--------|-----------|');
  lines.push(`| Promotion-Eligible Rate (HARD) | ${avgPromoEligible}% |`);
  lines.push(`| Promotion-Impacting Delta Rate | ${avgPromoImpacting}% |`);
  lines.push(`| Tier Change Rate | ${avgTierChange}% |`);
  lines.push(`| Avg Score Delta | ${avgScoreDelta > 0 ? '+' : ''}${avgScoreDelta} |`);
  lines.push(`| Avg EV Delta | ${avgEvDelta > 0 ? '+' : ''}${avgEvDelta}% |`);
  lines.push('');

  // Daily trend
  lines.push('## Daily Trend');
  lines.push('');
  lines.push('| Date | Picks | HARD% | SOFT% | Promo-Impact% | Score Delta | Recommendation |');
  lines.push('|------|-------|-------|-------|---------------|-------------|----------------|');
  for (const m of dailyMetrics) {
    const date = m.period_start.split('T')[0] || m.period;
    lines.push(`| ${date} | ${m.total_picks} | ${m.band_distribution.hard_pct}% | ${m.band_distribution.soft_pct}% | ${m.promotion_impacting_rate}% | ${m.avg_score_delta > 0 ? '+' : ''}${m.avg_score_delta} | ${m.recommendation} |`);
  }
  lines.push('');

  // Weekly anomaly summary
  const allAnomalies = dailyMetrics.flatMap(m => m.anomalies);
  const criticalCount = allAnomalies.filter(a => a.severity === 'critical').length;
  const warningCount = allAnomalies.filter(a => a.severity === 'warning').length;
  const infoCount = allAnomalies.filter(a => a.severity === 'info').length;

  lines.push('## Anomaly Summary');
  lines.push('');
  lines.push(`- **Critical**: ${criticalCount}`);
  lines.push(`- **Warning**: ${warningCount}`);
  lines.push(`- **Info**: ${infoCount}`);
  lines.push('');

  if (allAnomalies.length > 0) {
    lines.push('| Day | Severity | Type | Message |');
    lines.push('|-----|----------|------|---------|');
    for (const m of dailyMetrics) {
      const date = m.period_start.split('T')[0] || m.period;
      for (const a of m.anomalies) {
        lines.push(`| ${date} | ${a.severity.toUpperCase()} | ${a.type} | ${a.message} |`);
      }
    }
    lines.push('');
  }

  // Weekly recommendation
  const recommendations = dailyMetrics.map(m => m.recommendation);
  const hasRollback = recommendations.includes('ROLLBACK');
  const hasHold = recommendations.includes('HOLD');
  const allExpand = recommendations.every(r => r === 'EXPAND');

  let weeklyRec: string;
  if (hasRollback) {
    weeklyRec = 'ROLLBACK — Critical anomalies detected during the week';
  } else if (allExpand) {
    weeklyRec = 'EXPAND — All daily checks passed, safe to expand canary';
  } else if (hasHold) {
    weeklyRec = 'HOLD — Some warnings detected, continue monitoring';
  } else {
    weeklyRec = 'HOLD — Mixed signals, continue monitoring';
  }

  lines.push('## Weekly Recommendation');
  lines.push('');
  lines.push(`**${weeklyRec}**`);
  lines.push('');

  return lines.join('\n');
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Export for use by runner
export { round2 };
