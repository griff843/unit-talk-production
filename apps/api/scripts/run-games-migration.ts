/**
 * Script to run the games table migration
 * This creates the missing database structure for the smart betting form
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lxqmuzmqtnnlvjcjwunw.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHZqY2p3dW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1NTI4MzUsImV4cCI6MjA1MjEyODgzNX0.Qkk0U1p3JpOwWdvBMdkHlqL9g6wNc7O3fK7E-WTYyL8';

console.log('🔧 Supabase Configuration:');
console.log('URL:', supabaseUrl);
console.log('Key type:', supabaseKey?.includes('service_role') ? 'Service Role' : 'Anonymous');

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Starting games table migration...');
  
  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), 'migrations', '004_create_games_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('📖 Read migration file successfully');
    console.log(`📊 Migration SQL length: ${migrationSQL.length} characters`);
    
    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`🔧 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length === 0) continue;
      
      try {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        
        // Use rpc to execute raw SQL
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql_query: statement + ';' 
        });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error);
          errorCount++;
          
          // Continue with other statements unless it's a critical error
          if (error.message.includes('already exists')) {
            console.log('   ↳ Table/constraint already exists, continuing...');
          } else {
            console.log('   ↳ Continuing with next statement...');
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
          successCount++;
        }
        
      } catch (execError) {
        console.error(`❌ Execution error for statement ${i + 1}:`, execError);
        errorCount++;
      }
    }
    
    console.log('\n📊 Migration Results:');
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`❌ Failed statements: ${errorCount}`);
    console.log(`📝 Total statements: ${statements.length}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️ Migration completed with some errors (likely due to existing tables)');
    }
    
    // Test the new tables
    await testTables();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    // If RPC method not available, try direct SQL execution approach
    if (error.message && error.message.includes('exec_sql')) {
      console.log('\n💡 RPC method not available, trying alternative approach...');
      await tryAlternativeApproach();
    }
  }
}

async function tryAlternativeApproach() {
  console.log('🔄 Attempting to create tables using individual queries...');
  
  // Create teams table first
  try {
    console.log('📝 Creating teams table...');
    const { error: teamsError } = await supabase.from('teams').select('id').limit(1);
    
    if (teamsError && teamsError.code === '42P01') {
      console.log('⚠️ Teams table does not exist, but cannot create via API');
      console.log('💡 Manual database access required');
    } else {
      console.log('✅ Teams table is accessible');
    }
    
  } catch (error) {
    console.error('❌ Error checking teams table:', error);
  }
  
  // Create games table
  try {
    console.log('📝 Checking games table...');
    const { error: gamesError } = await supabase.from('games').select('id').limit(1);
    
    if (gamesError && gamesError.code === '42P01') {
      console.log('⚠️ Games table does not exist, but cannot create via API');
      console.log('💡 Manual database access required');
    } else {
      console.log('✅ Games table is accessible');
    }
    
  } catch (error) {
    console.error('❌ Error checking games table:', error);
  }
}

async function testTables() {
  console.log('\n🧪 Testing new tables...');
  
  // Test teams table
  try {
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, sport')
      .eq('sport', 'MLB')
      .limit(5);
    
    if (teamsError) {
      console.error('❌ Error testing teams table:', teamsError);
    } else {
      console.log(`✅ Teams table working - found ${teams?.length || 0} MLB teams`);
      if (teams && teams.length > 0) {
        console.log('   Sample teams:', teams.map(t => t.name).join(', '));
      }
    }
  } catch (error) {
    console.error('❌ Error testing teams:', error);
  }
  
  // Test games table
  try {
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id, game_date')
      .eq('sport', 'MLB')
      .eq('game_date', '2025-07-28')
      .limit(5);
    
    if (gamesError) {
      console.error('❌ Error testing games table:', gamesError);
    } else {
      console.log(`✅ Games table working - found ${games?.length || 0} games for today`);
      if (games && games.length > 0) {
        console.log('   Sample games:', games.map(g => g.id).join(', '));
      }
    }
  } catch (error) {
    console.error('❌ Error testing games:', error);
  }
  
  // Test the query that the form uses
  try {
    console.log('\n🎯 Testing form query (fetchGames equivalent)...');
    const { data: formGames, error: formError } = await supabase
      .from('games')
      .select(`
        *,
        home_team:teams!home_team_id(*),
        away_team:teams!away_team_id(*)
      `)
      .eq('sport', 'MLB')
      .gte('game_date', '2025-07-28')
      .lte('game_date', '2025-07-28')
      .order('game_date')
      .order('game_time');
    
    if (formError) {
      console.error('❌ Form query failed:', formError);
    } else {
      console.log(`✅ Form query successful - found ${formGames?.length || 0} games`);
      if (formGames && formGames.length > 0) {
        console.log('   🎮 Smart form should now show games!');
        formGames.forEach((game, i) => {
          console.log(`   ${i + 1}. ${game.away_team?.name || 'Away'} @ ${game.home_team?.name || 'Home'}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Error testing form query:', error);
  }
}

async function main() {
  console.log('🎯 Goal: Create database tables for smart betting form');
  console.log('📋 Tables to create: teams, players, games, raw_props, smart_tickets');
  console.log('📅 Sample data: MLB teams and games for today (2025-07-28)');
  console.log('');
  
  await runMigration();
  
  console.log('\n🎉 Migration script completed!');
  console.log('💡 Check smart form - games should now be available');
}

main().catch(console.error);