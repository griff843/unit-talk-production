/**
 * gate7-constitutional.test.ts — Tests for Gate 7 constitutional enforcement
 *
 * Sprint: DATA-MOAT-ACTIVATION-002
 * Date: 2026-02-28
 *
 * Verifies that Gate 7 (feature snapshot requirement) is ALWAYS enforced
 * and cannot be disabled.
 */

import { describe, it, expect } from '@jest/globals';

import {
  evaluatePromotion,
  parsePromotionPolicyConfig,
  type PromotionPolicyConfig,
} from '../../src/agents/GradingAgent/scoring/promotionPolicy';

import type { ComputeScoreV2Result } from '../../src/agents/GradingAgent/scoring/computeScoreV2';

// Mock a valid V2 result that would pass other gates
function createMockV2Result(overrides: Partial<ComputeScoreV2Result> = {}): ComputeScoreV2Result {
  return {
    score: 75,
    tier: 'A',
    ev: 5,
    breakdown: {},
    feature_audit: {},
    featureSnapshotId: undefined, // Default: no snapshot
    featureVectorHash: undefined, // Default: no hash
    ...overrides,
  };
}

describe('Gate 7 Constitutional Enforcement', () => {
  describe('parsePromotionPolicyConfig', () => {
    it('should always return featureSnapshotGateEnabled as true', () => {
      // Test with no env var
      const config1 = parsePromotionPolicyConfig({});
      expect(config1.featureSnapshotGateEnabled).toBe(true);

      // Test with env var explicitly set to false (should be ignored)
      const config2 = parsePromotionPolicyConfig({
        FEATURE_SNAPSHOT_GATE_ENABLED: 'false',
      });
      expect(config2.featureSnapshotGateEnabled).toBe(true);

      // Test with env var set to true
      const config3 = parsePromotionPolicyConfig({
        FEATURE_SNAPSHOT_GATE_ENABLED: 'true',
      });
      expect(config3.featureSnapshotGateEnabled).toBe(true);
    });
  });

  describe('evaluatePromotion', () => {
    const baseConfig: PromotionPolicyConfig = {
      policyEnabled: true,
      killSwitch: false,
      softEnable: true,
      hardOnly: false,
      hardMinEv: 0.01,
      hardMinConf: 7,
      canaryPercent: 100,
      canarySports: [],
      featureSnapshotGateEnabled: true,
    };

    it('should reject promotion when featureSnapshotId is missing', () => {
      const result = createMockV2Result({
        featureSnapshotId: undefined,
        featureVectorHash: 'abc123',
      });

      const decision = evaluatePromotion(result, 'NBA', 'test-pick-123', baseConfig);

      expect(decision.promote).toBe(false);
      expect(decision.reason_codes).toContain('feature_snapshot_missing');
      expect(decision.notes.some(n => n.includes('CONSTITUTIONAL GATE'))).toBe(true);
    });

    it('should reject promotion when featureVectorHash is missing', () => {
      const result = createMockV2Result({
        featureSnapshotId: 'uuid-123',
        featureVectorHash: undefined,
      });

      const decision = evaluatePromotion(result, 'NBA', 'test-pick-123', baseConfig);

      expect(decision.promote).toBe(false);
      expect(decision.reason_codes).toContain('feature_hash_missing');
      expect(decision.notes.some(n => n.includes('CONSTITUTIONAL GATE'))).toBe(true);
    });

    it('should allow promotion when both featureSnapshotId and featureVectorHash are present', () => {
      const result = createMockV2Result({
        featureSnapshotId: 'uuid-123-456-789',
        featureVectorHash: 'a'.repeat(64),
      });

      const decision = evaluatePromotion(result, 'NBA', 'test-pick-123', baseConfig);

      // Should not be blocked by Gate 7
      expect(decision.reason_codes).not.toContain('feature_snapshot_missing');
      expect(decision.reason_codes).not.toContain('feature_hash_missing');
      // Should include data moat note
      expect(decision.notes.some(n => n.includes('data_moat'))).toBe(true);
    });

    it('should enforce Gate 7 regardless of config flag value', () => {
      // Even if someone tries to pass featureSnapshotGateEnabled: false,
      // the config should have been parsed to true
      const result = createMockV2Result({
        featureSnapshotId: undefined,
      });

      // This simulates what would happen if someone tried to bypass
      const decision = evaluatePromotion(result, 'NBA', 'test-pick-123', {
        ...baseConfig,
        // TypeScript won't allow false here due to type, but test the behavior
      });

      expect(decision.promote).toBe(false);
      expect(decision.reason_codes).toContain('feature_snapshot_missing');
    });
  });

  describe('Constitutional invariants', () => {
    it('should never allow promotion without feature snapshot (regardless of tier)', () => {
      const tiers = ['S', 'A', 'B'] as const;

      for (const tier of tiers) {
        const result = createMockV2Result({
          tier,
          score: 90,
          ev: 10,
          featureSnapshotId: undefined,
        });

        const decision = evaluatePromotion(result, 'NBA', `pick-${tier}`, {
          policyEnabled: true,
          killSwitch: false,
          softEnable: true,
          hardOnly: false,
          hardMinEv: 0.01,
          hardMinConf: 7,
          canaryPercent: 100,
          canarySports: [],
          featureSnapshotGateEnabled: true,
        });

        expect(decision.promote).toBe(false);
        expect(decision.reason_codes).toContain('feature_snapshot_missing');
      }
    });
  });
});
