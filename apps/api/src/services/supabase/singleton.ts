import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../../utils/getEnv';
import type { Database } from '../../types/database-override';

const env = getEnv();

export const isSupabaseConfigured = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

let supabase: SupabaseClient<Database> | null = null;
if (isSupabaseConfigured) {
  supabase = createClient<Database>(env.SUPABASE_URL as string, env.SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export { supabase };
export const supabaseClient = supabase;

