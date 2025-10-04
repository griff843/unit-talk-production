/**
 * Props Settlement Engine
 *
 * Retroactively settles 1.4M existing props using real game data
 * - MLB: Uses MLB Stats API for individual player performance
 * - NFL: Uses ESPN/NFL.com APIs for player stats
 *
 * This engine:
 * 1. Queries raw_props for unsettled props
 * 2. Groups by game_date
 * 3. Fetches actual game results from free APIs
 * 4. Matches player performance to prop lines
 * 5. Determines win/loss outcome
 * 6. Populates player_stats AND settled_outcomes tables
 */

import { createClient } from '@supabase/supabase-js';
import { mlbStatsService } from './MLBStatsService';
import { nflStatsService } from './NFLStatsService';
import type { NFLGameStats } from './NFLStatsService';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

interface RawProp {
  id: string;
  sport: string;
  player_name: string;
  market_type: string;
  line: number;
  odds: number;
  game_date: string;
  team?: string;
  opponent?: string;
  game_id?: string;
  bookmaker_key?: string;
  selection?: string;
}

interface SettlementResult {
  propId: string;
  outcome: 'win' | 'loss' | 'push' | 'void';
  actualValue?: number;
  confidence: number;
  settlementMethod: 'exact_match' | 'fuzzy_match' | 'inferred';
}

export class PropsSettlementEngine {
  private logger = console;

  /**
   * Settle MLB props for a specific date
   */
  async settleMLBPropsForDate(date: string): Promise<SettlementResult[]> {
    this.logger.log(`\n📅 Settling MLB props for ${date}...`);

    // Get all unsettled MLB props for this date
    const { data: props, error } = await supabase
      .from('raw_props')
      .select('*')
      .eq('sport', 'MLB')
      .eq('game_date', date)
      .is('result', null);

    if (error || !props || props.length === 0) {
      this.logger.log(`   No unsettled MLB props found for ${date}`);
      return [];
    }

    this.logger.log(`   Found ${props.length} unsettled MLB props`);

    // Fetch MLB box scores for this date
    const games = await mlbStatsService.getSchedule(date);
    const completedGames = games.filter(g => g.status.statusCode === 'F');

    if (completedGames.length === 0) {
      this.logger.log(`   No completed MLB games found for ${date}`);
      return [];
    }

    this.logger.log(`   Processing ${completedGames.length} completed games`);

    const results: SettlementResult[] = [];

    // For each completed game, get box score and settle props
    for (const game of completedGames) {
      const boxscore = await mlbStatsService.getBoxScore(game.gamePk);
      if (!boxscore) continue;

      const playerStats = mlbStatsService.extractPlayerStats(boxscore, date);

      // Store player stats in database
      await mlbStatsService.storePlayerStats(playerStats);

      // Match props to player stats and settle
      const gameResults = await this.settleMLBPropsFromStats(props, playerStats);
      results.push(...gameResults);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.logger.log(`   ✅ Settled ${results.length} MLB props`);
    return results;
  }

  /**
   * Match MLB props to player stats and determine outcomes
   */
  private async settleMLBPropsFromStats(
    props: any[],
    playerStats: any[]
  ): Promise<SettlementResult[]> {
    const results: SettlementResult[] = [];

    for (const prop of props) {
      // Find matching player stat
      const stat = this.findMatchingMLBStat(prop, playerStats);

      if (!stat) {
        // Cannot settle - no matching player found
        continue;
      }

      // Determine prop outcome based on market type
      const outcome = this.determineMLBPropOutcome(prop, stat);

      if (outcome) {
        results.push(outcome);

        // Store settled outcome in database
        await this.storeSettledOutcome(prop, outcome);
      }
    }

    return results;
  }

  /**
   * Find matching player stat for MLB prop
   */
  private findMatchingMLBStat(prop: any, playerStats: any[]): any | null {
    // Try exact name match first
    let match = playerStats.find(
      stat => stat.playerName.toLowerCase() === prop.player_name.toLowerCase()
    );

    if (match) return match;

    // Try fuzzy match (handles name variations)
    const propNameParts = prop.player_name.toLowerCase().split(' ');
    match = playerStats.find(stat => {
      const statNameParts = stat.playerName.toLowerCase().split(' ');

      // Match last name at minimum
      return propNameParts[propNameParts.length - 1] ===
             statNameParts[statNameParts.length - 1];
    });

    return match || null;
  }

  /**
   * Determine MLB prop outcome from player stats
   */
  private determineMLBPropOutcome(prop: any, stat: any): SettlementResult | null {
    // Use stat_type (raw_props field) or market_type (unified_picks field)
    const marketType = (prop.stat_type || prop.market_type || '').toLowerCase();
    const line = parseFloat(prop.line);
    const selection = prop.selection?.toLowerCase() || 'over';

    let actualValue: number | undefined;
    let outcome: 'win' | 'loss' | 'push' | 'void' = 'void';

    // Map market type to actual stat value
    if (marketType.includes('total_bases') || marketType.includes('total bases')) {
      actualValue = stat.stats.totalBases;
    } else if (marketType.includes('hits')) {
      actualValue = stat.stats.hits;
    } else if (marketType.includes('home_runs') || marketType.includes('home runs')) {
      actualValue = stat.stats.homeRuns;
    } else if (marketType.includes('rbi') || marketType.includes('runs batted in')) {
      actualValue = stat.stats.rbi;
    } else if (marketType.includes('strikeouts') && marketType.includes('pitcher')) {
      actualValue = stat.stats.pitchingStrikeouts;
    } else if (marketType.includes('earned_runs')) {
      actualValue = stat.stats.earnedRuns;
    } else if (marketType.includes('runs')) {
      actualValue = stat.stats.runs;
    } else if (marketType.includes('stolen_bases') || marketType.includes('stolen bases')) {
      actualValue = stat.stats.stolenBases;
    }

    if (actualValue === undefined || actualValue === null) {
      // Cannot determine outcome - stat not available
      return null;
    }

    // Determine win/loss based on over/under
    if (selection === 'over') {
      if (actualValue > line) outcome = 'win';
      else if (actualValue < line) outcome = 'loss';
      else outcome = 'push';
    } else if (selection === 'under') {
      if (actualValue < line) outcome = 'win';
      else if (actualValue > line) outcome = 'loss';
      else outcome = 'push';
    }

    return {
      propId: prop.id,
      outcome,
      actualValue,
      confidence: 0.95, // High confidence for exact stat match
      settlementMethod: 'exact_match',
    };
  }

  /**
   * Store settled outcome in database
   */
  private async storeSettledOutcome(prop: any, settlement: SettlementResult): Promise<void> {
    const record = {
      prop_id: prop.id,
      sport: prop.sport,
      player_name: prop.player_name,
      market_type: prop.stat_type || prop.market_type, // Use stat_type from raw_props
      line: prop.line,
      odds: prop.odds,
      selection: prop.selection,
      outcome: settlement.outcome,
      actual_value: settlement.actualValue,
      game_date: prop.game_date,
      settled_at: new Date().toISOString(),
      settlement_method: settlement.settlementMethod,
      confidence: settlement.confidence,
      season: new Date(prop.game_date).getFullYear(),
    };

    try {
      // Check if already settled (to avoid duplicates)
      const { data: existing } = await supabase
        .from('settled_outcomes')
        .select('prop_id')
        .eq('prop_id', record.prop_id)
        .single();

      if (existing) {
        // Already settled, skip
        return;
      }

      // Insert new settlement
      const { error: insertError } = await supabase
        .from('settled_outcomes')
        .insert(record);

      if (insertError) {
        // Ignore duplicate errors
        if (!insertError.message.includes('duplicate') && !insertError.message.includes('unique')) {
          this.logger.error('Failed to insert settled_outcome:', insertError.message);
        }
        return;
      }

      // Also update the raw_props table with result
      const { error: updateError } = await supabase
        .from('raw_props')
        .update({ result: settlement.outcome })
        .eq('id', prop.id);

      if (updateError) {
        this.logger.error('Failed to update raw_props:', updateError.message);
      }
    } catch (error: any) {
      this.logger.error('Failed to store settled outcome:', error.message);
      this.logger.error(error.stack);
    }
  }

  /**
   * Settle MLB props for date range
   */
  async settleMLBPropsForDateRange(startDate: string, endDate: string): Promise<number> {
    this.logger.log('🏀 MLB PROPS SETTLEMENT ENGINE');
    this.logger.log('==========================================');
    this.logger.log(`Date Range: ${startDate} to ${endDate}\n`);

    const start = new Date(startDate);
    const end = new Date(endDate);
    let totalSettled = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const results = await this.settleMLBPropsForDate(dateStr);
      totalSettled += results.length;
    }

    this.logger.log('\n\n🎉 SETTLEMENT COMPLETE');
    this.logger.log('==========================================');
    this.logger.log(`Total Props Settled: ${totalSettled}`);

    return totalSettled;
  }

  /**
   * Settle recent MLB props (last N days)
   */
  async settleRecentMLBProps(daysBack: number = 7): Promise<number> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    return this.settleMLBPropsForDateRange(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
  }

  /**
   * Get settlement statistics
   */
  async getSettlementStats(): Promise<any> {
    const { count: totalRawProps } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true });

    const { count: settledCount } = await supabase
      .from('settled_outcomes')
      .select('*', { count: 'exact', head: true });

    const { count: unsettledCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .is('result', null);

    const { data: outcomeBreakdown } = await supabase
      .from('settled_outcomes')
      .select('outcome');

    const outcomes: Record<string, number> = {
      win: 0,
      loss: 0,
      push: 0,
      void: 0,
    };

    outcomeBreakdown?.forEach(o => {
      outcomes[o.outcome] = (outcomes[o.outcome] || 0) + 1;
    });

    return {
      totalRawProps: totalRawProps || 0,
      settledCount: settledCount || 0,
      unsettledCount: unsettledCount || 0,
      settlementRate: ((settledCount || 0) / (totalRawProps || 1)) * 100,
      outcomeBreakdown: outcomes,
      winRate: (outcomes.win / ((settledCount || 1) - outcomes.void)) * 100,
    };
  }

  /**
   * Settle NFL props for a specific date
   */
  async settleNFLPropsForDate(date: string): Promise<SettlementResult[]> {
    this.logger.log(`\n📅 Settling NFL props for ${date}...`);

    // Get all unsettled NFL props for this date
    const { data: props, error } = await supabase
      .from('raw_props')
      .select('*')
      .eq('sport', 'NFL')
      .eq('game_date', date)
      .is('result', null);

    if (error || !props || props.length === 0) {
      this.logger.log(`   No unsettled NFL props found for ${date}`);
      return [];
    }

    this.logger.log(`   Found ${props.length} unsettled NFL props`);

    // Collect NFL stats for this date
    const statsCollected = await nflStatsService.collectStatsForDate(date);

    if (statsCollected === 0) {
      this.logger.log(`   No NFL stats found for ${date}`);
      return [];
    }

    // Get the stats we just collected
    const { data: playerStats } = await supabase
      .from('player_stats')
      .select('*')
      .eq('sport', 'NFL')
      .eq('game_date', date);

    if (!playerStats || playerStats.length === 0) {
      return [];
    }

    // Match props to player stats and settle
    const results = await this.settleNFLPropsFromStats(props, playerStats);

    this.logger.log(`   ✅ Settled ${results.length} NFL props`);
    return results;
  }

  /**
   * Match NFL props to player stats and determine outcomes
   */
  private async settleNFLPropsFromStats(
    props: any[],
    playerStats: any[]
  ): Promise<SettlementResult[]> {
    const results: SettlementResult[] = [];

    for (const prop of props) {
      // Find matching player stat
      const stat = this.findMatchingNFLStat(prop, playerStats);

      if (!stat) {
        continue;
      }

      // Determine prop outcome based on market type
      const outcome = this.determineNFLPropOutcome(prop, stat);

      if (outcome) {
        results.push(outcome);
        await this.storeSettledOutcome(prop, outcome);
      }
    }

    return results;
  }

  /**
   * Find matching player stat for NFL prop
   */
  private findMatchingNFLStat(prop: any, playerStats: any[]): any | null {
    // Try exact name match first
    let match = playerStats.find(
      stat => stat.player_name.toLowerCase() === prop.player_name.toLowerCase()
    );

    if (match) return match;

    // Try fuzzy match
    const propNameParts = prop.player_name.toLowerCase().split(' ');
    match = playerStats.find(stat => {
      const statNameParts = stat.player_name.toLowerCase().split(' ');
      return propNameParts[propNameParts.length - 1] ===
             statNameParts[statNameParts.length - 1];
    });

    return match || null;
  }

  /**
   * Determine NFL prop outcome from player stats
   */
  private determineNFLPropOutcome(prop: any, stat: any): SettlementResult | null {
    // Use stat_type (raw_props field) or market_type (unified_picks field)
    const marketType = (prop.stat_type || prop.market_type || '').toLowerCase();
    const line = parseFloat(prop.line);
    const selection = prop.selection?.toLowerCase() || 'over';

    let actualValue: number | undefined;
    let outcome: 'win' | 'loss' | 'push' | 'void' = 'void';

    // Map market type to actual stat value
    if (marketType.includes('pass') && marketType.includes('yds')) {
      actualValue = stat.stats.passingYards;
    } else if (marketType.includes('pass') && marketType.includes('td')) {
      actualValue = stat.stats.passingTDs;
    } else if (marketType.includes('rush') && marketType.includes('yds')) {
      actualValue = stat.stats.rushingYards;
    } else if (marketType.includes('rush') && marketType.includes('td')) {
      actualValue = stat.stats.rushingTDs;
    } else if (marketType.includes('rec') && marketType.includes('yds')) {
      actualValue = stat.stats.receivingYards;
    } else if (marketType.includes('rec') && marketType.includes('td')) {
      actualValue = stat.stats.receivingTDs;
    } else if (marketType.includes('receptions')) {
      actualValue = stat.stats.receptions;
    } else if (marketType.includes('tackle')) {
      actualValue = stat.stats.tackles;
    } else if (marketType.includes('sack')) {
      actualValue = stat.stats.sacks;
    } else if (marketType.includes('interceptions')) {
      actualValue = stat.stats.interceptions;
    }

    if (actualValue === undefined || actualValue === null) {
      return null;
    }

    // Determine win/loss
    if (selection === 'over') {
      if (actualValue > line) outcome = 'win';
      else if (actualValue < line) outcome = 'loss';
      else outcome = 'push';
    } else if (selection === 'under') {
      if (actualValue < line) outcome = 'win';
      else if (actualValue > line) outcome = 'loss';
      else outcome = 'push';
    }

    return {
      propId: prop.id,
      outcome,
      actualValue,
      confidence: 0.95,
      settlementMethod: 'exact_match',
    };
  }

  /**
   * Settle recent NFL props (last N weeks)
   */
  async settleRecentNFLProps(weeksBack: number = 4): Promise<number> {
    const endDate = new Date();
    let totalSettled = 0;

    for (let i = 0; i < weeksBack; i++) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - (i * 7));
      const dateStr = date.toISOString().split('T')[0];

      const results = await this.settleNFLPropsForDate(dateStr);
      totalSettled += results.length;
    }

    return totalSettled;
  }

  /**
   * Settle ALL 1.4M MLB props (batch processing)
   */
  async settleAllMLBProps(batchSize: number = 30): Promise<void> {
    this.logger.log('🚀 SETTLING ALL 1.4M MLB PROPS');
    this.logger.log('==========================================\n');

    // Get date range from raw_props
    const { data: dateRange } = await supabase
      .from('raw_props')
      .select('game_date')
      .eq('sport', 'MLB')
      .not('game_date', 'is', null)
      .order('game_date', { ascending: true })
      .limit(1);

    const { data: latestDate } = await supabase
      .from('raw_props')
      .select('game_date')
      .eq('sport', 'MLB')
      .not('game_date', 'is', null)
      .order('game_date', { ascending: false })
      .limit(1);

    if (!dateRange || !latestDate) {
      this.logger.error('Could not determine date range from raw_props');
      return;
    }

    const startDate = dateRange[0].game_date;
    const endDate = latestDate[0].game_date;

    this.logger.log(`Date Range: ${startDate} to ${endDate}`);
    this.logger.log(`Processing in batches of ${batchSize} days\n`);

    // Process in batches
    const start = new Date(startDate);
    const end = new Date(endDate);
    let totalSettled = 0;

    for (let d = new Date(start); d <= end; ) {
      const batchStart = new Date(d);
      const batchEnd = new Date(d);
      batchEnd.setDate(batchEnd.getDate() + batchSize);

      if (batchEnd > end) {
        batchEnd.setTime(end.getTime());
      }

      this.logger.log(`\nProcessing batch: ${batchStart.toISOString().split('T')[0]} to ${batchEnd.toISOString().split('T')[0]}`);

      const settled = await this.settleMLBPropsForDateRange(
        batchStart.toISOString().split('T')[0],
        batchEnd.toISOString().split('T')[0]
      );

      totalSettled += settled;

      // Show progress
      const stats = await this.getSettlementStats();
      this.logger.log(`\n📊 Progress: ${stats.settledCount} / ${stats.totalRawProps} (${stats.settlementRate.toFixed(1)}%)`);

      // Move to next batch
      d.setDate(d.getDate() + batchSize + 1);
    }

    this.logger.log('\n\n🎉 ALL MLB PROPS SETTLED');
    this.logger.log('==========================================');
    const finalStats = await this.getSettlementStats();
    this.logger.log(`Total Settled: ${finalStats.settledCount}`);
    this.logger.log(`Win Rate: ${finalStats.winRate.toFixed(2)}%`);
    this.logger.log('\nOutcome Breakdown:');
    Object.entries(finalStats.outcomeBreakdown).forEach(([outcome, count]) => {
      this.logger.log(`   ${outcome}: ${count}`);
    });
  }
}

// Export singleton
export const propsSettlementEngine = new PropsSettlementEngine();
