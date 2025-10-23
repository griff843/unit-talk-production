import { Logger } from '../../shared/logger/types';
/**
 * 🧠 Adaptive Learning Engine
 * Analyzes user behavior patterns and adapts learning experiences in real-time
 * This is the intelligence that makes Unit Talk's onboarding superior to any other Discord
 */
export declare class AdaptiveLearningEngine {
    private logger;
    private behaviorPatterns;
    private adaptationStrategies;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    isHealthy(): Promise<boolean>;
    /**
     * Analyzes user behavior and recommends adaptations to their learning path
     */
    analyzeAndAdapt(userId: string, behaviorData: any): Promise<AdaptationRecommendation>;
    /**
     * Predicts user's learning preferences based on behavior
     */
    predictLearningPreferences(userId: string): Promise<LearningPreferences>;
    private initializeAdaptationStrategies;
    private loadBehaviorPatterns;
    private initializeMLModels;
    private createNewPattern;
    private updateBehaviorPattern;
    private identifyAdaptations;
    private evaluateTrigger;
    private generateAdaptationRecommendation;
    private predictInteractionType;
    private predictSessionLength;
    private predictOptimalTime;
    private predictDifficultyLevel;
    private identifyMotivationalFactors;
    private identifyLearningStyle;
    private getDefaultPreferences;
    private calculateAverageComplexity;
    cleanup(): Promise<void>;
}
export interface BehaviorPattern {
    userId: string;
    totalInteractions: number;
    reactionRate: number;
    messageComplexity: number;
    sessionLengths: number[];
    activeHours: number[];
    commandUsage: Record<string, number>;
    engagementQuality: number;
    learningVelocity: number;
    strugglingAreas: string[];
    preferredContent: string[];
    lastUpdated: string;
}
export interface AdaptationStrategy {
    id: string;
    name: string;
    triggers: string[];
    adaptations: string[];
    effectiveness: number;
}
export interface AdaptationRecommendation {
    type: 'adaptation' | 'no_change' | 'escalation';
    confidence: number;
    reasoning: string;
    actions: AdaptationAction[];
}
export interface AdaptationAction {
    action: string;
    priority: 'low' | 'medium' | 'high';
    expectedImpact: number;
}
export interface LearningPreferences {
    preferredInteractionType: 'reactions' | 'text' | 'buttons' | 'mixed';
    optimalSessionLength: number;
    bestTimeOfDay: string[];
    difficultyPreference: 'easy' | 'medium' | 'hard';
    motivationalFactors: string[];
    learningStyle: 'visual' | 'analytical' | 'hands-on' | 'social';
}
//# sourceMappingURL=adaptiveLearningEngine.d.ts.map