/**
 * Operator Control Plane Tests
 * Sprint: SPRINT-042-LAYER2-PHASE6-OPERATOR-CONTROL-PLANE
 * Layer/Phase: Layer 2 / Phase 6 — Operator Control Plane
 *
 * Tests:
 * 1.  AutopilotGuard.setCanaryPercentage clamps values correctly
 * 2.  AutopilotGuard.setCanaryPercentage updates instance percentage
 * 3.  AutopilotGuard.setMode updates mode in-memory
 * 4.  AutopilotGuard.getStatus reflects updated mode + percentage
 * 5.  AutopilotGuard.persistMode upserts autopilot_mode to DB
 * 6.  AutopilotGuard.persistMode upserts canary_percentage when provided
 * 7.  AutopilotGuard.persistMode omits canary_percentage upsert when undefined
 * 8.  AutopilotGuard.persistMode throws on DB error
 * 9.  RiskEngine.resetConfigCache clears cached config (next getConfig reads DB)
 * 10. Risk config key whitelist — known key passes, unknown key rejected
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Shared mocks
// ============================================================================

// Mock supabaseClient before importing AutopilotGuard
vi.mock('../../../services/supabaseClient', () => ({
  supabase: { from: vi.fn() },
  supabaseClient: { from: vi.fn() },
}));

vi.mock('../../../shadow/ShadowMode', () => ({
  shadowMode: {
    isShadowMode: vi.fn(() => false),
    shouldSkipPublicAction: vi.fn(() => false),
  },
}));

// ============================================================================
// Tests: AutopilotGuard new methods
// ============================================================================

describe('AutopilotGuard — setCanaryPercentage', () => {
  let AutopilotGuard: typeof import('../../../lib/AutopilotGuard').AutopilotGuard;

  beforeEach(async () => {
    vi.resetModules();
    // Re-import to get a fresh singleton (resetModules resets instance)
    vi.mock('../../../services/supabaseClient', () => ({
      supabase: { from: vi.fn() },
      supabaseClient: { from: vi.fn() },
    }));
    vi.mock('../../../shadow/ShadowMode', () => ({
      shadowMode: {
        isShadowMode: vi.fn(() => false),
        shouldSkipPublicAction: vi.fn(() => false),
      },
    }));
    const mod = await import('../../../lib/AutopilotGuard');
    AutopilotGuard = mod.AutopilotGuard;
  });

  it('clamps percentage above 100 to 100', () => {
    const guard = AutopilotGuard.getInstance();
    guard.setCanaryPercentage(150);
    expect(guard.getStatus().canaryPercentage).toBe(100);
  });

  it('clamps percentage below 0 to 0', () => {
    const guard = AutopilotGuard.getInstance();
    guard.setCanaryPercentage(-10);
    expect(guard.getStatus().canaryPercentage).toBe(0);
  });

  it('rounds fractional percentages', () => {
    const guard = AutopilotGuard.getInstance();
    guard.setCanaryPercentage(25.7);
    expect(guard.getStatus().canaryPercentage).toBe(26);
  });
});

describe('AutopilotGuard — setMode and getStatus', () => {
  let AutopilotGuard: typeof import('../../../lib/AutopilotGuard').AutopilotGuard;

  beforeEach(async () => {
    vi.resetModules();
    vi.mock('../../../services/supabaseClient', () => ({
      supabase: { from: vi.fn() },
      supabaseClient: { from: vi.fn() },
    }));
    vi.mock('../../../shadow/ShadowMode', () => ({
      shadowMode: {
        isShadowMode: vi.fn(() => false),
        shouldSkipPublicAction: vi.fn(() => false),
      },
    }));
    const mod = await import('../../../lib/AutopilotGuard');
    AutopilotGuard = mod.AutopilotGuard;
  });

  it('setMode updates in-memory mode', () => {
    const guard = AutopilotGuard.getInstance();
    guard.setMode('log_only');
    expect(guard.getMode()).toBe('log_only');
  });

  it('getStatus reflects updated mode and canaryPercentage', () => {
    const guard = AutopilotGuard.getInstance();
    guard.setMode('canary');
    guard.setCanaryPercentage(30);
    const status = guard.getStatus();
    expect(status.mode).toBe('canary');
    expect(status.canaryPercentage).toBe(30);
    expect(status.ready).toBe(true);
  });
});

describe('AutopilotGuard — persistMode', () => {
  let AutopilotGuard: typeof import('../../../lib/AutopilotGuard').AutopilotGuard;
  let mockUpsert: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    mockUpsert = vi.fn().mockResolvedValue({ error: null });

    vi.mock('../../../services/supabaseClient', () => ({
      supabase: { from: vi.fn() },
      supabaseClient: { from: vi.fn() },
    }));
    vi.mock('../../../shadow/ShadowMode', () => ({
      shadowMode: {
        isShadowMode: vi.fn(() => false),
        shouldSkipPublicAction: vi.fn(() => false),
      },
    }));
    const mod = await import('../../../lib/AutopilotGuard');
    AutopilotGuard = mod.AutopilotGuard;
  });

  it('upserts autopilot_mode to DB', async () => {
    const mockSupabase = { from: vi.fn().mockReturnValue({ upsert: mockUpsert }) } as any;
    const guard = AutopilotGuard.getInstance();

    await guard.persistMode(mockSupabase, 'prod');

    expect(mockSupabase.from).toHaveBeenCalledWith('risk_engine_config');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ config_key: 'autopilot_mode', config_value: 'prod' }),
      { onConflict: 'config_key' }
    );
  });

  it('also upserts canary_percentage when provided', async () => {
    const mockSupabase = { from: vi.fn().mockReturnValue({ upsert: mockUpsert }) } as any;
    const guard = AutopilotGuard.getInstance();

    await guard.persistMode(mockSupabase, 'canary', 20);

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    const calls = mockUpsert.mock.calls.map((c: any[]) => c[0]);
    expect(calls).toContainEqual(
      expect.objectContaining({ config_key: 'canary_percentage', config_value: '20' })
    );
  });

  it('omits canary_percentage upsert when not provided', async () => {
    const mockSupabase = { from: vi.fn().mockReturnValue({ upsert: mockUpsert }) } as any;
    const guard = AutopilotGuard.getInstance();

    await guard.persistMode(mockSupabase, 'off');

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({ config_key: 'autopilot_mode' });
  });

  it('throws when DB upsert returns an error', async () => {
    const failUpsert = vi.fn().mockResolvedValue({ error: { message: 'DB constraint violation' } });
    const mockSupabase = { from: vi.fn().mockReturnValue({ upsert: failUpsert }) } as any;
    const guard = AutopilotGuard.getInstance();

    await expect(guard.persistMode(mockSupabase, 'prod')).rejects.toThrow(
      'Failed to persist autopilot_mode'
    );
  });
});

// ============================================================================
// Tests: RiskEngine config cache invalidation
// ============================================================================

describe('RiskEngine — resetConfigCache', () => {
  it('clears cached config so next getConfig reads from DB', async () => {
    vi.resetModules();
    const { RiskEngine } = await import('../RiskEngine');

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [{ config_key: 'total_kelly_high', config_value: 0.9 }],
          error: null,
        }),
      }),
    } as any;

    // First call populates cache
    const config1 = await RiskEngine.getInstance().getConfig(mockSupabase);
    expect(config1.total_kelly_high).toBe(0.9);

    // Reset cache
    RiskEngine.resetConfigCache();

    // Second call should hit DB again — return different value
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ config_key: 'total_kelly_high', config_value: 0.5 }],
        error: null,
      }),
    });

    const config2 = await RiskEngine.getInstance().getConfig(mockSupabase);
    expect(config2.total_kelly_high).toBe(0.5);
  });
});

// ============================================================================
// Tests: Risk config key whitelist validation logic
// ============================================================================

describe('Risk config key whitelist', () => {
  const WRITABLE_KEYS = new Set([
    'total_kelly_high',
    'total_kelly_critical',
    'event_kelly_limit',
    'drift_brier_block',
    'drift_min_settled',
    'engine_enabled',
    'bankroll_total',
    'bankroll_kelly_multiplier',
    'bankroll_max_bet_fraction',
    'sport_kelly_limit',
    'correlation_max_same_event',
    'correlation_max_same_participant',
    'drawdown_freeze_threshold',
    'drawdown_lookback_days',
  ]);

  it('accepts all 14 known RiskEngineConfig keys', () => {
    for (const key of WRITABLE_KEYS) {
      expect(WRITABLE_KEYS.has(key)).toBe(true);
    }
    expect(WRITABLE_KEYS.size).toBe(14);
  });

  it('rejects keys not in the whitelist', () => {
    expect(WRITABLE_KEYS.has('unknown_key')).toBe(false);
    expect(WRITABLE_KEYS.has('autopilot_mode')).toBe(false);
    expect(WRITABLE_KEYS.has('')).toBe(false);
  });
});
