import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { RawProp } from '../../../types/rawProps';
import { Provider } from '../types';
/**
 * List of allowed public prop market types for ingestion.
 * Extend as your system grows.
 */
export declare const allowedMarkets: readonly ["Anytime Touchdown Scorer", "Anytime Home Run", "First Basket Scorer", "Anytime Goal Scorer"];
export type AllowedMarket = typeof allowedMarkets[number];
/**
 * Schema for incoming raw prop data.
 * Extend this as upstream providers evolve.
 */
export declare const propSchema: z.ZodObject<{
    external_game_id: z.ZodString;
    player_name: z.ZodString;
    market_type: z.ZodString;
    team_name: z.ZodString;
    line: z.ZodOptional<z.ZodNumber>;
    odds: z.ZodNumber;
    book_name: z.ZodString;
    game_date: z.ZodString;
    sport: z.ZodOptional<z.ZodString>;
    league: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    player_name: string;
    odds: number;
    market_type: string;
    game_date: string;
    external_game_id: string;
    team_name: string;
    book_name: string;
    sport?: string | undefined;
    line?: number | undefined;
    league?: string | undefined;
}, {
    player_name: string;
    odds: number;
    market_type: string;
    game_date: string;
    external_game_id: string;
    team_name: string;
    book_name: string;
    sport?: string | undefined;
    line?: number | undefined;
    league?: string | undefined;
}>;
/**
 * Normalizes and validates incoming public prop data.
 * Returns only props matching allowed markets and valid schema.
 * @param rawProps Array of raw public prop objects from provider API
 * @param provider The provider name (used for logging)
 * @param enableLogging Should failures/skips be logged?
 * @param supabase Supabase client for logging coverage
 */
export declare function normalizePublicProps(rawProps: any[], provider: Provider | undefined, enableLogging: boolean | undefined, supabase: SupabaseClient): Promise<RawProp[]>;
//# sourceMappingURL=normalizePublicProps.d.ts.map