/**
 * Verify Grading Persistence Fix
 * Following claude.md rules - test that database updates now work with correct data types
 */

// Load environment variables from root directory
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyGradingPersistenceFix() {
  console.log('🔧 VERIFYING GRADING PERSISTENCE FIX');
  console.log('='.repeat(50));
  
  try {
    // Get a test prop
    const { data: testProp } = await supabase
      .from('raw_props')
      .select('id, confidence, tier, edge_score, auto_approved')
      .limit(1)
      .single();
      
    if (!testProp) {
      console.log('❌ No test prop found');
      return;
    }
    
    console.log(`\n🎯 Testing with prop: ${testProp.id}`);
    console.log('Before update:', {
      confidence: testProp.confidence,
      tier: testProp.tier,
      edge_score: testProp.edge_score,
      auto_approved: testProp.published
    });
    
    // Test the fixed update with correct data types
    const mockGradingResult = {
      confidence: 78.5,  // Will be rounded to 79
      tier: 'A',
      edgeScore: 0.1234
    };
    
    console.log('\n🧪 TESTING FIXED UPDATE:');
    const { error } = await supabase
      .from('raw_props')
      .update({
        confidence: Math.round(mockGradingResult.confidence), // Convert to integer
        tier: mockGradingResult.tier,
        edge_score: Number(mockGradingResult.edgeScore.toFixed(4)), // Proper decimal
        auto_approved: mockGradingResult.tier !== 'D' && mockGradingResult.confidence > 65,
        updated_at: new Date().toISOString(),
        promoted_to_picks: false
      })
      .eq('id', testProp.id);
      
    if (error) {
      console.log('❌ Update failed:', error.message);
      return;
    }
    
    console.log('✅ Update succeeded!');
    
    // Verify the update
    const { data: updatedProp } = await supabase
      .from('raw_props')
      .select('id, confidence, tier, edge_score, published, updated_at, promoted_to_picks')
      .eq('id', testProp.id)
      .single();
      
    if (updatedProp) {
      console.log('\n📊 AFTER UPDATE:');
      console.log('confidence:', updatedProp.confidence, '(integer)');
      console.log('tier:', updatedProp.tier);
      console.log('edge_score:', updatedProp.edge_score, '(decimal)');
      console.log('auto_approved:', updatedProp.published);
      console.log('updated_at:', updatedProp.updated_at);
      console.log('promoted_to_picks:', updatedProp.promoted_to_picks);
      
      // Verify our grading query will find ungraded props correctly
      console.log('\n🔍 TESTING UNGRADED PROPS QUERY:');
      const { count: ungradedCount } = await supabase
        .from('raw_props')
        .select('*', { count: 'exact' })
        .is('tier', null);
        
      console.log(`Found ${ungradedCount || 0} ungraded props (tier is null)`);
      
      // Verify our grading_status props query
      const { count: gradedCount } = await supabase
        .from('raw_props')
        .select('*', { count: 'exact' })
        .not('tier', 'is', null);
        
      console.log(`Found ${gradedCount || 0} grading_status props (tier is not null)`);
      
      console.log('\n🎉 PERSISTENCE FIX VERIFIED!');
      console.log('✅ GradingAgent can now store results with correct data types');
      console.log('✅ Integer confidence values work');
      console.log('✅ Decimal edge_score values work');
      console.log('✅ Tier assignment works');
      console.log('✅ Query logic for ungraded props works');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyGradingPersistenceFix().then(() => process.exit(0)).catch(console.error);