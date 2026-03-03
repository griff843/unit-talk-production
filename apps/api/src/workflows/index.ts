import { proxyActivities } from '@temporalio/workflow';

import type {
  IngestionActivities,
  ProcessingActivities,
  AlertActivities,
  OperatorActivities,
} from '../activities';
import type { SupportedLeague } from '../agents/PlayerEnrichmentAgent';
import type {
  BaseAgentActivities,
  AnalyticsAgentActivities,
  NotificationAgentActivities,
  FeedAgentActivities,
  AuditAgentActivities,
  GradingAgentActivities,
  AlertAgentActivities,
  CampaignAgentActivities,
  ContestAgentActivities,
  OperatorAgentActivities,
  PlayerEnrichmentAgentActivities,
  ActivityParams,
} from '../types/activities';

// Create proxies for each agent's activities with syndicate-optimized timeouts
const baseActivities = proxyActivities<BaseAgentActivities>({
  startToCloseTimeout: '1 minute',
});

const analyticsActivities = proxyActivities<AnalyticsAgentActivities>({
  startToCloseTimeout: '5 minutes',
});

const notificationActivities = proxyActivities<NotificationAgentActivities>({
  startToCloseTimeout: '30 seconds', // Critical for syndicate speed
});

const feedActivities = proxyActivities<FeedAgentActivities>({
  startToCloseTimeout: '90 seconds', // Must complete within 2-min cycle
});

const auditActivities = proxyActivities<AuditAgentActivities>({
  startToCloseTimeout: '10 minutes',
});

const gradingActivities = proxyActivities<GradingAgentActivities>({
  startToCloseTimeout: '60 seconds', // Fast grading for syndicate speed
});

const alertActivities = proxyActivities<AlertAgentActivities>({
  startToCloseTimeout: '30 seconds', // Alerts must be is_instant
});

const campaignActivities = proxyActivities<CampaignAgentActivities>({
  startToCloseTimeout: '5 minutes',
});

const contestActivities = proxyActivities<ContestAgentActivities>({
  startToCloseTimeout: '5 minutes',
});

const operatorActivities = proxyActivities<OperatorAgentActivities>({
  startToCloseTimeout: '30 seconds', // System monitoring must be fast
});

const playerEnrichmentActivities = proxyActivities<PlayerEnrichmentAgentActivities>({
  startToCloseTimeout: '10 minutes',
});

// E2E Testing Activities - New structure for production testing
const e2eIngestionActivities = proxyActivities<IngestionActivities>({
  startToCloseTimeout: '90 seconds', // Must complete within 2-min cycle
});

const e2eProcessingActivities = proxyActivities<ProcessingActivities>({
  startToCloseTimeout: '60 seconds', // Fast processing for syndicate speed
});

const e2eAlertActivities = proxyActivities<AlertActivities>({
  startToCloseTimeout: '30 seconds', // Alerts must be is_instant
});

const e2eOperatorActivities = proxyActivities<OperatorActivities>({
  startToCloseTimeout: '30 seconds', // System monitoring must be fast
});

// Export all activities
export {
  baseActivities,
  analyticsActivities,
  notificationActivities,
  feedActivities,
  auditActivities,
  gradingActivities,
  alertActivities,
  campaignActivities,
  contestActivities,
  operatorActivities,
  playerEnrichmentActivities,
  // E2E Testing Activities
  e2eIngestionActivities,
  e2eProcessingActivities,
  e2eAlertActivities,
  e2eOperatorActivities,
};

// Standard timeout configurations optimized for syndicate operations
const CRITICAL_TIMEOUT = '30 seconds'; // For alerts and notifications
const FAST_TIMEOUT = '60 seconds'; // For ingestion and grading
const STANDARD_TIMEOUT = '5 minutes'; // For analytics and reports
const EXTENDED_TIMEOUT = '10 minutes'; // For complex operations

// Proxy all activities with syndicate-optimized configurations
const analytics = proxyActivities<typeof analyticsActivities>({
  startToCloseTimeout: STANDARD_TIMEOUT,
});

const grading = proxyActivities<typeof gradingActivities>({
  startToCloseTimeout: FAST_TIMEOUT, // Faster for syndicate operations
});

const contest = proxyActivities<typeof contestActivities>({
  startToCloseTimeout: STANDARD_TIMEOUT,
});

const alert = proxyActivities<typeof alertActivities>({
  startToCloseTimeout: CRITICAL_TIMEOUT, // Critical for syndicate alerts
});

const campaign = proxyActivities<typeof campaignActivities>({
  startToCloseTimeout: STANDARD_TIMEOUT,
});

const notification = proxyActivities<typeof notificationActivities>({
  startToCloseTimeout: CRITICAL_TIMEOUT, // Critical for Discord delivery
});

const feed = proxyActivities<typeof feedActivities>({
  startToCloseTimeout: FAST_TIMEOUT, // Fast ingestion for 2-min cycles
});

const operator = proxyActivities<typeof operatorActivities>({
  startToCloseTimeout: CRITICAL_TIMEOUT, // Fast system monitoring
});

const audit = proxyActivities<typeof auditActivities>({
  startToCloseTimeout: EXTENDED_TIMEOUT,
});

const playerEnrichment = proxyActivities<typeof playerEnrichmentActivities>({
  startToCloseTimeout: EXTENDED_TIMEOUT,
});

// LEGACY WORKFLOWS (maintained for backward compatibility)
export async function analyticsWorkflow(params: ActivityParams): Promise<void> {
  await analytics.runAnalysis(params);
}

export async function gradingWorkflow(params: ActivityParams): Promise<void> {
  await grading.gradeSubmission(params);
}

export async function contestWorkflow(params: ActivityParams): Promise<void> {
  await contest.createContest(params);
}

export async function alertWorkflow(params: ActivityParams): Promise<void> {
  await alert.processAlert(params);
}

export async function campaignWorkflow(params: ActivityParams): Promise<void> {
  await campaign.createCampaign(params);
}

export async function notificationWorkflow(params: ActivityParams): Promise<void> {
  await notification.sendNotification(params);
}

export async function feedWorkflow(params: ActivityParams): Promise<void> {
  await feed.fetchFeed(params);
}

export async function operatorWorkflow(params: ActivityParams): Promise<void> {
  await operator.monitorSystem(params);
}

export async function auditWorkflow(params: ActivityParams): Promise<void> {
  await audit.runAudit(params);
}

// Player Enrichment Workflows - Multi-League Support
export async function playerEnrichmentWorkflow(
  params: ActivityParams & { league?: SupportedLeague }
): Promise<void> {
  await playerEnrichment.enrichAllPlayers(params);
}

export async function enrichPlayerByIdWorkflow(
  params: ActivityParams & { playerId: string }
): Promise<void> {
  await playerEnrichment.enrichPlayerById(params);
}

export async function getPlayerHeadshotWorkflow(
  params: ActivityParams & { playerName: string; league: SupportedLeague }
): Promise<void> {
  await playerEnrichment.getPlayerHeadshot(params);
}

// League-specific workflows
export async function getMlbHeadshotWorkflow(
  params: ActivityParams & { playerName: string }
): Promise<void> {
  await playerEnrichment.getMlbHeadshot(params);
}

export async function getNbaHeadshotWorkflow(
  params: ActivityParams & { playerName: string }
): Promise<void> {
  await playerEnrichment.getNbaHeadshot(params);
}

export async function getNflHeadshotWorkflow(
  params: ActivityParams & { playerName: string }
): Promise<void> {
  await playerEnrichment.getNflHeadshot(params);
}

export async function getNhlHeadshotWorkflow(
  params: ActivityParams & { playerName: string }
): Promise<void> {
  await playerEnrichment.getNhlHeadshot(params);
}

export async function enrichLeaguePlayersWorkflow(
  params: ActivityParams & { league: SupportedLeague }
): Promise<void> {
  await playerEnrichment.enrichAllPlayers(params);
}

// SYNDICATE WORKFLOWS - Export all new syndicate workflows
export { syndicateSchedulerWorkflow } from './syndicate-scheduler';
export { leagueIngestionWorkflow } from './syndicate-scheduler';
export { uspProcessingWorkflow } from './syndicate-scheduler';
export { gradingAndScoringWorkflow } from './syndicate-scheduler';
export { discordAlertWorkflow } from './syndicate-scheduler';

// Support workflows
export {
  liveGameDetectorWorkflow,
  quotaMonitoringWorkflow,
  healthMonitoringWorkflow,
  createLeagueScheduleWorkflow,
  nflScheduleWorkflow,
  nbaScheduleWorkflow,
  mlbScheduleWorkflow,
  nhlScheduleWorkflow,
  ncaafScheduleWorkflow,
  ncaabScheduleWorkflow,
  wnbaScheduleWorkflow,
} from './support-workflows';

// Test workflow for E2E testing
export { testWorkflow } from './test-workflow';

// FeedAgent Backfill Workflow
export { FeedAgentBackfillWorkflow } from './FeedAgentBackfillWorkflow';

// Alias for backward compatibility
export { FeedAgentBackfillWorkflow as feedAgentWorkflow } from './FeedAgentBackfillWorkflow';
