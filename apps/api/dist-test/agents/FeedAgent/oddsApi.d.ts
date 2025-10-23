/**
 * The Odds API Integration for Unit Talk Platform
 *
 * This module provides integration with The Odds API for comprehensive sports betting data.
 * API Documentation: https://the-odds-api.com/liveapi/guides/v4/
 *
 * Key Features:
 * - Multi-sport coverage (70+ sports including NCAAF)
 * - Live odds, spreads, totals, and moneylines
 * - Settlement data via scores endpoint
 * - Credit-based usage monitoring
 * - Rate limiting and error handling
 * - Unified data format for existing pipeline
 */
import { RawProp } from '../../types/rawProps';
declare const SUPPORTED_SPORTS: {
    readonly americanfootball_nfl: "NFL";
    readonly americanfootball_ncaaf: "NCAAF";
    readonly basketball_nba: "NBA";
    readonly basketball_ncaab: "NCAAB";
    readonly basketball_wnba: "WNBA";
    readonly baseball_mlb: "MLB";
    readonly icehockey_nhl: "NHL";
    readonly soccer_epl: "EPL";
    readonly soccer_uefa_champs_league: "UEFA Champions League";
    readonly tennis_atp: "ATP";
    readonly tennis_wta: "WTA";
};
type SupportedSportKey = keyof typeof SUPPORTED_SPORTS;
declare const BETTING_MARKETS: {
    readonly h2h: "Head to Head (Moneyline)";
    readonly spreads: "Point Spreads";
    readonly totals: "Over/Under Totals";
    readonly outrights: "Tournament/Season Futures";
};
type BettingMarket = keyof typeof BETTING_MARKETS;
declare const BOOKMAKER_REGIONS: {
    readonly us: "US Bookmakers";
    readonly uk: "UK Bookmakers";
    readonly eu: "European Bookmakers";
    readonly au: "Australian Bookmakers";
};
type BookmakerRegion = keyof typeof BOOKMAKER_REGIONS;
interface OddsApiSport {
    key: string;
    group: string;
    title: string;
    description: string;
    active: boolean;
    has_outrights: boolean;
}
interface OddsApiBookmaker {
    key: string;
    title: string;
    last_update: string;
    markets: OddsApiMarket[];
}
interface OddsApiMarket {
    key: string;
    last_update: string;
    outcomes: OddsApiOutcome[];
}
interface OddsApiOutcome {
    name: string;
    price: number;
    point?: number;
}
interface OddsApiGame {
    id: string;
    sport_key: string;
    sport_title: string;
    commence_time: string;
    home_team: string;
    away_team: string;
    bookmakers: OddsApiBookmaker[];
}
interface OddsApiScore {
    id: string;
    sport_key: string;
    sport_title: string;
    commence_time: string;
    completed: boolean;
    home_team: string;
    away_team: string;
    scores: Array<{
        name: string;
        score: string | number;
    }> | null;
    last_update: string | null;
}
/**
 * Get current credit usage status
 */
export declare function getCreditUsageStatus(): {
    monthlyUsed: number;
    monthlyLimit: number;
    dailyBudget: number;
    dailyEstimate: number;
    percentUsed: number;
    daysRemaining: number;
    resetDate: string;
};
/**
 * Get list of available sports
 */
export declare function fetchAvailableSports(): Promise<OddsApiSport[]>;
/**
 * Fetch odds for a specific sport and market
 */
export declare function fetchOdds(sportKey: SupportedSportKey, markets?: BettingMarket[], regions?: BookmakerRegion[], oddsFormat?: 'decimal' | 'american'): Promise<OddsApiGame[]>;
/**
 * Fetch scores/results for settlement data
 */
export declare function fetchScores(sportKey: SupportedSportKey, daysFrom?: number): Promise<OddsApiScore[]>;
/**
 * Main function to fetch comprehensive odds data and convert to RawProp format
 */
export declare function fetchOddsApiProps(sportKey?: SupportedSportKey, markets?: BettingMarket[]): Promise<RawProp[]>;
/**
 * Get settlement data for completed games
 */
export declare function fetchSettlementData(sportKey: SupportedSportKey, daysFrom?: number): Promise<OddsApiScore[]>;
/**
 * Clear credit usage cache (for testing)
 */
export declare function clearCreditUsageCache(): void;
/**
 * Test API connectivity and credit status
 */
export declare function testOddsApiConnection(): Promise<{
    connected: boolean;
    availableSports: number;
    creditStatus: any;
    error?: string;
}>;
/**
 * OddsApiClient class for compatibility with existing code
 */
export declare class OddsApiClient {
    constructor(_apiKey?: string);
    fetchAvailableSports(): Promise<OddsApiSport[]>;
    fetchOdds(sportKey: SupportedSportKey, markets?: BettingMarket[], regions?: BookmakerRegion[], oddsFormat?: 'decimal' | 'american'): Promise<OddsApiGame[]>;
    fetchScores(sportKey: SupportedSportKey, daysFrom?: number): Promise<OddsApiScore[]>;
    fetchOddsApiProps(sportKey?: SupportedSportKey, markets?: BettingMarket[]): Promise<RawProp[]>;
    fetchSettlementData(sportKey: SupportedSportKey, daysFrom?: number): Promise<OddsApiScore[]>;
    testConnection(): Promise<{
        connected: boolean;
        availableSports: number;
        creditStatus: any;
        error?: string;
    }>;
    getCreditUsageStatus(): {
        monthlyUsed: number;
        monthlyLimit: number;
        dailyBudget: number;
        dailyEstimate: number;
        percentUsed: number;
        daysRemaining: number;
        resetDate: string;
    };
    clearCreditUsageCache(): void;
}
export {};
//# sourceMappingURL=oddsApi.d.ts.map