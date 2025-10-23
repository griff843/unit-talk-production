/**
 * AI Model Routing and Cost Control System
 * Provides intelligent model selection for different AI use cases with cost optimization
 */
export interface AIModelConfig {
    name: string;
    provider: 'openai' | 'anthropic' | 'moonshot' | 'other';
    costPerToken: number;
    maxTokens: number;
    quality: 'basic' | 'good' | 'premium' | 'elite';
    latency: 'fast' | 'medium' | 'slow';
}
export interface AIRequest {
    type: 'advice' | 'recap' | 'formatting';
    prompt: string;
    context?: Record<string, any>;
    metadata?: {
        propId?: string;
        odds?: number;
        line?: number;
        isMVP?: boolean;
    };
}
export interface AIResponse {
    content: string;
    model: string;
    provider: string;
    tokenCount: number;
    cost: number;
    cached: boolean;
    processingTime: number;
    quality: string;
}
export interface AIModelCallMetrics {
    model: string;
    provider: string;
    callCount: number;
    totalTokens: number;
    totalCost: number;
    averageLatency: number;
    successRate: number;
    lastUsed: Date;
}
declare class AIModelRouter {
    private static instance;
    private callMetrics;
    private readonly MODEL_CONFIGS;
    private readonly ROUTING_RULES;
    private constructor();
    static getInstance(): AIModelRouter;
    /**
     * Route AI request to optimal model based on type and context
     */
    routeRequest(request: AIRequest): string;
    /**
     * Route advice requests with MVP logic
     */
    private routeAdviceRequest;
    /**
     * Route recap requests (always kimi-k2 for cost efficiency)
     */
    private routeRecapRequest;
    /**
     * Route formatting requests (simple formatting = cheap model)
     */
    private routeFormattingRequest;
    /**
     * Get fallback model for request type
     */
    getFallbackModel(requestType: string): string;
    /**
     * Execute AI request with model routing and fallback
     */
    executeRequest(request: AIRequest): Promise<AIResponse>;
    /**
     * Call specific AI model
     */
    private callModel;
    /**
     * Simulate model API call (replace with actual implementations)
     */
    private simulateModelCall;
    /**
     * Generate advice response based on model quality
     */
    private generateAdviceResponse;
    /**
     * Generate recap response
     */
    private generateRecapResponse;
    /**
     * Generate formatting response
     */
    private generateFormattingResponse;
    /**
     * Update model call metrics
     */
    private updateMetrics;
    /**
     * Get model call metrics
     */
    getMetrics(): AIModelCallMetrics[];
    /**
     * Get cache hit rate and cost savings
     */
    getCostAnalysis(): {
        totalCalls: number;
        totalCost: number;
        totalTokens: number;
        averageCostPerCall: number;
        modelBreakdown: Record<string, {
            calls: number;
            cost: number;
            percentage: number;
        }>;
    };
    /**
     * Generate context hash for caching
     */
    generateContextHash(context: Record<string, any>): string;
    /**
     * Calculate basis points difference between odds
     */
    calculateOddsBpsDifference(currentOdds: number, lastOdds: number): number;
    /**
     * Check if re-query is needed based on odds movement
     */
    shouldRequery(currentOdds: number, lastOdds: number, contextHash: string, lastContextHash: string): boolean;
    /**
     * Initialize metrics tracking
     */
    private initializeMetrics;
    /**
     * Log metrics for monitoring
     */
    logMetrics(): void;
}
export declare const aiModelRouter: AIModelRouter;
export {};
//# sourceMappingURL=routing.d.ts.map