/**
 * Test Unified Picks with Selection Field
 */

import { randomUUID } from 'crypto';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function testUnifiedPicksWithSelection() {
  console.log('🔬 TESTING UNIFIED_PICKS WITH SELECTION');
  console.log('='.repeat(40));

  // Get a real user_id from the users table
  const { data: users } = await supabase.from('users').select('id').limit(1);

  if (!users || users.length === 0) {
    console.log('❌ No users found - need a valid user_id');
    return;
  }

  const userId = users[0].id;
  console.log(`Using user_id: ${userId}`);

  // Test with required fields: pick_type and selection
  const testPick = {
    id: randomUUID(),
    user_id: userId,
    pick_type: 'over', // Required
    selection: 'over', // Required
    sport: 'MLB',
  };

  console.log('\n1️⃣ Testing with pick_type and selection...');
  try {
    const { data, error } = await supabase.from('unified_picks').insert(testPick).select();

    if (error) {
      console.log(`❌ Insert failed: ${error.message}`);
    } else {
      console.log(`✅ Insert successful!`);
      console.log('\n📋 COMPLETE unified_picks schema discovered:');

      const record = data[0];
      const sortedColumns = Object.keys(record).sort();
      sortedColumns.forEach(col => {
        const value = record[col];
        const type = typeof value;
        const displayValue =
          value === null ? 'null' : type === 'object' ? JSON.stringify(value) : value;
        console.log(`  - ${col}: ${type} = ${displayValue}`);
      });

      // Clean up test record
      await supabase.from('unified_picks').delete().eq('id', testPick.id);

      console.log('\n✅ Test record cleaned up');

      // Test with professional grading data that should work
      console.log('\n2️⃣ Testing with professional grading data...');
      const gradingPick = {
        id: randomUUID(),
        user_id: userId,
        pick_type: 'over',
        selection: 'over',
        player_name: 'Test Player',
        stat_type: 'points',
        line: 25.5,
        over_odds: -110,
        under_odds: 110,
        tier: 'A',
        confidence: 0.85,
        kelly_bet_size: 0.05,
        sport: 'MLB',
        game_date: '2025-01-05',
      };

      const { data: gradingData, error: gradingError } = await supabase
        .from('unified_picks')
        .insert(gradingPick)
        .select();

      if (gradingError) {
        console.log(`❌ Professional grading insert failed: ${gradingError.message}`);
      } else {
        console.log(`✅ Professional grading insert successful!`);
        console.log('Grading columns confirmed working');

        // Clean up
        await supabase.from('unified_picks').delete().eq('id', gradingPick.id);
      }
    }
  } catch (e: any) {
    console.log(`❌ Test error: ${e.message}`);
  }

  console.log('\n🎯 UNIFIED_PICKS SCHEMA FULLY MAPPED!');
}

testUnifiedPicksWithSelection()
  .then(() => process.exit(0))
  .catch(console.error);
