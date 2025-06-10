export function normalizeRawProps(rawProps: any[]) {
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
