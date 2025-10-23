/**
 * Supported leagues for player enrichment
 */
export type SupportedLeague = 'MLB' | 'NBA' | 'NFL' | 'NHL';
/**
 * Enrichment field types
 */
export type EnrichmentField = 'headshot' | 'height_cm' | 'weight_kg' | 'birthday';
/**
 * League-specific breakdown for enrichment summary
 */
interface LeagueBreakdown {
    processed: number;
    successful: number;
    notFound: number;
    errors: number;
}
/**
 * Field-specific breakdown for enrichment summary
 */
interface FieldBreakdown {
    processed: number;
    successful: number;
    notFound: number;
    errors: number;
}
/**
 * Comprehensive enrichment summary with league and field breakdowns
 */
export interface EnrichmentSummary {
    totalProcessed: number;
    successfulEnrichments: number;
    notFound: number;
    errors: number;
    errorDetails: string[];
    leagueBreakdown: {
        MLB: LeagueBreakdown;
        NBA: LeagueBreakdown;
        NFL: LeagueBreakdown;
        NHL: LeagueBreakdown;
    };
    fieldBreakdown: {
        headshot: FieldBreakdown;
        height_cm: FieldBreakdown;
        weight_kg: FieldBreakdown;
        birthday: FieldBreakdown;
    };
}
/**
 * Enrich all players or players from a specific league
 */
export declare function enrichAllPlayers(league?: SupportedLeague): Promise<EnrichmentSummary>;
/**
 * Enrich a specific player by ID
 */
export declare function enrichPlayerById(playerId: string): Promise<boolean>;
export {};
//# sourceMappingURL=PlayerEnrichmentAgent.d.ts.map