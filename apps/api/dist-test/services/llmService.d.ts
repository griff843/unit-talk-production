interface LLMConfig {
    provider: 'openai' | 'anthropic';
    model: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
}
interface LLMRequest {
    messages: Array<{
        role: string;
        content: string;
    }>;
    config?: Partial<LLMConfig>;
    tokenEstimate?: number;
}
interface LLMResponse {
    content: string;
    model: string;
    provider: string;
    tokenUsage: {
        prompt: number;
        completion: number;
        total: number;
    };
    metadata: {
        latency: number;
        cost: number;
    };
}
export declare class LLMService {
    private static instance;
    private openai;
    private anthropic;
    private circuitBreaker;
    private readonly defaultConfig;
    private constructor();
    static getInstance(): LLMService;
    generateResponse(request: LLMRequest): Promise<LLMResponse>;
    private generateOpenAIResponse;
    private generateAnthropicResponse;
    private getFallbackResponse;
    private estimateTokens;
    private calculateOpenAICost;
    private calculateAnthropicCost;
}
export {};
//# sourceMappingURL=llmService.d.ts.map