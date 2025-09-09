const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyCompleteSystem() {
  console.log('🔍 COMPREHENSIVE SYSTEM VERIFICATION');
  console.log('=====================================');
  
  // Check all recent FeedAgent props (last 2 hours for broader coverage)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  const { data: allRecentProps } = await supabase
    .from('raw_props')
    .select('id, sport, provider, professional_score, processed_at, auto_approved, created_at')
    .gte('created_at', twoHoursAgo)
    .eq('provider', 'unified-router')
    .order('created_at', { ascending: false });
    
  console.log(`📊 Total FeedAgent Props (2hr): ${allRecentProps?.length || 0}`);
  
  if (allRecentProps && allRecentProps.length > 0) {
    // Sport breakdown
    const sportBreakdown = allRecentProps.reduce((acc, p) => {
      acc[p.sport] = (acc[p.sport] || 0) + 1;
      return acc;
    }, {});
    console.log('   Sports Distribution:', sportBreakdown);
    
    // Grading status breakdown
    const withScores = allRecentProps.filter(p => p.professional_score !== null);
    const processed = allRecentProps.filter(p => p.processed_at !== null);
    const autoApproved = allRecentProps.filter(p => p.auto_approved === true);
    
    console.log('\n🎯 Grading Pipeline Status:');
    console.log(`   Props with professional scores: ${withScores.length}/${allRecentProps.length}`);
    console.log(`   Props processed: ${processed.length}/${allRecentProps.length}`);
    console.log(`   Auto-approved props: ${autoApproved.length}/${allRecentProps.length}`);
    
    // Show detailed status for each prop
    console.log(`\n📋 Detailed Status (showing all ${allRecentProps.length} props):`);
    allRecentProps.forEach((prop, index) => {
      const scoreStatus = prop.professional_score ? `score: ${parseFloat(prop.professional_score).toFixed(3)}` : 'no score';
      const processStatus = prop.processed_at ? 'processed' : 'pending';
      const approvalStatus = prop.auto_approved ? 'auto-approved' : 'manual review';
      
      console.log(`   ${index + 1}. ${prop.sport} - ${scoreStatus} - ${processStatus} - ${approvalStatus}`);
    });
    
    // Check for any that didn't make it through
    const unprocessed = allRecentProps.filter(p => p.processed_at === null && p.professional_score === null);
    if (unprocessed.length > 0) {
      console.log(`\n⚠️ Props not yet processed: ${unprocessed.length}`);
      console.log('   These may need GradingAgent retry or have specific issues');
    }
    
    // Success rate calculation
    const successRate = ((processed.length / allRecentProps.length) * 100).toFixed(1);
    console.log(`\n📈 Pipeline Success Rate: ${successRate}%`);
    
    // Check if we're getting the 40+ props the user mentioned
    if (allRecentProps.length < 40) {
      console.log(`\n🔍 User mentioned 40+ props - found ${allRecentProps.length}`);
      console.log('   Checking if there are more props from different time windows...');
      
      // Check last 4 hours
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const { data: extendedProps } = await supabase
        .from('raw_props')
        .select('id, created_at')
        .gte('created_at', fourHoursAgo)
        .eq('provider', 'unified-router');
        
      if (extendedProps && extendedProps.length > allRecentProps.length) {
        console.log(`   Found ${extendedProps.length} props in 4-hour window`);
      }
    }
    
    // Final assessment
    console.log('\n🏆 SYSTEM VERIFICATION RESULTS:');
    console.log('===============================');
    
    if (processed.length === allRecentProps.length) {
      console.log('✅ PERFECT: All props processed through complete pipeline');
    } else if (processed.length > 0) {
      console.log(`✅ GOOD: ${processed.length}/${allRecentProps.length} props processed`);
      console.log('🔄 Some props may still be processing or need retry');
    } else {
      console.log('⚠️ PIPELINE CONNECTED: Props inserted but processing pending');
    }
    
  } else {
    console.log('❌ No recent props found from unified-router');
    console.log('   Checking if there are ANY props with unified-router...');
    
    const { data: anyUnifiedProps } = await supabase
      .from('raw_props')
      .select('id, created_at')
      .eq('provider', 'unified-router')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (anyUnifiedProps && anyUnifiedProps.length > 0) {
      console.log(`   Found ${anyUnifiedProps.length} older unified-router props`);
      console.log('   Most recent:', anyUnifiedProps[0].created_at);
    } else {
      console.log('   No unified-router props found in entire database');
    }
  }
}

verifyCompleteSystem();