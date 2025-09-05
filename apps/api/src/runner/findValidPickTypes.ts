/**
 * Find Valid Pick Types for unified_picks
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

async function findValidPickTypes() {
  console.log('🔍 FINDING VALID PICK_TYPE VALUES');
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
  
  // Test different possible pick_type values
  const possiblePickTypes = [
    'straight',
    'parlay', 
    'prop',
    'moneyline',
    'spread',
    'total',
    'over',
    'under',
    'win',
    'loss',
    'push',
    'pending',
    'approved',
    'rejected'
  ];
  
  console.log('\n🧪 Testing different pick_type values...');
  
  for (const pickType of possiblePickTypes) {
    const testRecord = {
      id: randomUUID(),
      user_id: userId,
      pick_type: pickType,
      selection: 'Test Selection',
      odds: -110,
      stake: 1.0,
      potential_payout: 1.91,
      sport: 'MLB'
    };
    
    try {
      const { data, error } = await supabase
        .from('unified_picks')
        .insert(testRecord)
        .select();
        
      if (error) {
        if (error.message.includes('pick_type_check')) {
          console.log(`❌ ${pickType}: Invalid pick_type`);
        } else if (error.message.includes('selection_check')) {
          console.log(`⚠️ ${pickType}: Valid pick_type but selection constraint failed`);
        } else {
          console.log(`❓ ${pickType}: Other error - ${error.message}`);
        }
      } else {
        console.log(`✅ ${pickType}: VALID pick_type!`);
        
        // Clean up successful test
        await supabase
          .from('unified_picks')
          .delete()
          .eq('id', testRecord.id);
          
        // Get the complete schema from this successful insert
        if (data && data.length > 0) {
          console.log('\n🎉 SUCCESS WITH COMPLETE SCHEMA!');
          console.log(`Valid pick_type: ${pickType}`);
          
          const record = data[0];
          console.log(`Total columns: ${Object.keys(record).length}`);
          
          // Show required fields that work
          const requiredFields = ['id', 'user_id', 'pick_type', 'selection', 'odds', 'stake', 'potential_payout'];
          console.log('\n🔴 CONFIRMED REQUIRED FIELDS:');
          requiredFields.forEach(col => {
            console.log(`    ${col}: ${typeof record[col]} = ${record[col]}`);
          });
          
          // Show professional grading fields available
          const gradingFields = Object.keys(record).filter(col => 
            col.includes('confidence') || 
            col.includes('tier') || 
            col.includes('kelly') ||
            col.includes('risk') ||
            col.includes('edge') ||
            col.includes('score')
          );
          
          if (gradingFields.length > 0) {
            console.log('\n🎯 GRADING FIELDS AVAILABLE:');
            gradingFields.forEach(col => {
              console.log(`    ${col}: ${typeof record[col]} = ${record[col]}`);
            });
          }
          
          return { validPickType: pickType, schema: record };
        }
      }
    } catch (e: any) {
      console.log(`❌ ${pickType}: Error - ${e.message}`);
    }
  }
  
  console.log('\n❌ No valid pick_type found from tested values');
  console.log('May need to check database constraints or existing data');
}

findValidPickTypes().then(() => process.exit(0)).catch(console.error);