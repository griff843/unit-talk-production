/**
 * promotionPolicy.test.ts — Unit tests for Tranche 7+10 promotion policy
 *
 * Tests:
 * 1. HARD band classification rules
 * 2. SOFT band classification rules
 * 3. NONE band classification rules
 * 4. Kill switch forces no promotion
 * 5. Policy disabled returns promote=false
 * 6. Canary gating (sport + percent)
 * 7. Critical data gap detection
 * 8. Confidence and EV mapping
 * 9. Fail-closed behavior
 * 10. SOFT auto-promote toggle
 * 11. HARD-only enforcement (Tranche 10)
 */

import {
  evaluatePromotion,
  parsePromotionPolicyConfig,
  classifyBand,
  scoreToConfidence,
  evToDecimal,
  findCriticalDataGaps,
  passesPromotionCanary,
  PromotionPolicyConfig,
} from '../../src/agents/GradingAgent/scoring/promotionPolicy';
import type { ComputeScoreV2Result } from '../../src/agents/GradingAgent/scoring/computeScoreV2';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeV2Result(overrides: Partial<ComputeScoreV2Result> = {}): ComputeScoreV2Result {
  return {
    score: 75,
    tier: 'A' as any,
    ev: 5,
    breakdown: {
      expectedValue: { raw: 5, normalized: 55, weight: 0.15, contribution: 8.25 },
      matchupRating: { raw: 80, normalized: 80, weight: 0.12, contribution: 9.6 },
      playerForm: { raw: 85, normalized: 85, weight: 0.1, contribution: 8.5 },
    },
    feature_audit: {
      expectedValue: { present: true, fallbackUsed: false, fallbackPolicy: 'neutral', rawValue: 5 },
      matchupRating: {
        present: true,
        fallbackUsed: false,
        fallbackPolicy: 'neutral',
        rawValue: 80,
      },
      playerForm: { present: true, fallbackUsed: false, fallbackPolicy: 'neutral', rawValue: 85 },
      marketIntelligence: {
        present: true,
        fallbackUsed: false,
        fallbackPolicy: 'neutral',
        rawValue: 60,
      },
      sharpMoney: { present: true, fallbackUsed: false, fallbackPolicy: 'neutral', rawValue: 70 },
      closingLineValue: {
        present: true,
        fallbackUsed: false,
        fallbackPolicy: 'neutral',
        rawValue: 4,
      },
    },
    ...overrides,
  };
}

function makePolicyConfig(overrides: Partial<PromotionPolicyConfig> = {}): PromotionPolicyConfig {
  return {
    policyEnabled: true,
    killSwitch: false,
    softEnable: false,
    hardOnly: false,
    hardMinEv: 0.01,
    hardMinConf: 7,
    canaryPercent: 100,
    canarySports: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('promotionPolicy', () => {
  describe('scoreToConfidence', () => {
    it('maps score 70 to confidence 7.0', () => {
      expect(scoreToConfidence(70)).toBe(7);
    });

    it('maps score 85 to confidence 8.5', () => {
      expect(scoreToConfidence(85)).toBe(8.5);
    });

    it('maps score 0 to confidence 0', () => {
      expect(scoreToConfidence(0)).toBe(0);
    });

    it('maps score 100 to confidence 10', () => {
      expect(scoreToConfidence(100)).toBe(10);
    });
  });

  describe('evToDecimal', () => {
    it('converts 5% to 0.05', () => {
      expect(evToDecimal(5)).toBe(0.05);
    });

    it('converts 1% to 0.01', () => {
      expect(evToDecimal(1)).toBe(0.01);
    });

    it('converts negative EV', () => {
      expect(evToDecimal(-10)).toBe(-0.1);
    });
  });

  describe('parsePromotionPolicyConfig', () => {
    it('defaults to all-off when env is empty', () => {
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

    it('parses all flags correctly', () => {
      const config = parsePromotionPolicyConfig({
        PROMOTION_POLICY_V2: 'true',
        PROMOTION_KILL_SWITCH: 'true',
        PROMOTION_SOFT_ENABLE: 'true',
        PROMOTION_HARD_ONLY: 'true',
        PROMOTION_HARD_MIN_EV: '0.02',
        PROMOTION_HARD_MIN_CONF: '8',
        PROMOTION_CANARY_PERCENT: '25',
        PROMOTION_CANARY_SPORTS: 'NBA,MLB',
      });
      expect(config.policyEnabled).toBe(true);
      expect(config.killSwitch).toBe(true);
      expect(config.softEnable).toBe(true);
      expect(config.hardOnly).toBe(true);
      expect(config.hardMinEv).toBe(0.02);
      expect(config.hardMinConf).toBe(8);
      expect(config.canaryPercent).toBe(25);
      expect(config.canarySports).toEqual(['NBA', 'MLB']);
    });

    it('clamps confidence to 0-10', () => {
      expect(parsePromotionPolicyConfig({ PROMOTION_HARD_MIN_CONF: '15' }).hardMinConf).toBe(10);
      expect(parsePromotionPolicyConfig({ PROMOTION_HARD_MIN_CONF: '-3' }).hardMinConf).toBe(0);
    });
  });

  describe('findCriticalDataGaps', () => {
    it('returns empty when all critical features present', () => {
      const audit = {
        expectedValue: {
          present: true,
          fallbackUsed: false,
          fallbackPolicy: 'neutral',
          rawValue: 5,
        },
        matchupRating: {
          present: true,
          fallbackUsed: false,
          fallbackPolicy: 'neutral',
          rawValue: 80,
        },
        marketIntelligence: {
          present: true,
          fallbackUsed: false,
          fallbackPolicy: 'neutral',
          rawValue: 60,
        },
      };
      expect(findCriticalDataGaps(audit)).toEqual([]);
    });

    it('detects fallback on core group features', () => {
      const audit = {
        expectedValue: {
          present: false,
          fallbackUsed: true,
          fallbackPolicy: 'neutral',
          rawValue: undefined,
        },
        matchupRating: {
          present: true,
          fallbackUsed: false,
          fallbackPolicy: 'neutral',
          rawValue: 80,
        },
      };
      const gaps = findCriticalDataGaps(audit);
      expect(gaps).toContain('expectedValue');
    });

    it('detects fallback on market group features', () => {
      const audit = {
        marketIntelligence: {
          present: false,
          fallbackUsed: true,
          fallbackPolicy: 'neutral',
          rawValue: undefined,
        },
        sharpMoney: {
          present: false,
          fallbackUsed: true,
          fallbackPolicy: 'neutral',
          rawValue: undefined,
        },
      };
      const gaps = findCriticalDataGaps(audit);
      expect(gaps).toContain('marketIntelligence');
      expect(gaps).toContain('sharpMoney');
    });

    it('ignores fallback on non-critical groups', () => {
      const audit = {
        playerFatigue: {
          present: false,
          fallbackUsed: true,
          fallbackPolicy: 'neutral',
          rawValue: undefined,
        },
        correlationRisk: {
          present: false,
          fallbackUsed: true,
          fallbackPolicy: 'neutral',
          rawValue: undefined,
        },
      };
      expect(findCriticalDataGaps(audit)).toEqual([]);
    });
  });

  describe('classifyBand', () => {
    const config = makePolicyConfig();

    it('HARD band: S-tier + EV >= 1% + confidence >= 7', () => {
      const result = makeV2Result({ score: 75, tier: 'S' as any, ev: 5 });
      const { band } = classifyBand(result, config);
      expect(band).toBe('HARD');
    });

    it('HARD band: A-tier + EV >= 1% + confidence >= 7', () => {
      const result = makeV2Result({ score: 72, tier: 'A' as any, ev: 3 });
      const { band } = classifyBand(result, config);
      expect(band).toBe('HARD');
    });

    it('SOFT band: A-tier + EV < 1% + confidence >= 6', () => {
      const result = makeV2Result({ score: 65, tier: 'A' as any, ev: 0.5 });
      const { band } = classifyBand(result, config);
      expect(band).toBe('SOFT');
    });

    it('SOFT band: B-tier + positive EV + confidence >= 6', () => {
      const result = makeV2Result({ score: 62, tier: 'B' as any, ev: 0.8 });
      const { band } = classifyBand(result, config);
      expect(band).toBe('SOFT');
    });

    it('NONE band: C-tier', () => {
      const result = makeV2Result({ score: 35, tier: 'C' as any, ev: 2 });
      const { band } = classifyBand(result, config);
      expect(band).toBe('NONE');
    });

    it('NONE band: D-tier', () => {
      const result = makeV2Result({ score: 20, tier: 'D' as any, ev: -5 });
      const { band } = classifyBand(result, config);
      expect(band).toBe('NONE');
    });

    it('NONE band: A-tier but negative EV and low confidence', () => {
      const result = makeV2Result({ score: 52, tier: 'A' as any, ev: -2 });
      const { band } = classifyBand(result, config);
      expect(band).toBe('NONE');
    });

    it('NONE band when critical data gaps exist', () => {
      const result = makeV2Result({
        score: 80,
        tier: 'S' as any,
        ev: 10,
        feature_audit: {
          expectedValue: {
            present: false,
            fallbackUsed: true,
            fallbackPolicy: 'neutral',
            rawValue: undefined as any,
          },
          matchupRating: {
            present: true,
            fallbackUsed: false,
            fallbackPolicy: 'neutral',
            rawValue: 80,
          },
        },
      });
      const { band, reasons } = classifyBand(result, config);
      expect(band).toBe('NONE');
      expect(reasons[0]).toContain('critical_data_gaps');
    });
  });

  describe('passesPromotionCanary', () => {
    it('passes when canary 100% and empty sports list', () => {
      const config = makePolicyConfig({ canaryPercent: 100, canarySports: [] });
      expect(passesPromotionCanary('NBA', 'test-pick', config)).toBe(true);
    });

    it('fails when canary 0%', () => {
      const config = makePolicyConfig({ canaryPercent: 0, canarySports: [] });
      expect(passesPromotionCanary('NBA', 'test-pick', config)).toBe(false);
    });

    it('fails when sport not in allowed list', () => {
      const config = makePolicyConfig({ canaryPercent: 100, canarySports: ['NBA'] });
      expect(passesPromotionCanary('MLB', 'test-pick', config)).toBe(false);
    });

    it('passes when sport matches', () => {
      const config = makePolicyConfig({ canaryPercent: 100, canarySports: ['NBA'] });
      expect(passesPromotionCanary('NBA', 'test-pick', config)).toBe(true);
    });
  });

  describe('evaluatePromotion', () => {
    it('kill switch forces promote=false regardless', () => {
      const result = makeV2Result({ score: 95, tier: 'S' as any, ev: 20 });
      const config = makePolicyConfig({ killSwitch: true });
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);
      expect(decision.promote).toBe(false);
      expect(decision.band).toBe('NONE');
      expect(decision.reason_codes).toContain('kill_switch');
    });

    it('policy disabled returns promote=false', () => {
      const result = makeV2Result({ score: 95, tier: 'S' as any, ev: 20 });
      const config = makePolicyConfig({ policyEnabled: false });
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);
      expect(decision.promote).toBe(false);
      expect(decision.reason_codes).toContain('policy_disabled');
    });

    it('HARD band auto-promotes', () => {
      const result = makeV2Result({ score: 78, tier: 'S' as any, ev: 8 });
      const config = makePolicyConfig();
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);
      expect(decision.promote).toBe(true);
      expect(decision.band).toBe('HARD');
    });

    it('SOFT band does NOT promote when softEnable=false', () => {
      const result = makeV2Result({ score: 65, tier: 'A' as any, ev: 0.5 });
      const config = makePolicyConfig({ softEnable: false });
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);
      expect(decision.promote).toBe(false);
      expect(decision.band).toBe('SOFT');
      expect(decision.reason_codes).toContain('soft_auto_disabled');
    });

    it('SOFT band promotes when softEnable=true', () => {
      const result = makeV2Result({ score: 65, tier: 'A' as any, ev: 0.5 });
      const config = makePolicyConfig({ softEnable: true });
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);
      expect(decision.promote).toBe(true);
      expect(decision.band).toBe('SOFT');
    });

    it('canary gating blocks promotion for non-matching sport', () => {
      const result = makeV2Result({ score: 80, tier: 'S' as any, ev: 10 });
      const config = makePolicyConfig({ canarySports: ['NBA'] });
      const decision = evaluatePromotion(result, 'MLB', 'pick-1', config);
      expect(decision.promote).toBe(false);
      expect(decision.reason_codes[0]).toContain('canary_denied');
    });

    it('fail-closed: missing result fields', () => {
      const config = makePolicyConfig();
      const decision = evaluatePromotion(null as any, 'NBA', 'pick-1', config);
      expect(decision.promote).toBe(false);
      expect(decision.reason_codes).toContain('missing_required_fields');
    });

    it('NONE band never promotes even with softEnable', () => {
      const result = makeV2Result({ score: 30, tier: 'D' as any, ev: -10 });
      const config = makePolicyConfig({ softEnable: true });
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);
      expect(decision.promote).toBe(false);
      expect(decision.band).toBe('NONE');
    });

    it('shadow mode should never promote on V2 unless PROMOTION_POLICY_V2=true', () => {
      const result = makeV2Result({ score: 90, tier: 'S' as any, ev: 15 });
      // Default config: policyEnabled=false
      const config = makePolicyConfig({ policyEnabled: false });
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);
      expect(decision.promote).toBe(false);
      expect(decision.reason_codes).toContain('policy_disabled');
    });

    // ─── Tranche 10: HARD-only enforcement ─────────────────────────────

    it('hardOnly=true blocks SOFT even when softEnable=true', () => {
      const result = makeV2Result({ score: 65, tier: 'A' as any, ev: 0.5 });
      const config = makePolicyConfig({ hardOnly: true, softEnable: true });
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);
      expect(decision.promote).toBe(false);
      expect(decision.band).toBe('SOFT');
      expect(decision.reason_codes).toContain('hard_only_enforced');
    });

    it('hardOnly=true still allows HARD promotion', () => {
      const result = makeV2Result({ score: 78, tier: 'S' as any, ev: 8 });
      const config = makePolicyConfig({ hardOnly: true });
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);
      expect(decision.promote).toBe(true);
      expect(decision.band).toBe('HARD');
    });

    it('hardOnly=true blocks NONE band', () => {
      const result = makeV2Result({ score: 30, tier: 'D' as any, ev: -10 });
      const config = makePolicyConfig({ hardOnly: true });
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);
      expect(decision.promote).toBe(false);
      expect(decision.band).toBe('NONE');
      expect(decision.reason_codes).toContain('hard_only_enforced');
    });

    it('hardOnly=false has no effect on existing SOFT behavior', () => {
      const result = makeV2Result({ score: 65, tier: 'A' as any, ev: 0.5 });
      const config = makePolicyConfig({ hardOnly: false, softEnable: true });
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);
      expect(decision.promote).toBe(true);
      expect(decision.band).toBe('SOFT');
    });
  });
});
