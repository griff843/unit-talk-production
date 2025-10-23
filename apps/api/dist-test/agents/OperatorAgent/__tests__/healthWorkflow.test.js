"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const index_1 = require("../index");
const healthActivities_1 = require("../activities/healthActivities");
// Mock all activity functions
globals_1.jest.mock('../activities/healthActivities');
globals_1.jest.mock('../../../utils/logger');
const mockedExecuteHealthSnapshot = healthActivities_1.executeHealthSnapshot;
const mockedLogJobRun = healthActivities_1.logJobRun;
const mockedCompleteJobRun = healthActivities_1.completeJobRun;
const mockedCreateIncidents = healthActivities_1.createIncidents;
const mockedPushToCommandCenter = healthActivities_1.pushToCommandCenter;
const mockedSendHealthAlert = healthActivities_1.sendHealthAlert;
(0, globals_1.describe)('OperatorAgent HealthWorkflow', () => {
    let operatorAgent;
    let mockDependencies;
    (0, globals_1.beforeEach)(() => {
        // Setup mock dependencies
        mockDependencies = {
            logger: {
                info: globals_1.jest.fn(),
                error: globals_1.jest.fn(),
                warn: globals_1.jest.fn(),
                debug: globals_1.jest.fn()
            },
            supabase: {
                from: globals_1.jest.fn(() => ({
                    select: globals_1.jest.fn(() => ({
                        eq: globals_1.jest.fn(() => ({
                            gte: globals_1.jest.fn(() => ({
                                limit: globals_1.jest.fn(() => ({ data: [], error: null }))
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
        operatorAgent = new index_1.OperatorAgent(config, mockDependencies);
        // Reset all mocks
        globals_1.jest.clearAllMocks();
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.resetAllMocks();
    });
    (0, globals_1.describe)('Healthy System Run', () => {
        (0, globals_1.it)('should complete successfully when all sections are healthy', async () => {
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
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.healthSummary.totalSections).toBe(3);
            (0, globals_1.expect)(result.healthSummary.healthySections).toBe(3);
            (0, globals_1.expect)(result.healthSummary.degradedSections).toBe(0);
            (0, globals_1.expect)(result.healthSummary.criticalSections).toBe(0);
            (0, globals_1.expect)(result.incidents).toBe(0);
            (0, globals_1.expect)(result.healthSummary.sectionsWithAlerts).toHaveLength(0);
            // Verify all activities were called correctly
            (0, globals_1.expect)(mockedExecuteHealthSnapshot).toHaveBeenCalledTimes(1);
            (0, globals_1.expect)(mockedLogJobRun).toHaveBeenCalledWith({
                agent: 'OperatorAgent',
                workflow: 'HealthWorkflow',
                jobName: 'system_health_check',
                status: 'running',
                metadata: globals_1.expect.objectContaining({
                    startTime: globals_1.expect.any(String)
                })
            });
            (0, globals_1.expect)(mockedCompleteJobRun).toHaveBeenCalledWith({
                jobId: 'job_test_12345',
                status: 'success',
                metadata: globals_1.expect.objectContaining({
                    healthSummary: result.healthSummary,
                    incidentsCreated: 0,
                    executionTime: globals_1.expect.any(Number)
                })
            });
            (0, globals_1.expect)(mockedPushToCommandCenter).toHaveBeenCalledTimes(1);
            (0, globals_1.expect)(mockedSendHealthAlert).toHaveBeenCalledWith({
                alertType: 'health_check_complete',
                message: 'Health check completed: 3/3 sections healthy',
                details: globals_1.expect.objectContaining({
                    healthSummary: result.healthSummary
                }),
                priority: 'low'
            });
        });
    });
    (0, globals_1.describe)('HOT_PROPS = 0 Triggers Incident', () => {
        (0, globals_1.it)('should create IngestionHalted incident when HOT_PROPS count_recent = 0', async () => {
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
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.healthSummary.criticalSections).toBe(1);
            (0, globals_1.expect)(result.healthSummary.sectionsWithAlerts).toContain('HOT_PROPS');
            (0, globals_1.expect)(result.incidents).toBe(1);
            // Verify incident was created correctly
            (0, globals_1.expect)(mockedCreateIncidents).toHaveBeenCalledWith({
                incidents: [{
                        kind: 'IngestionHalted',
                        severity: 'critical',
                        details: globals_1.expect.objectContaining({
                            section: 'HOT_PROPS',
                            status: 'critical',
                            count_recent: 0,
                            count_total: 5000
                        }),
                        section: 'HOT_PROPS'
                    }]
            });
            (0, globals_1.expect)(mockedSendHealthAlert).toHaveBeenCalledWith({
                alertType: 'health_check_complete',
                message: 'Health check completed: 1/2 sections healthy',
                details: globals_1.expect.objectContaining({
                    incidentsCreated: 1
                }),
                priority: 'medium'
            });
        });
    });
    (0, globals_1.describe)('ScoringAgent Failure Triggers Incident', () => {
        (0, globals_1.it)('should create AgentFailure incident when agent job fails in last 15 minutes', async () => {
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
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.healthSummary.criticalSections).toBe(1);
            (0, globals_1.expect)(result.healthSummary.sectionsWithAlerts).toContain('AGENT_JOBS');
            (0, globals_1.expect)(result.incidents).toBe(1);
            // Verify AgentFailure incident was created with critical severity
            (0, globals_1.expect)(mockedCreateIncidents).toHaveBeenCalledWith({
                incidents: [{
                        kind: 'AgentFailure',
                        severity: 'critical',
                        details: globals_1.expect.objectContaining({
                            section: 'AGENT_JOBS',
                            status: 'critical',
                            details: globals_1.expect.objectContaining({
                                failed_jobs: 2
                            })
                        }),
                        section: 'AGENT_JOBS'
                    }]
            });
        });
    });
    (0, globals_1.describe)('Recap Failure Triggers Incident', () => {
        (0, globals_1.it)('should create RecapError incident when recap status fails', async () => {
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
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.healthSummary.degradedSections).toBe(1);
            (0, globals_1.expect)(result.healthSummary.sectionsWithAlerts).toContain('RECAP_RUNS');
            (0, globals_1.expect)(result.incidents).toBe(1);
            // Verify RecapError incident was created with medium severity
            (0, globals_1.expect)(mockedCreateIncidents).toHaveBeenCalledWith({
                incidents: [{
                        kind: 'RecapError',
                        severity: 'medium',
                        details: globals_1.expect.objectContaining({
                            section: 'RECAP_RUNS',
                            status: 'degraded'
                        }),
                        section: 'RECAP_RUNS'
                    }]
            });
        });
    });
    (0, globals_1.describe)('Error Handling', () => {
        (0, globals_1.it)('should handle health snapshot query failure gracefully', async () => {
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
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.healthSummary.totalSections).toBe(0);
            (0, globals_1.expect)(result.incidents).toBe(0);
            // Verify failure was logged correctly
            (0, globals_1.expect)(mockedCompleteJobRun).toHaveBeenCalledWith({
                jobId: 'job_test_failure',
                status: 'failed',
                metadata: globals_1.expect.objectContaining({
                    error: 'Health snapshot query failed'
                }),
                errorMessage: 'Health snapshot query failed'
            });
            (0, globals_1.expect)(mockedSendHealthAlert).toHaveBeenCalledWith({
                alertType: 'health_check_failed',
                message: 'System health check failed',
                details: globals_1.expect.objectContaining({
                    error: 'Health snapshot query failed'
                }),
                priority: 'critical'
            });
        });
        (0, globals_1.it)('should continue execution even if Command Center push fails', async () => {
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
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.healthSummary.healthySections).toBe(1);
            // Should still complete job and send alerts
            (0, globals_1.expect)(mockedCompleteJobRun).toHaveBeenCalledWith({
                jobId: 'job_test_cc_failure',
                status: 'success',
                metadata: globals_1.expect.any(Object)
            });
            (0, globals_1.expect)(mockedSendHealthAlert).toHaveBeenCalledWith({
                alertType: 'health_check_complete',
                message: 'Health check completed: 1/1 sections healthy',
                details: globals_1.expect.any(Object),
                priority: 'low'
            });
        });
    });
    (0, globals_1.describe)('Multiple Incidents Handling', () => {
        (0, globals_1.it)('should handle multiple simultaneous incidents correctly', async () => {
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
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.healthSummary.totalSections).toBe(3);
            (0, globals_1.expect)(result.healthSummary.criticalSections).toBe(2);
            (0, globals_1.expect)(result.healthSummary.degradedSections).toBe(1);
            (0, globals_1.expect)(result.incidents).toBe(3);
            (0, globals_1.expect)(result.healthSummary.sectionsWithAlerts).toHaveLength(3);
            // Verify all three incidents were created
            (0, globals_1.expect)(mockedCreateIncidents).toHaveBeenCalledWith({
                incidents: globals_1.expect.arrayContaining([
                    globals_1.expect.objectContaining({ kind: 'IngestionHalted', severity: 'critical' }),
                    globals_1.expect.objectContaining({ kind: 'FeaturePipelineStalled', severity: 'high' }),
                    globals_1.expect.objectContaining({ kind: 'AgentFailure', severity: 'critical' })
                ])
            });
        });
    });
    (0, globals_1.describe)('Severity Classification', () => {
        (0, globals_1.it)('should classify alert severities correctly', async () => {
            const instance = operatorAgent; // Access private method for testing
            (0, globals_1.expect)(instance.getSeverityForAlert('IngestionHalted')).toBe('critical');
            (0, globals_1.expect)(instance.getSeverityForAlert('AgentFailure')).toBe('critical');
            (0, globals_1.expect)(instance.getSeverityForAlert('FeaturePipelineStalled')).toBe('high');
            (0, globals_1.expect)(instance.getSeverityForAlert('AlertLatency')).toBe('high');
            (0, globals_1.expect)(instance.getSeverityForAlert('RecapError')).toBe('medium');
            (0, globals_1.expect)(instance.getSeverityForAlert('UnknownAlert')).toBe('medium');
        });
    });
});
//# sourceMappingURL=healthWorkflow.test.js.map