/**
 * Golden tests for tier assignment and Kelly sizing
 * These tests lock professional tier thresholds and Kelly calculations
 * NEVER modify expected values without full professional review
 */

import { TierAssignmentService } from '../../src/services/professional/TierAssignmentService';
import { KellySizingService } from '../../src/services/professional/KellySizingService';
import { getScoringConfig } from '../../src/scoring/config/weights';

describe('Tier Assignment Golden Tests', () => {
  let tierService: TierAssignmentService;
  let kellyService: KellySizingService;

  beforeEach(() => {
    tierService = new TierAssignmentService();
    kellyService = new KellySizingService();
  });

  describe('S-Tier Assignment', () => {
    test('GOLDEN: NBA S-tier should require 71+ professional_score, 21% edge, max 4% risk', () => {
      const stierResult = tierService.assignTier({
        finalScore: 85,
        confidence: 0.92,
        deviggingResult: { deviggedEdge: 0.22 },
        riskAssessment: { totalRisk: 3.5 }
      }, 'NBA');

      // LOCKED VALUES - NBA S-tier requirements
      expect(sierResult.tier).toBe('S_TIER');
      expect(sierResult.positionSize).toBeGreaterThanOrEqual(0.045); // Min 4.5%
      expect(sierResult.qualityGrade).toBe('ELITE');
      expect(sierResult.expectedROI).toBeGreaterThan(0.20); // >20% expected ROI
    });

    test('GOLDEN: NFL S-tier should require 72+ professional_score, 22% edge, max 3% risk', () => {
      const sierResult = tierService.assignTier({
        finalScore: 88,
        confidence: 0.90,
        deviggingResult: { deviggedEdge: 0.25 },
        riskAssessment: { totalRisk: 2.8 }
      }, 'NFL');

      // LOCKED VALUES - NFL S-tier (higher threshold)
      expect(sierResult.tier).toBe('S_TIER');
      expect(sierResult.positionSize).toBeGreaterThanOrEqual(0.05); // Min 5%
      expect(sierResult.qualityGrade).toBe('ELITE');
    });

    test('GOLDEN: Edge case - high professional_score but fails edge requirement should downgrade', () => {
      const downgradeResult = tierService.assignTier({
        finalScore: 85, // S-tier professional_score
        confidence: 0.90,
        deviggingResult: { deviggedEdge: 0.15 }, // Below 21% requirement
        riskAssessment: { totalRisk: 3.0 }
      }, 'NBA');

      // LOCKED VALUES - edge requirement enforcement
      expect(downgradeResult.tier).toBe('A_TIER'); // Downgraded due to edge
      expect(downgradeResult.downgradReason).toBe('INSUFFICIENT_EDGE');
    });

    test('GOLDEN: Edge case - high professional_score but fails risk requirement should downgrade', () => {
      const riskDowngrade = tierService.assignTier({
        finalScore: 85,
        confidence: 0.90, 
        deviggingResult: { deviggedEdge: 0.23 },
        riskAssessment: { totalRisk: 5.5 } // Above 4% risk limit
      }, 'NBA');

      // LOCKED VALUES - risk requirement enforcement
      expect(riskDowngrade.tier).toBe('A_TIER'); // Downgraded due to risk
      expect(riskDowngrade.downgradReason).toBe('EXCESSIVE_RISK');
    });
  });

  describe('A-Tier Assignment', () => {
    test('GOLDEN: A-tier should accept 51-70 professional_score range with positive edge', () => {
      const aTierResults = [
        { score: 65, edge: 0.08, risk: 4.5 },
        { score: 58, edge: 0.05, risk: 4.8 },
        { score: 51, edge: 0.02, risk: 5.0 }
      ];

      aTierResults.forEach(({ professional_score, edge, risk }) => {
        const result = tierService.assignTier({
          finalScore: professional_score,
          confidence: 0.75,
          deviggingResult: { deviggedEdge: edge },
          riskAssessment: { totalRisk: risk }
        }, 'NBA');

        // LOCKED VALUES - A-tier range
        expect(result.tier).toBe('A_TIER');
        expect(result.positionSize).toBeGreaterThanOrEqual(0.028); // Min 2.8%
        expect(result.positionSize).toBeLessThanOrEqual(0.045);    // Max before S-tier
      });
    });
  });

  describe('Kelly Sizing Integration', () => {
    test('GOLDEN: Kelly sizing should match professional bankroll management', () => {
      const kellyScenarios = [
        { edge: 0.25, prob: 0.60, expectedKelly: 0.167 }, // Strong edge
        { edge: 0.15, prob: 0.55, expectedKelly: 0.100 }, // Good edge  
        { edge: 0.08, prob: 0.52, expectedKelly: 0.058 }, // Modest edge
        { edge: 0.03, prob: 0.51, expectedKelly: 0.020 }  // Small edge
      ];

      kellyScenarios.forEach(({ edge, prob, expectedKelly }) => {
        const kellyFraction = kellyService.calculateKellyFraction(edge, prob);
        const cappedKelly = kellyService.applyKellyMultiplier(kellyFraction, 0.25); // 25% multiplier

        // LOCKED VALUES - Kelly calculations
        expect(kellyFraction).toBeCloseTo(expectedKelly, 3);
        expect(cappedKelly).toBeLessThanOrEqual(0.05); // Max 5% position size
      });
    });

    test('GOLDEN: Kelly multipliers should vary by sport risk profile', () => {
      const baseKelly = 0.20; // 20% raw Kelly

      const sportMultipliers = {
        'NBA': 0.25,  // 25% multiplier (lower variance)
        'NFL': 0.25,  // 25% multiplier (weekly games)  
        'MLB': 0.22,  // 22% multiplier (daily games, higher variance)
        'NHL': 0.24   // 24% multiplier (moderate variance)
      };

      Object.entries(sportMultipliers).forEach(([sport, multiplier]) => {
        const config = getScoringConfig(sport);
        const cappedKelly = kellyService.applyKellyMultiplier(baseKelly, config.risk.kellyMultiplier);

        // LOCKED VALUES - sport-specific multipliers
        expect(cappedKelly).toBeCloseTo(baseKelly * multiplier, 3);
        expect(cappedKelly).toBeLessThanOrEqual(0.05); // Global max
      });
    });
  });

  describe('Risk-Adjusted Position Sizing', () => {
    test('GOLDEN: High correlation should reduce position sizes', () => {
      const basePosition = 0.04; // 4% base position

      const correlationAdjustments = [
        { correlation: 0.2, expectedReduction: 1.0 },   // No reduction
        { correlation: 0.5, expectedReduction: 0.85 },  // 15% reduction
        { correlation: 0.7, expectedReduction: 0.65 },  // 35% reduction  
        { correlation: 0.9, expectedReduction: 0.40 }   // 60% reduction
      ];

      correlationAdjustments.forEach(({ correlation, expectedReduction }) => {
        const adjustedPosition = tierService.adjustForCorrelation(basePosition, correlation);

        // LOCKED VALUES - correlation adjustments
        expect(adjustedPosition).toBeCloseTo(basePosition * expectedReduction, 3);
      });
    });

    test('GOLDEN: Portfolio heat should cap total exposure', () => {
      const positions = [
        { size: 0.04, correlation: 0.3 },
        { size: 0.035, correlation: 0.5 },
        { size: 0.03, correlation: 0.2 },
        { size: 0.045, correlation: 0.6 }
      ];

      const portfolioHeat = tierService.calculatePortfolioHeat(positions);
      const adjustedPositions = tierService.adjustForPortfolioHeat(positions, portfolioHeat);

      // LOCKED VALUES - portfolio heat management
      expect(portfolioHeat).toBeLessThanOrEqual(0.15); // Max 15% daily risk
      
      const totalExposure = adjustedPositions.reduce((sum, pos) => sum + pos.adjustedSize, 0);
      expect(totalExposure).toBeLessThanOrEqual(0.15); // Enforced portfolio limit
    });
  });

  describe('Tier Boundary Edge Cases', () => {
    test('GOLDEN: Exact tier boundaries should be handled consistently', () => {
      const boundaryTests = [
        // NBA boundaries
        { sport: 'NBA', score: 71.0, expectedTier: 'S_TIER' },
        { sport: 'NBA', score: 70.9, expectedTier: 'A_TIER' },
        { sport: 'NBA', score: 51.0, expectedTier: 'A_TIER' },
        { sport: 'NBA', score: 50.9, expectedTier: 'B_TIER' },
        
        // NFL boundaries (higher)
        { sport: 'NFL', score: 72.0, expectedTier: 'S_TIER' },
        { sport: 'NFL', score: 71.9, expectedTier: 'A_TIER' },
        
        // NHL boundaries (lower)
        { sport: 'NHL', score: 70.0, expectedTier: 'S_TIER' },
        { sport: 'NHL', score: 69.9, expectedTier: 'A_TIER' }
      ];

      boundaryTests.forEach(({ sport, professional_score, expectedTier }) => {
        const result = tierService.assignTier({
          finalScore: professional_score,
          confidence: 0.85,
          deviggingResult: { deviggedEdge: 0.25 }, // High edge
          riskAssessment: { totalRisk: 2.0 } // Low risk
        }, sport);

        // LOCKED VALUES - exact boundary handling
        expect(result.tier).toBe(expectedTier);
      });
    });

    test('GOLDEN: Confidence requirements should gate tier upgrades', () => {
      const confidenceGating = [
        { confidence: 0.95, shouldUpgrade: true },   // High confidence
        { confidence: 0.85, shouldUpgrade: true },   // Good confidence
        { confidence: 0.70, shouldUpgrade: false },  // Marginal confidence  
        { confidence: 0.50, shouldUpgrade: false }   // Low confidence
      ];

      confidenceGating.forEach(({ confidence, shouldUpgrade }) => {
        const result = tierService.assignTier({
          finalScore: 69, // Just below S-tier
          confidence,
          deviggingResult: { deviggedEdge: 0.25 },
          riskAssessment: { totalRisk: 2.0 }
        }, 'NBA');

        if (shouldUpgrade && confidence >= 0.90) {
          // High confidence might push to S-tier
          expect(['A_TIER', 'S_TIER']).toContain(result.tier);
        } else {
          expect(result.tier).toBe('A_TIER');
        }
      });
    });
  });

  describe('Professional Validation Snapshots', () => {
    test('GOLDEN: Complete tier assignment workflow snapshot', () => {
      const professionalPick = {
        finalScore: 82,
        confidence: 0.88,
        deviggingResult: {
          deviggedEdge: 0.18,
          trueProb: 0.59,
          totalVig: 0.024
        },
        clvResult: {
          clvPercentage: 12.5,
          category: 'EXCELLENT'
        },
        riskAssessment: {
          totalRisk: 3.2,
          correlationRisk: 0.15,
          volatility: 0.08
        },
        marketConditions: {
          sharpMoney: 0.80,
          publicSplit: 0.35
        }
      };

      const result = tierService.assignTier(professionalPick, 'NBA');

      // LOCKED SNAPSHOT - complete professional tier assignment
      const expectedResult = {
        tier: 'S_TIER',
        positionSize: 0.045,      // 4.5% of bankroll
        kellyFraction: 0.144,     // Kelly calculation  
        expectedROI: 0.216,       // 21.6% expected return
        qualityGrade: 'ELITE',
        riskRating: 'LOW',
        confidenceLevel: 'HIGH'
      };

      expect(result.tier).toBe(expectedResult.tier);
      expect(result.positionSize).toBeCloseTo(expectedResult.positionSize, 3);
      expect(result.kellyFraction).toBeCloseTo(expectedResult.kellyFraction, 3);
      expect(result.expectedROI).toBeCloseTo(expectedResult.expectedROI, 3);
      expect(result.qualityGrade).toBe(expectedResult.qualityGrade);
      expect(result.riskRating).toBe(expectedResult.riskRating);
    });

    test('GOLDEN: Risk management override scenarios', () => {
      // Scenario: Great pick but portfolio already at risk limits
      const overrideScenario = {
        finalScore: 88,
        confidence: 0.92,
        deviggingResult: { deviggedEdge: 0.22 },
        riskAssessment: { totalRisk: 2.5 },
        portfolioState: {
          currentExposure: 0.12, // Already at 12% exposure
          maxDailyRisk: 0.15,    // 15% limit
          correlatedPositions: 3  // Multiple correlated positions
        }
      };

      const result = tierService.assignTierWithRiskManagement(overrideScenario, 'NBA');

      // LOCKED VALUES - risk management override
      expect(result.originalTier).toBe('S_TIER');
      expect(result.adjustedTier).toBe('A_TIER'); // Downgraded for risk
      expect(result.positionSize).toBeLessThanOrEqual(0.03); // Capped position
      expect(result.overrideReason).toBe('PORTFOLIO_RISK_LIMIT');
    });
  });

  describe('Integration with External Services', () => {
    test('GOLDEN: Tier assignment should integrate with all professional services', async () => {
      // Mock a complete professional processing result
      const completeProfessionalResult = {
        devigging: {
          deviggedEdge: 0.19,
          trueProb: 0.595,
          fairOdds: -147
        },
        clvTracking: {
          clvPercentage: 15.2,
          category: 'ELITE',
          trackingId: 'clv-test-123'
        },
        enhancedScoring: {
          finalScore: 84,
          confidence: 0.91,
          featureContributions: { expectedValue: 18.5, lineMovement: 12.8 }
        },
        riskManagement: {
          totalRisk: 2.8,
          maxDrawdown: 0.045,
          correlationRisk: 0.12
        }
      };

      const finalResult = await tierService.processCompleteProfessionalPick(
        completeProfessionalResult, 
        'NBA'
      );

      // LOCKED INTEGRATION - complete professional pipeline
      expect(finalResult.tier).toBe('S_TIER');
      expect(finalResult.allRequirementsMet).toBe(true);
      expect(finalResult.processingTime).toBeLessThan(2000); // <2 seconds
      expect(finalResult.qualityAssurance.deviggingPassed).toBe(true);
      expect(finalResult.qualityAssurance.clvPassed).toBe(true);
      expect(finalResult.qualityAssurance.scoringPassed).toBe(true);
      expect(finalResult.qualityAssurance.riskPassed).toBe(true);
    });
  });
});