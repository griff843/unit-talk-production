import { supabase } from '@/services/supabaseClient';
import { RawProp } from '../../types/rawProps';
import { logCoverage } from '../logCoverage';

/**
 * Filters out props with unique_keys that already exist in raw_props.
 * Returns only the deduplicated props safe to insert.
 */
export async function dedupePublicProps(props: RawProp[]): Promise<RawProp[]> {
  try {
    if (props.length === 0) return [];

    // Get all unique_keys from props
    const uniqueKeys = props.map(p => p.unique_key);

    // Query Supabase for existing keys
    const { data: existing, error } = await supabase
      .from('raw_props')
      .select('unique_key')
      .in('unique_key', uniqueKeys);

    if (error) throw error;

    const existingKeys = new Set(existing?.map(e => e.unique_key) || []);

    // Filter out duplicates
    const deduped = props.filter(p => !existingKeys.has(p.unique_key));
    return deduped;
  } catch (err) {
    await logCoverage('dedupePublicProps', {
      message: 'Error during deduplication',
      error: err instanceof Error ? err.message : err,
    });
    return [];
  }
}
