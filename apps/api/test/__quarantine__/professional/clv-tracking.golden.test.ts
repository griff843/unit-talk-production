/**
 * Golden tests for CLV (Closing Line Value) tracking
 * These tests lock critical CLV behavior to prevent regressions
 * NEVER modify expected values without full professional review
 */

import { CLVTrackingService } from '../../src/services/professional/CLVTrackingService';
import { scoringLogger } from '../../src/utils/scoringLogger';

describe('CLV Tracking Golden Tests', () => {
  let clvService: CLVTrackingService;

  beforeEach(() => {
    clvService = new CLVTrackingService();
    // Mock scoring logger for tests
    jest.spyOn(scoringLogger, 'logCLVTracking').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('CLV Calculation Core Logic', () => {
    test('GOLDEN: Positive CLV from -110 to -120 should show 8.3% value', async () => {
      // Initialize tracking
      const trackingId = await clvService.initializeTracking({
        propId: 'test-prop-1',
        sport: 'NBA',
        market: 'spread',
        openingLine: -110,
        openingOdds: -110,
        bookmaker: 'DraftKings',
        timestamp: new Date('2025-01-09T10:00:00Z'),
      });

      // Update with closing line
      const clvResult = await clvService.updateClosingLine(trackingId, {
        closingLine: -110,
        closingOdds: -120,
        closingTimestamp: new Date('2025-01-09T18:00:00Z'),
      });

      // LOCKED VALUES - verified CLV calculation
      expect(clvResult.clvPercentage).toBeCloseTo(8.33, 2); // 8.33% positive CLV
      expect(clvResult.clvCategory).toBe('EXCELLENT'); // >5% is excellent
      expect(clvResult.openingImpliedProb).toBeCloseTo(52.38, 2); // -110 = 52.38%
      expect(clvResult.closingImpliedProb).toBeCloseTo(54.55, 2); // -120 = 54.55%
      expect(clvResult.expectedProfitMargin).toBeCloseTo(0.0833, 4); // 8.33% edge
    });

    test('GOLDEN: Negative CLV from -110 to -105 should show -2.27% value', async () => {
      const trackingId = await clvService.initializeTracking({
        propId: 'test-prop-2',
        sport: 'NFL',
        market: 'total',
        openingLine: 47.5,
        openingOdds: -110,
        bookmaker: 'FanDuel',
        timestamp: new Date('2025-01-09T12:00:00Z'),
      });

      const clvResult = await clvService.updateClosingLine(trackingId, {
        closingLine: 47.5,
        closingOdds: -105,
        closingTimestamp: new Date('2025-01-09T19:30:00Z'),
      });

      // LOCKED VALUES - negative CLV calculation
      expect(clvResult.clvPercentage).toBeCloseTo(-2.27, 2); // Negative CLV
      expect(clvResult.clvCategory).toBe('POOR'); // Negative is poor
      expect(clvResult.openingImpliedProb).toBeCloseTo(52.38, 2); // -110
      expect(clvResult.closingImpliedProb).toBeCloseTo(51.22, 2); // -105
      expect(clvResult.expectedProfitMargin).toBeCloseTo(-0.0227, 4); // Negative edge
    });

    test('GOLDEN: Large CLV move from +150 to +120 should show 20.83% value', async () => {
      const trackingId = await clvService.initializeTracking({
        propId: 'test-prop-3',
        sport: 'MLB',
        market: 'moneyline',
        openingLine: null,
        openingOdds: +150, // Underdog
        bookmaker: 'Caesars',
        timestamp: new Date('2025-01-09T08:00:00Z'),
      });

      const clvResult = await clvService.updateClosingLine(trackingId, {
        closingLine: null,
        closingOdds: +120, // Line moved in our favor
        closingTimestamp: new Date('2025-01-09T20:00:00Z'),
      });

      // LOCKED VALUES - large positive CLV
      expect(clvResult.clvPercentage).toBeCloseTo(20.83, 2); // Massive 20.83% CLV
      expect(clvResult.clvCategory).toBe('ELITE'); // >15% is elite
      expect(clvResult.openingImpliedProb).toBeCloseTo(40.0, 2); // +150 = 40%
      expect(clvResult.closingImpliedProb).toBeCloseTo(45.45, 2); // +120 = 45.45%
      expect(clvResult.expectedProfitMargin).toBeCloseTo(0.2083, 4); // 20.83% edge
    });
  });

  describe('CLV Categories and Thresholds', () => {
    test('GOLDEN: CLV category thresholds should be correctly classified', () => {
      const testCases = [
        { clv: 25.0, expected: 'ELITE' }, // >15%
        { clv: 12.0, expected: 'EXCELLENT' }, // >5%
        { clv: 3.0, expected: 'GOOD' }, // >0%
        { clv: -2.0, expected: 'POOR' }, // <0%
        { clv: -8.0, expected: 'TERRIBLE' }, // <-5%
        { clv: 0.0, expected: 'GOOD' }, // Exactly 0
        { clv: 5.0, expected: 'EXCELLENT' }, // Exactly threshold
        { clv: 15.0, expected: 'ELITE' }, // Exactly threshold
      ];

      testCases.forEach(({ clv, expected }) => {
        const category = clvService.categorizeCLV(clv);
        expect(category).toBe(expected);
      });
    });

    test('GOLDEN: CLV quality professional_score mapping should match professional standards', () => {
      const qualityScores = [
        { clv: 30.0, expectedScore: 100 }, // Elite max
        { clv: 15.0, expectedScore: 90 }, // Elite threshold
        { clv: 10.0, expectedScore: 80 }, // Excellent range
        { clv: 5.0, expectedScore: 70 }, // Excellent threshold
        { clv: 2.5, expectedScore: 60 }, // Good range
        { clv: 0.0, expectedScore: 50 }, // Neutral
        { clv: -2.5, expectedScore: 40 }, // Poor range
        { clv: -5.0, expectedScore: 30 }, // Poor threshold
        { clv: -10.0, expectedScore: 20 }, // Terrible range
        { clv: -15.0, expectedScore: 10 }, // Terrible floor
      ];

      qualityScores.forEach(({ clv, expectedScore }) => {
        const professional_score = clvService.calculateQualityScore(clv);
        expect(professional_score).toBeCloseTo(expectedScore, 0);
      });
    });
  });

  describe('Multi-Book CLV Tracking', () => {
    test('GOLDEN: Best available CLV should track across multiple books', async () => {
      const multiBookTracking = await clvService.initializeMultiBookTracking({
        propId: 'test-prop-multi',
        sport: 'NBA',
        market: 'player_prop',
        books: [
          { book: 'DraftKings', openingOdds: -115, timestamp: new Date('2025-01-09T10:00:00Z') },
          { book: 'FanDuel', openingOdds: -110, timestamp: new Date('2025-01-09T10:00:00Z') },
          { book: 'BetMGM', openingOdds: -120, timestamp: new Date('2025-01-09T10:00:00Z') },
        ],
      });

      // Update all books at closing
      const closingResults = await clvService.updateMultiBookClosing(multiBookTracking.trackingId, [
        { book: 'DraftKings', closingOdds: -125, timestamp: new Date('2025-01-09T18:00:00Z') },
        { book: 'FanDuel', closingOdds: -118, timestamp: new Date('2025-01-09T18:00:00Z') },
        { book: 'BetMGM', closingOdds: -130, timestamp: new Date('2025-01-09T18:00:00Z') },
      ]);

      // LOCKED VALUES - best available CLV tracking
      expect(closingResults.bestOpeningBook).toBe('FanDuel'); // -110 was best opening
      expect(closingResults.bestClosingBook).toBe('FanDuel'); // -118 is best closing
      expect(closingResults.bestAvailableCLV).toBeCloseTo(7.27, 2); // FanDuel -110 to -118
      expect(closingResults.averageCLV).toBeCloseTo(6.44, 2); // Average across all books
      expect(closingResults.lineShoppingAdvantage).toBeCloseTo(2.83, 2); // Advantage of best vs worst
    });
  });

  describe('Time-Based CLV Analysis', () => {
    test('GOLDEN: CLV trajectory tracking should capture line movement patterns', async () => {
      const trackingId = await clvService.initializeTracking({
        propId: 'test-prop-trajectory',
        sport: 'NFL',
        market: 'spread',
        openingLine: -7.0,
        openingOdds: -110,
        bookmaker: 'DraftKings',
        timestamp: new Date('2025-01-09T09:00:00Z'),
      });

      // Track multiple line movements throughout the day
      const movements = [
        { time: '2025-01-09T12:00:00Z', odds: -115, line: -7.0 },
        { time: '2025-01-09T15:00:00Z', odds: -118, line: -7.0 },
        { time: '2025-01-09T17:00:00Z', odds: -120, line: -6.5 }, // Line moved
        { time: '2025-01-09T19:30:00Z', odds: -125, line: -6.5 }, // Closing
      ];

      for (const movement of movements) {
        await clvService.recordLineMovement(trackingId, {
          newOdds: movement.odds,
          newLine: movement.line,
          timestamp: new Date(movement.time),
        });
      }

      const trajectory = await clvService.getTrajectoryAnalysis(trackingId);

      // LOCKED VALUES - trajectory analysis
      expect(trajectory.totalCLV).toBeCloseTo(12.73, 2); // Final CLV from -110 to -125
      expect(trajectory.peakCLV).toBeCloseTo(12.73, 2); // Peak occurred at closing
      expect(trajectory.averageMovementSize).toBeCloseTo(1.25, 2); // Average odds movement
      expect(trajectory.lineMovements).toBe(1); // One line movement (-7 to -6.5)
      expect(trajectory.movementDirection).toBe('AGAINST'); // Line moved against us
      expect(trajectory.velocityScore).toBeGreaterThan(0.5); // Fast-moving line
    });
  });

  describe('Professional CLV Validation', () => {
    test('GOLDEN: CLV validation against known profitable scenarios', async () => {
      // Test scenario: Opening -110, closing -130 (major line movement)
      const trackingId = await clvService.initializeTracking({
        propId: 'validation-test',
        sport: 'NBA',
        market: 'total',
        openingLine: 220.5,
        openingOdds: -110,
        bookmaker: 'BetMGM',
        timestamp: new Date('2025-01-09T08:00:00Z'),
      });

      const clvResult = await clvService.updateClosingLine(trackingId, {
        closingLine: 220.5,
        closingOdds: -130,
        closingTimestamp: new Date('2025-01-09T20:00:00Z'),
      });

      const validation = clvService.validateProfessionalCLV(clvResult);

      // LOCKED VALUES - professional validation
      expect(validation.isProfessionalGrade).toBe(true); // >5% CLV is professional
      expect(validation.confidenceLevel).toBe('HIGH'); // Strong line movement
      expect(validation.expectedWinRate).toBeCloseTo(0.565, 3); // Win rate improvement
      expect(validation.kellyFraction).toBeCloseTo(0.154, 3); // Kelly sizing
      expect(validation.profitExpectancy).toBeCloseTo(0.154, 3); // Long-term profit
    });

    test('GOLDEN: CLV edge calculation should match Kelly criterion input', () => {
      const clvScenarios = [
        { openOdds: -110, closeOdds: -120, expectedEdge: 0.0833 },
        { openOdds: -110, closeOdds: -105, expectedEdge: -0.0227 },
        { openOdds: +150, closeOdds: +120, expectedEdge: 0.2083 },
        { openOdds: -200, closeOdds: -220, expectedEdge: 0.0455 },
      ];

      clvScenarios.forEach(({ openOdds, closeOdds, expectedEdge }) => {
        const edge = clvService.calculateCLVEdge(openOdds, closeOdds);
        expect(edge).toBeCloseTo(expectedEdge, 4);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('GOLDEN: Handle stale line scenarios (>2 hours old)', async () => {
      const staleTime = new Date('2025-01-09T08:00:00Z');
      const currentTime = new Date('2025-01-09T20:30:00Z'); // 12.5 hours later

      const result = await clvService.handleStaleLineScenario({
        openingOdds: -110,
        lastUpdateTime: staleTime,
        currentTime: currentTime,
      });

      // LOCKED VALUES - stale line handling
      expect(result.isStale).toBe(true);
      expect(result.stalenessHours).toBe(12.5);
      expect(result.reliabilityScore).toBeLessThan(0.5); // Low reliability
      expect(result.recommendedAction).toBe('MANUAL_REVIEW');
    });

    test('GOLDEN: Extreme line movements should trigger validation flags', () => {
      const extremeMovements = [
        { from: -110, to: -300, expectFlag: true }, // Massive movement
        { from: +200, to: -150, expectFlag: true }, // Crossed zero
        { from: -105, to: -108, expectFlag: false }, // Normal movement
        { from: -110, to: -105, expectFlag: false }, // Reverse but small
      ];

      extremeMovements.forEach(({ from, to, expectFlag }) => {
        const result = clvService.validateLineMovement(from, to);
        expect(result.requiresManualReview).toBe(expectFlag);
      });
    });
  });

  describe('Integration Snapshots', () => {
    test('GOLDEN: Complete CLV tracking lifecycle snapshot', async () => {
      // Full lifecycle: Initialize -> Track movements -> Finalize -> Analyze
      const lifecycle = await clvService.executeFullLifecycle({
        propId: 'lifecycle-test',
        sport: 'NBA',
        market: 'player_prop',
        player: 'LeBron James',
        statType: 'points',
        line: 27.5,
        movements: [
          { time: '09:00', odds: -115, book: 'DraftKings' },
          { time: '12:00', odds: -118, book: 'DraftKings' },
          { time: '15:00', odds: -125, book: 'DraftKings' },
          { time: '18:00', odds: -130, book: 'DraftKings' },
        ],
      });

      // LOCKED SNAPSHOT - complete lifecycle results
      const expectedSnapshot = {
        totalCLV: 11.54,
        category: 'EXCELLENT',
        movements: 3,
        finalImpliedProb: 56.52,
        kellyFraction: 0.115,
        profitExpectancy: 0.115,
        qualityScore: 80,
      };

      expect(lifecycle.totalCLV).toBeCloseTo(expectedSnapshot.totalCLV, 2);
      expect(lifecycle.category).toBe(expectedSnapshot.category);
      expect(lifecycle.movementCount).toBe(expectedSnapshot.movements);
      expect(lifecycle.finalImpliedProb).toBeCloseTo(expectedSnapshot.finalImpliedProb, 2);
      expect(lifecycle.kellyFraction).toBeCloseTo(expectedSnapshot.kellyFraction, 3);
      expect(lifecycle.profitExpectancy).toBeCloseTo(expectedSnapshot.profitExpectancy, 3);
      expect(lifecycle.qualityScore).toBe(expectedSnapshot.qualityScore);
    });
  });
});
