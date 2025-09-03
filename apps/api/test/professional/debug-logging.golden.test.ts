/**
 * Golden tests for scoring debug logging system
 * These tests lock debug log output format and content validation
 * NEVER modify expected values without full professional review
 */

import { scoringLogger, ScoringLogEntry } from '../../src/utils/scoringLogger';

describe('Debug Logging Golden Tests', () => {
  let consoleSpy: jest.SpyInstance;
  let originalEnv: string | undefined;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    originalEnv = process.env.SCORING_DEBUG;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    process.env.SCORING_DEBUG = originalEnv;
  });

  describe('Log Format Validation', () => {
    test('GOLDEN: Debug log should produce exact JSON format when enabled', () => {
      // Enable debug logging
      process.env.SCORING_DEBUG = 'true';

      const context = scoringLogger.startTrace('prop-123', 'NBA', 'points');
      
      const mockResult = {
        tier: 'S_TIER',
        finalScore: 85.2,
        confidence: 0.88,
        kellyFraction: 0.145,
        featureContributions: {
          expectedValue: 18.5,
          lineMovement: 12.8,
          matchupRating: 14.2,
          playerForm: 9.1,
          marketIntelligence: 11.3
        },
        deviggingResult: {
          trueProb: 0.595,
          deviggedEdge: 0.185
        },
        clvPct: 12.3,
        modelVersion: 'v2.1.0',
        sportConfig: 'NBA_v1.0'
      };

      scoringLogger.logScoringResult(context, mockResult, {
        expectedValue: 0.20,
        lineMovement: 0.12,
        matchupRating: 0.15,
        playerForm: 0.10,
        marketIntelligence: 0.13
      });

      // LOCKED FORMAT - exact JSON structure
      expect(consoleSpy).toHaveBeenCalledWith(
        'SCORING_DEBUG:',
        expect.stringMatching(/^{"trace_id":"[a-f0-9]{8}","prop_id":"pro\*\*\*23"/)
      );

      const loggedCall = consoleSpy.mock.calls[0];
      const logJson = loggedCall[1];
      const logEntry: ScoringLogEntry = JSON.parse(logJson);

      // LOCKED SCHEMA - exact field structure
      expect(logEntry).toMatchObject({
        trace_id: expect.stringMatching(/^[a-f0-9]{8}$/),
        prop_id: 'pro***23', // PII redacted
        league: 'NBA',
        market: 'poi***ts', // PII redacted
        devig_win_prob: 0.595,
        clv_pct: 12.3,
        features: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            value: expect.any(Number),
            weight: expect.any(Number),
            contribution: expect.any(Number)
          })
        ]),
        composite: 85.2,
        tier: 'S_TIER',
        kelly_fraction: 0.145,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        processing_time_ms: expect.any(Number),
        model_version: 'v2.1.0',
        sport_config: 'NBA_v1.0'
      });

      // LOCKED SIZE - must be under 4KB
      expect(logJson.length).toBeLessThan(4000);
    });

    test('GOLDEN: Feature contributions should be sorted by impact', () => {
      process.env.SCORING_DEBUG = 'true';
      
      const context = scoringLogger.startTrace('prop-456', 'NFL', 'rushing_yards');
      
      const mockResult = {
        tier: 'A_TIER',
        finalScore: 68.5,
        confidence: 0.82,
        kellyFraction: 0.089,
        featureContributions: {
          smallFeature: 2.1,        // Should be lower in list
          mediumFeature: 8.7,       // Should be middle
          majorFeature: 15.3,       // Should be first
          tinyFeature: 0.8,         // Should be last
          largeFeature: 12.4        // Should be second
        }
      };

      scoringLogger.logScoringResult(context, mockResult);

      const loggedCall = consoleSpy.mock.calls[0];
      const logEntry: ScoringLogEntry = JSON.parse(loggedCall[1]);

      // LOCKED ORDERING - sorted by contribution size
      expect(logEntry.features[0].name).toBe('majorFeature');
      expect(logEntry.features[0].contribution).toBe(15.3);
      expect(logEntry.features[1].name).toBe('largeFeature');  
      expect(logEntry.features[1].contribution).toBe(12.4);
      expect(logEntry.features[2].name).toBe('mediumFeature');
      expect(logEntry.features[2].contribution).toBe(8.7);
    });

    test('GOLDEN: Log should be disabled when SCORING_DEBUG=false', () => {
      process.env.SCORING_DEBUG = 'false';
      
      const context = scoringLogger.startTrace('prop-789', 'MLB', 'hits');
      scoringLogger.logScoringResult(context, {
        tier: 'B_TIER',
        finalScore: 55.0,
        confidence: 0.65,
        kellyFraction: 0.032
      });

      // LOCKED BEHAVIOR - no logging when disabled
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('PII Redaction', () => {
    test('GOLDEN: PII should be consistently redacted', () => {
      process.env.SCORING_DEBUG = 'true';

      const piiTests = [
        { input: 'lebron-james-points-over', expected: 'leb***er' },
        { input: 'prop-12345', expected: 'pro***45' },
        { input: 'user-sensitive-data', expected: 'use***ta' },
        { input: 'short', expected: 'sho***' },
        { input: 'ab', expected: 'ab***' }
      ];

      piiTests.forEach(({ input, expected }) => {
        const context = scoringLogger.startTrace(input, 'NBA', input);
        
        scoringLogger.logScoringResult(context, {
          tier: 'C_TIER',
          finalScore: 45,
          confidence: 0.6,
          kellyFraction: 0.015
        });

        const loggedCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1];
        const logEntry: ScoringLogEntry = JSON.parse(loggedCall[1]);

        // LOCKED REDACTION - consistent PII handling
        expect(logEntry.prop_id).toBe(expected);
        expect(logEntry.market).toBe(expected);
      });
    });
  });

  describe('Size and Performance Limits', () => {
    test('GOLDEN: Large feature set should be truncated to stay under 4KB', () => {
      process.env.SCORING_DEBUG = 'true';

      const context = scoringLogger.startTrace('large-prop', 'NBA', 'comprehensive');

      // Create many features to exceed size limit
      const largeFeatureSet: Record<string, number> = {};
      for (let i = 0; i < 50; i++) {
        largeFeatureSet[`veryLongFeatureNameThatExceedsNormalLimits_${i}`] = Math.random() * 10;
      }

      const mockResult = {
        tier: 'A_TIER',
        finalScore: 72.0,
        confidence: 0.85,
        kellyFraction: 0.12,
        featureContributions: largeFeatureSet
      };

      scoringLogger.logScoringResult(context, mockResult);

      const loggedCall = consoleSpy.mock.calls[0];
      const logJson = loggedCall[1];
      const logEntry: ScoringLogEntry = JSON.parse(logJson);

      // LOCKED SIZE LIMITS - enforced truncation
      expect(logJson.length).toBeLessThan(4000); // Under 4KB
      expect(logEntry.features.length).toBeLessThanOrEqual(15); // Max 15 features
      
      // Should include truncation indicator if needed
      if (logEntry._truncated) {
        expect(logEntry._truncated).toBe(true);
      }
    });

    test('GOLDEN: Processing time should be captured accurately', () => {
      process.env.SCORING_DEBUG = 'true';

      const context = scoringLogger.startTrace('timing-test', 'NFL', 'passing_yards');
      
      // Simulate some processing time
      const startTime = Date.now();
      while (Date.now() - startTime < 50) {
        // Wait ~50ms
      }

      scoringLogger.logScoringResult(context, {
        tier: 'B_TIER',
        finalScore: 58,
        confidence: 0.7,
        kellyFraction: 0.045
      });

      const loggedCall = consoleSpy.mock.calls[0];
      const logEntry: ScoringLogEntry = JSON.parse(loggedCall[1]);

      // LOCKED TIMING - processing time capture
      expect(logEntry.processing_time_ms).toBeGreaterThanOrEqual(50);
      expect(logEntry.processing_time_ms).toBeLessThan(1000); // Reasonable upper bound
    });
  });

  describe('Step-by-Step Logging', () => {
    test('GOLDEN: Devigging step should log exact format', () => {
      process.env.SCORING_DEBUG = 'true';

      const context = scoringLogger.startTrace('devig-test', 'NBA', 'total');
      
      scoringLogger.logDevigging(context, -110, {
        fairOdds: -107,
        totalVig: 0.0455,
        trueProb: 0.517,
        deviggedEdge: 0.024
      });

      const loggedCall = consoleSpy.mock.calls[0];
      const logEntry = JSON.parse(loggedCall[1]);

      // LOCKED DEVIGGING FORMAT
      expect(logEntry).toMatchObject({
        trace_id: expect.stringMatching(/^[a-f0-9]{8}$/),
        step: 'devigging',
        original_odds: -110,
        fair_odds: -107,
        vig_removed: 0.05, // Rounded to 2 decimals
        true_prob: 0.517,
        edge: 0.024,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      });
    });

    test('GOLDEN: CLV tracking step should log tracking initiation', () => {
      process.env.SCORING_DEBUG = 'true';

      const context = scoringLogger.startTrace('clv-test', 'NFL', 'moneyline');
      
      scoringLogger.logCLVTracking(context, 'clv-tracking-id-12345', -150);

      const loggedCall = consoleSpy.mock.calls[0];
      const logEntry = JSON.parse(loggedCall[1]);

      // LOCKED CLV FORMAT
      expect(logEntry).toMatchObject({
        trace_id: expect.stringMatching(/^[a-f0-9]{8}$/),
        step: 'clv_tracking',
        clv_id: 'clv-trac', // Redacted to 8 chars
        initial_line: -150,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      });
    });

    test('GOLDEN: Professional routing should log path selection', () => {
      process.env.SCORING_DEBUG = 'true';

      const context = scoringLogger.startTrace('routing-test', 'MLB', 'runs');
      
      scoringLogger.logProfessionalRouting(context, 'PROFESSIONAL', 1250);

      const loggedCall = consoleSpy.mock.calls[0];
      const logEntry = JSON.parse(loggedCall[1]);

      // LOCKED ROUTING FORMAT
      expect(logEntry).toMatchObject({
        trace_id: expect.stringMatching(/^[a-f0-9]{8}$/),
        step: 'routing',
        path: 'PROFESSIONAL',
        processing_ms: 1250,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    test('GOLDEN: Logging errors should fallback gracefully', () => {
      process.env.SCORING_DEBUG = 'true';

      // Create invalid context to trigger error
      const invalidContext = {
        propId: null,
        sport: undefined,
        market: {},
        startTime: 'invalid',
        traceId: 'test-123'
      } as any;

      const mockResult = {
        tier: 'A_TIER',
        finalScore: 70,
        confidence: 0.8,
        kellyFraction: 0.1
      };

      // Should not throw error, should use fallback
      expect(() => {
        scoringLogger.logScoringResult(invalidContext, mockResult);
      }).not.toThrow();

      // Should have logged a fallback minimal entry
      expect(consoleSpy).toHaveBeenCalledWith(
        'SCORING_DEBUG:',
        expect.stringContaining('"error":"logging_error"')
      );
    });
  });

  describe('Production Integration Snapshots', () => {
    test('GOLDEN: Complete professional scoring log sequence', () => {
      process.env.SCORING_DEBUG = 'true';

      const context = scoringLogger.startTrace('complete-test', 'NBA', 'assists');

      // Log complete professional workflow
      scoringLogger.logProfessionalRouting(context, 'PROFESSIONAL', 850);
      
      scoringLogger.logDevigging(context, -115, {
        fairOdds: -110,
        totalVig: 0.043,
        trueProb: 0.524,
        deviggedEdge: 0.067
      });

      scoringLogger.logCLVTracking(context, 'clv-abc123def456', -115);

      scoringLogger.logScoringResult(context, {
        tier: 'S_TIER',
        finalScore: 87.5,
        confidence: 0.91,
        kellyFraction: 0.158,
        featureContributions: {
          expectedValue: 19.2,
          matchupRating: 15.1,
          playerForm: 12.8,
          marketIntelligence: 11.5,
          lineMovement: 10.3
        },
        deviggingResult: { trueProb: 0.524 },
        clvPct: 8.7,
        modelVersion: 'enhanced-v2.1',
        sportConfig: 'NBA-pro-v1'
      });

      // LOCKED SEQUENCE - complete workflow logged
      expect(consoleSpy).toHaveBeenCalledTimes(4); // All steps logged
      
      // Verify final comprehensive log
      const finalLogCall = consoleSpy.mock.calls[3];
      const finalLogEntry: ScoringLogEntry = JSON.parse(finalLogCall[1]);

      expect(finalLogEntry.tier).toBe('S_TIER');
      expect(finalLogEntry.composite).toBe(87.5);
      expect(finalLogEntry.kelly_fraction).toBe(0.158);
      expect(finalLogEntry.features).toHaveLength(5);
      expect(finalLogEntry.processing_time_ms).toBeGreaterThan(0);
    });
  });
});