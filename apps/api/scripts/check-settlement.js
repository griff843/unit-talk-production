const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSettlement() {
  const { data, error } = await supabase
    .from('shadow_decisions')
    .select('id, settled_at, settlement_source, actual_result')
    .eq('decision_type', 'settlement_backfill')
    .order('settled_at', { ascending: false });
  
  if (error) {
    console.error('Query failed:', error);
    return;
  }
  
  const settled = data?.filter(r => r.settled_at) || [];
  const unsettled = data?.filter(r => !r.settled_at) || [];
  
  console.log('=== SETTLEMENT STATUS ===');
  console.log('Settled records:', settled.length);
  console.log('Unsettled records:', unsettled.length);
  console.log('');
  
  if (settled.length > 0) {
    console.log('Last 5 settled:');
    settled.slice(0, 5).forEach(r => {
      console.log(`  ${r.id}: ${r.settled_at} (${r.settlement_source}) -> ${r.actual_result}`);
    });
  }
  
  // Check for records settled in last 24h
  const last24h = settled.filter(r => {
    const settledDate = new Date(r.settled_at);
    const now = new Date();
    const diff = now - settledDate;
    return diff < 24 * 60 * 60 * 1000;
  });
  
  console.log('');
  console.log('Settled in last 24h:', last24h.length);
}

checkSettlement().catch(console.error);