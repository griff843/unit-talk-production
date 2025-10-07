import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lxqmuzmqtnnlpfapvief.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTA5Njg0NSwiZXhwIjoyMDYwNjcyODQ1fQ.NFMR0P7iQU7aEa1ssY-jnDD2Tm5ylfzEpUEAkZZ2n7E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function processTestSubmission() {
  console.log('🎯 Processing test submission...\n');

  // Get our test submission
  const betSlipId = '72723da9-a166-4b72-8e0c-c20df9bae1f6';

  // Check if bridge_outbox entry exists
  const { data: outboxEvent, error: outboxError } = await supabase
    .from('bridge_outbox')
    .select('*')
    .eq('bet_slip_id', betSlipId)
    .single();

  if (outboxError || !outboxEvent) {
    console.error('❌ Bridge outbox entry not found:', outboxError);
    return;
  }

  console.log('✅ Found bridge_outbox entry:', outboxEvent.id);
  console.log('Event data:', JSON.stringify(outboxEvent.event_data, null, 2));

  // Create the unified_pick entry with the known test data
  const unifiedPick = {
    player_name: 'Patrick Mahomes',
    sport: 'NFL',
    team: 'KC',
    stat_type: 'Passing Yards',
    outcome: 'over',
    line: 275.5,
    odds: -110,
    direction: 'over',
    game_date: '2025-10-07',
    matchup: 'KC vs Opponent',
    user_id: outboxEvent.event_data.capper_id,
    unit_size: 2.0,
    bet_type: 'player_props',
    tier: 'A',
    confidence_score: 70,
    expected_value_score: 50,
    status: 'pending_approval',
    auto_approved: false, // Require manual approval for testing
    is_primary_leg: true,
    posted_to_discord: false,
    created_at: new Date().toISOString(),
    source: 'smart_form_manual_test',
    metadata: {
      bet_slip_id: betSlipId,
      submitted_via: 'smart_form',
      test_submission: true,
      player_team: 'KC'
    }
  };

  console.log('\n📝 Creating unified_picks entry...');

  const { data: insertedPick, error: insertError } = await supabase
    .from('unified_picks')
    .insert(unifiedPick)
    .select()
    .single();

  if (insertError) {
    console.error('❌ Failed to insert unified pick:', insertError);

    // Mark bridge_outbox as failed
    await supabase
      .from('bridge_outbox')
      .update({
        status: 'failed',
        error_message: insertError.message,
        retry_count: (outboxEvent.retry_count || 0) + 1
      })
      .eq('id', outboxEvent.id);

    return;
  }

  console.log('✅ Created unified pick:', insertedPick.id);

  // Mark bridge_outbox as completed
  const { error: updateError } = await supabase
    .from('bridge_outbox')
    .update({
      status: 'completed',
      processed_at: new Date().toISOString(),
      retry_count: (outboxEvent.retry_count || 0) + 1
    })
    .eq('id', outboxEvent.id);

  if (updateError) {
    console.error('⚠️ Failed to update bridge_outbox status:', updateError);
  } else {
    console.log('✅ Marked bridge_outbox as completed');
  }

  console.log('\n🎉 SUCCESS! Test submission processed:');
  console.log('  - Bridge outbox ID:', outboxEvent.id);
  console.log('  - Unified pick ID:', insertedPick.id);
  console.log('  - Player:', insertedPick.player_name);
  console.log('  - Pick:', `${insertedPick.outcome.toUpperCase()} ${insertedPick.line}`);
  console.log('  - Status:', insertedPick.status);
  console.log('\n✨ Pick should now appear in Command Center for approval!');
}

processTestSubmission().catch(console.error);
