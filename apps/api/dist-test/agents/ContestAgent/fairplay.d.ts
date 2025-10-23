import { SupabaseClient } from '@supabase/supabase-js';
import { ContestAgentConfig } from './types';
export declare class FairPlayMonitor {
    private supabase;
    private logger;
    private errorHandler;
    private metrics;
    private patternCache;
    constructor(supabase: SupabaseClient, _config: ContestAgentConfig);
    initialize(): Promise<void>;
    cleanup(): Promise<void>;
    private handleActivityUpdate;
    private loadParticipantHistory;
    private analyzePatterns;
    private reportViolation;
    private calculateScoreReduction;
    private updateFairPlayScore;
    private checkMultipleAccounts;
    private analyzeAccountRelationship;
    private checkAlternatingActivity;
    private checkBehaviorSimilarity;
    private compareValueDistributions;
    private createHistogram;
    private checkResourceSharing;
    private checkBettingPatterns;
    private analyzeBettingBehavior;
    private calculateVariance;
    private findRapidSequences;
    private checkCollusion;
    private analyzeCollusionPatterns;
    private getComplementaryBet;
    private analyzeProfitPatterns;
    private calculateCorrelation;
    private checkTimeAnomaly;
    private analyzeTimingPatterns;
    checkHealth(): Promise<{
        status: string;
        details?: any;
    }>;
    getMetrics(): Promise<{
        errors: number;
        warnings: number;
        successes: number;
    }>;
}
//# sourceMappingURL=fairplay.d.ts.map