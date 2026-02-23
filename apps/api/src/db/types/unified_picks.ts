// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Use canonical types from shared-types

import type {
  Database,
  UnifiedPicksRow,
  TablesInsert,
  TablesUpdate,
} from '@unit-talk/shared-types';

/**
 * UnifiedPick - Re-exported from shared-types canonical definitions
 */
export type { UnifiedPicksRow, UnifiedPick } from '@unit-talk/shared-types';

// Alias for backward compatibility
export type UnifiedPickInsert = Omit<UnifiedPicksRow, 'id' | 'created_at' | 'updated_at'>;
export type UnifiedPickUpdate = Partial<UnifiedPickInsert>;

// Database helper types
export type UnifiedPicksResponse = Database['public']['Tables']['unified_picks']['Row'];
export type UnifiedPicksInsert = TablesInsert<'unified_picks'>;
export type UnifiedPicksUpdate = TablesUpdate<'unified_picks'>;
