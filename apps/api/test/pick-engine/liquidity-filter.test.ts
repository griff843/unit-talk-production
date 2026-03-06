/**
 * Unit tests for Liquidity Filter (SPRINT-035)
 */
import { makeInput, DEFAULT_CONFIG } from './fixtures';

import { applyLiquidityFilter } from '@/pick-engine/liquidity-filter';

describe('applyLiquidityFilter', () => {
  it('passes when book_count meets threshold', () => {
    const result = applyLiquidityFilter(makeInput({ book_count: 5 }), DEFAULT_CONFIG);
    expect(result.filter_name).toBe('liquidity');
    expect(result.passed).toBe(true);
    expect(result.value).toBe(5);
    expect(result.threshold).toBe(4);
  });

  it('rejects when book_count is below threshold', () => {
    const result = applyLiquidityFilter(makeInput({ book_count: 3 }), DEFAULT_CONFIG);
    expect(result.passed).toBe(false);
    expect(result.value).toBe(3);
    expect(result.threshold).toBe(4);
  });

  it('passes at exact boundary (book_count === threshold)', () => {
    const result = applyLiquidityFilter(makeInput({ book_count: 4 }), DEFAULT_CONFIG);
    expect(result.passed).toBe(true);
  });

  it('rejects at one below boundary', () => {
    const result = applyLiquidityFilter(makeInput({ book_count: 3 }), DEFAULT_CONFIG);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('<');
  });

  it('respects custom config threshold', () => {
    const config = { ...DEFAULT_CONFIG, liquidity_threshold: 6 };
    const result = applyLiquidityFilter(makeInput({ book_count: 5 }), config);
    expect(result.passed).toBe(false);
    expect(result.threshold).toBe(6);
  });
});
