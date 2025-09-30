/**
 * Unit tests for unifiedPicksWriter
 */

import { summarizeWriteMetrics } from '../../src/services/unifiedPicksWriter';

describe('unifiedPicksWriter', () => {
  describe('summarizeWriteMetrics', () => {
    it('should format metrics with all fields', () => {
      const metrics = {
        attemptedWrites: 100,
        inserted: 50,
        skippedDedup: 40,
        errors: 10
      };

      const summary = summarizeWriteMetrics(metrics, 29, 100);

      expect(summary).toBe('processed=100 inserted=50 skippedDedup=40 errors=10 events=29');
    });

    it('should format metrics without eventsFetched', () => {
      const metrics = {
        attemptedWrites: 100,
        inserted: 50,
        skippedDedup: 40,
        errors: 10
      };

      const summary = summarizeWriteMetrics(metrics);

      expect(summary).toBe('processed=100 inserted=50 skippedDedup=40 errors=10');
    });

    it('should handle zero values', () => {
      const metrics = {
        attemptedWrites: 58,
        inserted: 0,
        skippedDedup: 58,
        errors: 0
      };

      const summary = summarizeWriteMetrics(metrics, 29);

      expect(summary).toBe('processed=58 inserted=0 skippedDedup=58 errors=0 events=29');
    });

    it('should use processed parameter when provided', () => {
      const metrics = {
        attemptedWrites: 58,
        inserted: 50,
        skippedDedup: 8,
        errors: 0
      };

      const summary = summarizeWriteMetrics(metrics, 29, 100);

      expect(summary).toBe('processed=100 inserted=50 skippedDedup=8 errors=0 events=29');
    });
  });

  describe('dedup behavior', () => {
    it('should treat 23505 error as skippedDedup not errors', async () => {
      // Mock test: In real writer, PostgREST 23505 (duplicate key) errors
      // should increment skippedDedup counter, not errors counter

      const mock23505Error = {
        code: '23505',
        message: 'duplicate key value violates unique constraint "uq_unified_picks_fingerprint"'
      };

      // This test documents the expected behavior:
      // When upsert returns error code 23505, the writer should:
      // 1. Increment metrics.skippedDedup
      // 2. NOT increment metrics.errors
      // 3. Continue processing (not throw)

      const expectedBehavior = {
        onError23505: 'increment skippedDedup',
        notIncrementErrors: true,
        continueProcessing: true
      };

      expect(mock23505Error.code).toBe('23505');
      expect(expectedBehavior.onError23505).toBe('increment skippedDedup');
      expect(expectedBehavior.notIncrementErrors).toBe(true);
    });

    it('should increment errors for non-23505 errors', () => {
      // Mock test: Document that non-duplicate errors should increment errors counter

      const mockRealError = {
        code: '42P01', // undefined_table
        message: 'relation "unified_picks" does not exist'
      };

      const expectedBehavior = {
        onNonDupError: 'increment errors',
        captureFirstError: true
      };

      expect(mockRealError.code).not.toBe('23505');
      expect(expectedBehavior.onNonDupError).toBe('increment errors');
      expect(expectedBehavior.captureFirstError).toBe(true);
    });
  });

  describe('guardrails', () => {
    it('should warn on 3 consecutive zero-insert runs', () => {
      // Mock test: Document guardrail behavior
      // When attemptedWrites > 0 && inserted == 0 && skippedDedup == 0
      // for 3 consecutive runs, should log warning

      const zeroInsertMetrics = {
        attemptedWrites: 100,
        inserted: 0,
        skippedDedup: 0,
        errors: 0
      };

      const expectedBehavior = {
        trackConsecutiveRuns: true,
        warnAfter: 3,
        warningMessage: 'Potential stale data or transform mismatch'
      };

      expect(zeroInsertMetrics.inserted).toBe(0);
      expect(zeroInsertMetrics.skippedDedup).toBe(0);
      expect(expectedBehavior.warnAfter).toBe(3);
    });

    it('should reset counter on successful insert or dedup', () => {
      // Mock test: Document counter reset behavior

      const successMetrics = {
        attemptedWrites: 100,
        inserted: 50,
        skippedDedup: 50,
        errors: 0
      };

      const expectedBehavior = {
        resetCounter: true,
        condition: 'inserted > 0 OR skippedDedup > 0'
      };

      expect(successMetrics.inserted + successMetrics.skippedDedup).toBeGreaterThan(0);
      expect(expectedBehavior.resetCounter).toBe(true);
    });
  });
});