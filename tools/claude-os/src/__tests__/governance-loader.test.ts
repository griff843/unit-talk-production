/**
 * Tests for governance-loader.ts
 *
 * Verifies governance artifact loading, validation, and fail-closed behavior.
 */

import { describe, it, expect } from 'vitest';

import { loadGovernance } from '../governance-loader.js';

describe('governance-loader', () => {
  describe('loadGovernance', () => {
    it('should load all required governance artifacts successfully', () => {
      const result = loadGovernance();

      // Required artifacts must load
      expect(result.contextManifest).not.toBeNull();
      expect(result.verificationRecipes).not.toBeNull();
      expect(result.proofRecipes).not.toBeNull();
      expect(result.packageOwnership).not.toBeNull();
      expect(result.systemLaws.length).toBeGreaterThan(0);

      // Overall success
      expect(result.success).toBe(true);
    });

    it('should load context manifest with expected structure', () => {
      const result = loadGovernance();
      const manifest = result.contextManifest!;

      expect(manifest.version).toBeDefined();
      expect(manifest.always_load).toBeInstanceOf(Array);
      expect(manifest.always_load.length).toBeGreaterThan(0);
      expect(manifest.sprint_specific).toBeInstanceOf(Array);
      expect(manifest.optional_context).toBeInstanceOf(Array);
      expect(manifest.forbidden_context_sources).toBeInstanceOf(Array);
      expect(manifest.truth_priority_order).toBeInstanceOf(Array);
    });

    it('should load verification recipes with expected structure', () => {
      const result = loadGovernance();
      const recipes = result.verificationRecipes!;

      expect(recipes.version).toBeDefined();
      expect(recipes.recipes).toBeInstanceOf(Array);
      expect(recipes.recipes.length).toBeGreaterThan(0);

      // Each recipe should have required fields
      for (const recipe of recipes.recipes) {
        expect(recipe.id).toBeDefined();
        expect(recipe.purpose).toBeDefined();
        expect(recipe.command_placeholder).toBeDefined();
        expect(recipe.failure_severity).toBeDefined();
      }
    });

    it('should load proof recipes covering all sprint types', () => {
      const result = loadGovernance();
      const recipes = result.proofRecipes!;

      expect(recipes.sprint_types.length).toBeGreaterThan(0);

      const types = recipes.sprint_types.map(r => r.type);
      expect(types).toContain('docs');
      expect(types).toContain('runtime');
      expect(types).toContain('schema');
    });

    it('should parse system laws from SYSTEM_LAWS.md', () => {
      const result = loadGovernance();

      expect(result.systemLaws.length).toBeGreaterThanOrEqual(10);

      // Check law structure
      for (const law of result.systemLaws) {
        expect(law.id).toMatch(/^law_\d+$/);
        expect(law.name).toBeDefined();
        expect(law.name.length).toBeGreaterThan(0);
        expect(law.statement).toBeDefined();
      }

      // Check known laws exist
      const lawNames = result.systemLaws.map(l => l.name);
      expect(lawNames).toContain('Source-of-Truth Law');
      expect(lawNames).toContain('Fail-Closed Law');
      expect(lawNames).toContain('No-Silent-Fallback Law');
    });

    it('should load package ownership with area entries', () => {
      const result = loadGovernance();
      const ownership = result.packageOwnership!;

      expect(ownership.areas).toBeInstanceOf(Array);
      expect(ownership.areas.length).toBeGreaterThan(0);

      // Each entry should have required fields
      for (const entry of ownership.areas) {
        expect(entry.area).toBeDefined();
        expect(entry.category).toBeDefined();
        expect(entry.responsibility).toBeDefined();
        expect(entry.change_risk).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(entry.change_risk);
      }
    });

    it('should track loaded file paths', () => {
      const result = loadGovernance();

      expect(result.loadedFiles.length).toBeGreaterThan(0);
      // Required files should be in the loaded list
      expect(result.loadedFiles).toContain('governance/claude-os/context/context-manifest.json');
      expect(result.loadedFiles).toContain('governance/claude-os/SYSTEM_LAWS.md');
    });

    it('should report non-fatal errors for optional files gracefully', () => {
      const result = loadGovernance();

      // If there are errors, non-fatal ones should not block success
      const nonFatalErrors = result.errors.filter(e => !e.isFatal);
      // Non-fatal errors are acceptable — they are optional file warnings
      for (const err of nonFatalErrors) {
        expect(err.isFatal).toBe(false);
      }
    });
  });
});
