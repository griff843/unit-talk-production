// /utils/getEnv.ts

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TEMPORAL_TASK_QUEUE: z.string().default('unit-talk-main'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  METRICS_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000)
});

export type Env = z.infer<typeof envSchema>;

/* eslint-disable consistent-return */
export function getEnv(): Env {
  try {
    return envSchema.parse(process.env);
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