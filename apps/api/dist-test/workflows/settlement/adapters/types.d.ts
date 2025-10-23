export type PlayerStatMap = {
    [playerIdOrName: string]: {
        [stat: string]: number;
    };
};
export interface LeagueAdapter {
    /**
     * Fetch game statistics for all players in a game
     * @param gameId External game ID from the data provider
     * @returns Map of player IDs/names to their stats
     */
    fetchGameStats(gameId: string): Promise<PlayerStatMap>;
    /**
     * Get the name of this adapter for logging/tracking
     */
    getName(): string;
    /**
     * Get the rate limit for this adapter (requests per second)
     */
    getRateLimit(): number;
}
export declare abstract class BaseAdapter implements LeagueAdapter {
    protected rateLimit: number;
    protected maxRetries: number;
    protected retryDelay: number;
    abstract fetchGameStats(gameId: string): Promise<PlayerStatMap>;
    abstract getName(): string;
    getRateLimit(): number;
    protected retryWithBackoff<T>(fn: () => Promise<T>, attempt?: number): Promise<T>;
    protected sleep(ms: number): Promise<void>;
    protected normalizePlayerName(name: string): string;
}
//# sourceMappingURL=types.d.ts.map