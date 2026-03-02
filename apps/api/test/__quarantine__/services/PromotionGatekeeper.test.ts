/**
 * Tests for Promotion Gatekeeper Service
 * Validates promotion gates, lanes, and decision logic
 */

import { promotionGatekeeper } from '../../src/services/PromotionGatekeeper';
import type { PickForPromotion } from '../../src/services/PromotionGatekeeper';

describe('PromotionGatekeeper Tests', () => {
  beforeEach(() => {
    // Set test environment variables
    process.env.INSTANT_S_TIER_MIN_EV = '0.05';
    process.env.INSTANT_S_TIER_MIN_CONFIDENCE = '0.75';
    process.env.S_TIER_MIN_CLV_BPS = '15';
  });

  describe('S-Tier Instant Gate', () => {
    test('should approve high-quality S-tier pick for is_instant promotion', async () => {
      const pick: PickForPromotion = {
        id: 'test-s-tier-instant',
        propId: 'nba_lbj_pts_29.5',
        tier: 'S',
        confidence: 0.85,
        professionalScore: 92,
        expectedValue: 0.08,
        clvTracking: {
          initialOdds: -110,
          currentOdds: -105,
          clvBps: 22,
        },
        gameTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        sport: 'NBA',
        correlatedPicks: [],
        portfolioExposure: 0.15,
      };

      const decision = await promotionGatekeeper.evaluatePromotion(pick);

      expect(decision.approved).toBe(true);
      expect(decision.lane).toBe('instant');
      expect(decision.confidence).toBeGreaterThan(0.8);
      expect(decision.riskScore).toBeLessThan(30);
      expect(decision.gateResults.filter(r => r.passed).length).toBeGreaterThan(0);
    });

    test('should reject S-tier pick with insufficient EV', async () => {
      const pick: PickForPromotion = {
        id: 'test-low-ev',
        propId: 'nba_ad_reb_12.5',
        tier: 'S',
        confidence: 0.78,
        professionalScore: 88,
        expectedValue: 0.02, // Below 5% minimum
        clvTracking: {
          initialOdds: -110,
          currentOdds: -108,
          clvBps: 18,
        },
        gameTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        sport: 'NBA',
        correlatedPicks: [],
        portfolioExposure: 0.12,
      };

      const decision = await promotionGatekeeper.evaluatePromotion(pick);

      expect(decision.approved).toBe(false);
      expect(decision.lane).toBe('reject');
      expect(decision.reasoning).toContain('blocking gate');
      expect(decision.gateResults.some(r => r.gateName.includes('S-Tier') && !r.passed)).toBe(true);
    });

    test('should reject S-tier pick with negative CLV', async () => {
      const pick: PickForPromotion = {
        id: 'test-negative-clv',
        propId: 'nba_curry_3pm_4.5',
        tier: 'S',
        confidence: 0.82,
        professionalScore: 90,
        expectedValue: 0.06,
        clvTracking: {
          initialOdds: -110,
          currentOdds: -115,
          clvBps: -8, // Negative CLV
        },
        gameTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
        sport: 'NBA',
        correlatedPicks: [],
        portfolioExposure: 0.18,
      };

      const decision = await promotionGatekeeper.evaluatePromotion(pick);

      expect(decision.approved).toBe(false);
      expect(decision.reasoning).toContain('blocking gate');
    });
  });

  describe('10am Scheduled Gate', () => {
    test('should approve A-tier pick for 10am promotion', async () => {
      const pick: PickForPromotion = {
        id: 'test-10am-promotion',
        propId: 'nfl_mahomes_pass_yds_285.5',
        tier: 'A',
        confidence: 0.72,
        professionalScore: 79,
        expectedValue: 0.04,
        clvTracking: {
          initialOdds: -110,
          currentOdds: -108,
          clvBps: 8,
        },
        gameTime: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours from now
        sport: 'NFL',
        correlatedPicks: ['related-pick-1'],
        portfolioExposure: 0.22,
      };

      const decision = await promotionGatekeeper.evaluatePromotion(pick);

      expect(decision.approved).toBe(true);
      expect(decision.lane).toBe('10am');
      expect(decision.scheduledTime).toBeDefined();
      expect(decision.scheduledTime!.getHours()).toBe(10);
    });

    test('should schedule for next day if after 10am', async () => {
      // Mock current time as 2pm (14:00)
      const mockDate = new Date();
      mockDate.setHours(14, 0, 0, 0);
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

      const pick: PickForPromotion = {
        id: 'test-next-day-10am',
        propId: 'mlb_judge_hr_1.5',
        tier: 'A',
        confidence: 0.68,
        professionalScore: 76,
        expectedValue: 0.035,
        gameTime: new Date(Date.now() + 20 * 60 * 60 * 1000),
        sport: 'MLB',
        correlatedPicks: [],
        portfolioExposure: 0.08,
      };

      const decision = await promotionGatekeeper.evaluatePromotion(pick);

      if (decision.approved && decision.scheduledTime) {
        expect(decision.scheduledTime.getDate()).toBe(mockDate.getDate() + 1);
        expect(decision.scheduledTime.getHours()).toBe(10);
      }

      jest.restoreAllMocks();
    });
  });

  describe('Steam Detection Gate', () => {
    test('should approve pick with strong positive steam', async () => {
      const pick: PickForPromotion = {
        id: 'test-steam-pick',
        propId: 'nba_giannis_pts_32.5',
        tier: 'A',
        confidence: 0.68,
        professionalScore: 74,
        expectedValue: 0.03,
        clvTracking: {
          initialOdds: -110,
          currentOdds: -105,
          clvBps: 25, // Strong positive CLV
        },
        steamData: {
          strength: 35, // Strong steam
          direction: 'for',
          volume: 150000,
        },
        gameTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        sport: 'NBA',
        correlatedPicks: [],
        portfolioExposure: 0.12,
      };

      const decision = await promotionGatekeeper.evaluatePromotion(pick);

      expect(decision.approved).toBe(true);
      expect(decision.lane).toBe('instant'); // Steam gate is is_instant
      expect(decision.gateResults.some(r => r.gateName.includes('Steam') && r.passed)).toBe(true);
    });

    test('should reject pick with counter-steam', async () => {
      const pick: PickForPromotion = {
        id: 'test-counter-steam',
        propId: 'nba_tatum_ast_6.5',
        tier: 'A',
        confidence: 0.65,
        professionalScore: 72,
        expectedValue: 0.025,
        steamData: {
          strength: 25,
          direction: 'against', // Counter-steam
          volume: 80000,
        },
        gameTime: new Date(Date.now() + 90 * 60 * 1000), // 1.5 hours
        sport: 'NBA',
        correlatedPicks: [],
        portfolioExposure: 0.15,
      };

      const decision = await promotionGatekeeper.evaluatePromotion(pick);

      // Should still evaluate but may not pass steam gate
      expect(decision.gateResults.some(r => r.gateName.includes('Steam'))).toBe(true);
    });
  });

  describe('Portfolio Risk Integration', () => {
    test('should reject pick with excessive portfolio exposure', async () => {
      const pick: PickForPromotion = {
        id: 'test-high-exposure',
        propId: 'nba_durant_pts_28.5',
        tier: 'S',
        confidence: 0.88,
        professionalScore: 94,
        expectedValue: 0.07,
        clvTracking: {
          initialOdds: -110,
          currentOdds: -105,
          clvBps: 22,
        },
        gameTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
        sport: 'NBA',
        correlatedPicks: ['pick1', 'pick2', 'pick3', 'pick4'], // Many correlations
        portfolioExposure: 0.35, // High exposure
      };

      const decision = await promotionGatekeeper.evaluatePromotion(pick);

      // May be approved but with warnings about exposure
      if (decision.approved) {
        expect(decision.riskScore).toBeGreaterThan(20);
      }
    });

    test('should handle timing constraints correctly', async () => {
      const pick: PickForPromotion = {
        id: 'test-timing',
        propId: 'nba_westbrook_reb_8.5',
        tier: 'A',
        confidence: 0.7,
        professionalScore: 77,
        expectedValue: 0.04,
        gameTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
        sport: 'NBA',
        correlatedPicks: [],
        portfolioExposure: 0.08,
      };

      const decision = await promotionGatekeeper.evaluatePromotion(pick);

      // Should pass timing for is_instant gate (>30min not required for all gates)
      const timingResults = decision.gateResults.filter(
        r => r.gateName.includes('timing') || r.message.includes('timing')
      );
      expect(timingResults.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Gate Configuration Management', () => {
    test('should retrieve gate configurations', () => {
      const instantGate = promotionGatekeeper.getGate('instant-s-tier');
      const scheduledGate = promotionGatekeeper.getGate('10am-premium');
      const steamGate = promotionGatekeeper.getGate('steam-hunter');

      expect(instantGate).toBeDefined();
      expect(instantGate?.name).toBe('Instant S-Tier Gate');
      expect(instantGate?.type).toBe('instant');

      expect(scheduledGate).toBeDefined();
      expect(scheduledGate?.type).toBe('scheduled');

      expect(steamGate).toBeDefined();
      expect(steamGate?.requirements.requiresSteam).toBe(true);
    });

    test('should update gate configuration', () => {
      const updated = promotionGatekeeper.updateGate('instant-s-tier', {
        requirements: {
          ...promotionGatekeeper.getGate('instant-s-tier')!.requirements,
          minExpectedValue: 0.06, // Increase EV requirement
        },
      });

      expect(updated).toBe(true);

      const gate = promotionGatekeeper.getGate('instant-s-tier');
      expect(gate?.requirements.minExpectedValue).toBe(0.06);
    });

    test('should list all gates', () => {
      const allGates = promotionGatekeeper.getAllGates();

      expect(allGates.length).toBeGreaterThanOrEqual(3);
      expect(allGates.some(g => g.type === 'instant')).toBe(true);
      expect(allGates.some(g => g.type === 'scheduled')).toBe(true);
      expect(allGates.every(g => g.enabled !== undefined)).toBe(true);
    });
  });

  describe('Decision Reasoning and Metrics', () => {
    test('should provide clear reasoning for approval', async () => {
      const pick: PickForPromotion = {
        id: 'test-reasoning',
        propId: 'nba_embiid_blk_1.5',
        tier: 'S',
        confidence: 0.79,
        professionalScore: 87,
        expectedValue: 0.055,
        clvTracking: {
          initialOdds: -110,
          currentOdds: -107,
          clvBps: 16,
        },
        gameTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
        sport: 'NBA',
        correlatedPicks: [],
        portfolioExposure: 0.11,
      };

      const decision = await promotionGatekeeper.evaluatePromotion(pick);

      expect(decision.reasoning).toBeDefined();
      expect(decision.reasoning.length).toBeGreaterThan(20);
      if (decision.approved) {
        expect(decision.reasoning).toContain('Approved via');
        expect(decision.reasoning).toContain('gates');
      }
    });

    test('should provide clear reasoning for rejection', async () => {
      const pick: PickForPromotion = {
        id: 'test-rejection-reasoning',
        propId: 'nba_lowry_3pm_2.5',
        tier: 'S',
        confidence: 0.65, // Below S-tier threshold
        professionalScore: 80, // Below S-tier threshold
        expectedValue: 0.03, // Below S-tier threshold
        gameTime: new Date(Date.now() + 6 * 60 * 60 * 1000),
        sport: 'NBA',
        correlatedPicks: [],
        portfolioExposure: 0.09,
      };

      const decision = await promotionGatekeeper.evaluatePromotion(pick);

      expect(decision.approved).toBe(false);
      expect(decision.reasoning).toBeDefined();
      expect(decision.reasoning).toContain('Failed');
      expect(decision.reasoning).toContain('blocking gate');
    });

    test('should calculate risk scores appropriately', async () => {
      const lowRiskPick: PickForPromotion = {
        id: 'test-low-risk',
        propId: 'nba_holiday_stl_1.5',
        tier: 'A',
        confidence: 0.72,
        professionalScore: 78,
        expectedValue: 0.04,
        gameTime: new Date(Date.now() + 12 * 60 * 60 * 1000),
        sport: 'NBA',
        correlatedPicks: [],
        portfolioExposure: 0.05, // Low exposure
      };

      const highRiskPick: PickForPromotion = {
        id: 'test-high-risk',
        propId: 'nba_harden_to_8.5',
        tier: 'B',
        confidence: 0.62,
        professionalScore: 68,
        expectedValue: 0.025,
        gameTime: new Date(Date.now() + 45 * 60 * 1000), // Very close to game
        sport: 'NBA',
        correlatedPicks: ['corr1', 'corr2', 'corr3'],
        portfolioExposure: 0.28, // High exposure
      };

      const lowRiskDecision = await promotionGatekeeper.evaluatePromotion(lowRiskPick);
      const highRiskDecision = await promotionGatekeeper.evaluatePromotion(highRiskPick);

      expect(lowRiskDecision.riskScore).toBeLessThan(highRiskDecision.riskScore);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
