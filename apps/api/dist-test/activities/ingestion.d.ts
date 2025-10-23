/**
 * INGESTION ACTIVITIES
 * Core activities for data ingestion from various providers
 */
export declare function ingestOptimalProps(params: {
    league: string;
    isLiveMode: boolean;
    cycleCount: number;
}): Promise<{
    success: boolean;
    propsIngested: number;
    errors: string[];
}>;
export declare function ingestSGOProps(params: {
    league: string;
    isLiveMode: boolean;
    cycleCount: number;
}): Promise<{
    success: boolean;
    propsIngested: number;
    errors: string[];
}>;
export declare function validateIngestionData(params: {
    league: string;
    expectedMinProps: number;
}): Promise<{
    isValid: boolean;
    actualCount: number;
    issues: string[];
}>;
/**
 * Populate games table from Optimal events
 * This ensures the games table is properly populated for the smart form
 */
export declare function ingestOptimalGames(params: {
    leagues: string[];
    isLiveMode: boolean;
    cycleCount: number;
}): Promise<{
    success: boolean;
    gamesIngested: number;
    errors: string[];
}>;
//# sourceMappingURL=ingestion.d.ts.map