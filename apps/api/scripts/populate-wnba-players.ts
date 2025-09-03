import { createClient } from '@supabase/supabase-js';

import { fetchEvents, fetchPlayerProps } from '../src/agents/FeedAgent/optimal';
import 'dotenv/config';

/**
 * POPULATE WNBA PLAYERS FROM OPTIMAL API
 * 
 * Fetches WNBA player data from Optimal API and populates the database
 * Enables headshot functionality for WNBA picks
 */

interface WnbaPlayer {
  player_id: string;
  player_name: string;
  sport: string;
  team?: string;
  position?: string;
}

async function populateWnbaPlayers() {
  console.log('🏀 POPULATING WNBA PLAYERS FROM OPTIMAL API');
  console.log('='.repeat(60));

  let insertedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check current WNBA players in database
    console.log('\n🔍 Checking current WNBA players in database...');
    const { data: existingPlayers, error: existingError } = await supabase
      .from('players')
      .select('player_id, player_name')
      .eq('sport', 'WNBA');

    if (existingError) {
      console.log('❌ Error checking existing players:', existingError.message);
    } else {
      console.log(`📊 Current WNBA players in database: ${existingPlayers?.length || 0}`);
    }

    const existingPlayerIds = new Set(existingPlayers?.map(p => p.player_id) || []);

    // Fetch WNBA events from Optimal API
    console.log('\n📡 Fetching WNBA events from Optimal API...');
    const events = await fetchEvents();
    const wnbaEvents = events.filter(event => event.league.toUpperCase() === 'WNBA');

    if (wnbaEvents.length === 0) {
      console.log('❌ No WNBA events found in Optimal API');
      return;
    }

    console.log(`✅ Found ${wnbaEvents.length} WNBA events`);

    // Extract unique players from all WNBA events
    const uniquePlayers = new Map<string, WnbaPlayer>();

    for (const event of wnbaEvents) {
      console.log(`\n📅 Processing event: ${event.away} @ ${event.home} (${event.id})`);

      try {
        const playerProps = await fetchPlayerProps('WNBA', event.id);
        
        if (playerProps.length === 0) {
          console.log(`⚠️  No player props found for event ${event.id}`);
          continue;
        }

        console.log(`🔍 Found ${playerProps.length} props, extracting unique players...`);

        // Extract unique players from props
        playerProps.forEach(prop => {
          const playerId = prop.player_id;
          const playerName = prop.player_name;

          if (!playerId || !playerName) {
            return;
          }

          // Use player_id as unique key
          if (!uniquePlayers.has(playerId)) {
            uniquePlayers.set(playerId, {
              player_id: playerId,
              player_name: playerName,
              sport: 'WNBA',
              team: prop.team || undefined,
              position: undefined // Position not available in Optimal API
            });
          }
        });

        // Small delay between events to be respectful to API
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.log(`❌ Error processing event ${event.id}:`, error instanceof Error ? error.message : error);
        errorCount++;
      }
    }

    const playersToInsert = Array.from(uniquePlayers.values());
    console.log(`\n👥 Found ${playersToInsert.length} unique WNBA players from Optimal API`);

    if (playersToInsert.length === 0) {
      console.log('❌ No players to insert');
      return;
    }

    // Show sample of players to be inserted
    console.log('\n📋 SAMPLE PLAYERS TO INSERT:');
    playersToInsert.slice(0, 10).forEach((player, index) => {
      const status = existingPlayerIds.has(player.player_id) ? '(EXISTS)' : '(NEW)';
      console.log(`  ${index + 1}. ${player.player_name} (${player.team || 'Unknown Team'}) [ID: ${player.player_id}] ${status}`);
    });

    if (playersToInsert.length > 10) {
      console.log(`  ... and ${playersToInsert.length - 10} more players`);
    }

    // Filter out existing players
    const newPlayers = playersToInsert.filter(player => !existingPlayerIds.has(player.player_id));
    skippedCount = playersToInsert.length - newPlayers.length;

    if (newPlayers.length === 0) {
      console.log('\n✅ All WNBA players already exist in database');
      console.log(`📊 Skipped: ${skippedCount} existing players`);
      return;
    }

    console.log(`\n💾 Inserting ${newPlayers.length} new WNBA players into database...`);
    console.log(`📊 Skipping: ${skippedCount} existing players`);

    // Insert players in batches
    const batchSize = 100;
    for (let i = 0; i < newPlayers.length; i += batchSize) {
      const batch = newPlayers.slice(i, i + batchSize);
      
      console.log(`📦 Inserting batch ${Math.floor(i / batchSize) + 1} (${batch.length} players)...`);

      const { error: insertError } = await supabase
        .from('players')
        .insert(batch);

      if (insertError) {
        console.log(`❌ Error inserting batch:`, insertError.message);
        errorCount += batch.length;
      } else {
        insertedCount += batch.length;
        console.log(`✅ Successfully inserted batch of ${batch.length} players`);
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏀 WNBA PLAYER POPULATION COMPLETE');
    console.log('='.repeat(60));

    console.log(`\n📊 FINAL SUMMARY:`);
    console.log(`  ✅ Inserted: ${insertedCount} new players`);
    console.log(`  ⏭️  Skipped: ${skippedCount} existing players`);
    console.log(`  ❌ Errors: ${errorCount} failed insertions`);
    console.log(`  📈 Total Processed: ${playersToInsert.length} players`);

    if (insertedCount > 0) {
      console.log('\n🎉 SUCCESS! WNBA player database populated');
      console.log('✅ WNBA headshots will now work in Discord picks');
      
      console.log('\n🔗 WNBA HEADSHOT SUPPORT:');
      console.log('  📸 Format: ESPN WNBA headshots');
      console.log('  🎯 Coverage: All players from Optimal API events');
      console.log('  ⚡ Status: Ready for Discord integration');
    }

    // Verify final database state
    console.log('\n🔍 VERIFYING DATABASE UPDATE...');
    const { data: finalCount, error: finalError } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'WNBA');

    if (finalError) {
      console.log('❌ Error verifying final count:', finalError.message);
    } else {
      console.log(`✅ Final WNBA player count in database: ${finalCount || 0}`);
    }

  } catch (error) {
    console.error('💥 WNBA player population failed:', error);
  }
}

// Run the population script
populateWnbaPlayers();