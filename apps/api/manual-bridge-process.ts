import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function manualBridgeProcess() {
  console.log('🌉 Manual Bridge Processing Started...');

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Get pending bridge_outbox events
  const { data: events, error } = await supabase
    .from('bridge_outbox')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5);

  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  if (!events || events.length === 0) {
    console.log('⚠️ No pending events found');
    return;
  }

  console.log(`📦 Found ${events.length} pending events`);

  for (const event of events) {
    console.log(`\n🎫 Processing event: ${event.bet_slip_id}`);
    console.log(`Event data:`, JSON.stringify(event.event_data, null, 2));

    try {
      // Mark as processing
      await supabase
        .from('bridge_outbox')
        .update({
          status: 'processing',
          attempts: (event.attempts || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', event.id);

      // Extract event data
      const eventData = event.event_data;

      // Simulate unified_picks creation (normally done by SmartFormBridge)
      const unifiedPick = {
        id: `unified-${event.bet_slip_id}`,
        player_name: eventData.selections[0]?.player_name || 'Unknown Player',
        sport: eventData.sport || 'NFL',
        team: eventData.selections[0]?.team_name || 'Unknown Team',
        stat_type: eventData.selections[0]?.stat_type || 'Unknown Stat',
        outcome: eventData.selections[0]?.selection || 'over',
        line: eventData.selections[0]?.line || 0,
        odds: eventData.selections[0]?.leg_odds || -110,
        direction: eventData.selections[0]?.selection || 'over',
        game_date: new Date().toISOString().split('T')[0],
        matchup: `${eventData.selections[0]?.team_name || 'Team'} vs Opponent`,
        capper: eventData.capper_id,
        unit_size: eventData.total_units || 1,
        bet_type: 'player_props',
        tier: 'A', // Default tier for smart form submissions
        confidence_score: 75, // Default confidence
        expected_value_score: 50,
        play_status: 'pending',
        auto_approved: true,
        parlay_id: eventData.ticket_type === 'parlay' ? `parlay-${event.bet_slip_id}` : null,
        is_primary_leg: true,
        posted_to_discord: false,
        created_at: new Date().toISOString(),
        source: 'smart_form_bridge'
      };

      // Insert into unified_picks
      const { error: insertError } = await supabase
        .from('unified_picks')
        .insert(unifiedPick);

      if (insertError) {
        throw new Error(`Failed to insert unified pick: ${insertError.message}`);
      }

      console.log(`✅ Created unified pick: ${unifiedPick.id}`);

      // Mark bridge_outbox event as completed
      await supabase
        .from('bridge_outbox')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          attempts: (event.attempts || 0) + 1
        })
        .eq('id', event.id);

      console.log(`✅ Event ${event.bet_slip_id} processed successfully`);

    } catch (error) {
      console.error(`❌ Failed to process event ${event.bet_slip_id}:`, error);

      // Mark as failed
      await supabase
        .from('bridge_outbox')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
          attempts: (event.attempts || 0) + 1
        })
        .eq('id', event.id);
    }
  }

  console.log('\n🏁 Manual bridge processing completed');
}

// Run the manual processing
manualBridgeProcess().catch(console.error);