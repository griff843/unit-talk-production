import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics } from '../BaseAgent/types';
import { Leaderboard } from './types';
export declare class LeaderboardManager {
    private supabase;
    private config;
    private logger;
    private updateQueue;
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
    private handleScoreUpdate;
    private scheduleUpdate;
    private updateLeaderboard;
    private calculateRankings;
    private applyTiebreakers;
    private calculateTrend;
    private calculateStats;
    createLeaderboard(contestId: string, type: 'global' | 'regional' | 'division'): Promise<Leaderboard>;
    getLeaderboard(leaderboardId: string): Promise<Leaderboard>;
    checkHealth(): Promise<{
        status: string;
        details?: any;
    }>;
    updateLeaderboards(): Promise<void>;
    getMetrics(): Promise<BaseMetrics>;
}
//# sourceMappingURL=leaderboards.d.ts.map