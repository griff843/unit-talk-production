import { RawProp, DataProvider } from './types';

/**
 * Fetch raw props from a specific data provider
 * @param provider - The data provider configuration
 * @returns Promise<RawProp[]> - Array of raw props from the provider
 */
export async function fetchRawProps(provider: DataProvider): Promise<RawProp[]> {
  if (!provider.enabled) {
    return [];
  }

  try {
    // For now, return mock data. In production, this would make HTTP requests to the provider
    // TODO: Implement actual HTTP client with proper error handling, retries, and rate limiting
    
    const mockData: RawProp[] = [
      {
        external_game_id: '12345',
        game_id: null,
        player_name: 'LeBron James',
        team: 'LAL',
        stat_type: 'PTS',
        line: 27.5,
        over_odds: -110,
        under_odds: -110,
        provider: provider.name,
        game_time: new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        sport: 'NBA',
        sport_key: 'basketball_nba',
        matchup: 'LAL vs BOS',
        
        // Set all other fields to null as per schema
        source: null,
        direction: null,
        edge_score: null,
        auto_approved: null,
        context_flag: null,
        created_at: null,
        promoted_to_picks: null,
        outcomes: null,
        player_id: null,
        promoted_at: null,
        unit_size: null,
        promoted: null,
        ev_percent: null,
        trend_score: null,
        matchup_score: null,
        line_score: null,
        role_score: null,
        is_promoted: null,
        updated_at: null,
        is_alt_line: null,
        is_primary: null,
        is_valid: null,
        odds: null,
        game_date: null,
        trend_confidence: null,
        matchup_quality: null,
        line_value_score: null,
        role_stability: null,
        confidence_score: null,
        outcome: null,
        player_slug: null,
        fair_odds: null,
        raw_data: null
      },
      {
        external_game_id: '12346',
        game_id: null,
        player_name: 'Stephen Curry',
        team: 'GSW',
        stat_type: '3PM',
        line: 4.5,
        over_odds: -120,
        under_odds: +100,
        provider: provider.name,
        game_time: new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        sport: 'NBA',
        sport_key: 'basketball_nba',
        matchup: 'GSW vs LAC',
        
        // Set all other fields to null
        source: null,
        direction: null,
        edge_score: null,
        auto_approved: null,
        context_flag: null,
        created_at: null,
        promoted_to_picks: null,
        outcomes: null,
        player_id: null,
        promoted_at: null,
        unit_size: null,
        promoted: null,
        ev_percent: null,
        trend_score: null,
        matchup_score: null,
        line_score: null,
        role_score: null,
        is_promoted: null,
        updated_at: null,
        is_alt_line: null,
        is_primary: null,
        is_valid: null,
        odds: null,
        game_date: null,
        trend_confidence: null,
        matchup_quality: null,
        line_value_score: null,
        role_stability: null,
        confidence_score: null,
        outcome: null,
        player_slug: null,
        fair_odds: null,
        raw_data: null
      }
    ];

    return mockData;

  } catch (error) {
    throw new Error(`Failed to fetch props from provider ${provider.name}: ${error.message}`);
  }
}

/**
 * Fetch raw props from multiple providers (legacy function for backward compatibility)
 * @deprecated Use fetchRawProps with specific provider instead
 */
export async function fetchAllRawProps(): Promise<RawProp[]> {
  // Default provider for backward compatibility
  const defaultProvider: DataProvider = {
    name: 'DefaultProvider',
    url: 'https://api.example.com',
    enabled: true,
    timeout: 30000,
    retries: 3
  };

  return fetchRawProps(defaultProvider);
}