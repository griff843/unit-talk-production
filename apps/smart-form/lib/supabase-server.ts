import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

// SPRINT-BUILD-TIME-ISOLATION-111: Lazy initialization to prevent build-time throws
let _supabaseServerInstance: SupabaseClient<Database> | null = null;

/**
 * Get the server-side Supabase client (lazy initialized)
 * This function defers env validation to runtime, not build time.
 */
export function getSupabaseServer(): SupabaseClient<Database> {
  if (_supabaseServerInstance) {
    return _supabaseServerInstance;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!anonKey) {
    throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  _supabaseServerInstance = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: {
      schema: 'public',
    },
  });

  return _supabaseServerInstance;
}

// Legacy export for backwards compatibility - uses lazy getter
// SPRINT-BUILD-TIME-ISOLATION-111: Proxy pattern defers initialization to first access
export const supabaseServer = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    return (getSupabaseServer() as any)[prop];
  },
});
