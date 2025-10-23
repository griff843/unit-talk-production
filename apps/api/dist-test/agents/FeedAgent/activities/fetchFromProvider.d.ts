import { Provider } from '../types';
export interface FetchProviderInput {
    provider: Provider;
    baseUrl: string;
    apiKey: string;
    timestamp: string;
}
export interface FetchResult {
    success: boolean;
    data?: any[];
    error?: string;
    latencyMs: number;
    timestamp: string;
    statusCode?: number;
    responseText?: string;
}
export declare function fetchFromProviderActivity(input: FetchProviderInput): Promise<FetchResult>;
//# sourceMappingURL=fetchFromProvider.d.ts.map