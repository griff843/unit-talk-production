/**
 * Debug Grading Persistence Issue
 * Following claude.md rules - investigate why grading results aren't persisting
 */

import { createClient } from '@supabase/supabase-js';
// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugGradingPersistence() {
  console.log('🔍 DEBUGGING GRADING PERSISTENCE ISSUE');
  console.log('='.repeat(55));
  
  try {
    // Step 1: Check if we can connect to the database
    console.log('\n1️⃣ DATABASE CONNECTION TEST:');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('raw_props')
      .select('count')
      .limit(1);
      
    if (connectionError) {
      console.log('❌ Database connection failed:', connectionError.message);
      return;
    }
    console.log('✅ Database connection successful');
    
    // Step 2: Check raw_props schema
    console.log('\n2️⃣ RAW_PROPS SCHEMA ANALYSIS:');
    const { data: sampleProp, error: schemaError } = await supabase
      .from('raw_props')
      .select('*')
      .limit(1)
      .single();
      
    if (schemaError) {
      console.log('❌ Schema check failed:', schemaError.message);
      return;
    }
    
    if (sampleProp) {
      console.log('✅ Sample record retrieved');
      console.log('Available columns:', Object.keys(sampleProp).sort());
      
      // Check specific grading fields we're trying to update
      const gradingFields = ['confidence_score', 'confidence', 'tier', 'edge_score', 'auto_approved'];
      console.log('\n📊 GRADING FIELDS CHECK:');
      gradingFields.forEach(field => {
        const exists = field in sampleProp;
        const value = sampleProp[field];
        console.log(`   ${field}: ${exists ? '✓' : '❌'} exists, value: ${value}`);
      });
    }
    
    // Step 3: Test the exact update that GradingAgent is trying to do
    console.log('\n3️⃣ SIMULATING GRADING AGENT UPDATE:');
    
    // Get a specific prop to test with
    const { data: testProp } = await supabase
      .from('raw_props')
      .select('id, confidence_score, confidence, tier, edge_score')
      .limit(1)
      .single();
      
    if (!testProp) {
      console.log('❌ No test prop found');
      return;
    }
    
    console.log(`Testing with prop ID: ${testProp.id}`);
    console.log(`Current values:`, {
      confidence_score: testProp.confidence_score,
      confidence: testProp.confidence,
      tier: testProp.tier,
      edge_score: testProp.edge_score
    });
    
    // Try the exact update that GradingAgent is doing
    console.log('\n🧪 TESTING GRADING AGENT UPDATE QUERY:');
    const mockGradingResult = {
      confidence: 75.5,
      tier: 'B',
      edgeScore: 0.125
    };
    
    // Test with confidence_score (what GradingAgent is currently using)
    console.log('Testing update with confidence_score field...');
    const { error: updateError1 } = await supabase
      .from('raw_props')
      .update({
        confidence_score: mockGradingResult.confidence,
        tier: mockGradingResult.tier,
        edge_score: mockGradingResult.edgeScore,
        auto_approved: mockGradingResult.tier !== 'D' && mockGradingResult.confidence > 0.65,
        updated_at: new Date().toISOString()
      })
      .eq('id', testProp.id);
      
    if (updateError1) {
      console.log('❌ Update with confidence_score failed:', updateError1.message);
      
      // Try with confidence field instead
      console.log('Testing update with confidence field...');
      const { error: updateError2 } = await supabase
        .from('raw_props')
        .update({
          confidence: mockGradingResult.confidence,
          tier: mockGradingResult.tier,
          edge_score: mockGradingResult.edgeScore,
          auto_approved: mockGradingResult.tier !== 'D' && mockGradingResult.confidence > 0.65,
          updated_at: new Date().toISOString()
        })
        .eq('id', testProp.id);
        
      if (updateError2) {
        console.log('❌ Update with confidence also failed:', updateError2.message);
      } else {
        console.log('✅ Update with confidence field SUCCEEDED!');
        console.log('🔧 SOLUTION: GradingAgent should use "confidence" not "confidence_score"');
      }
    } else {
      console.log('✅ Update with confidence_score succeeded');
    }
    
    // Step 4: Verify the update worked
    console.log('\n4️⃣ VERIFYING UPDATE PERSISTENCE:');
    const { data: updatedProp } = await supabase
      .from('raw_props')
      .select('id, confidence_score, confidence, tier, edge_score, published, updated_at')
      .eq('id', testProp.id)
      .single();
      
    if (updatedProp) {
      console.log('✅ Updated prop retrieved:');
      console.log(`   confidence_score: ${updatedProp.confidence_score}`);
      console.log(`   confidence: ${updatedProp.confidence}`);
      console.log(`   tier: ${updatedProp.tier}`);
      console.log(`   edge_score: ${updatedProp.edge_score}`);
      console.log(`   auto_approved: ${updatedProp.auto_approved}`);
      console.log(`   updated_at: ${updatedProp.updated_at}`);
    }
    
  } catch (error) {
    console.error('❌ Debug script failed:', error);
  }
}

debugGradingPersistence().then(() => {
  console.log('\n🎉 DEBUG COMPLETE!');
  process.exit(0);
}).catch(console.error);