import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

/**
 * Test script to create a Ravens vs Lions pick for tonight's game
 * This will test the complete E2E workflow with enhanced Discord posting including headshots
 */

async function createRavensLionsPick() {
  console.log('🏈 Creating Ravens vs Lions pick for tonight...\n');

  try {
    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Griff843 capper ID
    console.log('🔍 Looking up capper Griff843...');
    const { data: capperData, error: capperError } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', 'Griff843')
      .single();

    if (capperError || !capperData) {
      throw new Error(`Capper lookup failed: ${capperError?.message || 'Capper not found'}`);
    }
    console.log(`   ✅ Capper found: ${capperData.username} (ID: ${capperData.id})\n`);

    // Create tonight's Ravens vs Lions pick
    const testBetSlipId = `ravens-lions-${Date.now()}`;

    const pickData = {
      bet_slip_id: testBetSlipId,
      capper_id: capperData.id,
      sport: 'NFL',
      ticket_type: 'single',
      selections: [{
        player_name: 'Lamar Jackson',
        stat_type: 'Passing Yards',
        line: 275.5,
        selection: 'over',
        leg_odds: -110,
        source: 'manual'
      }],
      selection_count: 1,
      total_units: 2.0,
      notes: 'Ravens vs Lions - Lamar Jackson should have a big night against Detroit defense. Enhanced with player headshot!'
    };

    console.log('🎯 Creating bridge outbox event...');
    const { data: insertResult, error: insertError } = await supabase
      .from('bridge_outbox')
      .insert({
        event_type: 'ticket_submitted',
        event_data: pickData,
        bet_slip_id: testBetSlipId,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Pick creation failed: ${insertError.message}`);
    }

    console.log(`   ✅ Pick created successfully!`);
    console.log(`   📊 Event ID: ${insertResult.id}`);
    console.log(`   🎫 Bet Slip ID: ${testBetSlipId}`);
    console.log(`   🏈 Game: Ravens vs Lions`);
    console.log(`   🏃 Player: Lamar Jackson`);
    console.log(`   📈 Bet: Passing Yards Over 275.5`);
    console.log(`   💰 Units: 2.0`);
    console.log(`   🎪 Capper: Griff843`);

    console.log('\n🤖 Event has been created and is pending processing by BridgeWorker...');
    console.log('📱 Enhanced Discord posting with Lamar Jackson headshot should appear shortly!');
    console.log('🎮 Check Command Center and Discord for the pick posting.');

    // Check current status
    setTimeout(async () => {
      try {
        const { data: statusCheck } = await supabase
          .from('bridge_outbox')
          .select('status, processed_at, attempts')
          .eq('id', insertResult.id)
          .single();

        console.log('\n📊 Status Update:', {
          status: statusCheck?.status,
          processed_at: statusCheck?.processed_at,
          attempts: statusCheck?.attempts
        });
      } catch (error) {
        console.log('\n⚠️ Status check failed:', error);
      }
    }, 5000);

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
createRavensLionsPick()
  .then(() => {
    console.log('\n✅ Ravens vs Lions pick created successfully!');
    console.log('🔄 BridgeWorker will process this event and post to Discord with headshots.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });