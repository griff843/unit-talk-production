import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
// Use service_role key to bypass RLS
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBridgeOutboxWrite() {
  console.log('🧪 Testing direct write to bridge_outbox...\n');

  const testBetSlipId = uuidv4();
  const testCapperId = '0aca56c1-b9d9-4fde-b9e1-914d779e50ba'; // Griff843

  const outboxEntry = {
    event_type: 'ticket_submitted',
    payload: {
      bet_slip_id: testBetSlipId,
      capper_id: testCapperId,
      selection_count: 1,
    },
    unique_key: testBetSlipId,
    status: 'pending',
    attempts: 0,
    max_attempts: 3,
    next_attempt_at: new Date(Date.now() + 5000).toISOString(),
  };

  console.log('📝 Attempting to insert:', JSON.stringify(outboxEntry, null, 2));

  const { data, error } = await supabase
    .from('bridge_outbox')
    .insert(outboxEntry)
    .select();

  if (error) {
    console.error('❌ Failed to write to bridge_outbox:', error);
    console.error('   Error code:', error.code);
    console.error('   Error message:', error.message);
    console.error('   Error details:', error.details);
    console.error('   Error hint:', error.hint);
    return;
  }

  console.log('✅ Successfully wrote to bridge_outbox!');
  console.log('   Record ID:', data?.[0]?.id);
  console.log('   Unique Key:', data?.[0]?.unique_key);
  console.log('   Status:', data?.[0]?.status);
  console.log('   Created At:', data?.[0]?.created_at);

  // Now verify we can read it back
  console.log('\n🔍 Verifying we can read it back...');

  const { data: readData, error: readError } = await supabase
    .from('bridge_outbox')
    .select('*')
    .eq('unique_key', testBetSlipId)
    .single();

  if (readError) {
    console.error('❌ Failed to read back:', readError);
  } else {
    console.log('✅ Successfully read back:');
    console.log(JSON.stringify(readData, null, 2));
  }
}

testBridgeOutboxWrite().catch(console.error);
