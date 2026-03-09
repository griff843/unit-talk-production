/**
 * Platform Validation Tests — SPRINT-041A
 *
 * Tests for all 8 operational health checks + production readiness + deterministic output.
 * Minimum 25 tests required.
 */

import { describe, it, expect } from 'vitest';

import {
  checkIngestionHealth,
  checkScoringHealth,
  checkPromotionHealth,
  checkDiscordHealth,
  checkSettlementHealth,
  checkRecapHealth,
  checkTemporalHealth,
  checkModelPerformance,
  determineProductionReadiness,
} from '../platform-validation-report';
import { generatePlatformValidationReport } from '../platform-validation-runner';
import { PLATFORM_VALIDATION_VERSION } from '../platform-validation-types';

import type { PlatformValidationInput } from '../platform-validation-runner';
import type {
  IngestionSnapshot,
  ScoringSnapshot,
  PromotionSnapshot,
  DiscordSnapshot,
  SettlementSnapshot,
  RecapSnapshot,
  TemporalSnapshot,
  PerformanceRecord,
} from '../platform-validation-types';

// ── Healthy Defaults ────────────────────────────────────────────────────────

function healthyIngestion(overrides: Partial<IngestionSnapshot> = {}): IngestionSnapshot {
  return {
    props_ingested_last_24h: 150,
    props_ingested_last_48h: 300,
    distinct_games: 12,
    distinct_books: 5,
    newest_prop_age_minutes: 15,
    ...overrides,
  };
}

function healthyScoring(overrides: Partial<ScoringSnapshot> = {}): ScoringSnapshot {
  return {
    total_props_last_24h: 150,
    scored_props_last_24h: 145,
    props_missing_p_final: 0,
    props_missing_edge: 0,
    props_missing_tier: 0,
    average_edge: 0.04,
    average_uncertainty: 0.12,
    ...overrides,
  };
}

function healthyPromotion(overrides: Partial<PromotionSnapshot> = {}): PromotionSnapshot {
  return {
    promoted_last_24h: 30,
    band_distribution: { 'A+': 3, A: 8, B: 12, C: 5, SUPPRESS: 4 },
    total_evaluated: 32,
    downgraded_count: 4,
    suppressed_count: 4,
    ...overrides,
  };
}

function healthyDiscord(overrides: Partial<DiscordSnapshot> = {}): DiscordSnapshot {
  return {
    alerts_sent_last_24h: 28,
    pending_messages: 0,
    failed_messages: 0,
    oldest_pending_age_minutes: null,
    ...overrides,
  };
}

function healthySettlement(overrides: Partial<SettlementSnapshot> = {}): SettlementSnapshot {
  return {
    unsettled_picks: 10,
    settlements_last_24h: 25,
    avg_settlement_delay_minutes: 120,
    disputed_count: 0,
    oldest_unsettled_age_hours: 6,
    ...overrides,
  };
}

function healthyRecap(overrides: Partial<RecapSnapshot> = {}): RecapSnapshot {
  return {
    daily_recaps_last_7_days: 7,
    last_recap_timestamp: '2026-03-06T08:00:00Z',
    last_recap_age_hours: 4,
    ...overrides,
  };
}

function healthyTemporal(overrides: Partial<TemporalSnapshot> = {}): TemporalSnapshot {
  return {
    active_schedules: 5,
    worker_heartbeat_age_seconds: 10,
    workflow_backlog: 0,
    failed_workflows_last_24h: 0,
    ...overrides,
  };
}

function makePerformanceRecords(): PerformanceRecord[] {
  return [
    // A+: 3W, 1L (strong)
    { finalBand: 'A+', outcome: 'WIN', p_final: 0.6, edge_final: 0.1, clvPercent: 0.05 },
    { finalBand: 'A+', outcome: 'WIN', p_final: 0.62, edge_final: 0.09, clvPercent: 0.03 },
    { finalBand: 'A+', outcome: 'WIN', p_final: 0.58, edge_final: 0.08, clvPercent: 0.04 },
    { finalBand: 'A+', outcome: 'LOSS', p_final: 0.55, edge_final: 0.08, clvPercent: -0.01 },
    // A: 3W, 2L (decent)
    { finalBand: 'A', outcome: 'WIN', p_final: 0.55, edge_final: 0.06, clvPercent: 0.02 },
    { finalBand: 'A', outcome: 'WIN', p_final: 0.54, edge_final: 0.05, clvPercent: 0.01 },
    { finalBand: 'A', outcome: 'WIN', p_final: 0.56, edge_final: 0.07, clvPercent: 0.03 },
    { finalBand: 'A', outcome: 'LOSS', p_final: 0.53, edge_final: 0.04, clvPercent: -0.02 },
    { finalBand: 'A', outcome: 'LOSS', p_final: 0.52, edge_final: 0.03, clvPercent: -0.01 },
    // B: 2W, 3L (marginal)
    { finalBand: 'B', outcome: 'WIN', p_final: 0.51, edge_final: 0.04, clvPercent: 0.01 },
    { finalBand: 'B', outcome: 'WIN', p_final: 0.5, edge_final: 0.03, clvPercent: 0.005 },
    { finalBand: 'B', outcome: 'LOSS', p_final: 0.49, edge_final: 0.03, clvPercent: -0.02 },
    { finalBand: 'B', outcome: 'LOSS', p_final: 0.48, edge_final: 0.02, clvPercent: -0.03 },
    { finalBand: 'B', outcome: 'LOSS', p_final: 0.47, edge_final: 0.02, clvPercent: -0.01 },
    // C: 1W, 3L (weak)
    { finalBand: 'C', outcome: 'WIN', p_final: 0.48, edge_final: 0.02, clvPercent: 0.005 },
    { finalBand: 'C', outcome: 'LOSS', p_final: 0.46, edge_final: 0.015, clvPercent: -0.03 },
    { finalBand: 'C', outcome: 'LOSS', p_final: 0.45, edge_final: 0.015, clvPercent: -0.04 },
    { finalBand: 'C', outcome: 'LOSS', p_final: 0.44, edge_final: 0.01, clvPercent: -0.05 },
  ];
}

function healthyInput(): PlatformValidationInput {
  return {
    ingestion: healthyIngestion(),
    scoring: healthyScoring(),
    promotion: healthyPromotion(),
    discord: healthyDiscord(),
    settlement: healthySettlement(),
    recap: healthyRecap(),
    temporal: healthyTemporal(),
    performanceRecords: makePerformanceRecords(),
  };
}

// ── CHECK 1: Ingestion Health ───────────────────────────────────────────────

describe('checkIngestionHealth', () => {
  it('should pass for healthy ingestion', () => {
    const result = checkIngestionHealth(healthyIngestion());
    expect(result.status).toBe('pass');
    expect(result.ingestion_halted).toBe(false);
    expect(result.stale_data).toBe(false);
    expect(result.issues).toHaveLength(0);
  });

  it('should fail when ingestion halted', () => {
    const result = checkIngestionHealth(healthyIngestion({ props_ingested_last_24h: 0 }));
    expect(result.status).toBe('fail');
    expect(result.ingestion_halted).toBe(true);
  });

  it('should warn on stale data', () => {
    const result = checkIngestionHealth(healthyIngestion({ newest_prop_age_minutes: 180 }));
    expect(result.status).toBe('warn');
    expect(result.stale_data).toBe(true);
  });

  it('should warn when no books found', () => {
    const result = checkIngestionHealth(healthyIngestion({ distinct_books: 0 }));
    expect(result.status).toBe('warn');
    expect(result.issues).toContain('No distinct books found in recent data');
  });
});

// ── CHECK 2: Scoring Health ─────────────────────────────────────────────────

describe('checkScoringHealth', () => {
  it('should pass for healthy scoring', () => {
    const result = checkScoringHealth(healthyScoring());
    expect(result.status).toBe('pass');
    expect(result.percent_scored).toBeGreaterThan(90);
    expect(result.scoring_failures).toBe(false);
  });

  it('should fail when scoring rate below threshold', () => {
    const result = checkScoringHealth(
      healthyScoring({ scored_props_last_24h: 50, total_props_last_24h: 150 })
    );
    expect(result.status).toBe('fail');
    expect(result.scoring_failures).toBe(true);
    expect(result.percent_scored).toBeCloseTo(33.33, 1);
  });

  it('should warn when props missing p_final', () => {
    const result = checkScoringHealth(healthyScoring({ props_missing_p_final: 5 }));
    expect(result.status).toBe('warn');
    expect(result.missing_probability).toBe(true);
  });

  it('should handle zero total props gracefully', () => {
    const result = checkScoringHealth(
      healthyScoring({ total_props_last_24h: 0, scored_props_last_24h: 0 })
    );
    expect(result.percent_scored).toBe(0);
    expect(result.scoring_failures).toBe(false);
  });
});

// ── CHECK 3: Promotion Health ───────────────────────────────────────────────

describe('checkPromotionHealth', () => {
  it('should pass for healthy promotion', () => {
    const result = checkPromotionHealth(healthyPromotion());
    expect(result.status).toBe('pass');
    expect(result.promotion_halted).toBe(false);
    expect(result.bands_collapsed).toBe(false);
  });

  it('should fail when promotion halted', () => {
    const result = checkPromotionHealth(healthyPromotion({ promoted_last_24h: 0 }));
    expect(result.status).toBe('fail');
    expect(result.promotion_halted).toBe(true);
  });

  it('should detect collapsed band distribution', () => {
    const result = checkPromotionHealth(
      healthyPromotion({
        band_distribution: { 'A+': 0, A: 25, B: 2, C: 1, SUPPRESS: 2 },
        total_evaluated: 30,
      })
    );
    expect(result.bands_collapsed).toBe(true);
  });

  it('should compute suppression and downgrade rates', () => {
    const result = checkPromotionHealth(healthyPromotion());
    expect(result.suppression_rate).toBeCloseTo(12.5, 1); // 4/32 = 12.5%
    expect(result.downgrade_rate).toBeCloseTo(12.5, 1);
  });
});

// ── CHECK 4: Discord Health ─────────────────────────────────────────────────

describe('checkDiscordHealth', () => {
  it('should pass for healthy discord delivery', () => {
    const result = checkDiscordHealth(healthyDiscord());
    expect(result.status).toBe('pass');
    expect(result.stuck_outbox).toBe(false);
    expect(result.delivery_failures).toBe(false);
  });

  it('should fail on stuck outbox', () => {
    const result = checkDiscordHealth(
      healthyDiscord({ oldest_pending_age_minutes: 60, pending_messages: 5 })
    );
    expect(result.status).toBe('fail');
    expect(result.stuck_outbox).toBe(true);
  });

  it('should warn on failed deliveries', () => {
    const result = checkDiscordHealth(healthyDiscord({ failed_messages: 3 }));
    expect(result.status).toBe('warn');
    expect(result.delivery_failures).toBe(true);
  });
});

// ── CHECK 5: Settlement Health ──────────────────────────────────────────────

describe('checkSettlementHealth', () => {
  it('should pass for healthy settlement', () => {
    const result = checkSettlementHealth(healthySettlement());
    expect(result.status).toBe('pass');
    expect(result.settlement_backlog).toBe(false);
    expect(result.grading_stalled).toBe(false);
  });

  it('should fail when grading stalled', () => {
    const result = checkSettlementHealth(
      healthySettlement({ settlements_last_24h: 0, unsettled_picks: 20 })
    );
    expect(result.status).toBe('fail');
    expect(result.grading_stalled).toBe(true);
  });

  it('should detect settlement backlog', () => {
    const result = checkSettlementHealth(
      healthySettlement({ unsettled_picks: 100, oldest_unsettled_age_hours: 72 })
    );
    expect(result.settlement_backlog).toBe(true);
  });

  it('should warn on disputed settlements', () => {
    const result = checkSettlementHealth(healthySettlement({ disputed_count: 3 }));
    expect(result.issues.some(i => i.includes('disputed'))).toBe(true);
  });
});

// ── CHECK 6: Recap Health ───────────────────────────────────────────────────

describe('checkRecapHealth', () => {
  it('should pass for healthy recap', () => {
    const result = checkRecapHealth(healthyRecap());
    expect(result.status).toBe('pass');
    expect(result.recap_running).toBe(true);
  });

  it('should warn when recaps missing', () => {
    const result = checkRecapHealth(healthyRecap({ daily_recaps_last_7_days: 3 }));
    expect(result.status).toBe('warn');
    expect(result.recap_running).toBe(false);
  });

  it('should warn when recap is stale', () => {
    const result = checkRecapHealth(healthyRecap({ last_recap_age_hours: 48 }));
    expect(result.status).toBe('warn');
    expect(result.recap_running).toBe(false);
  });
});

// ── CHECK 7: Temporal Health ────────────────────────────────────────────────

describe('checkTemporalHealth', () => {
  it('should pass for healthy temporal', () => {
    const result = checkTemporalHealth(healthyTemporal());
    expect(result.status).toBe('pass');
    expect(result.worker_responsive).toBe(true);
    expect(result.worker_stopped).toBe(false);
  });

  it('should fail when worker stopped', () => {
    const result = checkTemporalHealth(healthyTemporal({ worker_heartbeat_age_seconds: 300 }));
    expect(result.status).toBe('fail');
    expect(result.worker_stopped).toBe(true);
    expect(result.worker_responsive).toBe(false);
  });

  it('should warn on failed workflows', () => {
    const result = checkTemporalHealth(healthyTemporal({ failed_workflows_last_24h: 2 }));
    expect(result.status).toBe('warn');
    expect(result.schedule_failures).toBe(true);
  });

  it('should warn when no active schedules', () => {
    const result = checkTemporalHealth(healthyTemporal({ active_schedules: 0 }));
    expect(result.status).toBe('warn');
    expect(result.issues.some(i => i.includes('No active'))).toBe(true);
  });
});

// ── CHECK 8: Model Performance ──────────────────────────────────────────────

describe('checkModelPerformance', () => {
  it('should compute overall metrics', () => {
    const result = checkModelPerformance(makePerformanceRecords());
    expect(result.total_picks).toBe(18);
    expect(result.overall_win_rate).toBeGreaterThan(0);
    expect(result.band_performance).toHaveLength(4);
  });

  it('should report A+ ROI higher than C ROI', () => {
    const result = checkModelPerformance(makePerformanceRecords());
    const aPlus = result.band_performance.find(b => b.band === 'A+')!;
    const c = result.band_performance.find(b => b.band === 'C')!;
    expect(aPlus.roi_pct).toBeGreaterThan(c.roi_pct);
  });

  it('should detect tier inversion', () => {
    // C outperforms A+ significantly
    const invertedRecords: PerformanceRecord[] = [
      { finalBand: 'A+', outcome: 'LOSS', p_final: 0.6, edge_final: 0.1, clvPercent: -0.05 },
      { finalBand: 'A+', outcome: 'LOSS', p_final: 0.6, edge_final: 0.1, clvPercent: -0.05 },
      { finalBand: 'C', outcome: 'WIN', p_final: 0.5, edge_final: 0.02, clvPercent: 0.03 },
      { finalBand: 'C', outcome: 'WIN', p_final: 0.5, edge_final: 0.02, clvPercent: 0.03 },
    ];
    const result = checkModelPerformance(invertedRecords);
    expect(result.tier_inversion).toBe(true);
  });

  it('should detect negative CLV across all bands', () => {
    const negativeCLV: PerformanceRecord[] = [
      { finalBand: 'A+', outcome: 'WIN', p_final: 0.6, edge_final: 0.1, clvPercent: -0.01 },
      { finalBand: 'A', outcome: 'WIN', p_final: 0.55, edge_final: 0.05, clvPercent: -0.02 },
      { finalBand: 'B', outcome: 'WIN', p_final: 0.5, edge_final: 0.03, clvPercent: -0.03 },
      { finalBand: 'C', outcome: 'WIN', p_final: 0.48, edge_final: 0.02, clvPercent: -0.04 },
    ];
    const result = checkModelPerformance(negativeCLV);
    expect(result.negative_clv_all_bands).toBe(true);
  });

  it('should handle empty records', () => {
    const result = checkModelPerformance([]);
    expect(result.status).toBe('warn');
    expect(result.total_picks).toBe(0);
    expect(result.band_performance).toHaveLength(0);
  });
});

// ── Production Readiness ────────────────────────────────────────────────────

describe('determineProductionReadiness', () => {
  it('should be production ready when all checks pass', () => {
    const input = healthyInput();
    const report = generatePlatformValidationReport(input, '2026-03-06T12:00:00Z');
    expect(report.productionReady).toBe(true);
    expect(report.blockers).toHaveLength(0);
  });

  it('should block production on ingestion failure', () => {
    const input = healthyInput();
    input.ingestion.props_ingested_last_24h = 0;
    const report = generatePlatformValidationReport(input, '2026-03-06T12:00:00Z');
    expect(report.productionReady).toBe(false);
    expect(report.blockers.some(b => b.includes('Ingestion'))).toBe(true);
  });

  it('should block production on temporal worker failure', () => {
    const input = healthyInput();
    input.temporal.worker_heartbeat_age_seconds = 300;
    const report = generatePlatformValidationReport(input, '2026-03-06T12:00:00Z');
    expect(report.productionReady).toBe(false);
    expect(report.blockers.some(b => b.includes('Temporal'))).toBe(true);
  });
});

// ── Deterministic Report ────────────────────────────────────────────────────

describe('generatePlatformValidationReport', () => {
  it('should produce a complete report with all 8 sections', () => {
    const report = generatePlatformValidationReport(healthyInput(), '2026-03-06T12:00:00Z');

    expect(report.report_version).toBe(PLATFORM_VALIDATION_VERSION);
    expect(report.generated_at).toBe('2026-03-06T12:00:00Z');
    expect(report.ingestionHealth).toBeDefined();
    expect(report.scoringHealth).toBeDefined();
    expect(report.promotionHealth).toBeDefined();
    expect(report.discordHealth).toBeDefined();
    expect(report.settlementHealth).toBeDefined();
    expect(report.recapHealth).toBeDefined();
    expect(report.temporalHealth).toBeDefined();
    expect(report.modelPerformance).toBeDefined();
    expect(typeof report.productionReady).toBe('boolean');
  });

  it('should be deterministic given the same inputs', () => {
    const input = healthyInput();
    const ts = '2026-03-06T12:00:00Z';

    const report1 = generatePlatformValidationReport(input, ts);
    const report2 = generatePlatformValidationReport(input, ts);

    expect(report1).toEqual(report2);
  });

  it('should list blockers for all failing checks', () => {
    const input = healthyInput();
    input.ingestion.props_ingested_last_24h = 0;
    input.scoring.scored_props_last_24h = 10;
    input.scoring.total_props_last_24h = 150;

    const report = generatePlatformValidationReport(input, '2026-03-06T12:00:00Z');
    expect(report.productionReady).toBe(false);
    expect(report.blockers.length).toBeGreaterThanOrEqual(2);
  });
});
