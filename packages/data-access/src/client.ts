/**
 * Canonical Supabase Client Factory
 * SPRINT-REPO-TRUTH-LOCK-002
 *
 * Single factory for creating typed Supabase clients across all apps.
 * Eliminates the 4 different client patterns currently scattered across the monorepo.
 *
 * Usage:
 * ```typescript
 * import { createSupabaseClient } from '@unit-talk/data-access';
 *
 * const client = createSupabaseClient({
 *   url: process.env.SUPABASE_URL,
 *   key: process.env.SUPABASE_SERVICE_ROLE_KEY,
 *   mode: 'service_role',
 * });
 * ```
 */

import { createClient } from '@supabase/supabase-js';

import type { SupabaseClientConfig } from './types';

/**
 * Create a Supabase client with the given configuration.
 *
 * This is the canonical client factory. All apps should use this
 * instead of calling `createClient` from `@supabase/supabase-js` directly.
 */
export function createSupabaseClientFromConfig(config: SupabaseClientConfig) {
  return createClient(config.url, config.key, {
    db: {
      schema: config.schema ?? 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: config.realtime ? 10 : 0,
      },
    },
    auth: {
      persistSession: config.mode === 'user',
      autoRefreshToken: config.mode === 'user',
    },
  });
}
