/**
 * Exposure, Correlation, and Drawdown Tests
 * Sprint: SPRINT-RISK-EXPOSURE-CORRELATION
 *
 * Covers:
 * 1. Sport-level exposure caps (ExposureCalculator extension)
 * 2. Correlation detection (CorrelationDetector — same-event, same-participant)
 * 3. Drawdown freeze (DrawdownTracker — daily P&L, freeze trigger/release)
 * 4. Config field integration (new config fields loaded correctly)
 * 5. RiskDecision includes new state fields
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DEFAULT_RISK_CONFIG } from '../types';

import type { RiskEngineConfig, CorrelationState, DrawdownState, ExposureState } from '../types';

// ============================================================================
// Mock Supabase factory
// ============================================================================

function createMockSupabase(overrides: Record<string, any> = {}) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };

  return {
    from: vi.fn().mockReturnValue(chainable),
    _chainable: chainable,
  } as any;
}

// ============================================================================
// 1. ExposureCalculator — Sport-Level Caps
// ============================================================================

describe('ExposureCalculator — sport-level exposure', () => {
  let computeExposure: typeof import('../ExposureCalculator').computeExposure;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../ExposureCalculator');
    computeExposure = mod.computeExposure;
  });

  it('returns exposure_by_sport breakdown', async () => {
    const mockRows = [
      {
        kelly_fraction: 0.05,
        ticket_legs: { event_id: 'evt-1', leg_status: 'pending', events: { sport: 'NBA' } },
      },
      {
        kelly_fraction: 0.08,
        ticket_legs: { event_id: 'evt-2', leg_status: 'pending', events: { sport: 'NBA' } },
      },
      {
        kelly_fraction: 0.04,
        ticket_legs: { event_id: 'evt-3', leg_status: 'pending', events: { sport: 'NFL' } },
      },
    ];

    const supabase = createMockSupabase();
    supabase._chainable.gt.mockResolvedValue({ data: mockRows, error: null });

    const result = await computeExposure(supabase, DEFAULT_RISK_CONFIG);

    expect(result.exposure_by_sport).toBeDefined();
    expect(result.exposure_by_sport['NBA']).toBeCloseTo(0.13, 4);
    expect(result.exposure_by_sport['NFL']).toBeCloseTo(0.04, 4);
  });

  it('detects sport-level breach when exposure exceeds limit', async () => {
    const mockRows = [
      {
        kelly_fraction: 0.25,
        ticket_legs: { event_id: 'evt-1', leg_status: 'pending', events: { sport: 'NBA' } },
      },
      {
        kelly_fraction: 0.2,
        ticket_legs: { event_id: 'evt-2', leg_status: 'pending', events: { sport: 'NBA' } },
      },
    ];

    const config = { ...DEFAULT_RISK_CONFIG, sport_kelly_limit: 0.4 };
    const supabase = createMockSupabase();
    supabase._chainable.gt.mockResolvedValue({ data: mockRows, error: null });

    const result = await computeExposure(supabase, config);

    const sportBreaches = result.breaches.filter(b => b.dimension === 'sport');
    expect(sportBreaches.length).toBe(1);
    expect(sportBreaches[0].key).toBe('NBA');
    expect(sportBreaches[0].current).toBeCloseTo(0.45, 4);
    expect(sportBreaches[0].limit).toBe(0.4);
  });

  it('no sport breach when under limit', async () => {
    const mockRows = [
      {
        kelly_fraction: 0.1,
        ticket_legs: { event_id: 'evt-1', leg_status: 'pending', events: { sport: 'NBA' } },
      },
      {
        kelly_fraction: 0.1,
        ticket_legs: { event_id: 'evt-2', leg_status: 'pending', events: { sport: 'NFL' } },
      },
    ];

    const config = { ...DEFAULT_RISK_CONFIG, sport_kelly_limit: 0.4 };
    const supabase = createMockSupabase();
    supabase._chainable.gt.mockResolvedValue({ data: mockRows, error: null });

    const result = await computeExposure(supabase, config);

    const sportBreaches = result.breaches.filter(b => b.dimension === 'sport');
    expect(sportBreaches.length).toBe(0);
  });

  it('handles empty result set gracefully', async () => {
    const supabase = createMockSupabase();
    supabase._chainable.gt.mockResolvedValue({ data: [], error: null });

    const result = await computeExposure(supabase, DEFAULT_RISK_CONFIG);

    expect(result.exposure_by_sport).toEqual({});
    expect(result.total_kelly_exposure).toBe(0);
    expect(result.breaches.length).toBe(0);
  });

  it('filters non-pending legs', async () => {
    const mockRows = [
      {
        kelly_fraction: 0.5,
        ticket_legs: { event_id: 'evt-1', leg_status: 'win', events: { sport: 'NBA' } },
      },
      {
        kelly_fraction: 0.05,
        ticket_legs: { event_id: 'evt-2', leg_status: 'pending', events: { sport: 'NBA' } },
      },
    ];

    const supabase = createMockSupabase();
    supabase._chainable.gt.mockResolvedValue({ data: mockRows, error: null });

    const result = await computeExposure(supabase, DEFAULT_RISK_CONFIG);

    expect(result.exposure_by_sport['NBA']).toBeCloseTo(0.05, 4);
    expect(result.total_pending_legs).toBe(1);
  });

  it('throws on query error (fail-closed)', async () => {
    const supabase = createMockSupabase();
    supabase._chainable.gt.mockResolvedValue({
      data: null,
      error: { message: 'connection refused' },
    });

    await expect(computeExposure(supabase, DEFAULT_RISK_CONFIG)).rejects.toThrow(
      'ExposureCalculator query failed'
    );
  });

  it('handles missing sport gracefully', async () => {
    const mockRows = [
      {
        kelly_fraction: 0.05,
        ticket_legs: { event_id: 'evt-1', leg_status: 'pending', events: null },
      },
    ];

    const supabase = createMockSupabase();
    supabase._chainable.gt.mockResolvedValue({ data: mockRows, error: null });

    const result = await computeExposure(supabase, DEFAULT_RISK_CONFIG);

    expect(result.total_kelly_exposure).toBeCloseTo(0.05, 4);
    expect(Object.keys(result.exposure_by_sport).length).toBe(0);
  });
});

// ============================================================================
// 2. CorrelationDetector
// ============================================================================

describe('CorrelationDetector', () => {
  let detectCorrelation: typeof import('../CorrelationDetector').detectCorrelation;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../CorrelationDetector');
    detectCorrelation = mod.detectCorrelation;
  });

  it('no clusters when legs are diverse', async () => {
    const mockLegs = [
      { id: 'leg-1', event_id: 'evt-1', participant_id: 'player-1' },
      { id: 'leg-2', event_id: 'evt-2', participant_id: 'player-2' },
      { id: 'leg-3', event_id: 'evt-3', participant_id: 'player-3' },
    ];

    const supabase = createMockSupabase();
    supabase._chainable.eq.mockResolvedValue({ data: mockLegs, error: null });

    const result = await detectCorrelation(supabase, DEFAULT_RISK_CONFIG);

    expect(result.blocked).toBe(false);
    expect(result.clusters.length).toBe(0);
    expect(result.blocked_reasons.length).toBe(0);
  });

  it('detects same-event cluster exceeding limit', async () => {
    // 4 legs on the same event, limit is 3
    const mockLegs = [
      { id: 'leg-1', event_id: 'evt-1', participant_id: 'player-1' },
      { id: 'leg-2', event_id: 'evt-1', participant_id: 'player-2' },
      { id: 'leg-3', event_id: 'evt-1', participant_id: 'player-3' },
      { id: 'leg-4', event_id: 'evt-1', participant_id: 'player-4' },
    ];

    const config = { ...DEFAULT_RISK_CONFIG, correlation_max_same_event: 3 };
    const supabase = createMockSupabase();
    supabase._chainable.eq.mockResolvedValue({ data: mockLegs, error: null });

    const result = await detectCorrelation(supabase, config);

    expect(result.blocked).toBe(true);
    expect(result.clusters.length).toBe(1);
    expect(result.clusters[0].type).toBe('same_event');
    expect(result.clusters[0].key).toBe('evt-1');
    expect(result.clusters[0].count).toBe(4);
    expect(result.clusters[0].limit).toBe(3);
    expect(result.blocked_reasons[0]).toContain('correlation_same_event');
  });

  it('allows same-event at exactly the limit', async () => {
    // 3 legs on same event, limit is 3 — NOT exceeding
    const mockLegs = [
      { id: 'leg-1', event_id: 'evt-1', participant_id: 'player-1' },
      { id: 'leg-2', event_id: 'evt-1', participant_id: 'player-2' },
      { id: 'leg-3', event_id: 'evt-1', participant_id: 'player-3' },
    ];

    const config = { ...DEFAULT_RISK_CONFIG, correlation_max_same_event: 3 };
    const supabase = createMockSupabase();
    supabase._chainable.eq.mockResolvedValue({ data: mockLegs, error: null });

    const result = await detectCorrelation(supabase, config);

    expect(result.blocked).toBe(false);
    expect(result.clusters.length).toBe(0);
  });

  it('detects same-participant cluster exceeding limit', async () => {
    // 3 legs on the same player, limit is 2
    const mockLegs = [
      { id: 'leg-1', event_id: 'evt-1', participant_id: 'player-1' },
      { id: 'leg-2', event_id: 'evt-2', participant_id: 'player-1' },
      { id: 'leg-3', event_id: 'evt-3', participant_id: 'player-1' },
    ];

    const config = { ...DEFAULT_RISK_CONFIG, correlation_max_same_participant: 2 };
    const supabase = createMockSupabase();
    supabase._chainable.eq.mockResolvedValue({ data: mockLegs, error: null });

    const result = await detectCorrelation(supabase, config);

    expect(result.blocked).toBe(true);
    const participantCluster = result.clusters.find(c => c.type === 'same_participant');
    expect(participantCluster).toBeDefined();
    expect(participantCluster!.key).toBe('player-1');
    expect(participantCluster!.count).toBe(3);
  });

  it('detects both event and participant clusters simultaneously', async () => {
    const mockLegs = [
      { id: 'leg-1', event_id: 'evt-1', participant_id: 'player-1' },
      { id: 'leg-2', event_id: 'evt-1', participant_id: 'player-1' },
      { id: 'leg-3', event_id: 'evt-1', participant_id: 'player-1' },
      { id: 'leg-4', event_id: 'evt-1', participant_id: 'player-2' },
    ];

    const config = {
      ...DEFAULT_RISK_CONFIG,
      correlation_max_same_event: 3,
      correlation_max_same_participant: 2,
    };
    const supabase = createMockSupabase();
    supabase._chainable.eq.mockResolvedValue({ data: mockLegs, error: null });

    const result = await detectCorrelation(supabase, config);

    expect(result.blocked).toBe(true);
    expect(result.clusters.length).toBe(2);
    expect(result.blocked_reasons.length).toBe(2);
  });

  it('ignores legs with null event_id or participant_id', async () => {
    const mockLegs = [
      { id: 'leg-1', event_id: null, participant_id: null },
      { id: 'leg-2', event_id: 'evt-1', participant_id: null },
      { id: 'leg-3', event_id: null, participant_id: 'player-1' },
    ];

    const config = {
      ...DEFAULT_RISK_CONFIG,
      correlation_max_same_event: 1,
      correlation_max_same_participant: 1,
    };
    const supabase = createMockSupabase();
    supabase._chainable.eq.mockResolvedValue({ data: mockLegs, error: null });

    const result = await detectCorrelation(supabase, config);

    expect(result.blocked).toBe(false);
  });

  it('handles empty result set', async () => {
    const supabase = createMockSupabase();
    supabase._chainable.eq.mockResolvedValue({ data: [], error: null });

    const result = await detectCorrelation(supabase, DEFAULT_RISK_CONFIG);

    expect(result.blocked).toBe(false);
    expect(result.clusters.length).toBe(0);
  });

  it('throws on query error (fail-closed)', async () => {
    const supabase = createMockSupabase();
    supabase._chainable.eq.mockResolvedValue({
      data: null,
      error: { message: 'connection refused' },
    });

    await expect(detectCorrelation(supabase, DEFAULT_RISK_CONFIG)).rejects.toThrow(
      'CorrelationDetector query failed'
    );
  });

  it('includes leg_ids in cluster for traceability', async () => {
    const mockLegs = [
      { id: 'leg-1', event_id: 'evt-1', participant_id: 'p-1' },
      { id: 'leg-2', event_id: 'evt-1', participant_id: 'p-2' },
      { id: 'leg-3', event_id: 'evt-1', participant_id: 'p-3' },
      { id: 'leg-4', event_id: 'evt-1', participant_id: 'p-4' },
    ];

    const config = { ...DEFAULT_RISK_CONFIG, correlation_max_same_event: 3 };
    const supabase = createMockSupabase();
    supabase._chainable.eq.mockResolvedValue({ data: mockLegs, error: null });

    const result = await detectCorrelation(supabase, config);

    expect(result.clusters[0].leg_ids).toEqual(['leg-1', 'leg-2', 'leg-3', 'leg-4']);
  });
});

// ============================================================================
// 3. DrawdownTracker
// ============================================================================

describe('DrawdownTracker', () => {
  let computeDrawdown: typeof import('../DrawdownTracker').computeDrawdown;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../DrawdownTracker');
    computeDrawdown = mod.computeDrawdown;
  });

  it('no freeze when P&L is positive', async () => {
    const mockLegs = [
      { id: 'l1', leg_status: 'win', scored_legs: [{ kelly_fraction: 0.05, is_latest: true }] },
      { id: 'l2', leg_status: 'win', scored_legs: [{ kelly_fraction: 0.03, is_latest: true }] },
    ];

    const supabase = createMockSupabase();
    supabase._chainable.gte.mockResolvedValue({ data: mockLegs, error: null });

    const result = await computeDrawdown(supabase, DEFAULT_RISK_CONFIG);

    expect(result.frozen).toBe(false);
    expect(result.realized_pnl).toBeGreaterThan(0);
    expect(result.wins).toBe(2);
    expect(result.losses).toBe(0);
    expect(result.drawdown_fraction).toBe(0);
  });

  it('no freeze when losses are under threshold', async () => {
    // Lose 5 units out of 1000 = 0.5% drawdown, threshold is 10%
    const mockLegs = [
      { id: 'l1', leg_status: 'loss', scored_legs: [{ kelly_fraction: 0.005, is_latest: true }] },
      { id: 'l2', leg_status: 'loss', scored_legs: [{ kelly_fraction: 0.005, is_latest: true }] },
    ];

    const config = { ...DEFAULT_RISK_CONFIG, drawdown_freeze_threshold: 0.1, bankroll_total: 1000 };
    const supabase = createMockSupabase();
    supabase._chainable.gte.mockResolvedValue({ data: mockLegs, error: null });

    const result = await computeDrawdown(supabase, config);

    expect(result.frozen).toBe(false);
    expect(result.realized_pnl).toBeLessThan(0);
    expect(result.drawdown_fraction).toBeLessThan(0.1);
  });

  it('triggers freeze when losses exceed threshold', async () => {
    // Lose 120 units out of 1000 = 12% drawdown, threshold is 10%
    const mockLegs = [
      { id: 'l1', leg_status: 'loss', scored_legs: [{ kelly_fraction: 0.06, is_latest: true }] },
      { id: 'l2', leg_status: 'loss', scored_legs: [{ kelly_fraction: 0.06, is_latest: true }] },
    ];

    const config = { ...DEFAULT_RISK_CONFIG, drawdown_freeze_threshold: 0.1, bankroll_total: 1 };
    const supabase = createMockSupabase();
    supabase._chainable.gte.mockResolvedValue({ data: mockLegs, error: null });

    const result = await computeDrawdown(supabase, config);

    expect(result.frozen).toBe(true);
    expect(result.freeze_reason).toContain('exceeds');
    expect(result.drawdown_fraction).toBeGreaterThanOrEqual(0.1);
  });

  it('mixed wins and losses — net negative triggers freeze', async () => {
    // Win 0.02, lose 0.15 = net -0.13. Bankroll=1 → 13% drawdown, threshold 10%
    const mockLegs = [
      { id: 'l1', leg_status: 'win', scored_legs: [{ kelly_fraction: 0.02, is_latest: true }] },
      { id: 'l2', leg_status: 'loss', scored_legs: [{ kelly_fraction: 0.15, is_latest: true }] },
    ];

    const config = { ...DEFAULT_RISK_CONFIG, drawdown_freeze_threshold: 0.1, bankroll_total: 1 };
    const supabase = createMockSupabase();
    supabase._chainable.gte.mockResolvedValue({ data: mockLegs, error: null });

    const result = await computeDrawdown(supabase, config);

    expect(result.frozen).toBe(true);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(1);
    expect(result.realized_pnl).toBeCloseTo(-0.13, 4);
  });

  it('pushes contribute zero P&L', async () => {
    const mockLegs = [
      { id: 'l1', leg_status: 'push', scored_legs: [{ kelly_fraction: 0.1, is_latest: true }] },
      { id: 'l2', leg_status: 'push', scored_legs: [{ kelly_fraction: 0.1, is_latest: true }] },
    ];

    const supabase = createMockSupabase();
    supabase._chainable.gte.mockResolvedValue({ data: mockLegs, error: null });

    const result = await computeDrawdown(supabase, DEFAULT_RISK_CONFIG);

    expect(result.frozen).toBe(false);
    expect(result.realized_pnl).toBe(0);
    expect(result.pushes).toBe(2);
    expect(result.settled_count).toBe(2);
  });

  it('handles empty result set (no settled legs)', async () => {
    const supabase = createMockSupabase();
    supabase._chainable.gte.mockResolvedValue({ data: [], error: null });

    const result = await computeDrawdown(supabase, DEFAULT_RISK_CONFIG);

    expect(result.frozen).toBe(false);
    expect(result.realized_pnl).toBe(0);
    expect(result.settled_count).toBe(0);
    expect(result.drawdown_fraction).toBe(0);
  });

  it('handles legs with no scored_legs (kelly = 0)', async () => {
    const mockLegs = [
      { id: 'l1', leg_status: 'loss', scored_legs: null },
      { id: 'l2', leg_status: 'loss', scored_legs: [] },
    ];

    const supabase = createMockSupabase();
    supabase._chainable.gte.mockResolvedValue({ data: mockLegs, error: null });

    const result = await computeDrawdown(supabase, DEFAULT_RISK_CONFIG);

    expect(result.frozen).toBe(false);
    expect(result.losses).toBe(2);
    expect(result.realized_pnl).toBe(0); // kelly=0 for both
  });

  it('throws on query error (fail-closed)', async () => {
    const supabase = createMockSupabase();
    supabase._chainable.gte.mockResolvedValue({
      data: null,
      error: { message: 'timeout' },
    });

    await expect(computeDrawdown(supabase, DEFAULT_RISK_CONFIG)).rejects.toThrow(
      'DrawdownTracker query failed'
    );
  });

  it('freeze at exact threshold boundary', async () => {
    // Exactly 10% drawdown with threshold at 10% — should freeze (>= threshold)
    const mockLegs = [
      { id: 'l1', leg_status: 'loss', scored_legs: [{ kelly_fraction: 0.1, is_latest: true }] },
    ];

    const config = { ...DEFAULT_RISK_CONFIG, drawdown_freeze_threshold: 0.1, bankroll_total: 1 };
    const supabase = createMockSupabase();
    supabase._chainable.gte.mockResolvedValue({ data: mockLegs, error: null });

    const result = await computeDrawdown(supabase, config);

    expect(result.frozen).toBe(true);
    expect(result.drawdown_fraction).toBeCloseTo(0.1, 4);
  });

  it('uses lookback_days for query window', async () => {
    const config = { ...DEFAULT_RISK_CONFIG, drawdown_lookback_days: 7 };
    const supabase = createMockSupabase();
    supabase._chainable.gte.mockResolvedValue({ data: [], error: null });

    const result = await computeDrawdown(supabase, config);

    expect(result.lookback_days).toBe(7);
    // Verify gte was called with a date (the lookback window)
    expect(supabase._chainable.gte).toHaveBeenCalled();
  });
});

// ============================================================================
// 4. Config Defaults
// ============================================================================

describe('DEFAULT_RISK_CONFIG — new fields', () => {
  it('has sport_kelly_limit', () => {
    expect(DEFAULT_RISK_CONFIG.sport_kelly_limit).toBe(0.4);
  });

  it('has correlation_max_same_event', () => {
    expect(DEFAULT_RISK_CONFIG.correlation_max_same_event).toBe(3);
  });

  it('has correlation_max_same_participant', () => {
    expect(DEFAULT_RISK_CONFIG.correlation_max_same_participant).toBe(2);
  });

  it('has drawdown_freeze_threshold', () => {
    expect(DEFAULT_RISK_CONFIG.drawdown_freeze_threshold).toBe(0.1);
  });

  it('has drawdown_lookback_days', () => {
    expect(DEFAULT_RISK_CONFIG.drawdown_lookback_days).toBe(1);
  });
});

// ============================================================================
// 5. Type Shape Validation
// ============================================================================

describe('Type shapes', () => {
  it('ExposureBreach accepts sport dimension', () => {
    const breach: import('../types').ExposureBreach = {
      dimension: 'sport',
      key: 'NBA',
      current: 0.5,
      limit: 0.4,
      severity: 'high',
    };
    expect(breach.dimension).toBe('sport');
  });

  it('CorrelationState shape', () => {
    const state: CorrelationState = {
      clusters: [
        { type: 'same_event', key: 'evt-1', count: 4, limit: 3, leg_ids: ['a', 'b', 'c', 'd'] },
      ],
      blocked: true,
      blocked_reasons: ['correlation_same_event:evt-1:4>3'],
      computed_at: new Date().toISOString(),
    };
    expect(state.blocked).toBe(true);
    expect(state.clusters[0].type).toBe('same_event');
  });

  it('DrawdownState shape', () => {
    const state: DrawdownState = {
      realized_pnl: -50,
      settled_count: 10,
      wins: 3,
      losses: 7,
      pushes: 0,
      drawdown_fraction: 0.05,
      frozen: false,
      freeze_reason: null,
      lookback_days: 1,
      computed_at: new Date().toISOString(),
    };
    expect(state.frozen).toBe(false);
    expect(state.realized_pnl).toBe(-50);
  });

  it('RiskDecision includes correlation_state and drawdown_state', () => {
    const decision: import('../types').RiskDecision = {
      allowed: true,
      decision: 'ALLOW',
      blocked_reasons: [],
      warnings: [],
      exposure_state: null,
      drift_state: null,
      correlation_state: null,
      drawdown_state: null,
      sizing: null,
      trace_id: 'test',
    };
    expect(decision.correlation_state).toBeNull();
    expect(decision.drawdown_state).toBeNull();
  });
});
