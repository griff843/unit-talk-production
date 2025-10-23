import type { IngestionActivities, ProcessingActivities, AlertActivities, OperatorActivities } from '../activities';
import type { SupportedLeague } from '../agents/PlayerEnrichmentAgent';
import type { BaseAgentActivities, AnalyticsAgentActivities, NotificationAgentActivities, FeedAgentActivities, AuditAgentActivities, ScoringAgentActivities, AlertAgentActivities, CampaignAgentActivities, ContestAgentActivities, OperatorAgentActivities, PlayerEnrichmentAgentActivities, ActivityParams } from '../types/activities';
declare const baseActivities: import("@temporalio/workflow").ActivityInterfaceFor<BaseAgentActivities>;
declare const analyticsActivities: import("@temporalio/workflow").ActivityInterfaceFor<AnalyticsAgentActivities>;
declare const notificationActivities: import("@temporalio/workflow").ActivityInterfaceFor<NotificationAgentActivities>;
declare const feedActivities: import("@temporalio/workflow").ActivityInterfaceFor<FeedAgentActivities>;
declare const auditActivities: import("@temporalio/workflow").ActivityInterfaceFor<AuditAgentActivities>;
declare const gradingActivities: import("@temporalio/workflow").ActivityInterfaceFor<ScoringAgentActivities>;
declare const alertActivities: import("@temporalio/workflow").ActivityInterfaceFor<AlertAgentActivities>;
declare const campaignActivities: import("@temporalio/workflow").ActivityInterfaceFor<CampaignAgentActivities>;
declare const contestActivities: import("@temporalio/workflow").ActivityInterfaceFor<ContestAgentActivities>;
declare const operatorActivities: import("@temporalio/workflow").ActivityInterfaceFor<OperatorAgentActivities>;
declare const playerEnrichmentActivities: import("@temporalio/workflow").ActivityInterfaceFor<PlayerEnrichmentAgentActivities>;
declare const e2eIngestionActivities: import("@temporalio/workflow").ActivityInterfaceFor<IngestionActivities>;
declare const e2eProcessingActivities: import("@temporalio/workflow").ActivityInterfaceFor<ProcessingActivities>;
declare const e2eAlertActivities: import("@temporalio/workflow").ActivityInterfaceFor<AlertActivities>;
declare const e2eOperatorActivities: import("@temporalio/workflow").ActivityInterfaceFor<OperatorActivities>;
export { baseActivities, analyticsActivities, notificationActivities, feedActivities, auditActivities, gradingActivities, alertActivities, campaignActivities, contestActivities, operatorActivities, playerEnrichmentActivities, e2eIngestionActivities, e2eProcessingActivities, e2eAlertActivities, e2eOperatorActivities };
export declare function analyticsWorkflow(params: ActivityParams): Promise<void>;
export declare function gradingWorkflow(params: ActivityParams): Promise<void>;
export declare function contestWorkflow(params: ActivityParams): Promise<void>;
export declare function alertWorkflow(params: ActivityParams): Promise<void>;
export declare function campaignWorkflow(params: ActivityParams): Promise<void>;
export declare function notificationWorkflow(params: ActivityParams): Promise<void>;
export declare function feedWorkflow(params: ActivityParams): Promise<void>;
export declare function operatorWorkflow(params: ActivityParams): Promise<void>;
export declare function auditWorkflow(params: ActivityParams): Promise<void>;
export declare function playerEnrichmentWorkflow(params: ActivityParams & {
    league?: SupportedLeague;
}): Promise<void>;
export declare function enrichPlayerByIdWorkflow(params: ActivityParams & {
    playerId: string;
}): Promise<void>;
export declare function getPlayerHeadshotWorkflow(params: ActivityParams & {
    playerName: string;
    league: SupportedLeague;
}): Promise<void>;
export declare function getMlbHeadshotWorkflow(params: ActivityParams & {
    playerName: string;
}): Promise<void>;
export declare function getNbaHeadshotWorkflow(params: ActivityParams & {
    playerName: string;
}): Promise<void>;
export declare function getNflHeadshotWorkflow(params: ActivityParams & {
    playerName: string;
}): Promise<void>;
export declare function getNhlHeadshotWorkflow(params: ActivityParams & {
    playerName: string;
}): Promise<void>;
export declare function enrichLeaguePlayersWorkflow(params: ActivityParams & {
    league: SupportedLeague;
}): Promise<void>;
export { syndicateSchedulerWorkflow } from './syndicate-scheduler';
export { leagueIngestionWorkflow } from './syndicate-scheduler';
export { uspProcessingWorkflow } from './syndicate-scheduler';
export { gradingAndScoringWorkflow } from './syndicate-scheduler';
export { discordAlertWorkflow } from './syndicate-scheduler';
export { liveGameDetectorWorkflow, quotaMonitoringWorkflow, healthMonitoringWorkflow, createLeagueScheduleWorkflow, nflScheduleWorkflow, nbaScheduleWorkflow, mlbScheduleWorkflow, nhlScheduleWorkflow, ncaafScheduleWorkflow, ncaabScheduleWorkflow, wnbaScheduleWorkflow } from './support-workflows';
export { testWorkflow } from './test-workflow';
export { FeedAgentBackfillWorkflow } from './FeedAgentBackfillWorkflow';
export { FeedAgentBackfillWorkflow as feedAgentWorkflow } from './FeedAgentBackfillWorkflow';
export { backfillSportsGameOdds, continuousSGOBackfill, backfillSportSpecific } from './backfillSportsGameOdds';
export { massiveParallelSGOBackfill, parallelSportBackfill, processDateRangeBatch, concurrentSettlementProcessor } from './massiveParallelSGOBackfill';
export { settlementBackfillWorkflow, settlementIdsWorkflow } from './agents/SettlementAgent';
//# sourceMappingURL=index.d.ts.map