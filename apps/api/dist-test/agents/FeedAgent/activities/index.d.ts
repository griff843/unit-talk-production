import { RawProp } from '../../../types/rawProps';
interface CircuitBreakerState {
    failures: number;
    lastFailureTime: number;
    isOpen: boolean;
}
interface ProviderHealth {
    provider: string;
    lastSuccess: Date | null;
    status: 'healthy' | 'degraded' | 'failed';
    consecutiveFailures: number;
    lastError?: string;
}
export declare function getProviderHealth(): {
    providers: Record<string, ProviderHealth>;
    circuitBreakers: Record<string, CircuitBreakerState>;
};
export declare function fetchFromProviderActivity(provider: string): Promise<RawProp[]>;
export declare function ingestUnifiedData(params: {
    league: string;
    batchSize: number;
    timeout: number;
    includeSettlement?: boolean;
}): Promise<{
    success: boolean;
    count: number;
    source: string;
    error?: string;
    propCount?: number;
    batchId?: string;
}>;
export declare const activities: import("@temporalio/workflow").ActivityInterfaceFor<import("@temporalio/workflow").UntypedActivities>;
export declare function fetchFeed(params: {
    league: string;
    isPeakTime?: boolean;
    timestamp?: string;
}): Promise<{
    success: boolean;
    message: string;
    data?: any;
}>;
export declare function checkQuotaStatus(params: {
    provider: string;
}): Promise<{
    success: boolean;
    usage?: any;
    error?: string;
}>;
export declare function getLiveGames(): Promise<{
    success: boolean;
    games: any[];
    error?: string;
}>;
export {};
//# sourceMappingURL=index.d.ts.map