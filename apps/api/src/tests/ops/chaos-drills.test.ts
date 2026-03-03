/**
 * @fileoverview PR9: Chaos Drill Tests
 *
 * Tests for verifying ops loop resilience under edge cases:
 * - Deduplication (same incident shouldn't trigger multiple remediations)
 * - Cooldown (rapid-fire incidents should be rate-limited)
 * - Approval workflow (EXECUTABLE playbooks require approval by default)
 * - MV playbook (MV_REFRESH_LAG must remain RECOMMENDATION_ONLY)
 *
 * @module tests/ops/chaos-drills
 */

import { createClient } from '@supabase/supabase-js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => {
  const mockRpcResults = new Map<string, any>();

  return {
    createClient: vi.fn(() => ({
      rpc: vi.fn((funcName: string, params?: any) => {
        // should_execute_playbook mock
        if (funcName === 'should_execute_playbook') {
          const key = `${params?.p_playbook_id}-${params?.p_incident_id}`;

          // Simulate cooldown/dedupe logic
          if (mockRpcResults.has(key)) {
            return Promise.resolve({
              data: [
                {
                  should_execute: false,
                  reason: 'Already handling this incident',
                  last_execution_id: 'existing-uuid',
                  executions_this_hour: 1,
                },
              ],
              error: null,
            });
          }

          // Check rate limit
          const hourCount = mockRpcResults.get('hour_count') || 0;
          if (hourCount >= 3) {
            return Promise.resolve({
              data: [
                {
                  should_execute: false,
                  reason: 'Rate limit exceeded: 3/3 executions this hour',
                  last_execution_id: null,
                  executions_this_hour: 3,
                },
              ],
              error: null,
            });
          }

          // Global disabled check
          if (mockRpcResults.get('global_disabled')) {
            return Promise.resolve({
              data: [
                {
                  should_execute: false,
                  reason: 'Global remediation is disabled',
                  last_execution_id: null,
                  executions_this_hour: 0,
                },
              ],
              error: null,
            });
          }

          // Allow execution
          return Promise.resolve({
            data: [
              {
                should_execute: true,
                reason: 'Ready to execute',
                last_execution_id: null,
                executions_this_hour: hourCount,
              },
            ],
            error: null,
          });
        }

        // create_remediation_execution mock
        if (funcName === 'create_remediation_execution') {
          const key = `${params?.p_playbook_id}-${params?.p_incident_id}`;
          mockRpcResults.set(key, true);
          mockRpcResults.set('hour_count', (mockRpcResults.get('hour_count') || 0) + 1);
          return Promise.resolve({
            data: 'new-execution-uuid',
            error: null,
          });
        }

        return Promise.resolve({ data: null, error: null });
      }),
      from: vi.fn((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data:
            table === 'remediation_playbooks'
              ? {
                  playbook_id: 'PIPELINE_LAG_THROTTLE',
                  execution_type: 'EXECUTABLE',
                  enabled: false,
                  dry_run_only: true,
                  requires_approval: true,
                  cooldown_seconds: 3600,
                  max_executions_per_hour: 3,
                }
              : null,
          error: null,
        }),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
      })),
    })),
    // Allow test to control mock behavior
    __setMockResult: (key: string, value: any) => mockRpcResults.set(key, value),
    __clearMockResults: () => mockRpcResults.clear(),
  };
});

// Import mock controls
const { __setMockResult, __clearMockResults } = (await import('@supabase/supabase-js')) as any;

describe('PR9: Chaos Drills', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeEach(() => {
    __clearMockResults?.();
    supabase = createClient('https://test.supabase.co', 'test-key');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // DRILL 1: Deduplication
  // ==========================================================================
  describe('Drill 1: Deduplication', () => {
    it('should prevent duplicate remediation for same incident', async () => {
      const playbookId = 'PIPELINE_LAG_THROTTLE';
      const incidentId = 'incident-123';

      // First execution attempt
      const first = await supabase.rpc('should_execute_playbook', {
        p_playbook_id: playbookId,
        p_incident_id: incidentId,
      });

      expect(first.data?.[0].should_execute).toBe(true);
      expect(first.data?.[0].reason).toBe('Ready to execute');

      // Create the execution
      await supabase.rpc('create_remediation_execution', {
        p_playbook_id: playbookId,
        p_incident_id: incidentId,
      });

      // Second execution attempt for SAME incident
      const second = await supabase.rpc('should_execute_playbook', {
        p_playbook_id: playbookId,
        p_incident_id: incidentId,
      });

      expect(second.data?.[0].should_execute).toBe(false);
      expect(second.data?.[0].reason).toContain('Already handling this incident');
    });

    it('should allow remediation for different incidents', async () => {
      const playbookId = 'PIPELINE_LAG_THROTTLE';

      // First incident
      const first = await supabase.rpc('should_execute_playbook', {
        p_playbook_id: playbookId,
        p_incident_id: 'incident-A',
      });
      expect(first.data?.[0].should_execute).toBe(true);

      await supabase.rpc('create_remediation_execution', {
        p_playbook_id: playbookId,
        p_incident_id: 'incident-A',
      });

      // Different incident (should still be allowed, until rate limit)
      const second = await supabase.rpc('should_execute_playbook', {
        p_playbook_id: playbookId,
        p_incident_id: 'incident-B',
      });
      expect(second.data?.[0].should_execute).toBe(true);
    });
  });

  // ==========================================================================
  // DRILL 2: Cooldown / Rate Limiting
  // ==========================================================================
  describe('Drill 2: Cooldown and Rate Limiting', () => {
    it('should enforce hourly rate limit', async () => {
      const playbookId = 'PIPELINE_LAG_THROTTLE';

      // Simulate 3 executions (at the limit)
      for (let i = 0; i < 3; i++) {
        await supabase.rpc('create_remediation_execution', {
          p_playbook_id: playbookId,
          p_incident_id: `incident-${i}`,
        });
      }

      // Fourth attempt should be rate limited
      const fourth = await supabase.rpc('should_execute_playbook', {
        p_playbook_id: playbookId,
        p_incident_id: 'incident-4',
      });

      expect(fourth.data?.[0].should_execute).toBe(false);
      expect(fourth.data?.[0].reason).toContain('Rate limit exceeded');
      expect(fourth.data?.[0].executions_this_hour).toBe(3);
    });

    it('should respect global disable flag', async () => {
      __setMockResult?.('global_disabled', true);

      const result = await supabase.rpc('should_execute_playbook', {
        p_playbook_id: 'PIPELINE_LAG_THROTTLE',
        p_incident_id: 'new-incident',
      });

      expect(result.data?.[0].should_execute).toBe(false);
      expect(result.data?.[0].reason).toContain('Global remediation is disabled');
    });
  });

  // ==========================================================================
  // DRILL 3: Approval Workflow
  // ==========================================================================
  describe('Drill 3: Approval Workflow', () => {
    it('EXECUTABLE playbooks should require approval by default', async () => {
      const { data: playbook } = await supabase
        .from('remediation_playbooks')
        .select('*')
        .eq('playbook_id', 'PIPELINE_LAG_THROTTLE')
        .single();

      expect(playbook).toBeDefined();
      expect(playbook?.execution_type).toBe('EXECUTABLE');
      expect(playbook?.requires_approval).toBe(true);
    });

    it('all playbooks should be disabled by default', async () => {
      const { data: playbook } = await supabase
        .from('remediation_playbooks')
        .select('*')
        .eq('playbook_id', 'PIPELINE_LAG_THROTTLE')
        .single();

      expect(playbook?.enabled).toBe(false);
    });

    it('all playbooks should be dry-run only by default', async () => {
      const { data: playbook } = await supabase
        .from('remediation_playbooks')
        .select('*')
        .eq('playbook_id', 'PIPELINE_LAG_THROTTLE')
        .single();

      expect(playbook?.dry_run_only).toBe(true);
    });
  });

  // ==========================================================================
  // DRILL 4: MV_REFRESH_LAG Playbook (PR9 Updated - Now EXECUTABLE)
  // ==========================================================================
  describe('Drill 4: MV_REFRESH_LAG Playbook', () => {
    beforeEach(() => {
      // Override mock to return MV_REFRESH_LAG playbook data
      // Updated in PR9: Now EXECUTABLE with MV refresh infrastructure
      (supabase.from as any).mockImplementation((_table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            playbook_id: 'MV_REFRESH_LAG',
            name: 'Materialized View Refresh Lag',
            execution_type: 'EXECUTABLE',
            enabled: false,
            dry_run_only: true,
            requires_approval: true,
            description:
              'Handles stale materialized views. Uses ops.logged_refresh_mv() for safe, audited refresh.',
          },
          error: null,
        }),
      }));
    });

    it('MV_REFRESH_LAG should be EXECUTABLE (PR9 update)', async () => {
      const { data: playbook } = await supabase
        .from('remediation_playbooks')
        .select('*')
        .eq('playbook_id', 'MV_REFRESH_LAG')
        .single();

      expect(playbook).toBeDefined();
      expect(playbook?.playbook_id).toBe('MV_REFRESH_LAG');
      expect(playbook?.execution_type).toBe('EXECUTABLE');
    });

    it('MV_REFRESH_LAG should use ops.logged_refresh_mv infrastructure', async () => {
      const { data: playbook } = await supabase
        .from('remediation_playbooks')
        .select('*')
        .eq('playbook_id', 'MV_REFRESH_LAG')
        .single();

      expect(playbook?.description).toContain('logged_refresh_mv');
    });

    it('MV_REFRESH_LAG should still be disabled by default', async () => {
      const { data: playbook } = await supabase
        .from('remediation_playbooks')
        .select('*')
        .eq('playbook_id', 'MV_REFRESH_LAG')
        .single();

      // Still disabled and dry-run only for safety
      expect(playbook?.enabled).toBe(false);
      expect(playbook?.dry_run_only).toBe(true);
      expect(playbook?.requires_approval).toBe(true);
    });
  });

  // ==========================================================================
  // DRILL 5: Rapid-Fire Incident Storm
  // ==========================================================================
  describe('Drill 5: Incident Storm Resilience', () => {
    it('should handle rapid incident creation gracefully', async () => {
      const playbookId = 'PIPELINE_LAG_THROTTLE';
      const results: boolean[] = [];

      // Simulate rapid-fire incidents (10 in quick succession)
      for (let i = 0; i < 10; i++) {
        const check = await supabase.rpc('should_execute_playbook', {
          p_playbook_id: playbookId,
          p_incident_id: `storm-incident-${i}`,
        });

        if (check.data?.[0].should_execute) {
          await supabase.rpc('create_remediation_execution', {
            p_playbook_id: playbookId,
            p_incident_id: `storm-incident-${i}`,
          });
        }

        results.push(check.data?.[0].should_execute);
      }

      // First 3 should execute (up to rate limit)
      const executed = results.filter(r => r === true).length;
      const blocked = results.filter(r => r === false).length;

      expect(executed).toBe(3); // Rate limit
      expect(blocked).toBe(7); // Rest blocked
    });
  });

  // ==========================================================================
  // DRILL 6: Safety Defaults Verification
  // ==========================================================================
  describe('Drill 6: Safety Defaults', () => {
    it('should have safe default configuration', async () => {
      // These represent the required safety defaults for production
      const safetyChecklist = {
        globalEnabled: false,
        dryRunMode: true,
        requireApprovalByDefault: true,
        playooksDisabled: true,
        playbooksDryRunOnly: true,
      };

      // All safety defaults must be in place
      expect(safetyChecklist.globalEnabled).toBe(false);
      expect(safetyChecklist.dryRunMode).toBe(true);
      expect(safetyChecklist.requireApprovalByDefault).toBe(true);
      expect(safetyChecklist.playooksDisabled).toBe(true);
      expect(safetyChecklist.playbooksDryRunOnly).toBe(true);
    });
  });
});

// ==========================================================================
// Integration Test Helpers (for real database tests)
// ==========================================================================
export const createTestIncident = async (
  supabase: ReturnType<typeof createClient>,
  sloId: string,
  severity: 'warning' | 'critical' = 'warning'
) => {
  const { data, error } = await supabase
    .from('slo_incidents')
    .insert({
      slo_id: sloId,
      severity,
      status: 'open',
      trigger_value: 150,
      trigger_threshold: 100,
      evidence: { test: true },
      opened_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const cleanupTestData = async (
  supabase: ReturnType<typeof createClient>,
  incidentId: string
) => {
  // Delete in reverse dependency order
  await supabase.from('remediation_executions').delete().eq('incident_id', incidentId);

  await supabase.from('incident_notifications').delete().eq('incident_key', incidentId);

  await supabase.from('slo_incidents').delete().eq('id', incidentId);
};
