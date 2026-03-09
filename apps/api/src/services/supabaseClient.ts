import 'dotenv/config';

import { createSupabaseClientFromConfig } from '@unit-talk/data-access';

import { getEnv } from '../utils/getEnv';

const env = getEnv();

// SPRINT-REPO-TRUTH-LOCK-002: Canonical factory from @unit-talk/data-access
export const supabase = createSupabaseClientFromConfig({
  url: env.SUPABASE_URL,
  key: env.SUPABASE_SERVICE_ROLE_KEY,
  mode: 'service_role',
});

// Export with both names for compatibility
export const supabaseClient = supabase;
