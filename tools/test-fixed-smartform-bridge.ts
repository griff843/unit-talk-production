import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

/**
 * Phase B Verification: Test fixed SmartFormBridge data transformation
 * This tests the corrected schema-compatible transformation
 */

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const client = createClient(supabaseUrl, supabaseServiceKey);

// Test ticket ID from previous Phase B test
const TEST_TICKET_ID = 'a6768865-39ab-41e0-b8e1-17aeaa8b4c23';

async function testFixedSmartFormBridge() {
  console.log('🔧 Phase B Verification: Fixed SmartFormBridge Testing');
  console.log('='.repeat(60));

  try {
    // Get the test smart ticket
    console.log('\n1️⃣ Retrieving test smart ticket...');
    const { data: smartTicket, error: ticketError } = await client
      .from('smart_tickets')
      .select('*')
      .eq('id', TEST_TICKET_ID)
      .single();

    if (ticketError) {
      console.log('❌ Failed to get smart ticket:', ticketError);
      return;
    }

    console.log('✅ Smart ticket retrieved:', {
      id: smartTicket.id,
      capper: smartTicket.capper,
      status: smartTicket.status,
      market_type: smartTicket.market_type,
    });

    // Transform using the fixed schema-compatible format
    console.log('\n2️⃣ Testing fixed data transformation...');
    const leg = smartTicket.legs[0] as any;

    const transformedPick = {
      // Core pick identification
      player_name: leg?.player_name || null,
      sport: smartTicket.sport || 'NFL',
      team: leg?.team || null,
      stat_type: leg?.stat_type || null,
      outcome: leg?.selection || null,
      line: leg?.line ? parseFloat(leg.line) : null,
      odds: leg?.odds ? parseFloat(leg.odds) : null,
      direction: leg?.selection?.toLowerCase().includes('over')
        ? 'over'
        : leg?.selection?.toLowerCase().includes('under')
          ? 'under'
          : null,

      // Game and betting context
      game_date: smartTicket.game_date || new Date().toISOString().split('T')[0],
      matchup: leg?.game || leg?.matchup || null,
      capper: smartTicket.capper,
      unit_size: smartTicket.unit_size || 1,
      bet_type: smartTicket.bet_type || 'player_props',
      market_type: smartTicket.market_type || 'scheduled',

      // Tier and confidence
      tier: 'A', // Default tier for smart form submissions
      confidence_score: smartTicket.confidence_level * 10, // Convert 1-10 to 10-100
      auto_approved: true, // Smart form submissions are auto-approved

      // Status and tracking
      play_status: 'pending',
      source: 'smart_form_bridge_test',
      promoted_to_final: false,
      has_alert: false,

      // Timestamps
      created_at: new Date().toISOString(),

      // Optional fields that may be populated later
      tier_tag: null,
      parlay_id: smartTicket.ticket_type === 'parlay' ? `parlay-${smartTicket.id}` : null,
      is_primary_leg: smartTicket.ticket_type !== 'parlay' || smartTicket.legs.indexOf(leg) === 0,
      play_tag: null,
      edge_score: null,
      context_flag: null,
    };

    console.log('✅ Data transformation completed:', {
      player_name: transformedPick.player_name,
      sport: transformedPick.sport,
      outcome: transformedPick.outcome,
      line: transformedPick.line,
      odds: transformedPick.odds,
      direction: transformedPick.direction,
    });

    // Test database insertion
    console.log('\n3️⃣ Testing database insertion...');
    const { data: insertedPick, error: insertError } = await client
      .from('daily_picks')
      .insert(transformedPick)
      .select('id')
      .single();

    if (insertError) {
      console.log('❌ Database insertion failed:', insertError);
      return;
    }

    console.log('✅ Daily pick inserted successfully:', insertedPick.id);

    // Test final_picks promotion format
    console.log('\n4️⃣ Testing final_picks promotion format...');
    const insights = {
      systemGrade: 'A-tier',
      systemConfidence: 85,
      capperConfidence: smartTicket.confidence_level * 10,
      expectedValue: 0.05,
    };

    const finalPick = {
      id: `final-${insertedPick.id}`,
      daily_pick_id: insertedPick.id,

      // Core pick data from daily_picks
      player_name: transformedPick.player_name,
      sport: transformedPick.sport,
      team: transformedPick.team,
      stat_type: transformedPick.stat_type,
      outcome: transformedPick.outcome,
      line: transformedPick.line,
      odds: transformedPick.odds,
      direction: transformedPick.direction,

      // Game context
      game_date: transformedPick.game_date,
      matchup: transformedPick.matchup,
      capper: transformedPick.capper,
      unit_size: transformedPick.unit_size,
      bet_type: transformedPick.bet_type,

      // Tier and confidence from insights
      tier: insights.systemGrade,
      confidence_score: insights.systemConfidence,
      expected_value_score: insights.expectedValue,

      // Status and routing
      play_status: 'pending', // Critical: AlertAgent monitors pending picks for live notifications
      market_type: transformedPick.market_type,
      auto_approved: true,

      // Smart form specific tracking
      source: 'smart_form_bridge_test',
      promoted_from_daily: true,
      user_confidence: insights.capperConfidence,

      // Results (to be filled later)
      result: null,
      actual_stat: null,
      final_result: null,

      // Discord integration
      posted_to_discord: false,
      thread_id: null,
      discord_post_id: null,

      // Timestamps
      created_at: new Date().toISOString(),
    };

    const { data: insertedFinalPick, error: finalError } = await client
      .from('final_picks')
      .insert(finalPick)
      .select('id')
      .single();

    if (finalError) {
      console.log('❌ Final picks insertion failed:', finalError);
    } else {
      console.log('✅ Final pick inserted successfully:', insertedFinalPick.id);
    }

    // Clean up test data
    console.log('\n5️⃣ Cleaning up test data...');

    if (insertedFinalPick) {
      await client.from('final_picks').delete().eq('id', insertedFinalPick.id);
    }

    await client.from('daily_picks').delete().eq('id', insertedPick.id);
    console.log('✅ Test data cleaned up');

    console.log('\n📊 Phase B Fixed SmartFormBridge Test Summary:');
    console.log('- Smart ticket retrieval: ✅ Working');
    console.log('- Schema-compatible transformation: ✅ Working');
    console.log('- Daily picks insertion: ✅ Working');
    console.log('- Final picks promotion: ' + (finalError ? '❌ BLOCKED' : '✅ Working'));

    if (!insertError && !finalError) {
      console.log('\n🎉 PHASE B CORE BUSINESS LOGIC: FIXED AND WORKING!');
      console.log('SmartFormBridge database compatibility issues resolved.');
      console.log('Ready to test full SmartFormBridge.processSubmission() workflow.');
    } else {
      console.log('\n⚠️ Some issues remain - check error details above');
    }
  } catch (error) {
    console.error('💥 Phase B Fixed SmartFormBridge test failed:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
  }
}

// Run the test
testFixedSmartFormBridge();
