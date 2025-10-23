import { BaseAgentConfig, BaseAgentDependencies } from '../../BaseAgent/types';
export declare function scoreProp(config: BaseAgentConfig, deps: BaseAgentDependencies): (params: {
    propId: string;
    models: string[];
    options?: Record<string, unknown>;
}) => Promise<any>;
export declare function validateScore(config: BaseAgentConfig, deps: BaseAgentDependencies): (params: {
    propId: string;
    score: string;
    confidence: number;
    options?: Record<string, unknown>;
}) => Promise<any>;
export declare function monitorScoring(config: BaseAgentConfig, deps: BaseAgentDependencies): (params: {
    interval?: number;
    thresholds?: {
        confidence: number;
        quality: number;
    };
}) => Promise<any>;
export declare function initialize(config: BaseAgentConfig, deps: BaseAgentDependencies): () => Promise<any>;
export declare function healthCheck(config: BaseAgentConfig, deps: BaseAgentDependencies): (params: {
    components: string[];
    timeout?: number;
}) => Promise<any>;
export declare function validateDependencies(config: BaseAgentConfig, deps: BaseAgentDependencies): () => Promise<any>;
export declare function createActivities(config: BaseAgentConfig, deps: BaseAgentDependencies): {
    scoreProp: (params: {
        propId: string;
        models: string[];
        options?: Record<string, unknown>;
    }) => Promise<any>;
    validateScore: (params: {
        propId: string;
        score: string;
        confidence: number;
        options?: Record<string, unknown>;
    }) => Promise<any>;
    monitorScoring: (params: {
        interval?: number;
        thresholds?: {
            confidence: number;
            quality: number;
        };
    }) => Promise<any>;
    gradeNewProps: (params: {
        league: string;
        isLiveMode: boolean;
        cycleCount: number;
    }) => Promise<{
        league: string;
        topTierProps: any[];
        gradedCount: number;
    }>;
    initialize: () => Promise<any>;
    healthCheck: (params: {
        components: string[];
        timeout?: number;
    }) => Promise<any>;
    validateDependencies: () => Promise<any>;
};
export declare function gradeNewPropsActivity(params: {
    league: string;
    isLiveMode: boolean;
    cycleCount: number;
}): Promise<{
    league: string;
    topTierProps: any[];
    gradedCount: number;
}>;
export declare function scoreTopTierPicksActivity(params: {
    scoredProps: any[];
    league: string;
    cycleCount: number;
}): Promise<{
    league: string;
    scoredPicks: any[];
    scoreCount: number;
}>;
export declare function getNewUnifiedPicksActivity(params: {
    cycleCount: number;
}): Promise<any[]>;
export { gradeNewPropsActivity as gradeNewProps };
export { scoreTopTierPicksActivity as scoreTopTierPicks };
export { getNewUnifiedPicksActivity as getNewUnifiedPicks };
//# sourceMappingURL=index.d.ts.map