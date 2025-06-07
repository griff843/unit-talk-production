// src/agents/FeedAgent/utils/dedupePublicProps.ts
import { RawProp } from '../../../types/rawProps';
import { logCoverage } from '../logCoverage';
import { Provider } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

const CHUNK_SIZE = 999; // Supabase .in() limit; keep <1000 for safety

/**
 * Deduplicate RawProp[] against existing unique_keys in raw_props table.
 * Handles large arrays safely and logs results.
 * @param props - Array of normalized RawProp objects to check
 * @param provider - Provider name for logging
 * @param supabase - Supabase client instance
 * @returns - Deduped array ready for DB insert
 */
export async function dedupePublicProps(
  props: RawProp[],
  provider: Provider,
  supabase: SupabaseClient
): Promise<RawProp[]> {
  try {
    if (props.length === 0) return [];

    // Chunk keys if needed (to avoid .in() limits)
    const uniqueKeys = props.map(p => p.external_id).filter(Boolean) as string[];
    const existingKeys = new Set<string>();

    for (let i = 0; i < uniqueKeys.length; i += CHUNK_SIZE) {
      const chunk = uniqueKeys.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabase
        .from('raw_props')
        .select('external_id')
        .in('external_id', chunk);

      if (error) {
        await logCoverage({
          provider,
          data: { chunk, error: error.message },
          timestamp: new Date().toISOString()
        }, supabase);
        // Optionally: continue instead of breaking (if partial dedupe is OK)
        throw error;
      }
      data?.forEach(e => existingKeys.add(e.external_id));
    }

    const deduped = props.filter(p => !existingKeys.has(p.external_id ?? ''));
    if (deduped.length !== props.length) {
      await logCoverage({
        provider,
        data: {
          originalCount: props.length,
          dedupedCount: deduped.length,
          filtered: props.length - deduped.length
        },
        timestamp: new Date().toISOString()
      }, supabase);
    }

    return deduped;
  } catch (err) {
    await logCoverage({
      provider,
      data: {
        error: err instanceof Error ? err.message : String(err)
      },
      timestamp: new Date().toISOString()
    }, supabase);
    return [];
  }
}
