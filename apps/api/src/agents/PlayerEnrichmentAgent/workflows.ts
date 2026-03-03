// src/agents/PlayerEnrichmentAgent/workflows.ts

import { proxyActivities } from '@temporalio/workflow';

import type { PlayerEnrichmentAgentActivities, ActivityParams } from '../../types/activities';
import type { SupportedLeague } from '../PlayerEnrichmentAgent';

// Create activity proxies with appropriate timeouts
const activities = proxyActivities<PlayerEnrichmentAgentActivities>({
  startToCloseTimeout: '30 minutes', // Extended timeout for batch operations
  heartbeatTimeout: '5 minutes',
});

/**
 * Workflow to enrich all players missing headshots
 * Can be scheduled to run nightly or triggered manually
 * Supports optional league filtering
 */
export async function enrichAllPlayersWorkflow(
  params: ActivityParams & { league?: SupportedLeague }
): Promise<void> {
  await activities.enrichAllPlayers(params);
}

/**
 * Workflow to enrich a specific player by ID
 */
export async function enrichPlayerByIdWorkflow(
  params: ActivityParams & { playerId: string }
): Promise<void> {
  await activities.enrichPlayerById(params);
}

/**
 * Workflow to get headshot for a specific player and league
 */
export async function getPlayerHeadshotWorkflow(
  params: ActivityParams & { playerName: string; league: SupportedLeague }
): Promise<void> {
  await activities.getPlayerHeadshot(params);
}

// League-specific workflows for convenience
/**
 * Workflow to get MLB headshot for a specific player
 */
export async function getMlbHeadshotWorkflow(
  params: ActivityParams & { playerName: string }
): Promise<void> {
  await activities.getMlbHeadshot(params);
}

/**
 * Workflow to get NBA headshot for a specific player
 */
export async function getNbaHeadshotWorkflow(
  params: ActivityParams & { playerName: string }
): Promise<void> {
  await activities.getNbaHeadshot(params);
}

/**
 * Workflow to get NFL headshot for a specific player
 */
export async function getNflHeadshotWorkflow(
  params: ActivityParams & { playerName: string }
): Promise<void> {
  await activities.getNflHeadshot(params);
}

/**
 * Workflow to get NHL headshot for a specific player
 */
export async function getNhlHeadshotWorkflow(
  params: ActivityParams & { playerName: string }
): Promise<void> {
  await activities.getNhlHeadshot(params);
}

/**
 * Workflow to enrich players for a specific league
 */
export async function enrichLeaguePlayersWorkflow(
  params: ActivityParams & { league: SupportedLeague }
): Promise<void> {
  await activities.enrichAllPlayers(params);
}
