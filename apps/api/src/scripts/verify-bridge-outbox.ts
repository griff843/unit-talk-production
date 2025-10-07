import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyBridgeOutbox() {
  console.log('🔍 Querying bridge_outbox for recent ticket_submitted events...\n');

  // Query bridge_outbox - let Supabase return what columns exist
  const { data, error } = await supabase
    .from('bridge_outbox')
    .select('*')
    .eq('event_type', 'ticket_submitted')
    .gte('created_at', new Date(Date.now() - 7200000).toISOString()) // Last 2 hours
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Query error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️ No ticket_submitted events found in bridge_outbox');
    return;
  }

  console.log(`✅ Found ${data.length} recent ticket_submitted event(s):\n`);

  data.forEach((event: any, idx: number) => {
    console.log(`Event #${idx + 1}:`);
    console.log('  ID:', event.id);
    console.log('  Unique Key:', event.unique_key || 'N/A');
    console.log('  Event Type:', event.event_type);
    console.log('  Status:', event.status);
    console.log('  Attempts:', event.attempts || 0);
    console.log('  Created At:', event.created_at);
    console.log('  Processed At:', event.processed_at || 'Not processed yet');
    console.log('  Error:', event.error_message || 'None');
    console.log('  Full Event Data:');
    console.log(JSON.stringify(event, null, 2));
    console.log('---\n');
  });

  // Check if most recent event matches our test data
  const latest = data[0] as any;

  console.log('🎯 Verification Checks:');
  console.log('  ✓ Event type is ticket_submitted:', latest.event_type === 'ticket_submitted');
  console.log('  ✓ Has bet_slip_id (unique_key):', !!latest.unique_key);
  console.log('  ✓ Status is pending or completed:', ['pending', 'completed', 'processing'].includes(latest.status));
  console.log('  ✓ Created in last 2 hours:', new Date(latest.created_at) > new Date(Date.now() - 7200000));
}

verifyBridgeOutbox().catch(console.error);
