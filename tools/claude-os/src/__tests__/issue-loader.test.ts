/**
 * Tests for issue-loader.ts (Phase F)
 *
 * Verifies issue file loading, validation, and normalization.
 * Uses the real example issue file at governance/claude-os/issues/ISSUE-001.json.
 */

import { describe, it, expect } from 'vitest';

import {
  resolveIssuePath,
  loadIssue,
  loadIssueById,
  loadIssueFromPath,
  validateIssue,
} from '../issue-loader.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('issue-loader', () => {
  describe('resolveIssuePath', () => {
    it('should resolve an issue ID to convention path', () => {
      expect(resolveIssuePath('ISSUE-001')).toBe('governance/claude-os/issues/ISSUE-001.json');
    });
  });

  describe('loadIssue', () => {
    it('should load by ID when no path separator present', () => {
      const result = loadIssue('ISSUE-001');
      expect(result.success).toBe(true);
      expect(result.issue).not.toBeNull();
      expect(result.issue!.issueId).toBe('ISSUE-001');
    });

    it('should load by path when argument contains separator', () => {
      const result = loadIssue('governance/claude-os/issues/ISSUE-001.json');
      expect(result.success).toBe(true);
      expect(result.issue).not.toBeNull();
      expect(result.issue!.issueId).toBe('ISSUE-001');
    });
  });

  describe('loadIssueById', () => {
    it('should fail-closed on missing issue', () => {
      const result = loadIssueById('NONEXISTENT-999');
      expect(result.success).toBe(false);
      expect(result.issue).toBeNull();
      expect(result.errors[0]).toContain('not found');
    });
  });

  describe('loadIssueFromPath', () => {
    it('should normalize optional fields to defaults', () => {
      const result = loadIssueFromPath('governance/claude-os/issues/ISSUE-001.json');
      expect(result.success).toBe(true);
      const issue = result.issue!;

      // These are set in the example file, so they should be preserved
      expect(issue.status).toBe('open');
      expect(issue.priority).toBe('high');

      // These are set in the example, so should be arrays
      expect(Array.isArray(issue.truthSourcesRequired)).toBe(true);
      expect(Array.isArray(issue.killConditions)).toBe(true);
      expect(Array.isArray(issue.notes)).toBe(true);
    });
  });

  describe('validateIssue', () => {
    it('should accept a valid issue', () => {
      const errors = validateIssue({
        issueVersion: '1.0.0',
        issueId: 'TEST-001',
        projectId: 'unit-talk',
        taskType: 'docs',
        title: 'Test issue',
        objective: 'Test objective',
        summary: 'Test summary',
        acceptanceCriteria: ['Criterion 1'],
        touchedAreas: ['docs/'],
        dependencies: [],
      });
      expect(errors).toHaveLength(0);
    });

    it('should reject null data', () => {
      const errors = validateIssue(null);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('null');
    });

    it('should report missing required fields', () => {
      const errors = validateIssue({ issueVersion: '1.0.0' });
      const missingFields = errors.filter(e => e.includes('Missing required field'));
      // Should be missing: issueId, projectId, taskType, title, objective, summary,
      // acceptanceCriteria, touchedAreas, dependencies
      expect(missingFields.length).toBeGreaterThanOrEqual(9);
    });

    it('should reject invalid taskType', () => {
      const errors = validateIssue({
        issueVersion: '1.0.0',
        issueId: 'TEST-001',
        projectId: 'unit-talk',
        taskType: 'invalid_type',
        title: 'Test',
        objective: 'Test',
        summary: 'Test',
        acceptanceCriteria: ['AC1'],
        touchedAreas: ['src/'],
        dependencies: [],
      });
      expect(errors.some(e => e.includes('Invalid taskType'))).toBe(true);
    });

    it('should reject empty acceptanceCriteria', () => {
      const errors = validateIssue({
        issueVersion: '1.0.0',
        issueId: 'TEST-001',
        projectId: 'unit-talk',
        taskType: 'docs',
        title: 'Test',
        objective: 'Test',
        summary: 'Test',
        acceptanceCriteria: [],
        touchedAreas: ['src/'],
        dependencies: [],
      });
      expect(errors.some(e => e.includes('acceptanceCriteria'))).toBe(true);
    });

    it('should validate dependency entries', () => {
      const errors = validateIssue({
        issueVersion: '1.0.0',
        issueId: 'TEST-001',
        projectId: 'unit-talk',
        taskType: 'docs',
        title: 'Test',
        objective: 'Test',
        summary: 'Test',
        acceptanceCriteria: ['AC1'],
        touchedAreas: ['src/'],
        dependencies: [{ issueId: 'DEP-001', status: 'invalid_status' }],
      });
      expect(errors.some(e => e.includes('dependencies[0].status'))).toBe(true);
    });
  });
});
