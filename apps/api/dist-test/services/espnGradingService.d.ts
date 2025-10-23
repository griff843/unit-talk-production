interface ESPNGameData {
    id: string;
    date: string;
    status: {
        type: {
            completed: boolean;
        };
    };
    competitions: Array<{
        competitors: Array<{
            team: {
                id: string;
                displayName: string;
                abbreviation: string;
            };
            score: string;
            homeAway: string;
            statistics?: Array<{
                name: string;
                displayValue: string;
            }>;
        }>;
        status: {
            type: {
                completed: boolean;
            };
        };
    }>;
}
interface ESPNPlayerStats {
    athlete: {
        id: string;
        displayName: string;
        position: {
            abbreviation: string;
        };
    };
    stats: string[];
}
interface PropGradingResult {
    prop_id: string;
    game_id: string;
    player_name: string;
    prop_type: string;
    line: number;
    actual_value: number;
    result: 'win' | 'loss' | 'push';
    confidence: number;
    graded_at: string;
    data_source: string;
}
export declare class ESPNGradingService {
    private supabase;
    private readonly BASE_URL;
    private readonly RATE_LIMIT_MS;
    private lastRequestTime;
    constructor();
    private rateLimit;
    private fetchESPNData;
    private getSportEndpoint;
    getGameResults(sport: string, gameDate: string): Promise<ESPNGameData[]>;
    getPlayerStats(sport: string, gameId: string): Promise<ESPNPlayerStats[]>;
    private parsePlayerStat;
    private gradeProp;
    gradePropsForGame(gameExternalId: string): Promise<PropGradingResult[]>;
    private calculateConfidence;
    private updatePropResult;
    gradeAllHistoricalProps(options?: {
        batchSize?: number;
        startDate?: string;
        endDate?: string;
        sports?: string[];
    }): Promise<{
        totalProcessed: number;
        totalGraded: number;
        errors: number;
    }>;
}
export {};
//# sourceMappingURL=espnGradingService.d.ts.map