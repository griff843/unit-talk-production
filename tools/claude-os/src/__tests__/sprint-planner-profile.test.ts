/**
 * Tests for sprint-planner.ts — profile-aware planning
 *
 * Verifies assembleSprintPlanWithProfile behavior with project profiles
 * and task envelopes.
 */

import { describe, it, expect } from 'vitest';

import { loadEnvelope, envelopeToRequest } from '../envelope-loader.js';
import { loadProfileById } from '../profile-loader.js';
import { assembleSprintPlan, assembleSprintPlanWithProfile } from '../sprint-planner.js';

import type { SprintExecutionRequest } from '../types.js';

describe('sprint-planner (profile-aware)', () => {
  const profileResult = loadProfileById('unit-talk');
  const profile = profileResult.profile!;

  describe('assembleSprintPlanWithProfile', () => {
    it('should produce a plan using profile drift config', () => {
      const request: SprintExecutionRequest = {
        sprintId: 'SPRINT-PROFILE-TEST-001',
        sprintType: 'runtime',
        summary: 'Settlement migration off raw_props to unified_picks',
        touchedAreas: ['apps/api/src/agents/SettlementAgent/'],
      };

      const plan = assembleSprintPlanWithProfile(request, profile);

      expect(plan.request.sprintId).toBe('SPRINT-PROFILE-TEST-001');
      expect(plan.generatedAt).toBeDefined();
      // Should detect deprecated path from profile config
      const deprecatedSignals = plan.driftSignals.filter(s => s.type === 'deprecated_path_risk');
      expect(deprecatedSignals.length).toBeGreaterThan(0);
    });

    it('should use profile domain keywords for context resolution', () => {
      const request: SprintExecutionRequest = {
        sprintId: 'SPRINT-DOMAIN-TEST-002',
        sprintType: 'runtime',
        summary: 'Fix FeedAgent ingestion logic for provider_offers',
        touchedAreas: ['apps/api/src/agents/FeedAgent/'],
      };

      const plan = assembleSprintPlanWithProfile(request, profile);

      // Plan should resolve — governance loads
      expect(plan.governanceSummary.lawsLoaded).toBeGreaterThan(0);
    });

    it('should detect runtime-sensitive areas from profile', () => {
      const request: SprintExecutionRequest = {
        sprintId: 'SPRINT-RUNTIME-TEST-003',
        sprintType: 'runtime',
        summary: 'Fix agent error handling',
        touchedAreas: ['apps/api/src/agents/'],
      };

      const plan = assembleSprintPlanWithProfile(request, profile);

      const runtimeSignals = plan.driftSignals.filter(s => s.type === 'runtime_build_boundary');
      expect(runtimeSignals.length).toBeGreaterThan(0);
    });

    it('should produce equivalent results to default planner for same inputs', () => {
      const request: SprintExecutionRequest = {
        sprintId: 'SPRINT-EQUIV-TEST-004',
        sprintType: 'docs',
        summary: 'Update architecture documentation',
      };

      const defaultPlan = assembleSprintPlan(request);
      const profilePlan = assembleSprintPlanWithProfile(request, profile);

      // Core structure should be equivalent
      expect(profilePlan.governanceSummary.lawsLoaded).toBe(
        defaultPlan.governanceSummary.lawsLoaded
      );
      expect(profilePlan.verificationRequirements.length).toBe(
        defaultPlan.verificationRequirements.length
      );
    });
  });

  describe('envelope integration', () => {
    it('should merge envelope data into the plan', () => {
      const envelopeResult = loadEnvelope(
        'governance/claude-os/envelopes/example-runtime-sprint.json'
      );
      const envelope = envelopeResult.envelope!;
      const request = envelopeToRequest(envelope);

      const plan = assembleSprintPlanWithProfile(request, profile, envelope);

      expect(plan.request.sprintId).toBe(envelope.taskId);
      expect(plan.request.sprintType).toBe('runtime');
      // Should have deferred requirements from envelope
      const envelopeDeferred = plan.deferredRequirements.filter(d => d.category === 'envelope');
      expect(envelopeDeferred.length).toBeGreaterThan(0);
    });

    it('should detect canonical write target from envelope summary', () => {
      const envelopeResult = loadEnvelope(
        'governance/claude-os/envelopes/example-runtime-sprint.json'
      );
      const envelope = envelopeResult.envelope!;
      const request = envelopeToRequest(envelope);

      const plan = assembleSprintPlanWithProfile(request, profile, envelope);

      // The example envelope mentions settlement and raw_props
      const deprecatedSignals = plan.driftSignals.filter(s => s.type === 'deprecated_path_risk');
      expect(deprecatedSignals.length).toBeGreaterThan(0);
    });
  });
});
