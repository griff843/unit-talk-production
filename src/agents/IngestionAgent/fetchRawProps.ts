import { RawProp, DataProvider } from './types';
import { fetchOptimalProps } from '../FeedAgent/optimal';

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
  // Handle different provider types
  switch (provider.name.toLowerCase()) {
    case 'optimal':
      console.log(`[fetchRawProps] Fetching from Optimal provider`);
      return await fetchFromOptimal(provider);

    case 'sportsgameodds':
    case 'sgo':
      console.log(`[fetchRawProps] Fetching from SportsGameOdds provider`);
      return await fetchFromSGO(provider);

    case 'oddsapi':
      console.log(`[fetchRawProps] Fetching from OddsAPI provider`);
      return await fetchFromOddsAPI(provider);
      
      case 'pinnacle':
        return await fetchFromPinnacle(provider);
      
      default:
        console.warn(`Unknown provider: ${provider.name}, returning mock data`);
        return await fetchMockData(provider);
    }
    
  } catch (error) {
    console.error(`Failed to fetch from provider ${provider.name}:`, error);
    throw error;
  }
}

/**
 * Fetch props from Optimal API
 */
async function fetchFromOptimal(provider: DataProvider): Promise<RawProp[]> {
  try {
    // Get current date for fetching today's props
    const currentDate = new Date().toISOString().split('T')[0]!;

    // Fetch from multiple leagues - you can configure this based on your needs
    const leagues = ['NBA', 'NFL', 'MLB', 'NHL']; // Add more leagues as needed
    const allProps: RawProp[] = [];
    
    for (const league of leagues) {
      try {
        console.log(`[IngestionAgent] Fetching ${league} props from Optimal for ${currentDate}`);
        const optimalProps = await fetchOptimalProps(league, currentDate);

        // fetchOptimalProps already returns RawProp[], no need to convert again
        allProps.push(...optimalProps);

        console.log(`[IngestionAgent] Fetched ${optimalProps.length} ${league} props from Optimal`);
        
        // Small delay between league requests to be respectful
        if (leagues.indexOf(league) < leagues.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`[IngestionAgent] Failed to fetch ${league} from Optimal:`, error);
        // Continue with other leagues even if one fails
      }
    }
    
    console.log(`[IngestionAgent] Total props fetched from Optimal: ${allProps.length}`);
    return allProps;
    
  } catch (error) {
    console.error('[IngestionAgent] Optimal provider failed:', error);
    throw error;
  }
}

/**
 * Convert Optimal RawProp to IngestionAgent RawProp format
 */
function convertOptimalToRawProp(optimalProp: any, providerName: string): RawProp {
  return {
    // Required fields from Optimal
    external_game_id: optimalProp.external_id || null,
    game_id: null, // Will be resolved later
    player_name: optimalProp.player_name,
    team: optimalProp.team || null,
    stat_type: optimalProp.stat_type,
    line: optimalProp.line,
    over_odds: optimalProp.over_odds || null,
    under_odds: optimalProp.under_odds || null,
    provider: providerName,
    game_time: optimalProp.game_time || null,
    scraped_at: new Date().toISOString(),
    sport: optimalProp.league || null,
    sport_key: optimalProp.league?.toLowerCase().replace(' ', '_') || null,
    matchup: optimalProp.team && optimalProp.opponent ? `${optimalProp.team} vs ${optimalProp.opponent}` : null,

    // Additional fields from Optimal
    source: optimalProp.bookmaker || null,
    
    // Set remaining fields to null as per schema
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
    is_valid: optimalProp.is_valid || true,
    odds: null,
    game_date: optimalProp.game_time ? optimalProp.game_time.split('T')[0] : null,
    trend_confidence: null,
    matchup_quality: null,
    line_value_score: null,
    role_stability: null,
    confidence_score: null,
    outcome: null,
    player_slug: null,
    fair_odds: null
  };
}

/**
 * Placeholder for SGO provider - implement when ready
 */
async function fetchFromSGO(_provider: DataProvider): Promise<RawProp[]> {
  console.log(`[IngestionAgent] SGO provider not yet implemented, returning empty array`);
  return [];
}

/**
 * Placeholder for OddsAPI provider - implement when ready
 */
async function fetchFromOddsAPI(_provider: DataProvider): Promise<RawProp[]> {
  console.log(`[IngestionAgent] OddsAPI provider not yet implemented, returning empty array`);
  return [];
}

/**
 * Placeholder for Pinnacle provider - implement when ready
 */
async function fetchFromPinnacle(_provider: DataProvider): Promise<RawProp[]> {
  console.log(`[IngestionAgent] Pinnacle provider not yet implemented, returning empty array`);
  return [];
}

/**
 * Mock data for testing and unknown providers
 */
async function fetchMockData(provider: DataProvider): Promise<RawProp[]> {
  // Return the existing mock data for testing
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
      is_valid: true,
      odds: null,
      game_date: (new Date().toISOString().split('T')[0] || null),
      trend_confidence: null,
      matchup_quality: null,
      line_value_score: null,
      role_stability: null,
      confidence_score: null,
      outcome: null,
      player_slug: null,
      fair_odds: null
    }
  ];

  console.log(`[IngestionAgent] Returning ${mockData.length} mock props for provider: ${provider.name}`);
  return mockData;
}