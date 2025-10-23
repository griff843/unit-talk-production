import { BaseAdapter, PlayerStatMap } from './types';
/**
 * Placeholder adapter for future Odds API Pro integration
 * This adapter is designed for premium odds and settlement data
 */
export declare class OddsApiAdapter extends BaseAdapter {
    private logger;
    private baseUrl;
    private apiKey;
    constructor();
    getName(): string;
    fetchGameStats(gameId: string): Promise<PlayerStatMap>;
    private parseOddsApiResponse;
}
//# sourceMappingURL=oddsApiAdapter.d.ts.map