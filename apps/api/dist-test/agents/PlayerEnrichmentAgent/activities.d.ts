import { SupportedLeague } from '../PlayerEnrichmentAgent';
import type { ActivityParams } from '../../types/activities';
/**
 * Activity to enrich all players missing headshots
 * Supports optional league filtering
 */
export declare function enrichAllPlayersActivity(params: ActivityParams & {
    league?: SupportedLeague;
}): Promise<void>;
/**
 * Activity to enrich a specific player by ID
 */
export declare function enrichPlayerByIdActivity(params: ActivityParams & {
    playerId: string;
}): Promise<void>;
/**
 * Activity to get headshot for a specific player and league
 */
export declare function getPlayerHeadshotActivity(params: ActivityParams & {
    playerName: string;
    league: SupportedLeague;
}): Promise<string | null>;
export declare function getMlbHeadshotActivity(params: ActivityParams & {
    playerName: string;
}): Promise<string | null>;
export declare function getNbaHeadshotActivity(params: ActivityParams & {
    playerName: string;
}): Promise<string | null>;
export declare function getNflHeadshotActivity(params: ActivityParams & {
    playerName: string;
}): Promise<string | null>;
export declare function getNhlHeadshotActivity(params: ActivityParams & {
    playerName: string;
}): Promise<string | null>;
//# sourceMappingURL=activities.d.ts.map