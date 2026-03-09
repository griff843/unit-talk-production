/**
 * Tests for sprint-planner.ts — profile-aware planning
 *
 * Verifies assembleSprintPlanWithProfile behavior with project profiles,
 * task envelopes, and execution-level-aware critical area handling.
 */

import { describe, it, expect } from 'vitest';

import { loadEnvelope, envelopeToRequest } from '../envelope-loader.js';
import { loadProfileById } from '../profile-loader.js';
import { assembleSprintPlan, assembleSprintPlanWithProfile } from '../sprint-planner.js';

import type { SprintExecutionRequest, ExecutionLevel } from '../types.js';

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

  // -------------------------------------------------------------------------
  // Execution-level-aware critical area handling (CLAUDE-OS-REDESIGN-001)
  // -------------------------------------------------------------------------

  describe('execution-level-aware critical area handling', () => {
    // A request that touches critical areas (apps/api/src/agents/)
    const criticalRequest: SprintExecutionRequest = {
      sprintId: 'SPRINT-LEVEL-TEST-001',
      sprintType: 'runtime',
      summary: 'Fix agent error handling',
      touchedAreas: ['apps/api/src/agents/'],
    };

    it('should BLOCK critical areas with no execution level (default = autopilot)', () => {
      const plan = assembleSprintPlanWithProfile(criticalRequest, profile);

      // No execution level → defaults to 0 → critical areas block
      expect(plan.status).toBe('blocked');
      const driftBlockers = plan.failClosedBlockers.filter(b => b.source === 'drift-sentinel');
      expect(driftBlockers.length).toBeGreaterThan(0);
      expect(plan.riskEscalations).toHaveLength(0);
    });

    it('should BLOCK critical areas at Level 0 (AUTOPILOT)', () => {
      const plan = assembleSprintPlanWithProfile(
        criticalRequest,
        profile,
        undefined,
        0 as ExecutionLevel
      );

      expect(plan.status).toBe('blocked');
      const driftBlockers = plan.failClosedBlockers.filter(b => b.source === 'drift-sentinel');
      expect(driftBlockers.length).toBeGreaterThan(0);
      expect(plan.riskEscalations).toHaveLength(0);
    });

    it('should BLOCK critical areas at Level 1 (GUIDED)', () => {
      const plan = assembleSprintPlanWithProfile(
        criticalRequest,
        profile,
        undefined,
        1 as ExecutionLevel
      );

      expect(plan.status).toBe('blocked');
      const driftBlockers = plan.failClosedBlockers.filter(b => b.source === 'drift-sentinel');
      expect(driftBlockers.length).toBeGreaterThan(0);
      expect(plan.riskEscalations).toHaveLength(0);
    });

    it('should NOT block critical areas at Level 2 (SUPERVISED) — produce risk escalations instead', () => {
      const plan = assembleSprintPlanWithProfile(
        criticalRequest,
        profile,
        undefined,
        2 as ExecutionLevel
      );

      // No drift-sentinel blockers — critical areas are escalations, not blockers
      const driftBlockers = plan.failClosedBlockers.filter(b => b.source === 'drift-sentinel');
      expect(driftBlockers).toHaveLength(0);

      // Risk escalations should be populated
      expect(plan.riskEscalations.length).toBeGreaterThan(0);
      expect(plan.riskEscalations[0].severity).toBe('critical');
      expect(plan.riskEscalations[0].executionLevelAtEvaluation).toBe(2);

      // Plan status should NOT be blocked (unless other non-drift blockers exist)
      // Note: other blockers (governance, context) may exist, so check drift specifically
      const nonDriftBlockers = plan.failClosedBlockers.filter(b => b.source !== 'drift-sentinel');
      if (nonDriftBlockers.length === 0) {
        expect(plan.status).not.toBe('blocked');
      }
    });

    it('should NOT block critical areas at Level 3 (COLLABORATIVE) — produce risk escalations', () => {
      const plan = assembleSprintPlanWithProfile(
        criticalRequest,
        profile,
        undefined,
        3 as ExecutionLevel
      );

      const driftBlockers = plan.failClosedBlockers.filter(b => b.source === 'drift-sentinel');
      expect(driftBlockers).toHaveLength(0);

      expect(plan.riskEscalations.length).toBeGreaterThan(0);
      expect(plan.riskEscalations[0].executionLevelAtEvaluation).toBe(3);
    });

    it('should NOT block critical areas at Level 4 (HUMAN_LED) — produce risk escalations', () => {
      const plan = assembleSprintPlanWithProfile(
        criticalRequest,
        profile,
        undefined,
        4 as ExecutionLevel
      );

      const driftBlockers = plan.failClosedBlockers.filter(b => b.source === 'drift-sentinel');
      expect(driftBlockers).toHaveLength(0);

      expect(plan.riskEscalations.length).toBeGreaterThan(0);
      expect(plan.riskEscalations[0].executionLevelAtEvaluation).toBe(4);
    });

    it('should include recommendation about risk escalations in supervised mode', () => {
      const plan = assembleSprintPlanWithProfile(
        criticalRequest,
        profile,
        undefined,
        2 as ExecutionLevel
      );

      const escalationRec = plan.nextStepRecommendations.find(
        r => r.includes('risk escalation') && r.includes('SUPERVISED')
      );
      expect(escalationRec).toBeDefined();
    });

    it('should still block for REAL governance violations regardless of execution level', () => {
      // Invalid sprint ID → governance blocker (not a drift signal)
      const badRequest: SprintExecutionRequest = {
        sprintId: 'BAD-NAME',
        sprintType: 'runtime',
        summary: 'Fix agent error handling',
        touchedAreas: ['apps/api/src/agents/'],
      };

      const plan = assembleSprintPlanWithProfile(
        badRequest,
        profile,
        undefined,
        2 as ExecutionLevel
      );

      // Should still be blocked — sprint naming violation is a governance issue, not a risk area
      expect(plan.status).toBe('blocked');
      const namingBlocker = plan.failClosedBlockers.find(b =>
        b.description.includes('does not follow SPRINT-')
      );
      expect(namingBlocker).toBeDefined();
    });

    it('should preserve critical drift signals in driftSignals array regardless of execution level', () => {
      const plan = assembleSprintPlanWithProfile(
        criticalRequest,
        profile,
        undefined,
        2 as ExecutionLevel
      );

      // Critical drift signals should still be present in driftSignals (for audit trail)
      const criticalSignals = plan.driftSignals.filter(s => s.severity === 'critical');
      expect(criticalSignals.length).toBeGreaterThan(0);
    });
  });
});
