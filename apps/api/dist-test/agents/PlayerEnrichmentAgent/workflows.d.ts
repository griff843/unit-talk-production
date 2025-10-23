import type { ActivityParams } from '../../types/activities';
import type { SupportedLeague } from '../PlayerEnrichmentAgent';
/**
 * Workflow to enrich all players missing headshots
 * Can be scheduled to run nightly or triggered manually
 * Supports optional league filtering
 */
export declare function enrichAllPlayersWorkflow(params: ActivityParams & {
    league?: SupportedLeague;
}): Promise<void>;
/**
 * Workflow to enrich a specific player by ID
 */
export declare function enrichPlayerByIdWorkflow(params: ActivityParams & {
    playerId: string;
}): Promise<void>;
/**
 * Workflow to get headshot for a specific player and league
 */
export declare function getPlayerHeadshotWorkflow(params: ActivityParams & {
    playerName: string;
    league: SupportedLeague;
}): Promise<void>;
/**
 * Workflow to get MLB headshot for a specific player
 */
export declare function getMlbHeadshotWorkflow(params: ActivityParams & {
    playerName: string;
}): Promise<void>;
/**
 * Workflow to get NBA headshot for a specific player
 */
export declare function getNbaHeadshotWorkflow(params: ActivityParams & {
    playerName: string;
}): Promise<void>;
/**
 * Workflow to get NFL headshot for a specific player
 */
export declare function getNflHeadshotWorkflow(params: ActivityParams & {
    playerName: string;
}): Promise<void>;
/**
 * Workflow to get NHL headshot for a specific player
 */
export declare function getNhlHeadshotWorkflow(params: ActivityParams & {
    playerName: string;
}): Promise<void>;
/**
 * Workflow to enrich players for a specific league
 */
export declare function enrichLeaguePlayersWorkflow(params: ActivityParams & {
    league: SupportedLeague;
}): Promise<void>;
//# sourceMappingURL=workflows.d.ts.map