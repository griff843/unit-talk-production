import { GradingFeatureSet } from '../types/GradingFeatureSet';
export interface HistoricalPick {
    id: string;
    features: GradingFeatureSet;
    result: 'win' | 'loss' | 'push';
    timestamp: string;
    actualOdds: number;
    profit?: number;
    sport: string;
    player: string;
    marketType: string;
}
/**
 * Get historical picks for backtesting
 * This is a mock implementation - replace with actual database queries
 */
export declare function getHistoricalPicks(startDate: string, endDate: string): Promise<HistoricalPick[]>;
/**
 * Save a pick result to the database
 * This is a mock implementation - replace with actual database operations
 */
export declare function savePick(pick: HistoricalPick): Promise<void>;
/**
 * Get pick by ID
 * This is a mock implementation - replace with actual database queries
 */
export declare function getPickById(id: string): Promise<HistoricalPick | null>;
//# sourceMappingURL=picks.d.ts.map