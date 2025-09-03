import { GradingFeatureSet } from '../types/GradingFeatureSet';

export interface HistoricalPick {
  id: string;
  features: GradingFeatureSet;
  result: 'win' | 'loss' | 'push';
  timestamp: string;
  actualOdds: number;
  profit?: number;
  sport: string;
  player: string;
  marketType: string;
}

/**
 * Get historical picks for backtesting
 * This is a mock implementation - replace with actual database queries
 */
export async function getHistoricalPicks(startDate: string, endDate: string): Promise<HistoricalPick[]> {
  // Mock data for testing - replace with actual database implementation
  const mockPicks: HistoricalPick[] = [
    {
      id: '1',
      features: {
        propId: 'test-prop-1',
        gameId: 'nba-2024-01-15-lal-gsw',
        player: 'LeBron James',
        sport: 'NBA',
        league: 'NBA',
        marketType: 'points',
        odds: -110,
        date: '2024-01-15',
        market: {
          type: 'points',
          odds: -110,
          line: 25.5
        },
        expectedValue: 15.2,
        lineMovement: 2.1,
        matchupRating: 8.5,
        playerForm: 7.8,
        injuryImpact: 0.1,
        weatherImpact: 0,
        marketIntelligence: 7.5,
        sharpMoney: 6.9,
        volumeProfile: 6.8,
        closingLineValue: 7.1,
        playerFatigue: 0.3,
        venueAdvantage: 0.2,
        refereeImpact: 0.1,
        paceImpact: 0.4,
        motivationalFactors: 6.5,
        correlationRisk: 0.2,
        portfolioImpact: 0.15,
        dataQuality: {
          dataValidationScore: 9.2,
          outlierScore: 8.8,
          consistencyScore: 9.0,
          completeness: 0.95
        },
        version: '1.0',
        source: 'test',
        situationalPerformance: 7.2,
        volatility: 0.25,
        confidence: 82.5,
        timestamp: new Date().toISOString()
      },
      result: 'win',
      timestamp: '2024-01-15T20:00:00Z',
      actualOdds: -110,
      profit: 0.91,
      sport: 'NBA',
      player: 'LeBron James',
      marketType: 'points'
    },
    {
      id: '2',
      features: {
        propId: 'test-prop-2',
        gameId: 'nba-2024-01-15-gsw-lal',
        player: 'Stephen Curry',
        sport: 'NBA',
        league: 'NBA',
        marketType: 'threes',
        odds: +105,
        date: '2024-01-15',
        market: {
          type: 'threes',
          odds: +105,
          line: 4.5
        },
        expectedValue: 12.8,
        lineMovement: -1.5,
        matchupRating: 7.9,
        playerForm: 8.2,
        injuryImpact: 0,
        weatherImpact: 0,
        marketIntelligence: 7.5,
        sharpMoney: 6.5,
        volumeProfile: 7.2,
        closingLineValue: 6.8,
        playerFatigue: 0.2,
        venueAdvantage: 0.3,
        refereeImpact: 0.1,
        paceImpact: 0.5,
        motivationalFactors: 6.8,
        correlationRisk: 0.18,
        portfolioImpact: 0.12,
        dataQuality: {
          dataValidationScore: 8.9,
          outlierScore: 8.5,
          consistencyScore: 8.7,
          completeness: 0.92
        },
        version: '1.0',
        source: 'test',
        volatility: 0.18,
        confidence: 75.3,
        timestamp: new Date().toISOString()
      },
      result: 'loss',
      timestamp: '2024-01-15T20:30:00Z',
      actualOdds: +105,
      profit: -1.0,
      sport: 'NBA',
      player: 'Stephen Curry',
      marketType: 'threes'
    }
  ];

  // Filter by date range (basic implementation)
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return mockPicks.filter(pick => {
    const pickDate = new Date(pick.timestamp);
    return pickDate >= start && pickDate <= end;
  });
}

/**
 * Save a pick result to the database
 * This is a mock implementation - replace with actual database operations
 */
export async function savePick(pick: HistoricalPick): Promise<void> {
  // Mock implementation - replace with actual database save
  console.log('Saving pick:', pick.id);
}

/**
 * Get pick by ID
 * This is a mock implementation - replace with actual database queries
 */
export async function getPickById(id: string): Promise<HistoricalPick | null> {
  // Mock implementation - replace with actual database query
  const picks = await getHistoricalPicks('2024-01-01', '2024-12-31');
  return picks.find(pick => pick.id === id) || null;
}
