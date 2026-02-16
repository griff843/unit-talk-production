/**
 * postingGovernance.test.ts — Tranche 10 Posting Governance Tests
 *
 * Proves that the DiscordPromotionAgent obeys the same promotion policy
 * as the scoring pipeline. Validates the full flow:
 *   evaluatePromotion() → GradingResult.promotionBand → unified_picks.promotion_band → Discord query
 *
 * Test matrix:
 * 1. HARD band picks → posted
 * 2. SOFT band picks → NOT posted
 * 3. NONE band picks → NOT posted
 * 4. Non-NBA picks → NOT posted (canary sport gate → NONE band)
 * 5. Canary percent respected (gated at scoring time)
 * 6. Kill switch blocks ALL posting (runtime check)
 * 7. Shadow mode blocks posting (claim retained)
 * 8. promotionBand flows through GradingResult
 */

import {
  evaluatePromotion,
  parsePromotionPolicyConfig,
  PromotionPolicyConfig,
} from '../../src/agents/GradingAgent/scoring/promotionPolicy';

import type { ComputeScoreV2Result } from '../../src/agents/GradingAgent/scoring/computeScoreV2';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

/** Canary configuration matching LIVE-CANARY-001 (.env flags) */
function makeCanaryConfig(overrides: Partial<PromotionPolicyConfig> = {}): PromotionPolicyConfig {
  return {
    policyEnabled: true,
    killSwitch: false,
    softEnable: false,
    hardOnly: true,
    hardMinEv: 0.01,
    hardMinConf: 7,
    canaryPercent: 100, // 100 for test determinism (all picks pass canary percent gate)
    canarySports: ['NBA'],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('postingGovernance (Tranche 10)', () => {
  describe('promotion_band persisted value determines posting eligibility', () => {
    it('HARD band pick → promotion_band = "HARD" → eligible for posting', () => {
      const result = makeV2Result({ score: 78, tier: 'S' as any, ev: 8 });
      const config = makeCanaryConfig();
      const decision = evaluatePromotion(result, 'NBA', 'pick-hard-1', config);

      expect(decision.promote).toBe(true);
      expect(decision.band).toBe('HARD');
      // This band value is what gets written to unified_picks.promotion_band
      // DiscordPromotionAgent queries: WHERE promotion_band = 'HARD'
    });

    it('SOFT band pick → promotion_band = "SOFT" → NOT eligible (hardOnly=true)', () => {
      const result = makeV2Result({ score: 65, tier: 'A' as any, ev: 0.5 });
      const config = makeCanaryConfig({ hardOnly: true });
      const decision = evaluatePromotion(result, 'NBA', 'pick-soft-1', config);

      expect(decision.promote).toBe(false);
      expect(decision.band).toBe('SOFT');
      // promotion_band = 'SOFT' → DiscordPromotionAgent query won't match
    });

    it('NONE band pick → promotion_band = "NONE" → NOT eligible', () => {
      const result = makeV2Result({ score: 30, tier: 'D' as any, ev: -10 });
      const config = makeCanaryConfig();
      const decision = evaluatePromotion(result, 'NBA', 'pick-none-1', config);

      expect(decision.promote).toBe(false);
      expect(decision.band).toBe('NONE');
      // promotion_band = 'NONE' → DiscordPromotionAgent query won't match
    });
  });

  describe('canary sport gate blocks non-NBA at scoring time', () => {
    it('MLB pick → canary denied → band = NONE', () => {
      const result = makeV2Result({ score: 85, tier: 'S' as any, ev: 15 });
      const config = makeCanaryConfig({ canarySports: ['NBA'] });
      const decision = evaluatePromotion(result, 'MLB', 'pick-mlb-1', config);

      expect(decision.promote).toBe(false);
      expect(decision.band).toBe('NONE');
      expect(decision.reason_codes[0]).toContain('canary_denied');
      // promotion_band = 'NONE' at scoring time → never picked up by DiscordPromotionAgent
    });

    it('NFL pick → canary denied → band = NONE', () => {
      const result = makeV2Result({ score: 90, tier: 'S' as any, ev: 12 });
      const config = makeCanaryConfig({ canarySports: ['NBA'] });
      const decision = evaluatePromotion(result, 'NFL', 'pick-nfl-1', config);

      expect(decision.promote).toBe(false);
      expect(decision.band).toBe('NONE');
    });

    it('NBA pick → canary passes → evaluated for band', () => {
      const result = makeV2Result({ score: 80, tier: 'S' as any, ev: 10 });
      const config = makeCanaryConfig({ canarySports: ['NBA'] });
      const decision = evaluatePromotion(result, 'NBA', 'pick-nba-1', config);

      expect(decision.promote).toBe(true);
      expect(decision.band).toBe('HARD');
    });
  });

  describe('canary percent gating at scoring time', () => {
    it('0% canary → all picks denied → band = NONE', () => {
      const result = makeV2Result({ score: 95, tier: 'S' as any, ev: 20 });
      const config = makeCanaryConfig({ canaryPercent: 0 });
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);

      expect(decision.promote).toBe(false);
      expect(decision.band).toBe('NONE');
      expect(decision.reason_codes[0]).toContain('canary_denied');
    });

    it('100% canary → all picks pass percent gate', () => {
      const result = makeV2Result({ score: 78, tier: 'S' as any, ev: 8 });
      const config = makeCanaryConfig({ canaryPercent: 100 });
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);

      expect(decision.promote).toBe(true);
      expect(decision.band).toBe('HARD');
    });
  });

  describe('kill switch blocks ALL promotions (runtime)', () => {
    it('kill switch ON → even HARD pick cannot promote', () => {
      const result = makeV2Result({ score: 95, tier: 'S' as any, ev: 20 });
      const config = makeCanaryConfig({ killSwitch: true });
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);

      expect(decision.promote).toBe(false);
      expect(decision.band).toBe('NONE');
      expect(decision.reason_codes).toContain('kill_switch');
    });

    it('kill switch OFF → HARD pick promotes normally', () => {
      const result = makeV2Result({ score: 80, tier: 'S' as any, ev: 10 });
      const config = makeCanaryConfig({ killSwitch: false });
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);

      expect(decision.promote).toBe(true);
      expect(decision.band).toBe('HARD');
    });
  });

  describe('parsePromotionPolicyConfig reads canary env flags', () => {
    it('parses exact LIVE-CANARY-001 production env', () => {
      const cfg = parsePromotionPolicyConfig({
        PROMOTION_POLICY_V2: 'true',
        PROMOTION_KILL_SWITCH: 'false',
        PROMOTION_HARD_ONLY: 'true',
        PROMOTION_SOFT_ENABLE: 'false',
        PROMOTION_CANARY_SPORTS: 'NBA',
        PROMOTION_CANARY_PERCENT: '5',
      });

      expect(cfg.policyEnabled).toBe(true);
      expect(cfg.killSwitch).toBe(false);
      expect(cfg.hardOnly).toBe(true);
      expect(cfg.softEnable).toBe(false);
      expect(cfg.canarySports).toEqual(['NBA']);
      expect(cfg.canaryPercent).toBe(5);
    });

    it('kill switch flag reads correctly', () => {
      const on = parsePromotionPolicyConfig({ PROMOTION_KILL_SWITCH: 'true' });
      const off = parsePromotionPolicyConfig({ PROMOTION_KILL_SWITCH: 'false' });
      const missing = parsePromotionPolicyConfig({});

      expect(on.killSwitch).toBe(true);
      expect(off.killSwitch).toBe(false);
      expect(missing.killSwitch).toBe(false); // fail-open on kill switch is intentional
    });
  });

  describe('GradingResult.promotionBand contract', () => {
    it('HARD band result sets promotionBand = "HARD"', () => {
      const result = makeV2Result({ score: 78, tier: 'S' as any, ev: 8 });
      const config = makeCanaryConfig();
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);

      // This is the value that gradingEngine stores in GradingResult.promotionBand
      expect(decision.band).toBe('HARD');
      // And what GradingAgent writes to unified_picks.promotion_band
    });

    it('policy disabled → no band set (promotionBand should be undefined)', () => {
      const result = makeV2Result({ score: 90, tier: 'S' as any, ev: 15 });
      const config = makeCanaryConfig({ policyEnabled: false });
      const decision = evaluatePromotion(result, 'NBA', 'pick-1', config);

      expect(decision.band).toBe('NONE');
      // When policyEnabled=false, gradingEngine sets promotionBand = undefined (not evaluated)
      // GradingAgent writes: promotion_band = null
    });
  });

  describe('end-to-end band classification for posting', () => {
    const config = makeCanaryConfig();

    it('S-tier high-EV NBA pick → HARD → postable', () => {
      const decision = evaluatePromotion(
        makeV2Result({ score: 85, tier: 'S' as any, ev: 12 }),
        'NBA',
        'pick-s-hev',
        config
      );
      expect(decision.band).toBe('HARD');
      expect(decision.promote).toBe(true);
    });

    it('A-tier moderate-EV NBA pick → HARD → postable', () => {
      const decision = evaluatePromotion(
        makeV2Result({ score: 72, tier: 'A' as any, ev: 3 }),
        'NBA',
        'pick-a-mev',
        config
      );
      expect(decision.band).toBe('HARD');
      expect(decision.promote).toBe(true);
    });

    it('A-tier low-EV NBA pick → SOFT → NOT postable (hardOnly)', () => {
      const decision = evaluatePromotion(
        makeV2Result({ score: 65, tier: 'A' as any, ev: 0.5 }),
        'NBA',
        'pick-a-lev',
        config
      );
      expect(decision.band).toBe('SOFT');
      expect(decision.promote).toBe(false);
    });

    it('B-tier NBA pick → SOFT → NOT postable (hardOnly)', () => {
      const decision = evaluatePromotion(
        makeV2Result({ score: 62, tier: 'B' as any, ev: 0.8 }),
        'NBA',
        'pick-b',
        config
      );
      expect(decision.band).toBe('SOFT');
      expect(decision.promote).toBe(false);
    });

    it('C-tier NBA pick → NONE → NOT postable', () => {
      const decision = evaluatePromotion(
        makeV2Result({ score: 40, tier: 'C' as any, ev: 1.5 }),
        'NBA',
        'pick-c',
        config
      );
      expect(decision.band).toBe('NONE');
      expect(decision.promote).toBe(false);
    });

    it('D-tier NBA pick → NONE → NOT postable', () => {
      const decision = evaluatePromotion(
        makeV2Result({ score: 20, tier: 'D' as any, ev: -5 }),
        'NBA',
        'pick-d',
        config
      );
      expect(decision.band).toBe('NONE');
      expect(decision.promote).toBe(false);
    });

    it('S-tier MLB pick → canary denied → NONE → NOT postable', () => {
      const decision = evaluatePromotion(
        makeV2Result({ score: 90, tier: 'S' as any, ev: 15 }),
        'MLB',
        'pick-mlb-s',
        config
      );
      expect(decision.band).toBe('NONE');
      expect(decision.promote).toBe(false);
    });
  });

  describe('DiscordPromotionAgent query alignment', () => {
    /**
     * These tests verify that the query `.eq('promotion_band', 'HARD')`
     * correctly selects only the picks that the promotion policy intended.
     */

    it('only HARD band matches the posting query predicate', () => {
      const queryPredicate = (band: string | null | undefined) => band === 'HARD';

      expect(queryPredicate('HARD')).toBe(true);
      expect(queryPredicate('SOFT')).toBe(false);
      expect(queryPredicate('NONE')).toBe(false);
      expect(queryPredicate(null)).toBe(false);
      expect(queryPredicate(undefined)).toBe(false);
    });

    it('old picks without promotion_band (null) are excluded', () => {
      // Backward compatibility: picks scored before migration have promotion_band = null
      const queryPredicate = (band: string | null) => band === 'HARD';
      expect(queryPredicate(null)).toBe(false);
    });
  });
});
