/**
 * HealthWorkflow Unit Tests
 * 
 * Comprehensive test suite for the OperatorAgent HealthWorkflow functionality:
 * - Healthy system run validation
 * - HOT_PROPS = 0 incident triggering
 * - ScoringAgent failure incident detection
 * - Recap failure incident handling
 * - Command Center integration testing
 * - Job run logging verification
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { OperatorAgent } from '../index';
import { 
  executeHealthSnapshot,
  logJobRun,
  completeJobRun,
  createIncidents,
  pushToCommandCenter,
  sendHealthAlert
} from '../activities/healthActivities';
import { logger } from '../../../utils/logger';

// Mock all activity functions
jest.mock('../activities/healthActivities');
jest.mock('../../../utils/logger');

const mockedExecuteHealthSnapshot = executeHealthSnapshot as jest.MockedFunction<typeof executeHealthSnapshot>;
const mockedLogJobRun = logJobRun as jest.MockedFunction<typeof logJobRun>;
const mockedCompleteJobRun = completeJobRun as jest.MockedFunction<typeof completeJobRun>;
const mockedCreateIncidents = createIncidents as jest.MockedFunction<typeof createIncidents>;
const mockedPushToCommandCenter = pushToCommandCenter as jest.MockedFunction<typeof pushToCommandCenter>;
const mockedSendHealthAlert = sendHealthAlert as jest.MockedFunction<typeof sendHealthAlert>;

describe('OperatorAgent HealthWorkflow', () => {
  let operatorAgent: OperatorAgent;
  let mockDependencies: any;

  beforeEach(() => {
    // Setup mock dependencies
    mockDependencies = {
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      },
      supabase: {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              gte: jest.fn(() => ({
                limit: jest.fn(() => ({ data: [], error: null }))
              }))
            }))
          }))
        }))
      }
    };

    // Create OperatorAgent instance
    const config = {
      name: 'OperatorAgent',
      enabled: true,
      version: '1.0.0',
      logLevel: 'info',
      schedule: 'manual',
      metrics: { enabled: true, interval: 60, port: 9090 },
      retry: { enabled: true, maxRetries: 3, backoffMs: 1000, maxBackoffMs: 30000, maxAttempts: 3, backoff: 1000, exponential: true, jitter: false },
      health: { enabled: true, interval: 30, timeout: 5000, checkDb: true, checkExternal: false }
    };

    operatorAgent = new OperatorAgent(config, mockDependencies);

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Healthy System Run', () => {
    it('should complete successfully when all sections are healthy', async () => {
      // Mock healthy system response
      const healthyHealthData = [
        {
          section: 'HOT_PROPS',
          status: 'healthy',
          count_recent: 150,
          count_total: 5000,
          last_updated: '2025-09-11T12:00:00Z',
          details: { recent_books: 15, recent_sports: 5, avg_ticks_per_minute: 30 },
          thresholds: { critical_threshold: 0, warning_threshold: 10, optimal_threshold: 100 },
          alerts: []
        },
        {
          section: 'WARM_FEATURES',
          status: 'healthy',
          count_recent: 45,
          count_total: 1200,
          last_updated: '2025-09-11T11:30:00Z',
          details: { feature_types: 8, sports_covered: 5, avg_computation_time_ms: 250 },
          thresholds: { critical_threshold: 0, warning_threshold: 5, optimal_threshold: 50 },
          alerts: []
        },
        {
          section: 'AGENT_JOBS',
          status: 'healthy',
          count_recent: 12,
          count_total: 300,
          last_updated: '2025-09-11T12:00:00Z',
          details: { success_rate: 98.5, failed_jobs: 0, running_jobs: 2, agents_active: 5 },
          thresholds: { critical_failure_count: 1, warning_success_rate: 90, optimal_success_rate: 99 },
          alerts: []
        }
      ];

      mockedExecuteHealthSnapshot.mockResolvedValue({
        success: true,
        healthData: healthyHealthData,
        executionTime: 1250,
        queryTime: 450
      });

      mockedLogJobRun.mockResolvedValue({
        jobId: 'job_test_12345',
        logged: true
      });

      mockedCompleteJobRun.mockResolvedValue({
        completed: true,
        duration: 1250
      });

      mockedPushToCommandCenter.mockResolvedValue({
        pushed: true,
        endpoint: 'http://localhost:3004/api/system/health',
        responseTime: 150
      });

      const result = await operatorAgent.runHealthWorkflow();

      expect(result.success).toBe(true);
      expect(result.healthSummary.totalSections).toBe(3);
      expect(result.healthSummary.healthySections).toBe(3);
      expect(result.healthSummary.degradedSections).toBe(0);
      expect(result.healthSummary.criticalSections).toBe(0);
      expect(result.incidents).toBe(0);
      expect(result.healthSummary.sectionsWithAlerts).toHaveLength(0);

      // Verify all activities were called correctly
      expect(mockedExecuteHealthSnapshot).toHaveBeenCalledTimes(1);
      expect(mockedLogJobRun).toHaveBeenCalledWith({
        agent: 'OperatorAgent',
        workflow: 'HealthWorkflow',
        jobName: 'system_health_check',
        status: 'running',
        metadata: expect.objectContaining({
          startTime: expect.any(String)
        })
      });
      expect(mockedCompleteJobRun).toHaveBeenCalledWith({
        jobId: 'job_test_12345',
        status: 'success',
        metadata: expect.objectContaining({
          healthSummary: result.healthSummary,
          incidentsCreated: 0,
          executionTime: expect.any(Number)
        })
      });
      expect(mockedPushToCommandCenter).toHaveBeenCalledTimes(1);
      expect(mockedSendHealthAlert).toHaveBeenCalledWith({
        alertType: 'health_check_complete',
        message: 'Health check completed: 3/3 sections healthy',
        details: expect.objectContaining({
          healthSummary: result.healthSummary
        }),
        priority: 'low'
      });
    });
  });

  describe('HOT_PROPS = 0 Triggers Incident', () => {
    it('should create IngestionHalted incident when HOT_PROPS count_recent = 0', async () => {
      const healthDataWithHotPropsFailure = [
        {
          section: 'HOT_PROPS',
          status: 'critical',
          count_recent: 0,
          count_total: 5000,
          last_updated: '2025-09-11T10:00:00Z',
          details: { recent_books: 0, recent_sports: 0, avg_ticks_per_minute: 0 },
          thresholds: { critical_threshold: 0, warning_threshold: 10, optimal_threshold: 100 },
          alerts: ['IngestionHalted']
        },
        {
          section: 'WARM_FEATURES',
          status: 'healthy',
          count_recent: 45,
          count_total: 1200,
          last_updated: '2025-09-11T11:30:00Z',
          details: { feature_types: 8, sports_covered: 5 },
          thresholds: {},
          alerts: []
        }
      ];

      mockedExecuteHealthSnapshot.mockResolvedValue({
        success: true,
        healthData: healthDataWithHotPropsFailure,
        executionTime: 1100,
        queryTime: 380
      });

      mockedLogJobRun.mockResolvedValue({
        jobId: 'job_test_67890',
        logged: true
      });

      mockedCreateIncidents.mockResolvedValue({
        incidentsCreated: ['IngestionHalted'],
        duplicatesSkipped: [],
        totalProcessed: 1
      });

      mockedCompleteJobRun.mockResolvedValue({
        completed: true,
        duration: 1100
      });

      mockedPushToCommandCenter.mockResolvedValue({
        pushed: true,
        endpoint: 'http://localhost:3004/api/system/health',
        responseTime: 200
      });

      const result = await operatorAgent.runHealthWorkflow();

      expect(result.success).toBe(true);
      expect(result.healthSummary.criticalSections).toBe(1);
      expect(result.healthSummary.sectionsWithAlerts).toContain('HOT_PROPS');
      expect(result.incidents).toBe(1);

      // Verify incident was created correctly
      expect(mockedCreateIncidents).toHaveBeenCalledWith({
        incidents: [{
          kind: 'IngestionHalted',
          severity: 'critical',
          details: expect.objectContaining({
            section: 'HOT_PROPS',
            status: 'critical',
            count_recent: 0,
            count_total: 5000
          }),
          section: 'HOT_PROPS'
        }]
      });

      expect(mockedSendHealthAlert).toHaveBeenCalledWith({
        alertType: 'health_check_complete',
        message: 'Health check completed: 1/2 sections healthy',
        details: expect.objectContaining({
          incidentsCreated: 1
        }),
        priority: 'medium'
      });
    });
  });

  describe('ScoringAgent Failure Triggers Incident', () => {
    it('should create AgentFailure incident when agent job fails in last 15 minutes', async () => {
      const healthDataWithAgentFailure = [
        {
          section: 'AGENT_JOBS',
          status: 'critical',
          count_recent: 5,
          count_total: 200,
          last_updated: '2025-09-11T12:00:00Z',
          details: { success_rate: 80.0, failed_jobs: 2, running_jobs: 1, agents_active: 4 },
          thresholds: { critical_failure_count: 1, warning_success_rate: 90 },
          alerts: ['AgentFailure']
        },
        {
          section: 'HOT_PROPS',
          status: 'healthy',
          count_recent: 120,
          count_total: 4000,
          last_updated: '2025-09-11T12:00:00Z',
          details: {},
          thresholds: {},
          alerts: []
        }
      ];

      mockedExecuteHealthSnapshot.mockResolvedValue({
        success: true,
        healthData: healthDataWithAgentFailure,
        executionTime: 950,
        queryTime: 320
      });

      mockedLogJobRun.mockResolvedValue({
        jobId: 'job_test_agent_failure',
        logged: true
      });

      mockedCreateIncidents.mockResolvedValue({
        incidentsCreated: ['AgentFailure'],
        duplicatesSkipped: [],
        totalProcessed: 1
      });

      mockedCompleteJobRun.mockResolvedValue({
        completed: true,
        duration: 950
      });

      mockedPushToCommandCenter.mockResolvedValue({
        pushed: true,
        endpoint: 'http://localhost:3004/api/system/health',
        responseTime: 175
      });

      const result = await operatorAgent.runHealthWorkflow();

      expect(result.success).toBe(true);
      expect(result.healthSummary.criticalSections).toBe(1);
      expect(result.healthSummary.sectionsWithAlerts).toContain('AGENT_JOBS');
      expect(result.incidents).toBe(1);

      // Verify AgentFailure incident was created with critical severity
      expect(mockedCreateIncidents).toHaveBeenCalledWith({
        incidents: [{
          kind: 'AgentFailure',
          severity: 'critical',
          details: expect.objectContaining({
            section: 'AGENT_JOBS',
            status: 'critical',
            details: expect.objectContaining({
              failed_jobs: 2
            })
          }),
          section: 'AGENT_JOBS'
        }]
      });
    });
  });

  describe('Recap Failure Triggers Incident', () => {
    it('should create RecapError incident when recap status fails', async () => {
      const healthDataWithRecapFailure = [
        {
          section: 'RECAP_RUNS',
          status: 'degraded',
          count_recent: 3,
          count_total: 50,
          last_updated: '2025-09-11T11:00:00Z',
          details: { today_success: 0, today_total: 1, success_rate_7d: 85.5 },
          thresholds: { daily_minimum: 1, weekly_success_rate: 95 },
          alerts: ['RecapError']
        }
      ];

      mockedExecuteHealthSnapshot.mockResolvedValue({
        success: true,
        healthData: healthDataWithRecapFailure,
        executionTime: 800,
        queryTime: 250
      });

      mockedLogJobRun.mockResolvedValue({
        jobId: 'job_test_recap_failure',
        logged: true
      });

      mockedCreateIncidents.mockResolvedValue({
        incidentsCreated: ['RecapError'],
        duplicatesSkipped: [],
        totalProcessed: 1
      });

      mockedCompleteJobRun.mockResolvedValue({
        completed: true,
        duration: 800
      });

      mockedPushToCommandCenter.mockResolvedValue({
        pushed: true,
        endpoint: 'http://localhost:3004/api/system/health',
        responseTime: 180
      });

      const result = await operatorAgent.runHealthWorkflow();

      expect(result.success).toBe(true);
      expect(result.healthSummary.degradedSections).toBe(1);
      expect(result.healthSummary.sectionsWithAlerts).toContain('RECAP_RUNS');
      expect(result.incidents).toBe(1);

      // Verify RecapError incident was created with medium severity
      expect(mockedCreateIncidents).toHaveBeenCalledWith({
        incidents: [{
          kind: 'RecapError',
          severity: 'medium',
          details: expect.objectContaining({
            section: 'RECAP_RUNS',
            status: 'degraded'
          }),
          section: 'RECAP_RUNS'
        }]
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle health snapshot query failure gracefully', async () => {
      mockedExecuteHealthSnapshot.mockResolvedValue({
        success: false,
        healthData: [],
        executionTime: 2000,
        queryTime: 1500
      });

      mockedLogJobRun.mockResolvedValue({
        jobId: 'job_test_failure',
        logged: true
      });

      mockedCompleteJobRun.mockResolvedValue({
        completed: true,
        duration: 2000
      });

      const result = await operatorAgent.runHealthWorkflow();

      expect(result.success).toBe(false);
      expect(result.healthSummary.totalSections).toBe(0);
      expect(result.incidents).toBe(0);

      // Verify failure was logged correctly
      expect(mockedCompleteJobRun).toHaveBeenCalledWith({
        jobId: 'job_test_failure',
        status: 'failed',
        metadata: expect.objectContaining({
          error: 'Health snapshot query failed'
        }),
        errorMessage: 'Health snapshot query failed'
      });

      expect(mockedSendHealthAlert).toHaveBeenCalledWith({
        alertType: 'health_check_failed',
        message: 'System health check failed',
        details: expect.objectContaining({
          error: 'Health snapshot query failed'
        }),
        priority: 'critical'
      });
    });

    it('should continue execution even if Command Center push fails', async () => {
      const healthyHealthData = [
        {
          section: 'HOT_PROPS',
          status: 'healthy',
          count_recent: 100,
          count_total: 3000,
          last_updated: '2025-09-11T12:00:00Z',
          details: {},
          thresholds: {},
          alerts: []
        }
      ];

      mockedExecuteHealthSnapshot.mockResolvedValue({
        success: true,
        healthData: healthyHealthData,
        executionTime: 1000,
        queryTime: 300
      });

      mockedLogJobRun.mockResolvedValue({
        jobId: 'job_test_cc_failure',
        logged: true
      });

      mockedCompleteJobRun.mockResolvedValue({
        completed: true,
        duration: 1000
      });

      // Mock Command Center failure
      mockedPushToCommandCenter.mockRejectedValue(new Error('Command Center unavailable'));

      const result = await operatorAgent.runHealthWorkflow();

      // Should still succeed despite Command Center failure
      expect(result.success).toBe(true);
      expect(result.healthSummary.healthySections).toBe(1);

      // Should still complete job and send alerts
      expect(mockedCompleteJobRun).toHaveBeenCalledWith({
        jobId: 'job_test_cc_failure',
        status: 'success',
        metadata: expect.any(Object)
      });

      expect(mockedSendHealthAlert).toHaveBeenCalledWith({
        alertType: 'health_check_complete',
        message: 'Health check completed: 1/1 sections healthy',
        details: expect.any(Object),
        priority: 'low'
      });
    });
  });

  describe('Multiple Incidents Handling', () => {
    it('should handle multiple simultaneous incidents correctly', async () => {
      const healthDataWithMultipleIssues = [
        {
          section: 'HOT_PROPS',
          status: 'critical',
          count_recent: 0,
          count_total: 5000,
          last_updated: '2025-09-11T10:00:00Z',
          details: {},
          thresholds: {},
          alerts: ['IngestionHalted']
        },
        {
          section: 'WARM_FEATURES',
          status: 'degraded',
          count_recent: 0,
          count_total: 800,
          last_updated: '2025-09-11T09:00:00Z',
          details: {},
          thresholds: {},
          alerts: ['FeaturePipelineStalled']
        },
        {
          section: 'AGENT_JOBS',
          status: 'critical',
          count_recent: 8,
          count_total: 100,
          last_updated: '2025-09-11T12:00:00Z',
          details: { failed_jobs: 3 },
          thresholds: {},
          alerts: ['AgentFailure']
        }
      ];

      mockedExecuteHealthSnapshot.mockResolvedValue({
        success: true,
        healthData: healthDataWithMultipleIssues,
        executionTime: 1400,
        queryTime: 550
      });

      mockedLogJobRun.mockResolvedValue({
        jobId: 'job_test_multiple',
        logged: true
      });

      mockedCreateIncidents.mockResolvedValue({
        incidentsCreated: ['IngestionHalted', 'FeaturePipelineStalled', 'AgentFailure'],
        duplicatesSkipped: [],
        totalProcessed: 3
      });

      mockedCompleteJobRun.mockResolvedValue({
        completed: true,
        duration: 1400
      });

      mockedPushToCommandCenter.mockResolvedValue({
        pushed: true,
        endpoint: 'http://localhost:3004/api/system/health',
        responseTime: 250
      });

      const result = await operatorAgent.runHealthWorkflow();

      expect(result.success).toBe(true);
      expect(result.healthSummary.totalSections).toBe(3);
      expect(result.healthSummary.criticalSections).toBe(2);
      expect(result.healthSummary.degradedSections).toBe(1);
      expect(result.incidents).toBe(3);
      expect(result.healthSummary.sectionsWithAlerts).toHaveLength(3);

      // Verify all three incidents were created
      expect(mockedCreateIncidents).toHaveBeenCalledWith({
        incidents: expect.arrayContaining([
          expect.objectContaining({ kind: 'IngestionHalted', severity: 'critical' }),
          expect.objectContaining({ kind: 'FeaturePipelineStalled', severity: 'high' }),
          expect.objectContaining({ kind: 'AgentFailure', severity: 'critical' })
        ])
      });
    });
  });

  describe('Severity Classification', () => {
    it('should classify alert severities correctly', async () => {
      const instance = operatorAgent as any; // Access private method for testing

      expect(instance.getSeverityForAlert('IngestionHalted')).toBe('critical');
      expect(instance.getSeverityForAlert('AgentFailure')).toBe('critical');
      expect(instance.getSeverityForAlert('FeaturePipelineStalled')).toBe('high');
      expect(instance.getSeverityForAlert('AlertLatency')).toBe('high');
      expect(instance.getSeverityForAlert('RecapError')).toBe('medium');
      expect(instance.getSeverityForAlert('UnknownAlert')).toBe('medium');
    });
  });
});