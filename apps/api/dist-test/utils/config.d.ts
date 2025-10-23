import { z } from 'zod';
import 'dotenv/config';
import { AgentConfig } from '../types/agent';
declare const EnvConfigSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodString>;
    PORT: z.ZodDefault<z.ZodString>;
    DATABASE_URL: z.ZodString;
    SUPABASE_URL: z.ZodString;
    SUPABASE_ANON_KEY: z.ZodString;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: string;
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    DATABASE_URL: string;
    PORT: string;
}, {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    DATABASE_URL: string;
    NODE_ENV?: string | undefined;
    PORT?: string | undefined;
}>;
export declare class ConfigLoader {
    private static instance;
    private envConfig;
    private agentConfigs;
    private constructor();
    static getInstance(): ConfigLoader;
    private loadEnvConfig;
    loadAgentConfig<T extends z.ZodType>(agentName: string, schema: T): Promise<z.infer<T>>;
    getEnvConfig(): z.infer<typeof EnvConfigSchema>;
    reloadConfig(agentName?: string): Promise<void>;
}
export declare function validateBaseConfig(config: unknown): AgentConfig;
export declare function validateHealthCheckInterval(config: AgentConfig): void;
export declare function validateMetricsConfig(config: AgentConfig): void;
export {};
//# sourceMappingURL=config.d.ts.map