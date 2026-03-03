/**
 * Debug Edge Score Field Issue
 * Following claude.md rules - investigate numeric field overflow for edge_score
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function debugEdgeScoreField() {
  console.log('🔍 DEBUGGING EDGE_SCORE FIELD');
  console.log('='.repeat(40));

  try {
    // Get a test prop
    const { data: testProp } = await supabase
      .from('raw_props')
      .select('id, edge_score')
      .limit(1)
      .single();

    if (!testProp) {
      console.log('❌ No test prop found');
      return;
    }

    console.log(`Testing with prop: ${testProp.id}`);
    console.log(`Current edge_score: ${testProp.edge_score}`);
    console.log(`Type: ${typeof testProp.edge_score}`);

    // Test different edge_score formats
    const testValues = [
      0.1234, // Regular decimal
      0.1, // Simple decimal
      1, // Integer
      0, // Zero
      0.0001, // Small decimal
      Number((0.1234).toFixed(4)), // Our format
      parseFloat('0.1234'), // Parse float
      1.0, // Float as integer
    ];

    for (const testValue of testValues) {
      console.log(`\nTesting edge_score = ${testValue} (${typeof testValue})`);

      const { error } = await supabase
        .from('raw_props')
        .update({
          edge_score: testValue,
        })
        .eq('id', testProp.id);

      if (error) {
        console.log(`❌ Failed: ${error.message}`);
      } else {
        console.log(`✅ Success!`);

        // Check what was actually stored
        const { data: updated } = await supabase
          .from('raw_props')
          .select('edge_score')
          .eq('id', testProp.id)
          .single();

        console.log(`   Stored as: ${updated?.edge_score}`);
        break; // Stop at first success
      }
    }

    // Test minimal update without edge_score
    console.log('\nTesting update WITHOUT edge_score:');
    const { error: minimalError } = await supabase
      .from('raw_props')
      .update({
        confidence: 75,
        tier: 'B',
        auto_approved: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', testProp.id);

    if (minimalError) {
      console.log(`❌ Minimal update failed: ${minimalError.message}`);
    } else {
      console.log('✅ Minimal update succeeded!');
    }
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugEdgeScoreField()
  .then(() => process.exit(0))
  .catch(console.error);
