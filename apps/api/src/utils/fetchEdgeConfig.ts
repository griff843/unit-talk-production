import { requireSupabase } from './supabaseUtils';

export async function fetchEdgeConfig(): Promise<unknown> {
  const supabaseClient = requireSupabase();

  const { data, error } = await supabaseClient
    .from('edge_config')
    .select('config')
    .eq('key', 'default')
    .single();

  if (error || !data) {
    throw new Error('Failed to fetch edge config');
  }

  return data.config;
}
