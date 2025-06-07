// src/agents/FeedAgent/utils/normalizePublicProps.ts
import { z } from 'zod';
import { RawProp } from '../../../types/rawProps';
import { logCoverage } from '../logCoverage';
import { Provider } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * List of allowed public prop market types for ingestion.
 * Extend as your system grows.
 */
export const allowedMarkets = [
  'Anytime Touchdown Scorer',
  'Anytime Home Run',
  'First Basket Scorer',
  'Anytime Goal Scorer'
] as const;

export type AllowedMarket = typeof allowedMarkets[number];

/**
 * Schema for incoming raw prop data.
 * Extend this as upstream providers evolve.
 */
export const propSchema = z.object({
  external_game_id: z.string(),
  player_name: z.string(),
  market_type: z.string(),
  team_name: z.string(),
  line: z.number().optional(),
  odds: z.number(),
  book_name: z.string(),
  game_date: z.string().datetime(),
  sport: z.string().optional(),
  league: z.string().optional(),
  // You can add more fields if needed
});

/**
 * Normalizes and validates incoming public prop data.
 * Returns only props matching allowed markets and valid schema.
 * @param rawProps Array of raw public prop objects from provider API
 * @param provider The provider name (used for logging)
 * @param enableLogging Should failures/skips be logged?
 * @param supabase Supabase client for logging coverage
 */
export async function normalizePublicProps(
  rawProps: any[],
  provider: Provider = 'SportsGameOdds',
  enableLogging = true,
  supabase: SupabaseClient
): Promise<RawProp[]> {
  const normalized: RawProp[] = [];

  for (const prop of rawProps) {
    try {
      if (!allowedMarkets.includes(prop.market_type as AllowedMarket)) {
        if (enableLogging) {
          await logCoverage({
            provider,
            data: prop,
            timestamp: new Date().toISOString()
          }, supabase);
        }
        continue;
      }

      const parsed = propSchema.parse(prop);

      const unique_key = [
        parsed.external_game_id,
        parsed.player_name,
        parsed.market_type,
        parsed.line ?? 'NA',
        parsed.book_name
      ].join('-');

      normalized.push({
        id: crypto.randomUUID(),
        external_id: unique_key,
        player_name: parsed.player_name,
        team: parsed.team_name,
        stat_type: parsed.market_type,
        line: parsed.line ?? 0,
        over_odds: parsed.odds,
        market: parsed.market_type,
        provider,
        game_time: parsed.game_date,
        scraped_at: new Date().toISOString(),
        is_valid: true
      });
    } catch (err) {
      if (enableLogging) {
        await logCoverage({
          provider,
          data: prop,
          timestamp: new Date().toISOString()
        }, supabase);
      }
    }
  }

  return normalized;
}
