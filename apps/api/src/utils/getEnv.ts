// /utils/getEnv.ts
//
// PHASE_9A_ENFORCEMENT_ACTIVATION: This module provides secondary env validation
// for backwards compatibility. The primary enforcement is in lib/enforcement/fail-closed-boot.ts

import { z } from 'zod';

const envSchema = z.object({
  // PHASE_9A: ENV_IDENTITY is the authoritative environment identifier
  ENV_IDENTITY: z.enum(['dev', 'staging', 'prod']).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  // PHASE_9A: ROLLOUT_MODE for rollout canon enforcement
  ROLLOUT_MODE: z.enum(['DORMANT', 'SHADOW', 'CANARY', 'ENFORCED', 'LOCKED']).optional(),
  TEMPORAL_TASK_QUEUE: z.string().default('unit-talk-main'),
  TEMPORAL_SERVER_URL: z.string().default('localhost:7233'),
  TEMPORAL_UI_URL: z.string().default('http://localhost:8080'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  METRICS_ENABLED: z.coerce.boolean().default(true),
  HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000),
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
