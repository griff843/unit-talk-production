/**
 * Golden tests for Enhanced Scoring Engine
 * These tests lock the 53-point professional scoring behavior
 * NEVER modify expected values without full professional review
 */

import { EnhancedScoringEngine } from '../../src/scoring/engines/EnhancedScoringEngine';
import { getScoringConfig } from '../../src/scoring/config/weights';

describe('Enhanced Scoring Golden Tests', () => {
  let scoringEngine: EnhancedScoringEngine;

  beforeEach(() => {
    scoringEngine = new EnhancedScoringEngine();
  });

  describe('NBA Professional Scoring', () => {
    test('GOLDEN: LeBron 25.5 points elite scenario should professional_score 85+', () => {
      const features = {
        // Core components
        expectedValue: 0.18, // Strong EV
        lineMovement: 0.12, // Positive movement
        matchupRating: 0.85, // Excellent matchup
        playerForm: 0.9, // Hot streak
        injuryImpact: 0.95, // No injury concerns

        // Market intelligence
        marketIntelligence: 0.82, // Sharp consensus
        sharpMoney: 0.75, // Sharp money backing
        closingLineValue: 0.15, // Strong CLV

        // Professional features
        steamDetection: 0.7, // Steam move detected
        publicVsSharpSplit: 0.65, // Contrarian value

        // Player context
        paceImpact: 0.78, // Fast game pace
        venueAdvantage: 0.6, // Home advantage
        motivationalFactors: 0.85, // National TV game

        // NBA specific
        usageRate: 0.88, // High usage expected
        defenseVsPosition: 0.72, // Favorable matchup
        restAdvantage: 0.8, // Well rested
      };

      const result = scoringEngine.scoreFeatures(features, 'NBA');

      // LOCKED VALUES - elite NBA scenario
      expect(result.finalScore).toBeGreaterThanOrEqual(85); // Elite threshold
      expect(result.tier).toBe('S_TIER'); // Should achieve S-tier
      expect(result.confidence).toBeGreaterThan(0.85); // High confidence
      expect(result.featureContributions).toBeDefined();

      // Verify key feature contributions
      expect(result.featureContributions.expectedValue).toBeGreaterThan(3.0);
      expect(result.featureContributions.playerForm).toBeGreaterThan(8.0);
      expect(result.featureContributions.matchupRating).toBeGreaterThan(12.0);
    });

    test('GOLDEN: Marginal NBA prop should professional_score 45-55 range', () => {
      const features = {
        expectedValue: 0.02, // Minimal EV
        lineMovement: -0.03, // Slight negative movement
        matchupRating: 0.52, // Average matchup
        playerForm: 0.48, // Below average form
        injuryImpact: 0.75, // Some injury concern

        marketIntelligence: 0.45, // Mixed signals
        sharpMoney: 0.4, // Public leaning
        closingLineValue: -0.02, // Slight negative CLV

        paceImpact: 0.5, // Average pace
        venueAdvantage: 0.45, // Road game
        motivationalFactors: 0.5, // Regular season

        usageRate: 0.55, // Average usage
        defenseVsPosition: 0.48, // Tough matchup
        restAdvantage: 0.6, // Standard rest
      };

      const result = scoringEngine.scoreFeatures(features, 'NBA');

      // LOCKED VALUES - marginal scenario
      expect(result.finalScore).toBeGreaterThanOrEqual(45);
      expect(result.finalScore).toBeLessThanOrEqual(55);
      expect(result.tier).toBeOneOf(['B_TIER', 'C_TIER']);
      expect(result.confidence).toBeLessThan(0.6);
    });
  });

  describe('NFL Professional Scoring', () => {
    test('GOLDEN: Elite NFL weather/injury scenario should professional_score 80+', () => {
      const features = {
        expectedValue: 0.16, // Strong EV
        lineMovement: 0.14, // Significant movement
        matchupRating: 0.82, // Great matchup
        playerForm: 0.85, // Strong recent form
        injuryImpact: 0.9, // Clean injury report
        weatherImpact: 0.15, // Favorable weather edge

        marketIntelligence: 0.88, // Sharp NFL consensus
        sharpMoney: 0.8, // Clear sharp action
        closingLineValue: 0.18, // Excellent CLV

        motivationalFactors: 0.9, // Playoff implications
        refereeImpact: 0.75, // Favorable officiating
        venueAdvantage: 0.7, // Strong home field

        // NFL specific
        weatherConditions: 0.85, // Perfect conditions
        primeTimeBonus: 0.8, // Monday Night Football
        playoffImplications: 0.95, // Must-win game
        divisionRivalry: 0.75, // Division game
      };

      const result = scoringEngine.scoreFeatures(features, 'NFL');

      // LOCKED VALUES - elite NFL scenario
      expect(result.finalScore).toBeGreaterThanOrEqual(80);
      expect(result.tier).toBeOneOf(['S_TIER', 'A_TIER']);
      expect(result.confidence).toBeGreaterThan(0.8);

      // NFL-specific validations
      expect(result.featureContributions.weatherImpact).toBeGreaterThan(1.0);
      expect(result.featureContributions.motivationalFactors).toBeGreaterThan(3.0);
    });
  });

  describe('MLB Professional Scoring', () => {
    test('GOLDEN: Elite MLB handedness/bullpen scenario should professional_score 75+', () => {
      const features = {
        expectedValue: 0.14, // Good EV
        lineMovement: 0.08, // Positive movement
        matchupRating: 0.8, // Strong matchup
        playerForm: 0.82, // Good form
        injuryImpact: 0.88, // Mostly healthy
        weatherImpact: 0.08, // Wind helping

        marketIntelligence: 0.78, // Good intelligence
        sharpMoney: 0.7, // Sharp backing
        closingLineValue: 0.12, // Good CLV

        // MLB specific
        handednessSplits: 0.88, // Perfect handedness matchup
        bullpenQualityScore: 0.85, // Elite bullpen advantage
        advancedSplitAnalysis: 0.82, // Favorable splits

        paceImpact: 0.7, // Fast-paced game
        venueAdvantage: 0.65, // Home advantage
        motivationalFactors: 0.75, // September race
      };

      const result = scoringEngine.scoreFeatures(features, 'MLB');

      // LOCKED VALUES - elite MLB scenario
      expect(result.finalScore).toBeGreaterThanOrEqual(75);
      expect(result.tier).toBeOneOf(['S_TIER', 'A_TIER']);

      // MLB-specific validations
      expect(result.featureContributions.handednessSplits).toBeGreaterThan(7.0);
      expect(result.featureContributions.bullpenQualityScore).toBeGreaterThan(3.0);
    });
  });

  describe('NHL Professional Scoring', () => {
    test('GOLDEN: Elite NHL goalie/special teams scenario should professional_score 78+', () => {
      const features = {
        expectedValue: 0.15, // Strong EV
        lineMovement: 0.1, // Good movement
        matchupRating: 0.85, // Excellent line matchups
        playerForm: 0.8, // Strong form
        injuryImpact: 0.92, // Clean lineup

        marketIntelligence: 0.82, // Good hockey intelligence
        sharpMoney: 0.75, // Sharp action
        closingLineValue: 0.14, // Strong CLV

        // NHL specific
        goalieMatchup: 0.9, // Elite goalie advantage
        specialTeamsEdge: 0.85, // PP/PK advantage
        restAdvantage: 0.8, // Well rested vs back-to-back
        lineChemistry: 0.88, // Hot line combinations

        refereeImpact: 0.75, // Favorable officiating
        paceImpact: 0.82, // High-pace game
        venueAdvantage: 0.7, // Home ice
      };

      const result = scoringEngine.scoreFeatures(features, 'NHL');

      // LOCKED VALUES - elite NHL scenario
      expect(result.finalScore).toBeGreaterThanOrEqual(78);
      expect(result.tier).toBeOneOf(['S_TIER', 'A_TIER']);

      // NHL-specific validations
      expect(result.featureContributions.goalieMatchup).toBeGreaterThan(3.0);
      expect(result.featureContributions.specialTeamsEdge).toBeGreaterThan(2.5);
    });
  });

  describe('Feature Contribution Validation', () => {
    test('GOLDEN: Feature contributions should sum to final score', () => {
      const features = {
        expectedValue: 0.12,
        lineMovement: 0.08,
        matchupRating: 0.75,
        playerForm: 0.7,
        injuryImpact: 0.85,
        marketIntelligence: 0.68,
        sharpMoney: 0.6,
        closingLineValue: 0.1,
      };

      const result = scoringEngine.scoreFeatures(features, 'NBA');

      // LOCKED VALIDATION - contributions must sum correctly
      const totalContributions = Object.values(result.featureContributions).reduce(
        (sum, contribution) => sum + contribution,
        0
      );

      expect(totalContributions).toBeCloseTo(result.finalScore, 1); // Within 0.1 points
    });

    test('GOLDEN: High-weight features should dominate contributions', () => {
      const features = {
        expectedValue: 0.2, // High EV (20% weight)
        lineMovement: 0.15, // Strong movement (12% weight)
        matchupRating: 0.9, // Excellent (15% weight)
        playerForm: 0.85, // Good (10% weight)

        // Lower impact features
        venueAdvantage: 0.6, // Lower weight
        refereeImpact: 0.7, // Lower weight
        paceImpact: 0.75, // Lower weight
      };

      const result = scoringEngine.scoreFeatures(features, 'NBA');
      const contributions = result.featureContributions;

      // LOCKED VALIDATION - weight hierarchy
      expect(contributions.expectedValue).toBeGreaterThan(contributions.venueAdvantage);
      expect(contributions.matchupRating).toBeGreaterThan(contributions.refereeImpact);
      expect(contributions.lineMovement).toBeGreaterThan(contributions.paceImpact);
    });
  });

  describe('Tier Threshold Validation', () => {
    test('GOLDEN: S-Tier thresholds should be enforced correctly', () => {
      // Test edge cases around tier boundaries
      const tierBoundaryTests = [
        { score: 71, tier: 'S_TIER', sport: 'NBA' },
        { score: 70, tier: 'A_TIER', sport: 'NBA' },
        { score: 72, tier: 'S_TIER', sport: 'NFL' },
        { score: 71, tier: 'A_TIER', sport: 'NFL' },
        { score: 70, tier: 'S_TIER', sport: 'NHL' }, // Lower threshold
        { score: 69, tier: 'A_TIER', sport: 'NHL' },
      ];

      tierBoundaryTests.forEach(({ professional_score, tier, sport }) => {
        const mockResult = { finalScore: professional_score, confidence: 0.85 };
        const actualTier = scoringEngine.assignTier(mockResult, sport);
        expect(actualTier).toBe(tier);
      });
    });

    test('GOLDEN: Confidence requirements should gate tier assignment', () => {
      // High professional_score but low confidence should be downgraded
      const highScoreLowConfidence = {
        finalScore: 85, // S-tier professional_score
        confidence: 0.4, // Low confidence
      };

      const tier = scoringEngine.assignTier(highScoreLowConfidence, 'NBA');
      expect(tier).not.toBe('S_TIER'); // Should be downgraded due to low confidence
    });
  });

  describe('Sport-Specific Weight Application', () => {
    test('GOLDEN: NBA weights should emphasize pace and usage', () => {
      const nbaFeatures = {
        paceImpact: 0.8,
        usageRate: 0.85,
        defenseVsPosition: 0.75,
        restAdvantage: 0.7,
      };

      const nbaResult = scoringEngine.scoreFeatures(nbaFeatures, 'NBA');
      const contributions = nbaResult.featureContributions;

      // LOCKED VALIDATION - NBA emphasis
      expect(contributions.paceImpact).toBeGreaterThan(2.5); // 3.5% weight
      expect(contributions.usageRate).toBeGreaterThan(2.5); // 3% weight
    });

    test('GOLDEN: NFL weights should emphasize weather and motivation', () => {
      const nflFeatures = {
        weatherImpact: 0.8,
        motivationalFactors: 0.85,
        injuryImpact: 0.9,
        lineMovement: 0.12,
      };

      const nflResult = scoringEngine.scoreFeatures(nflFeatures, 'NFL');
      const contributions = nflResult.featureContributions;

      // LOCKED VALIDATION - NFL emphasis
      expect(contributions.weatherImpact).toBeGreaterThan(3.0); // 4% weight
      expect(contributions.motivationalFactors).toBeGreaterThan(3.0); // 4% weight
      expect(contributions.lineMovement).toBeGreaterThan(1.5); // 14% weight (highest)
    });
  });

  describe('Model Ensemble Integration', () => {
    test('GOLDEN: ML ensemble should contribute 10% of total score', () => {
      const features = {
        neuralNetwork: 0.75,
        gradientBoosting: 0.8,
        randomForest: 0.7,
        ensemble: 0.85,
      };

      const result = scoringEngine.scoreFeatures(features, 'NBA');
      const mlContributions = [
        'neuralNetwork',
        'gradientBoosting',
        'randomForest',
        'ensemble',
      ].reduce((sum, feature) => sum + (result.featureContributions[feature] || 0), 0);

      // LOCKED VALIDATION - ML ensemble should be ~10% of total
      const expectedMLContribution = result.finalScore * 0.1;
      expect(mlContributions).toBeCloseTo(expectedMLContribution, 1);
    });
  });

  describe('Professional Scoring Integration Snapshot', () => {
    test('GOLDEN: Complete professional scoring workflow snapshot', () => {
      // Real-world elite scenario: LeBron 27.5 points, Lakers vs Warriors, national TV
      const eliteScenario = {
        // Core (40% weight)
        expectedValue: 0.18,
        lineMovement: 0.12,
        matchupRating: 0.88,
        playerForm: 0.92,
        injuryImpact: 0.95,
        weatherImpact: 0.0,

        // Intelligence (27% weight)
        marketIntelligence: 0.85,
        sharpMoney: 0.8,
        volumeProfile: 0.7,
        closingLineValue: 0.16,

        // Professional (13% weight)
        steamDetection: 0.75,
        closingLinePrediction: 0.7,
        optimalTiming: 0.8,
        lineShoppingEdge: 0.6,
        publicVsSharpSplit: 0.7,
        marketTimingAdvantage: 0.65,
        injuryTimingEdge: 0.8,
        crossMarketDiscrepancy: 0.5,

        // Context (10% weight)
        playerFatigue: 0.85,
        venueAdvantage: 0.75,
        refereeImpact: 0.6,
        paceImpact: 0.88,
        motivationalFactors: 0.9,

        // NBA specific
        usageRate: 0.9,
        defenseVsPosition: 0.82,
        restAdvantage: 0.85,
      };

      const result = scoringEngine.scoreFeatures(eliteScenario, 'NBA');

      // LOCKED SNAPSHOT - elite professional scenario
      const expectedSnapshot = {
        finalScore: 87.5, // ±2 points
        tier: 'S_TIER',
        confidence: 0.89, // ±0.05
        topContributors: ['matchupRating', 'playerForm', 'expectedValue'],
        categoryBreakdown: {
          core: 35.0, // ~40% of 87.5
          intelligence: 23.6, // ~27% of 87.5
          professional: 11.4, // ~13% of 87.5
          context: 8.8, // ~10% of 87.5
          mlEnsemble: 8.7, // ~10% of 87.5
        },
      };

      expect(result.finalScore).toBeCloseTo(expectedSnapshot.finalScore, 2);
      expect(result.tier).toBe(expectedSnapshot.tier);
      expect(result.confidence).toBeCloseTo(expectedSnapshot.confidence, 2);

      // Verify top contributors
      const sortedContributions = Object.entries(result.featureContributions)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name]) => name);

      expectedSnapshot.topContributors.forEach(contributor => {
        expect(sortedContributions).toContain(contributor);
      });
    });
  });
});
