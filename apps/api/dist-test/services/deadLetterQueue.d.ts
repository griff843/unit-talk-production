import { EventEmitter } from 'events';
import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
export declare const DeadLetterSchema: z.ZodObject<{
    id: z.ZodString;
    agent: z.ZodString;
    operation: z.ZodString;
    payload: z.ZodUnknown;
    error: z.ZodObject<{
        message: z.ZodString;
        stack: z.ZodOptional<z.ZodString>;
        code: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        code?: string | undefined;
        stack?: string | undefined;
    }, {
        message: string;
        code?: string | undefined;
        stack?: string | undefined;
    }>;
    retry_count: z.ZodNumber;
    max_retries: z.ZodNumber;
    next_retry: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<["pending", "retrying", "failed", "resolved"]>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    error: {
        message: string;
        code?: string | undefined;
        stack?: string | undefined;
    };
    status: "failed" | "pending" | "resolved" | "retrying";
    operation: string;
    agent: string;
    created_at: string;
    id: string;
    updated_at: string;
    retry_count: number;
    max_retries: number;
    payload?: unknown;
    next_retry?: string | undefined;
}, {
    error: {
        message: string;
        code?: string | undefined;
        stack?: string | undefined;
    };
    status: "failed" | "pending" | "resolved" | "retrying";
    operation: string;
    agent: string;
    created_at: string;
    id: string;
    updated_at: string;
    retry_count: number;
    max_retries: number;
    payload?: unknown;
    next_retry?: string | undefined;
}>;
export type DeadLetter = z.infer<typeof DeadLetterSchema>;
export interface DLQConfig {
    maxRetries: number;
    initialRetryDelayMs: number;
    maxRetryDelayMs: number;
    processingIntervalMs: number;
}
export declare class DeadLetterQueue extends EventEmitter {
    private readonly supabase;
    private readonly config;
    private static instance;
    private readonly logger;
    private processingInterval?;
    private constructor();
    static getInstance(supabase: SupabaseClient, config: DLQConfig): DeadLetterQueue;
    initialize(): Promise<void>;
    enqueue(agent: string, operation: string, payload: unknown, error: Error): Promise<void>;
    private setupProcessing;
    private processQueue;
    private processDeadLetter;
    private replayOperation;
    private calculateNextRetry;
    shutdown(): Promise<void>;
}
export declare const dlq: DeadLetterQueue;
//# sourceMappingURL=deadLetterQueue.d.ts.map