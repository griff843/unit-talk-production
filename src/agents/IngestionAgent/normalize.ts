import { RawProp } from './ingestion.types';

// Safely handle nullable strings
export function normalizeRawProp(prop: RawProp): RawProp {
  return {
    ...prop,
    player_name: prop.player_name ? prop.player_name.trim() : null,
    team: prop.team ? prop.team.trim().toUpperCase() : null,
    opponent: prop.opponent ? prop.opponent.trim().toUpperCase() : null,
    market: prop.market ? prop.market.toLowerCase() : null,
    scraped_at: new Date().toISOString(),
  };
}
