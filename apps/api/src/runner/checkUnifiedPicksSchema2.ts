/**
 * Check Unified Picks Schema with UUID
 */

import { randomUUID } from 'crypto';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkUnifiedPicksSchemaProper() {
  console.log('🔍 CHECKING UNIFIED_PICKS SCHEMA (WITH UUID)');
  console.log('='.repeat(45));
  
  // Try with proper UUID and minimal required fields
  const testRecord = {
    id: randomUUID(),
    user_id: randomUUID(),
    created_at: new Date().toISOString()
  };
  
  console.log('\n1️⃣ Testing with UUID and minimal fields...');
  try {
    const { data, error } = await supabase
      .from('unified_picks')
      .insert(testRecord)
      .select();
      
    if (error) {
      console.log(`❌ Insert failed: ${error.message}`);
      console.log(`   Details: ${JSON.stringify(error.details)}`);
      console.log(`   Hint: ${error.hint || 'No hint provided'}`);
    } else {
      console.log(`✅ Insert successful!`);
      console.log('Schema discovered from successful insert:', Object.keys(data[0]));
      
      // Clean up
      await supabase
        .from('unified_picks')
        .delete()
        .eq('id', testRecord.id);
    }
  } catch (e: any) {
    console.log(`❌ Insert error: ${e.message}`);
  }
  
  // Based on our v3.0.0 architecture, try the expected columns
  console.log('\n2️⃣ Testing expected v3.0.0 unified_picks columns...');
  const expectedRecord = {
    id: randomUUID(),
    user_id: randomUUID(), // Foreign key to users table
    player_name: 'Test Player',
    stat_type: 'points',
    line: 25.5,
    over_odds: -110,
    under_odds: 110,
    pick_type: 'over',
    sport: 'MLB',
    game_date: '2025-01-05',
    tier: 'A',
    confidence_score: 0.85,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  
  try {
    const { data, error } = await supabase
      .from('unified_picks')
      .insert(expectedRecord)
      .select();
      
    if (error) {
      console.log(`❌ Expected schema insert failed: ${error.message}`);
      
      // Parse the error to understand missing columns
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('column') && errorMsg.includes('does not exist')) {
        const match = errorMsg.match(/column "([^"]+)" does not exist/);
        if (match) {
          console.log(`   Missing column: ${match[1]}`);
        }
      }
    } else {
      console.log(`✅ Expected schema insert successful!`);
      console.log('Full schema:', Object.keys(data[0]));
      
      // Clean up
      await supabase
        .from('unified_picks')
        .delete()
        .eq('id', expectedRecord.id);
    }
  } catch (e: any) {
    console.log(`❌ Expected schema test error: ${e.message}`);
  }
  
  console.log('\n📋 UNIFIED_PICKS SCHEMA CHECK COMPLETE');
}

checkUnifiedPicksSchemaProper().then(() => process.exit(0)).catch(console.error);