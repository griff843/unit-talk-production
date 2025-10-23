import { SupabaseClient } from '@supabase/supabase-js';
import { RawProp } from './types';
/**
 * Check if a raw prop is a duplicate based on multiple criteria
 * @param prop - The prop to check for duplicates
 * @param supabase - Supabase client instance
 * @returns Promise<boolean> - True if duplicate exists
 */
export declare function isDuplicateRawProp(prop: RawProp, supabase: SupabaseClient): Promise<boolean>;
/**
 * Legacy function for backward compatibility
 * @deprecated Use isDuplicateRawProp with supabase parameter instead
 */
export declare function isDuplicateRawPropLegacy(_prop: RawProp): Promise<boolean>;
/**
 * Get duplicate props for analysis
 * @param prop - The prop to find duplicates for
 * @param supabase - Supabase client instance
 * @returns Promise<RawProp[]> - Array of duplicate props
 */
export declare function findDuplicateProps(prop: RawProp, supabase: SupabaseClient): Promise<RawProp[]>;
/**
 * Create a unique key for deduplication
 * @param prop - The prop to create a key for
 * @returns string - Unique key for the prop
 */
export declare function createDeduplicationKey(prop: RawProp): string;
//# sourceMappingURL=isDuplicate.d.ts.map