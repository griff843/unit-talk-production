#!/usr/bin/env node

import 'dotenv/config';

/**
 * Player Discovery Script
 *
 * Fetches complete rosters from league APIs and adds missing players to the database
 *
 * Usage:
 *   npx ts-node -r dotenv/config src/scripts/discoverPlayers.ts [LEAGUE] [OPTIONS]
 *
 * Examples:
 *   npx ts-node -r dotenv/config src/scripts/discoverPlayers.ts MLB
 *   npx ts-node -r dotenv/config src/scripts/discoverPlayers.ts NBA --dry-run
 *   npx ts-node -r dotenv/config src/scripts/discoverPlayers.ts --all
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { 
  getMlbRosters, 
  convertMlbRosterPlayer 
} from '../agents/enrichment/mlbEnrichment';
import { 
  getNbaRosters, 
  convertNbaRosterPlayer 
} from '../agents/enrichment/nbaEnrichment';
import { 
  getNflRosters, 
  convertNflRosterPlayer 
} from '../agents/enrichment/nflEnrichment';
import { 
  getNhlRosters, 
  convertNhlRosterPlayer 
} from '../agents/enrichment/nhlEnrichment';

// Initialize Supabase client
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type SupportedLeague = 'MLB' | 'NBA' | 'NFL' | 'NHL';

interface StandardizedPlayer {
  external_id: string;
  player_name: string;
  sport: string;
  height_cm: number | null;
  weight_kg: number | null;
  birthday: string | null;
  photo_url: string | null;
  position: string | null;
  jersey_number: string | null;
  active: boolean;
}

interface DiscoverySummary {
  league: string;
  totalRosterPlayers: number;
  existingPlayers: number;
  newPlayers: number;
  addedPlayers: number;
  errors: number;
  errorDetails: string[];
}

/**
 * Fetch roster for a specific league
 */
async function fetchLeagueRoster(league: SupportedLeague): Promise<StandardizedPlayer[]> {
  logger.info(`Fetching ${league} roster...`);
  
  switch (league) {
    case 'MLB':
      const mlbPlayers = await getMlbRosters();
      return mlbPlayers.map(convertMlbRosterPlayer);
      
    case 'NBA':
      const nbaPlayers = await getNbaRosters();
      return nbaPlayers.map(convertNbaRosterPlayer);
      
    case 'NFL':
      const nflPlayers = await getNflRosters();
      return nflPlayers.map(convertNflRosterPlayer);
      
    case 'NHL':
      const nhlPlayers = await getNhlRosters();
      return nhlPlayers.map(convertNhlRosterPlayer);
      
    default:
      throw new Error(`Unsupported league: ${league}`);
  }
}

/**
 * Check which players already exist in the database
 */
async function getExistingPlayers(league: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('players')
    .select('player_name')
    .eq('sport', league);
    
  if (error) {
    throw new Error(`Error fetching existing players: ${error.message}`);
  }
  
  return new Set(data.map(p => p.player_name.toLowerCase()));
}

/**
 * Add new players to the database
 */
async function addNewPlayers(players: StandardizedPlayer[], dryRun: boolean = false): Promise<number> {
  if (dryRun) {
    logger.info(`DRY RUN: Would add ${players.length} new players`);
    return players.length;
  }
  
  if (players.length === 0) {
    return 0;
  }
  
  // Insert in batches of 100
  const batchSize = 100;
  let totalAdded = 0;
  
  for (let i = 0; i < players.length; i += batchSize) {
    const batch = players.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('players')
      .insert(batch);
      
    if (error) {
      logger.error(`Error inserting batch ${i / batchSize + 1}:`, error.message);
      throw error;
    }
    
    totalAdded += batch.length;
    logger.info(`Added batch ${i / batchSize + 1}: ${batch.length} players`);
  }
  
  return totalAdded;
}

/**
 * Discover and add missing players for a league
 */
async function discoverLeaguePlayers(
  league: SupportedLeague, 
  dryRun: boolean = false
): Promise<DiscoverySummary> {
  const summary: DiscoverySummary = {
    league,
    totalRosterPlayers: 0,
    existingPlayers: 0,
    newPlayers: 0,
    addedPlayers: 0,
    errors: 0,
    errorDetails: []
  };
  
  try {
    // Fetch roster from league API
    const rosterPlayers = await fetchLeagueRoster(league);
    summary.totalRosterPlayers = rosterPlayers.length;
    
    // Get existing players from database
    const existingPlayerNames = await getExistingPlayers(league);
    
    // Find new players
    const newPlayers = rosterPlayers.filter(player => 
      !existingPlayerNames.has(player.player_name.toLowerCase())
    );
    
    summary.existingPlayers = rosterPlayers.length - newPlayers.length;
    summary.newPlayers = newPlayers.length;
    
    // Add new players to database
    if (newPlayers.length > 0) {
      summary.addedPlayers = await addNewPlayers(newPlayers, dryRun);
      logger.info(`${dryRun ? 'Would add' : 'Added'} ${summary.addedPlayers} new ${league} players`);
    } else {
      logger.info(`No new ${league} players found`);
    }
    
  } catch (error) {
    summary.errors++;
    const errorMsg = `Error discovering ${league} players: ${error instanceof Error ? error.message : String(error)}`;
    summary.errorDetails.push(errorMsg);
    logger.error(errorMsg);
  }
  
  return summary;
}

/**
 * Print discovery summary
 */
function printSummary(summaries: DiscoverySummary[]) {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 PLAYER DISCOVERY SUMMARY');
  console.log('='.repeat(60));
  
  let totalRoster = 0;
  let totalExisting = 0;
  let totalNew = 0;
  let totalAdded = 0;
  let totalErrors = 0;
  
  summaries.forEach(summary => {
    console.log(`\n🏟️  ${summary.league}:`);
    console.log(`   📊 Roster Players: ${summary.totalRosterPlayers}`);
    console.log(`   ✅ Existing: ${summary.existingPlayers}`);
    console.log(`   🆕 New Found: ${summary.newPlayers}`);
    console.log(`   ➕ Added: ${summary.addedPlayers}`);
    
    if (summary.errors > 0) {
      console.log(`   ❌ Errors: ${summary.errors}`);
      summary.errorDetails.forEach(error => {
        console.log(`      • ${error}`);
      });
    }
    
    totalRoster += summary.totalRosterPlayers;
    totalExisting += summary.existingPlayers;
    totalNew += summary.newPlayers;
    totalAdded += summary.addedPlayers;
    totalErrors += summary.errors;
  });
  
  console.log('\n' + '-'.repeat(60));
  console.log('📈 TOTALS:');
  console.log(`   📊 Total Roster Players: ${totalRoster}`);
  console.log(`   ✅ Total Existing: ${totalExisting}`);
  console.log(`   🆕 Total New Found: ${totalNew}`);
  console.log(`   ➕ Total Added: ${totalAdded}`);
  
  if (totalErrors > 0) {
    console.log(`   ❌ Total Errors: ${totalErrors}`);
  }
  
  console.log('='.repeat(60));
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  const league = args[0]?.toUpperCase() as SupportedLeague;
  const dryRun = args.includes('--dry-run');
  const all = args.includes('--all');
  
  logger.info('🔍 Starting Player Discovery...');
  
  if (dryRun) {
    logger.info('🧪 DRY RUN MODE - No changes will be made to the database');
  }
  
  const summaries: DiscoverySummary[] = [];
  
  try {
    if (all) {
      // Discover all leagues
      const leagues: SupportedLeague[] = ['MLB', 'NBA', 'NFL', 'NHL'];
      
      for (const currentLeague of leagues) {
        logger.info(`\n🔍 Discovering ${currentLeague} players...`);
        const summary = await discoverLeaguePlayers(currentLeague, dryRun);
        summaries.push(summary);
      }
      
    } else if (league && ['MLB', 'NBA', 'NFL', 'NHL'].includes(league)) {
      // Discover specific league
      logger.info(`🔍 Discovering ${league} players...`);
      const summary = await discoverLeaguePlayers(league, dryRun);
      summaries.push(summary);
      
    } else {
      console.error('Usage: npx ts-node -r dotenv/config src/scripts/discoverPlayers.ts [LEAGUE] [OPTIONS]');
      console.error('');
      console.error('LEAGUE: MLB, NBA, NFL, NHL, or --all');
      console.error('OPTIONS: --dry-run');
      console.error('');
      console.error('Examples:');
      console.error('  npx ts-node -r dotenv/config src/scripts/discoverPlayers.ts MLB');
      console.error('  npx ts-node -r dotenv/config src/scripts/discoverPlayers.ts NBA --dry-run');
      console.error('  npx ts-node -r dotenv/config src/scripts/discoverPlayers.ts --all');
      process.exit(1);
    }
    
    // Print summary
    printSummary(summaries);
    
    logger.info('✅ Player discovery completed successfully');
    
  } catch (error) {
    logger.error('❌ Player discovery failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}