// src/agents/FeedAgent/utils/normalizePublicProps.ts
import { z } from 'zod';
import { RawProp } from '../../../types/rawProps';

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
        external_id: `${parsed.external_game_id}-${parsed.player_name}-${parsed.market_type}`,
        player_name: parsed.player_name,
        team: parsed.team_name,
        stat_type: parsed.market_type,
        line: parsed.line ?? 0,
        market: parsed.market_type,
        provider: 'SportsGameOdds',
        game_time: parsed.game_date,
        scraped_at: new Date().toISOString(),
        is_valid: true
      });
    } catch (err) {
      if (enableLogging) {
        console.warn('Prop skipped or failed normalization', {
          prop,
          error: err instanceof Error ? err.message : err
        });
      }
    }
  }

  return normalized;
}
