/**
 * Platform Validation Report — SPRINT-041A
 *
 * Core computation functions for each operational health check.
 * Each function is a pure, deterministic computation on snapshot data.
 *
 * This module only MEASURES — it does NOT modify any system state.
 */

import type {
  IngestionSnapshot,
  ScoringSnapshot,
  PromotionSnapshot,
  DiscordSnapshot,
  SettlementSnapshot,
  RecapSnapshot,
  TemporalSnapshot,
  PerformanceRecord,
  IngestionHealthResult,
  ScoringHealthResult,
  PromotionHealthResult,
  DiscordHealthResult,
  SettlementHealthResult,
  RecapHealthResult,
  TemporalHealthResult,
  ModelPerformanceResult,
  BandPerformanceMetrics,
  CheckStatus,
} from './platform-validation-types';
import type { BandTier } from '../../analysis/promotion/types';

// ── Thresholds ──────────────────────────────────────────────────────────────

/** Ingestion is stale if newest prop > 120 minutes old. */
const INGESTION_STALE_MINUTES = 120;
/** Minimum props expected in 24h window during active season. */
const INGESTION_MIN_24H = 1;

/** Minimum scoring rate to be healthy. */
const SCORING_MIN_PERCENT = 80;

/** Promotion halted if zero promoted in 24h. */
const PROMOTION_MIN_24H = 0;
/** Band collapsed if any single band > 60% of non-suppressed. */
const BAND_COLLAPSE_THRESHOLD = 0.6;

/** Discord outbox stuck if oldest pending > 30 minutes. */
const DISCORD_STUCK_MINUTES = 30;

/** Settlement backlog if > 50 unsettled and oldest > 48h. */
const SETTLEMENT_BACKLOG_THRESHOLD = 50;
const SETTLEMENT_STALE_HOURS = 48;

/** Recap must run at least 5 of last 7 days. */
const RECAP_MIN_7_DAYS = 5;
/** Recap stale if last run > 36 hours ago. */
const RECAP_STALE_HOURS = 36;

/** Temporal worker heartbeat stale after 120 seconds. */
const TEMPORAL_HEARTBEAT_STALE_SECONDS = 120;

// ── CHECK 1: Ingestion Health ───────────────────────────────────────────────

export function checkIngestionHealth(snapshot: IngestionSnapshot): IngestionHealthResult {
  const issues: string[] = [];

  const ingestionHalted = snapshot.props_ingested_last_24h < INGESTION_MIN_24H;
  const staleData =
    snapshot.newest_prop_age_minutes !== null &&
    snapshot.newest_prop_age_minutes > INGESTION_STALE_MINUTES;

  if (ingestionHalted) {
    issues.push('Ingestion halted: zero props ingested in last 24h');
  }
  if (staleData) {
    issues.push(
      `Stale data: newest prop is ${snapshot.newest_prop_age_minutes} minutes old (threshold: ${INGESTION_STALE_MINUTES})`
    );
  }
  if (snapshot.distinct_books === 0) {
    issues.push('No distinct books found in recent data');
  }

  const status = deriveStatus(ingestionHalted, staleData || snapshot.distinct_books === 0);

  return {
    status,
    issues,
    props_ingested_last_24h: snapshot.props_ingested_last_24h,
    props_ingested_last_48h: snapshot.props_ingested_last_48h,
    distinct_games: snapshot.distinct_games,
    distinct_books: snapshot.distinct_books,
    ingestion_halted: ingestionHalted,
    stale_data: staleData,
  };
}

// ── CHECK 2: Scoring Health ─────────────────────────────────────────────────

export function checkScoringHealth(snapshot: ScoringSnapshot): ScoringHealthResult {
  const issues: string[] = [];

  const percentScored =
    snapshot.total_props_last_24h > 0
      ? (snapshot.scored_props_last_24h / snapshot.total_props_last_24h) * 100
      : 0;

  const scoringFailures = percentScored < SCORING_MIN_PERCENT && snapshot.total_props_last_24h > 0;
  const missingProbability = snapshot.props_missing_p_final > 0;

  if (scoringFailures) {
    issues.push(`Scoring rate ${round2(percentScored)}% below threshold ${SCORING_MIN_PERCENT}%`);
  }
  if (missingProbability) {
    issues.push(`${snapshot.props_missing_p_final} props missing p_final values`);
  }
  if (snapshot.props_missing_edge > 0) {
    issues.push(`${snapshot.props_missing_edge} props missing edge values`);
  }
  if (snapshot.props_missing_tier > 0) {
    issues.push(`${snapshot.props_missing_tier} props missing tier assignment`);
  }

  const status = deriveStatus(scoringFailures, missingProbability);

  return {
    status,
    issues,
    scored_props_last_24h: snapshot.scored_props_last_24h,
    percent_scored: round2(percentScored),
    average_edge: snapshot.average_edge !== null ? round4(snapshot.average_edge) : null,
    scoring_failures: scoringFailures,
    missing_probability: missingProbability,
  };
}

// ── CHECK 3: Promotion Health ───────────────────────────────────────────────

export function checkPromotionHealth(snapshot: PromotionSnapshot): PromotionHealthResult {
  const issues: string[] = [];

  const promotionHalted = snapshot.promoted_last_24h <= PROMOTION_MIN_24H;

  // Check for collapsed bands
  const nonSuppressed = snapshot.total_evaluated - (snapshot.band_distribution['SUPPRESS'] ?? 0);
  const bandsCollapsed =
    nonSuppressed > 0
      ? (['A+', 'A', 'B', 'C'] as const).some(
          band => (snapshot.band_distribution[band] ?? 0) / nonSuppressed > BAND_COLLAPSE_THRESHOLD
        )
      : false;

  const suppressionRate =
    snapshot.total_evaluated > 0 ? (snapshot.suppressed_count / snapshot.total_evaluated) * 100 : 0;

  const downgradeRate =
    snapshot.total_evaluated > 0 ? (snapshot.downgraded_count / snapshot.total_evaluated) * 100 : 0;

  if (promotionHalted) {
    issues.push('Promotion engine not running: zero promotions in 24h');
  }
  if (bandsCollapsed) {
    issues.push('Band distribution collapsed: single band > 60% of non-suppressed');
  }
  if (suppressionRate > 50) {
    issues.push(`High suppression rate: ${round2(suppressionRate)}%`);
  }

  const status = deriveStatus(promotionHalted, bandsCollapsed || suppressionRate > 50);

  return {
    status,
    issues,
    promoted_last_24h: snapshot.promoted_last_24h,
    band_distribution: snapshot.band_distribution,
    suppression_rate: round2(suppressionRate),
    downgrade_rate: round2(downgradeRate),
    promotion_halted: promotionHalted,
    bands_collapsed: bandsCollapsed,
  };
}

// ── CHECK 4: Discord Delivery Health ────────────────────────────────────────

export function checkDiscordHealth(snapshot: DiscordSnapshot): DiscordHealthResult {
  const issues: string[] = [];

  const stuckOutbox =
    snapshot.oldest_pending_age_minutes !== null &&
    snapshot.oldest_pending_age_minutes > DISCORD_STUCK_MINUTES;

  const deliveryFailures = snapshot.failed_messages > 0;

  if (stuckOutbox) {
    issues.push(
      `Stuck outbox: oldest pending message is ${snapshot.oldest_pending_age_minutes} minutes old`
    );
  }
  if (deliveryFailures) {
    issues.push(`${snapshot.failed_messages} failed Discord deliveries`);
  }
  if (snapshot.pending_messages > 10) {
    issues.push(`${snapshot.pending_messages} pending messages in outbox`);
  }

  const status = deriveStatus(stuckOutbox, deliveryFailures);

  return {
    status,
    issues,
    alerts_sent_last_24h: snapshot.alerts_sent_last_24h,
    pending_messages: snapshot.pending_messages,
    failed_messages: snapshot.failed_messages,
    stuck_outbox: stuckOutbox,
    delivery_failures: deliveryFailures,
  };
}

// ── CHECK 5: Settlement Health ──────────────────────────────────────────────

export function checkSettlementHealth(snapshot: SettlementSnapshot): SettlementHealthResult {
  const issues: string[] = [];

  const settlementBacklog =
    snapshot.unsettled_picks > SETTLEMENT_BACKLOG_THRESHOLD &&
    snapshot.oldest_unsettled_age_hours !== null &&
    snapshot.oldest_unsettled_age_hours > SETTLEMENT_STALE_HOURS;

  const gradingStalled = snapshot.settlements_last_24h === 0 && snapshot.unsettled_picks > 0;

  if (settlementBacklog) {
    issues.push(
      `Settlement backlog: ${snapshot.unsettled_picks} unsettled, oldest ${round2(snapshot.oldest_unsettled_age_hours!)}h`
    );
  }
  if (gradingStalled) {
    issues.push('Grading stalled: zero settlements in 24h with pending picks');
  }
  if (snapshot.disputed_count > 0) {
    issues.push(`${snapshot.disputed_count} disputed settlements require review`);
  }

  const status = deriveStatus(gradingStalled, settlementBacklog || snapshot.disputed_count > 0);

  return {
    status,
    issues,
    unsettled_picks: snapshot.unsettled_picks,
    avg_settlement_delay_minutes: snapshot.avg_settlement_delay_minutes,
    settlements_last_24h: snapshot.settlements_last_24h,
    settlement_backlog: settlementBacklog,
    grading_stalled: gradingStalled,
  };
}

// ── CHECK 6: Recap Health ───────────────────────────────────────────────────

export function checkRecapHealth(snapshot: RecapSnapshot): RecapHealthResult {
  const issues: string[] = [];

  const recapMissing = snapshot.daily_recaps_last_7_days < RECAP_MIN_7_DAYS;
  const recapStale =
    snapshot.last_recap_age_hours !== null && snapshot.last_recap_age_hours > RECAP_STALE_HOURS;

  const recapRunning = !recapMissing && !recapStale;

  if (recapMissing) {
    issues.push(
      `Only ${snapshot.daily_recaps_last_7_days}/${RECAP_MIN_7_DAYS} daily recaps in last 7 days`
    );
  }
  if (recapStale) {
    issues.push(`Last recap was ${round2(snapshot.last_recap_age_hours!)} hours ago`);
  }

  const status = deriveStatus(false, recapMissing || recapStale);

  return {
    status,
    issues,
    daily_recaps_last_7_days: snapshot.daily_recaps_last_7_days,
    last_recap_timestamp: snapshot.last_recap_timestamp,
    recap_running: recapRunning,
  };
}

// ── CHECK 7: Temporal Health ────────────────────────────────────────────────

export function checkTemporalHealth(snapshot: TemporalSnapshot): TemporalHealthResult {
  const issues: string[] = [];

  const workerStopped =
    snapshot.worker_heartbeat_age_seconds !== null &&
    snapshot.worker_heartbeat_age_seconds > TEMPORAL_HEARTBEAT_STALE_SECONDS;

  const scheduleFailures = snapshot.failed_workflows_last_24h > 0;
  const workerResponsive = !workerStopped;

  if (workerStopped) {
    issues.push(
      `Temporal worker unresponsive: last heartbeat ${snapshot.worker_heartbeat_age_seconds}s ago`
    );
  }
  if (scheduleFailures) {
    issues.push(`${snapshot.failed_workflows_last_24h} failed workflows in last 24h`);
  }
  if (snapshot.workflow_backlog > 10) {
    issues.push(`Workflow backlog: ${snapshot.workflow_backlog} pending executions`);
  }
  if (snapshot.active_schedules === 0) {
    issues.push('No active Temporal schedules');
  }

  const status = deriveStatus(workerStopped, scheduleFailures || snapshot.active_schedules === 0);

  return {
    status,
    issues,
    active_schedules: snapshot.active_schedules,
    worker_responsive: workerResponsive,
    workflow_backlog: snapshot.workflow_backlog,
    worker_stopped: workerStopped,
    schedule_failures: scheduleFailures,
  };
}

// ── CHECK 8: Model Performance ──────────────────────────────────────────────

export function checkModelPerformance(records: PerformanceRecord[]): ModelPerformanceResult {
  const issues: string[] = [];

  if (records.length === 0) {
    return {
      status: 'warn',
      issues: ['No performance records available for evaluation'],
      total_picks: 0,
      overall_roi_pct: 0,
      overall_win_rate: 0,
      overall_clv_pct: null,
      band_performance: [],
      tier_inversion: false,
      negative_clv_all_bands: false,
    };
  }

  const overallRoi = computeFlatBetRoiPct(records.map(r => r.outcome));
  const nonPush = records.filter(r => r.outcome !== 'PUSH');
  const wins = nonPush.filter(r => r.outcome === 'WIN').length;
  const overallWinRate = nonPush.length > 0 ? (wins / nonPush.length) * 100 : 0;

  const clvRecords = records.filter(r => r.clvPercent != null);
  const overallClv = clvRecords.length > 0 ? mean(clvRecords.map(r => r.clvPercent!)) : null;

  // Band-level performance
  const publishedBands: ReadonlyArray<Exclude<BandTier, 'SUPPRESS'>> = ['A+', 'A', 'B', 'C'];
  const bandPerformance: BandPerformanceMetrics[] = publishedBands.map(band => {
    const bandRecords = records.filter(r => r.finalBand === band);
    const bandNonPush = bandRecords.filter(r => r.outcome !== 'PUSH');
    const bandWins = bandNonPush.filter(r => r.outcome === 'WIN').length;
    const bandClvRecords = bandRecords.filter(r => r.clvPercent != null);

    return {
      band,
      sample_size: bandRecords.length,
      win_rate: bandNonPush.length > 0 ? round2((bandWins / bandNonPush.length) * 100) : 0,
      roi_pct: round4(computeFlatBetRoiPct(bandRecords.map(r => r.outcome))),
      avg_clv_pct:
        bandClvRecords.length > 0 ? round4(mean(bandClvRecords.map(r => r.clvPercent!))) : null,
    };
  });

  // Check tier inversion: A+ should have ROI >= A >= B >= C
  const bandsWithData = bandPerformance.filter(b => b.sample_size > 0);
  const tierInversion = hasTierInversion(bandsWithData);

  // Check negative CLV across all bands
  const bandsWithClv = bandPerformance.filter(b => b.avg_clv_pct !== null && b.sample_size > 0);
  const negativeClvAll = bandsWithClv.length > 0 && bandsWithClv.every(b => b.avg_clv_pct! < 0);

  if (tierInversion) {
    issues.push('Tier inversion detected: higher bands not outperforming lower bands');
  }
  if (negativeClvAll) {
    issues.push('Negative CLV across all bands');
  }
  if (overallRoi < -20) {
    issues.push(`Significant negative ROI: ${round2(overallRoi)}%`);
  }

  const status = deriveStatus(negativeClvAll && tierInversion, tierInversion || negativeClvAll);

  return {
    status,
    issues,
    total_picks: records.length,
    overall_roi_pct: round4(overallRoi),
    overall_win_rate: round2(overallWinRate),
    overall_clv_pct: overallClv !== null ? round4(overallClv) : null,
    band_performance: bandPerformance,
    tier_inversion: tierInversion,
    negative_clv_all_bands: negativeClvAll,
  };
}

// ── Production Readiness ────────────────────────────────────────────────────

/**
 * Determine if the platform is production ready.
 * Fails if ANY critical check (ingestion, scoring, settlement, temporal) fails.
 */
export function determineProductionReadiness(
  ingestion: IngestionHealthResult,
  scoring: ScoringHealthResult,
  promotion: PromotionHealthResult,
  discord: DiscordHealthResult,
  settlement: SettlementHealthResult,
  recap: RecapHealthResult,
  temporal: TemporalHealthResult,
  model: ModelPerformanceResult
): { productionReady: boolean; blockers: string[] } {
  const blockers: string[] = [];

  // Critical checks — must pass
  if (ingestion.status === 'fail') blockers.push('CRITICAL: Ingestion pipeline down');
  if (scoring.status === 'fail') blockers.push('CRITICAL: Scoring pipeline failing');
  if (settlement.status === 'fail') blockers.push('CRITICAL: Settlement stalled');
  if (temporal.status === 'fail') blockers.push('CRITICAL: Temporal workers down');

  // Important checks — warn but don't block
  if (promotion.status === 'fail') blockers.push('Promotion engine not running');
  if (discord.status === 'fail') blockers.push('Discord delivery failing');

  // Advisory checks
  if (recap.status === 'fail') blockers.push('Recap generation missing');
  if (model.status === 'fail') blockers.push('Model performance degraded');

  // Production ready only if no critical blockers
  const criticalBlockers = blockers.filter(b => b.startsWith('CRITICAL:'));
  return {
    productionReady: criticalBlockers.length === 0,
    blockers,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function deriveStatus(hasCritical: boolean, hasWarning: boolean): CheckStatus {
  if (hasCritical) return 'fail';
  if (hasWarning) return 'warn';
  return 'pass';
}

function computeFlatBetRoiPct(outcomes: Array<'WIN' | 'LOSS' | 'PUSH'>): number {
  const nonPush = outcomes.filter(o => o !== 'PUSH');
  if (nonPush.length === 0) return 0;
  const wager = 110;
  let profit = 0;
  for (const o of nonPush) {
    profit += o === 'WIN' ? 100 : -110;
  }
  return (profit / (nonPush.length * wager)) * 100;
}

function hasTierInversion(bands: BandPerformanceMetrics[]): boolean {
  if (bands.length < 2) return false;
  for (let i = 1; i < bands.length; i++) {
    // Allow small tolerance (1pp) for noise
    if (bands[i].roi_pct > bands[i - 1].roi_pct + 1) {
      return true;
    }
  }
  return false;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
