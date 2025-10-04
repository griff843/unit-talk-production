/**
 * Optimized Props Settlement - Batch Processing
 *
 * Optimizations:
 * 1. Batch by game date (process all props for a date at once)
 * 2. Parallel processing (multiple date ranges simultaneously)
 * 3. In-memory deduplication (faster than DB checks)
 * 4. Bulk inserts (batch database operations)
 *
 * Expected: 100+ props/second (vs 1 prop/second before)
 * Timeline: 3-4 hours for 1.4M props (vs 16 days)
 */

import { createClient } from '@supabase/supabase-js';
import { mlbStatsService } from '../../services/data-collection/MLBStatsService';
import { nflStatsService } from '../../services/data-collection/NFLStatsService';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

interface SettlementBatch {
  outcomes: any[];
  stats: any[];
}

class OptimizedSettlementEngine {
  private settledPropIds = new Set<string>();
  private logger = console;
  private batchSize = 100;

  /**
   * Load already-settled prop IDs into memory for fast lookup
   */
  async loadSettledPropIds(): Promise<void> {
    this.logger.log('📥 Loading settled prop IDs into memory...');

    let offset = 0;
    const limit = 10000;

    while (true) {
      const { data, error } = await supabase
        .from('settled_outcomes')
        .select('prop_id')
        .range(offset, offset + limit - 1);

      if (error || !data || data.length === 0) break;

      data.forEach(row => {
        if (row.prop_id) this.settledPropIds.add(row.prop_id);
      });

      this.logger.log(`   Loaded ${this.settledPropIds.size} settled prop IDs...`);

      if (data.length < limit) break;
      offset += limit;
    }

    this.logger.log(`✅ Loaded ${this.settledPropIds.size} settled prop IDs into memory\n`);
  }

  /**
   * Get unique game dates with unsettled props
   */
  async getUnsettledGameDates(sport: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('raw_props')
      .select('game_date')
      .eq('sport', sport)
      .not('game_date', 'is', null)
      .order('game_date', { ascending: true });

    if (error || !data) {
      this.logger.error('Failed to fetch game dates:', error?.message);
      return [];
    }

    // Get unique dates, filter out already settled
    const uniqueDates = [...new Set(data.map(row => row.game_date))];

    return uniqueDates;
  }

  /**
   * Process MLB props for a specific date (batch mode)
   */
  async settleDateMLB(date: string): Promise<SettlementBatch> {
    const batch: SettlementBatch = {
      outcomes: [],
      stats: []
    };

    try {
      // Get all unsettled props for this date
      const { data: props, error } = await supabase
        .from('raw_props')
        .select('*')
        .eq('sport', 'MLB')
        .eq('game_date', date)
        .limit(10000); // Process up to 10k props per date

      if (error || !props || props.length === 0) {
        return batch;
      }

      // Filter out already settled props (in-memory check - fast!)
      const unsettledProps = props.filter(p => !this.settledPropIds.has(p.id));

      if (unsettledProps.length === 0) {
        return batch;
      }

      this.logger.log(`   ${date}: ${unsettledProps.length} unsettled props`);

      // Fetch ALL games for this date (1 API call)
      const games = await mlbStatsService.getSchedule(date);
      const completedGames = games.filter(g => g.status.statusCode === 'F');

      if (completedGames.length === 0) {
        return batch;
      }

      this.logger.log(`   ${date}: ${completedGames.length} completed games`);

      // Fetch stats for all completed games
      const allPlayerStats: any[] = [];

      for (const game of completedGames) {
        const boxscore = await mlbStatsService.getBoxScore(game.gamePk);
        if (boxscore) {
          const gameStats = mlbStatsService.extractPlayerStats(boxscore, date);
          allPlayerStats.push(...gameStats);
          batch.stats.push(...gameStats);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Create player stats lookup map
      const statsMap = new Map<string, any>();
      allPlayerStats.forEach(stat => {
        const key = `${stat.playerName.toLowerCase()}_${date}`;
        statsMap.set(key, stat);
      });

      // Process all props and match to stats
      for (const prop of unsettledProps) {
        const playerKey = `${prop.player_name.toLowerCase()}_${date}`;
        const stat = statsMap.get(playerKey);

        if (!stat) continue;

        const outcome = this.determineMLBOutcome(prop, stat);
        if (outcome) {
          batch.outcomes.push(outcome);
          this.settledPropIds.add(prop.id); // Update in-memory cache
        }
      }

    } catch (error: any) {
      this.logger.error(`Error settling ${date}:`, error.message);
    }

    return batch;
  }

  /**
   * Determine MLB prop outcome
   */
  private determineMLBOutcome(prop: any, stat: any): any | null {
    const marketType = (prop.stat_type || prop.market_type || '').toLowerCase();
    const line = parseFloat(prop.line);
    const selection = prop.selection?.toLowerCase() || 'over';

    let actualValue: number | undefined;

    // Map market type to stat
    if (marketType.includes('total_bases') || marketType.includes('totalbases')) {
      actualValue = stat.stats.totalBases;
    } else if (marketType.includes('hits') && !marketType.includes('runs') && !marketType.includes('rbi')) {
      actualValue = stat.stats.hits;
    } else if (marketType.includes('home_runs') || marketType.includes('homeruns')) {
      actualValue = stat.stats.homeRuns;
    } else if (marketType.includes('rbi')) {
      actualValue = stat.stats.rbi;
    } else if (marketType.includes('runs') && marketType.includes('batter')) {
      actualValue = stat.stats.runs;
    } else if (marketType.includes('hitsrunsrbi') || marketType.includes('hits_runs_rbi')) {
      actualValue = (stat.stats.hits || 0) + (stat.stats.runs || 0) + (stat.stats.rbi || 0);
    } else if (marketType.includes('stolen_bases') || marketType.includes('stolenbases')) {
      actualValue = stat.stats.stolenBases;
    }

    if (actualValue === undefined || actualValue === null) {
      return null;
    }

    // Determine outcome
    let outcome: 'win' | 'loss' | 'push';
    if (selection === 'over') {
      outcome = actualValue > line ? 'win' : actualValue < line ? 'loss' : 'push';
    } else {
      outcome = actualValue < line ? 'win' : actualValue > line ? 'loss' : 'push';
    }

    return {
      prop_id: prop.id,
      sport: 'MLB',
      player_name: prop.player_name,
      market_type: prop.stat_type || prop.market_type,
      line: line,
      odds: prop.odds,
      selection: selection,
      outcome: outcome,
      actual_value: actualValue,
      game_date: prop.game_date,
      settled_at: new Date().toISOString(),
      settlement_method: 'exact_match',
      confidence: 0.95,
      season: new Date(prop.game_date).getFullYear(),
      source: 'mlb_stats_api'
    };
  }

  /**
   * Bulk insert outcomes (much faster than one-by-one)
   */
  async bulkInsertOutcomes(outcomes: any[]): Promise<number> {
    if (outcomes.length === 0) return 0;

    let inserted = 0;

    // Insert in batches of 1000
    for (let i = 0; i < outcomes.length; i += 1000) {
      const batch = outcomes.slice(i, i + 1000);

      try {
        const { error } = await supabase
          .from('settled_outcomes')
          .insert(batch);

        if (!error) {
          inserted += batch.length;
        } else {
          // Log error but continue
          this.logger.warn(`Batch insert failed: ${error.message}`);
        }
      } catch (err: any) {
        // Ignore duplicate errors
        if (!err.message?.includes('duplicate')) {
          this.logger.warn(`Insert error: ${err.message}`);
        }
      }
    }

    return inserted;
  }

  /**
   * Bulk insert player stats
   */
  async bulkInsertStats(stats: any[]): Promise<number> {
    if (stats.length === 0) return 0;

    let inserted = 0;

    // Insert in batches of 1000
    for (let i = 0; i < stats.length; i += 1000) {
      const batch = stats.slice(i, i + 1000);

      const records = batch.map(stat => ({
        player_id: stat.playerId?.toString() || 'unknown',
        player_name: stat.playerName,
        sport: 'MLB',
        team: stat.team,
        game_date: stat.gameDate,
        opponent: stat.opponent,
        home_away: stat.homeAway,
        stats: stat.stats,
        season: new Date(stat.gameDate).getFullYear()
      }));

      try {
        const { error } = await supabase
          .from('player_stats')
          .insert(records);

        if (!error) {
          inserted += records.length;
        }
      } catch (err: any) {
        // Ignore duplicates
      }
    }

    return inserted;
  }

  /**
   * Process date range with parallel workers
   */
  async processDateRange(sport: string, startDate: string, endDate: string, workers: number = 3): Promise<void> {
    this.logger.log(`\n🚀 Processing ${sport} from ${startDate} to ${endDate} with ${workers} workers\n`);

    const dates = await this.getDatesBetween(startDate, endDate);
    const chunks = this.chunkArray(dates, Math.ceil(dates.length / workers));

    this.logger.log(`   Total dates: ${dates.length}`);
    this.logger.log(`   Chunks: ${chunks.length}\n`);

    // Process chunks in parallel
    const promises = chunks.map((chunk, index) =>
      this.processDateChunk(sport, chunk, index)
    );

    await Promise.all(promises);
  }

  /**
   * Process a chunk of dates
   */
  private async processDateChunk(sport: string, dates: string[], workerId: number): Promise<void> {
    this.logger.log(`Worker ${workerId}: Processing ${dates.length} dates`);

    let totalOutcomes = 0;
    let totalStats = 0;

    for (const date of dates) {
      const batch = await this.settleDateMLB(date);

      if (batch.outcomes.length > 0) {
        const inserted = await this.bulkInsertOutcomes(batch.outcomes);
        totalOutcomes += inserted;
      }

      if (batch.stats.length > 0) {
        const inserted = await this.bulkInsertStats(batch.stats);
        totalStats += inserted;
      }

      // Brief pause
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.logger.log(`Worker ${workerId} complete: ${totalOutcomes} outcomes, ${totalStats} stats`);
  }

  /**
   * Helper: Get dates between range
   */
  private async getDatesBetween(start: string, end: string): Promise<string[]> {
    const dates: string[] = [];
    const startDate = new Date(start);
    const endDate = new Date(end);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    return dates;
  }

  /**
   * Helper: Chunk array
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

async function main() {
  console.log('🚀 OPTIMIZED SETTLEMENT ENGINE');
  console.log('==========================================\n');

  const engine = new OptimizedSettlementEngine();

  // Step 1: Load settled prop IDs into memory
  await engine.loadSettledPropIds();

  // Step 2: Get stats
  const { count: totalProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true });

  const { count: settledCount } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true });

  console.log('📊 Current Status:');
  console.log(`   Total Props: ${(totalProps || 0).toLocaleString()}`);
  console.log(`   Settled: ${(settledCount || 0).toLocaleString()}`);
  console.log(`   Remaining: ${((totalProps || 0) - (settledCount || 0)).toLocaleString()}\n`);

  // Step 3: Process MLB (Full 2024 season)
  console.log('Starting MLB settlement (Full 2024 Season)...\n');
  await engine.processDateRange('MLB', '2024-04-01', '2024-10-15', 10);

  // Final stats
  const { count: finalSettled } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true });

  console.log('\n\n✅ SETTLEMENT COMPLETE');
  console.log('==========================================');
  console.log(`Total Settled: ${(finalSettled || 0).toLocaleString()}`);
  console.log(`New Settlements: ${((finalSettled || 0) - (settledCount || 0)).toLocaleString()}`);

  process.exit(0);
}

main().catch(error => {
  console.error('❌ Settlement failed:', error);
  process.exit(1);
});
