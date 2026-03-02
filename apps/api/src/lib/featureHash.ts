/**
 * featureHash.ts — Deterministic Feature Vector Hashing
 *
 * Sprint: DATA-MOAT-V3-INTEGRATION-001
 * Date: 2026-02-28
 *
 * Provides deterministic SHA-256 hashing for feature vectors.
 * Guarantees reproducibility regardless of key ordering in JSON.
 *
 * Properties:
 * - Deterministic: Same input → same output (always)
 * - Collision resistant: SHA-256 (2^128 security level)
 * - Key ordering: Recursively sorted alphabetically
 * - Null handling: Via JSON.stringify semantics
 */

import { createHash } from 'crypto';

/**
 * Recursively sort object keys alphabetically for stable serialization.
 * Handles nested objects and arrays.
 *
 * @param value - Any JSON-serializable value
 * @returns Value with all object keys sorted alphabetically
 */
function sortObjectKeys(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = sortObjectKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return value;
}

/**
 * Compute deterministic SHA-256 hash of feature vector.
 * Uses stable JSON serialization (recursively sorted keys) for reproducibility.
 *
 * @param featureVector - The feature JSONB object
 * @returns 64-character lowercase hex string (SHA-256)
 *
 * @example
 * const v1 = { a: 1, b: 2 };
 * const v2 = { b: 2, a: 1 }; // Different key order
 * computeFeatureVectorHash(v1) === computeFeatureVectorHash(v2); // true
 */
export function computeFeatureVectorHash(featureVector: Record<string, unknown>): string {
  // Sort keys recursively for determinism
  const sorted = sortObjectKeys(featureVector);

  // Serialize without whitespace
  const stableJson = JSON.stringify(sorted);

  // Compute SHA-256
  return createHash('sha256').update(stableJson).digest('hex');
}

/**
 * Verify that a feature vector matches its expected hash.
 * Useful for reproducibility audits.
 *
 * @param featureVector - The feature JSONB object
 * @param expectedHash - The expected SHA-256 hash (64-char hex)
 * @returns true if hash matches, false otherwise
 */
export function verifyFeatureVectorHash(
  featureVector: Record<string, unknown>,
  expectedHash: string
): boolean {
  const computed = computeFeatureVectorHash(featureVector);
  return computed === expectedHash.toLowerCase();
}

/**
 * Hash a feature vector and include the hash in the output.
 * Convenience function for scoring pipelines.
 *
 * @param featureVector - The feature JSONB object
 * @returns Feature vector with _hash field added
 */
export function hashFeatureVector<T extends Record<string, unknown>>(
  featureVector: T
): T & { _hash: string } {
  const hash = computeFeatureVectorHash(featureVector);
  return { ...featureVector, _hash: hash };
}
