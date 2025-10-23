import { z } from 'zod';
declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    TEMPORAL_TASK_QUEUE: z.ZodDefault<z.ZodString>;
    TEMPORAL_SERVER_URL: z.ZodDefault<z.ZodString>;
    SUPABASE_URL: z.ZodDefault<z.ZodString>;
    SUPABASE_SERVICE_ROLE_KEY: z.ZodDefault<z.ZodString>;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<["error", "warn", "info", "debug"]>>;
    METRICS_ENABLED: z.ZodDefault<z.ZodBoolean>;
    HEALTH_CHECK_INTERVAL: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    LOG_LEVEL: "error" | "warn" | "info" | "debug";
    NODE_ENV: "development" | "production" | "test";
    TEMPORAL_TASK_QUEUE: string;
    TEMPORAL_SERVER_URL: string;
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    METRICS_ENABLED: boolean;
    HEALTH_CHECK_INTERVAL: number;
}, {
    LOG_LEVEL?: "error" | "warn" | "info" | "debug" | undefined;
    NODE_ENV?: "development" | "production" | "test" | undefined;
    TEMPORAL_TASK_QUEUE?: string | undefined;
    TEMPORAL_SERVER_URL?: string | undefined;
    SUPABASE_URL?: string | undefined;
    SUPABASE_SERVICE_ROLE_KEY?: string | undefined;
    METRICS_ENABLED?: boolean | undefined;
    HEALTH_CHECK_INTERVAL?: number | undefined;
}>;
export type Env = z.infer<typeof envSchema>;
export declare function getEnv(): Env;
export {};
//# sourceMappingURL=getEnv.d.ts.map