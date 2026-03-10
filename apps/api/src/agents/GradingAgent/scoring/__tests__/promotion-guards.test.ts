/**
 * Promotion Guards — Environment Configuration Tests
 *
 * Validates that all promotion env vars parse correctly and gates
 * behave as documented in the PROMOTION_PIPELINE_ACTIVATION runbook.
 *
 * SPRINT-PROMOTION-RUNTIME-ACTIVATION
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { canaryDecide, parseCanaryConfig, stableHash } from '../canaryRouter';
import { parsePromotionPolicyConfig } from '../promotionPolicy';

describe('parsePromotionPolicyConfig', () => {
  describe('defaults (all env vars unset)', () => {
    it('defaults to fail-closed when no env vars are set', () => {
      const config = parsePromotionPolicyConfig({});

      expect(config.policyEnabled).toBe(false);
      expect(config.killSwitch).toBe(false);
      expect(config.softEnable).toBe(false);
      expect(config.hardOnly).toBe(false);
      expect(config.hardMinEv).toBe(0.01);
      expect(config.hardMinConf).toBe(7);
      expect(config.canaryPercent).toBe(0);
      expect(config.canarySports).toEqual([]);
    });
  });

  describe('PROMOTION_KILL_SWITCH', () => {
    it('activates kill switch when set to "true"', () => {
      const config = parsePromotionPolicyConfig({ PROMOTION_KILL_SWITCH: 'true' });
      expect(config.killSwitch).toBe(true);
    });

    it('kill switch is inactive when unset', () => {
      const config = parsePromotionPolicyConfig({});
      expect(config.killSwitch).toBe(false);
    });

    it('kill switch is inactive for non-"true" values', () => {
      expect(parsePromotionPolicyConfig({ PROMOTION_KILL_SWITCH: 'false' }).killSwitch).toBe(false);
      expect(parsePromotionPolicyConfig({ PROMOTION_KILL_SWITCH: 'yes' }).killSwitch).toBe(false);
      expect(parsePromotionPolicyConfig({ PROMOTION_KILL_SWITCH: '1' }).killSwitch).toBe(false);
      expect(parsePromotionPolicyConfig({ PROMOTION_KILL_SWITCH: 'TRUE' }).killSwitch).toBe(false);
    });
  });

  describe('PROMOTION_POLICY_V2', () => {
    it('enables V2 policy when set to "true"', () => {
      const config = parsePromotionPolicyConfig({ PROMOTION_POLICY_V2: 'true' });
      expect(config.policyEnabled).toBe(true);
    });

    it('V2 policy is disabled by default', () => {
      const config = parsePromotionPolicyConfig({});
      expect(config.policyEnabled).toBe(false);
    });
  });

  describe('PROMOTION_CANARY_PERCENT', () => {
    it('parses valid percentage', () => {
      const config = parsePromotionPolicyConfig({ PROMOTION_CANARY_PERCENT: '50' });
      expect(config.canaryPercent).toBe(50);
    });

    it('clamps to 0 for negative values', () => {
      const config = parsePromotionPolicyConfig({ PROMOTION_CANARY_PERCENT: '-10' });
      expect(config.canaryPercent).toBe(0);
    });

    it('clamps to 100 for values over 100', () => {
      const config = parsePromotionPolicyConfig({ PROMOTION_CANARY_PERCENT: '200' });
      expect(config.canaryPercent).toBe(100);
    });

    it('defaults to 0 for non-numeric values', () => {
      const config = parsePromotionPolicyConfig({ PROMOTION_CANARY_PERCENT: 'abc' });
      expect(config.canaryPercent).toBe(0);
    });

    it('defaults to 0 when unset', () => {
      const config = parsePromotionPolicyConfig({});
      expect(config.canaryPercent).toBe(0);
    });
  });

  describe('PROMOTION_CANARY_SPORTS', () => {
    it('parses CSV sport list', () => {
      const config = parsePromotionPolicyConfig({ PROMOTION_CANARY_SPORTS: 'NFL,NBA,MLB' });
      expect(config.canarySports).toEqual(['NFL', 'NBA', 'MLB']);
    });

    it('trims whitespace and uppercases', () => {
      const config = parsePromotionPolicyConfig({ PROMOTION_CANARY_SPORTS: ' nfl , nba ' });
      expect(config.canarySports).toEqual(['NFL', 'NBA']);
    });

    it('filters empty strings', () => {
      const config = parsePromotionPolicyConfig({ PROMOTION_CANARY_SPORTS: 'NFL,,NBA,' });
      expect(config.canarySports).toEqual(['NFL', 'NBA']);
    });

    it('defaults to empty array when unset', () => {
      const config = parsePromotionPolicyConfig({});
      expect(config.canarySports).toEqual([]);
    });
  });

  describe('PROMOTION_HARD_MIN_EV', () => {
    it('parses valid EV threshold', () => {
      const config = parsePromotionPolicyConfig({ PROMOTION_HARD_MIN_EV: '0.03' });
      expect(config.hardMinEv).toBe(0.03);
    });

    it('defaults to 0.01 when unset', () => {
      const config = parsePromotionPolicyConfig({});
      expect(config.hardMinEv).toBe(0.01);
    });

    it('defaults to 0.01 for NaN values', () => {
      const config = parsePromotionPolicyConfig({ PROMOTION_HARD_MIN_EV: 'abc' });
      expect(config.hardMinEv).toBe(0.01);
    });

    it('clamps negative values to 0', () => {
      const config = parsePromotionPolicyConfig({ PROMOTION_HARD_MIN_EV: '-0.5' });
      expect(config.hardMinEv).toBe(0);
    });
  });

  describe('PROMOTION_HARD_MIN_CONF', () => {
    it('parses valid confidence threshold', () => {
      const config = parsePromotionPolicyConfig({ PROMOTION_HARD_MIN_CONF: '8' });
      expect(config.hardMinConf).toBe(8);
    });

    it('defaults to 7 when unset', () => {
      const config = parsePromotionPolicyConfig({});
      expect(config.hardMinConf).toBe(7);
    });

    it('clamps to 0-10 range', () => {
      expect(parsePromotionPolicyConfig({ PROMOTION_HARD_MIN_CONF: '-1' }).hardMinConf).toBe(0);
      expect(parsePromotionPolicyConfig({ PROMOTION_HARD_MIN_CONF: '15' }).hardMinConf).toBe(10);
    });

    it('defaults to 7 for NaN values', () => {
      const config = parsePromotionPolicyConfig({ PROMOTION_HARD_MIN_CONF: 'abc' });
      expect(config.hardMinConf).toBe(7);
    });
  });

  describe('SOFT band controls', () => {
    it('softEnable activates with "true"', () => {
      const config = parsePromotionPolicyConfig({ PROMOTION_SOFT_ENABLE: 'true' });
      expect(config.softEnable).toBe(true);
    });

    it('hardOnly activates with "true"', () => {
      const config = parsePromotionPolicyConfig({ PROMOTION_HARD_ONLY: 'true' });
      expect(config.hardOnly).toBe(true);
    });
  });

  describe('feature snapshot gate', () => {
    it('is always true (constitutional)', () => {
      const config = parsePromotionPolicyConfig({});
      expect(config.featureSnapshotGateEnabled).toBe(true);
    });
  });

  describe('full activation config (runbook Stage 3)', () => {
    it('Stage 1: Shadow validation config', () => {
      const config = parsePromotionPolicyConfig({
        PROMOTION_POLICY_V2: 'true',
        PROMOTION_CANARY_PERCENT: '100',
        // kill switch unset
      });

      expect(config.policyEnabled).toBe(true);
      expect(config.killSwitch).toBe(false);
      expect(config.canaryPercent).toBe(100);
    });

    it('Stage 3: Full activation config', () => {
      const config = parsePromotionPolicyConfig({
        PROMOTION_POLICY_V2: 'true',
        PROMOTION_CANARY_PERCENT: '100',
        PROMOTION_HARD_ONLY: 'true',
        // kill switch unset
        // shadow mode unset
      });

      expect(config.policyEnabled).toBe(true);
      expect(config.killSwitch).toBe(false);
      expect(config.hardOnly).toBe(true);
      expect(config.canaryPercent).toBe(100);
    });

    it('kill switch overrides all other settings', () => {
      const config = parsePromotionPolicyConfig({
        PROMOTION_POLICY_V2: 'true',
        PROMOTION_CANARY_PERCENT: '100',
        PROMOTION_KILL_SWITCH: 'true',
      });

      // Kill switch is set, policy is enabled, but kill switch should block
      expect(config.killSwitch).toBe(true);
      expect(config.policyEnabled).toBe(true); // Policy still parses as enabled
      // Consumers must check killSwitch first
    });
  });
});

describe('stableHash', () => {
  it('returns deterministic values for same input', () => {
    const hash1 = stableHash('pick-123');
    const hash2 = stableHash('pick-123');
    expect(hash1).toBe(hash2);
  });

  it('returns values in [0, 99] range', () => {
    const inputs = ['a', 'b', 'pick-1', 'pick-999', 'abc-def-ghi', ''];
    for (const input of inputs) {
      const result = stableHash(input);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(99);
    }
  });

  it('distributes different inputs across buckets', () => {
    const hashes = new Set<number>();
    for (let i = 0; i < 100; i++) {
      hashes.add(stableHash(`pick-${i}`));
    }
    // Should have reasonable spread (at least 20 distinct buckets for 100 inputs)
    expect(hashes.size).toBeGreaterThan(20);
  });
});

describe('canaryDecide (scoring canary router)', () => {
  it('kill switch forces V1 regardless of other flags', () => {
    const decision = canaryDecide('NBA', 'pick-1', {
      killSwitch: true,
      v2Enabled: true,
      v2Primary: true,
      shadowEnabled: true,
      canarySports: [],
      canaryPercent: 100,
    });
    expect(decision.mode).toBe('v1');
    expect(decision.reason).toBe('kill_switch');
  });

  it('V2 disabled forces V1', () => {
    const decision = canaryDecide('NBA', 'pick-1', {
      killSwitch: false,
      v2Enabled: false,
      v2Primary: false,
      shadowEnabled: false,
      canarySports: [],
      canaryPercent: 100,
    });
    expect(decision.mode).toBe('v1');
    expect(decision.reason).toBe('v2_disabled');
  });

  it('V2 primary returns v2_primary mode', () => {
    const decision = canaryDecide('NBA', 'pick-1', {
      killSwitch: false,
      v2Enabled: true,
      v2Primary: true,
      shadowEnabled: false,
      canarySports: [],
      canaryPercent: 0,
    });
    expect(decision.mode).toBe('v2_primary');
  });

  it('shadow mode returns shadow mode', () => {
    const decision = canaryDecide('NBA', 'pick-1', {
      killSwitch: false,
      v2Enabled: true,
      v2Primary: false,
      shadowEnabled: true,
      canarySports: [],
      canaryPercent: 0,
    });
    expect(decision.mode).toBe('shadow');
  });

  it('100% canary routes all to V2', () => {
    const decision = canaryDecide('NBA', 'pick-1', {
      killSwitch: false,
      v2Enabled: true,
      v2Primary: false,
      shadowEnabled: false,
      canarySports: [],
      canaryPercent: 100,
    });
    expect(decision.mode).toBe('v2');
  });

  it('0% canary routes all to V1', () => {
    const decision = canaryDecide('NBA', 'pick-1', {
      killSwitch: false,
      v2Enabled: true,
      v2Primary: false,
      shadowEnabled: false,
      canarySports: [],
      canaryPercent: 0,
    });
    expect(decision.mode).toBe('v1');
  });

  it('sport filter restricts canary to matching sports', () => {
    const config = {
      killSwitch: false,
      v2Enabled: true,
      v2Primary: false,
      shadowEnabled: false,
      canarySports: ['NFL'],
      canaryPercent: 100,
    };

    const nflDecision = canaryDecide('NFL', 'pick-1', config);
    expect(nflDecision.mode).toBe('v2');

    const nbaDecision = canaryDecide('NBA', 'pick-1', config);
    expect(nbaDecision.mode).toBe('v1');
  });
});

describe('parseCanaryConfig', () => {
  it('defaults to all-off when no env vars set', () => {
    const config = parseCanaryConfig({});
    expect(config.v2Enabled).toBe(false);
    expect(config.killSwitch).toBe(false);
    expect(config.v2Primary).toBe(false);
    expect(config.shadowEnabled).toBe(false);
    expect(config.canarySports).toEqual([]);
    expect(config.canaryPercent).toBe(0);
  });

  it('parses all env vars correctly', () => {
    const config = parseCanaryConfig({
      SCORING_ENGINE_V2: 'true',
      SCORING_KILL_SWITCH: 'true',
      SCORING_V2_PRIMARY: 'true',
      SCORING_SHADOW: 'true',
      SCORING_CANARY_SPORTS: 'NFL,NBA',
      SCORING_CANARY_PERCENT: '50',
    });
    expect(config.v2Enabled).toBe(true);
    expect(config.killSwitch).toBe(true);
    expect(config.v2Primary).toBe(true);
    expect(config.shadowEnabled).toBe(true);
    expect(config.canarySports).toEqual(['NFL', 'NBA']);
    expect(config.canaryPercent).toBe(50);
  });
});
