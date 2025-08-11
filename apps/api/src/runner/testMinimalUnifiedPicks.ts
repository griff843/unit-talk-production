/**
 * Test Minimal Unified Picks to Find Working Schema
 */

import { randomUUID } from 'crypto';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testMinimalUnifiedPicks() {
  console.log('🔬 TESTING MINIMAL UNIFIED_PICKS SCHEMA');
  console.log('='.repeat(40));
  
  // Get a real user_id from the users table
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
  
  // Minimal test with only required fields based on error analysis
  const minimalPick = {
    id: randomUUID(),
    user_id: userId,
    pick_type: 'over', // Required (NOT NULL)
    sport: 'MLB'
  };
  
  console.log('\n1️⃣ Testing minimal required fields...');
  try {
    const { data, error } = await supabase
      .from('unified_picks')
      .insert(minimalPick)
      .select();
      
    if (error) {
      console.log(`❌ Minimal insert failed: ${error.message}`);
    } else {
      console.log(`✅ Minimal insert successful!`);
      console.log('\n📋 COMPLETE unified_picks schema:');
      
      const record = data[0];
      Object.keys(record).forEach(col => {
        const value = record[col];
        const type = typeof value;
        console.log(`  - ${col}: ${type} = ${value}`);
      });
      
      // Clean up test record
      await supabase
        .from('unified_picks')
        .delete()
        .eq('id', minimalPick.id);
        
      console.log('\n✅ Test record cleaned up');
      
      // Now test with professional grading columns that exist
      console.log('\n2️⃣ Testing professional grading columns...');
      const professionalPick = {
        ...minimalPick,
        id: randomUUID(),
        player_name: 'Test Player',
        stat_type: 'points',
        line: 25.5,
        over_odds: -110,
        under_odds: 110,
        tier: 'A',
        confidence: 0.85, // Use 'confidence' not 'confidence_score'
        kelly_bet_size: 0.05,
        risk_score: 25.1,
        position_size: 0.02
      };
      
      const { data: profData, error: profError } = await supabase
        .from('unified_picks')
        .insert(professionalPick)
        .select();
        
      if (profError) {
        console.log(`❌ Professional insert failed: ${profError.message}`);
        
        // Test individual professional columns
        const professionalColumns = ['tier', 'confidence', 'kelly_bet_size', 'risk_score', 'position_size'];
        for (const col of professionalColumns) {
          const testRec = {
            ...minimalPick,
            id: randomUUID(),
            [col]: col === 'tier' ? 'A' : 
                   col === 'confidence' ? 0.85 : 
                   0.05
          };
          
          const { error: colError } = await supabase
            .from('unified_picks')
            .insert(testRec)
            .select();
            
          if (colError) {
            console.log(`   ❌ ${col}: Missing`);
          } else {
            console.log(`   ✅ ${col}: Exists`);
            
            // Clean up
            await supabase
              .from('unified_picks')
              .delete()
              .eq('id', testRec.id);
          }
        }
      } else {
        console.log(`✅ Professional insert successful!`);
        console.log('Professional grading columns confirmed working');
        
        // Clean up
        await supabase
          .from('unified_picks')
          .delete()
          .eq('id', professionalPick.id);
      }
    }
  } catch (e: any) {
    console.log(`❌ Test error: ${e.message}`);
  }
  
  console.log('\n🎯 UNIFIED_PICKS MINIMAL SCHEMA CONFIRMED');
}

testMinimalUnifiedPicks().then(() => process.exit(0)).catch(console.error);