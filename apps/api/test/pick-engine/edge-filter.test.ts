/**
 * Unit tests for Edge Filter (SPRINT-035)
 */
import { makeInput, DEFAULT_CONFIG } from './fixtures';

import { applyEdgeFilter } from '@/pick-engine/edge-filter';

describe('applyEdgeFilter', () => {
  it('passes when edge_final exceeds threshold', () => {
    const result = applyEdgeFilter(makeInput({ edge_final: 0.07 }), DEFAULT_CONFIG);
    expect(result.filter_name).toBe('edge');
    expect(result.passed).toBe(true);
    expect(result.value).toBe(0.07);
    expect(result.threshold).toBe(0.025);
  });

  it('rejects when edge_final is below threshold', () => {
    const result = applyEdgeFilter(makeInput({ edge_final: 0.01 }), DEFAULT_CONFIG);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('<');
  });

  it('passes at exact boundary (edge_final === threshold)', () => {
    const result = applyEdgeFilter(makeInput({ edge_final: 0.025 }), DEFAULT_CONFIG);
    expect(result.passed).toBe(true);
  });

  it('rejects just below boundary', () => {
    const result = applyEdgeFilter(makeInput({ edge_final: 0.0249 }), DEFAULT_CONFIG);
    expect(result.passed).toBe(false);
  });

  it('respects custom config threshold', () => {
    const config = { ...DEFAULT_CONFIG, edge_threshold: 0.05 };
    const result = applyEdgeFilter(makeInput({ edge_final: 0.04 }), config);
    expect(result.passed).toBe(false);
    expect(result.threshold).toBe(0.05);
  });
});
