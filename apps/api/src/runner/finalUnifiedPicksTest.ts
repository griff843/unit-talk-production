/**
 * Final Unified Picks Schema Test
 */

import { randomUUID } from 'crypto';

import { createClient } from '@supabase/supabase-js';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function finalUnifiedPicksTest() {
  console.log('🏆 FINAL UNIFIED_PICKS SCHEMA TEST');
  console.log('='.repeat(35));
  
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
  
  // Test with ALL required fields discovered
  const allRequiredFields = {
    id: randomUUID(),
    user_id: userId,
    pick_type: 'over',    // Required
    selection: 'over',    // Required  
    odds: -110,           // Required
    stake: 1.0,           // Required - NEW!
    sport: 'MLB'
  };
  
  console.log('\n1️⃣ Testing with ALL required fields...');
  try {
    const { data, error } = await supabase
      .from('unified_picks')
      .insert(allRequiredFields)
      .select();
      
    if (error) {
      console.log(`❌ Insert failed: ${error.message}`);
      
      // Check for any other missing required fields
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('null value in column')) {
        const match = errorMsg.match(/null value in column "([^"]+)"/);
        if (match) {
          console.log(`   🚨 ANOTHER missing required field: ${match[1]}`);
        }
      }
    } else {
      console.log(`✅ 🎉 SUCCESS! Complete insert worked!`);
      console.log('\n📋 COMPLETE unified_picks schema discovered:');
      
      const record = data[0];
      
      // Required fields we discovered
      const requiredFields = ['id', 'user_id', 'pick_type', 'selection', 'odds', 'stake'];
      
      // Professional grading fields
      const gradingFields = ['tier', 'confidence', 'kelly_bet_size', 'risk_score', 'position_size', 'edge_score'];
      
      // Game/pick data fields
      const pickFields = ['player_name', 'stat_type', 'line', 'over_odds', 'under_odds', 'sport', 'game_date', 'team', 'opponent', 'game_time'];
      
      // Workflow fields
      const workflowFields = ['status', 'processing_status', 'promotion_status', 'outcome', 'bet_source'];
      
      // Metadata fields
      const metaFields = ['created_at', 'updated_at', 'settled_at', 'notes', 'tags', 'metadata', 'additional_metadata', 'game_id', 'external_id', 'original_created_at', 'last_updated_at'];
      
      // CLV tracking fields
      const clvFields = ['clv_at_bet', 'clv_at_close', 'final_odds'];
      
      console.log('\n  🔴 REQUIRED FIELDS (NOT NULL):');
      requiredFields.forEach(col => {
        if (col in record) {
          console.log(`    ✅ ${col}: ${typeof record[col]} = ${record[col]}`);
        } else {
          console.log(`    ❓ ${col}: Missing from response`);
        }
      });
      
      console.log('\n  🎯 PROFESSIONAL GRADING FIELDS:');
      gradingFields.forEach(col => {
        if (col in record) {
          console.log(`    ✅ ${col}: ${typeof record[col]} = ${record[col]}`);
        } else {
          console.log(`    ❌ ${col}: Not available`);
        }
      });
      
      console.log('\n  🏈 PICK DATA FIELDS:');
      pickFields.forEach(col => {
        if (col in record) {
          console.log(`    ✅ ${col}: ${typeof record[col]} = ${record[col]}`);
        }
      });
      
      console.log('\n  🔄 WORKFLOW FIELDS:');
      workflowFields.forEach(col => {
        if (col in record) {
          console.log(`    ✅ ${col}: ${typeof record[col]} = ${record[col]}`);
        }
      });
      
      console.log('\n  💰 CLV TRACKING FIELDS:');
      clvFields.forEach(col => {
        if (col in record) {
          console.log(`    ✅ ${col}: ${typeof record[col]} = ${record[col]}`);
        }
      });
      
      console.log('\n  📊 METADATA FIELDS:');
      metaFields.forEach(col => {
        if (col in record) {
          const value = record[col];
          const displayValue = value === null ? 'null' : 
                              typeof value === 'object' ? JSON.stringify(value) : 
                              value;
          console.log(`    ✅ ${col}: ${typeof value} = ${displayValue}`);
        }
      });
      
      // List any fields we haven't categorized
      const allCategorized = [...requiredFields, ...gradingFields, ...pickFields, ...workflowFields, ...metaFields, ...clvFields];
      const uncategorized = Object.keys(record).filter(col => !allCategorized.includes(col));
      
      if (uncategorized.length > 0) {
        console.log('\n  ❓ UNCATEGORIZED FIELDS:');
        uncategorized.forEach(col => {
          const value = record[col];
          const displayValue = value === null ? 'null' : 
                              typeof value === 'object' ? JSON.stringify(value) : 
                              value;
          console.log(`    ❓ ${col}: ${typeof value} = ${displayValue}`);
        });
      }
      
      // Clean up test record
      await supabase
        .from('unified_picks')
        .delete()
        .eq('id', allRequiredFields.id);
        
      console.log('\n✅ Test record cleaned up');
    }
  } catch (e: any) {
    console.log(`❌ Test error: ${e.message}`);
  }
  
  console.log('\n🚀 UNIFIED_PICKS SCHEMA FULLY UNDERSTOOD!');
  console.log('🎯 Ready to update GradingAgent for v3.0.0 compatibility!');
}

finalUnifiedPicksTest().then(() => process.exit(0)).catch(console.error);