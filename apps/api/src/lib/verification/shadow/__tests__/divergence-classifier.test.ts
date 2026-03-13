/**
 * Unit tests: DivergenceClassifier
 * Sprint: SPRINT-VERIFICATION-SHADOW-DIVERGENCE-GUARDRAILS
 */

import { describe, it, expect } from 'vitest';

import { DivergenceClassifier } from '../divergence-classifier';
import { ShadowScoreComparator } from '../shadow-comparator';

import type { DivergenceReport } from '../../shadow-comparator';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function emptyR3Report(runId = 'test-run'): DivergenceReport {
  return {
    runId,
    generatedAt: '2026-03-13T00:00:00.000Z',
    referenceEventCount: 0,
    shadowEventCount: 0,
    totalDivergences: 0,
    bySeverity: { critical: 0, warning: 0, informational: 0 },
    byCategory: { pick_state: 0, lifecycle_trace: 0, publish: 0, settlement: 0, recap: 0 },
    divergences: [],
    passed: true,
    verdict: 'CLEAN',
  };
}

function pickState(overrides: Record<string, unknown> = {}): Map<string, Record<string, unknown>> {
  return new Map([
    [
      'pick-1',
      {
        id: 'pick-1',
        professional_score: 100,
        grade_score: 90,
        confidence: 0.87,
        meta: { grade_score: 92, confidence: 0.87 },
        settlement_result: 'win',
        settlement_status: 'settled',
        promotion_status: 'promoted',
        posted_to_discord: true,
        status: 'won',
        ...overrides,
      },
    ],
  ]);
}

// ─────────────────────────────────────────────────────────────
// SCORE COMPARATOR UNIT TESTS
// ─────────────────────────────────────────────────────────────

describe('ShadowScoreComparator.classifyPercent', () => {
  it('classifies > 5% diff as HIGH', () => {
    expect(ShadowScoreComparator.classifyPercent(0.06)).toBe('HIGH');
    expect(ShadowScoreComparator.classifyPercent(0.1)).toBe('HIGH');
    expect(ShadowScoreComparator.classifyPercent(1.0)).toBe('HIGH');
  });

  it('classifies <= 5% and > 1% diff as MEDIUM', () => {
    expect(ShadowScoreComparator.classifyPercent(0.05)).toBe('MEDIUM');
    expect(ShadowScoreComparator.classifyPercent(0.03)).toBe('MEDIUM');
    expect(ShadowScoreComparator.classifyPercent(0.011)).toBe('MEDIUM');
  });

  it('classifies <= 1% diff as LOW', () => {
    expect(ShadowScoreComparator.classifyPercent(0.01)).toBe('LOW');
    expect(ShadowScoreComparator.classifyPercent(0.005)).toBe('LOW');
    expect(ShadowScoreComparator.classifyPercent(0.0)).toBe('LOW');
  });
});

describe('ShadowScoreComparator.buildEntry', () => {
  it('returns null when values are identical', () => {
    expect(ShadowScoreComparator.buildEntry('pick-1', 'grade_score', 100, 100)).toBeNull();
  });

  it('classifies ref=100, shadow=94 as HIGH (6%)', () => {
    const entry = ShadowScoreComparator.buildEntry('pick-1', 'grade_score', 100, 94);
    expect(entry).not.toBeNull();
    expect(entry!.level).toBe('HIGH');
    expect(entry!.absoluteDiff).toBeCloseTo(6);
    expect(entry!.percentDiff).toBeCloseTo(0.06);
  });

  it('classifies ref=100, shadow=97 as MEDIUM (3%)', () => {
    const entry = ShadowScoreComparator.buildEntry('pick-1', 'grade_score', 100, 97);
    expect(entry!.level).toBe('MEDIUM');
    expect(entry!.percentDiff).toBeCloseTo(0.03);
  });

  it('classifies ref=100, shadow=99.5 as LOW (0.5%)', () => {
    const entry = ShadowScoreComparator.buildEntry('pick-1', 'grade_score', 100, 99.5);
    expect(entry!.level).toBe('LOW');
    expect(entry!.percentDiff).toBeCloseTo(0.005);
  });

  it('handles zero reference score gracefully (returns HIGH)', () => {
    // When ref = 0, percentDiff = 1 by convention → HIGH
    const entry = ShadowScoreComparator.buildEntry('pick-1', 'grade_score', 0, 5);
    expect(entry).not.toBeNull();
    expect(entry!.level).toBe('HIGH');
    expect(entry!.percentDiff).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// DIVERGENCE CLASSIFIER
// ─────────────────────────────────────────────────────────────

describe('DivergenceClassifier', () => {
  it('produces no divergences for identical pick states (clean)', () => {
    const ref = pickState();
    const shadow = pickState();
    const classified = DivergenceClassifier.classify(emptyR3Report(), ref, shadow);

    expect(classified.totalCount).toBe(0);
    expect(classified.bySeverity.CRITICAL).toBe(0);
    expect(classified.bySeverity.HIGH).toBe(0);
  });

  it('classifies settlement_result mismatch as CRITICAL', () => {
    const r3Report: DivergenceReport = {
      ...emptyR3Report(),
      totalDivergences: 1,
      bySeverity: { critical: 1, warning: 0, informational: 0 },
      byCategory: { pick_state: 1, lifecycle_trace: 0, publish: 0, settlement: 0, recap: 0 },
      divergences: [
        {
          pickId: 'pick-1',
          category: 'pick_state',
          field: 'settlement_result',
          referenceValue: 'win',
          shadowValue: 'loss',
          level: 'critical',
          description: 'Critical field mismatch on pick pick-1: settlement_result',
          detectedAt: '2026-03-13T00:00:00.000Z',
        },
      ],
      passed: false,
      verdict: 'CRITICAL_DIVERGENCE',
    };

    const classified = DivergenceClassifier.classify(r3Report, pickState(), pickState());
    expect(classified.bySeverity.CRITICAL).toBe(1);
    expect(classified.structuralDivergences[0].level).toBe('CRITICAL');
    expect(classified.structuralDivergences[0].field).toBe('settlement_result');
  });

  it('classifies promotion_status mismatch as CRITICAL', () => {
    const r3Report: DivergenceReport = {
      ...emptyR3Report(),
      totalDivergences: 1,
      bySeverity: { critical: 0, warning: 1, informational: 0 },
      byCategory: { pick_state: 1, lifecycle_trace: 0, publish: 0, settlement: 0, recap: 0 },
      divergences: [
        {
          pickId: 'pick-1',
          category: 'pick_state',
          field: 'promotion_status',
          referenceValue: 'promoted',
          shadowValue: 'pending',
          level: 'warning',
          description: 'Warning field mismatch on pick pick-1: promotion_status',
          detectedAt: '2026-03-13T00:00:00.000Z',
        },
      ],
      passed: true,
      verdict: 'WARNINGS_DETECTED',
    };

    const classified = DivergenceClassifier.classify(r3Report, pickState(), pickState());
    // promotion_status is in CRITICAL_STRUCTURAL_FIELDS — escalates to CRITICAL
    expect(classified.bySeverity.CRITICAL).toBe(1);
  });

  it('classifies >5% score diff as HIGH', () => {
    const ref = pickState({ grade_score: 100 });
    const shadow = pickState({ grade_score: 93 }); // 7% diff
    const classified = DivergenceClassifier.classify(emptyR3Report(), ref, shadow);

    expect(classified.bySeverity.HIGH).toBeGreaterThanOrEqual(1);
    const highEntry = classified.scoreDivergences.find(s => s.level === 'HIGH');
    expect(highEntry).toBeDefined();
    expect(highEntry!.field).toBe('grade_score');
  });

  it('classifies <5% score diff as MEDIUM', () => {
    const ref = pickState({ professional_score: 100 });
    const shadow = pickState({ professional_score: 97 }); // 3% diff
    const classified = DivergenceClassifier.classify(emptyR3Report(), ref, shadow);

    expect(classified.bySeverity.MEDIUM).toBeGreaterThanOrEqual(1);
    const medEntry = classified.scoreDivergences.find(s => s.level === 'MEDIUM');
    expect(medEntry).toBeDefined();
  });

  it('classifies <1% score diff as LOW', () => {
    const ref = pickState({ confidence: 0.87 });
    const shadow = pickState({ confidence: 0.868 }); // ~0.23% diff
    const classified = DivergenceClassifier.classify(emptyR3Report(), ref, shadow);

    expect(classified.bySeverity.LOW).toBeGreaterThanOrEqual(1);
  });

  it('counts both structural and score divergences in totalCount', () => {
    const r3Report: DivergenceReport = {
      ...emptyR3Report(),
      totalDivergences: 1,
      bySeverity: { critical: 1, warning: 0, informational: 0 },
      byCategory: { pick_state: 1, lifecycle_trace: 0, publish: 0, settlement: 0, recap: 0 },
      divergences: [
        {
          pickId: 'pick-1',
          category: 'pick_state',
          field: 'settlement_result',
          referenceValue: 'win',
          shadowValue: 'loss',
          level: 'critical',
          description: 'Critical field mismatch',
          detectedAt: '2026-03-13T00:00:00.000Z',
        },
      ],
      passed: false,
      verdict: 'CRITICAL_DIVERGENCE',
    };

    const ref = pickState({ grade_score: 100 });
    const shadow = pickState({ grade_score: 93 }); // +HIGH score divergence

    const classified = DivergenceClassifier.classify(r3Report, ref, shadow);
    expect(classified.totalCount).toBeGreaterThanOrEqual(2);
    expect(classified.bySeverity.CRITICAL).toBeGreaterThanOrEqual(1);
    expect(classified.bySeverity.HIGH).toBeGreaterThanOrEqual(1);
  });
});
