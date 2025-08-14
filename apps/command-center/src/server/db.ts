import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Singleton Supabase admin client for server-side operations
let adminClient: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (!env) {
    throw new Error('Database configuration not available. Check environment variables.');
  }

  if (!adminClient) {
    adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}

// Export as admin for backward compatibility
export const admin = getAdminClient;

// Helper to execute database operations with error handling
export async function withDatabase<T>(
  operation: (client: ReturnType<typeof createClient>) => Promise<T>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const client = getAdminClient();
    const data = await operation(client);
    return { data, error: null };
  } catch (error) {
    console.error('Database operation failed:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

// Database health check
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const start = Date.now();
  
  try {
    const client = getAdminClient();
    await client.from('agent_health').select('count').limit(1).single();
    
    return {
      healthy: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}