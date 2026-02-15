/**
 * metadata-helpers.ts
 *
 * Centralized helper for mapping canonical DB rows to the { value, label, ... }
 * shape consumed by Smart Form dropdowns/comboboxes.
 *
 * All metadata endpoints (cappers, teams, players) MUST use these mappers so
 * the UI never renders raw IDs as labels.
 */

import { randomUUID } from 'crypto';

// ---------- Shared types ----------

export interface MetadataOption {
  value: string;
  label: string;
}

export interface TeamOption extends MetadataOption {
  abbreviation: string;
  sport: string;
  team_uuid: string; // ID-ALIGNMENT-001: UUID for FK resolution in unified_picks
}

export interface PlayerOption extends MetadataOption {
  team_id: string;
  // DB-SOURCE-OF-TRUTH-AUDIT-001: Include team_abbr for scoping
  // players.team_abbr is populated; players.team_id (UUID) is often NULL
  team_abbr: string;
  sport: string;
}

export interface CapperOption extends MetadataOption {
  active: boolean;
  tier: string;
  discordId: string | null;
}

// ---------- Row → Option mappers ----------

/**
 * Map a canonical `teams` row to a TeamOption.
 *
 * DB columns: id, name, abbr, sport, team_uuid
 * ID-ALIGNMENT-001: Include team_uuid for UUID FK resolution
 */
export function toTeamOption(row: Record<string, unknown>): TeamOption {
  return {
    value: String(row.id ?? ''),
    label: String(row.name ?? ''),
    abbreviation: String(row.abbr ?? ''),
    sport: String(row.sport ?? ''),
    team_uuid: String(row.team_uuid ?? ''),
  };
}

/**
 * Map a canonical `players` row to a PlayerOption.
 *
 * DB columns: id, full_name, team_id, team_abbr, sport, active, position
 * ID-ALIGNMENT-001: Cloud column is full_name, not name
 * DB-SOURCE-OF-TRUTH-AUDIT-001: Include team_abbr for scoping
 */
export function toPlayerOption(row: Record<string, unknown>): PlayerOption {
  return {
    value: String(row.id ?? ''),
    label: String(row.full_name ?? row.name ?? ''),
    team_id: String(row.team_id ?? ''),
    team_abbr: String(row.team_abbr ?? ''),
    sport: String(row.sport ?? row.league ?? ''),
  };
}

/**
 * Map a canonical `users` (capper) row to a CapperOption.
 */
export function toCapperOption(row: Record<string, unknown>): CapperOption {
  return {
    value: String(row.id ?? ''),
    label: String(row.username ?? row.name ?? ''),
    active: Boolean(row.active),
    tier: String(row.tier ?? row.capper_tier ?? 'VIP'),
    discordId: row.discord_id ? String(row.discord_id) : null,
  };
}

// ---------- Fail-closed error response builder ----------

export interface MetadataErrorBody {
  error: string;
  message: string;
  code: string;
  trace_id: string;
}

/**
 * Build a standard fail-closed error body.
 * Code should be one of: TEAMS_METADATA_UNAVAILABLE, PLAYERS_METADATA_UNAVAILABLE, etc.
 */
export function metadataError(
  code: string,
  message: string,
): MetadataErrorBody {
  return {
    error: 'Metadata unavailable',
    message,
    code,
    trace_id: randomUUID(),
  };
}

// ---------- Schema validation ----------

/**
 * Validate that the first row of a result set contains an expected boolean column.
 * Returns an error string if validation fails, or null if OK.
 */
export function validateBooleanColumn(
  data: Record<string, unknown>[] | null,
  column: string,
): string | null {
  if (!data || data.length === 0) return null; // empty set — caller decides if that's an error
  if (typeof data[0][column] !== 'boolean') {
    return `SCHEMA VIOLATION: ${column} column missing or not boolean (got ${typeof data[0][column]})`;
  }
  return null;
}

// ---------- Known-sport zero-row gate ----------

const EXPECTED_TEAM_SPORTS = new Set([
  'NFL', 'NBA', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'WNBA', 'Soccer',
]);

/**
 * Return true if zero rows for the given sport should be treated as an error.
 * For well-known team sports (NFL, NBA, etc.), an empty result is suspicious.
 */
export function isZeroRowsSuspicious(sport: string): boolean {
  return EXPECTED_TEAM_SPORTS.has(sport.toUpperCase());
}
