/**
 * Tests for verification-resolver.ts
 *
 * Verifies that verification/proof requirements resolve correctly
 * for different sprint types.
 */

import { describe, it, expect } from 'vitest';

import { loadGovernance } from '../governance-loader.js';
import {
  resolveVerification,
  isValidSprintType,
  getMinimumTier,
} from '../verification-resolver.js';

describe('verification-resolver', () => {
  const governance = loadGovernance();
  const verRecipes = governance.verificationRecipes!;
  const proofRecipes = governance.proofRecipes!;

  describe('isValidSprintType', () => {
    it('should accept valid sprint types', () => {
      expect(isValidSprintType('docs')).toBe(true);
      expect(isValidSprintType('runtime')).toBe(true);
      expect(isValidSprintType('build_fix')).toBe(true);
      expect(isValidSprintType('e2e_lifecycle')).toBe(true);
      expect(isValidSprintType('ui')).toBe(true);
      expect(isValidSprintType('schema')).toBe(true);
    });

    it('should reject invalid sprint types', () => {
      expect(isValidSprintType('unknown')).toBe(false);
      expect(isValidSprintType('')).toBe(false);
      expect(isValidSprintType('DOCS')).toBe(false);
    });
  });

  describe('getMinimumTier', () => {
    it('should return T1 for docs sprints', () => {
      expect(getMinimumTier('docs')).toBe('T1');
    });

    it('should return T2 for build_fix and ui sprints', () => {
      expect(getMinimumTier('build_fix')).toBe('T2');
      expect(getMinimumTier('ui')).toBe('T2');
    });

    it('should return T3 for runtime and schema sprints', () => {
      expect(getMinimumTier('runtime')).toBe('T3');
      expect(getMinimumTier('schema')).toBe('T3');
    });

    it('should return T4 for e2e_lifecycle sprints', () => {
      expect(getMinimumTier('e2e_lifecycle')).toBe('T4');
    });
  });

  describe('resolveVerification for docs sprint', () => {
    it('should resolve minimal requirements for docs sprints', () => {
      const result = resolveVerification('docs', verRecipes, proofRecipes);

      expect(result.sprintType).toBe('docs');
      expect(result.verificationTier).toBe('T1');
      expect(result.runtimeProofRequired).toBe(false);

      // T1 should require typecheck
      const requiredIds = result.required.map(r => r.recipeId);
      expect(requiredIds).toContain('typecheck');

      // Should have proof requirements
      expect(result.proofRequired.length).toBeGreaterThan(0);
    });
  });

  describe('resolveVerification for runtime sprint', () => {
    it('should resolve T3 requirements for runtime sprints', () => {
      const result = resolveVerification('runtime', verRecipes, proofRecipes);

      expect(result.sprintType).toBe('runtime');
      expect(result.verificationTier).toBe('T3');
      expect(result.runtimeProofRequired).toBe(true);

      // T3 should require more than T1
      const requiredIds = result.required.map(r => r.recipeId);
      expect(requiredIds).toContain('typecheck');
      expect(requiredIds).toContain('build');
      expect(requiredIds).toContain('unit_tests');

      // Should have runtime proof requirements
      const runtimeProof = result.proofRequired.filter(p => p.category.includes('runtime'));
      expect(runtimeProof.length).toBeGreaterThan(0);
    });
  });

  describe('resolveVerification for e2e_lifecycle sprint', () => {
    it('should resolve maximum T4 requirements', () => {
      const result = resolveVerification('e2e_lifecycle', verRecipes, proofRecipes);

      expect(result.verificationTier).toBe('T4');
      expect(result.runtimeProofRequired).toBe(true);

      // T4 should have the most required recipes
      expect(result.required.length).toBeGreaterThan(5);
    });
  });

  describe('unresolved verification items', () => {
    it('should report placeholder commands as deferred requirements', () => {
      const result = resolveVerification('runtime', verRecipes, proofRecipes);

      // Some recipes have TODO placeholders — those should be deferred
      const unresolvedCommands = result.required.filter(r => !r.commandResolved);

      // If there are unresolved commands, they should also appear in deferred
      if (unresolvedCommands.length > 0) {
        expect(result.unresolvedItems.length).toBeGreaterThan(0);
        const deferredDescriptions = result.unresolvedItems.map(d => d.description);
        for (const cmd of unresolvedCommands) {
          expect(deferredDescriptions.some(d => d.includes(cmd.recipeId))).toBe(true);
        }
      }
    });
  });

  describe('ratification threshold', () => {
    it('should provide a ratification threshold for each sprint type', () => {
      const types = ['docs', 'runtime', 'build_fix', 'ui', 'schema', 'e2e_lifecycle'] as const;

      for (const type of types) {
        const result = resolveVerification(type, verRecipes, proofRecipes);
        expect(result.ratificationThreshold).toBeDefined();
        expect(result.ratificationThreshold.length).toBeGreaterThan(0);
        // Should not be the fallback message
        expect(result.ratificationThreshold).not.toContain('not found');
      }
    });
  });
});
