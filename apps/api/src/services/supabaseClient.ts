import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

import { getEnv } from '../utils/getEnv';

const env = getEnv();

export const isSupabaseConfigured = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

let supabase: any = null;
if (isSupabaseConfigured) {
  supabase = createClient(
    env.SUPABASE_URL as string,
    env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

// Export with both names for compatibility
export { supabase };
export const supabaseClient = supabase;