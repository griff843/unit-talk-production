/**
 * Complete Unified Picks Schema Mapping
 */

import { randomUUID } from 'crypto';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function completeUnifiedPicksMapping() {
  console.log('🔬 COMPLETE UNIFIED_PICKS SCHEMA MAPPING');
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
  
  // All required fields discovered so far
  const completeRequiredFields = {
    id: randomUUID(),
    user_id: userId,
    pick_type: 'over',         // Required
    selection: 'over',         // Required  
    odds: -110,                // Required
    stake: 1.0,                // Required
    potential_payout: 1.91,    // Required - NEW!
    sport: 'MLB'
  };
  
  console.log('\n🎯 Testing with ALL discovered required fields...');
  try {
    const { data, error } = await supabase
      .from('unified_picks')
      .insert(completeRequiredFields)
      .select();
      
    if (error) {
      console.log(`❌ Insert still failed: ${error.message}`);
      
      // Check for any other missing required fields
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('null value in column')) {
        const match = errorMsg.match(/null value in column "([^"]+)"/);
        if (match) {
          console.log(`   🚨 ANOTHER required field: ${match[1]}`);
          console.log('   Will need to add this and try again...');
        }
      }
    } else {
      console.log(`✅ 🎉 VICTORY! Complete insert successful!`);
      
      const record = data[0];
      console.log(`📊 Total columns in unified_picks: ${Object.keys(record).length}`);
      
      // Now get the COMPLETE schema
      console.log('\n📋 COMPLETE UNIFIED_PICKS SCHEMA:');
      console.log('=' .repeat(50));
      
      // Required fields (NOT NULL constraints)
      const requiredFields = ['id', 'user_id', 'pick_type', 'selection', 'odds', 'stake', 'potential_payout'];
      
      console.log('\n🔴 REQUIRED FIELDS (NOT NULL):');
      requiredFields.forEach(col => {
        console.log(`    ${col}: ${typeof record[col]} = ${record[col]}`);
      });
      
      // All other fields sorted alphabetically
      const otherFields = Object.keys(record)
        .filter(col => !requiredFields.includes(col))
        .sort();
      
      console.log('\n📊 ALL OTHER FIELDS:');
      otherFields.forEach(col => {
        const value = record[col];
        const displayValue = value === null ? 'null' : 
                            typeof value === 'object' ? JSON.stringify(value) : 
                            String(value);
        const truncatedValue = displayValue.length > 50 ? 
                              displayValue.substring(0, 47) + '...' : 
                              displayValue;
        console.log(`    ${col}: ${typeof value} = ${truncatedValue}`);
      });
      
      // Professional grading field analysis
      const gradingFields = otherFields.filter(col => 
        col.includes('confidence') || 
        col.includes('tier') || 
        col.includes('kelly') ||
        col.includes('risk') ||
        col.includes('edge') ||
        col.includes('score')
      );
      
      if (gradingFields.length > 0) {
        console.log('\n🎯 PROFESSIONAL GRADING FIELDS AVAILABLE:');
        gradingFields.forEach(col => {
          console.log(`    ✅ ${col}: ${typeof record[col]} = ${record[col]}`);
        });
      }
      
      // CLV fields analysis
      const clvFields = otherFields.filter(col => 
        col.includes('clv') || 
        col.includes('closing') ||
        col.includes('final_odds')
      );
      
      if (clvFields.length > 0) {
        console.log('\n💰 CLV TRACKING FIELDS:');
        clvFields.forEach(col => {
          console.log(`    ✅ ${col}: ${typeof record[col]} = ${record[col]}`);
        });
      }
      
      // Clean up test record
      await supabase
        .from('unified_picks')
        .delete()
        .eq('id', completeRequiredFields.id);
        
      console.log('\n✅ Test record cleaned up');
      
      console.log('\n🏆 SUCCESS! UNIFIED_PICKS SCHEMA COMPLETELY MAPPED!');
      console.log('🚀 Ready to implement GradingAgent v3.0.0 integration!');
      
      return {
        requiredFields,
        availableFields: Object.keys(record),
        gradingFields,
        clvFields
      };
    }
  } catch (e: any) {
    console.log(`❌ Test error: ${e.message}`);
  }
  
  return null;
}

completeUnifiedPicksMapping().then(() => process.exit(0)).catch(console.error);