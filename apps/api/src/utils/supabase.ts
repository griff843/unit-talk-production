import { createClient } from '@supabase/supabase-js';

import { getEnv } from './getEnv';

export function createSupabaseClient() {
  const env = getEnv();
  
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to create Supabase client');
  }
  
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
} 