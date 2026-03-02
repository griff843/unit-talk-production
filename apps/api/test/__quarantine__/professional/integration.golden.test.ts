/**
 * Golden tests for complete professional grading integration
 * These tests lock end-to-end professional pipeline behavior
 * NEVER modify expected values without full professional review
 */

import { GradingAgent } from '../../src/agents/GradingAgent/GradingAgent';
import { ProfessionalPropProcessor } from '../../src/services/ProfessionalPropProcessor';
import { scoringLogger } from '../../src/utils/scoringLogger';

describe('Professional Integration Golden Tests', () => {
  let gradingAgent: GradingAgent;
  let originalEnv: Record<string, string | undefined>;

  beforeAll(async () => {
    // Save original environment
    originalEnv = {
      USE_PRO_SCORER: process.env.USE_PRO_SCORER,
      SCORING_DEBUG: process.env.SCORING_DEBUG,
      NODE_ENV: process.env.NODE_ENV,
    };

    // Set test environment
    process.env.USE_PRO_SCORER = 'true';
    process.env.SCORING_DEBUG = 'false'; // Disable debug for integration tests
    process.env.NODE_ENV = 'test';

    // Initialize agent with professional scoring enabled
    gradingAgent = new GradingAgent(
      {
        name: 'test-grading-agent',
        enabled: true,
        version: '1.0.0',
      },
      {} as any
    );
  });

  afterAll(() => {
    // Restore original environment
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-End Professional Pipeline', () => {
    test('GOLDEN: Elite NBA prop should complete full professional pipeline', async () => {
      const eliteNBAProp = {
        propId: 'nba-elite-test-001',
        sport: 'NBA',
        player: 'LeBron James',
        market: {
          type: 'player_points',
          line: 27.5,
          overOdds: -115,
          underOdds: -105,
        },
        game: {
          homeTeam: 'Lakers',
          awayTeam: 'Warriors',
          gameTime: new Date(),
          venue: 'Crypto.com Arena',
        },
        contextualData: {
          pace: 102.5,
          defenseRank: 15,
          usage: 31.2,
          restDays: 1,
          homeAdvantage: true,
          nationalTV: true,
        },
      };

      const result = await gradingAgent.processFeatureSet(eliteNBAProp);

      // LOCKED END-TO-END RESULTS - complete professional pipeline
      expect(result).toMatchObject({
        tier: expect.stringMatching(/^(S_TIER|A_TIER)$/), // Should achieve high tier
        finalScore: expect.any(Number),
        confidence: expect.any(Number),
        kellyFraction: expect.any(Number),

        // Professional components must exist
        deviggingResult: expect.objectContaining({
          deviggedEdge: expect.any(Number),
          trueProb: expect.any(Number),
          totalVig: expect.any(Number),
        }),

        clvResult: expect.objectContaining({
          trackingId: expect.any(String),
          clvPercentage: expect.any(Number),
        }),

        featureContributions: expect.objectContaining({
          expectedValue: expect.any(Number),
          lineMovement: expect.any(Number),
          matchupRating: expect.any(Number),
        }),

        processingMetadata: expect.objectContaining({
          pathUsed: 'PROFESSIONAL',
          processingTimeMs: expect.any(Number),
          modelVersion: expect.any(String),
        }),
      });

      // Quality gates validation
      expect(result.finalScore).toBeGreaterThan(65); // Should professional_score well
      expect(result.confidence).toBeGreaterThan(0.75); // High confidence
      expect(result.deviggingResult.deviggedEdge).toBeDefined(); // Devigging applied
      expect(result.clvResult.trackingId).toMatch(/^[a-zA-Z0-9-]+$/); // Valid tracking
      expect(result.kellyFraction).toBeGreaterThan(0.02); // Meaningful Kelly sizing
      expect(result.processingMetadata.processingTimeMs).toBeLessThan(3000); // <3s processing
    });

    test('GOLDEN: Feature flag disabled should use legacy path', async () => {
      // Temporarily disable professional scoring
      process.env.USE_PRO_SCORER = 'false';

      const testProp = {
        propId: 'legacy-test-001',
        sport: 'NBA',
        market: { type: 'spread', line: -7.5, overOdds: -110, underOdds: -110 },
      };

      const result = await gradingAgent.processFeatureSet(testProp);

      // LOCKED LEGACY PATH - should use original grading
      expect(result.processingMetadata.pathUsed).toBe('LEGACY');
      expect(result.deviggingResult).toBeUndefined(); // No devigging in legacy
      expect(result.clvResult).toBeUndefined(); // No CLV in legacy
      expect(result.featureContributions).toBeUndefined(); // No enhanced features

      // Restore professional scoring for subsequent tests
      process.env.USE_PRO_SCORER = 'true';
    });
  });

  describe('Multi-Sport Professional Processing', () => {
    test('GOLDEN: NFL professional processing should emphasize weather/motivation', async () => {
      const nflProp = {
        propId: 'nfl-prof-001',
        sport: 'NFL',
        player: 'Josh Allen',
        market: {
          type: 'passing_yards',
          line: 267.5,
          overOdds: -118,
          underOdds: -102,
        },
        game: {
          homeTeam: 'Bills',
          awayTeam: 'Patriots',
          gameTime: new Date(),
          weather: { temperature: 28, wind: 15, condition: 'snow' },
          isPlayoff: true,
        },
      };

      const result = await gradingAgent.processFeatureSet(nflProp);

      // LOCKED NFL SPECIFICS - weather and motivation emphasized
      expect(result.featureContributions.weatherImpact).toBeGreaterThan(2.0); // Weather matters
      expect(result.featureContributions.motivationalFactors).toBeGreaterThan(3.0); // Playoff game
      expect(result.featureContributions.lineMovement).toBeGreaterThan(1.5); // NFL line movement weighted heavily
    });

    test('GOLDEN: MLB professional processing should emphasize handedness/bullpen', async () => {
      const mlbProp = {
        propId: 'mlb-prof-001',
        sport: 'MLB',
        player: 'Mookie Betts',
        market: {
          type: 'hits',
          line: 1.5,
          overOdds: -125,
          underOdds: +105,
        },
        game: {
          homeTeam: 'Dodgers',
          awayTeam: 'Giants',
          pitcher: { throws: 'R', era: 3.45 },
          bullpen: { whip: 1.15, era: 3.2 },
        },
        playerData: {
          vsRHP: { avg: 0.325, ops: 0.92 },
          last15Games: { avg: 0.38 },
        },
      };

      const result = await gradingAgent.processFeatureSet(mlbProp);

      // LOCKED MLB SPECIFICS - handedness and bullpen emphasized
      expect(result.featureContributions.handednessSplits).toBeGreaterThan(6.0); // Strong vs RHP
      expect(result.featureContributions.bullpenQualityScore).toBeGreaterThan(2.5); // Bullpen matters
      expect(result.featureContributions.playerForm).toBeGreaterThan(8.0); // Hot recent form
    });

    test('GOLDEN: NHL professional processing should emphasize goalie/special teams', async () => {
      const nhlProp = {
        propId: 'nhl-prof-001',
        sport: 'NHL',
        player: 'Connor McDavid',
        market: {
          type: 'points',
          line: 1.5,
          overOdds: -130,
          underOdds: +110,
        },
        game: {
          homeTeam: 'Oilers',
          awayTeam: 'Flames',
          goalie: { savePct: 0.887, gaa: 3.25 },
          specialTeams: { ppPct: 28.5, pkPct: 78.2 },
        },
      };

      const result = await gradingAgent.processFeatureSet(nhlProp);

      // LOCKED NHL SPECIFICS - goalie and special teams emphasized
      expect(result.featureContributions.goalieMatchup).toBeGreaterThan(2.5); // Goalie advantage
      expect(result.featureContributions.specialTeamsEdge).toBeGreaterThan(2.0); // PP opportunity
      expect(result.featureContributions.paceImpact).toBeGreaterThan(2.8); // Game flow
    });
  });

  describe('Professional Rule Compliance', () => {
    test('GOLDEN: All professional rules must be enforced', async () => {
      const complianceProp = {
        propId: 'compliance-001',
        sport: 'NBA',
        market: { type: 'rebounds', line: 10.5, overOdds: -112, underOdds: -108 },
      };

      const result = await gradingAgent.processFeatureSet(complianceProp);

      // LOCKED COMPLIANCE - all rules enforced
      // Rule #1: Universal Devigging ⚡
      expect(result.deviggingResult).toBeDefined();
      expect(result.deviggingResult.deviggedEdge).toBeDefined();
      expect(result.deviggingResult.totalVig).toBeDefined();

      // Rule #2: Universal CLV Tracking 📈
      expect(result.clvResult).toBeDefined();
      expect(result.clvResult.trackingId).toBeDefined();
      expect(result.clvResult.trackingId.length).toBeGreaterThan(0);

      // Rule #3: Professional Grading Only 🎯
      expect(result.featureContributions).toBeDefined();
      expect(Object.keys(result.featureContributions).length).toBeGreaterThan(5);

      // Rule #4: Kelly Criterion Sizing 💰
      expect(result.kellyFraction).toBeDefined();
      expect(result.kellyFraction).toBeGreaterThan(0);
      expect(result.kellyFraction).toBeLessThanOrEqual(0.25); // Max 25%

      // Rule #6: Universal Processing Pipeline 🏗️
      expect(result.processingMetadata.processingTimeMs).toBeGreaterThan(0);
      expect(result.processingMetadata.pathUsed).toBe('PROFESSIONAL');
    });

    test('GOLDEN: Risk management should prevent excessive positions', async () => {
      const riskProp = {
        propId: 'risk-001',
        sport: 'NBA',
        market: { type: 'points', line: 25.5, overOdds: -105, underOdds: -125 },
      };

      const result = await gradingAgent.processFeatureSet(riskProp);

      // LOCKED RISK MANAGEMENT - position limits enforced
      expect(result.kellyFraction).toBeLessThanOrEqual(0.05); // Max 5% position

      if (result.tier === 'S_TIER') {
        expect(result.kellyFraction).toBeGreaterThanOrEqual(0.025); // Min for S-tier
      }

      expect(result.riskAssessment).toBeDefined();
      expect(result.riskAssessment.totalRisk).toBeLessThan(10); // Reasonable risk
    });
  });

  describe('Performance and Quality Benchmarks', () => {
    test('GOLDEN: Processing time benchmarks must be met', async () => {
      const performanceProp = {
        propId: 'perf-001',
        sport: 'NBA',
        market: { type: 'assists', line: 8.5, overOdds: -110, underOdds: -110 },
      };

      const startTime = Date.now();
      const result = await gradingAgent.processFeatureSet(performanceProp);
      const totalTime = Date.now() - startTime;

      // LOCKED PERFORMANCE - processing time targets
      expect(totalTime).toBeLessThan(5000); // <5 seconds total
      expect(result.processingMetadata.processingTimeMs).toBeLessThan(3000); // <3s for scoring
    });

    test('GOLDEN: Quality thresholds must be maintained', async () => {
      const qualityProp = {
        propId: 'quality-001',
        sport: 'NFL',
        market: { type: 'receiving_yards', line: 67.5, overOdds: -115, underOdds: -105 },
      };

      const result = await gradingAgent.processFeatureSet(qualityProp);

      // LOCKED QUALITY - minimum quality standards
      if (result.tier === 'S_TIER' || result.tier === 'A_TIER') {
        expect(result.confidence).toBeGreaterThan(0.7); // Min confidence for top tiers
        expect(result.finalScore).toBeGreaterThan(50); // Meaningful professional_score
        expect(result.deviggingResult.totalVig).toBeLessThan(0.1); // Max 10% vig
      }

      // All tiers must have basic quality
      expect(result.finalScore).toBeGreaterThan(30); // Above rejection threshold
      expect(result.confidence).toBeGreaterThan(0.5); // Minimum confidence
    });
  });

  describe('Error Handling and Recovery', () => {
    test('GOLDEN: Missing data should gracefully degrade', async () => {
      const incompleteProp = {
        propId: 'incomplete-001',
        sport: 'NBA',
        // Missing market data, player info
      };

      const result = await gradingAgent.processFeatureSet(incompleteProp);

      // LOCKED GRACEFUL DEGRADATION
      expect(result).toBeDefined(); // Should not crash
      expect(result.tier).toBeOneOf(['C_TIER', 'D_TIER']); // Lower tier due to missing data
      expect(result.confidence).toBeLessThan(0.6); // Lower confidence
      expect(result.processingMetadata.warnings).toContain('MISSING_DATA');
    });

    test('GOLDEN: External service failures should not prevent processing', async () => {
      // Mock external service failure
      jest.spyOn(scoringLogger, 'logScoringResult').mockImplementation(() => {
        throw new Error('Logging service down');
      });

      const resilientProp = {
        propId: 'resilient-001',
        sport: 'NBA',
        market: { type: 'points', line: 25.5, overOdds: -110, underOdds: -110 },
      };

      const result = await gradingAgent.processFeatureSet(resilientProp);

      // LOCKED RESILIENCE - processing completes despite service failures
      expect(result).toBeDefined();
      expect(result.tier).toBeDefined();
      expect(result.finalScore).toBeGreaterThan(0);
      expect(result.processingMetadata.warnings).toContain('LOGGING_ERROR');

      jest.restoreAllMocks();
    });
  });

  describe('Professional Pipeline Integration Snapshots', () => {
    test('GOLDEN: Complete professional pipeline execution snapshot', async () => {
      const comprehensiveProp = {
        propId: 'comprehensive-001',
        sport: 'NBA',
        player: 'Stephen Curry',
        market: {
          type: 'made_threes',
          line: 4.5,
          overOdds: -125,
          underOdds: +105,
        },
        game: {
          homeTeam: 'Warriors',
          awayTeam: 'Lakers',
          venue: 'Chase Center',
          gameTime: new Date('2025-01-09T22:00:00Z'),
          nationalTV: true,
          pace: 104.2,
        },
        player: {
          season: { threePtPct: 0.427, threePtAtt: 11.2 },
          last10: { threePtPct: 0.455, threePtAtt: 12.1 },
          vsOpponent: { threePtPct: 0.44, games: 3 },
        },
        context: {
          defenseRank: 18,
          homeAdvantage: true,
          restDays: 2,
          motivation: 'high', // Rivalry game
        },
      };

      const result = await gradingAgent.processFeatureSet(comprehensiveProp);

      // LOCKED COMPREHENSIVE SNAPSHOT - complete professional result
      const expectedSnapshot = {
        // Core results
        tier: expect.stringMatching(/^(S_TIER|A_TIER)$/),
        finalScore: expect.any(Number),
        confidence: expect.any(Number),
        kellyFraction: expect.any(Number),

        // Professional components
        deviggingResult: {
          deviggedEdge: expect.any(Number),
          trueProb: expect.any(Number),
          totalVig: expect.any(Number),
          fairOdds: expect.any(Number),
        },

        clvResult: {
          trackingId: expect.stringMatching(/^[a-zA-Z0-9-]+$/),
          clvPercentage: expect.any(Number),
          category: expect.stringMatching(/^(POOR|GOOD|EXCELLENT|ELITE)$/),
        },

        featureContributions: expect.objectContaining({
          expectedValue: expect.any(Number),
          lineMovement: expect.any(Number),
          matchupRating: expect.any(Number),
          playerForm: expect.any(Number),
          marketIntelligence: expect.any(Number),
        }),

        riskAssessment: {
          totalRisk: expect.any(Number),
          correlationRisk: expect.any(Number),
          volatility: expect.any(Number),
        },

        processingMetadata: {
          pathUsed: 'PROFESSIONAL',
          processingTimeMs: expect.any(Number),
          modelVersion: expect.any(String),
          sportConfig: expect.stringMatching(/^NBA/),
          warnings: expect.any(Array),
        },
      };

      expect(result).toMatchObject(expectedSnapshot);

      // Quality validations
      expect(result.finalScore).toBeGreaterThan(60); // Should professional_score well for Curry threes
      expect(result.confidence).toBeGreaterThan(0.75); // High confidence scenario
      expect(result.deviggingResult.totalVig).toBeLessThan(0.08); // Reasonable vig
      expect(result.kellyFraction).toBeGreaterThan(0.02); // Meaningful sizing
      expect(result.processingMetadata.processingTimeMs).toBeLessThan(2500); // Fast processing

      // Feature contribution validation
      const contributions = result.featureContributions;
      const totalContributions = Object.values(contributions).reduce(
        (sum: number, val: any) => sum + val,
        0
      );
      expect(totalContributions).toBeCloseTo(result.finalScore, 1); // Contributions sum to professional_score

      // Professional rule compliance
      expect(result.deviggingResult.deviggedEdge).toBeDefined(); // Rule #1
      expect(result.clvResult.trackingId).toBeDefined(); // Rule #2
      expect(Object.keys(contributions).length).toBeGreaterThan(8); // Rule #3
      expect(result.kellyFraction).toBeGreaterThan(0); // Rule #4
    });
  });
});
