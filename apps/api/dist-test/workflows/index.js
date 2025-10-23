"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementIdsWorkflow = exports.settlementBackfillWorkflow = exports.concurrentSettlementProcessor = exports.processDateRangeBatch = exports.parallelSportBackfill = exports.massiveParallelSGOBackfill = exports.backfillSportSpecific = exports.continuousSGOBackfill = exports.backfillSportsGameOdds = exports.feedAgentWorkflow = exports.FeedAgentBackfillWorkflow = exports.testWorkflow = exports.wnbaScheduleWorkflow = exports.ncaabScheduleWorkflow = exports.ncaafScheduleWorkflow = exports.nhlScheduleWorkflow = exports.mlbScheduleWorkflow = exports.nbaScheduleWorkflow = exports.nflScheduleWorkflow = exports.createLeagueScheduleWorkflow = exports.healthMonitoringWorkflow = exports.quotaMonitoringWorkflow = exports.liveGameDetectorWorkflow = exports.discordAlertWorkflow = exports.gradingAndScoringWorkflow = exports.uspProcessingWorkflow = exports.leagueIngestionWorkflow = exports.syndicateSchedulerWorkflow = exports.e2eOperatorActivities = exports.e2eAlertActivities = exports.e2eProcessingActivities = exports.e2eIngestionActivities = exports.playerEnrichmentActivities = exports.operatorActivities = exports.contestActivities = exports.campaignActivities = exports.alertActivities = exports.gradingActivities = exports.auditActivities = exports.feedActivities = exports.notificationActivities = exports.analyticsActivities = exports.baseActivities = void 0;
exports.analyticsWorkflow = analyticsWorkflow;
exports.gradingWorkflow = gradingWorkflow;
exports.contestWorkflow = contestWorkflow;
exports.alertWorkflow = alertWorkflow;
exports.campaignWorkflow = campaignWorkflow;
exports.notificationWorkflow = notificationWorkflow;
exports.feedWorkflow = feedWorkflow;
exports.operatorWorkflow = operatorWorkflow;
exports.auditWorkflow = auditWorkflow;
exports.playerEnrichmentWorkflow = playerEnrichmentWorkflow;
exports.enrichPlayerByIdWorkflow = enrichPlayerByIdWorkflow;
exports.getPlayerHeadshotWorkflow = getPlayerHeadshotWorkflow;
exports.getMlbHeadshotWorkflow = getMlbHeadshotWorkflow;
exports.getNbaHeadshotWorkflow = getNbaHeadshotWorkflow;
exports.getNflHeadshotWorkflow = getNflHeadshotWorkflow;
exports.getNhlHeadshotWorkflow = getNhlHeadshotWorkflow;
exports.enrichLeaguePlayersWorkflow = enrichLeaguePlayersWorkflow;
const workflow_1 = require("@temporalio/workflow");
// Create proxies for each agent's activities with syndicate-optimized timeouts
const baseActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '1 minute'
});
exports.baseActivities = baseActivities;
const analyticsActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '5 minutes'
});
exports.analyticsActivities = analyticsActivities;
const notificationActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '30 seconds' // Critical for syndicate speed
});
exports.notificationActivities = notificationActivities;
const feedActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '90 seconds' // Must complete within 2-min cycle
});
exports.feedActivities = feedActivities;
const auditActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '10 minutes'
});
exports.auditActivities = auditActivities;
const gradingActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '60 seconds' // Fast grading for syndicate speed
});
exports.gradingActivities = gradingActivities;
const alertActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '30 seconds' // Alerts must be is_instant
});
exports.alertActivities = alertActivities;
const campaignActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '5 minutes'
});
exports.campaignActivities = campaignActivities;
const contestActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '5 minutes'
});
exports.contestActivities = contestActivities;
const operatorActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '30 seconds' // System monitoring must be fast
});
exports.operatorActivities = operatorActivities;
const playerEnrichmentActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '10 minutes'
});
exports.playerEnrichmentActivities = playerEnrichmentActivities;
// E2E Testing Activities - New structure for production testing
const e2eIngestionActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '90 seconds' // Must complete within 2-min cycle
});
exports.e2eIngestionActivities = e2eIngestionActivities;
const e2eProcessingActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '60 seconds' // Fast processing for syndicate speed
});
exports.e2eProcessingActivities = e2eProcessingActivities;
const e2eAlertActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '30 seconds' // Alerts must be is_instant
});
exports.e2eAlertActivities = e2eAlertActivities;
const e2eOperatorActivities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '30 seconds' // System monitoring must be fast
});
exports.e2eOperatorActivities = e2eOperatorActivities;
// Standard timeout configurations optimized for syndicate operations
const CRITICAL_TIMEOUT = '30 seconds'; // For alerts and notifications
const FAST_TIMEOUT = '60 seconds'; // For ingestion and grading
const STANDARD_TIMEOUT = '5 minutes'; // For analytics and reports
const EXTENDED_TIMEOUT = '10 minutes'; // For complex operations
// Proxy all activities with syndicate-optimized configurations
const analytics = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: STANDARD_TIMEOUT,
});
const grading = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: FAST_TIMEOUT, // Faster for syndicate operations
});
const contest = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: STANDARD_TIMEOUT,
});
const alert = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: CRITICAL_TIMEOUT, // Critical for syndicate alerts
});
const campaign = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: STANDARD_TIMEOUT,
});
const notification = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: CRITICAL_TIMEOUT, // Critical for Discord delivery
});
const feed = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: FAST_TIMEOUT, // Fast ingestion for 2-min cycles
});
const operator = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: CRITICAL_TIMEOUT, // Fast system monitoring
});
const audit = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: EXTENDED_TIMEOUT,
});
const playerEnrichment = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: EXTENDED_TIMEOUT,
});
// LEGACY WORKFLOWS (maintained for backward compatibility)
async function analyticsWorkflow(params) {
    await analytics.runAnalysis(params);
}
async function gradingWorkflow(params) {
    await grading.gradeSubmission(params);
}
async function contestWorkflow(params) {
    await contest.createContest(params);
}
async function alertWorkflow(params) {
    await alert.processAlert(params);
}
async function campaignWorkflow(params) {
    await campaign.createCampaign(params);
}
async function notificationWorkflow(params) {
    await notification.sendNotification(params);
}
async function feedWorkflow(params) {
    await feed.fetchFeed(params);
}
async function operatorWorkflow(params) {
    await operator.monitorSystem(params);
}
async function auditWorkflow(params) {
    await audit.runAudit(params);
}
// Player Enrichment Workflows - Multi-League Support
async function playerEnrichmentWorkflow(params) {
    await playerEnrichment.enrichAllPlayers(params);
}
async function enrichPlayerByIdWorkflow(params) {
    await playerEnrichment.enrichPlayerById(params);
}
async function getPlayerHeadshotWorkflow(params) {
    await playerEnrichment.getPlayerHeadshot(params);
}
// League-specific workflows
async function getMlbHeadshotWorkflow(params) {
    await playerEnrichment.getMlbHeadshot(params);
}
async function getNbaHeadshotWorkflow(params) {
    await playerEnrichment.getNbaHeadshot(params);
}
async function getNflHeadshotWorkflow(params) {
    await playerEnrichment.getNflHeadshot(params);
}
async function getNhlHeadshotWorkflow(params) {
    await playerEnrichment.getNhlHeadshot(params);
}
async function enrichLeaguePlayersWorkflow(params) {
    await playerEnrichment.enrichAllPlayers(params);
}
// SYNDICATE WORKFLOWS - Export all new syndicate workflows
var syndicate_scheduler_1 = require("./syndicate-scheduler");
Object.defineProperty(exports, "syndicateSchedulerWorkflow", { enumerable: true, get: function () { return syndicate_scheduler_1.syndicateSchedulerWorkflow; } });
var syndicate_scheduler_2 = require("./syndicate-scheduler");
Object.defineProperty(exports, "leagueIngestionWorkflow", { enumerable: true, get: function () { return syndicate_scheduler_2.leagueIngestionWorkflow; } });
var syndicate_scheduler_3 = require("./syndicate-scheduler");
Object.defineProperty(exports, "uspProcessingWorkflow", { enumerable: true, get: function () { return syndicate_scheduler_3.uspProcessingWorkflow; } });
var syndicate_scheduler_4 = require("./syndicate-scheduler");
Object.defineProperty(exports, "gradingAndScoringWorkflow", { enumerable: true, get: function () { return syndicate_scheduler_4.gradingAndScoringWorkflow; } });
var syndicate_scheduler_5 = require("./syndicate-scheduler");
Object.defineProperty(exports, "discordAlertWorkflow", { enumerable: true, get: function () { return syndicate_scheduler_5.discordAlertWorkflow; } });
// Support workflows
var support_workflows_1 = require("./support-workflows");
Object.defineProperty(exports, "liveGameDetectorWorkflow", { enumerable: true, get: function () { return support_workflows_1.liveGameDetectorWorkflow; } });
Object.defineProperty(exports, "quotaMonitoringWorkflow", { enumerable: true, get: function () { return support_workflows_1.quotaMonitoringWorkflow; } });
Object.defineProperty(exports, "healthMonitoringWorkflow", { enumerable: true, get: function () { return support_workflows_1.healthMonitoringWorkflow; } });
Object.defineProperty(exports, "createLeagueScheduleWorkflow", { enumerable: true, get: function () { return support_workflows_1.createLeagueScheduleWorkflow; } });
Object.defineProperty(exports, "nflScheduleWorkflow", { enumerable: true, get: function () { return support_workflows_1.nflScheduleWorkflow; } });
Object.defineProperty(exports, "nbaScheduleWorkflow", { enumerable: true, get: function () { return support_workflows_1.nbaScheduleWorkflow; } });
Object.defineProperty(exports, "mlbScheduleWorkflow", { enumerable: true, get: function () { return support_workflows_1.mlbScheduleWorkflow; } });
Object.defineProperty(exports, "nhlScheduleWorkflow", { enumerable: true, get: function () { return support_workflows_1.nhlScheduleWorkflow; } });
Object.defineProperty(exports, "ncaafScheduleWorkflow", { enumerable: true, get: function () { return support_workflows_1.ncaafScheduleWorkflow; } });
Object.defineProperty(exports, "ncaabScheduleWorkflow", { enumerable: true, get: function () { return support_workflows_1.ncaabScheduleWorkflow; } });
Object.defineProperty(exports, "wnbaScheduleWorkflow", { enumerable: true, get: function () { return support_workflows_1.wnbaScheduleWorkflow; } });
// Test workflow for E2E testing
var test_workflow_1 = require("./test-workflow");
Object.defineProperty(exports, "testWorkflow", { enumerable: true, get: function () { return test_workflow_1.testWorkflow; } });
// FeedAgent Backfill Workflow
var FeedAgentBackfillWorkflow_1 = require("./FeedAgentBackfillWorkflow");
Object.defineProperty(exports, "FeedAgentBackfillWorkflow", { enumerable: true, get: function () { return FeedAgentBackfillWorkflow_1.FeedAgentBackfillWorkflow; } });
// Alias for backward compatibility
var FeedAgentBackfillWorkflow_2 = require("./FeedAgentBackfillWorkflow");
Object.defineProperty(exports, "feedAgentWorkflow", { enumerable: true, get: function () { return FeedAgentBackfillWorkflow_2.FeedAgentBackfillWorkflow; } });
// SGO Backfill Workflows
var backfillSportsGameOdds_1 = require("./backfillSportsGameOdds");
Object.defineProperty(exports, "backfillSportsGameOdds", { enumerable: true, get: function () { return backfillSportsGameOdds_1.backfillSportsGameOdds; } });
Object.defineProperty(exports, "continuousSGOBackfill", { enumerable: true, get: function () { return backfillSportsGameOdds_1.continuousSGOBackfill; } });
Object.defineProperty(exports, "backfillSportSpecific", { enumerable: true, get: function () { return backfillSportsGameOdds_1.backfillSportSpecific; } });
// MASSIVE PARALLEL SGO BACKFILL WORKFLOWS
var massiveParallelSGOBackfill_1 = require("./massiveParallelSGOBackfill");
Object.defineProperty(exports, "massiveParallelSGOBackfill", { enumerable: true, get: function () { return massiveParallelSGOBackfill_1.massiveParallelSGOBackfill; } });
Object.defineProperty(exports, "parallelSportBackfill", { enumerable: true, get: function () { return massiveParallelSGOBackfill_1.parallelSportBackfill; } });
Object.defineProperty(exports, "processDateRangeBatch", { enumerable: true, get: function () { return massiveParallelSGOBackfill_1.processDateRangeBatch; } });
Object.defineProperty(exports, "concurrentSettlementProcessor", { enumerable: true, get: function () { return massiveParallelSGOBackfill_1.concurrentSettlementProcessor; } });
// Settlement Workflows
var SettlementAgent_1 = require("./agents/SettlementAgent");
Object.defineProperty(exports, "settlementBackfillWorkflow", { enumerable: true, get: function () { return SettlementAgent_1.settlementBackfillWorkflow; } });
Object.defineProperty(exports, "settlementIdsWorkflow", { enumerable: true, get: function () { return SettlementAgent_1.settlementIdsWorkflow; } });
//# sourceMappingURL=index.js.map