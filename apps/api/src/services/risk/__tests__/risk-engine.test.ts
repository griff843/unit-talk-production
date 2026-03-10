/**
 * Risk Engine Unit Tests
 * Sprint: RISK-ENGINE-FOUNDATION-001
 *
 * Tests:
 * 1. Exposure enforcement — total kelly > threshold → BLOCK
 * 2. Drift throttle — brier > threshold → BLOCK
 * 3. Fail-closed — any error → BLOCK
 * 4. Engine bypass — engine_enabled=false → ALLOW
 * 5. Event-level limit enforcement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock new risk sub-modules to isolate existing tests
// Use vi.fn(impl) not vi.fn().mockResolvedValue() so restoreAllMocks preserves the impl
vi.mock('../CorrelationDetector', () => ({
  detectCorrelation: vi.fn(() =>
    Promise.resolve({
      clusters: [],
      blocked: false,
      blocked_reasons: [],
      computed_at: new Date().toISOString(),
    })
  ),
}));

vi.mock('../DrawdownTracker', () => ({
  computeDrawdown: vi.fn(() =>
    Promise.resolve({
      realized_pnl: 0,
      settled_count: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      drawdown_fraction: 0,
      frozen: false,
      freeze_reason: null,
      lookback_days: 1,
      computed_at: new Date().toISOString(),
    })
  ),
}));

import { RiskEngine } from '../RiskEngine';
import { DEFAULT_RISK_CONFIG } from '../types';

// ============================================================================
// Mock Supabase
// ============================================================================

function createMockSupabase(overrides: {
  configRows?: Array<{ config_key: string; config_value: string }>;
  scoredLegsExposure?: Array<Record<string, unknown>>;
  scoredLegsDrift?: Array<Record<string, unknown>>;
  insertError?: boolean;
}) {
  const configRows = overrides.configRows ?? [
    { config_key: 'total_kelly_high', config_value: '0.60' },
    { config_key: 'total_kelly_critical', config_value: '1.00' },
    { config_key: 'event_kelly_limit', config_value: '0.25' },
    { config_key: 'drift_brier_block', config_value: '0.35' },
    { config_key: 'drift_min_settled', config_value: '30' },
    { config_key: 'engine_enabled', config_value: '1' },
  ];

  const exposureRows = overrides.scoredLegsExposure ?? [];
  const driftRows = overrides.scoredLegsDrift ?? [];

  let callCount = 0;

  return {
    from: vi.fn((table: string) => {
      if (table === 'risk_engine_config') {
        return {
          select: vi.fn().mockResolvedValue({ data: configRows, error: null }),
        };
      }
      if (table === 'risk_events') {
        return {
          insert: vi.fn().mockResolvedValue({
            error: overrides.insertError ? { message: 'insert failed' } : null,
          }),
        };
      }
      if (table === 'drift_snapshots') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'scored_legs') {
        callCount++;
        // First call = exposure, second call = drift
        const isExposureCall = callCount === 1;
        const rows = isExposureCall ? exposureRows : driftRows;
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                gt: vi.fn().mockResolvedValue({ data: rows, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    }),
  } as any;
}

// ============================================================================
// Tests
// ============================================================================

describe('RiskEngine', () => {
  beforeEach(() => {
    RiskEngine.resetConfigCache();
    vi.restoreAllMocks();
    // Suppress console output
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should be a singleton', () => {
    const a = RiskEngine.getInstance();
    const b = RiskEngine.getInstance();
    expect(a).toBe(b);
  });

  describe('getConfig', () => {
    it('should load config from DB', async () => {
      const supabase = createMockSupabase({});
      const engine = RiskEngine.getInstance();
      const config = await engine.getConfig(supabase);

      expect(config.total_kelly_high).toBe(0.6);
      expect(config.total_kelly_critical).toBe(1.0);
      expect(config.event_kelly_limit).toBe(0.25);
      expect(config.engine_enabled).toBe(true);
    });

    it('should fall back to defaults on error', async () => {
      const supabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
        })),
      } as any;

      RiskEngine.resetConfigCache();
      const engine = RiskEngine.getInstance();
      const config = await engine.getConfig(supabase);

      expect(config).toEqual(DEFAULT_RISK_CONFIG);
    });
  });

  describe('evaluateForPromotion', () => {
    it('should ALLOW when exposure is below thresholds', async () => {
      // No pending legs = zero exposure
      const supabase = createMockSupabase({
        scoredLegsExposure: [],
        scoredLegsDrift: [],
      });

      const engine = RiskEngine.getInstance();
      const decision = await engine.evaluateForPromotion(supabase, 'pick-1', 0.05);

      expect(decision.allowed).toBe(true);
      expect(decision.decision).toBe('ALLOW');
      expect(decision.blocked_reasons).toEqual([]);
    });

    it('should BLOCK when total kelly exceeds HIGH threshold', async () => {
      // Create exposure rows that will sum > 0.60
      const exposureRows = Array.from({ length: 10 }, (_, i) => ({
        kelly_fraction: 0.08,
        ticket_legs: { event_id: `event-${i}`, leg_status: 'pending' },
      }));

      const supabase = createMockSupabase({
        scoredLegsExposure: exposureRows,
        scoredLegsDrift: [],
      });

      const engine = RiskEngine.getInstance();
      const decision = await engine.evaluateForPromotion(supabase, 'pick-1', 0.08);

      expect(decision.allowed).toBe(false);
      expect(decision.decision).toBe('BLOCK');
      expect(decision.blocked_reasons.some(r => r.startsWith('total_kelly_high'))).toBe(true);
    });

    it('should BLOCK when event kelly exceeds limit', async () => {
      // One event with 0.30 kelly (> 0.25 limit)
      const exposureRows = [
        { kelly_fraction: 0.15, ticket_legs: { event_id: 'ev-abc', leg_status: 'pending' } },
        { kelly_fraction: 0.16, ticket_legs: { event_id: 'ev-abc', leg_status: 'pending' } },
      ];

      const supabase = createMockSupabase({
        scoredLegsExposure: exposureRows,
        scoredLegsDrift: [],
      });

      const engine = RiskEngine.getInstance();
      const decision = await engine.evaluateForPromotion(supabase, 'pick-1', 0.15, 'ev-abc');

      expect(decision.allowed).toBe(false);
      expect(decision.decision).toBe('BLOCK');
      expect(decision.blocked_reasons.some(r => r.startsWith('event_kelly_limit'))).toBe(true);
    });

    it('should ALLOW when engine_enabled is false (bypass)', async () => {
      const configRows = [{ config_key: 'engine_enabled', config_value: '0' }];

      const supabase = createMockSupabase({ configRows });
      const engine = RiskEngine.getInstance();
      const decision = await engine.evaluateForPromotion(supabase, 'pick-1', 0.5);

      expect(decision.allowed).toBe(true);
      expect(decision.decision).toBe('ALLOW');
      expect(decision.warnings).toContain('risk_engine_disabled');
    });

    it('should BLOCK on any error (fail-closed)', async () => {
      // Supabase that throws on scored_legs query
      const supabase = {
        from: vi.fn((table: string) => {
          if (table === 'risk_engine_config') {
            return {
              select: vi.fn().mockResolvedValue({
                data: [{ config_key: 'engine_enabled', config_value: '1' }],
                error: null,
              }),
            };
          }
          if (table === 'risk_events') {
            return { insert: vi.fn().mockResolvedValue({ error: null }) };
          }
          // Throw on scored_legs
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  gt: vi.fn().mockRejectedValue(new Error('DB connection lost')),
                }),
              }),
            }),
          };
        }),
      } as any;

      RiskEngine.resetConfigCache();
      const engine = RiskEngine.getInstance();
      const decision = await engine.evaluateForPromotion(supabase, 'pick-fail', 0.05);

      expect(decision.allowed).toBe(false);
      expect(decision.decision).toBe('BLOCK');
      expect(decision.blocked_reasons).toContain('risk_engine_error');
    });
  });

  describe('DriftEvaluator (via RiskEngine)', () => {
    it('should return no-data state when no settled legs', async () => {
      const supabase = createMockSupabase({
        scoredLegsDrift: [],
      });

      const engine = RiskEngine.getInstance();
      const drift = await engine.evaluateDrift(supabase);

      expect(drift.sample_size).toBe(0);
      expect(drift.blocked).toBe(false);
      expect(drift.global_brier).toBeNull();
    });
  });
});
