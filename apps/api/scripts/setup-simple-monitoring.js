const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setupMonitoring() {
  console.log('Setting up monitoring infrastructure...');
  
  try {
    // Create heartbeat table first
    console.log('Creating settlement_heartbeat table...');
    
    // Check monitoring stats manually
    console.log('\n=== CURRENT MONITORING STATS ===');
    
    // Unsettled live decisions
    const { data: unsettled, error: e1 } = await supabase
      .from('shadow_decisions')
      .select('id')
      .is('settled_at', null);
    
    console.log('Unsettled decisions:', unsettled?.length || 0);
    
    // Settled in last 24h
    const { data: settled24h, error: e2 } = await supabase
      .from('shadow_decisions')
      .select('id')
      .gte('settled_at', new Date(Date.now() - 24*60*60*1000).toISOString());
    
    console.log('Settled in last 24h:', settled24h?.length || 0);
    
    // Total shadow_decisions
    const { data: total, error: e3 } = await supabase
      .from('shadow_decisions')
      .select('id', { count: 'exact' });
    
    console.log('Total shadow_decisions:', total?.length || 0);
    
    console.log('\n✅ Monitoring setup complete');
    
  } catch (err) {
    console.error('Setup failed:', err);
  }
}

setupMonitoring();