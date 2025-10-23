/**
 * Unified Data Source Router for Unit Talk Platform
 *
 * Intelligently routes data requests between The Odds API and Optimal API
 * based on sport, market type, and data requirements.
 *
 * Routing Strategy:
 * - Odds API: Primary for NCAAF, settlement data, spreads, totals, moneylines
 * - Optimal API: Secondary for specialized player props in major sports
 */
import { RawProp } from '../../types/rawProps';
export type DataSource = 'odds-api' | 'optimal-api' | 'unified';
type MarketType = 'player-props' | 'spreads' | 'totals' | 'moneylines' | 'futures' | 'settlement';
interface DataRequest {
    sport: string;
    marketType?: MarketType;
    date?: string;
    forceSource?: DataSource;
    includeSettlement?: boolean;
}
interface DataResponse {
    data: RawProp[];
    source: DataSource;
    sport: string;
    marketType?: MarketType;
    timestamp: string;
    metadata: {
        totalRecords: number;
        processingTimeMs: number;
        creditsUsed?: number;
        errors: string[];
    };
}
/**
 * Main unified data fetching function
 */
export declare function fetchUnifiedData(request: DataRequest): Promise<DataResponse>;
/**
 * Fetch settlement data (always from Odds API)
 */
export declare function fetchUnifiedSettlement(sport: string, daysFrom?: number): Promise<DataResponse>;
/**
 * Get routing information for a sport (for debugging/admin)
 */
export declare function getRoutingInfo(sport: string): {
    supported: boolean;
    message: string;
    sport?: undefined;
    primary?: undefined;
    secondary?: undefined;
    oddsApiKey?: undefined;
    supportedMarkets?: undefined;
    recommendation?: undefined;
} | {
    supported: boolean;
    sport: string;
    primary: "odds-api" | "optimal-api";
    secondary: "odds-api" | null;
    oddsApiKey: "americanfootball_nfl" | "americanfootball_ncaaf" | "basketball_nba" | "basketball_ncaab" | "basketball_wnba" | "baseball_mlb" | "icehockey_nhl" | "soccer_epl" | "tennis_atp";
    supportedMarkets: readonly ["player-props", "spreads", "totals", "moneylines", "settlement"] | readonly ["player-props", "spreads", "totals", "moneylines", "futures", "settlement"] | readonly ["spreads", "totals", "moneylines", "futures", "settlement"] | readonly ["spreads", "totals", "moneylines", "settlement"] | readonly ["moneylines", "totals", "settlement"] | readonly ["moneylines", "settlement"];
    recommendation: string;
    message?: undefined;
};
/**
 * Get system status across all data sources
 */
export declare function getSystemStatus(): Promise<{
    timestamp: string;
    oddsApi: {
        available: boolean;
        creditStatus: {
            monthlyUsed: number;
            monthlyLimit: number;
            dailyBudget: number;
            dailyEstimate: number;
            percentUsed: number;
            daysRemaining: number;
            resetDate: string;
        };
        supportedSports: number;
    };
    optimalApi: {
        available: boolean;
        supportedSports: number;
    };
    routing: {
        totalSports: number;
        oddsApiPrimary: number;
        optimalApiPrimary: number;
    };
}>;
export {};
//# sourceMappingURL=dataSourceRouter_original.d.ts.map