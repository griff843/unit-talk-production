import { z } from 'zod';

/**
 * Autocomplete validation schemas for Smart Form components
 * Optimized for sub-200ms response times with cache-first architecture
 */

// Base autocomplete query schema
export const AutocompleteQuerySchema = z.object({
  query: z.string().min(1).max(100, 'Query too long'),
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'WNBA']).optional(),
  league: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
  include_metadata: z.boolean().default(true),
});

export type AutocompleteQuery = z.infer<typeof AutocompleteQuerySchema>;

// Player autocomplete specific schema
export const PlayerAutocompleteSchema = AutocompleteQuerySchema.extend({
  market: z.string().optional(),
  min_confidence: z.number().min(0).max(1).optional(),
  tier: z.array(z.enum(['S', 'A', 'B', 'C', 'D'])).optional(),
});

export type PlayerAutocompleteQuery = z.infer<typeof PlayerAutocompleteSchema>;

// Market autocomplete schema
export const MarketAutocompleteSchema = AutocompleteQuerySchema.extend({
  player_name: z.string().optional(),
  include_submarkets: z.boolean().default(true),
});

export type MarketAutocompleteQuery = z.infer<typeof MarketAutocompleteSchema>;

// Game autocomplete schema
export const GameAutocompleteSchema = AutocompleteQuerySchema.extend({
  game_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  date_range: z.enum(['today', 'tomorrow', 'week', 'all']).default('week'),
});

export type GameAutocompleteQuery = z.infer<typeof GameAutocompleteSchema>;

// Validation functions with error handling
export function validatePlayerAutocomplete(query: unknown): PlayerAutocompleteQuery {
  try {
    return PlayerAutocompleteSchema.parse(query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Player autocomplete validation failed: ${error.issues.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function validateMarketAutocomplete(query: unknown): MarketAutocompleteQuery {
  try {
    return MarketAutocompleteSchema.parse(query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Market autocomplete validation failed: ${error.issues.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

export function validateGameAutocomplete(query: unknown): GameAutocompleteQuery {
  try {
    return GameAutocompleteSchema.parse(query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Game autocomplete validation failed: ${error.issues.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

// Cache key generators for consistent caching
export function generatePlayerCacheKey(query: PlayerAutocompleteQuery): string {
  const key = `player_autocomplete:${query.query}:${query.sport || 'all'}:${query.market || 'all'}:${query.limit}`;
  if (query.tier?.length) {
    return `${key}:${query.tier.sort().join(',')}`;
  }
  return key;
}

export function generateMarketCacheKey(query: MarketAutocompleteQuery): string {
  return `market_autocomplete:${query.query}:${query.sport || 'all'}:${query.player_name || 'all'}:${query.limit}`;
}

export function generateGameCacheKey(query: GameAutocompleteQuery): string {
  return `game_autocomplete:${query.query}:${query.sport || 'all'}:${query.date_range}:${query.limit}`;
}