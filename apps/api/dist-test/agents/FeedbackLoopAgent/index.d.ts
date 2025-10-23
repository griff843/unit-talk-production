import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics, HealthStatus } from '../BaseAgent/types';
interface FeedbackItem {
    id: string;
    type: 'pick_outcome' | 'user_rating' | 'system_performance' | 'model_accuracy';
    source: string;
    data: Record<string, any>;
    priority: 'low' | 'medium' | 'high' | 'critical';
    timestamp: string;
    processed: boolean;
}
/**
 * Production-grade FeedbackLoopAgent for continuous learning and system optimization
 * Processes feedback from various sources to improve AI models and system performance
 */
export declare class FeedbackLoopAgent extends BaseAgent {
    private aiOrchestrator;
    private feedbackQueue;
    private learningInsights;
    private adaptationRules;
    private processingStats;
    constructor(config: BaseAgentConfig, deps: BaseAgentDependencies);
    protected initialize(): Promise<void>;
    protected process(): Promise<void>;
    protected cleanup(): Promise<void>;
    protected collectMetrics(): Promise<BaseMetrics>;
    checkHealth(): Promise<HealthStatus>;
    submitFeedback(feedback: Omit<FeedbackItem, 'id' | 'timestamp' | 'processed'>): Promise<void>;
    private loadHistoricalData;
    private loadAdaptationRules;
    private collectFeedback;
    private collectPickOutcomeFeedback;
    private collectUserRatingFeedback;
    private collectSystemPerformanceFeedback;
    private collectModelAccuracyFeedback;
    private processPendingFeedback;
    private processFeedbackItem;
    private analyzeFeedback;
    private analyzePickOutcome;
    private analyzeModelAccuracy;
    private analyzeSystemPerformance;
    private analyzeUserRating;
    private analyzePerformancePatterns;
    private adaptAIModels;
    private optimizeSystemParameters;
    private generateImprovementRecommendations;
    private triggerAdaptationRules;
    private evaluateRuleCondition;
    private applyAdaptationRule;
    private applyModelAdaptation;
    private calculateModelAccuracy;
    private saveFeedbackItem;
    private saveRecommendations;
    private saveState;
}
export default FeedbackLoopAgent;
//# sourceMappingURL=index.d.ts.map