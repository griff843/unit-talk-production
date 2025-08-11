import { SmartFormBridge } from './src/services/SmartFormBridge';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

/**
 * Phase B Completion: Test complete SmartFormBridge.processSubmission() workflow
 * This tests the entire end-to-end processing with fixed database compatibility
 */

// Initialize Supabase client for verification
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const client = createClient(supabaseUrl, supabaseServiceKey);

// Test ticket ID from previous Phase B test
const TEST_TICKET_ID = 'a6768865-39ab-41e0-b8e1-17aeaa8b4c23';

async function testCompleteSmartFormProcessing() {
  console.log('🚀 Phase B Completion: Complete SmartFormBridge Processing Test');
  console.log('='.repeat(70));

  try {
    // Initialize SmartFormBridge
    console.log('\n1️⃣ Initializing SmartFormBridge...');
    const bridge = new SmartFormBridge();
    console.log('✅ SmartFormBridge initialized successfully');

    // Check initial smart ticket status
    console.log('\n2️⃣ Checking initial smart ticket status...');
    const { data: initialTicket } = await client
      .from('smart_tickets')
      .select('status, capper, market_type')
      .eq('id', TEST_TICKET_ID)
      .single();

    console.log('✅ Initial ticket status:', {
      status: initialTicket?.status,
      capper: initialTicket?.capper,
      market_type: initialTicket?.market_type,
    });

    // Process the submission using SmartFormBridge
    console.log('\n3️⃣ Processing submission through SmartFormBridge...');
    console.log('⏳ Starting SmartFormBridge.processSubmission()...');

    const startTime = Date.now();

    // Set a timeout to prevent hanging
    const processPromise = bridge.processSubmission(TEST_TICKET_ID);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('SmartFormBridge processing timed out after 30 seconds')),
        30000
      );
    });

    try {
      await Promise.race([processPromise, timeoutPromise]);
      const processingTime = Date.now() - startTime;
      console.log(`✅ SmartFormBridge processing completed in ${processingTime}ms`);
    } catch (processingError) {
      const processingTime = Date.now() - startTime;
      console.log(
        `❌ SmartFormBridge processing failed after ${processingTime}ms:`,
        processingError
      );

      // Continue with verification to see what actually happened
      console.log('🔍 Continuing with verification to check actual database state...');
    }

    // Verify the results in database
    console.log('\n4️⃣ Verifying processing results...');

    // Check smart ticket status
    const { data: processedTicket } = await client
      .from('smart_tickets')
      .select('status, error_message, insights')
      .eq('id', TEST_TICKET_ID)
      .single();

    console.log('Smart ticket final status:', {
      status: processedTicket?.status,
      hasInsights: !!processedTicket?.insights,
      errorMessage: processedTicket?.error_message,
    });

    // Check if daily pick was created
    const { data: dailyPicks } = await client
      .from('daily_picks')
      .select('id, player_name, capper, tier, play_status, source, created_at')
      .eq('capper', 'Griff843')
      .eq('source', 'smart_form_bridge')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log(`Found ${dailyPicks?.length || 0} daily picks from SmartFormBridge`);
    if (dailyPicks && dailyPicks.length > 0) {
      console.log('Latest daily pick:', {
        id: dailyPicks[0].id,
        player_name: dailyPicks[0].player_name,
        tier: dailyPicks[0].tier,
        play_status: dailyPicks[0].play_status,
        createdAt: dailyPicks[0].created_at,
      });
    }

    // Check if final pick was created
    const { data: finalPicks } = await client
      .from('final_picks')
      .select('id, player_name, capper, tier, play_status, posted_to_discord, created_at')
      .eq('capper', 'Griff843')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log(`Found ${finalPicks?.length || 0} final picks for Griff843`);
    if (finalPicks && finalPicks.length > 0) {
      console.log('Latest final pick:', {
        id: finalPicks[0].id,
        player_name: finalPicks[0].player_name,
        tier: finalPicks[0].tier,
        play_status: finalPicks[0].play_status,
        posted_to_discord: finalPicks[0].posted_to_discord,
        createdAt: finalPicks[0].created_at,
      });
    }

    console.log('\n📊 Phase B Complete Processing Test Summary:');
    console.log('- SmartFormBridge initialization: ✅ Working');
    console.log(
      '- Smart ticket processing: ' +
        (processedTicket?.status === 'processed' ? '✅ Working' : '❌ Failed or Incomplete')
    );
    console.log(
      '- Daily pick creation: ' +
        (dailyPicks && dailyPicks.length > 0 ? '✅ Working' : '❌ No picks created')
    );
    console.log(
      '- Final pick promotion: ' +
        (finalPicks && finalPicks.length > 0 ? '✅ Working' : '❌ No final picks created')
    );

    if (processedTicket?.status === 'processed' && dailyPicks && dailyPicks.length > 0) {
      console.log('\n🎉 PHASE B CORE BUSINESS LOGIC: FULLY OPERATIONAL!');
      console.log('SmartFormBridge is successfully processing smart form submissions.');
      console.log('Ready to proceed to Phase C: Discord Integration Verification.');
    } else {
      console.log('\n⚠️ Phase B still has issues - SmartFormBridge processing incomplete');
      if (processedTicket?.error_message) {
        console.log('Error details:', processedTicket.error_message);
      }
    }
  } catch (error) {
    console.error('💥 Phase B Complete Processing test failed:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
  }
}

// Run the complete processing test
testCompleteSmartFormProcessing();
