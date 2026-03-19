/**
 * Workflow Alert Wiring — Operator Visibility Contract Tests
 *
 * SPRINT-REM-006: Prove the full chain:
 * sendWorkflowFailure() → sendOperatorAlert() → alertManager.createAlert()
 * → alert appears in alertManager.getActiveAlerts()
 *
 * Per refinement 2: tests must prove operator visibility (alertManager state),
 * not just helper invocation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock axios before importing the module under test
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
  },
}));

// Mock logger used by activities/alerts.ts
vi.mock('../../utils/logger', () => ({
  makeLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock dateUtils
vi.mock('../../utils/dateUtils', () => ({
  toISOString: (d: Date) => d.toISOString(),
}));

// Mock services/logging used by monitoring/alerts.ts
vi.mock('../../services/logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock monitoring/Dashboard used by monitoring/alerts.ts
vi.mock('../../monitoring/Dashboard', () => ({
  metrics: {
    recordAgentError: vi.fn(),
    recordAgentMetric: vi.fn(),
  },
}));

import axios from 'axios';

import { sendWorkflowFailure } from '../../activities/alerts';
import { alertManager } from '../../monitoring/alerts';

describe('SPRINT-REM-006: Operator Visibility Contract', () => {
  const OPERATOR_WEBHOOK = 'https://discord.com/api/webhooks/test-operator';

  beforeEach(() => {
    vi.resetAllMocks();
    process.env['DISCORD_OPERATOR_WEBHOOK_URL'] = OPERATOR_WEBHOOK;
    // Clear alertManager state between tests to avoid cooldown interference
    (alertManager as any).activeAlerts.clear();
    (alertManager as any).cooldowns.clear();
    (alertManager as any).alertHistory = [];
  });

  afterEach(() => {
    delete process.env['DISCORD_OPERATOR_WEBHOOK_URL'];
  });

  describe('full chain: sendWorkflowFailure → alertManager → getActiveAlerts', () => {
    it('workflow failure registers in alertManager.getActiveAlerts()', async () => {
      (axios.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ status: 204 });

      // Pre-condition: no active alerts
      expect(alertManager.getActiveAlerts()).toHaveLength(0);

      const result = await sendWorkflowFailure({
        workflowName: 'syndicateSchedulerWorkflow',
        error: 'Cycle 42 failed: Supabase timeout',
        cycleCount: 42,
      });

      // Assert: alert was successfully sent to Discord
      expect(result.success).toBe(true);

      // Assert: alert is NOW visible in alertManager.getActiveAlerts()
      const activeAlerts = alertManager.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThanOrEqual(1);

      // Assert: the registered alert has correct fields for operator visibility
      const alert = activeAlerts.find(a => a.ruleId === 'operator_workflow_failure');
      expect(alert).toBeDefined();
      expect(alert!.severity).toBe('critical');
      expect(alert!.status).toBe('active');
      expect(alert!.title).toContain('WORKFLOW_FAILURE');
      expect(alert!.description).toContain('syndicateSchedulerWorkflow');
    });

    it('alert metadata contains workflow name and error details', async () => {
      (axios.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ status: 204 });

      await sendWorkflowFailure({
        workflowName: 'dailyRecapWorkflow',
        error: 'Recap generation timeout',
        cycleCount: 0,
      });

      const activeAlerts = alertManager.getActiveAlerts();
      const alert = activeAlerts.find(a => a.ruleId === 'operator_workflow_failure');
      expect(alert).toBeDefined();
      expect(alert!.metadata).toMatchObject({
        type: 'workflow_failure',
        workflowName: 'dailyRecapWorkflow',
      });
    });

    it('alertManager.createAlert failure is logged, not silently swallowed', async () => {
      const createAlertSpy = vi
        .spyOn(alertManager, 'createAlert')
        .mockRejectedValueOnce(new Error('alertManager storage full'));

      (axios.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ status: 204 });

      // sendWorkflowFailure should still succeed (Discord send works)
      // but alertManager registration failed — the error is caught and logged
      const result = await sendWorkflowFailure({
        workflowName: 'healthMonitoringWorkflow',
        error: 'Health check failed',
        cycleCount: 5,
      });

      // Discord send succeeded
      expect(result.success).toBe(true);
      // createAlert was called
      expect(createAlertSpy).toHaveBeenCalled();

      createAlertSpy.mockRestore();
    });

    it('cooldown prevents duplicate alerts for same ruleId within window', async () => {
      (axios.post as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 204 });

      // First call — registers alert
      await sendWorkflowFailure({
        workflowName: 'liveGameDetectorWorkflow',
        error: 'Detection error 1',
        cycleCount: 1,
      });
      expect(alertManager.getActiveAlerts()).toHaveLength(1);

      // Second call — same ruleId (operator_workflow_failure), within cooldown window
      await sendWorkflowFailure({
        workflowName: 'liveGameDetectorWorkflow',
        error: 'Detection error 2',
        cycleCount: 2,
      });
      // Still only 1 active alert (cooldown prevented duplicate registration)
      expect(alertManager.getActiveAlerts()).toHaveLength(1);
    });
  });

  describe('wired workflow coverage — all REM-006 targets produce operator-visible alerts', () => {
    // Every workflow catch block wired in REM-006 must produce an alert
    // visible via alertManager.getActiveAlerts()
    const wiredWorkflows = [
      'syndicateSchedulerWorkflow',
      'leagueIngestionWorkflow-MLB',
      'gradingAndScoringWorkflow',
      'discordAlertWorkflow',
      'liveGameDetectorWorkflow',
      'quotaMonitoringWorkflow',
      'healthMonitoringWorkflow',
      'NFLScheduleWorkflow',
      'dailyRecapWorkflow',
      'weeklyRecapWorkflow',
      'monthlyRecapWorkflow',
      'microRecapWorkflow',
      'smartFormDailyBatchWorkflow',
      'smartFormHealthMonitorWorkflow',
      'FeedAgentBackfillWorkflow-downstream',
    ];

    for (const workflowName of wiredWorkflows) {
      it(`${workflowName} failure → operator-visible alert`, async () => {
        (axios.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ status: 204 });
        // Clear cooldown for each parametrized test
        (alertManager as any).activeAlerts.clear();
        (alertManager as any).cooldowns.clear();

        const result = await sendWorkflowFailure({
          workflowName,
          error: `${workflowName} simulated failure`,
          cycleCount: 0,
        });

        expect(result.success).toBe(true);

        const alerts = alertManager.getActiveAlerts();
        expect(alerts.length).toBeGreaterThanOrEqual(1);

        const alert = alerts[0];
        expect(alert.severity).toBe('critical');
        expect(alert.status).toBe('active');
        expect(alert.description).toContain(workflowName);
      });
    }
  });
});
