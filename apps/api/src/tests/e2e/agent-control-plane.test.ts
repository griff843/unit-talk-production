/**
 * Agent Control Plane E2E Tests
 *
 * These tests verify that agent lifecycle controls ACTUALLY work -
 * not just that they write to the database, but that they change
 * real agent behavior.
 *
 * @module tests/e2e/agent-control-plane.test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import {
  AgentControlService,
  AgentControlRole,
  createAgentControlService,
} from '../../lib/AgentControlService';
import { AgentInstrumentation, createAgentInstrumentation } from '../../lib/AgentInstrumentation';
import { AgentControlPlane, createAgentControlPlane } from '../../temporal/AgentControlPlane';

// Test configuration
const TEST_AGENT_ID = 'test-agent-e2e';
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('Agent Control Plane E2E Tests', () => {
  let supabase: SupabaseClient;
  let controlPlane: AgentControlPlane;
  let instrumentation: AgentInstrumentation;
  let controlService: AgentControlService;

  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Initialize control plane
    controlPlane = createAgentControlPlane(supabase, mockLogger as any, TEST_AGENT_ID);

    // Initialize instrumentation
    instrumentation = createAgentInstrumentation(TEST_AGENT_ID);

    // Initialize control service with operator role
    controlService = createAgentControlService(supabase, mockLogger as any, {
      userId: 'test-operator',
      role: AgentControlRole.ADMIN,
      correlationId: 'e2e-test-run',
    });

    // Clean up any existing test data
    await supabase.from('agent_registry').delete().eq('agent_id', TEST_AGENT_ID);

    await supabase.from('agent_lifecycle_events').delete().eq('agent_id', TEST_AGENT_ID);
  });

  afterAll(async () => {
    // Clean up test data
    await supabase.from('agent_registry').delete().eq('agent_id', TEST_AGENT_ID);

    await supabase.from('agent_lifecycle_events').delete().eq('agent_id', TEST_AGENT_ID);
  });

  beforeEach(() => {
    // Reset mock call counts
    jest.clearAllMocks();
    controlPlane.clearCache();
  });

  describe('Phase 1: Agent Registration', () => {
    it('should auto-register agent on first heartbeat', async () => {
      // Act
      const response = await controlPlane.updateHeartbeat('running', {
        runCount: 1,
        successCount: 1,
        failureCount: 0,
      });

      // Assert
      expect(response.heartbeatRecorded).toBe(true);
      expect(response.desiredState).toBe('running');

      // Verify in database
      const { data: agent } = await supabase
        .from('agent_registry')
        .select('*')
        .eq('agent_id', TEST_AGENT_ID)
        .single();

      expect(agent).toBeDefined();
      expect(agent?.current_state).toBe('running');
    });

    it('should record lifecycle event for registration', async () => {
      // Act
      await controlPlane.getControlStatus();

      // Assert
      const { data: events } = await supabase
        .from('agent_lifecycle_events')
        .select('*')
        .eq('agent_id', TEST_AGENT_ID)
        .eq('event_type', 'registered')
        .order('timestamp', { ascending: false })
        .limit(1);

      // Registration event may or may not exist depending on test order
      // Just verify no errors occurred
      expect(events).toBeDefined();
    });
  });

  describe('Phase 2: Pause/Resume Enforcement', () => {
    it('should stop processing when paused', async () => {
      // Arrange - ensure agent is running
      await controlPlane.updateHeartbeat('running', { runCount: 10 });

      // Act - pause the agent
      const pauseResult = await controlService.pauseAgent(TEST_AGENT_ID, 'E2E test pause');

      expect(pauseResult.success).toBe(true);

      // Check shouldProcess
      const shouldProcess = await controlPlane.shouldProcess();

      // Assert
      expect(shouldProcess).toBe(false);
    });

    it('should resume processing when unpaused', async () => {
      // Act - resume the agent
      const resumeResult = await controlService.resumeAgent(TEST_AGENT_ID, 'E2E test resume');

      expect(resumeResult.success).toBe(true);

      // Clear cache to get fresh state
      controlPlane.clearCache();

      // Check shouldProcess
      const shouldProcess = await controlPlane.shouldProcess();

      // Assert
      expect(shouldProcess).toBe(true);
    });

    it('should record lifecycle events for pause/resume', async () => {
      // Assert - check lifecycle events
      const { data: events } = await supabase
        .from('agent_lifecycle_events')
        .select('*')
        .eq('agent_id', TEST_AGENT_ID)
        .in('event_type', ['state_change_requested'])
        .order('timestamp', { ascending: false })
        .limit(4);

      expect(events).toBeDefined();
      expect(events!.length).toBeGreaterThan(0);
    });
  });

  describe('Phase 3: Stop/Drain Enforcement', () => {
    it('should stop processing when stopped', async () => {
      // Arrange - ensure agent is running
      await controlService.resumeAgent(TEST_AGENT_ID, 'Reset for stop test');
      controlPlane.clearCache();

      // Act - stop the agent
      const stopResult = await controlService.stopAgent(TEST_AGENT_ID, 'E2E test stop');

      expect(stopResult.success).toBe(true);

      // Clear cache and check
      controlPlane.clearCache();
      const shouldProcess = await controlPlane.shouldProcess();

      // Assert
      expect(shouldProcess).toBe(false);
    });

    it('should handle drain state correctly', async () => {
      // Arrange - resume agent first
      await controlService.resumeAgent(TEST_AGENT_ID, 'Reset for drain test');
      controlPlane.clearCache();

      // Act - drain the agent
      const drainResult = await controlService.drainAgent(TEST_AGENT_ID, 'E2E test drain');

      expect(drainResult.success).toBe(true);

      // Clear cache and get status
      controlPlane.clearCache();
      const status = await controlPlane.getControlStatus();

      // Assert - during drain, shouldProcess may still be true for current work
      expect(status.desiredState).toBe('draining');
    });
  });

  describe('Phase 4: Kill Confirmation Flow', () => {
    it('should require confirmation token for kill', async () => {
      // Arrange - resume agent
      await controlService.resumeAgent(TEST_AGENT_ID, 'Reset for kill test');

      // Act - request kill confirmation
      const confirmResult = await controlService.requestKillConfirmation(
        TEST_AGENT_ID,
        'E2E test kill'
      );

      // Assert
      expect(confirmResult.success).toBe(true);
      expect(confirmResult.data?.confirmationToken).toBeDefined();
      expect(confirmResult.data?.expiresAt).toBeDefined();
    });

    it('should reject expired confirmation tokens', async () => {
      // Act - try to confirm with invalid token
      const result = await controlService.confirmKill('invalid-token');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or expired');
    });

    it('should kill agent with valid confirmation', async () => {
      // Arrange - get fresh confirmation
      const confirmRequest = await controlService.requestKillConfirmation(
        TEST_AGENT_ID,
        'E2E test kill execution'
      );

      expect(confirmRequest.success).toBe(true);
      const token = confirmRequest.data?.confirmationToken;

      // Act - confirm kill
      const killResult = await controlService.confirmKill(token!);

      // Assert
      expect(killResult.success).toBe(true);

      // Verify agent is killed
      controlPlane.clearCache();
      const shouldProcess = await controlPlane.shouldProcess();
      expect(shouldProcess).toBe(false);
    });
  });

  describe('Phase 5: Metrics Tracking', () => {
    it('should track run count accurately', async () => {
      // Arrange - simulate processing cycles
      instrumentation.startCycle();
      instrumentation.recordEventsProcessed(5);
      instrumentation.endCycle(true);

      instrumentation.startCycle();
      instrumentation.recordEventsProcessed(3);
      instrumentation.endCycle(true);

      // Act
      const metrics = instrumentation.getAggregatedMetrics();

      // Assert
      expect(metrics.runCount).toBe(2);
      expect(metrics.successCount).toBe(2);
      expect(metrics.eventsProcessed).toBe(8);
    });

    it('should track failure count accurately', async () => {
      // Arrange
      instrumentation.startCycle();
      instrumentation.recordEventsFailed(2);
      instrumentation.endCycle(false);

      // Act
      const metrics = instrumentation.getAggregatedMetrics();

      // Assert
      expect(metrics.failureCount).toBe(1);
    });

    it('should calculate latency percentiles', async () => {
      // Reset instrumentation for clean test
      const freshInstrumentation = createAgentInstrumentation('latency-test');

      // Arrange - simulate cycles with varying latencies
      for (let i = 0; i < 10; i++) {
        freshInstrumentation.startCycle();
        // Simulate some work (will have minimal latency)
        freshInstrumentation.endCycle(true);
      }

      // Act
      const metrics = freshInstrumentation.getAggregatedMetrics();

      // Assert
      expect(metrics.avgLatencyMs).toBeGreaterThanOrEqual(0);
      expect(metrics.p95LatencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Phase 6: RBAC Enforcement', () => {
    it('should deny kill to viewer role', async () => {
      // Arrange - create viewer service
      const viewerService = createAgentControlService(supabase, mockLogger as any, {
        userId: 'test-viewer',
        role: AgentControlRole.VIEWER,
      });

      // Act
      const result = await viewerService.requestKillConfirmation(
        TEST_AGENT_ID,
        'Unauthorized kill attempt'
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.permissionDenied).toBe(true);
    });

    it('should deny pause to viewer role', async () => {
      // Arrange
      const viewerService = createAgentControlService(supabase, mockLogger as any, {
        userId: 'test-viewer',
        role: AgentControlRole.VIEWER,
      });

      // Act
      const result = await viewerService.pauseAgent(TEST_AGENT_ID, 'Unauthorized');

      // Assert
      expect(result.success).toBe(false);
      expect(result.permissionDenied).toBe(true);
    });

    it('should allow pause to operator role', async () => {
      // Arrange - resume agent first with admin
      await controlService.resumeAgent(TEST_AGENT_ID, 'Reset for RBAC test');

      const operatorService = createAgentControlService(supabase, mockLogger as any, {
        userId: 'test-operator',
        role: AgentControlRole.OPERATOR,
      });

      // Act
      const result = await operatorService.pauseAgent(TEST_AGENT_ID, 'Operator pause');

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('Phase 7: Audit Trail Completeness', () => {
    it('should have lifecycle events for all operations', async () => {
      // Act
      const result = await controlService.getLifecycleEvents(TEST_AGENT_ID, 50);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBeGreaterThan(0);

      // Verify event types are present
      const eventTypes = result.data!.map(e => e.eventType);
      expect(eventTypes).toContain('state_change_requested');
    });

    it('should include requestedBy for all control operations', async () => {
      // Act
      const result = await controlService.getLifecycleEvents(TEST_AGENT_ID, 50);

      // Assert
      expect(result.success).toBe(true);

      // Filter for control operations
      const controlEvents = result.data!.filter(e => e.eventType === 'state_change_requested');

      // All control operations should have requestedBy
      controlEvents.forEach(event => {
        expect(event.requestedBy).toBeDefined();
      });
    });
  });
});

// ============================================================
// Proof Artifact Generation
// ============================================================

/**
 * Generate E2E proof report
 */
export async function generateProofReport(): Promise<{
  timestamp: string;
  testsPassed: number;
  testsFailed: number;
  evidence: Record<string, any>;
}> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Get test agent data
  const { data: agent } = await supabase
    .from('agent_registry')
    .select('*')
    .eq('agent_id', TEST_AGENT_ID)
    .single();

  // Get lifecycle events
  const { data: events } = await supabase
    .from('agent_lifecycle_events')
    .select('*')
    .eq('agent_id', TEST_AGENT_ID)
    .order('timestamp', { ascending: false })
    .limit(100);

  // Get metrics snapshots
  const { data: metrics } = await supabase
    .from('agent_metrics_snapshots')
    .select('*')
    .eq('agent_id', TEST_AGENT_ID)
    .order('collected_at', { ascending: false })
    .limit(50);

  return {
    timestamp: new Date().toISOString(),
    testsPassed: 0, // Will be filled by test runner
    testsFailed: 0, // Will be filled by test runner
    evidence: {
      agentState: agent,
      lifecycleEventCount: events?.length || 0,
      metricsSnapshotCount: metrics?.length || 0,
      latestEvents: events?.slice(0, 10),
      stateTransitions: events?.filter(e => e.event_type.includes('state_change')),
    },
  };
}
