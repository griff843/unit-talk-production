interface TokenUsageParams {
    prompt?: string;
    completion?: string;
    messages?: Array<{
        role: string;
        content: string;
    }>;
}
export declare class OpenAICostGuard {
    private static instance;
    private constructor();
    static getInstance(): OpenAICostGuard;
    estimateTokenUsage(params: TokenUsageParams): number;
    private countTokens;
    calculateCost(params: TokenUsageParams, model?: string): number;
}
export {};
//# sourceMappingURL=openaiCostGuard.d.ts.map