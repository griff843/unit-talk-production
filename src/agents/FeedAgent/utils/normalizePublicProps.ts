// src/agents/FeedAgent/utils/normalizePublicProps.ts
import { z } from 'zod';
import { RawProp } from '../../types/rawProps';
import { logCoverage } from '../logCoverage';

const allowedMarkets = [
  'Anytime Touchdown Scorer',
  'Anytime Home Run',
  'First Basket Scorer',
  'Anytime Goal Scorer'
];

const propSchema = z.object({
  external_game_id: z.string(),
  player_name: z.string(),
  market_type: z.string(),
  team_name: z.string(),
  line: z.number().optional(),
  odds: z.number(),
  book_name: z.string(),
  game_date: z.string().datetime(),
  sport: z.string().optional(),
  league: z.string().optional()
});

export async function normalizePublicProps(
  rawProps: any[],
  enableLogging = true
): Promise<RawProp[]> {
  const normalized: RawProp[] = [];

  for (const prop of rawProps) {
    try {
      if (!allowedMarkets.includes(prop.market_type)) continue;

      const parsed = propSchema.parse(prop);

      const unique_key = `${parsed.external_game_id}-${parsed.player_name}-${parsed.market_type}-${parsed.line ?? 'NA'}-${parsed.book_name}`;

      normalized.push({
        id: crypto.randomUUID(),
        unique_key,
        external_game_id: parsed.external_game_id,
        player_name: parsed.player_name,
        market_type: parsed.market_type,
        team_name: parsed.team_name,
        line: parsed.line ?? null,
        odds: parsed.odds,
        book_name: parsed.book_name,
        game_date: parsed.game_date,
        sport: parsed.sport ?? null,
        league: parsed.league ?? null,
        is_public_prop: true,
        status: 'pending',
        scraped_at: new Date().toISOString(),
        is_valid: true,
        provider: 'SportsGameOdds'
      });
    } catch (err) {
      if (enableLogging) {
        await logCoverage('normalizePublicProps', {
          message: 'Prop skipped or failed normalization',
          prop,
          error: err instanceof Error ? err.message : err
        });
      }
    }
  }

  return normalized;
}
