/**
 * Normalize market values from raw player stats to standardized format
 * @param league The league/sport (MLB, NFL, NBA, etc.)
 * @param market The market type (e.g., 'total_bases', 'passing_yards')
 * @param playerStats Raw player statistics from adapter
 * @returns Normalized stat value or null if unknown
 */
export declare function normalizeMarket(league: string, market: string, playerStats: Record<string, number>): number | null;
/**
 * Get all supported markets for a league
 */
export declare function getSupportedMarkets(league: string): string[];
//# sourceMappingURL=index.d.ts.map