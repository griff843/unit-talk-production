/**
 * Enhanced Redis Cache with fallback capabilities
 */
export declare class RedisEnhancedCache {
    private redis;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttl?: number): Promise<boolean>;
    del(key: string): Promise<boolean>;
    exists(key: string): Promise<boolean>;
    healthCheck(): Promise<boolean>;
    getConnectionStatus(): {
        redis: boolean;
        fallback: boolean;
        mode: string;
    };
    getStats(): Promise<any>;
    getPattern(pattern: string): Promise<Map<string, string>>;
    ping(): Promise<boolean>;
    cleanup(): Promise<void>;
}
/**
 * ML Prediction Cache for storing and retrieving ML predictions
 */
export declare class MLPredictionCache extends RedisEnhancedCache {
    private mlPrefix;
    getPrediction(key: string): Promise<any | null>;
    setPrediction(key: string, prediction: any, ttl?: number): Promise<boolean>;
    invalidatePrediction(key: string): Promise<boolean>;
}
export declare const redis: RedisEnhancedCache;
export declare const redisCache: RedisEnhancedCache;
export declare const mlPredictionCache: MLPredictionCache;
//# sourceMappingURL=enhanced-cache.d.ts.map