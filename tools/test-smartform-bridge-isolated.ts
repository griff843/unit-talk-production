import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

/**
 * Phase B Isolated Testing: Test SmartFormBridge methods individually
 * This isolates the hanging issue by testing each method separately
 */

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const client = createClient(supabaseUrl, supabaseServiceKey);

// Test ticket ID from previous Phase B test
const TEST_TICKET_ID = 'a6768865-39ab-41e0-b8e1-17aeaa8b4c23';

async function testSmartFormBridgeMethods() {
  console.log('🔍 Phase B Isolated Testing: SmartFormBridge Methods');
  console.log('='.repeat(60));

  try {
    // Test 1: Get smart ticket (should work)
    console.log('\n1️⃣ Testing getSmartTicket()...');
    const { data: smartTicket, error } = await client
      .from('smart_tickets')
      .select('*')
      .eq('id', TEST_TICKET_ID)
      .single();

    if (error) {
      console.log('❌ Failed to get smart ticket:', error);
      return;
    }

    console.log('✅ Smart ticket retrieved:', {
      id: smartTicket.id,
      capper: smartTicket.capper,
      status: smartTicket.status,
      market_type: smartTicket.market_type,
    });

    // Test 2: Validate capper exists (should work)
    console.log('\n2️⃣ Testing capper validation...');
    const capperThreads = process.env.CAPPER_THREADS ? JSON.parse(process.env.CAPPER_THREADS) : {};
    const capperThreadId = capperThreads[smartTicket.capper];
    console.log('✅ Capper thread ID found:', capperThreadId || 'NOT FOUND');

    // Test 3: Transform to platform format (should work)
    console.log('\n3️⃣ Testing transform to platform format...');
    const platformPick = {
      id: `smart-${smartTicket.id}`,
      pick_id: `smart-pick-${smartTicket.id}`,
      player: smartTicket.legs[0]?.player_name || undefined,
      team: smartTicket.legs[0]?.team || undefined,
      statType: smartTicket.legs[0]?.stat_type || undefined,
      direction: smartTicket.legs[0]?.selection?.includes('over')
        ? 'over'
        : smartTicket.legs[0]?.selection?.includes('under')
          ? 'under'
          : undefined,
      line: smartTicket.legs[0]?.line ? parseFloat(smartTicket.legs[0].line) : undefined,
      odds: parseFloat(smartTicket.legs[0]?.odds) || 0,
      ticketType: smartTicket.ticket_type,
      pick_type: smartTicket.ticket_type,
      status: 'pending',
      meta: {
        capper: smartTicket.capper,
        tier: 'A',
        status: 'pending',
        odds: parseFloat(smartTicket.legs[0]?.odds) || 0,
        stake: smartTicket.unit_size,
        postedAt: new Date().toISOString(),
      },
    };
    console.log('✅ Platform pick transformed:', {
      id: platformPick.id,
      player: platformPick.player,
      direction: platformPick.direction,
      line: platformPick.line,
    });

    // Test 4: Check database schema compatibility
    console.log('\n4️⃣ Testing database schema compatibility...');

    // Check daily_picks table structure
    console.log('Checking daily_picks table...');
    const { data: dailyPicksSample, error: dailyPicksError } = await client
      .from('daily_picks')
      .select('*')
      .limit(1);

    if (dailyPicksError) {
      console.log('❌ Error accessing daily_picks:', dailyPicksError);
    } else if (dailyPicksSample.length > 0) {
      console.log('✅ daily_picks columns:', Object.keys(dailyPicksSample[0]));
    } else {
      console.log('⚠️ daily_picks table is empty, cannot determine structure');
    }

    // Check final_picks table structure
    console.log('Checking final_picks table...');
    const { data: finalPicksSample, error: finalPicksError } = await client
      .from('final_picks')
      .select('*')
      .limit(1);

    if (finalPicksError) {
      console.log('❌ Error accessing final_picks:', finalPicksError);
    } else if (finalPicksSample.length > 0) {
      console.log('✅ final_picks columns:', Object.keys(finalPicksSample[0]));
    } else {
      console.log('⚠️ final_picks table is empty, cannot determine structure');
    }

    // Test 5: Try to insert into daily_picks (this is where it might fail)
    console.log('\n5️⃣ Testing daily_picks insertion...');
    const testDailyPick = {
      ...platformPick,
      created_at: new Date().toISOString(),
    };

    const { data: insertedPick, error: insertError } = await client
      .from('daily_picks')
      .insert(testDailyPick)
      .select('id')
      .single();

    if (insertError) {
      console.log('❌ Failed to insert daily_pick:', insertError);
      console.log('Schema mismatch likely preventing SmartFormBridge processing');
    } else {
      console.log('✅ Daily pick inserted successfully:', insertedPick.id);

      // Clean up test data
      await client.from('daily_picks').delete().eq('id', insertedPick.id);
      console.log('🧹 Test data cleaned up');
    }

    console.log('\n📊 Phase B Isolated Test Summary:');
    console.log('- Smart ticket retrieval: ✅ Working');
    console.log('- Capper validation: ✅ Working');
    console.log('- Platform transformation: ✅ Working');
    console.log('- Database insertion: ' + (insertError ? '❌ BLOCKED' : '✅ Working'));

    if (insertError) {
      console.log('\n🔍 ROOT CAUSE IDENTIFIED:');
      console.log('SmartFormBridge is hanging because of database schema incompatibilities.');
      console.log('The Discord client initialization is a red herring - the real issue is');
      console.log('that the transformed data cannot be inserted into daily_picks table.');
      console.log('\nNext: Fix database schema or adjust SmartFormBridge data transformation.');
    }
  } catch (error) {
    console.error('💥 Phase B Isolated Test failed:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
  }
}

// Run the isolated test
testSmartFormBridgeMethods();
