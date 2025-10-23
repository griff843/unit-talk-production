import { ScoringAgentActivities } from '../../../types/agent-activities/scoring';
import { BaseAgentActivitiesImpl } from '../../BaseAgent/activities';
import { BaseAgentConfig, BaseAgentDependencies } from '../../BaseAgent/types';
export declare class ScoringAgentActivitiesImpl extends BaseAgentActivitiesImpl implements ScoringAgentActivities {
    private agent;
    private config;
    private deps;
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    private getAgent;
    scoreNewProps(params: {
        league: string;
        isLiveMode: boolean;
        cycleCount: number;
    }): Promise<{
        league: string;
        topTierProps: any[];
        scoredCount: number;
    }>;
    gradeNewProps(params: {
        league: string;
        isLiveMode: boolean;
        cycleCount: number;
    }): Promise<{
        league: string;
        topTierProps: any[];
        gradedCount: number;
    }>;
    scoreTopTierPicks(params: {
        scoredProps: any[];
        league: string;
        cycleCount: number;
    }): Promise<{
        league: string;
        scoredPicks: any[];
        scoreCount: number;
    }>;
    updateUnifiedPicks(params: {
        scoringResults: any[];
        cycleCount: number;
        timestamp: Date;
    }): Promise<void>;
    getNewUnifiedPicks(params: {
        cycleCount: number;
    }): Promise<any[]>;
    scoreSubmission(params: {
        submissionId: string;
        capperName: string;
        pickData: any;
    }): Promise<{
        score: string;
        confidence: number;
        feedback: string;
    }>;
    scoreProp(params: {
        propId: string;
        models: string[];
        options?: Record<string, unknown>;
    }): Promise<any>;
    validateScore(params: {
        propId: string;
        score: string;
        confidence: number;
        options?: Record<string, unknown>;
    }): Promise<any>;
    monitorScoring(params: {
        interval?: number;
        thresholds?: {
            confidence: number;
            quality: number;
        };
    }): Promise<any>;
    initialize(): Promise<any>;
    healthCheck(params: {
        components: string[];
        timeout?: number;
    }): Promise<any>;
    validateDependencies(): Promise<any>;
    protected initializeResources(): Promise<void>;
}
//# sourceMappingURL=activities.d.ts.map