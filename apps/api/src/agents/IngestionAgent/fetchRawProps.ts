import { randomUUID } from 'crypto';

import { RawProp } from '../../types/rawProps';
import { fetchUnifiedData } from '../FeedAgent/dataSourceRouter';

import { DataProvider } from './types';
// import { fetchOptimalProps } from '../FeedAgent/optimal'; // Unused import


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
 * Fetch props using unified data router (Optimal + Odds API)
 */
async function fetchFromOptimal(_provider: DataProvider): Promise<RawProp[]> {
  try {
    // Get current date for fetching today's props
    const currentDate = new Date().toISOString().split('T')[0]!;

    // Updated leagues to include ALL major sports
    const leagues = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'WNBA'];
    const allProps: RawProp[] = [];
    
    for (const league of leagues) {
      try {
        console.log(`[IngestionAgent] Fetching ${league} props via unified router`);
        
        // Use unified data router for intelligent API selection
        const response = await fetchUnifiedData({
          sport: league,
          marketType: 'player-props',
          date: currentDate
        });

        if (response.data && response.data.length > 0) {
          allProps.push(...response.data);
          console.log(`[IngestionAgent] Fetched ${response.data.length} ${league} props from ${response.source}`);
        }
        
        // Small delay between league requests to be respectful
        if (leagues.indexOf(league) < leagues.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`[IngestionAgent] Failed to fetch ${league}:`, error);
        // Continue with other leagues even if one fails
      }
    }
    
    console.log(`[IngestionAgent] Total props fetched: ${allProps.length}`);
    return allProps;
    
  } catch (error) {
    console.error('[IngestionAgent] Unified fetch failed:', error);
    throw error;
  }
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
      id: randomUUID(),
      provider: provider.name,
      player_name: 'LeBron James',
      sport: 'NBA',
      team: 'LAL',
      stat_type: 'PTS',
      outcome: null,
      line: 27.5,
      odds: -110,
      created_at: new Date().toISOString(),
      source: 'test',
      game_id: null,
      scraped_at: new Date().toISOString(),
      game_date: new Date().toISOString().split('T')[0],
      matchup: 'LAL @ GSW',
      trend_confidence: 0,
      matchup_quality: 0,
      line_value_score: 0,
      role_stability: 0,
      confidence_score: 0,
      edge_score: 0,
      tier_tag: null,
      auto_approved: false,
      context_flag: false,
      promoted_to_picks: false,
      promoted_at: null,
      promoted: false,
      is_promoted: false,
      bet_type: null,
      market_type: null,
      outcomes: null,
      player_id: null,
      player_slug: null,
      external_game_id: '12345',
      external_id: '12345',
      sport_key: 'nba',
      league: 'NBA',
      over_odds: -110,
      under_odds: -110,
      fair_odds: null,
      market: 'player_points',
      game_time: new Date().toISOString(),
      start_time: new Date().toISOString(),
      home_team: 'GSW',
      home_team_id: null,
      away_team: 'LAL',
      away_team_id: null,
      opponent: 'GSW',
      unit_size: null,
      tier: null,
      ev_percent: null,
      trend_score: null,
      matchup_score: null,
      line_score: null,
      role_score: null,
      direction: null,
      unique_key: null,
      event_id: null,
      book: null,
      updated_at: null,
      is_alt_line: null,
      is_primary: null,
      is_valid: undefined
    }
  ];

  return mockData;
}