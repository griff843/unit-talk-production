const { ProfessionalPropProcessor } = require('./apps/api/dist/services/ProfessionalPropProcessor');
const { supabase } = require('./apps/api/dist/services/supabaseClient');

async function testProfessionalGrading() {
  try {
    console.log('Testing ProfessionalPropProcessor...');
    
    const processor = ProfessionalPropProcessor.getInstance();
    console.log('✅ Processor created');
    
    const { data: rawProps, error } = await supabase.from('raw_props').select('*').limit(1);
    
    if (error) {
      console.error('❌ Supabase error:', error);
      return;
    }
    
    if (!rawProps || rawProps.length === 0) {
      console.log('❌ No raw props found');
      return;
    }
    
    console.log('✅ Got raw prop:', rawProps[0].id);
    console.log('  - Player:', rawProps[0].player_name);
    console.log('  - Sport:', rawProps[0].sport);
    console.log('  - Stat:', rawProps[0].stat_type);
    
    const result = await processor.processIndividualProp(rawProps[0]);
    console.log('✅ Professional processing result:');
    console.log('  - Tier:', result?.tier);
    console.log('  - Score:', result?.professionalScore);
    console.log('  - Confidence:', result?.confidence);
    
  } catch (err) {
    console.error('❌ Detailed error:', err.message);
    if (err.stack) console.error('Stack:', err.stack.slice(0, 500));
  }
}

testProfessionalGrading();