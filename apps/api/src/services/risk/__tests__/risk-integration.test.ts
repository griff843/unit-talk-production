/**
 * Risk Engine Integration Tests
 * Sprint: SPRINT-RISK-ENGINE-INTEGRATION
 *
 * Tests the risk pre-flight gate wired into GradingAgent.promoteFromProviderOffer().
 *
 * Covers:
 * 1. Blocked promotion → lifecycleInsert never called
 * 2. Allowed promotion → lifecycleInsert called
 * 3. Various block reasons (Kelly, drift, error)
 * 4. Engine bypass mode
 * 5. RiskEngine standalone scenarios not covered in risk-engine.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { RiskEngine } from '../RiskEngine';
import { DEFAULT_RISK_CONFIG } from '../types';

// ============================================================================
// Mocks — must be hoisted before any imports that use them
// ============================================================================

vi.mock('../../../lib/lifecycle', () => ({
  lifecycleInsert: vi.fn().mockResolvedValue({ success: true, error: null }),
  lifecycleUpdate: vi.fn().mockResolvedValue({ success: true, error: null }),
}));

vi.mock('../../../services/ProfessionalPropProcessor', () => {
  const mockInstance = { evaluate: vi.fn() };
  const ProfessionalPropProcessor = vi.fn().mockImplementation(() => mockInstance);
  ProfessionalPropProcessor.getInstance = vi.fn().mockReturnValue(mockInstance);
  return { ProfessionalPropProcessor };
});

vi.mock('../../../services/projections', () => ({
  getProjectionEngine: vi.fn().mockResolvedValue(null),
  ProjectionEngine: vi.fn(),
}));

// Import after mocks
import { lifecycleInsert } from '../../../lib/lifecycle';

// ============================================================================
// Helper: build a minimal GradingResult for promoteFromProviderOffer
// ============================================================================

function buildResult(overrides?: Partial<Record<string, unknown>>) {
  return {
    propId: 'provider-offer-abc123',
    tier: 'S' as const,
    finalScore: 85,
    confidence: 0.82,
    kellyFraction: 0.05,
    positionSize: 0.5,
    promotionBand: 'high_edge',
    meetsPromotionCriteria: true,
    ...overrides,
  };
}

// ============================================================================
// Helper: createMockSupabase for RiskEngine calls
// ============================================================================

function createMockSupabase(
  options: {
    exposureRows?: Array<Record<string, unknown>>;
    driftRows?: Array<Record<string, unknown>>;
    engineEnabled?: boolean;
    insertError?: boolean;
  } = {}
) {
  const { exposureRows = [], driftRows = [], engineEnabled = true, insertError = false } = options;

  const configRows = [
    { config_key: 'total_kelly_high', config_value: '0.60' },
    { config_key: 'total_kelly_critical', config_value: '1.00' },
    { config_key: 'event_kelly_limit', config_value: '0.25' },
    { config_key: 'drift_brier_block', config_value: '0.35' },
    { config_key: 'drift_min_settled', config_value: '30' },
    { config_key: 'engine_enabled', config_value: engineEnabled ? '1' : '0' },
  ];

  let callCount = 0;

  // Also need to handle the provider_offers queries for GradingAgent
  const mockProviderOfferData = {
    data: {
      id: 'provider-offer-abc123',
      line: 4.5,
      over_odds: -110,
      under_odds: -110,
      provider_market_key: 'assists-PLAYER-1-NBA-game-ou',
      canonical_events: {
        id: 'event-001',
        sport: 'NBA',
        game_date: '2026-03-09',
      },
      participants: { name: 'Test Player' },
    },
    error: null,
  };

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
            error: insertError ? { message: 'insert failed' } : null,
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
        const isExposureCall = callCount % 2 === 1;
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
      if (table === 'provider_offers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(mockProviderOfferData),
            }),
          }),
        };
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'system-user-uuid' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'system-user-uuid' },
                error: null,
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
// Part 1: RiskEngine.evaluateForPromotion — extended scenarios
// ============================================================================

describe('RiskEngine — extended integration scenarios', () => {
  beforeEach(() => {
    RiskEngine.resetConfigCache();
    vi.restoreAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should ALLOW with zero kelly fraction (no exposure)', async () => {
    const supabase = createMockSupabase({ exposureRows: [] });
    const engine = RiskEngine.getInstance();
    const decision = await engine.evaluateForPromotion(supabase, 'pick-zero', 0.0);

    expect(decision.allowed).toBe(true);
    expect(decision.decision).toBe('ALLOW');
    expect(decision.blocked_reasons).toHaveLength(0);
  });

  it('should BLOCK when total kelly equals HIGH threshold exactly', async () => {
    // 8 existing legs × 0.08 kelly = 0.64 > 0.60
    const exposureRows = Array.from({ length: 8 }, (_, i) => ({
      kelly_fraction: 0.08,
      ticket_legs: { event_id: `event-${i}`, leg_status: 'pending' },
    }));

    const supabase = createMockSupabase({ exposureRows });
    const engine = RiskEngine.getInstance();
    const decision = await engine.evaluateForPromotion(supabase, 'pick-high', 0.08);

    expect(decision.allowed).toBe(false);
    expect(decision.decision).toBe('BLOCK');
    expect(decision.blocked_reasons.some(r => r.includes('total_kelly_high'))).toBe(true);
  });

  it('should BLOCK when total kelly exceeds CRITICAL threshold', async () => {
    // 15 legs × 0.08 = 1.20 > 1.00 critical
    const exposureRows = Array.from({ length: 15 }, (_, i) => ({
      kelly_fraction: 0.08,
      ticket_legs: { event_id: `event-${i}`, leg_status: 'pending' },
    }));

    const supabase = createMockSupabase({ exposureRows });
    const engine = RiskEngine.getInstance();
    const decision = await engine.evaluateForPromotion(supabase, 'pick-critical', 0.08);

    expect(decision.allowed).toBe(false);
    expect(decision.decision).toBe('BLOCK');
    // Should have at least the critical reason
    expect(decision.blocked_reasons.some(r => r.includes('total_kelly'))).toBe(true);
  });

  it('should ALLOW when event kelly is below limit', async () => {
    // Two legs on same event totaling 0.20 < 0.25 limit
    const exposureRows = [
      { kelly_fraction: 0.1, ticket_legs: { event_id: 'ev-allow', leg_status: 'pending' } },
      { kelly_fraction: 0.09, ticket_legs: { event_id: 'ev-allow', leg_status: 'pending' } },
    ];

    const supabase = createMockSupabase({ exposureRows });
    const engine = RiskEngine.getInstance();
    const decision = await engine.evaluateForPromotion(supabase, 'pick-event-ok', 0.05, 'ev-allow');

    expect(decision.allowed).toBe(true);
    expect(decision.blocked_reasons).toHaveLength(0);
  });

  it('should BLOCK when event kelly exceeds limit', async () => {
    // Two legs totaling 0.31 > 0.25 limit
    const exposureRows = [
      { kelly_fraction: 0.15, ticket_legs: { event_id: 'ev-block', leg_status: 'pending' } },
      { kelly_fraction: 0.16, ticket_legs: { event_id: 'ev-block', leg_status: 'pending' } },
    ];

    const supabase = createMockSupabase({ exposureRows });
    const engine = RiskEngine.getInstance();
    const decision = await engine.evaluateForPromotion(
      supabase,
      'pick-event-block',
      0.05,
      'ev-block'
    );

    expect(decision.allowed).toBe(false);
    expect(decision.blocked_reasons.some(r => r.includes('event_kelly_limit'))).toBe(true);
  });

  it('should skip event-level check when no eventId provided', async () => {
    // Only total kelly matters — below threshold
    const exposureRows = [
      { kelly_fraction: 0.1, ticket_legs: { event_id: 'ev-x', leg_status: 'pending' } },
    ];

    const supabase = createMockSupabase({ exposureRows });
    const engine = RiskEngine.getInstance();
    const decision = await engine.evaluateForPromotion(supabase, 'pick-no-event', 0.05); // no eventId

    expect(decision.allowed).toBe(true);
  });

  it('should ALLOW when engine_enabled=false regardless of exposure', async () => {
    // High exposure, but engine disabled
    const exposureRows = Array.from({ length: 20 }, (_, i) => ({
      kelly_fraction: 0.1,
      ticket_legs: { event_id: `ev-${i}`, leg_status: 'pending' },
    }));

    const supabase = createMockSupabase({ exposureRows, engineEnabled: false });
    const engine = RiskEngine.getInstance();
    const decision = await engine.evaluateForPromotion(supabase, 'pick-bypass', 0.1);

    expect(decision.allowed).toBe(true);
    expect(decision.decision).toBe('ALLOW');
    expect(decision.warnings).toContain('risk_engine_disabled');
  });

  it('should use DEFAULT_RISK_CONFIG when DB returns empty config', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'risk_engine_config') {
          return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
        }
        if (table === 'risk_events') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        if (table === 'drift_snapshots') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                gt: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        };
      }),
    } as any;

    RiskEngine.resetConfigCache();
    const engine = RiskEngine.getInstance();
    const config = await engine.getConfig(supabase);

    expect(config.total_kelly_high).toBe(DEFAULT_RISK_CONFIG.total_kelly_high);
    expect(config.engine_enabled).toBe(DEFAULT_RISK_CONFIG.engine_enabled);
  });

  it('should return a traceId on every decision', async () => {
    const supabase = createMockSupabase({});
    const engine = RiskEngine.getInstance();

    const allow = await engine.evaluateForPromotion(supabase, 'pick-trace-allow', 0.05);
    expect(allow.trace_id).toBeTruthy();
    expect(allow.trace_id).toContain('risk-pick-trace-allow');
  });

  it('should be fail-closed on scored_legs DB error', async () => {
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
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                gt: vi.fn().mockRejectedValue(new Error('Connection timeout')),
              }),
            }),
          }),
        };
      }),
    } as any;

    RiskEngine.resetConfigCache();
    const engine = RiskEngine.getInstance();
    const decision = await engine.evaluateForPromotion(supabase, 'pick-error', 0.05);

    expect(decision.allowed).toBe(false);
    expect(decision.decision).toBe('BLOCK');
    expect(decision.blocked_reasons).toContain('risk_engine_error');
  });
});

// ============================================================================
// Part 2: GradingAgent + RiskEngine integration (gate behavior)
// ============================================================================

function buildAgentDeps(supabase: any) {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    } as any,
    supabase,
  };
}

describe('GradingAgent + RiskEngine integration gate', () => {
  beforeEach(() => {
    RiskEngine.resetConfigCache();
    vi.restoreAllMocks();
    // Re-establish module mock implementations after restoreAllMocks
    vi.mocked(lifecycleInsert).mockResolvedValue({ success: true, error: null });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('should NOT call lifecycleInsert when risk engine blocks promotion', async () => {
    // Arrange: spy on evaluateForPromotion to return BLOCK
    const engine = RiskEngine.getInstance();
    vi.spyOn(engine, 'evaluateForPromotion').mockResolvedValue({
      allowed: false,
      decision: 'BLOCK' as const,
      blocked_reasons: ['total_kelly_high: 0.70 > 0.60'],
      warnings: [],
      exposure_state: {
        total_kelly: 0.7,
        event_kelly: {},
        pending_count: 9,
        blocked: true,
        block_reason: 'total_kelly_high',
        threshold_high: 0.6,
        threshold_critical: 1.0,
        event_limit: 0.25,
      },
      drift_state: {
        global_brier: null,
        sample_size: 0,
        blocked: false,
        block_reason: null,
        threshold: 0.35,
        min_settled: 30,
      },
      trace_id: 'risk-test-block-001',
    });

    // Import GradingAgent and create a minimal instance
    const { GradingAgent } = await import('../../../agents/GradingAgent/GradingAgent');

    const mockSupabase = createMockSupabase({});
    const agent = new GradingAgent(
      { name: 'GradingAgent-test', version: '1.0', enabled: true },
      buildAgentDeps(mockSupabase)
    );

    // Act: call the private promotion method directly
    const result = buildResult({ propId: 'provider-offer-abc123', kellyFraction: 0.08 });
    await (agent as any).promoteFromProviderOffer(result);

    // Assert: lifecycleInsert must NOT have been called
    expect(lifecycleInsert).not.toHaveBeenCalled();
    expect(engine.evaluateForPromotion).toHaveBeenCalledTimes(1);
  });

  it('should call lifecycleInsert when risk engine allows promotion', async () => {
    const engine = RiskEngine.getInstance();
    vi.spyOn(engine, 'evaluateForPromotion').mockResolvedValue({
      allowed: true,
      decision: 'ALLOW' as const,
      blocked_reasons: [],
      warnings: [],
      exposure_state: {
        total_kelly: 0.1,
        event_kelly: {},
        pending_count: 2,
        blocked: false,
        block_reason: null,
        threshold_high: 0.6,
        threshold_critical: 1.0,
        event_limit: 0.25,
      },
      drift_state: {
        global_brier: null,
        sample_size: 0,
        blocked: false,
        block_reason: null,
        threshold: 0.35,
        min_settled: 30,
      },
      trace_id: 'risk-test-allow-001',
    });

    const { GradingAgent } = await import('../../../agents/GradingAgent/GradingAgent');
    const mockSupa = createMockSupabase({});
    const agent = new GradingAgent(
      { name: 'GradingAgent-test', version: '1.0', enabled: true },
      buildAgentDeps(mockSupa)
    );

    const result = buildResult({ propId: 'provider-offer-abc123', kellyFraction: 0.05 });
    await (agent as any).promoteFromProviderOffer(result);

    // Assert: lifecycleInsert WAS called
    expect(lifecycleInsert).toHaveBeenCalledTimes(1);
    expect(lifecycleInsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kelly_fraction: 0.05 }),
      expect.objectContaining({ writerRole: 'promoter' })
    );
  });

  it('should pass kellyFraction to evaluateForPromotion', async () => {
    const engine = RiskEngine.getInstance();
    const evaluateSpy = vi.spyOn(engine, 'evaluateForPromotion').mockResolvedValue({
      allowed: false,
      decision: 'BLOCK' as const,
      blocked_reasons: ['total_kelly_high: 0.80 > 0.60'],
      warnings: [],
      exposure_state: {
        total_kelly: 0.8,
        event_kelly: {},
        pending_count: 10,
        blocked: true,
        block_reason: 'total_kelly_high',
        threshold_high: 0.6,
        threshold_critical: 1.0,
        event_limit: 0.25,
      },
      drift_state: {
        global_brier: null,
        sample_size: 0,
        blocked: false,
        block_reason: null,
        threshold: 0.35,
        min_settled: 30,
      },
      trace_id: 'risk-test-kelly-003',
    });

    const { GradingAgent } = await import('../../../agents/GradingAgent/GradingAgent');
    const mockSupa = createMockSupabase({});
    const agent = new GradingAgent(
      { name: 'GradingAgent-test', version: '1.0', enabled: true },
      buildAgentDeps(mockSupa)
    );

    const result = buildResult({ propId: 'provider-offer-abc123', kellyFraction: 0.12 });
    await (agent as any).promoteFromProviderOffer(result);

    // Verify the kelly fraction was passed correctly
    expect(evaluateSpy).toHaveBeenCalledWith(
      expect.anything(), // supabase
      'provider-offer-abc123', // propId
      0.12, // kellyFraction
      expect.anything() // eventId (from canonical_events join)
    );
  });

  it('should block on drift throttle → no lifecycle write', async () => {
    const engine = RiskEngine.getInstance();
    vi.spyOn(engine, 'evaluateForPromotion').mockResolvedValue({
      allowed: false,
      decision: 'BLOCK' as const,
      blocked_reasons: ['drift_brier_exceeded: 0.40 > 0.35'],
      warnings: [],
      exposure_state: {
        total_kelly: 0.05,
        event_kelly: {},
        pending_count: 1,
        blocked: false,
        block_reason: null,
        threshold_high: 0.6,
        threshold_critical: 1.0,
        event_limit: 0.25,
      },
      drift_state: {
        global_brier: 0.4,
        sample_size: 50,
        blocked: true,
        block_reason: 'drift_brier_exceeded',
        threshold: 0.35,
        min_settled: 30,
      },
      trace_id: 'risk-test-drift-004',
    });

    const { GradingAgent } = await import('../../../agents/GradingAgent/GradingAgent');
    const mockSupa = createMockSupabase({});
    const agent = new GradingAgent(
      { name: 'GradingAgent-test', version: '1.0', enabled: true },
      buildAgentDeps(mockSupa)
    );

    const result = buildResult({ propId: 'provider-offer-abc123', kellyFraction: 0.05 });
    await (agent as any).promoteFromProviderOffer(result);

    expect(lifecycleInsert).not.toHaveBeenCalled();
  });

  it('should block on engine error (fail-closed) → no lifecycle write', async () => {
    const engine = RiskEngine.getInstance();
    // RiskEngine itself is fail-closed — it returns BLOCK on error, never throws
    vi.spyOn(engine, 'evaluateForPromotion').mockResolvedValue({
      allowed: false,
      decision: 'BLOCK' as const,
      blocked_reasons: ['risk_engine_error'],
      warnings: [],
      exposure_state: {
        total_kelly: 0,
        event_kelly: {},
        pending_count: 0,
        blocked: false,
        block_reason: null,
        threshold_high: 0.6,
        threshold_critical: 1.0,
        event_limit: 0.25,
      },
      drift_state: {
        global_brier: null,
        sample_size: 0,
        blocked: false,
        block_reason: null,
        threshold: 0.35,
        min_settled: 30,
      },
      trace_id: 'risk-test-error-005',
    });

    const { GradingAgent } = await import('../../../agents/GradingAgent/GradingAgent');
    const mockSupa = createMockSupabase({});
    const agent = new GradingAgent(
      { name: 'GradingAgent-test', version: '1.0', enabled: true },
      buildAgentDeps(mockSupa)
    );

    const result = buildResult({ propId: 'provider-offer-abc123', kellyFraction: 0.05 });
    await (agent as any).promoteFromProviderOffer(result);

    expect(lifecycleInsert).not.toHaveBeenCalled();
  });

  it('should call lifecycleInsert with writerRole=promoter on ALLOW', async () => {
    const engine = RiskEngine.getInstance();
    vi.spyOn(engine, 'evaluateForPromotion').mockResolvedValue({
      allowed: true,
      decision: 'ALLOW' as const,
      blocked_reasons: [],
      warnings: [],
      exposure_state: {
        total_kelly: 0.05,
        event_kelly: {},
        pending_count: 1,
        blocked: false,
        block_reason: null,
        threshold_high: 0.6,
        threshold_critical: 1.0,
        event_limit: 0.25,
      },
      drift_state: {
        global_brier: null,
        sample_size: 0,
        blocked: false,
        block_reason: null,
        threshold: 0.35,
        min_settled: 30,
      },
      trace_id: 'risk-test-allow-006',
    });

    const { GradingAgent } = await import('../../../agents/GradingAgent/GradingAgent');
    const mockSupa = createMockSupabase({});
    const agent = new GradingAgent(
      { name: 'GradingAgent-test', version: '1.0', enabled: true },
      buildAgentDeps(mockSupa)
    );

    const result = buildResult({ propId: 'provider-offer-abc123', kellyFraction: 0.05 });
    await (agent as any).promoteFromProviderOffer(result);

    expect(lifecycleInsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ writerRole: 'promoter' })
    );
  });

  it('should call evaluateForPromotion exactly once per promotion attempt', async () => {
    const engine = RiskEngine.getInstance();
    const evaluateSpy = vi.spyOn(engine, 'evaluateForPromotion').mockResolvedValue({
      allowed: true,
      decision: 'ALLOW' as const,
      blocked_reasons: [],
      warnings: [],
      exposure_state: {
        total_kelly: 0.01,
        event_kelly: {},
        pending_count: 0,
        blocked: false,
        block_reason: null,
        threshold_high: 0.6,
        threshold_critical: 1.0,
        event_limit: 0.25,
      },
      drift_state: {
        global_brier: null,
        sample_size: 0,
        blocked: false,
        block_reason: null,
        threshold: 0.35,
        min_settled: 30,
      },
      trace_id: 'risk-test-once-007',
    });

    const { GradingAgent } = await import('../../../agents/GradingAgent/GradingAgent');
    const mockSupa = createMockSupabase({});
    const agent = new GradingAgent(
      { name: 'GradingAgent-test', version: '1.0', enabled: true },
      buildAgentDeps(mockSupa)
    );

    const result = buildResult({ propId: 'provider-offer-abc123', kellyFraction: 0.05 });
    await (agent as any).promoteFromProviderOffer(result);

    expect(evaluateSpy).toHaveBeenCalledTimes(1);
  });
});
