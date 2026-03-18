/**
 * Tests for WorkflowRegistry
 *
 * SPRINT-052-LAYER3-PHASE11-OPERATOR-WORKFLOW-FOUNDATION
 */

import { describe, expect, it } from 'vitest';

import {
  WORKFLOW_REGISTRY,
  findWorkflow,
  getAllWorkflows,
  getCategories,
  getCategoryCounts,
  getWorkflowsByCategory,
} from '../index';

describe('WorkflowRegistry', () => {
  describe('getAllWorkflows()', () => {
    it('returns all registered workflows', () => {
      const workflows = getAllWorkflows();
      expect(workflows.length).toBeGreaterThanOrEqual(10);
    });

    it('returns an array of workflow entries', () => {
      const workflows = getAllWorkflows();
      for (const w of workflows) {
        expect(w.name).toBeTruthy();
        expect(w.description).toBeTruthy();
        expect(w.category).toBeTruthy();
        expect(w.scriptPath).toBeTruthy();
        expect(w.invocation).toBeTruthy();
        expect(['low', 'medium', 'high']).toContain(w.riskLevel);
      }
    });

    it('has no duplicate workflow names', () => {
      const names = getAllWorkflows().map(w => w.name);
      const unique = new Set(names);
      expect(unique.size).toBe(names.length);
    });
  });

  describe('getWorkflowsByCategory()', () => {
    it('returns only workflows in the specified category', () => {
      const analysis = getWorkflowsByCategory('analysis');
      expect(analysis.length).toBeGreaterThanOrEqual(1);
      for (const w of analysis) {
        expect(w.category).toBe('analysis');
      }
    });

    it('returns backfill workflows', () => {
      const backfill = getWorkflowsByCategory('backfill');
      expect(backfill.length).toBeGreaterThanOrEqual(1);
    });

    it('returns health workflows', () => {
      const health = getWorkflowsByCategory('health');
      expect(health.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array for unknown category', () => {
      const result = getWorkflowsByCategory('nonexistent' as never);
      expect(result).toEqual([]);
    });
  });

  describe('findWorkflow()', () => {
    it('finds a workflow by name', () => {
      const workflow = findWorkflow('simple-health-check');
      expect(workflow).toBeDefined();
      expect(workflow?.name).toBe('simple-health-check');
      expect(workflow?.category).toBe('health');
    });

    it('returns undefined for unknown name', () => {
      const result = findWorkflow('does-not-exist');
      expect(result).toBeUndefined();
    });

    it('finds backfill-promotion-band-null', () => {
      const w = findWorkflow('backfill-promotion-band-null');
      expect(w).toBeDefined();
      expect(w?.riskLevel).toBe('medium');
    });
  });

  describe('getCategories()', () => {
    it('returns an array of unique categories', () => {
      const categories = getCategories();
      expect(categories.length).toBeGreaterThanOrEqual(4);
      const unique = new Set(categories);
      expect(unique.size).toBe(categories.length);
    });

    it('includes all expected categories', () => {
      const categories = getCategories();
      expect(categories).toContain('analysis');
      expect(categories).toContain('backfill');
      expect(categories).toContain('health');
    });

    it('returns categories in sorted order', () => {
      const categories = getCategories();
      const sorted = [...categories].sort();
      expect(categories).toEqual(sorted);
    });
  });

  describe('getCategoryCounts()', () => {
    it('returns counts for each category', () => {
      const counts = getCategoryCounts();
      const categories = getCategories();
      for (const cat of categories) {
        expect(counts[cat]).toBeGreaterThanOrEqual(1);
      }
    });

    it('total count matches registry size', () => {
      const counts = getCategoryCounts();
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      expect(total).toBe(WORKFLOW_REGISTRY.length);
    });
  });

  describe('WORKFLOW_REGISTRY schema', () => {
    it('all high-risk workflows have descriptive names', () => {
      const highRisk = WORKFLOW_REGISTRY.filter(w => w.riskLevel === 'high');
      for (const w of highRisk) {
        expect(w.description.length).toBeGreaterThan(20);
      }
    });

    it('all workflows with required parameters document them', () => {
      const withParams = WORKFLOW_REGISTRY.filter(
        w => w.parameters && w.parameters.some(p => p.required)
      );
      for (const w of withParams) {
        expect(w.parameters!.length).toBeGreaterThan(0);
        for (const p of w.parameters!) {
          expect(p.name).toBeTruthy();
          expect(p.description).toBeTruthy();
        }
      }
    });
  });

  // SPRINT-PH11-GAP-CLOSURE-2: Verify scheduled trigger metadata for analysis workflows
  describe('scheduled trigger metadata (GAP-PH11-1 closure)', () => {
    const scheduledWorkflows = [
      {
        name: 'verify-slo',
        scheduleId: 'routine-verify-slo',
        scheduleDesc: 'every 30 minutes',
      },
      {
        name: 'check-grading-status',
        scheduleId: 'routine-check-grading-status',
        scheduleDesc: 'every 15 minutes',
      },
      {
        name: 'analyze-grading-promotion',
        scheduleId: 'routine-analyze-grading-promotion',
        scheduleDesc: 'daily at 4 AM',
      },
      {
        name: 'edge-validation-report',
        scheduleId: 'routine-edge-validation-report',
        scheduleDesc: 'daily at 5 AM',
      },
    ];

    for (const { name, scheduleId, scheduleDesc } of scheduledWorkflows) {
      it(`${name} has trigger=scheduled with correct schedule ID`, () => {
        const w = findWorkflow(name);
        expect(w).toBeDefined();
        expect(w?.trigger).toBe('scheduled');
        expect(w?.temporalScheduleId).toBe(scheduleId);
        expect(w?.scheduleDescription).toBe(scheduleDesc);
      });
    }

    it('all 4 analysis workflows are scheduled', () => {
      const analysis = getWorkflowsByCategory('analysis');
      const scheduled = analysis.filter(w => w.trigger === 'scheduled');
      expect(scheduled.length).toBe(4);
    });

    it('scheduled workflows have valid trigger type', () => {
      const scheduled = WORKFLOW_REGISTRY.filter(w => w.trigger === 'scheduled');
      for (const w of scheduled) {
        expect(w.temporalScheduleId).toBeTruthy();
        expect(w.scheduleDescription).toBeTruthy();
      }
    });

    it('non-scheduled workflows do not have schedule metadata', () => {
      const manual = WORKFLOW_REGISTRY.filter(w => !w.trigger || w.trigger === 'manual');
      for (const w of manual) {
        expect(w.temporalScheduleId).toBeUndefined();
      }
    });
  });
});
