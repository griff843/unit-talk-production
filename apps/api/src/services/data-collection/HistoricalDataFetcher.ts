/**
 * Historical Data Fetcher
 *
 * Fetches settled historical props from OddsAPI for ML training
 * Supports all major sports: NFL, NBA, MLB, NHL, NCAAF, NCAAB, WNBA
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const oddsApiKey = process.env.ODDS_API_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

interface HistoricalEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  completed: boolean;
  scores: {
    name: string;
    score: number;
  }[];
  last_update: string;
}

interface HistoricalOdds {
  id: string;
  sport_key: string;
  bookmakers: {
    key: string;
    title: string;
    markets: {
      key: string;
      outcomes: {
        name: string;
        price: number;
        point?: number;
      }[];
    }[];
  }[];
}

const SPORT_MAPPINGS: Record<string, string> = {
  americanfootball_nfl: 'NFL',
  americanfootball_ncaaf: 'NCAAF',
  basketball_nba: 'NBA',
  basketball_ncaab: 'NCAAB',
  basketball_wnba: 'WNBA',
  baseball_mlb: 'MLB',
  icehockey_nhl: 'NHL',
};

const SUPPORTED_MARKETS = [
  'player_points',
  'player_rebounds',
  'player_assists',
  'player_threes',
  'player_blocks',
  'player_steals',
  'player_turnovers',
  'player_points_rebounds_assists',
  'player_points_rebounds',
  'player_points_assists',
  'player_rebounds_assists',
  // MLB
  'batter_total_bases',
  'batter_hits',
  'batter_home_runs',
  'batter_rbis',
  'batter_runs_scored',
  'batter_stolen_bases',
  'batter_strikeouts',
  'pitcher_strikeouts',
  'pitcher_hits_allowed',
  'pitcher_walks',
  'pitcher_earned_runs',
  // NFL
  'player_pass_tds',
  'player_pass_yds',
  'player_pass_completions',
  'player_pass_attempts',
  'player_pass_interceptions',
  'player_rush_yds',
  'player_rush_attempts',
  'player_receptions',
  'player_reception_yds',
  'player_kicking_points',
  'player_field_goals',
  'player_tackles_assists',
  'player_sacks',
  // NHL
  'player_points',
  'player_assists',
  'player_shots_on_goal',
  'player_blocked_shots',
  'player_power_play_points',
  'goalie_saves',
];

export class HistoricalDataFetcher {
  private baseUrl = 'https://api.the-odds-api.com/v4';
  private rateLimitDelay = 1000; // 1 second between requests

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch historical events for a sport
   */
  private async fetchHistoricalEvents(
    sportKey: string,
    daysBack: number = 90
  ): Promise<HistoricalEvent[]> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - daysBack);
    const dateFromStr = dateFrom.toISOString().split('T')[0];

    const url = `${this.baseUrl}/sports/${sportKey}/scores/`;
    const params = {
      apiKey: oddsApiKey,
      daysFrom: daysBack,
      dateFormat: 'iso',
    };

    try {
      console.log(`📥 Fetching historical events for ${sportKey}...`);
      const response = await axios.get<HistoricalEvent[]>(url, { params });

      const completedEvents = response.data.filter((e) => e.completed);
      console.log(`   Found ${completedEvents.length} completed events`);

      return completedEvents;
    } catch (error: any) {
      console.error(`❌ Error fetching ${sportKey} events:`, error.message);
      return [];
    }
  }

  /**
   * Fetch historical odds for an event
   */
  private async fetchHistoricalOdds(
    sportKey: string,
    eventId: string
  ): Promise<HistoricalOdds | null> {
    const url = `${this.baseUrl}/sports/${sportKey}/events/${eventId}/odds`;
    const params = {
      apiKey: oddsApiKey,
      regions: 'us',
      markets: SUPPORTED_MARKETS.join(','),
      oddsFormat: 'american',
      dateFormat: 'iso',
    };

    try {
      const response = await axios.get<HistoricalOdds>(url, { params });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Event not found or odds expired
        return null;
      }
      console.error(`❌ Error fetching odds for ${eventId}:`, error.message);
      return null;
    }
  }

  /**
   * Process and store settled outcomes
   */
  private async storeSettledOutcomes(
    event: HistoricalEvent,
    odds: HistoricalOdds,
    sport: string
  ): Promise<number> {
    let stored = 0;

    for (const bookmaker of odds.bookmakers) {
      for (const market of bookmaker.markets) {
        // Only process player props
        if (!market.key.startsWith('player_')) continue;

        for (const outcome of market.outcomes) {
          // Determine if this was a win/loss based on actual game stats
          // This is simplified - in production you'd need to fetch actual player stats
          const settledOutcome = {
            external_id: `${event.id}_${market.key}_${outcome.name}`,
            sport,
            player_name: outcome.name,
            market_type: market.key,
            market_selection: outcome.point !== undefined ? 'over' : undefined,
            line: outcome.point || 0,
            odds: outcome.price,
            game_date: new Date(event.commence_time),
            game_id: event.id,
            actual_value: null, // Would need to fetch from stats API
            outcome: 'pending', // Would need to determine from stats
            settled_at: new Date(event.last_update),
            bookmaker: bookmaker.key,
            source: 'oddsapi_historical',
            metadata: {
              sport_key: event.sport_key,
              event: event,
              bookmaker: bookmaker.title,
            },
          };

          try {
            const { error } = await supabase.from('settled_outcomes').upsert(settledOutcome, {
              onConflict: 'external_id',
              ignoreDuplicates: true,
            });

            if (!error) {
              stored++;
            }
          } catch (err) {
            // Ignore duplicates
          }
        }
      }
    }

    return stored;
  }

  /**
   * Main fetch process
   */
  async fetchHistoricalData(
    sports: string[] = Object.keys(SPORT_MAPPINGS),
    daysBack: number = 90
  ): Promise<{
    totalEvents: number;
    totalProps: number;
    bySport: Record<string, number>;
  }> {
    console.log('🚀 HISTORICAL DATA FETCH STARTED');
    console.log('==========================================');
    console.log(`Sports: ${sports.join(', ')}`);
    console.log(`Days back: ${daysBack}`);
    console.log('');

    let totalEvents = 0;
    let totalProps = 0;
    const bySport: Record<string, number> = {};

    for (const sportKey of sports) {
      const sport = SPORT_MAPPINGS[sportKey] || sportKey.toUpperCase();
      console.log(`\n📊 Processing ${sport}...`);

      // Fetch completed events
      const events = await this.fetchHistoricalEvents(sportKey, daysBack);
      totalEvents += events.length;

      let sportProps = 0;

      // For each event, fetch historical odds
      for (const event of events) {
        await this.delay(this.rateLimitDelay);

        const odds = await this.fetchHistoricalOdds(sportKey, event.id);
        if (!odds) continue;

        const stored = await this.storeSettledOutcomes(event, odds, sport);
        sportProps += stored;

        if (stored > 0) {
          console.log(`   ✅ Event ${event.id}: ${stored} props stored`);
        }
      }

      bySport[sport] = sportProps;
      totalProps += sportProps;

      console.log(`\n   ${sport} Summary:`);
      console.log(`   - Events: ${events.length}`);
      console.log(`   - Props stored: ${sportProps}`);
    }

    console.log('\n\n🎉 HISTORICAL DATA FETCH COMPLETE');
    console.log('==========================================');
    console.log(`Total Events: ${totalEvents}`);
    console.log(`Total Props: ${totalProps}`);
    console.log('\nBy Sport:');
    Object.entries(bySport).forEach(([sport, count]) => {
      console.log(`   ${sport}: ${count.toLocaleString()}`);
    });

    return { totalEvents, totalProps, bySport };
  }

  /**
   * Fetch specific sport
   */
  async fetchSport(sportKey: string, daysBack: number = 90): Promise<number> {
    const result = await this.fetchHistoricalData([sportKey], daysBack);
    return result.totalProps;
  }
}

// Export singleton instance
export const historicalDataFetcher = new HistoricalDataFetcher();
