import { supabase } from '../../services/supabaseClient';
import { RawProp } from './ingestion.types';

// Deduplication by external_id + stat_type + game_id (adjust as needed)
export async function isDuplicateRawProp(prop: RawProp): Promise<boolean> {
  const { data, error } = await supabase
    .from('raw_props')
    .select('id')
    .eq('external_id', prop.external_id)
    .eq('stat_type', prop.stat_type)
    .eq('game_id', prop.game_id)
    .maybeSingle();

  return !!data;
}
