import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lxqmuzmqtnnlpfapvief.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'
);

async function main() {
  // Check unified_picks for our test pick
  const { data: pick, error: pickError } = await supabase
    .from('unified_picks')
    .select('*')
    .eq('id', '03cfb6b8-1652-4c12-9742-d567c3f35591')
    .single();

  if (pickError || !pick) {
    console.error('❌ Pick not found:', pickError);
  } else {
    console.log('\n✅ PICK FOUND IN DATABASE:');
    console.log(`  ID: ${pick.id}`);
    console.log(`  Player: ${pick.player_name}`);
    console.log(`  Market: ${pick.market}`);
    console.log(`  Selection: ${pick.selection} ${pick.line}`);
    console.log(`  Odds: ${pick.odds}`);
    console.log(`  Status: ${pick.status}`);
    console.log(`  User ID: ${pick.user_id}`);
    console.log(`  Bet Slip ID: ${pick.metadata?.bet_slip_id}`);
  }

  // Check bridge_outbox status
  const { data: outbox, error: outboxError } = await supabase
    .from('bridge_outbox')
    .select('*')
    .eq('bet_slip_id', '72723da9-a166-4b72-8e0c-c20df9bae1f6')
    .single();

  if (outboxError || !outbox) {
    console.error('❌ Outbox not found:', outboxError);
  } else {
    console.log('\n✅ BRIDGE_OUTBOX STATUS:');
    console.log(`  ID: ${outbox.id}`);
    console.log(`  Status: ${outbox.status}`);
    console.log(`  Retry Count: ${outbox.retry_count}`);
    console.log(`  Processed At: ${outbox.processed_at || 'Not processed'}`);
  }
}

main();
