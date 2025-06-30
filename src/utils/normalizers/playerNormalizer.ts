interface RawProp {
  playerName?: unknown;
  marketType?: unknown;
  line?: unknown;
  source?: unknown;
  sport?: unknown;
  expiresAt?: unknown;
}

export function normalizeRawProps(rawProps: RawProp[]) {
  return rawProps.map((prop) => ({
    player_name: prop.playerName,
    market_type: prop.marketType,
    line: prop.line,
    source: prop.source,
    sport: prop.sport,
    expires_at: prop.expiresAt,
    created_at: new Date().toISOString(),
  }));
}