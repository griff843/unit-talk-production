/**
 * SPRINT-SMARTFORM-DATA-CONTRACTS-MANUAL-INVENTORY-059
 *
 * Smart Form Data Contract V1 - Zod Schemas
 *
 * PRINCIPLE: These schemas define the ONLY valid shapes for Smart Form API responses.
 * All routes MUST validate responses against these schemas (fail-closed).
 *
 * Contract Version: 1.0.1
 * @see docs/contracts/SMARTFORM_DATA_CONTRACT_V1.md
 */

import { z } from 'zod';

// =============================================================================
// CONTRACT VERSION
// =============================================================================

export const CONTRACT_VERSION = '1.0.1' as const;

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

export const ContractMetaSchema = z.object({
  total: z.number().int().min(0),
  sport: z.string().min(1).toUpperCase(),
  source: z.literal('contract_surface'),
  contract_version: z.literal(CONTRACT_VERSION),
  timestamp: z.string().datetime(),
  cache_hit: z.boolean().optional(),
});

export const SportCodeSchema = z.enum(['NBA', 'NFL', 'MLB', 'NHL', 'NCAAF', 'NCAAB']);

// =============================================================================
// CATALOG_PLAYERS_V1 SCHEMA
// =============================================================================

export const CatalogPlayerSchema = z.object({
  player_id: z.string().uuid(),
  player_name: z.string().min(1),
  sport: SportCodeSchema,
  team_id: z.string().uuid().nullable(),
  team_name: z.string().nullable(),
  team_abbr: z.string().nullable(),
  position: z.string().nullable(),
  headshot_url: z.string().url().nullable().or(z.literal('')).or(z.null()),
  external_player_id: z.string().optional(),
  contract_version: z.literal(CONTRACT_VERSION),
  last_updated: z.string().datetime().nullable(),
});

export const PlayersResponseSchema = z.object({
  players: z.array(CatalogPlayerSchema),
  meta: ContractMetaSchema.extend({
    query: z.string().nullable().optional(),
    team_id: z.string().uuid().nullable().optional(),
  }),
});

export type CatalogPlayer = z.infer<typeof CatalogPlayerSchema>;
export type PlayersResponse = z.infer<typeof PlayersResponseSchema>;

// =============================================================================
// CATALOG_TEAMS_V1 SCHEMA
// =============================================================================

export const CatalogTeamSchema = z.object({
  team_id: z.string().uuid(),
  team_name: z.string().min(1),
  team_abbr: z.string().min(1),
  sport: SportCodeSchema,
  external_team_id: z.string().uuid().nullable(),
  logo_url: z.string().url().nullable().or(z.literal('')).or(z.null()),
  contract_version: z.literal(CONTRACT_VERSION),
  last_updated: z.string().datetime().nullable(),
});

export const TeamsResponseSchema = z.object({
  teams: z.array(CatalogTeamSchema),
  meta: ContractMetaSchema.extend({
    query: z.string().nullable().optional(),
  }),
});

export type CatalogTeam = z.infer<typeof CatalogTeamSchema>;
export type TeamsResponse = z.infer<typeof TeamsResponseSchema>;

// =============================================================================
// MARKET_TAXONOMY_V1 SCHEMA
// =============================================================================

export const MarketTaxonomyItemSchema = z.object({
  market_key: z.string().min(1),
  display_name: z.string().min(1),
  category: z.string().min(1),
  bet_type: z.string().min(1),
  sort_order: z.number().int(),
  aliases: z.array(z.string()).nullable().optional(),
  contract_version: z.literal(CONTRACT_VERSION),
});

export const MarketTaxonomyResponseSchema = z.object({
  markets: z.array(MarketTaxonomyItemSchema),
  meta: ContractMetaSchema.extend({
    bet_type: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
  }),
});

export type MarketTaxonomyItem = z.infer<typeof MarketTaxonomyItemSchema>;
export type MarketTaxonomyResponse = z.infer<typeof MarketTaxonomyResponseSchema>;

// =============================================================================
// INVENTORY_PROPS_FOR_FORM_V1 SCHEMA
// =============================================================================

export const InventoryPropSchema = z.object({
  prop_id: z.string().uuid(),
  sport: SportCodeSchema,
  // Game context
  game_id: z.string().uuid().nullable(),
  start_time: z.string().datetime().nullable(),
  game_date: z.string().nullable(), // YYYY-MM-DD
  matchup: z.string(),
  home_team: z.string().nullable(),
  away_team: z.string().nullable(),
  // Player context
  player_name: z.string().min(1),
  team_abbr: z.string().nullable(),
  // Market details
  market_key: z.string().min(1),
  line: z.number(),
  over_odds: z.number().int().nullable(),
  under_odds: z.number().int().nullable(),
  book: z.string(),
  // Unique key
  prop_key: z.string(),
  display_label: z.string(),
  // Contract metadata
  contract_version: z.literal(CONTRACT_VERSION),
  last_updated: z.string().datetime().nullable(),
});

export const PropsResponseSchema = z.object({
  props: z.array(InventoryPropSchema),
  available_markets: z.array(z.string()),
  meta: ContractMetaSchema.extend({
    player_name: z.string().nullable().optional(),
    market_key: z.string().nullable().optional(),
    game_id: z.string().uuid().nullable().optional(),
  }),
});

export type InventoryProp = z.infer<typeof InventoryPropSchema>;
export type PropsResponse = z.infer<typeof PropsResponseSchema>;

// =============================================================================
// MANUAL_INVENTORY_FOR_FORM_V1 SCHEMA
// =============================================================================
// Derives prop suggestions from internal manual submissions (unified_picks).
// No dependency on live prop feeds.

export const ManualInventoryItemSchema = z.object({
  sport: SportCodeSchema,
  player_id: z.string().nullable(),
  player_name: z.string().min(1),
  team_abbr: z.string().nullable(),
  market_key: z.string().min(1),
  // Line statistics
  avg_line: z.number().nullable(),
  min_line: z.number().nullable(),
  max_line: z.number().nullable(),
  // Odds statistics
  avg_odds: z.number().int().nullable(),
  // Usage metrics
  count_recent: z.number().int().min(0),
  last_seen_at: z.string().datetime().nullable(),
  // Contract metadata
  contract_version: z.string(),
});

export const ManualInventoryResponseSchema = z.object({
  suggestions: z.array(ManualInventoryItemSchema),
  meta: ContractMetaSchema.extend({
    player_name: z.string().nullable().optional(),
    market_key: z.string().nullable().optional(),
    days_lookback: z.number().int().optional(),
  }),
});

export type ManualInventoryItem = z.infer<typeof ManualInventoryItemSchema>;
export type ManualInventoryResponse = z.infer<typeof ManualInventoryResponseSchema>;

// =============================================================================
// MARKET_USAGE_STATS_V1 SCHEMA
// =============================================================================
// Tracks market usage for sorting stat types by popularity.

export const MarketUsageStatsSchema = z.object({
  sport: SportCodeSchema,
  market_key: z.string().min(1),
  usage_count: z.number().int().min(0),
  unique_players: z.number().int().min(0),
  last_used_at: z.string().datetime().nullable(),
  contract_version: z.string(),
});

export type MarketUsageStats = z.infer<typeof MarketUsageStatsSchema>;

// =============================================================================
// STAT TYPES RESPONSE (Combines taxonomy + manual inventory)
// =============================================================================

export const StatTypeItemSchema = z.object({
  code: z.string().min(1), // market_key
  display_name: z.string().min(1),
  category: z.string().min(1),
  source: z.enum(['inventory', 'taxonomy', 'manual_inventory']),
  has_inventory: z.boolean(),
  inventory_count: z.number().int().min(0).optional(),
  // Manual usage stats (when source is manual_inventory or taxonomy with usage data)
  usage_count: z.number().int().min(0).optional(),
  last_used_at: z.string().datetime().nullable().optional(),
});

export const StatTypesResponseSchema = z.object({
  stat_types: z.array(StatTypeItemSchema),
  meta: ContractMetaSchema.extend({
    bet_type: z.string().nullable().optional(),
    inventory_first: z.boolean(),
    taxonomy_fallback: z.boolean(),
  }),
});

export type StatTypeItem = z.infer<typeof StatTypeItemSchema>;
export type StatTypesResponse = z.infer<typeof StatTypesResponseSchema>;

// =============================================================================
// ERROR SCHEMA
// =============================================================================

export const ContractErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
  contract_version: z.literal(CONTRACT_VERSION),
  timestamp: z.string().datetime(),
  details: z.unknown().optional(),
});

export type ContractError = z.infer<typeof ContractErrorSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validates response against schema and throws if invalid.
 * FAIL-CLOSED: Invalid responses cause request failure.
 */
export function validateContractResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[CONTRACT-VIOLATION] ${context}:`, result.error.errors);
    throw new ContractValidationError(
      `Contract validation failed for ${context}`,
      result.error.errors
    );
  }
  return result.data;
}

/**
 * Safely validates response, returning null on failure.
 * Use when graceful degradation is preferred.
 */
export function safeValidateContractResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`[CONTRACT-SOFT-FAIL] ${context}:`, result.error.errors);
    return null;
  }
  return result.data;
}

export class ContractValidationError extends Error {
  public readonly errors: z.ZodIssue[];
  public readonly contractVersion = CONTRACT_VERSION;

  constructor(message: string, errors: z.ZodIssue[]) {
    super(message);
    this.name = 'ContractValidationError';
    this.errors = errors;
  }
}

// =============================================================================
// RESPONSE BUILDERS
// =============================================================================

export function buildContractMeta(
  sport: string,
  total: number,
  extras: Record<string, unknown> = {}
): z.infer<typeof ContractMetaSchema> {
  return {
    total,
    sport: sport.toUpperCase(),
    source: 'contract_surface',
    contract_version: CONTRACT_VERSION,
    timestamp: new Date().toISOString(),
    ...extras,
  };
}

export function buildContractError(error: string, code: string, details?: unknown): ContractError {
  return {
    error,
    code,
    contract_version: CONTRACT_VERSION,
    timestamp: new Date().toISOString(),
    details,
  };
}

// =============================================================================
// FORBIDDEN SOURCES - For enforcement
// =============================================================================

/**
 * Tables that Smart Form routes are FORBIDDEN from querying directly.
 * They MUST use the v1 contract views instead.
 */
export const FORBIDDEN_DIRECT_SOURCES = [
  'players', // Use catalog_players_v1
  'teams', // Use catalog_teams_v1
  'raw_props', // Use inventory_props_for_form_v1 or manual_inventory_for_form_v1
  'unified_picks', // Use manual_inventory_for_form_v1
  'mv_search_players', // Use catalog_players_v1
  'mv_search_teams', // Use catalog_teams_v1
  'mv_props_for_form', // Use inventory_props_for_form_v1 or manual_inventory_for_form_v1
] as const;

export type ForbiddenSource = (typeof FORBIDDEN_DIRECT_SOURCES)[number];
