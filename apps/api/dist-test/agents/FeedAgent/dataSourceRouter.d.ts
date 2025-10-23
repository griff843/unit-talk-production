/**
 * Unified Data Source Router for Unit Talk Platform
 *
 * Intelligently routes data requests between SGO, The Odds API, and Optimal API
 * based on sport, market type, and data requirements.
 *
 * Routing Strategy (UPDATED Sept 18, 2025):
 * - SGO API: PRIMARY for all major sports - comprehensive coverage with real-time updates
 * - Odds API: Secondary for settlement data, NCAAF, and fallback
 * - Optimal API: Tertiary fallback (currently expired API key)
 */
import { RawProp } from '../../types/rawProps';
export type DataSource = 'sgo-api' | 'odds-api' | 'optimal-api' | 'unified';
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
 * Main unified data fetching function with SGO priority
 */
export declare function fetchUnifiedData(request: DataRequest): Promise<DataResponse>;
/**
 * Get current credit usage for cost monitoring
 */
export declare function getCreditStatus(): Promise<{
    oddsApi: {
        used: number;
        remaining: number;
    };
    optimal: {
        status: string;
    };
    sgo: {
        status: string;
    };
}>;
/**
 * Health check for all data sources
 */
export declare function healthCheck(): Promise<{
    sgo: {
        status: 'healthy' | 'unhealthy';
        message: string;
    };
    oddsApi: {
        status: 'healthy' | 'unhealthy';
        message: string;
    };
    optimal: {
        status: 'healthy' | 'unhealthy';
        message: string;
    };
}>;
export {};
//# sourceMappingURL=dataSourceRouter.d.ts.map