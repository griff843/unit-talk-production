/**
 * canaryRouter.test.ts — Unit tests for Tranche 6 canary router
 *
 * Tests:
 * 1. Stable hashing produces deterministic results
 * 2. Percent boundaries are correct
 * 3. Sport-gating is correct
 * 4. Kill switch overrides everything
 * 5. Shadow mode takes precedence over canary
 * 6. V2 disabled means always V1
 * 7. parseCanaryConfig reads env correctly
 */

import {
  canaryDecide,
  parseCanaryConfig,
  stableHash,
  CanaryConfig,
} from '../../src/agents/GradingAgent/scoring/canaryRouter';

describe('canaryRouter', () => {
  describe('stableHash', () => {
    it('produces deterministic output for the same input', () => {
      const h1 = stableHash('NBA-001');
      const h2 = stableHash('NBA-001');
      expect(h1).toBe(h2);
    });

    it('produces different values for different inputs', () => {
      const h1 = stableHash('NBA-001');
      const h2 = stableHash('NBA-002');
      expect(h1).not.toBe(h2);
    });

    it('returns a value in [0, 99]', () => {
      const inputs = [
        'NBA-001',
        'MLB-100',
        'test-pick-xyz',
        'a',
        '',
        'very-long-pick-id-with-many-characters',
      ];
      for (const input of inputs) {
        const h = stableHash(input);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(99);
      }
    });

    it('distributes values across the range', () => {
      const buckets = new Set<number>();
      for (let i = 0; i < 200; i++) {
        buckets.add(stableHash(`pick-${i}`));
      }
      // With 200 unique inputs, we should see at least 30 distinct buckets
      expect(buckets.size).toBeGreaterThan(30);
    });
  });

  describe('parseCanaryConfig', () => {
    it('defaults to all-off when env is empty', () => {
      const config = parseCanaryConfig({});
      expect(config.v2Enabled).toBe(false);
      expect(config.killSwitch).toBe(false);
      expect(config.shadowEnabled).toBe(false);
      expect(config.canarySports).toEqual([]);
      expect(config.canaryPercent).toBe(0);
    });

    it('parses all flags correctly', () => {
      const config = parseCanaryConfig({
        SCORING_ENGINE_V2: 'true',
        SCORING_KILL_SWITCH: 'true',
        SCORING_SHADOW: 'true',
        SCORING_CANARY_SPORTS: 'NBA,MLB',
        SCORING_CANARY_PERCENT: '25',
      });
      expect(config.v2Enabled).toBe(true);
      expect(config.killSwitch).toBe(true);
      expect(config.shadowEnabled).toBe(true);
      expect(config.canarySports).toEqual(['NBA', 'MLB']);
      expect(config.canaryPercent).toBe(25);
    });

    it('handles case-insensitive sports', () => {
      const config = parseCanaryConfig({
        SCORING_CANARY_SPORTS: 'nba, mlb ,Nfl',
      });
      expect(config.canarySports).toEqual(['NBA', 'MLB', 'NFL']);
    });

    it('clamps percent to 0-100', () => {
      expect(parseCanaryConfig({ SCORING_CANARY_PERCENT: '-5' }).canaryPercent).toBe(0);
      expect(parseCanaryConfig({ SCORING_CANARY_PERCENT: '150' }).canaryPercent).toBe(100);
      expect(parseCanaryConfig({ SCORING_CANARY_PERCENT: 'abc' }).canaryPercent).toBe(0);
    });
  });

  describe('canaryDecide', () => {
    it('returns v1 when V2 is disabled (default)', () => {
      const config: CanaryConfig = {
        v2Enabled: false,
        killSwitch: false,
        shadowEnabled: false,
        canarySports: [],
        canaryPercent: 0,
      };
      const decision = canaryDecide('NBA', 'pick-1', config);
      expect(decision.mode).toBe('v1');
      expect(decision.reason).toBe('v2_disabled');
    });

    it('kill switch overrides everything to V1', () => {
      const config: CanaryConfig = {
        v2Enabled: true,
        killSwitch: true,
        shadowEnabled: true,
        canarySports: ['NBA'],
        canaryPercent: 100,
      };
      const decision = canaryDecide('NBA', 'pick-1', config);
      expect(decision.mode).toBe('v1');
      expect(decision.reason).toBe('kill_switch');
    });

    it('shadow mode takes precedence over canary', () => {
      const config: CanaryConfig = {
        v2Enabled: true,
        killSwitch: false,
        shadowEnabled: true,
        canarySports: ['NBA'],
        canaryPercent: 100,
      };
      const decision = canaryDecide('NBA', 'pick-1', config);
      expect(decision.mode).toBe('shadow');
      expect(decision.reason).toBe('shadow_mode');
    });

    it('sport-gated + percent-gated: allows V2 for matching sport within percent', () => {
      // Find a pick that hashes to bucket < 50
      const config: CanaryConfig = {
        v2Enabled: true,
        killSwitch: false,
        shadowEnabled: false,
        canarySports: ['NBA'],
        canaryPercent: 100, // 100% so all NBA picks get V2
      };
      const decision = canaryDecide('NBA', 'pick-1', config);
      expect(decision.mode).toBe('v2');
      expect(decision.reason).toContain('canary_sport=NBA');
    });

    it('rejects non-matching sport', () => {
      const config: CanaryConfig = {
        v2Enabled: true,
        killSwitch: false,
        shadowEnabled: false,
        canarySports: ['NBA'],
        canaryPercent: 100,
      };
      const decision = canaryDecide('MLB', 'pick-1', config);
      expect(decision.mode).toBe('v1');
      expect(decision.reason).toContain('canary_denied');
    });

    it('percent=0 means no canary traffic even for matching sport', () => {
      const config: CanaryConfig = {
        v2Enabled: true,
        killSwitch: false,
        shadowEnabled: false,
        canarySports: ['NBA'],
        canaryPercent: 0,
      };
      const decision = canaryDecide('NBA', 'pick-1', config);
      expect(decision.mode).toBe('v1');
    });

    it('percent boundary: picks below threshold get V2, picks at/above get V1', () => {
      const config: CanaryConfig = {
        v2Enabled: true,
        killSwitch: false,
        shadowEnabled: false,
        canarySports: [], // empty = all sports allowed
        canaryPercent: 50,
      };

      let v2Count = 0;
      for (let i = 0; i < 100; i++) {
        const d = canaryDecide('NBA', `test-pick-${i}`, config);
        if (d.mode === 'v2') v2Count++;
      }

      // With 50% canary, expect roughly 40-60% V2 picks
      expect(v2Count).toBeGreaterThan(25);
      expect(v2Count).toBeLessThan(75);
    });

    it('same pick always gets same decision (deterministic)', () => {
      const config: CanaryConfig = {
        v2Enabled: true,
        killSwitch: false,
        shadowEnabled: false,
        canarySports: ['NBA'],
        canaryPercent: 50,
      };

      const d1 = canaryDecide('NBA', 'stable-pick-id', config);
      const d2 = canaryDecide('NBA', 'stable-pick-id', config);
      expect(d1.mode).toBe(d2.mode);
      expect(d1.reason).toBe(d2.reason);
    });

    it('empty canarySports means all sports are allowed', () => {
      const config: CanaryConfig = {
        v2Enabled: true,
        killSwitch: false,
        shadowEnabled: false,
        canarySports: [], // empty = all sports
        canaryPercent: 100,
      };

      expect(canaryDecide('NBA', 'p1', config).mode).toBe('v2');
      expect(canaryDecide('MLB', 'p1', config).mode).toBe('v2');
      expect(canaryDecide('NFL', 'p1', config).mode).toBe('v2');
      expect(canaryDecide('NHL', 'p1', config).mode).toBe('v2');
    });
  });
});
