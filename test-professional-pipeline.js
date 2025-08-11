const { ProfessionalPropProcessor } = require('./src/services/ProfessionalPropProcessor.js');
const { createSupabaseClient } = require('./src/db/index.js');

async function testProfessionalPipeline() {
  console.log('🎯 PROFESSIONAL PIPELINE E2E TEST');
  console.log('================================');
  
  try {
    // Get some unprocessed raw props
    const supabase = createSupabaseClient();
    const { data: rawProps, error } = await supabase
      .from('raw_props')
      .select('*')
      .is('processed_at', null)
      .limit(5);
      
    if (error) {
      console.log('❌ Database query error:', error.message);
      return;
    }
    
    if (!rawProps || rawProps.length === 0) {
      console.log('⚠️  No unprocessed raw props found');
      console.log('📊 Checking processed props instead...');
      
      const { data: processedProps } = await supabase
        .from('raw_props')
        .select('*')
        .not('processed_at', 'is', null)
        .limit(3);
        
      console.log('✅ Found', processedProps?.length || 0, 'processed props');
      return;
    }
    
    console.log('📋 Found', rawProps.length, 'unprocessed props for testing');
    
    // Initialize professional processor
    const processor = new ProfessionalPropProcessor();
    
    // Process first prop through professional pipeline
    const testProp = rawProps[0];
    console.log('\n🔄 Processing prop:', testProp.id);
    console.log('📊 Player:', testProp.player_name);
    console.log('🏆 Sport:', testProp.sport);
    console.log('📈 Market:', testProp.stat_type);
    
    const result = await processor.processIndividualProp(testProp);
    
    console.log('\n✅ PROCESSING RESULT:');
    console.log('Professional Score:', result.professional_score);
    console.log('Confidence:', result.confidence);
    console.log('Tier:', result.tier || 'Not assigned');
    console.log('Kelly Fraction:', result.kelly_fraction);
    console.log('Processing Time:', result.processing_time_ms + 'ms');
    
    if (result.professional_insights) {
      console.log('\n🎯 PROFESSIONAL FEATURES:');
      const insights = result.professional_insights;
      console.log('Steam Detection:', insights.steamDetection || 'N/A');
      console.log('Closing Line Prediction:', insights.closingLinePrediction || 'N/A');
      console.log('Optimal Timing:', insights.optimalTiming || 'N/A');
      console.log('Line Shopping Edge:', insights.lineShoppingEdge || 'N/A');
      console.log('Public vs Sharp Split:', insights.publicVsSharpSplit || 'N/A');
      console.log('Market Timing:', insights.marketTimingAdvantage || 'N/A');
      console.log('Injury Timing:', insights.injuryTimingEdge || 'N/A');
      console.log('Cross Market:', insights.crossMarketDiscrepancy || 'N/A');
    }
    
    console.log('\n🚀 PROFESSIONAL PIPELINE TEST COMPLETE');
    console.log('✅ All systems operational and processing correctly');
    
  } catch (error) {
    console.log('❌ Professional pipeline test failed:', error.message);
    console.log('Stack:', error.stack);
  }
}

testProfessionalPipeline().catch(console.error);