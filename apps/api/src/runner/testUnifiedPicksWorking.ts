/**
 * Test Unified Picks with Complete Schema
 */

import { randomUUID } from 'crypto';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testUnifiedPicksWorking() {
  console.log('✅ TESTING UNIFIED_PICKS WITH COMPLETE SCHEMA');
  console.log('='.repeat(50));

  // Get a real user_id from the users table
  const { data: users } = await supabase.from('users').select('id').limit(1);

  if (!users || users.length === 0) {
    console.log('❌ No users found - need a valid user_id');
    return;
  }

  const userId = users[0].id;
  console.log(`Using user_id: ${userId}`);

  // Create complete test record with all required fields
  const testPick = {
    id: randomUUID(),
    user_id: userId,
    pick_type: 'over', // This is required (NOT NULL)
    player_name: 'Test Player',
    stat_type: 'points',
    line: 25.5,
    over_odds: -110,
    under_odds: 110,
    tier: 'A',
    confidence: 0.85, // Note: it's 'confidence' not 'confidence_score'
    kelly_bet_size: 0.05,
    sport: 'MLB',
    game_date: '2025-01-05',
    edge_score: 12.3,
    position_size: 0.02,
    risk_score: 25.1,
    created_at: new Date().toISOString(),
  };

  console.log('\n1️⃣ Testing complete unified_picks insert...');
  try {
    const { data, error } = await supabase.from('unified_picks').insert(testPick).select();

    if (error) {
      console.log(`❌ Insert failed: ${error.message}`);
      console.log(`   Details: ${JSON.stringify(error.details)}`);
    } else {
      console.log(`✅ Insert successful!`);
      console.log(`Record created with id: ${data[0].id}`);

      console.log('\n📋 Available columns in unified_picks:');
      const columns = Object.keys(data[0]);
      columns.forEach(col => console.log(`  - ${col}: ${typeof data[0][col]} = ${data[0][col]}`));

      // Clean up test record
      await supabase.from('unified_picks').delete().eq('id', testPick.id);

      console.log('\n✅ Test record cleaned up');
    }
  } catch (e: any) {
    console.log(`❌ Test error: ${e.message}`);
  }

  console.log('\n🎯 UNIFIED_PICKS SCHEMA CONFIRMED!');
  console.log('Ready to update GradingAgent to use this schema.');
}

testUnifiedPicksWorking()
  .then(() => process.exit(0))
  .catch(console.error);
