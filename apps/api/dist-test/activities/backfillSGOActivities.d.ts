export interface SportConfig {
    name: string;
    sgoSportId: string;
    enabled: boolean;
    markets: string[];
}
export interface GameData {
    id: string;
    external_game_id: string;
    sport: string;
    home_team: string;
    away_team: string;
    game_date: string;
    game_time: string;
    status: string;
    venue?: string;
    season?: string;
    week?: number;
    metadata: Record<string, any>;
}
export interface PropData {
    id: string;
    external_prop_id: string;
    external_game_id: string;
    sport: string;
    player_name: string;
    stat_type: string;
    line: number;
    over_odds: number;
    under_odds: number;
    market_type: string;
    status: string;
    source: string;
    created_at: string;
    metadata: Record<string, any>;
}
export interface BackfillSGOOptions {
    sports?: string[];
    days?: number;
    batchSize?: number;
    rateLimit?: number;
    dryRun?: boolean;
    maxDays?: number;
}
export interface BackfillProgress {
    workflowId: string;
    startedAt: Date;
    totalDays: number;
    processedDays: number;
    totalSports: number;
    processedSports: number;
    totalGames: number;
    processedGames: number;
    totalProps: number;
    processedProps: number;
    duplicatesSkipped: number;
    errors: Array<{
        timestamp: Date;
        sport?: string;
        date?: Date;
        gameId?: string;
        error: string;
    }>;
    completedAt: Date | null;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
}
export interface DuplicateCheckResult {
    existing: string[];
    new: string[];
}
/**
 * Activities for SportsGameOdds backfill workflow
 */
export declare class BackfillSGOActivities {
    private readonly baseUrl;
    private readonly userAgent;
    /**
     * Transform SGO games response to internal format
     */
    private transformSGOGamesToInternal;
    /**
     * Transform SGO props response to internal format
     */
    private transformSGOPropsToInternal;
    /**
     * Map SGO game status to internal status
     */
    private mapSGOGameStatus;
    /**
     * Map SGO stat types to internal stat types
     */
    private mapSGOStatType;
    /**
     * Convert decimal odds to American odds
     */
    private convertOddsToAmerican;
    /**
     * Generate UUID for internal IDs
     */
    private generateUUID;
}
export declare const fetchSGOGames: {
    (params: {
        sport: string;
        date: Date;
        apiKey: string;
    }): Promise<GameData[]>;
    (params: {
        sport: string;
        date: Date;
        apiKey: string;
    }): Promise<GameData[]>;
};
export declare const fetchSGOProps: {
    (params: {
        gameId: string;
        sport: string;
        apiKey: string;
    }): Promise<PropData[]>;
    (params: {
        gameId: string;
        sport: string;
        apiKey: string;
    }): Promise<PropData[]>;
};
export declare const insertGames: {
    (params: {
        games: GameData[];
        source: string;
    }): Promise<void>;
    (params: {
        games: GameData[];
        source: string;
    }): Promise<void>;
};
export declare const insertProps: {
    (params: {
        props: PropData[];
        gameId: string;
        source: string;
    }): Promise<void>;
    (params: {
        props: PropData[];
        gameId: string;
        source: string;
    }): Promise<void>;
};
export declare const queueSettlement: {
    (params: {
        propIds: string[];
        gameId: string;
        priority: string;
        source: string;
    }): Promise<void>;
    (params: {
        propIds: string[];
        gameId: string;
        priority: string;
        source: string;
    }): Promise<void>;
};
export declare const updateProgress: {
    (progress: BackfillProgress): Promise<void>;
    (progress: BackfillProgress): Promise<void>;
};
export declare const checkDuplicates: {
    (ids: string[], table: "games" | "raw_props"): Promise<DuplicateCheckResult>;
    (ids: string[], table: "games" | "raw_props"): Promise<DuplicateCheckResult>;
};
export declare const validateSGOResponse: {
    (data: any, type: "games" | "props"): Promise<boolean>;
    (data: any, type: "games" | "props"): Promise<boolean>;
};
export declare const storeBatch: {
    (params: {
        games: GameData[];
        props: PropData[];
        source: string;
    }): Promise<void>;
    (params: {
        games: GameData[];
        props: PropData[];
        source: string;
    }): Promise<void>;
};
export declare const backfillSGOActivities: BackfillSGOActivities;
export interface BackfillSGOActivities {
    fetchSGOGames(params: {
        sport: string;
        date: Date;
        apiKey: string;
    }): Promise<GameData[]>;
    fetchSGOProps(params: {
        gameId: string;
        sport: string;
        apiKey: string;
    }): Promise<PropData[]>;
    insertGames(params: {
        games: GameData[];
        source: string;
    }): Promise<void>;
    insertProps(params: {
        props: PropData[];
        gameId: string;
        source: string;
    }): Promise<void>;
    queueSettlement(params: {
        propIds: string[];
        gameId: string;
        priority: string;
        source: string;
    }): Promise<void>;
    updateProgress(progress: BackfillProgress): Promise<void>;
    checkDuplicates(ids: string[], table: 'games' | 'raw_props'): Promise<DuplicateCheckResult>;
    validateSGOResponse(data: any, type: 'games' | 'props'): Promise<boolean>;
    storeBatch(params: {
        games: GameData[];
        props: PropData[];
        source: string;
    }): Promise<void>;
}
//# sourceMappingURL=backfillSGOActivities.d.ts.map