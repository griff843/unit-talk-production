"use strict";
// src/agents/PlayerEnrichmentAgent/workflows.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichAllPlayersWorkflow = enrichAllPlayersWorkflow;
exports.enrichPlayerByIdWorkflow = enrichPlayerByIdWorkflow;
exports.getPlayerHeadshotWorkflow = getPlayerHeadshotWorkflow;
exports.getMlbHeadshotWorkflow = getMlbHeadshotWorkflow;
exports.getNbaHeadshotWorkflow = getNbaHeadshotWorkflow;
exports.getNflHeadshotWorkflow = getNflHeadshotWorkflow;
exports.getNhlHeadshotWorkflow = getNhlHeadshotWorkflow;
exports.enrichLeaguePlayersWorkflow = enrichLeaguePlayersWorkflow;
const workflow_1 = require("@temporalio/workflow");
// Create activity proxies with appropriate timeouts
const activities = (0, workflow_1.proxyActivities)({
    startToCloseTimeout: '30 minutes', // Extended timeout for batch operations
    heartbeatTimeout: '5 minutes',
});
/**
 * Workflow to enrich all players missing headshots
 * Can be scheduled to run nightly or triggered manually
 * Supports optional league filtering
 */
async function enrichAllPlayersWorkflow(params) {
    await activities.enrichAllPlayers(params);
}
/**
 * Workflow to enrich a specific player by ID
 */
async function enrichPlayerByIdWorkflow(params) {
    await activities.enrichPlayerById(params);
}
/**
 * Workflow to get headshot for a specific player and league
 */
async function getPlayerHeadshotWorkflow(params) {
    await activities.getPlayerHeadshot(params);
}
// League-specific workflows for convenience
/**
 * Workflow to get MLB headshot for a specific player
 */
async function getMlbHeadshotWorkflow(params) {
    await activities.getMlbHeadshot(params);
}
/**
 * Workflow to get NBA headshot for a specific player
 */
async function getNbaHeadshotWorkflow(params) {
    await activities.getNbaHeadshot(params);
}
/**
 * Workflow to get NFL headshot for a specific player
 */
async function getNflHeadshotWorkflow(params) {
    await activities.getNflHeadshot(params);
}
/**
 * Workflow to get NHL headshot for a specific player
 */
async function getNhlHeadshotWorkflow(params) {
    await activities.getNhlHeadshot(params);
}
/**
 * Workflow to enrich players for a specific league
 */
async function enrichLeaguePlayersWorkflow(params) {
    await activities.enrichAllPlayers(params);
}
