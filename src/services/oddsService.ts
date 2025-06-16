// Mock odds service for testing and development
export interface OddsData {
  line: number;
  odds: number;
  timestamp: string;
}

export async function fetchHistoricalOdds(
  playerName: string,
  statType: string,
  matchup: string,
  gameDate: string
): Promise<OddsData | null> {
  // Mock implementation - in production this would call external odds API
  console.log(`Fetching historical odds for ${playerName} ${statType} in ${matchup} on ${gameDate}`);
  
  return {
    line: 25.5,
    odds: -110,
    timestamp: new Date().toISOString()
  };
}

export async function fetchCurrentOdds(
  playerName: string,
  statType: string,
  matchup: string
): Promise<OddsData | null> {
  // Mock implementation - in production this would call external odds API
  console.log(`Fetching current odds for ${playerName} ${statType} in ${matchup}`);
  
  return {
    line: 26.0,
    odds: -115,
    timestamp: new Date().toISOString()
  };
}