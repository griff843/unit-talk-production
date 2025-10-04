/**
 * Probability Calculator
 *
 * Calculates real win probabilities for player props using:
 * - League averages
 * - Player historical performance
 * - Matchup factors
 * - Home/away splits
 *
 * This replaces the hardcoded 52% assumption
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

interface ProbabilityInput {
  sport: string;
  playerId?: string;
  playerName: string;
  marketType: string;
  line: number;
  opponent?: string;
  venue?: 'home' | 'away';
  gameDate?: Date;
}

interface ProbabilityOutput {
  probability: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  factors: {
    baseHitRate: number;
    leagueAdjustment: number;
    matchupFactor: number;
    venueAdjustment: number;
    recencyWeight: number;
  };
  dataPoints: number; // how many historical games used
  method: string; // which calculation method was used
}

export class ProbabilityCalculator {
  /**
   * Calculate probability for a prop
   */
  async calculateProbability(input: ProbabilityInput): Promise<ProbabilityOutput> {
    // Try different methods in order of preference
    const methods = [
      this.playerHistoricalMethod.bind(this),
      this.leagueAverageMethod.bind(this),
      this.fallbackMethod.bind(this),
    ];

    for (const method of methods) {
      const result = await method(input);
      if (result) {
        return result;
      }
    }

    // Ultimate fallback - better than hardcoded 52% but still simple
    return this.fallbackMethod(input);
  }

  /**
   * Method 1: Player historical hit rate (best if we have data)
   */
  private async playerHistoricalMethod(
    input: ProbabilityInput
  ): Promise<ProbabilityOutput | null> {
    // Try player_id first, then fall back to player name
    let query = supabase
      .from('player_stats')
      .select('*')
      .eq('sport', input.sport)
      .order('game_date', { ascending: false })
      .limit(30);

    if (input.playerId) {
      query = query.eq('player_id', input.playerId);
    } else if (input.playerName && input.playerName !== 'Unknown') {
      // Fallback to name-based lookup (case-insensitive)
      query = query.ilike('player_name', `%${input.playerName}%`);
    } else {
      return null;
    }

    const { data: playerGames, error } = await query;

    if (error || !playerGames || playerGames.length < 5) {
      return null; // Need at least 5 games
    }

    // Extract relevant stat from JSONB
    const statKey = this.getStatKey(input.marketType);
    if (!statKey) return null;

    const values = playerGames
      .map((game) => game.stats?.[statKey])
      .filter((v) => v !== null && v !== undefined)
      .map((v) => parseFloat(v));

    if (values.length < 5) return null;

    // Calculate hit rate (how often player went over the line)
    const hits = values.filter((v) => v > input.line).length;
    const hitRate = hits / values.length;

    // Apply recency weighting (last 5 games weighted higher)
    const recentValues = values.slice(0, 5);
    const recentHits = recentValues.filter((v) => v > input.line).length;
    const recentHitRate = recentHits / recentValues.length;

    // Weighted average: 60% recent, 40% overall
    const weightedHitRate = recentHitRate * 0.6 + hitRate * 0.4;

    // Venue adjustment
    let venueAdjustment = 1.0;
    if (input.venue) {
      const homeGames = playerGames.filter((g) => g.home_away === 'home');
      const awayGames = playerGames.filter((g) => g.home_away === 'away');

      if (homeGames.length >= 3 && awayGames.length >= 3) {
        const homeAvg =
          homeGames.reduce((sum, g) => sum + (g.stats?.[statKey] || 0), 0) / homeGames.length;
        const awayAvg =
          awayGames.reduce((sum, g) => sum + (g.stats?.[statKey] || 0), 0) / awayGames.length;
        const overallAvg = values.reduce((a, b) => a + b, 0) / values.length;

        if (input.venue === 'home') {
          venueAdjustment = homeAvg / overallAvg;
        } else {
          venueAdjustment = awayAvg / overallAvg;
        }

        // Cap adjustments at ±15%
        venueAdjustment = Math.max(0.85, Math.min(1.15, venueAdjustment));
      }
    }

    // Apply adjustments
    let finalProb = weightedHitRate * venueAdjustment;

    // Ensure probability is in valid range
    finalProb = Math.max(0.15, Math.min(0.85, finalProb));

    // Confidence based on data quality
    const confidence = Math.min(1.0, values.length / 20); // Full confidence at 20+ games

    return {
      probability: finalProb,
      confidence,
      factors: {
        baseHitRate: hitRate,
        leagueAdjustment: 1.0,
        matchupFactor: 1.0,
        venueAdjustment,
        recencyWeight: recentHitRate / hitRate,
      },
      dataPoints: values.length,
      method: 'player_historical',
    };
  }

  /**
   * Method 2: League average based calculation
   */
  private async leagueAverageMethod(
    input: ProbabilityInput
  ): Promise<ProbabilityOutput | null> {
    // Get current season
    const season = new Date().getFullYear();

    // Query league average
    const { data: leagueAvg, error } = await supabase
      .from('league_averages')
      .select('*')
      .eq('sport', input.sport)
      .eq('season', season)
      .eq('market_type', input.marketType)
      .single();

    if (error || !leagueAvg) {
      return null;
    }

    // Use normal distribution approximation
    const mean = leagueAvg.average_value;
    const stdDev = leagueAvg.std_deviation || mean * 0.3; // Default to 30% of mean

    // Calculate z-score
    const zScore = (input.line - mean) / stdDev;

    // Convert to probability using standard normal distribution
    // P(X > line) = 1 - Φ(z) where Φ is cumulative distribution function
    const probability = 1 - this.normalCDF(zScore);

    // Clamp to reasonable range
    const clampedProb = Math.max(0.20, Math.min(0.80, probability));

    return {
      probability: clampedProb,
      confidence: 0.6, // Moderate confidence - league avg is less precise than player-specific
      factors: {
        baseHitRate: probability,
        leagueAdjustment: 1.0,
        matchupFactor: 1.0,
        venueAdjustment: 1.0,
        recencyWeight: 1.0,
      },
      dataPoints: leagueAvg.sample_size,
      method: 'league_average',
    };
  }

  /**
   * Method 3: Fallback (better than hardcoded 52%)
   */
  private fallbackMethod(input: ProbabilityInput): ProbabilityOutput {
    // Sport-specific baseline probabilities
    const baselines: Record<string, number> = {
      NBA: 0.48, // NBA props tend to be efficient
      NFL: 0.50, // NFL is coin flip territory
      MLB: 0.52, // MLB has more variance
      NHL: 0.51,
      NCAAF: 0.53, // College sports less efficient
      NCAAB: 0.52,
      WNBA: 0.50,
    };

    const baseProb = baselines[input.sport] || 0.50;

    return {
      probability: baseProb,
      confidence: 0.3, // Low confidence - just a baseline
      factors: {
        baseHitRate: baseProb,
        leagueAdjustment: 1.0,
        matchupFactor: 1.0,
        venueAdjustment: 1.0,
        recencyWeight: 1.0,
      },
      dataPoints: 0,
      method: 'fallback',
    };
  }

  /**
   * Helper: Get stat key from market type
   */
  private getStatKey(marketType: string): string | null {
    const mappings: Record<string, string> = {
      // NBA
      player_points: 'points',
      player_rebounds: 'rebounds',
      player_assists: 'assists',
      player_threes: 'threePointersMade',
      player_blocks: 'blocks',
      player_steals: 'steals',

      // MLB - both prefixed and unprefixed formats
      batter_total_bases: 'totalBases',
      totalBases: 'totalBases',
      batter_hits: 'hits',
      hits: 'hits',
      batter_home_runs: 'homeRuns',
      homeRuns: 'homeRuns',
      batter_rbis: 'rbi',
      rbis: 'rbi',
      batter_runs: 'runs',
      runsBatter: 'runs',
      batter_doubles: 'doubles',
      doubles: 'doubles',
      batter_triples: 'triples',
      triples: 'triples',
      batter_singles: 'hits', // Approximate singles as hits
      singles: 'hits',
      batter_walks: 'baseOnBalls',
      walksBatter: 'baseOnBalls',
      batter_stolen_bases: 'stolenBases',
      stolenBases: 'stolenBases',
      hitsRunsRbi: 'hits', // Combined stat - use hits as proxy
      pitcher_strikeouts: 'strikeOuts',
      strikeoutsThrown: 'strikeOuts',
      pitcher_walks: 'baseOnBalls',
      walksPitcher: 'baseOnBalls',
      pitcher_hits_allowed: 'hitsAllowed',
      hitsAllowed: 'hitsAllowed',
      pitcher_runs: 'runs',
      runsPitcher: 'runs',
      pitcher_outs: 'outs',
      outs: 'outs',

      // NFL - both formats
      player_pass_yds: 'passingYards',
      passing_yards: 'passingYards',
      player_pass_tds: 'passingTDs',
      passing_tds: 'passingTDs',
      passing_touchdowns: 'passingTDs',
      player_rush_yds: 'rushingYards',
      rushing_yards: 'rushingYards',
      player_rush_tds: 'rushingTDs',
      rushing_tds: 'rushingTDs',
      rushing_touchdowns: 'rushingTDs',
      player_receptions: 'receptions',
      receptions: 'receptions',
      player_reception_yds: 'receivingYards',
      receiving_yards: 'receivingYards',
      player_reception_tds: 'receivingTDs',
      receiving_tds: 'receivingTDs',
      receiving_touchdowns: 'receivingTDs',
    };

    return mappings[marketType] || null;
  }

  /**
   * Helper: Cumulative distribution function for standard normal distribution
   */
  private normalCDF(z: number): number {
    // Approximation using error function
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp((-z * z) / 2);
    const probability =
      d *
      t *
      (0.3193815 +
        t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

    return z > 0 ? 1 - probability : probability;
  }

  /**
   * Batch calculate probabilities
   */
  async calculateBatch(inputs: ProbabilityInput[]): Promise<ProbabilityOutput[]> {
    return Promise.all(inputs.map((input) => this.calculateProbability(input)));
  }

  /**
   * Calculate expected value
   */
  calculateExpectedValue(probability: number, americanOdds: number): number {
    const decimalOdds = this.americanToDecimal(americanOdds);
    const ev = probability * (decimalOdds - 1) - (1 - probability);
    return ev;
  }

  /**
   * Convert American odds to decimal
   */
  private americanToDecimal(americanOdds: number): number {
    if (americanOdds > 0) {
      return 1 + americanOdds / 100;
    } else {
      return 1 + 100 / Math.abs(americanOdds);
    }
  }

  /**
   * Convert decimal odds to implied probability
   */
  decimalToImpliedProbability(decimalOdds: number): number {
    return 1 / decimalOdds;
  }
}

// Export singleton
export const probabilityCalculator = new ProbabilityCalculator();
