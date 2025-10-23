import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSchema() {
  console.log('🔍 Checking unified_picks table schema...\n');

  const { data, error } = await supabase
    .from('unified_picks')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('✅ Columns found:');
    Object.keys(data[0]).forEach(column => {
      console.log(`   - ${column}`);
    });
  } else {
    console.log('⚠️ Table is empty, cannot determine columns from data');
  }

  // Also check bridge_outbox
  console.log('\n🔍 Checking bridge_outbox entries...\n');

  const { data: outboxData, error: outboxError } = await supabase
    .from('bridge_outbox')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);

  if (outboxError) {
    console.error('❌ Error:', outboxError.message);
    return;
  }

  console.log(`✅ Found ${outboxData?.length || 0} pending events in bridge_outbox:`);
  outboxData?.forEach((entry, i) => {
    console.log(`\n   Event ${i + 1}:`);
    console.log(`   - ID: ${entry.id}`);
    console.log(`   - Type: ${entry.event_type}`);
    console.log(`   - Bet Slip ID: ${entry.bet_slip_id}`);
    console.log(`   - Status: ${entry.status}`);
    console.log(`   - Retry Count: ${entry.retry_count}`);
    console.log(`   - Created: ${entry.created_at}`);
  });
}

checkSchema().catch(console.error);
