// src/types/rawProp.ts
// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Use canonical types from shared-types

import type { RawPropsRow } from '@unit-talk/shared-types';

/**
 * RawProp - Re-exported from shared-types
 * Use RawPropsRow for strict DB row typing, or RawProp for flexibility
 */
export type { RawPropsRow, RawProp } from '@unit-talk/shared-types';

/**
 * Extended RawProp with additional runtime fields not in DB schema
 * SPRINT-DB-TYPE-ALLOWLIST-BURN-004: outcomes now in RawPropsRow
 */
export interface ExtendedRawProp extends RawPropsRow {
  // Optimal-specific fields not in DB
  label?: string;
  abbr?: string;
  [key: string]: unknown; // For flexibility (extra fields as needed)
}
