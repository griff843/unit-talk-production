import { SupabaseClient } from '@supabase/supabase-js';
import { RawProp } from '../../../types/rawProps';

/**
 * Filters out props with unique_keys that already exist in raw_props.
 * Returns only the deduplicated props safe to insert.
 */
export async function dedupePublicProps(props: RawProp[], supabase?: SupabaseClient): Promise<RawProp[]> {
  try {
    if (props.length === 0) return [];

    // If no supabase client provided, return props as-is (for testing or edge cases)
    if (!supabase) {
      return props;
    }

    // Get all external_ids from props that have them
    const externalIds = props.map(p => p.external_id).filter(Boolean) as string[];
    
    if (externalIds.length === 0) {
      return props;
    }

    // Query Supabase for existing external_ids
    const { data: existing, error } = await supabase
      .from('raw_props')
      .select('external_id')
      .in('external_id', externalIds);

    if (error) throw error;

    const existingIds = new Set(existing?.map(e => e.external_id) || []);

    // Filter out duplicates
    const deduped = props.filter(p => !p.external_id || !existingIds.has(p.external_id));
    return deduped;
  } catch (err) {
    console.warn('Error during deduplication', {
      error: err instanceof Error ? err.message : err,
      propsCount: props.length
    });
    return [];
  }
}
