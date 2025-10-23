/**
 * Production Redis Service with Fallback
 * Works with or without Redis server
 */
export declare class ProductionRedisService {
    private static instance;
    private memoryCache;
    private isRedisAvailable;
    private redis;
    private constructor();
    static getInstance(): ProductionRedisService;
    private initializeRedis;
    healthCheck(): Promise<boolean>;
    set(key: string, value: string, ttl?: number): Promise<void>;
    get(key: string): Promise<string | null>;
    del(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    getConnectionStatus(): {
        redis: boolean;
        fallback: boolean;
        mode: string;
    };
    getStats(): Promise<any>;
    private extractInfo;
    cleanup(): Promise<void>;
    disconnect(): Promise<void>;
}
export declare const productionRedis: ProductionRedisService;
//# sourceMappingURL=productionRedis.d.ts.map