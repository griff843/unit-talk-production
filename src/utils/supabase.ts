import { createClient } from '@supabase/supabase-js';
import { getEnv } from './getEnv';

export function createSupabaseClient() {
  const env = getEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
} 