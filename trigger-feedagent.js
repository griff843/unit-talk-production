require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

console.log('🚀 Manual FeedAgent Execution Test');
console.log('='.repeat(50));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function triggerFeedAgent() {
  try {
    console.log('📊 Before: Checking current raw_props count...');
    const { data: beforeData, error: beforeError } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact' });
    
    if (beforeError) throw beforeError;
    console.log(`   Current props in database: ${beforeData.length}`);

    // Get props created today
    const today = new Date().toISOString().split('T')[0];
    const { data: todayBefore, error: todayBeforeError } = await supabase
      .from('raw_props')
      .select('id')
      .gte('created_at', today + 'T00:00:00')
      .lt('created_at', today + 'T23:59:59');
    
    if (todayBeforeError) throw todayBeforeError;
    console.log(`   Props created today: ${todayBefore.length}`);

    console.log('\\n🔄 Manually triggering FeedAgent execution...');
    
    // Import FeedAgent classes
    const { FeedAgent } = require('./apps/api/dist/agents/FeedAgent/index.js');
    
    // Create FeedAgent configuration
    const feedConfig = {
      name: 'FeedAgent',
      enabled: true,
      version: '1.0.0',
      logLevel: 'info',
      providers: {
        unified: {
          name: 'unified-router',
          enabled: true,
          sports: ['NFL', 'MLB', 'NCAAF', 'NBA', 'NHL']
        }
      }
    };

    // Create dependencies
    const dependencies = {
      supabase: supabase,
      logger: {
        info: (msg, meta) => console.log(`[INFO] ${msg}`, meta || ''),
        warn: (msg, meta) => console.log(`[WARN] ${msg}`, meta || ''),
        error: (msg, meta) => console.log(`[ERROR] ${msg}`, meta || ''),
        debug: (msg, meta) => console.log(`[DEBUG] ${msg}`, meta || '')
      },
      metrics: {
        increment: (name) => console.log(`[METRIC] ${name}++`),
        gauge: (name, value) => console.log(`[METRIC] ${name} = ${value}`),
        histogram: (name, value) => console.log(`[METRIC] ${name} histogram: ${value}`)
      }
    };

    // Create and initialize FeedAgent
    console.log('   Creating FeedAgent instance...');
    const feedAgent = new FeedAgent(feedConfig, dependencies);
    
    console.log('   Starting FeedAgent execution...');
    
    // Initialize and process
    await feedAgent.initialize?.();
    await feedAgent.process();
    
    console.log('\\n📈 After: Checking updated raw_props count...');
    const { data: afterData, error: afterError } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact' });
    
    if (afterError) throw afterError;
    console.log(`   Total props after execution: ${afterData.length}`);
    
    const { data: todayAfter, error: todayAfterError } = await supabase
      .from('raw_props')
      .select('id')
      .gte('created_at', today + 'T00:00:00')
      .lt('created_at', today + 'T23:59:59');
    
    if (todayAfterError) throw todayAfterError;
    console.log(`   Props created today after execution: ${todayAfter.length}`);
    
    const newPropsAdded = afterData.length - beforeData.length;
    const newTodayPropsAdded = todayAfter.length - todayBefore.length;
    
    console.log('\\n🎯 Execution Results:');
    console.log('=' .repeat(30));
    console.log(`Total new props added: ${newPropsAdded}`);
    console.log(`New props added today: ${newTodayPropsAdded}`);
    
    if (newPropsAdded > 0) {
      console.log('\\n✅ SUCCESS: FeedAgent successfully fetched new data!');
      
      // Check sports breakdown of new props
      const { data: newSportsBreakdown, error: sportsError } = await supabase
        .from('raw_props')
        .select('sport')
        .gte('created_at', new Date(Date.now() - 60000).toISOString()); // Last minute
      
      if (!sportsError && newSportsBreakdown.length > 0) {
        const sportCounts = newSportsBreakdown.reduce((acc, prop) => {
          acc[prop.sport] = (acc[prop.sport] || 0) + 1;
          return acc;
        }, {});
        
        console.log('\\n📊 New props by sport:');
        Object.entries(sportCounts).forEach(([sport, count]) => {
          console.log(`   ${sport}: ${count} props`);
        });
      }
    } else {
      console.log('\\n⚠️ No new props added. Check for:');
      console.log('   1. API errors during fetch');
      console.log('   2. Data deduplication (props already exist)');
      console.log('   3. Processing errors');
    }
    
  } catch (error) {
    console.error('💥 FeedAgent execution failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

triggerFeedAgent();