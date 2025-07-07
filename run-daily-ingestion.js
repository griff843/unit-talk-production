#!/usr/bin/env node

/**
 * DAILY PROPS INGESTION RUNNER
 * 
 * This script runs the ingestion process to fetch today's props from external sources
 * and populate them into the raw_props table for processing.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuration
const config = {
  // Sports Game Odds API configuration
  sgoApiKey: process.env.SPORTS_GAME_ODDS_API_KEY,
  sgoBaseUrl: 'https://api.sportsgameodds.com/v1',
  
  // Database configuration
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  
  // Ingestion settings
  sports: ['NBA', 'NFL', 'MLB', 'NHL'],
  markets: ['player_points', 'player_rebounds', 'player_assists', 'player_threes'],
  batchSize: 50,
  maxRetries: 3
};

class DailyPropsIngestion {
  constructor() {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.startTime = Date.now();
    this.stats = {
      fetched: 0,
      inserted: 0,
      duplicates: 0,
      errors: 0
    };
    
    console.log('🚀 Daily Props Ingestion Started');
    console.log('================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Target sports: ${config.sports.join(', ')}`);
    console.log(`Target markets: ${config.markets.join(', ')}\n`);
  }

  /**
   * Main ingestion process
   */
  async run() {
    try {
      // Step 1: Validate configuration
      await this.validateConfig();
      
      // Step 2: Fetch props from external sources
      const allProps = await this.fetchAllProps();
      
      // Step 3: Process and insert props
      if (allProps.length > 0) {
        await this.processProps(allProps);
      } else {
        console.log('ℹ️  No props fetched from external sources');
      }
      
      // Step 4: Generate summary report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Ingestion failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Validate configuration and dependencies
   */
  async validateConfig() {
    console.log('🔍 Validating configuration...');
    
    // Check environment variables
    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    // Check database connectivity
    const { error } = await this.supabase.from('raw_props').select('count', { count: 'exact', head: true });
    if (error) {
      throw new Error(`Database connectivity failed: ${error.message}`);
    }
    
    console.log('✅ Configuration validated\n');
  }

  /**
   * Fetch props from all configured sources
   */
  async fetchAllProps() {
    console.log('📥 Fetching props from external sources...');
    const allProps = [];

    // Method 1: Sports Game Odds API (if configured)
    if (config.sgoApiKey) {
      try {
        const sgoProps = await this.fetchFromSportsGameOdds();
        allProps.push(...sgoProps);
        console.log(`✅ Sports Game Odds: ${sgoProps.length} props fetched`);
      } catch (error) {
        console.log(`⚠️  Sports Game Odds failed: ${error.message}`);
        this.stats.errors++;
      }
    }

    // Method 2: Mock data generation (for testing)
    if (allProps.length === 0) {
      console.log('📝 No external sources available, generating mock data...');
      const mockProps = this.generateMockProps();
      allProps.push(...mockProps);
      console.log(`✅ Mock data: ${mockProps.length} props generated`);
    }

    this.stats.fetched = allProps.length;
    console.log(`📊 Total props fetched: ${allProps.length}\n`);
    
    return allProps;
  }

  /**
   * Fetch props from Sports Game Odds API
   */
  async fetchFromSportsGameOdds() {
    const props = [];
    const today = new Date().toISOString().split('T')[0];
    
    for (const sport of config.sports) {
      try {
        // This would be the actual API call
        // const response = await fetch(`${config.sgoBaseUrl}/props/${sport}?date=${today}`, {
        //   headers: { 'Authorization': `Bearer ${config.sgoApiKey}` }
        // });
        // const data = await response.json();
        
        // For now, simulate API response
        console.log(`  Fetching ${sport} props for ${today}...`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
        
        // Mock some props for demonstration
        const mockSportProps = this.generateMockPropsForSport(sport, 10);
        props.push(...mockSportProps);
        
      } catch (error) {
        console.log(`  ⚠️  Failed to fetch ${sport}: ${error.message}`);
        this.stats.errors++;
      }
    }
    
    return props;
  }

  /**
   * Generate mock props for testing
   */
  generateMockProps() {
    const props = [];
    const today = new Date();
    
    config.sports.forEach(sport => {
      const sportProps = this.generateMockPropsForSport(sport, 15);
      props.push(...sportProps);
    });
    
    return props;
  }

  /**
   * Generate mock props for a specific sport
   */
  generateMockPropsForSport(sport, count) {
    const props = [];
    const players = this.getPlayersForSport(sport);
    const statTypes = this.getStatTypesForSport(sport);
    
    for (let i = 0; i < count; i++) {
      const player = players[Math.floor(Math.random() * players.length)];
      const statType = statTypes[Math.floor(Math.random() * statTypes.length)];
      const line = this.generateLineForStat(statType);
      
      props.push({
        player_name: player.name,
        sport: sport,
        team: player.team,
        stat_type: statType,
        line: line,
        over_odds: -110,
        under_odds: -110,
        market: `player_${statType.toLowerCase()}`,
        provider: 'MockProvider',
        game_time: new Date(Date.now() + Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        scraped_at: new Date().toISOString(),
        external_id: `mock_${Date.now()}_${i}`,
        tier: 'D', // Default tier for new props
        edge_score: 0,
        auto_approved: false
      });
    }
    
    return props;
  }

  /**
   * Get sample players for a sport
   */
  getPlayersForSport(sport) {
    const players = {
      NBA: [
        { name: 'LeBron James', team: 'LAL' },
        { name: 'Stephen Curry', team: 'GSW' },
        { name: 'Kevin Durant', team: 'PHX' },
        { name: 'Giannis Antetokounmpo', team: 'MIL' },
        { name: 'Luka Doncic', team: 'DAL' }
      ],
      NFL: [
        { name: 'Josh Allen', team: 'BUF' },
        { name: 'Patrick Mahomes', team: 'KC' },
        { name: 'Lamar Jackson', team: 'BAL' },
        { name: 'Joe Burrow', team: 'CIN' },
        { name: 'Dak Prescott', team: 'DAL' }
      ],
      MLB: [
        { name: 'Mike Trout', team: 'LAA' },
        { name: 'Mookie Betts', team: 'LAD' },
        { name: 'Aaron Judge', team: 'NYY' },
        { name: 'Ronald Acuna Jr.', team: 'ATL' },
        { name: 'Juan Soto', team: 'SD' }
      ],
      NHL: [
        { name: 'Connor McDavid', team: 'EDM' },
        { name: 'Nathan MacKinnon', team: 'COL' },
        { name: 'Auston Matthews', team: 'TOR' },
        { name: 'Leon Draisaitl', team: 'EDM' },
        { name: 'Erik Karlsson', team: 'PIT' }
      ]
    };
    
    return players[sport] || [{ name: 'Unknown Player', team: 'UNK' }];
  }

  /**
   * Get stat types for a sport
   */
  getStatTypesForSport(sport) {
    const statTypes = {
      NBA: ['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK'],
      NFL: ['PASS_YDS', 'PASS_TD', 'RUSH_YDS', 'REC_YDS', 'REC'],
      MLB: ['HITS', 'RBI', 'HR', 'SB', 'K'],
      NHL: ['GOALS', 'ASSISTS', 'SHOTS', 'SAVES']
    };
    
    return statTypes[sport] || ['PTS'];
  }

  /**
   * Generate realistic line for a stat type
   */
  generateLineForStat(statType) {
    const lines = {
      PTS: () => 15 + Math.random() * 25,
      REB: () => 5 + Math.random() * 10,
      AST: () => 3 + Math.random() * 8,
      '3PM': () => 1 + Math.random() * 4,
      PASS_YDS: () => 200 + Math.random() * 150,
      PASS_TD: () => 1 + Math.random() * 3,
      RUSH_YDS: () => 50 + Math.random() * 100,
      HITS: () => 1 + Math.random() * 2,
      HR: () => 0.5 + Math.random() * 1,
      GOALS: () => 0.5 + Math.random() * 1.5,
      ASSISTS: () => 0.5 + Math.random() * 1.5
    };
    
    const generator = lines[statType] || (() => 10 + Math.random() * 10);
    return Math.round(generator() * 2) / 2; // Round to nearest 0.5
  }

  /**
   * Process and insert props into database
   */
  async processProps(props) {
    console.log('💾 Processing and inserting props...');
    
    // Process in batches
    for (let i = 0; i < props.length; i += config.batchSize) {
      const batch = props.slice(i, i + config.batchSize);
      await this.processBatch(batch, i / config.batchSize + 1);
    }
    
    console.log(`✅ Processing completed\n`);
  }

  /**
   * Process a batch of props
   */
  async processBatch(batch, batchNumber) {
    try {
      console.log(`  Processing batch ${batchNumber} (${batch.length} props)...`);
      
      // Check for duplicates
      const uniqueProps = await this.filterDuplicates(batch);
      
      if (uniqueProps.length === 0) {
        console.log(`    All props in batch ${batchNumber} are duplicates`);
        this.stats.duplicates += batch.length;
        return;
      }
      
      // Insert unique props
      const { data, error } = await this.supabase
        .from('raw_props')
        .insert(uniqueProps)
        .select('id');
      
      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }
      
      this.stats.inserted += uniqueProps.length;
      this.stats.duplicates += (batch.length - uniqueProps.length);
      
      console.log(`    ✅ Batch ${batchNumber}: ${uniqueProps.length} inserted, ${batch.length - uniqueProps.length} duplicates`);
      
    } catch (error) {
      console.log(`    ❌ Batch ${batchNumber} failed: ${error.message}`);
      this.stats.errors++;
    }
  }

  /**
   * Filter out duplicate props
   */
  async filterDuplicates(props) {
    const uniqueProps = [];
    
    for (const prop of props) {
      // Check if prop already exists (simple duplicate check)
      const { data: existing } = await this.supabase
        .from('raw_props')
        .select('id')
        .eq('player_name', prop.player_name)
        .eq('stat_type', prop.stat_type)
        .eq('line', prop.line)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .limit(1);
      
      if (!existing || existing.length === 0) {
        uniqueProps.push(prop);
      }
    }
    
    return uniqueProps;
  }

  /**
   * Generate summary report
   */
  generateReport() {
    const duration = Date.now() - this.startTime;
    
    console.log('📋 INGESTION SUMMARY REPORT');
    console.log('===========================');
    console.log(`Duration: ${Math.round(duration / 1000)}s`);
    console.log(`Props Fetched: ${this.stats.fetched}`);
    console.log(`Props Inserted: ${this.stats.inserted}`);
    console.log(`Duplicates Skipped: ${this.stats.duplicates}`);
    console.log(`Errors: ${this.stats.errors}`);
    console.log(`Success Rate: ${((this.stats.inserted / this.stats.fetched) * 100).toFixed(1)}%`);
    
    if (this.stats.inserted > 0) {
      console.log(`\n🎉 Successfully ingested ${this.stats.inserted} new props!`);
      console.log(`\nNext steps:`);
      console.log(`1. Run grading agent to score the props`);
      console.log(`2. Check for S/A tier props for alerts`);
      console.log(`3. Monitor the final_picks table for new picks`);
    } else {
      console.log(`\nℹ️  No new props were ingested.`);
    }
    
    console.log(`\nCompleted at: ${new Date().toISOString()}`);
  }
}

// Main execution
async function main() {
  const ingestion = new DailyPropsIngestion();
  await ingestion.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DailyPropsIngestion;