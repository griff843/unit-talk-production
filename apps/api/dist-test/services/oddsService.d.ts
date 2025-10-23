export interface OddsData {
    line: number;
    odds: number;
    timestamp: string;
}
export declare function fetchHistoricalOdds(playerName: string, statType: string, matchup: string, gameDate: string): Promise<OddsData | null>;
export declare function fetchCurrentOdds(playerName: string, statType: string, matchup: string): Promise<OddsData | null>;
//# sourceMappingURL=oddsService.d.ts.map