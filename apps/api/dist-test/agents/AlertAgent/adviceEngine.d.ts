interface PickPayload {
    id: string;
    player_name: string;
    market_type: string;
    line: number;
    odds: number;
    is_sharp_fade?: boolean;
    tier?: string;
    edge_score?: number;
}
export declare class AdviceEngine {
    private cache;
    private readonly CACHE_HIT_METRICS;
    constructor();
    getAdviceForPick(pick: PickPayload): Promise<string>;
    private buildAdvicePrompt;
    private formatAdvice;
    private getFallbackAdvice;
    private getQuotaErrorFallbackAdvice;
    getCacheStats(): {
        size: number;
        hitRate: number;
        hits: number;
        misses: number;
        total: number;
    };
    clearCache(): void;
    getModelPerformance(): Promise<Map<string, any>>;
    getCircuitStatus(): any;
    getUsageMetrics(): any;
}
export declare const adviceEngine: AdviceEngine;
export declare function getAdviceForPick(pick: PickPayload): Promise<string>;
export {};
//# sourceMappingURL=adviceEngine.d.ts.map