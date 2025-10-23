import { PlayerEnrichmentResult, HeadshotResult } from '../shared/activity-results';
export interface BaseParams {
    agentId?: string;
    timestamp?: string;
    metadata?: Record<string, any>;
}
export interface PlayerEnrichmentAgentActivities {
    enrichAllPlayers(params: BaseParams): Promise<PlayerEnrichmentResult>;
    enrichPlayerById(params: BaseParams & {
        playerId: string;
    }): Promise<PlayerEnrichmentResult>;
    getPlayerHeadshot(params: BaseParams & {
        playerName: string;
        league: string;
    }): Promise<HeadshotResult>;
    getMlbHeadshot(params: BaseParams & {
        playerName: string;
    }): Promise<HeadshotResult>;
    getNbaHeadshot(params: BaseParams & {
        playerName: string;
    }): Promise<HeadshotResult>;
}
//# sourceMappingURL=player-enrichment.d.ts.map