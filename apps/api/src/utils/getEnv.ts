// /utils/getEnv.ts

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TEMPORAL_TASK_QUEUE: z.string().default('unit-talk-main'),
  TEMPORAL_SERVER_URL: z.string().default('localhost:7233'),
  // Force production Supabase values to fix FeedAgent database connection
  SUPABASE_URL: z.string().url().default('https://lxqmuzmqtnnlpfapvief.supabase.co'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  METRICS_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000)
});

export type Env = z.infer<typeof envSchema>;

/* eslint-disable consistent-return */
export function getEnv(): Env {
  try {
    // Force production Supabase credentials to fix FeedAgent database connection
    const envWithOverrides = {
      ...process.env,
      SUPABASE_URL: 'https://lxqmuzmqtnnlpfapvief.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'
    };

    return envSchema.parse(envWithOverrides);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // eslint-disable-next-line no-console
      console.error('❌ Invalid environment variables:');
      for (const issue of error.issues) {
        // eslint-disable-next-line no-console
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      }
    } else {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to validate environment variables:', error);
    }
    process.exit(1);
  }
}