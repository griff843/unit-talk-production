import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lxqmuzmqtnnlpfapvief.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E'
);

async function cleanup() {
  console.log('Deleting hardcoded test picks...\n');

  // First, count picks with test_submission flag
  const { data: testPicks, error: countError } = await supabase
    .from('unified_picks')
    .select('id, player_name, created_at')
    .contains('metadata', { test_submission: true });

  if (countError) {
    console.error('Error counting picks:', countError);
    return;
  }

  console.log(`Found ${testPicks?.length || 0} test picks to delete:`);
  testPicks?.forEach(p => console.log(`   - ${p.id}: ${p.player_name}`));

  // Delete them
  const { error: deleteError } = await supabase
    .from('unified_picks')
    .delete()
    .contains('metadata', { test_submission: true });

  if (deleteError) {
    console.error('Delete error:', deleteError);
  } else {
    console.log(`\nDeleted ${testPicks?.length || 0} hardcoded test picks`);
  }

  // Also delete from bridge_outbox
  const { data: outboxEvents } = await supabase
    .from('bridge_outbox')
    .select('id, bet_slip_id')
    .eq('status', 'completed')
    .limit(100);

  console.log(`\nFound ${outboxEvents?.length || 0} completed bridge_outbox events`);

  if (outboxEvents && outboxEvents.length > 0) {
    const { error: outboxDeleteError } = await supabase
      .from('bridge_outbox')
      .delete()
      .eq('status', 'completed');

    if (!outboxDeleteError) {
      console.log(`Cleaned up ${outboxEvents.length} bridge_outbox entries`);
    }
  }
}

cleanup().catch(console.error);
