/**
 * Unit tests for Market Policy Filter (SPRINT-035)
 */
import { makeInput, makePolicy } from './fixtures';

import { applyPolicyFilter } from '@/pick-engine/pick-policy';

describe('applyPolicyFilter', () => {
  describe('fail-open behavior', () => {
    it('passes when no typeMap provided (undefined)', () => {
      const policies = [makePolicy()];
      const result = applyPolicyFilter(makeInput(), policies, undefined);
      expect(result.filter_name).toBe('market_policy');
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('no market_key mapping');
    });

    it('passes when typeMap has no entry for market_type_id', () => {
      const typeMap = new Map<number, string>(); // empty
      const policies = [makePolicy()];
      const result = applyPolicyFilter(makeInput(), policies, typeMap);
      expect(result.passed).toBe(true);
    });

    it('passes when no policy matches the market key', () => {
      const typeMap = new Map<number, string>([[1, 'player_points_ou']]);
      const policies = [makePolicy({ market_type: 'player_assists_ou' })];
      const result = applyPolicyFilter(makeInput(), policies, typeMap);
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('no policy');
    });
  });

  describe('policy enforcement', () => {
    const typeMap = new Map<number, string>([[1, 'player_points_ou']]);

    it('rejects when policy is disabled', () => {
      const policies = [makePolicy({ enabled: false })];
      const result = applyPolicyFilter(makeInput(), policies, typeMap);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('disabled');
    });

    it('rejects when edge below policy min_edge', () => {
      const policies = [makePolicy({ min_edge: 0.1 })];
      const result = applyPolicyFilter(makeInput({ edge_final: 0.05 }), policies, typeMap);
      expect(result.passed).toBe(false);
      expect(result.value).toBe(0.05);
      expect(result.threshold).toBe(0.1);
    });

    it('passes when edge meets policy min_edge', () => {
      const policies = [makePolicy({ min_edge: 0.03 })];
      const result = applyPolicyFilter(makeInput({ edge_final: 0.07 }), policies, typeMap);
      expect(result.passed).toBe(true);
    });

    it('passes at exact min_edge boundary', () => {
      const policies = [makePolicy({ min_edge: 0.07 })];
      const result = applyPolicyFilter(makeInput({ edge_final: 0.07 }), policies, typeMap);
      // Source line 70: input.edge_final < policy.min_edge → not < means pass
      expect(result.passed).toBe(true);
    });

    it('reason includes tier and multiplier on pass', () => {
      const policies = [makePolicy({ tier: 'A', stake_multiplier: 1.5 })];
      const result = applyPolicyFilter(makeInput({ edge_final: 0.07 }), policies, typeMap);
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('tier=A');
      expect(result.reason).toContain('multiplier=1.5');
    });
  });
});
