"use strict";
// /utils/getEnv.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnv = getEnv;
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    TEMPORAL_TASK_QUEUE: zod_1.z.string().default('unit-talk-main'),
    TEMPORAL_SERVER_URL: zod_1.z.string().default('localhost:7233'),
    // Force production Supabase values to fix FeedAgent database connection
    SUPABASE_URL: zod_1.z.string().url().default('https://lxqmuzmqtnnlpfapvief.supabase.co'),
    SUPABASE_SERVICE_ROLE_KEY: zod_1.z.string().min(1).default('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'),
    LOG_LEVEL: zod_1.z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    METRICS_ENABLED: zod_1.z.coerce.boolean().default(true),
    HEALTH_CHECK_INTERVAL: zod_1.z.coerce.number().default(30000)
});
/* eslint-disable consistent-return */
function getEnv() {
    try {
        // Force production Supabase credentials to fix FeedAgent database connection
        const envWithOverrides = {
            ...process.env,
            SUPABASE_URL: 'https://lxqmuzmqtnnlpfapvief.supabase.co',
            SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'
        };
        return envSchema.parse(envWithOverrides);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            // eslint-disable-next-line no-console
            console.error('❌ Invalid environment variables:');
            for (const issue of error.issues) {
                // eslint-disable-next-line no-console
                console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
            }
        }
        else {
            // eslint-disable-next-line no-console
            console.error('❌ Failed to validate environment variables:', error);
        }
        process.exit(1);
    }
}
