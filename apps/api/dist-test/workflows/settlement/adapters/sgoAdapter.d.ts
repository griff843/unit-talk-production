import { BaseAdapter, PlayerStatMap } from './types';
/**
 * SportsGameOdds.com settlement adapter
 * Provides settlement data from SGO API for backfilled props
 */
export declare class SgoAdapter extends BaseAdapter {
    private logger;
    private baseUrl;
    private apiKey;
    constructor();
    getName(): string;
    /**
     * Fetch game stats for settlement from SGO API
     */
    fetchGameStats(gameId: string): Promise<PlayerStatMap>;
    /**
     * Parse SGO stats response into PlayerStatMap format
     */
    private parseSgoStatsResponse;
    /**
     * Get stat mapping for different sports
     */
    private getSportStatMappings;
    /**
     * Get team stat mappings
     */
    private getTeamStatMappings;
    /**
     * Add composite statistics (e.g., points + rebounds + assists)
     */
    private addCompositeStats;
    /**
     * Normalize player names for consistent matching
     */
    protected normalizePlayerName(name: string): string;
    /**
     * Parse stat value, handling different formats
     */
    private parseStatValue;
}
//# sourceMappingURL=sgoAdapter.d.ts.map