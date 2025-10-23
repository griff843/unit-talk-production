import { SupabaseClient } from '@supabase/supabase-js';
export declare function withRetry<T>(operation: () => Promise<T>, maxAttempts?: number, context?: string): Promise<T>;
export declare function withTransaction<T>(supabase: SupabaseClient, operations: (client: SupabaseClient) => Promise<T>): Promise<T>;
export declare function logFailedPick(supabase: SupabaseClient, pickId: string, error: Error): Promise<void>;
//# sourceMappingURL=retryOperations.d.ts.map