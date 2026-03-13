/**
 * Unit tests: ShadowVerdictEngine
 * Sprint: SPRINT-VERIFICATION-SHADOW-DIVERGENCE-GUARDRAILS
 */

import { describe, it, expect } from 'vitest';

import { ShadowVerdictEngine } from '../shadow-verdict';

import type { ClassifiedDivergences } from '../types';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function classified(counts: {
  CRITICAL?: number;
  HIGH?: number;
  MEDIUM?: number;
  LOW?: number;
}): ClassifiedDivergences {
  const bySeverity = {
    CRITICAL: counts.CRITICAL ?? 0,
    HIGH: counts.HIGH ?? 0,
    MEDIUM: counts.MEDIUM ?? 0,
    LOW: counts.LOW ?? 0,
  };
  const totalCount = Object.values(bySeverity).reduce((a, b) => a + b, 0);

  return {
    structuralDivergences: [],
    scoreDivergences: [],
    bySeverity,
    totalCount,
  };
}

// ─────────────────────────────────────────────────────────────
// VERDICT TESTS
// ─────────────────────────────────────────────────────────────

describe('ShadowVerdictEngine.computeVerdict', () => {
  it('returns FAIL when any CRITICAL divergence is present', () => {
    expect(ShadowVerdictEngine.computeVerdict(classified({ CRITICAL: 1 }))).toBe('FAIL');
    expect(ShadowVerdictEngine.computeVerdict(classified({ CRITICAL: 3, HIGH: 2 }))).toBe('FAIL');
  });

  it('returns PASS_WITH_WARNINGS on HIGH only (no CRITICAL)', () => {
    expect(ShadowVerdictEngine.computeVerdict(classified({ HIGH: 1 }))).toBe('PASS_WITH_WARNINGS');
    expect(ShadowVerdictEngine.computeVerdict(classified({ HIGH: 2, MEDIUM: 1 }))).toBe(
      'PASS_WITH_WARNINGS'
    );
  });

  it('returns PASS_WITH_WARNINGS on MEDIUM only', () => {
    expect(ShadowVerdictEngine.computeVerdict(classified({ MEDIUM: 2 }))).toBe(
      'PASS_WITH_WARNINGS'
    );
  });

  it('returns PASS_WITH_WARNINGS on LOW only', () => {
    expect(ShadowVerdictEngine.computeVerdict(classified({ LOW: 5 }))).toBe('PASS_WITH_WARNINGS');
  });

  it('returns PASS when there are zero divergences', () => {
    expect(ShadowVerdictEngine.computeVerdict(classified({}))).toBe('PASS');
  });
});

describe('ShadowVerdictEngine.shouldFreeze', () => {
  it('returns true only when CRITICAL is present', () => {
    expect(ShadowVerdictEngine.shouldFreeze(classified({ CRITICAL: 1 }))).toBe(true);
    expect(ShadowVerdictEngine.shouldFreeze(classified({ CRITICAL: 0, HIGH: 5 }))).toBe(false);
    expect(ShadowVerdictEngine.shouldFreeze(classified({}))).toBe(false);
  });
});

describe('ShadowVerdictEngine.determine', () => {
  it('returns FAIL + freezeRecommended=true on CRITICAL', () => {
    const result = ShadowVerdictEngine.determine(classified({ CRITICAL: 2 }));
    expect(result.verdict).toBe('FAIL');
    expect(result.freezeRecommended).toBe(true);
    expect(result.generatedAt).toBeDefined();
  });

  it('returns PASS_WITH_WARNINGS + freezeRecommended=false on HIGH only', () => {
    const result = ShadowVerdictEngine.determine(classified({ HIGH: 3 }));
    expect(result.verdict).toBe('PASS_WITH_WARNINGS');
    expect(result.freezeRecommended).toBe(false);
  });

  it('returns PASS + freezeRecommended=false on zero divergences', () => {
    const result = ShadowVerdictEngine.determine(classified({}));
    expect(result.verdict).toBe('PASS');
    expect(result.freezeRecommended).toBe(false);
  });

  it('includes generatedAt timestamp', () => {
    const before = Date.now();
    const result = ShadowVerdictEngine.determine(classified({}));
    const after = Date.now();

    const ts = new Date(result.generatedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('attaches the divergences object to the result', () => {
    const div = classified({ CRITICAL: 1, HIGH: 2 });
    const result = ShadowVerdictEngine.determine(div);
    expect(result.divergences).toBe(div);
  });
});
