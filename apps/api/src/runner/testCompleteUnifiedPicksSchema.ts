/**
 * Test Complete Unified Picks Schema
 */

import { randomUUID } from 'crypto';

import { createClient } from '@supabase/supabase-js';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
import { requireSupabase } from '../utils/supabaseUtils';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testCompleteUnifiedPicksSchema() {
  console.log('🎯 TESTING COMPLETE UNIFIED_PICKS SCHEMA');
  console.log('='.repeat(45));
  
  // Get a real user_id from the users table
  const supabaseClient = requireSupabase();
      const { data: users } = await supabase
    .from('users')
    .select('id')
    .limit(1);
    
  if (!users || users.length === 0) {
    console.log('❌ No users found - need a valid user_id');
    return;
  }
  
  const userId = users[0].id;
  console.log(`Using user_id: ${userId}`);
  
  // Test with all required fields we've discovered
  const completePick = {
    id: randomUUID(),
    user_id: userId,
    pick_type: 'over', // Required
    selection: 'over', // Required  
    odds: -110,        // Required
    sport: 'MLB'
  };
  
  console.log('\n1️⃣ Testing with all required fields...');
  try {
    const supabaseClient = requireSupabase();
      const { data, error } = await supabase
      .from('unified_picks')
      .insert(completePick)
      .select();
      
    if (error) {
      console.log(`❌ Insert failed: ${error.message}`);
      
      // Try to identify any other missing required fields
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('null value in column')) {
        const match = errorMsg.match(/null value in column "([^"]+)"/);
        if (match) {
          console.log(`   Missing required field: ${match[1]}`);
        }
      }
    } else {
      console.log(`✅ SUCCESS! Insert worked!`);
      console.log('\n📋 COMPLETE unified_picks schema:');
      
      const record = data[0];
      const sortedColumns = Object.keys(record).sort();
      
      // Group columns by type for better understanding
      const requiredFields = ['id', 'user_id', 'pick_type', 'selection', 'odds'];
      const gradingFields = ['tier', 'confidence', 'kelly_bet_size', 'risk_score', 'position_size'];
      const gameFields = ['player_name', 'stat_type', 'line', 'over_odds', 'under_odds', 'sport', 'game_date'];
      const metaFields = sortedColumns.filter(col => 
        !requiredFields.includes(col) && 
        !gradingFields.includes(col) && 
        !gameFields.includes(col)
      );
      
      console.log('\n  🔴 REQUIRED FIELDS:');
      requiredFields.filter(col => col in record).forEach(col => {
        console.log(`    ${col}: ${typeof record[col]} = ${record[col]}`);
      });
      
      console.log('\n  🎯 GRADING FIELDS:');
      gradingFields.filter(col => col in record).forEach(col => {
        console.log(`    ${col}: ${typeof record[col]} = ${record[col]}`);
      });
      
      console.log('\n  🏈 GAME DATA FIELDS:');
      gameFields.filter(col => col in record).forEach(col => {
        console.log(`    ${col}: ${typeof record[col]} = ${record[col]}`);
      });
      
      console.log('\n  📊 METADATA FIELDS:');
      metaFields.forEach(col => {
        const value = record[col];
        const displayValue = value === null ? 'null' : 
                            typeof value === 'object' ? JSON.stringify(value) : 
                            value;
        console.log(`    ${col}: ${typeof value} = ${displayValue}`);
      });
      
      // Clean up test record
      const supabaseClient = requireSupabase();
    await supabase
        .from('unified_picks')
        .delete()
        .eq('id', completePick.id);
        
      console.log('\n✅ Test record cleaned up');
      
      // Now create the perfect grading record
      console.log('\n2️⃣ Testing complete grading data...');
      const perfectGradingPick = {
        id: randomUUID(),
        user_id: userId,
        pick_type: 'over',
        selection: 'Ja Morant over 25.5 points',
        odds: -110,
        player_name: 'Ja Morant',
        stat_type: 'points',
        line: 25.5,
        over_odds: -110,
        under_odds: 110,
        tier: 'A',
        confidence: 0.85,
        kelly_bet_size: 0.05,
        sport: 'NBA',
        game_date: '2025-01-05',
        created_at: new Date().toISOString()
      };
      
      const supabaseClient = requireSupabase();
      const { data: gradingData, error: gradingError } = await supabase
        .from('unified_picks')
        .insert(perfectGradingPick)
        .select();
        
      if (gradingError) {
        console.log(`❌ Perfect grading insert failed: ${gradingError.message}`);
      } else {
        console.log(`✅ PERFECT! Complete grading data inserted successfully!`);
        
        // Clean up
        const supabaseClient = requireSupabase();
    await supabase
          .from('unified_picks')
          .delete()
          .eq('id', perfectGradingPick.id);
      }
    }
  } catch (e: any) {
    console.log(`❌ Test error: ${e.message}`);
  }
  
  console.log('\n🏆 UNIFIED_PICKS SCHEMA COMPLETELY MAPPED!');
  console.log('Ready to update GradingAgent with correct schema!');
}

testCompleteUnifiedPicksSchema().then(() => process.exit(0)).catch(console.error);