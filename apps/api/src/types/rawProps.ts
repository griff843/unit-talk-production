// src/types/rawProp.ts
// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Use canonical types from shared-types

import type { RawPropsRow } from '@unit-talk/shared-types';

/**
 * RawPropsRow - Canonical DB row type from shared-types
 */
export type { RawPropsRow };

/**
 * RawProp - Flexible type for internal prop handling
 * SPRINT-RUNTIME-TRUTH-008: Made flexible to accommodate different prop sources
 * The schema has diverged from legacy code - this type bridges the gap
 */
export interface RawProp {
  id: string;
  // Legacy fields used by FeedAgent
  player_name?: string;
  team?: string;
  opponent?: string;
  market?: string;
  line?: number;
  over?: number;
  under?: number;
  market_type?: string;
  game_time?: string;
  external_id?: string;
  external_game_id?: string;
  provider?: string;
  scraped_at?: string;
  matchup?: string;
  stat_type?: string;
  over_odds?: number;
  under_odds?: number;
  outcomes?: unknown[];
  is_valid?: boolean;
  // Allow additional properties
  [key: string]: unknown;
}

/**
 * Extended RawProp with additional runtime fields not in DB schema
 */
export interface ExtendedRawProp extends RawProp {
  label?: string;
  abbr?: string;
}
