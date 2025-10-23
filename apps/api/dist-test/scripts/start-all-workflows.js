"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = startAllWorkflows;
require("dotenv/config");
const client_1 = require("@temporalio/client");
const logger_1 = require("../utils/logger");
const getEnv_1 = require("../utils/getEnv");
// Import workflow functions
const support_workflows_1 = require("../workflows/support-workflows");
const recap_workflows_1 = require("../workflows/recap-workflows");
const analyticsWorkflow_1 = require("../workflows/analyticsWorkflow");
const logger = (0, logger_1.createLogger)('workflow-orchestrator');
const env = (0, getEnv_1.getEnv)();
const WORKFLOWS_TO_START = [
    {
        name: 'syndicateScheduler',
        workflowFunction: support_workflows_1.syndicateSchedulerWorkflow,
        workflowId: 'syndicate-scheduler-v1',
        description: 'Main data ingestion and processing workflow (1min intervals)',
        critical: true
    },
    {
        name: 'liveGameDetector',
        workflowFunction: support_workflows_1.liveGameDetectorWorkflow,
        workflowId: 'live-game-detector',
        description: 'Detects live games and adjusts system mode',
        critical: true
    },
    {
        name: 'quotaMonitoring',
        workflowFunction: support_workflows_1.quotaMonitoringWorkflow,
        workflowId: 'quota-monitoring',
        description: 'Monitors API quotas and activates fallbacks',
        critical: true
    },
    {
        name: 'healthMonitoring',
        workflowFunction: support_workflows_1.healthMonitoringWorkflow,
        workflowId: 'health-monitoring',
        description: 'System health and performance monitoring',
        critical: true
    },
    {
        name: 'nflSchedule',
        workflowFunction: support_workflows_1.nflScheduleWorkflow,
        workflowId: 'nfl-schedule',
        description: 'NFL-specific scheduling and peak hours management',
        critical: true
    },
    {
        name: 'nbaSchedule',
        workflowFunction: support_workflows_1.nbaScheduleWorkflow,
        workflowId: 'nba-schedule',
        description: 'NBA-specific scheduling and peak hours management',
        critical: false
    },
    {
        name: 'mlbSchedule',
        workflowFunction: support_workflows_1.mlbScheduleWorkflow,
        workflowId: 'mlb-schedule',
        description: 'MLB-specific scheduling and peak hours management',
        critical: false
    },
    {
        name: 'nhlSchedule',
        workflowFunction: support_workflows_1.nhlScheduleWorkflow,
        workflowId: 'nhl-schedule',
        description: 'NHL-specific scheduling and peak hours management (6PM-11PM)',
        critical: false
    },
    {
        name: 'ncaafSchedule',
        workflowFunction: support_workflows_1.ncaafScheduleWorkflow,
        workflowId: 'ncaaf-schedule',
        description: 'NCAAF-specific scheduling and peak hours management (11AM-11PM Saturday)',
        critical: true
    },
    {
        name: 'ncaabSchedule',
        workflowFunction: support_workflows_1.ncaabScheduleWorkflow,
        workflowId: 'ncaab-schedule',
        description: 'NCAAB-specific scheduling and peak hours management (6PM-11PM)',
        critical: false
    },
    {
        name: 'wnbaSchedule',
        workflowFunction: support_workflows_1.wnbaScheduleWorkflow,
        workflowId: 'wnba-schedule',
        description: 'WNBA-specific scheduling and peak hours management',
        critical: false
    },
    {
        name: 'recapAgent',
        workflowFunction: recap_workflows_1.combinedRecapWorkflow,
        workflowId: 'recap-agent',
        description: 'Combined RecapAgent workflow (daily, weekly, monthly, micro recaps)',
        critical: true
    },
    {
        name: 'analyticsAgent',
        workflowFunction: analyticsWorkflow_1.analyticsWorkflow,
        workflowId: 'analytics-agent',
        description: 'AnalyticsAgent data processing and insights generation',
        critical: true
    },
    // Note: playerEnrichment workflow temporarily disabled pending implementation
];
async function startWorkflow(client, workflow, dryRun) {
    logger.info(`🔄 Starting ${workflow.name}: ${workflow.description}`);
    if (dryRun) {
        logger.info(`[DRY RUN] Would start workflow: ${workflow.workflowId}`);
        return { name: workflow.name, status: 'started' };
    }
    try {
        await client.workflow.start(workflow.workflowFunction, {
            taskQueue: env.TEMPORAL_TASK_QUEUE,
            workflowId: workflow.workflowId,
            args: workflow.args || []
        });
        logger.info(`🎯 ${workflow.name} started successfully`);
        return { name: workflow.name, status: 'started' };
    }
    catch (error) {
        if (error.message?.includes('WorkflowExecutionAlreadyStarted')) {
            logger.info(`✅ ${workflow.name} already running`);
            return { name: workflow.name, status: 'already_running' };
        }
        logger.error(`❌ Failed to start ${workflow.name}:`, { error: error.message });
        return { name: workflow.name, status: 'failed', error: error.message };
    }
}
function logSummary(results, workflowsToStart) {
    const started = results.filter(r => r.status === 'started');
    const alreadyRunning = results.filter(r => r.status === 'already_running');
    const failed = results.filter(r => r.status === 'failed');
    logger.info('🏁 Workflow startup summary:');
    logger.info(`   ✅ Started: ${started.length}`);
    logger.info(`   🔄 Already running: ${alreadyRunning.length}`);
    logger.info(`   ❌ Failed: ${failed.length}`);
    if (failed.length > 0) {
        logger.error('❌ Failed workflows:');
        failed.forEach(f => logger.error(`   - ${f.name}: ${f.error}`));
        const criticalFailures = failed.filter(f => workflowsToStart.find(w => w.name === f.name)?.critical);
        if (criticalFailures.length > 0) {
            const error = `Critical workflows failed to start: ${criticalFailures.map(f => f.name).join(', ')}`;
            logger.error('🚨 Failed to start workflows:', { error });
            throw new Error(error);
        }
    }
}
async function startAllWorkflows(options = {}) {
    try {
        const { criticalOnly = false, dryRun = false } = options;
        logger.info('🚀 Starting Unit Talk workflow orchestration...');
        logger.info(`Connecting to Temporal at: ${env.TEMPORAL_SERVER_URL}`);
        const client = await connectToTemporal();
        const workflowsToStart = filterWorkflows(criticalOnly);
        logger.info(`Planning to start ${workflowsToStart.length} workflows (critical only: ${criticalOnly})`);
        const results = await executeWorkflows(client, workflowsToStart, dryRun);
        logSummary(results, workflowsToStart);
        logger.info('✅ Workflow orchestration complete');
    }
    catch (error) {
        logger.error('❌ Workflow startup failed:', { error });
        throw error;
    }
}
async function connectToTemporal() {
    return new client_1.Client({
        connection: client_1.Connection.lazy({
            address: env.TEMPORAL_SERVER_URL
        })
    });
}
function filterWorkflows(criticalOnly) {
    return WORKFLOWS_TO_START.filter(wf => !criticalOnly || wf.critical);
}
async function executeWorkflows(client, workflows, dryRun) {
    return Promise.all(workflows.map(workflow => startWorkflow(client, workflow, dryRun)));
}
// Allow direct execution
if (require.main === module) {
    startAllWorkflows()
        .then(() => process.exit(0))
        .catch((error) => {
        logger.error('Failed to start workflows:', error);
        process.exit(1);
    });
}
