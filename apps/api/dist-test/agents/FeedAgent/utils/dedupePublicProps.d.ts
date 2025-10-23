import { SupabaseClient } from '@supabase/supabase-js';
import { RawProp } from '../../../types/rawProps';
import { Provider } from '../types';
/**
 * Deduplicate RawProp[] against existing unique_keys in raw_props table.
 * Handles large arrays safely and logs results.
 * @param props - Array of normalized RawProp objects to check
 * @param provider - Provider name for logging
 * @param supabase - Supabase client instance
 * @returns - Deduped array ready for DB insert
 */
export declare function dedupePublicProps(props: RawProp[], provider: Provider, supabase: SupabaseClient): Promise<RawProp[]>;
//# sourceMappingURL=dedupePublicProps.d.ts.map