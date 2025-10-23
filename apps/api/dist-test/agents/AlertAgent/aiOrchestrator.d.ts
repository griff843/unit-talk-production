import { UnifiedPick } from '../../types/picks';
interface ModelConfig {
    id: string;
    name: string;
    provider: 'openai' | 'anthropic' | 'google';
    model: string;
    temperature: number;
    maxTokens: number;
    enabled: boolean;
    priority: number;
    performance: ModelPerformance;
    costPerToken: number;
    maxRequestsPerMinute: number;
}
interface ModelPerformance {
    accuracy: number;
    avgLatency: number;
    errorRate: number;
    lastUpdated: string;
    totalPredictions: number;
    correctPredictions: number;
    avgConfidence: number;
    successRate: number;
}
interface AIAdvice {
    advice: string;
    confidence: number;
    reasoning: string;
    model: string;
    temperature: number;
    processingTime: number;
    fallbackUsed: boolean;
    consensusScore?: number;
}
interface MarketContext {
    regime: 'bull' | 'bear' | 'sideways';
    volatility: number;
    sentiment: number;
    timeOfDay: string;
    dayOfWeek: string;
    marketPressure: number;
    lineMovement: number;
}
interface ConsensusAdvice {
    primaryAdvice: string;
    confidence: number;
    agreement: number;
    models: string[];
    reasoning: string[];
    conflictFlags: string[];
}
export declare class AIOrchestrator {
    private models;
    private openai;
    private performanceCache;
    private circuitBreaker;
    private requestCounts;
    constructor();
    private initializeModels;
    getAdviceForPick(pick: UnifiedPick, _context?: MarketContext): Promise<AIAdvice>;
    getConsensusAdvice(pick: UnifiedPick): Promise<ConsensusAdvice>;
    private selectOptimalModel;
    private calculateModelScore;
    getAvailableModels(): ModelConfig[];
    private checkRateLimit;
    private queryModel;
    private getSystemPrompt;
    private buildPrompt;
    private adjustTemperature;
    private parseAdviceResponse;
    private getFallbackAdvice;
    private aggregateResponses;
    private updateModelPerformance;
    getModelPerformance(): Promise<Map<string, ModelPerformance>>;
    getAvailableModelIds(): string[];
    updateModelConfig(modelId: string, updates: Partial<ModelConfig>): Promise<void>;
    resetCircuitBreaker(modelId: string): void;
    initialize(): Promise<void>;
    checkHealth(): Promise<boolean>;
    switchToBackupModel(primaryModelId: string): Promise<string>;
}
export {};
//# sourceMappingURL=aiOrchestrator.d.ts.map