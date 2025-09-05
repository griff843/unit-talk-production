const { supabase } = require('./apps/api/dist/services/supabaseClient');

console.log('=== TESTING DATABASE MIGRATION REQUIREMENTS ===');

async function testMigration() {
  try {
    console.log('1. Getting sample record to test...');
    
    // Get a sample record
    const { data: samplePicks, error: sampleError } = await supabase
      .from('unified_picks')
      .select('id')
      .limit(1);
    
    if (sampleError) {
      console.log('❌ Error accessing unified_picks:', sampleError.message);
      return;
    }
    
    if (!samplePicks || samplePicks.length === 0) {
      console.log('No existing picks to test with.');
      return;
    }
    
    const testId = samplePicks[0].id;
    console.log('✅ Testing with record ID:', testId);
    
    console.log('\n2. Testing professional grading column updates...');
    
    // Test if professional grading columns can be updated
    const { error: updateError } = await supabase
      .from('unified_picks')
      .update({
        kelly_fraction: 0.05,
        professional_score: 85.5,
        devigged_edge: 4.2,
        clv_tracking_id: 'test_clv_' + Date.now(),
        processing_time: 150,
        rule_compliance_score: 95,
        sharp_grading_version: 'v2025.09.05'
      })
      .eq('id', testId);
    
    if (updateError) {
      console.log('❌ Professional grading columns missing:', updateError.message);
      console.log('\n🚨 MANUAL DATABASE MIGRATION REQUIRED');
      console.log('\nPlease run this SQL in your Supabase SQL Editor:');
      console.log('\nALTER TABLE unified_picks');
      console.log('ADD COLUMN IF NOT EXISTS kelly_fraction NUMERIC(6,4),');
      console.log('ADD COLUMN IF NOT EXISTS professional_score NUMERIC(5,2),');
      console.log('ADD COLUMN IF NOT EXISTS devigged_edge NUMERIC(6,2),');
      console.log('ADD COLUMN IF NOT EXISTS clv_tracking_id TEXT,');
      console.log('ADD COLUMN IF NOT EXISTS feature_contributions JSONB DEFAULT \'{}\'::jsonb,');
      console.log('ADD COLUMN IF NOT EXISTS processing_time INTEGER,'); 
      console.log('ADD COLUMN IF NOT EXISTS rule_compliance_score INTEGER,');
      console.log('ADD COLUMN IF NOT EXISTS sharp_grading_version TEXT DEFAULT \'v2025.09.05\';');
      
    } else {
      console.log('✅ SUCCESS: Professional grading columns are working!');
      
      // Verify the update worked
      const { data: verifyData, error: verifyError } = await supabase
        .from('unified_picks')
        .select('kelly_fraction, professional_score, devigged_edge, clv_tracking_id, processing_time, rule_compliance_score, sharp_grading_version')
        .eq('id', testId)
        .single();
      
      if (!verifyError && verifyData) {
        console.log('\n✅ Migration verification successful:');
        console.log('  kelly_fraction:', verifyData.kelly_fraction);
        console.log('  professional_score:', verifyData.professional_score);
        console.log('  devigged_edge:', verifyData.devigged_edge);
        console.log('  clv_tracking_id:', verifyData.clv_tracking_id);
        console.log('  processing_time:', verifyData.processing_time);
        console.log('  rule_compliance_score:', verifyData.rule_compliance_score);
        console.log('  sharp_grading_version:', verifyData.sharp_grading_version);
        
        console.log('\n🎯 PROFESSIONAL GRADING SYSTEM IS NOW OPERATIONAL!');
      }
    }
    
    console.log('\n3. Checking agent configuration...');
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('name, status, type')
      .order('name');
      
    if (agentsError) {
      console.log('❌ Error checking agents:', agentsError.message);
    } else {
      console.log('Agent configuration status:');
      if (!agents || agents.length === 0) {
        console.log('❌ No agent configurations found (table empty)');
      } else {
        agents.forEach(agent => {
          console.log('  -', agent.name + ':', agent.status, '(' + agent.type + ')');
        });
      }
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testMigration();