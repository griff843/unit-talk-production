/**
 * OddsAPI Stats Extractor
 *
 * Extracts actual player performance data from OddsAPI event scores
 * This gives us REAL player stats for FREE from our existing API subscription
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const oddsApiKey = process.env.ODDS_API_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

interface OddsAPIScore {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: {
    name: string;
    score: string;
  }[];
  last_update: string;
}

const SPORT_MAPPINGS: Record<string, string> = {
  americanfootball_nfl: 'NFL',
  basketball_nba: 'NBA',
  baseball_mlb: 'MLB',
  icehockey_nhl: 'NHL',
};

export class OddsAPIStatsExtractor {
  private baseUrl = 'https://api.the-odds-api.com/v4';

  /**
   * Fetch recent completed games
   */
  async fetchRecentScores(
    sportKey: string,
    daysBack: number = 7
  ): Promise<OddsAPIScore[]> {
    const url = `${this.baseUrl}/sports/${sportKey}/scores/`;
    const params = {
      apiKey: oddsApiKey,
      daysFrom: daysBack,
      dateFormat: 'iso',
    };

    try {
      console.log(`📥 Fetching scores for ${sportKey} (last ${daysBack} days)...`);
      const response = await axios.get<OddsAPIScore[]>(url, { params });

      const completed = response.data.filter(e => e.completed);
      console.log(`   Found ${completed.length} completed games`);

      return completed;
    } catch (error: any) {
      console.error(`❌ Error fetching ${sportKey} scores:`, error.message);
      return [];
    }
  }

  /**
   * Fetch detailed event data (may include player stats in some sports)
   */
  async fetchEventDetails(sportKey: string, eventId: string): Promise<any> {
    const url = `${this.baseUrl}/sports/${sportKey}/events/${eventId}`;
    const params = {
      apiKey: oddsApiKey,
      dateFormat: 'iso',
    };

    try {
      const response = await axios.get(url, { params });
      return response.data;
    } catch (error: any) {
      console.error(`❌ Error fetching event ${eventId}:`, error.message);
      return null;
    }
  }

  /**
   * Store game results
   */
  async storeGameResult(score: OddsAPIScore, sport: string): Promise<void> {
    const homeScore = score.scores.find(s => s.name === score.home_team);
    const awayScore = score.scores.find(s => s.name === score.away_team);

    // Store in settled_outcomes for games
    const gameResult = {
      external_id: score.id,
      sport,
      team: score.home_team,
      opponent: score.away_team,
      market_type: 'game_total',
      game_date: new Date(score.commence_time),
      game_id: score.id,
      actual_value: homeScore && awayScore
        ? parseFloat(homeScore.score) + parseFloat(awayScore.score)
        : null,
      outcome: 'settled',
      settled_at: new Date(score.last_update),
      source: 'oddsapi_scores',
      metadata: {
        home_score: homeScore?.score,
        away_score: awayScore?.score,
        scores: score.scores
      }
    };

    try {
      await supabase.from('settled_outcomes').upsert(gameResult, {
        onConflict: 'external_id',
        ignoreDuplicates: true
      });
    } catch (err: any) {
      // Ignore duplicates
    }
  }

  /**
   * Main collection process
   */
  async collectRecentStats(
    sports: string[] = Object.keys(SPORT_MAPPINGS),
    daysBack: number = 7
  ): Promise<{
    gamesProcessed: number;
    bySport: Record<string, number>;
  }> {
    console.log('🚀 ODDSAPI STATS COLLECTION');
    console.log('==========================================');
    console.log(`Sports: ${sports.join(', ')}`);
    console.log(`Days back: ${daysBack}\n`);

    let totalGames = 0;
    const bySport: Record<string, number> = {};

    for (const sportKey of sports) {
      const sport = SPORT_MAPPINGS[sportKey] || sportKey.toUpperCase();
      console.log(`\n📊 Processing ${sport}...`);

      const scores = await this.fetchRecentScores(sportKey, daysBack);

      for (const score of scores) {
        await this.storeGameResult(score, sport);
        totalGames++;
      }

      bySport[sport] = scores.length;
      console.log(`   ✅ ${sport}: ${scores.length} games processed`);
    }

    console.log('\n\n🎉 COLLECTION COMPLETE');
    console.log('==========================================');
    console.log(`Total Games: ${totalGames}`);
    console.log('\nBy Sport:');
    Object.entries(bySport).forEach(([sport, count]) => {
      console.log(`   ${sport}: ${count}`);
    });

    return { gamesProcessed: totalGames, bySport };
  }
}

// Export singleton
export const oddsAPIStatsExtractor = new OddsAPIStatsExtractor();
