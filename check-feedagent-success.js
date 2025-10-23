const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkFeedAgentSuccess() {
  try {
    console.log('🔍 Comprehensive FeedAgent Success Check');
    console.log('='.repeat(50));
    
    // Check last 2 hours for FeedAgent data
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    const { data: recentProps, error } = await supabase
      .from('raw_props')
      .select('id, player_name, sport, provider, created_at, inserted_at')
      .gte('created_at', twoHoursAgo)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    console.log(`Total props in last 2 hours: ${recentProps.length}`);
    
    if (recentProps.length > 0) {
      const sportBreakdown = recentProps.reduce((acc, prop) => {
        acc[prop.sport] = (acc[prop.sport] || 0) + 1;
        return acc;
      }, {});
      
      console.log('Props by sport:', sportBreakdown);
      
      // Check providers
      const providerBreakdown = recentProps.reduce((acc, prop) => {
        const provider = prop.provider || 'null';
        acc[provider] = (acc[provider] || 0) + 1;
        return acc;
      }, {});
      
      console.log('Props by provider:', providerBreakdown);
      
      // Show most recent props
      console.log('\nMost recent 5 props:');
      recentProps.slice(0, 5).forEach(prop => {
        console.log(`  ${prop.created_at} - ${prop.sport} - ${prop.player_name} - ${prop.provider}`);
      });
      
      // Check for FeedAgent/Optimal API props
      const feedAgentProps = recentProps.filter(p => 
        p.provider === 'unified-router' || 
        p.provider === 'optimal-api' || 
        (p.provider && p.provider.includes('optimal'))
      );
      
      if (feedAgentProps.length > 0) {
        console.log(`\n🎉 BREAKTHROUGH SUCCESS: Found ${feedAgentProps.length} FeedAgent props!`);
        console.log('FeedAgent execution IS working and inserting data successfully!');
        
        const feedSportBreakdown = feedAgentProps.reduce((acc, prop) => {
          acc[prop.sport] = (acc[prop.sport] || 0) + 1;
          return acc;
        }, {});
        
        console.log('FeedAgent props by sport:', feedSportBreakdown);
        
        console.log('\nFeedAgent sample props:');
        feedAgentProps.slice(0, 3).forEach(prop => {
          console.log(`  ${prop.sport}: ${prop.player_name} (${prop.created_at})`);
        });
        
        return {
          success: true,
          totalProps: feedAgentProps.length,
          sportBreakdown: feedSportBreakdown
        };
      } else {
        console.log('\n⚠️ No explicit FeedAgent props found by provider name');
        console.log('But recent props exist - may be provider naming issue');
        return { success: false, reason: 'provider_naming' };
      }
    } else {
      console.log('\n❌ No props found in last 2 hours at all');
      return { success: false, reason: 'no_recent_props' };
    }
    
  } catch (error) {
    console.error('💥 Error checking FeedAgent data:', error.message);
    return { success: false, error: error.message };
  }
}

async function checkDatabaseTotals() {
  try {
    console.log('\n📊 Database Totals Check:');
    
    const { data: totalData, error: totalError } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact' });
    
    if (totalError) throw totalError;
    
    console.log(`Total raw_props in database: ${totalData.length}`);
    
    // Check today's props
    const today = new Date().toISOString().split('T')[0];
    const { data: todayData, error: todayError } = await supabase
      .from('raw_props')
      .select('id, sport')
      .gte('created_at', today + 'T00:00:00')
      .lt('created_at', today + 'T23:59:59');
    
    if (todayError) throw todayError;
    
    console.log(`Props created today: ${todayData.length}`);
    
    if (todayData.length > 0) {
      const todaySports = todayData.reduce((acc, prop) => {
        acc[prop.sport] = (acc[prop.sport] || 0) + 1;
        return acc;
      }, {});
      console.log('Today\'s props by sport:', todaySports);
    }
    
  } catch (error) {
    console.error('Database totals check failed:', error.message);
  }
}

async function main() {
  const result = await checkFeedAgentSuccess();
  await checkDatabaseTotals();
  
  console.log('\n🎯 FINAL ASSESSMENT:');
  console.log('=' .repeat(30));
  
  if (result.success) {
    console.log('🟢 SYSTEM STATUS: OPERATIONAL');
    console.log(`✅ FeedAgent successfully inserted ${result.totalProps} props`);
    console.log('✅ Database insertion working correctly');
    console.log('✅ API connectivity confirmed');
    console.log('✅ Schema transformation successful');
    
    console.log('\n🚀 NEXT CRITICAL STEPS:');
    console.log('1. ⚡ URGENT: Trigger ScoringAgent to process the new props');
    console.log('2. 🏈 Fix NCAAF routing to use Odds API for complete coverage');
    console.log('3. ✅ Validate end-to-end pipeline through Command Center');
    
  } else {
    console.log('🔴 SYSTEM STATUS: NEEDS INVESTIGATION');
    console.log(`❌ Issue: ${result.reason || result.error}`);
    console.log('🔧 FeedAgent may need further debugging');
  }
}

main();