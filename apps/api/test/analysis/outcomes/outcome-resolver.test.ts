/**
 * Unit tests for Outcome Resolver (SPRINT-029)
 * Sprint: SPRINT-034 — Outcome Tracking Foundation
 */
import {
  resolveOutcome,
  isDirectionallyCorrect,
  computeFlatBetROI,
  type Outcome,
} from '@/analysis/outcomes/outcome-resolver';

// ── resolveOutcome ──────────────────────────────────────────────────────────

describe('resolveOutcome', () => {
  it('returns WIN when actual > line', () => {
    expect(resolveOutcome(25.5, 24.5)).toBe('WIN');
  });

  it('returns LOSS when actual < line', () => {
    expect(resolveOutcome(20, 24.5)).toBe('LOSS');
  });

  it('returns PUSH when actual === line', () => {
    expect(resolveOutcome(24.5, 24.5)).toBe('PUSH');
  });

  it('handles zero line', () => {
    expect(resolveOutcome(0, 0)).toBe('PUSH');
    expect(resolveOutcome(1, 0)).toBe('WIN');
  });

  it('handles large values', () => {
    expect(resolveOutcome(150, 100)).toBe('WIN');
    expect(resolveOutcome(50, 100)).toBe('LOSS');
  });

  it('handles fractional differences', () => {
    expect(resolveOutcome(22.6, 22.5)).toBe('WIN');
    expect(resolveOutcome(22.4, 22.5)).toBe('LOSS');
  });
});

// ── isDirectionallyCorrect ──────────────────────────────────────────────────

describe('isDirectionallyCorrect', () => {
  it('returns true when model predicted over and outcome is WIN', () => {
    expect(isDirectionallyCorrect(0.65, 'WIN')).toBe(true);
  });

  it('returns false when model predicted over and outcome is LOSS', () => {
    expect(isDirectionallyCorrect(0.65, 'LOSS')).toBe(false);
  });

  it('returns true when model predicted under and outcome is LOSS', () => {
    expect(isDirectionallyCorrect(0.35, 'LOSS')).toBe(true);
  });

  it('returns false when model predicted under and outcome is WIN', () => {
    expect(isDirectionallyCorrect(0.35, 'WIN')).toBe(false);
  });

  it('treats p_final = 0.5 as predicting over', () => {
    expect(isDirectionallyCorrect(0.5, 'WIN')).toBe(true);
    expect(isDirectionallyCorrect(0.5, 'LOSS')).toBe(false);
  });

  it('returns null for PUSH', () => {
    expect(isDirectionallyCorrect(0.65, 'PUSH')).toBeNull();
    expect(isDirectionallyCorrect(0.35, 'PUSH')).toBeNull();
  });
});

// ── computeFlatBetROI ───────────────────────────────────────────────────────

describe('computeFlatBetROI', () => {
  it('returns positive ROI for all wins', () => {
    const result = computeFlatBetROI(['WIN', 'WIN', 'WIN']);
    // profit = 3 * 100 = 300, wagered = 3 * 110 = 330
    expect(result.total_profit).toBe(300);
    expect(result.total_wagered).toBe(330);
    expect(result.roi_pct).toBeCloseTo((300 / 330) * 100, 2);
  });

  it('returns -100% ROI for all losses', () => {
    const result = computeFlatBetROI(['LOSS', 'LOSS']);
    // profit = -220, wagered = 220
    expect(result.total_profit).toBe(-220);
    expect(result.total_wagered).toBe(220);
    expect(result.roi_pct).toBeCloseTo(-100, 2);
  });

  it('handles mixed outcomes', () => {
    const result = computeFlatBetROI(['WIN', 'LOSS', 'WIN']);
    // profit = +100 -110 +100 = +90, wagered = 330
    expect(result.total_profit).toBe(90);
    expect(result.total_wagered).toBe(330);
    expect(result.roi_pct).toBeCloseTo((90 / 330) * 100, 2);
  });

  it('returns zeroes for all pushes', () => {
    const result = computeFlatBetROI(['PUSH', 'PUSH']);
    expect(result.total_profit).toBe(0);
    expect(result.total_wagered).toBe(0);
    expect(result.roi_pct).toBe(0);
  });

  it('returns zeroes for empty array', () => {
    const result = computeFlatBetROI([]);
    expect(result.total_profit).toBe(0);
    expect(result.total_wagered).toBe(0);
    expect(result.roi_pct).toBe(0);
  });

  it('filters pushes from wager count', () => {
    const result = computeFlatBetROI(['WIN', 'PUSH', 'LOSS']);
    // Only WIN and LOSS counted: profit = 100 - 110 = -10, wagered = 220
    expect(result.total_profit).toBe(-10);
    expect(result.total_wagered).toBe(220);
  });
});
