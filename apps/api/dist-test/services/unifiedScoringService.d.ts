import { EDGE_SCORING_VERSION, type EdgeScoreResult, type EdgeScoreConfig, type ScoreBreakdown } from '../logic/scoring/unified-edge-score';
import { PropObject } from '../types/propTypes';
import { RawProp } from '../types/rawProps';
interface ScoringResult extends EdgeScoreResult {
    aiEnhanced: boolean;
    confidence: number;
    insights: string[];
    leagueSpecific: {
        coreStats: ScoreBreakdown;
        synergy: ScoreBreakdown;
    };
}
export declare class UnifiedScoringService {
    private static instance;
    private llmService;
    private constructor();
    static getInstance(): UnifiedScoringService;
    scoreProp(prop: PropObject | RawProp, config?: Partial<EdgeScoreConfig>, options?: {
        useAI?: boolean;
        adminOverrideTier?: string | null;
        useLeagueRules?: boolean;
    }): Promise<ScoringResult>;
    private calculateLeagueSpecificScore;
    private enhanceWithAI;
    private buildAIPrompt;
    getVersion(): typeof EDGE_SCORING_VERSION;
}
export {};
//# sourceMappingURL=unifiedScoringService.d.ts.map