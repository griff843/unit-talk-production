/**
 * Tests for artifact-planner.ts
 *
 * Verifies artifact path plan generation.
 */

import { describe, it, expect } from 'vitest';

import { planArtifacts, getArtifactRoot } from '../artifact-planner.js';

describe('artifact-planner', () => {
  describe('planArtifacts', () => {
    it('should generate a plan with canonical root path', () => {
      const plan = planArtifacts('SPRINT-TEST-001', '2026-03-08', 'docs');

      expect(plan.sprintId).toBe('SPRINT-TEST-001');
      expect(plan.date).toBe('2026-03-08');
      expect(plan.canonicalRoot).toBe('out/sprints/SPRINT-TEST-001/2026-03-08');
    });

    it('should include standard directories', () => {
      const plan = planArtifacts('SPRINT-TEST-001', '2026-03-08', 'docs');

      expect(plan.requiredDirectories).toContain('out/sprints/SPRINT-TEST-001/2026-03-08/proofs');
      expect(plan.requiredDirectories).toContain('out/sprints/SPRINT-TEST-001/2026-03-08/diffs');
      expect(plan.requiredDirectories).toContain('out/sprints/SPRINT-TEST-001/2026-03-08/notes');
    });

    it('should include always-required files', () => {
      const plan = planArtifacts('SPRINT-TEST-001', '2026-03-08', 'runtime');

      const categories = plan.requiredFiles.map(f => f.category);
      expect(categories).toContain('git_status');
      expect(categories).toContain('typecheck');
      expect(categories).toContain('diff');
      expect(categories).toContain('closeout');
    });

    it('should add runtime-specific notes for runtime sprints', () => {
      const plan = planArtifacts('SPRINT-TEST-001', '2026-03-08', 'runtime');

      expect(plan.notes.length).toBeGreaterThan(0);
      expect(plan.notes.some(n => n.includes('Runtime proof'))).toBe(true);
    });

    it('should add schema-specific notes for schema sprints', () => {
      const plan = planArtifacts('SPRINT-TEST-001', '2026-03-08', 'schema');

      expect(plan.notes.some(n => n.includes('rollback'))).toBe(true);
    });

    it('should add e2e notes for e2e_lifecycle sprints', () => {
      const plan = planArtifacts('SPRINT-TEST-001', '2026-03-08', 'e2e_lifecycle');

      expect(plan.notes.some(n => n.includes('lifecycle'))).toBe(true);
    });

    it('should include proof requirements in the file list', () => {
      const proofReqs = [
        {
          category: 'tests',
          artifact: 'proofs/proof_tests.txt',
          description: 'Test output',
          required: true,
        },
        {
          category: 'build',
          artifact: 'proofs/proof_build.txt',
          description: 'Build output',
          required: true,
        },
      ];
      const plan = planArtifacts('SPRINT-TEST-001', '2026-03-08', 'runtime', proofReqs);

      const categories = plan.requiredFiles.map(f => f.category);
      expect(categories).toContain('tests');
      expect(categories).toContain('build');
    });

    it('should not duplicate files already in the standard set', () => {
      const proofReqs = [
        {
          category: 'typecheck',
          artifact: 'proofs/proof_typecheck.txt',
          description: 'Duplicate',
          required: true,
        },
      ];
      const plan = planArtifacts('SPRINT-TEST-001', '2026-03-08', 'docs', proofReqs);

      const typecheckFiles = plan.requiredFiles.filter(f => f.category === 'typecheck');
      expect(typecheckFiles.length).toBe(1);
    });

    it('should resolve "today" date', () => {
      const plan = planArtifacts('SPRINT-TEST-001', 'today', 'docs');
      // Should be a valid date string
      expect(plan.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getArtifactRoot', () => {
    it('should return the canonical artifact root', () => {
      const root = getArtifactRoot('SPRINT-TEST-001', '2026-03-08');
      expect(root).toBe('out/sprints/SPRINT-TEST-001/2026-03-08');
    });
  });
});
