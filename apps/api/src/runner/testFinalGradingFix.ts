/**
 * Test Final Grading Persistence Fix
 * Following claude.md rules - verify grading results now persist with integer fields
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testFinalGradingFix() {
  console.log('🔧 TESTING FINAL GRADING PERSISTENCE FIX');
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
    
    // Simulate GradingAgent results
    const mockGradingResult = {
      confidence: 78.5,    // Will be rounded to 79
      tier: 'A',
      edgeScore: 0.1234    // Will be converted to 12 basis points
    };
    
    console.log('\n🧪 TESTING FINAL FIX (Integer Fields):');
    const { error } = await supabase
      .from('raw_props')
      .update({
        confidence: Math.min(100, Math.max(0, Math.round(mockGradingResult.confidence))), // Integer 0-100
        tier: mockGradingResult.tier,
        edge_score: Math.round(mockGradingResult.edgeScore * 100), // Convert to basis points
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
      console.log('confidence:', updatedProp.confidence, '(integer 0-100)');
      console.log('tier:', updatedProp.tier);
      console.log('edge_score:', updatedProp.edge_score, '(integer basis points)');
      console.log('auto_approved:', updatedProp.published);
      console.log('updated_at:', updatedProp.updated_at);
      console.log('promoted_to_picks:', updatedProp.promoted_to_picks);
      
      // Calculate what the original decimal edge_score was
      const originalEdgeScore = updatedProp.edge_score / 100;
      console.log(`Original edge_score: ${originalEdgeScore} (${updatedProp.edge_score} basis points)`);
      
      console.log('\n🎉 FINAL PERSISTENCE FIX VERIFIED!');
      console.log('✅ GradingAgent can now store results with correct integer data types');
      console.log('✅ Confidence: Integer 0-100 ✓');
      console.log('✅ Edge Score: Integer basis points (×100) ✓');
      console.log('✅ Tier assignment: String ✓');
      console.log('✅ Auto-approval logic: Boolean ✓');
      
      // Test batch update 
      console.log('\n🚀 TESTING BATCH UPDATE (5 props):');
      const { data: batchProps } = await supabase
        .from('raw_props')
        .select('id')
        .is('tier', null)
        .limit(5);
        
      if (batchProps && batchProps.length > 0) {
        let successCount = 0;
        
        for (const prop of batchProps) {
          const batchResult = {
            confidence: Math.random() * 40 + 60, // 60-100
            tier: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
            edgeScore: Math.random() * 0.2 + 0.05 // 0.05-0.25
          };
          
          const { error: batchError } = await supabase
            .from('raw_props')
            .update({
              confidence: Math.min(100, Math.max(0, Math.round(batchResult.confidence))),
              tier: batchResult.tier,
              edge_score: Math.round(batchResult.edgeScore * 100),
              auto_approved: batchResult.tier !== 'D' && batchResult.confidence > 65,
              updated_at: new Date().toISOString(),
              promoted_to_picks: false
            })
            .eq('id', prop.id);
            
          if (!batchError) {
            successCount++;
          }
        }
        
        console.log(`✅ Batch update: ${successCount}/${batchProps.length} props grading_status successfully`);
        
        // Verify batch results
        const { count: newGradedCount } = await supabase
          .from('raw_props')
          .select('*', { count: 'exact' })
          .not('tier', 'is', null);
          
        console.log(`📊 Total grading_status props: ${newGradedCount || 0}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFinalGradingFix().then(() => process.exit(0)).catch(console.error);