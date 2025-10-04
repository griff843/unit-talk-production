/**
 * Odds API to Unified Picks Transform
 *
 * Maps Odds API payloads to UnifiedPickInput rows
 * Assumes input events already filtered to MLB and desired markets
 */

import type { UnifiedPickInput } from '../writer/unifiedPicksWriter';

const SYS_UID = process.env.SYSTEM_USER_ID || '00000000-0000-0000-0000-000000000001';

/**
 * Map provider (Odds API) payloads to UnifiedPickInput rows.
 * Assumes input events already filtered to MLB and desired markets.
 */
export function oddsToUnifiedRows(events: any[]): UnifiedPickInput[] {
  const rows: UnifiedPickInput[] = [];

  for (const ev of events) {
    const gameDate = ev.commence_time; // ISO
    const home = ev.home_team;
    const away = ev.away_team;
    const game_id = ev.id ?? null;

    // Bookmaker loops
    for (const bm of ev.bookmakers ?? []) {
      const bookmaker_key = bm.key;

      for (const mk of bm.markets ?? []) {
        const market_key = mk.key as UnifiedPickInput['market']; // 'h2h' | 'spreads' | 'totals' | 'player_props'

        // H2H / spreads / totals
        if (market_key === 'h2h' || market_key === 'spreads' || market_key === 'totals') {
          for (const out of mk.outcomes ?? []) {
            const selection = out.name; // team name or Over/Under
            const odds = Number(out.price ?? out.odds ?? 0);
            const line = out.point !== undefined && out.point !== null ? Number(out.point) : null;
            if (!selection || !Number.isFinite(odds)) continue;

            const stake = 1;
            const potential_payout = stake * (odds > 0 ? (1 + odds / 100) : (1 - 100 / odds));
            rows.push({
              game_id,
              sport: 'mlb',
              market: market_key,
              selection,
              odds,
              line,
              bookmaker_key,
              game_date: gameDate,
              source: 'odds-api',
              user_id: SYS_UID,
              pick_type: 'single',
              stake,
              potential_payout,
            });
          }
        } else if (market_key === 'player_props') {
          // Player props - depends on provider payload shape
          for (const out of mk.outcomes ?? []) {
            const selection = out.description || out.name;  // player + prop label
            const odds = Number(out.price ?? out.odds ?? 0);
            const line = out.line !== undefined && out.line !== null ? Number(out.line) : null;
            if (!selection || !Number.isFinite(odds)) continue;

            const stake = 1;
            const potential_payout = stake * (odds > 0 ? (1 + odds / 100) : (1 - 100 / odds));
            rows.push({
              game_id,
              sport: 'mlb',
              market: 'player_props',
              selection,
              odds,
              line,
              bookmaker_key,
              game_date: gameDate,
              source: 'odds-api',
              user_id: SYS_UID,
              pick_type: 'single',
              stake,
              potential_payout,
            });
          }
        }
      }
    }
  }

  return rows;
}
