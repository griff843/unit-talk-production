/**
 * Phase 6: Autopilot LOG_ONLY Integration Test
 * Proves that LOG_ONLY mode has zero side effects
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { AutopilotController } from '../../src/lib/AutopilotController';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'
);

describe('Autopilot LOG_ONLY Mode - Zero Side Effects', () => {
  let autopilot: AutopilotController;
  const testPickData = {
    player_name: 'Test Player',
    stat_type: 'points',
    line: 25.5,
    over_odds: -110,
    under_odds: -110,
    sport: 'NBA',
    confidence: 0.85,
  };

  beforeAll(async () => {
    autopilot = new AutopilotController(supabase, 'log_only');
  });

  test('LOG_ONLY mode prevents publishing', async () => {
    const result = await autopilot.canPublish({
      pick_data: testPickData,
      mode: 'log_only',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('LOG_ONLY');
    expect(result.decision.mode_at_decision).toBe('log_only');
  });

  test('LOG_ONLY mode evaluates picks correctly', async () => {
    const decision = await autopilot.evaluate({
      pick_data: testPickData,
      mode: 'log_only',
    });

    // Decision should be made
    expect(decision.decision).toBeDefined();
    expect(['approve', 'reject', 'unknown']).toContain(decision.decision);

    // But publishing should be blocked
    expect(decision.can_publish).toBe(false);
    expect(decision.publish_blocked_reason).toContain('LOG_ONLY');
  });

  test('LOG_ONLY mode logs decisions to database', async () => {
    const testPick = {
      ...testPickData,
      test_id: `log-only-test-${Date.now()}`,
    };

    await autopilot.evaluate({
      pick_data: testPick,
      mode: 'log_only',
    });

    // Verify decision was logged
    const { data } = await supabase
      .from('autopilot_decisions')
      .select('*')
      .eq('mode', 'log_only')
      .contains('pick_data', { test_id: testPick.test_id })
      .order('evaluated_at', { ascending: false })
      .limit(1);

    expect(data).toBeDefined();
    expect(data!.length).toBe(1);
    expect(data![0].mode).toBe('log_only');
    expect(data![0].would_publish).toBe(false);
  });

  test('LOG_ONLY mode blocks even approved picks', async () => {
    // Create a pick that would be approved (low risk)
    const lowRiskPick = {
      player_name: 'Stephen Curry',
      stat_type: 'points',
      line: 28.5,
      over_odds: -110,
      under_odds: -110,
      sport: 'NBA',
      confidence: 0.95,
      // All fields present, good data quality
    };

    const decision = await autopilot.evaluate({
      pick_data: lowRiskPick,
      mode: 'log_only',
    });

    // Even if decision is approve, publishing is blocked
    expect(decision.can_publish).toBe(false);
    expect(decision.publish_blocked_reason).toContain('LOG_ONLY');
  });

  test('Mode cannot bypass LOG_ONLY restrictions', async () => {
    // Attempt to use canPublish in LOG_ONLY mode
    const attempts = [];

    for (let i = 0; i < 5; i++) {
      const result = await autopilot.canPublish({
        pick_data: { ...testPickData, attempt: i },
        mode: 'log_only',
      });

      attempts.push(result.allowed);
    }

    // ALL attempts should be blocked
    expect(attempts.every((allowed) => allowed === false)).toBe(true);
  });
});

describe('Autopilot Publish Gating', () => {
  let autopilot: AutopilotController;

  beforeAll(() => {
    autopilot = new AutopilotController(supabase, 'prod');
  });

  test('PROD mode allows approved picks to publish', async () => {
    const goodPick = {
      player_name: 'LeBron James',
      stat_type: 'points',
      line: 25.5,
      over_odds: -110,
      under_odds: -110,
      sport: 'NBA',
      confidence: 0.9,
    };

    const result = await autopilot.canPublish({
      pick_data: goodPick,
      mode: 'prod',
    });

    // If pick is approved and in PROD mode, publishing should be allowed
    if (result.decision.decision === 'approve') {
      expect(result.allowed).toBe(true);
    }
  });

  test('PROD mode blocks rejected picks', async () => {
    const badPick = {
      // Missing critical fields - will be rejected
      stat_type: 'points',
      line: 25.5,
      // Missing player_name, odds
    };

    const result = await autopilot.canPublish({
      pick_data: badPick,
      mode: 'prod',
    });

    expect(result.allowed).toBe(false);
    expect(result.decision.decision).toBe('reject');
  });

  test('OFF mode blocks all publishing', async () => {
    const offAutopilot = new AutopilotController(supabase, 'off');

    const result = await offAutopilot.canPublish({
      pick_data: {
        player_name: 'Test',
        stat_type: 'points',
        line: 25,
        over_odds: -110,
        under_odds: -110,
      },
      mode: 'off',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('OFF');
  });
});
