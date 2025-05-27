import { RawProp } from './ingestion.types';

export async function fetchRawProps(): Promise<RawProp[]> {
  return [
    {
      external_id: '12345',
      game_id: null,
      player_name: 'LeBron James',
      team: 'LAL',
      opponent: 'BOS',
      stat_type: 'PTS',
      line: 27.5,
      over_odds: -110,
      under_odds: -110,
      market: 'player_points',
      provider: 'SportsGameOdds',
      game_time: new Date().toISOString(),
      scraped_at: new Date().toISOString(),
      sport: 'NBA', // 👈 ADDED — or use null if not available

      // All other fields set to null
      source: null, direction: null, edge_score: null, auto_approved: null, context_flag: null, created_at: null,
      promoted_to_picks: null, outcomes: null, player_id: null, promoted_at: null, unit_size: null,
      promoted: null, ev_percent: null, trend_score: null, matchup_score: null, line_score: null, role_score: null,
      is_promoted: null, updated_at: null, is_alt_line: null, is_primary: null, is_valid: null,
      odds: null, game_date: null, trend_confidence: null, matchup_quality: null, line_value_score: null,
      role_stability: null, confidence_score: null, outcome: null, player_slug: null, external_game_id: null,
      matchup: null, sport_key: null, fair_odds: null, league: null, unique_key: null, start_time: null, tier: null,
      tier_tag: null, event_id: null, book: null, bet_type: null, market_type: null
    },
  ];
}
