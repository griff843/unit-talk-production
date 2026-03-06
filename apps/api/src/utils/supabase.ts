import { createSupabaseClientFromConfig } from '@unit-talk/data-access';

import { getEnv } from './getEnv';

// SPRINT-REPO-TRUTH-LOCK-002: Canonical factory from @unit-talk/data-access
export function createSupabaseClient() {
  const env = getEnv();
  return createSupabaseClientFromConfig({
    url: env.SUPABASE_URL,
    key: env.SUPABASE_SERVICE_ROLE_KEY,
    mode: 'service_role',
  });
}
