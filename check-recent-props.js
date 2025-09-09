const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRecentProps() {
  console.log('🔍 Checking for very recent props (last 30 minutes)...');
  
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('raw_props')
    .select('id, player_name, sport, provider, created_at')
    .gte('created_at', thirtyMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (error) throw error;
  
  console.log(`Found ${data.length} props in last 30 minutes:`);
  
  if (data.length > 0) {
    // Group by sport
    const sportBreakdown = data.reduce((acc, prop) => {
      acc[prop.sport] = (acc[prop.sport] || 0) + 1;
      return acc;
    }, {});
    
    console.log('By sport:', sportBreakdown);
    
    // Check providers
    const providerBreakdown = data.reduce((acc, prop) => {
      const provider = prop.provider || 'null';
      acc[provider] = (acc[provider] || 0) + 1;
      return acc;
    }, {});
    
    console.log('By provider:', providerBreakdown);
    
    console.log('\nMost recent props:');
    data.slice(0, 5).forEach(prop => {
      console.log(`  ${prop.created_at} - ${prop.sport} - ${prop.player_name} - ${prop.provider}`);
    });
    
    // Check for FeedAgent props specifically
    const feedAgentProps = data.filter(p => 
      p.provider === 'unified-router' || 
      p.provider === 'optimal-api' ||
      p.provider === 'odds-api'
    );
    
    if (feedAgentProps.length > 0) {
      console.log(`\n🎉 SUCCESS: Found ${feedAgentProps.length} FeedAgent props!`);
      console.log('FeedAgent props:', feedAgentProps.slice(0, 3));
    }
  } else {
    console.log('No props found in the last 30 minutes.');
  }
}

checkRecentProps();