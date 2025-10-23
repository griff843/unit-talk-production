interface ChatCompletionParams {
    model: string;
    messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
    }>;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
}
export declare const openaiClient: {
    createClient: () => {
        chat: {
            completions: {
                create: (params: ChatCompletionParams) => Promise<{}>;
            };
        };
    };
};
export declare const openai: {
    chat: {
        completions: {
            create: (params: ChatCompletionParams) => Promise<{}>;
        };
    };
};
export declare function getOpenAICircuitStatus(): {
    state: 'OPEN' | 'CLOSED' | 'HALF_OPEN';
    metrics: {
        dailyTokens: number;
        dailyTokenLimit: number;
    };
    config: {
        dailyTokenQuota: number;
    };
};
export declare function getOpenAIUsageMetrics(): Record<string, number>;
export {};
//# sourceMappingURL=openaiClient.d.ts.map