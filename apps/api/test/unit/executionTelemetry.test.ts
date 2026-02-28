/**
 * Execution Telemetry Unit Tests
 * Sprint: EXECUTION-TELEMETRY-ACTIVATION-003
 */
import { describe, it, expect } from '@jest/globals';

import {
  computeClvDelta,
  classifyClvBucket,
  oddsToImpliedProb,
  resolveTargetSurface,
} from '../../src/lib/executionTelemetry';

describe('executionTelemetry', () => {
  describe('oddsToImpliedProb', () => {
    it('converts positive American odds correctly', () => {
      // +200 odds = 33.33% implied probability (100 / 300)
      const prob = oddsToImpliedProb(200);
      expect(prob).toBeCloseTo(0.333, 2);
    });

    it('converts negative American odds correctly', () => {
      // -150 odds = 60% implied probability (150 / 250)
      const prob = oddsToImpliedProb(-150);
      expect(prob).toBeCloseTo(0.6, 2);
    });

    it('converts -110 odds correctly', () => {
      // -110 odds = 52.38% implied probability (110 / 210)
      const prob = oddsToImpliedProb(-110);
      expect(prob).toBeCloseTo(0.5238, 3);
    });

    it('returns null for zero odds', () => {
      expect(oddsToImpliedProb(0)).toBeNull();
    });
  });

  describe('computeClvDelta', () => {
    describe('line-based CLV', () => {
      it('computes positive CLV for OVER when line moves up', () => {
        // Entry: 24.5, Closing: 26.5 → +2.0 CLV (good for OVER)
        const clv = computeClvDelta(24.5, 26.5, null, null, 'OVER');
        expect(clv).toBe(2);
      });

      it('computes negative CLV for OVER when line moves down', () => {
        // Entry: 26.5, Closing: 24.5 → -2.0 CLV (bad for OVER)
        const clv = computeClvDelta(26.5, 24.5, null, null, 'OVER');
        expect(clv).toBe(-2);
      });

      it('computes positive CLV for UNDER when line moves down', () => {
        // Entry: 26.5, Closing: 24.5 → +2.0 CLV (good for UNDER)
        const clv = computeClvDelta(26.5, 24.5, null, null, 'UNDER');
        expect(clv).toBe(2);
      });

      it('computes negative CLV for UNDER when line moves up', () => {
        // Entry: 24.5, Closing: 26.5 → -2.0 CLV (bad for UNDER)
        const clv = computeClvDelta(24.5, 26.5, null, null, 'UNDER');
        expect(clv).toBe(-2);
      });
    });

    describe('odds-based CLV', () => {
      it('computes positive CLV when closing odds are worse', () => {
        // Entry: -110 (52.38%), Closing: -130 (56.52%) → +4.14% CLV
        const clv = computeClvDelta(null, null, -110, -130, null);
        expect(clv).toBeGreaterThan(0);
      });

      it('computes negative CLV when closing odds are better', () => {
        // Entry: -130 (56.52%), Closing: -110 (52.38%) → -4.14% CLV
        const clv = computeClvDelta(null, null, -130, -110, null);
        expect(clv).toBeLessThan(0);
      });
    });

    it('returns null when no line or odds provided', () => {
      const clv = computeClvDelta(null, null, null, null, null);
      expect(clv).toBeNull();
    });
  });

  describe('classifyClvBucket', () => {
    it('classifies strong positive CLV (>5%)', () => {
      expect(classifyClvBucket(6)).toBe('STRONG_POSITIVE');
      expect(classifyClvBucket(10)).toBe('STRONG_POSITIVE');
    });

    it('classifies positive CLV (2-5%)', () => {
      expect(classifyClvBucket(3)).toBe('POSITIVE');
      expect(classifyClvBucket(4.9)).toBe('POSITIVE');
    });

    it('classifies neutral CLV (-2% to 2%)', () => {
      expect(classifyClvBucket(0)).toBe('NEUTRAL');
      expect(classifyClvBucket(1.5)).toBe('NEUTRAL');
      expect(classifyClvBucket(-1.5)).toBe('NEUTRAL');
    });

    it('classifies negative CLV (-5% to -2%)', () => {
      expect(classifyClvBucket(-3)).toBe('NEGATIVE');
      expect(classifyClvBucket(-4.9)).toBe('NEGATIVE');
    });

    it('classifies strong negative CLV (<-5%)', () => {
      expect(classifyClvBucket(-6)).toBe('STRONG_NEGATIVE');
      expect(classifyClvBucket(-10)).toBe('STRONG_NEGATIVE');
    });

    it('returns null for null input', () => {
      expect(classifyClvBucket(null)).toBeNull();
    });
  });

  describe('resolveTargetSurface', () => {
    it('returns CANARY for canary mode', () => {
      expect(resolveTargetSurface('canary', 'BEST_BETS')).toBe('CANARY');
      expect(resolveTargetSurface('canary', null)).toBe('CANARY');
    });

    it('returns channel for production mode with valid channel', () => {
      expect(resolveTargetSurface('production', 'BEST_BETS')).toBe('BEST_BETS');
      expect(resolveTargetSurface('production', 'VIP_LOUNGE')).toBe('VIP_LOUNGE');
    });

    it('returns valid channel for null mode with valid channel', () => {
      // When mode is null, we still resolve valid channels (graceful degradation)
      expect(resolveTargetSurface(null, 'BEST_BETS')).toBe('BEST_BETS');
    });

    it('defaults to CANARY for null mode with null channel', () => {
      expect(resolveTargetSurface(null, null)).toBe('CANARY');
    });

    it('defaults to CANARY for unknown channel', () => {
      expect(resolveTargetSurface('production', 'UNKNOWN_CHANNEL')).toBe('CANARY');
    });
  });
});
