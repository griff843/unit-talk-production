/**
 * Tests for sprint-planner.ts
 *
 * Verifies sprint execution plan assembly and fail-closed behavior.
 */

import { describe, it, expect } from 'vitest';

import { assembleSprintPlan } from '../sprint-planner.js';

import type { SprintExecutionRequest } from '../types.js';

describe('sprint-planner', () => {
  describe('assembleSprintPlan', () => {
    it('should assemble a plan for a valid docs sprint', () => {
      const request: SprintExecutionRequest = {
        sprintId: 'SPRINT-DOCS-TEST-001',
        sprintType: 'docs',
        summary: 'Update architecture documentation',
      };

      const plan = assembleSprintPlan(request);

      expect(plan.request).toEqual(request);
      expect(plan.generatedAt).toBeDefined();
      expect(plan.governanceSummary).toBeDefined();
      expect(plan.contextPackSummary).toBeDefined();
      expect(plan.verificationRequirements).toBeInstanceOf(Array);
      expect(plan.proofRequirements).toBeInstanceOf(Array);
      expect(plan.artifactPlan).toBeDefined();
      expect(plan.driftSignals).toBeInstanceOf(Array);
      expect(plan.nextStepRecommendations).toBeInstanceOf(Array);
      expect(plan.nextStepRecommendations.length).toBeGreaterThan(0);
    });

    it('should assemble a plan for a runtime sprint', () => {
      const request: SprintExecutionRequest = {
        sprintId: 'SPRINT-AGENT-FIX-045',
        sprintType: 'runtime',
        summary: 'Fix FeedAgent promotion logic',
        touchedAreas: ['apps/api/src/agents/FeedAgent/'],
      };

      const plan = assembleSprintPlan(request);

      // Runtime sprints should have T3 requirements
      const required = plan.verificationRequirements.filter(v => v.required);
      expect(required.length).toBeGreaterThan(1);

      // Should detect runtime-sensitive area
      expect(plan.driftSignals.length).toBeGreaterThan(0);
    });

    it('should block on invalid sprint type', () => {
      const request = {
        sprintId: 'SPRINT-BAD-001',
        sprintType: 'invalid_type' as any,
        summary: 'Bad sprint type',
      };

      const plan = assembleSprintPlan(request);

      expect(plan.status).toBe('blocked');
      expect(plan.failClosedBlockers.length).toBeGreaterThan(0);
      expect(plan.failClosedBlockers[0].description).toContain('Unrecognized sprint type');
    });

    it('should block on invalid sprint ID format', () => {
      const request: SprintExecutionRequest = {
        sprintId: 'bad-format',
        sprintType: 'docs',
        summary: 'Bad sprint ID',
      };

      const plan = assembleSprintPlan(request);

      expect(plan.status).toBe('blocked');
      expect(plan.failClosedBlockers.some(b => b.description.includes('SPRINT-<NAME>-###'))).toBe(
        true
      );
    });

    it('should detect deprecated path references in summary', () => {
      const request: SprintExecutionRequest = {
        sprintId: 'SPRINT-MIGRATION-046',
        sprintType: 'runtime',
        summary: 'Migrate data from raw_props to provider_offers',
      };

      const plan = assembleSprintPlan(request);

      const deprecatedSignals = plan.driftSignals.filter(s => s.type === 'deprecated_path_risk');
      expect(deprecatedSignals.length).toBeGreaterThan(0);
      expect(deprecatedSignals[0].area).toBe('raw_props');
    });

    it('should detect lifecycle keywords and elevate scrutiny', () => {
      const request: SprintExecutionRequest = {
        sprintId: 'SPRINT-SETTLEMENT-047',
        sprintType: 'runtime',
        summary: 'Settlement migration to unified_picks',
      };

      const plan = assembleSprintPlan(request);

      const lifecycleSignals = plan.driftSignals.filter(
        s => s.description.includes('lifecycle') || s.description.includes('settlement')
      );
      expect(lifecycleSignals.length).toBeGreaterThan(0);
    });

    it('should detect schema migration risk', () => {
      const request: SprintExecutionRequest = {
        sprintId: 'SPRINT-SCHEMA-048',
        sprintType: 'schema',
        summary: 'Add new column via migration',
        touchedAreas: ['supabase/migrations/'],
      };

      const plan = assembleSprintPlan(request);

      const schemaSignals = plan.driftSignals.filter(s => s.area === 'supabase/migrations/');
      expect(schemaSignals.length).toBeGreaterThan(0);
    });

    it('should include governance summary', () => {
      const request: SprintExecutionRequest = {
        sprintId: 'SPRINT-DOCS-TEST-002',
        sprintType: 'docs',
        summary: 'Test governance summary',
      };

      const plan = assembleSprintPlan(request);

      expect(plan.governanceSummary.lawsLoaded).toBeGreaterThan(0);
      expect(plan.governanceSummary.contractsLoaded).toBeGreaterThan(0);
      expect(plan.governanceSummary.recipesLoaded).toBeGreaterThan(0);
    });

    it('should include artifact plan with correct sprint ID', () => {
      const request: SprintExecutionRequest = {
        sprintId: 'SPRINT-ARTIFACT-TEST-003',
        sprintType: 'runtime',
        summary: 'Test artifact plan',
        requestedArtifactDate: '2026-03-08',
      };

      const plan = assembleSprintPlan(request);

      expect(plan.artifactPlan.sprintId).toBe('SPRINT-ARTIFACT-TEST-003');
      expect(plan.artifactPlan.date).toBe('2026-03-08');
      expect(plan.artifactPlan.canonicalRoot).toContain('SPRINT-ARTIFACT-TEST-003');
      expect(plan.artifactPlan.requiredDirectories.length).toBeGreaterThan(0);
      expect(plan.artifactPlan.requiredFiles.length).toBeGreaterThan(0);
    });

    it('should produce next-step recommendations', () => {
      const request: SprintExecutionRequest = {
        sprintId: 'SPRINT-DOCS-TEST-004',
        sprintType: 'docs',
        summary: 'Test recommendations',
      };

      const plan = assembleSprintPlan(request);

      expect(plan.nextStepRecommendations.length).toBeGreaterThan(0);
    });

    it('should handle touched areas for cross-boundary detection', () => {
      const request: SprintExecutionRequest = {
        sprintId: 'SPRINT-CROSS-049',
        sprintType: 'runtime',
        summary: 'Cross-boundary changes',
        touchedAreas: ['apps/api/src/agents/', 'packages/distribution/', 'supabase/migrations/'],
      };

      const plan = assembleSprintPlan(request);

      // Should detect multiple high-risk areas
      const highRiskSignals = plan.driftSignals.filter(
        s => s.severity === 'high' || s.severity === 'critical'
      );
      expect(highRiskSignals.length).toBeGreaterThan(0);
    });
  });
});
