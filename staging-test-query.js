const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runQueries() {
  console.log('🔍 Running staging E2E test queries...');
  
  try {
    // Query 1: Raw props in last 10 minutes
    const { data: rawPropsRecent, error: error1 } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact' })
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());
      
    if (error1) throw error1;
    
    // Query 2: Total raw props and last created
    const { data: rawPropsTotal, error: error2 } = await supabase
      .from('raw_props')
      .select('created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (error2) throw error2;
    
    // Query 3: Processed props in last 10 minutes
    const { data: processedProps, error: error3 } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact' })
      .not('processed_at', 'is', null)
      .gte('processed_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());
      
    if (error3) throw error3;
    
    // Query 4: System promotions in last 10 minutes
    const { data: systemPromotions, error: error4 } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact' })
      .eq('pick_source', 'system')
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());
      
    if (error4) throw error4;
    
    const results = {
      timestamp: new Date().toISOString(),
      raw_props_last_10m: rawPropsRecent?.length || 0,
      total_raw_props: rawPropsTotal?.length || 0,
      last_created: rawPropsTotal?.[0]?.created_at || null,
      processed_last_10m: processedProps?.length || 0,
      system_promoted_last_10m: systemPromotions?.length || 0
    };
    
    console.log('✅ Database query results:', JSON.stringify(results, null, 2));
    return results;
    
  } catch (error) {
    console.error('❌ Database query failed:', error);
    throw error;
  }
}

runQueries().catch(console.error);