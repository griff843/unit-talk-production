// Stub implementation for oddsService
export interface OddsData {
  line?: number;
  odds?: number;
}

export async function fetchHistoricalOdds(
  playerName: string,
  statType: string,
  matchup: string,
  gameDate: string
): Promise<OddsData | null> {
  // Stub implementation - returns null for now
  return null;
}

export async function fetchCurrentOdds(
  playerName: string,
  statType: string,
  matchup: string
): Promise<OddsData | null> {
  // Stub implementation - returns null for now
  return null;
}