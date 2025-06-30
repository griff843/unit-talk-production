import { supabase } from '../services/supabaseClient';

export async function fetchEdgeConfig(): Promise<unknown> {
  const { data, error } = await supabase
    .from('edge_config')
    .select('config')
    .eq('key', 'default')
    .single();
  if (error || !data) throw new Error('Failed to fetch edge config');
  return data.config;
}
