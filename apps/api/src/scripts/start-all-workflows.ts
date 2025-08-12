import 'dotenv/config';
import { Client, Connection } from '@temporalio/client';
import { createLogger } from '../utils/logger';
import { getEnv } from '../utils/getEnv';
// Import workflow functions
import { 
  syndicateSchedulerWorkflow,
  liveGameDetectorWorkflow,
  quotaMonitoringWorkflow,
  healthMonitoringWorkflow,
  nflScheduleWorkflow,
  nbaScheduleWorkflow,
  mlbScheduleWorkflow,
  nhlScheduleWorkflow,
  ncaafScheduleWorkflow,
  ncaabScheduleWorkflow,
  wnbaScheduleWorkflow
} from '../workflows/support-workflows';
import { combinedRecapWorkflow } from '../workflows/recap-workflows';
import { analyticsWorkflow } from '../workflows/analyticsWorkflow';

const logger = createLogger('workflow-orchestrator');
const env = getEnv();

interface WorkflowConfig {
  name: string;
  workflowFunction: any;
  workflowId: string;
  description: string;
  critical: boolean;
  args?: any[];
}

const WORKFLOWS_TO_START: WorkflowConfig[] = [
  {
    name: 'syndicateScheduler',
    workflowFunction: syndicateSchedulerWorkflow,
    workflowId: 'syndicate-scheduler-v1',
    description: 'Main data ingestion and processing workflow (1min intervals)',
    critical: true
  },
  {
    name: 'liveGameDetector',
    workflowFunction: liveGameDetectorWorkflow,
    workflowId: 'live-game-detector',
    description: 'Detects live games and adjusts system mode',
    critical: true
  },
  {
    name: 'quotaMonitoring',
    workflowFunction: quotaMonitoringWorkflow,
    workflowId: 'quota-monitoring',
    description: 'Monitors API quotas and activates fallbacks',
    critical: true
  },
  {
    name: 'healthMonitoring',
    workflowFunction: healthMonitoringWorkflow,
    workflowId: 'health-monitoring',
    description: 'System health and performance monitoring',
    critical: true
  },
  {
    name: 'nflSchedule',
    workflowFunction: nflScheduleWorkflow,
    workflowId: 'nfl-schedule',
    description: 'NFL-specific scheduling and peak hours management',
    critical: true
  },
  {
    name: 'nbaSchedule',
    workflowFunction: nbaScheduleWorkflow,
    workflowId: 'nba-schedule',
    description: 'NBA-specific scheduling and 24/7 data ingestion',
    critical: true
  },
  {
    name: 'mlbSchedule',
    workflowFunction: mlbScheduleWorkflow,
    workflowId: 'mlb-schedule',
    description: 'MLB-specific scheduling and 24/7 data ingestion',
    critical: true
  },
  {
    name: 'nhlSchedule',
    workflowFunction: nhlScheduleWorkflow,
    workflowId: 'nhl-schedule',
    description: 'NHL-specific scheduling and 24/7 data ingestion',
    critical: true
  },
  {
    name: 'ncaafSchedule',
    workflowFunction: ncaafScheduleWorkflow,
    workflowId: 'ncaaf-schedule',
    description: 'NCAAF-specific scheduling and 24/7 data ingestion',
    critical: true
  },
  {
    name: 'ncaabSchedule',
    workflowFunction: ncaabScheduleWorkflow,
    workflowId: 'ncaab-schedule',
    description: 'NCAAB-specific scheduling and 24/7 data ingestion',
    critical: true
  },
  {
    name: 'wnbaSchedule',
    workflowFunction: wnbaScheduleWorkflow,
    workflowId: 'wnba-schedule',
    description: 'WNBA-specific scheduling and 24/7 data ingestion',
    critical: true
  },
  {
    name: 'recapAgent',
    workflowFunction: combinedRecapWorkflow,
    workflowId: 'recap-agent',
    description: 'Combined RecapAgent workflow (daily, weekly, monthly, micro recaps)',
    critical: true
  },
  {
    name: 'analyticsAgent',
    workflowFunction: analyticsWorkflow,
    workflowId: 'analytics-agent',
    description: 'AnalyticsAgent data processing and insights generation',
    critical: true
  },
  // Note: playerEnrichment workflow temporarily disabled pending implementation
];

interface StartResult {
  name: string;
  status: 'started' | 'already_running' | 'failed';
  error?: string;
}

async function startWorkflow(client: Client, workflow: WorkflowConfig, dryRun: boolean): Promise<StartResult> {
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
  } catch (error: any) {
    if (error.message?.includes('WorkflowExecutionAlreadyStarted')) {
      logger.info(`✅ ${workflow.name} already running`);
      return { name: workflow.name, status: 'already_running' };
    }
    
    logger.error(`❌ Failed to start ${workflow.name}:`, { error: error.message });
    return { name: workflow.name, status: 'failed', error: error.message };
  }
}

function logSummary(results: StartResult[], workflowsToStart: WorkflowConfig[]): void {
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
    
    const criticalFailures = failed.filter(f => 
      workflowsToStart.find(w => w.name === f.name)?.critical
    );
    
    if (criticalFailures.length > 0) {
      const error = `Critical workflows failed to start: ${criticalFailures.map(f => f.name).join(', ')}`;
      logger.error('🚨 Failed to start workflows:', { error });
      throw new Error(error);
    }
  }
}

export default async function startAllWorkflows(options: {
  criticalOnly?: boolean;
  dryRun?: boolean;
} = {}): Promise<void> {
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
  } catch (error: any) {
    logger.error('❌ Workflow startup failed:', { error });
    throw error;
  }
}

async function connectToTemporal(): Promise<Client> {
  return new Client({
    connection: Connection.lazy({
      address: env.TEMPORAL_SERVER_URL
    })
  });
}

function filterWorkflows(criticalOnly: boolean): WorkflowConfig[] {
  return WORKFLOWS_TO_START.filter(wf => !criticalOnly || wf.critical);
}

async function executeWorkflows(
  client: Client, 
  workflows: WorkflowConfig[], 
  dryRun: boolean
): Promise<StartResult[]> {
  return Promise.all(
    workflows.map(workflow => startWorkflow(client, workflow, dryRun))
  );
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