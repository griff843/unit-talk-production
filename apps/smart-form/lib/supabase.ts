import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';
import { createComponentLogger } from './logger';

const log = createComponentLogger('supabase');

// SPRINT-SCHEMA-ENV-GATES-002: Lazy env validation (defer to runtime)
function validateEnv(): { url: string; anonKey: string } {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

// Client-side Supabase client (read-only in production)
export const supabaseClient = (): SupabaseClient<Database> => {
  const { url, anonKey } = validateEnv();
  const isDev = process.env.NEXT_PUBLIC_DEV_DIRECT_DB === '1';

  if (!isDev && typeof window !== 'undefined') {
    log.warn('Client-side direct DB access disabled in production build');
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: {
      schema: 'public',
    },
  });
};

// Server-side Supabase client with service role key
export const supabaseServer = (): SupabaseClient<Database> => {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseServer() can only be called on the server side');
  }

  const { url } = validateEnv();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY for server operations');
  }

  return createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: {
      schema: 'public',
    },
  });
};

// SPRINT-SCHEMA-ENV-GATES-002: Lazy singleton for legacy export
let _supabaseSingleton: SupabaseClient<Database> | null = null;
function getSupabaseSingleton(): SupabaseClient<Database> {
  if (!_supabaseSingleton) {
    _supabaseSingleton = supabaseClient();
  }
  return _supabaseSingleton;
}

// Legacy export for backwards compatibility - use with caution
// Note: This is a getter that lazily initializes the client
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    return (getSupabaseSingleton() as any)[prop];
  },
});

// Test connection and tables
export async function testSupabaseConnection() {
  try {
    console.log('🔍 Testing Supabase connection...');
    console.log('🔍 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('🔍 Supabase Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    // Test basic connection with canonical users table (CAPPER-OS-INTEGRATION-001)
    const { data, error } = await supabase.from('users').select('count').limit(1).single();

    console.log('🔍 Connection test result:', { data, error });

    if (error) throw error;

    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
    return false;
  }
}

// Helper function to handle Supabase errors
export function handleSupabaseError(error: any) {
  console.error('Supabase error:', error);

  if (error.code === 'PGRST301') {
    return new Error('Database row level security policy violation');
  }

  if (error.code === 'PGRST204') {
    return new Error('No data found');
  }

  if (error.code === '42P01') {
    return new Error('Table not found - please check your database setup');
  }

  if (error.message.includes('JWT')) {
    return new Error('Authentication error - please check your API keys');
  }

  return new Error(error.message || 'An unexpected error occurred');
}

// Check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
