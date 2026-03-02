/**
 * featureHash.test.ts — Tests for deterministic feature vector hashing
 *
 * Sprint: DATA-MOAT-V3-INTEGRATION-001
 * Date: 2026-02-28
 */

import { describe, it, expect } from '@jest/globals';

import {
  computeFeatureVectorHash,
  verifyFeatureVectorHash,
  hashFeatureVector,
} from '../../src/lib/featureHash';

describe('computeFeatureVectorHash', () => {
  it('should produce same hash for same features regardless of key order', () => {
    const v1 = { a: 1, b: 2, c: 3 };
    const v2 = { c: 3, a: 1, b: 2 };
    expect(computeFeatureVectorHash(v1)).toBe(computeFeatureVectorHash(v2));
  });

  it('should produce different hash for different values', () => {
    const v1 = { a: 1 };
    const v2 = { a: 2 };
    expect(computeFeatureVectorHash(v1)).not.toBe(computeFeatureVectorHash(v2));
  });

  it('should produce a 64-character hex string (SHA-256)', () => {
    const hash = computeFeatureVectorHash({ test: 'value' });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle nested objects with different key orders', () => {
    const v1 = { outer: { inner: 1 }, other: 2 };
    const v2 = { other: 2, outer: { inner: 1 } };
    expect(computeFeatureVectorHash(v1)).toBe(computeFeatureVectorHash(v2));
  });

  it('should handle arrays', () => {
    const v1 = { items: [1, 2, 3] };
    const v2 = { items: [1, 2, 3] };
    expect(computeFeatureVectorHash(v1)).toBe(computeFeatureVectorHash(v2));
  });

  it('should differentiate arrays with different order', () => {
    const v1 = { items: [1, 2, 3] };
    const v2 = { items: [3, 2, 1] };
    expect(computeFeatureVectorHash(v1)).not.toBe(computeFeatureVectorHash(v2));
  });

  it('should handle null values', () => {
    const v1 = { a: null, b: 1 };
    const v2 = { b: 1, a: null };
    expect(computeFeatureVectorHash(v1)).toBe(computeFeatureVectorHash(v2));
  });

  it('should handle real feature vector structure', () => {
    const featureVector = {
      line: 22.5,
      odds: -110,
      selection: 'over',
      provider: 'fanduel',
      odds_score: 55.0,
      line_score: 48.75,
      market_score: 50,
      clv_at_bet: 2.5,
      weather_impact: 0,
      injury_impact: -5,
    };
    const hash = computeFeatureVectorHash(featureVector);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    // Re-hash should be identical
    expect(computeFeatureVectorHash(featureVector)).toBe(hash);
  });
});

describe('verifyFeatureVectorHash', () => {
  it('should return true for matching hash', () => {
    const features = { a: 1, b: 2 };
    const hash = computeFeatureVectorHash(features);
    expect(verifyFeatureVectorHash(features, hash)).toBe(true);
  });

  it('should return false for non-matching hash', () => {
    const features = { a: 1, b: 2 };
    const wrongHash = 'a'.repeat(64);
    expect(verifyFeatureVectorHash(features, wrongHash)).toBe(false);
  });

  it('should be case-insensitive for hash comparison', () => {
    const features = { test: 'value' };
    const hash = computeFeatureVectorHash(features);
    expect(verifyFeatureVectorHash(features, hash.toUpperCase())).toBe(true);
  });
});

describe('hashFeatureVector', () => {
  it('should return feature vector with _hash field', () => {
    const features = { a: 1, b: 2 };
    const result = hashFeatureVector(features);
    expect(result).toHaveProperty('_hash');
    expect(result._hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.a).toBe(1);
    expect(result.b).toBe(2);
  });

  it('should produce correct hash in _hash field', () => {
    const features = { a: 1, b: 2 };
    const result = hashFeatureVector(features);
    expect(verifyFeatureVectorHash(features, result._hash)).toBe(true);
  });
});
