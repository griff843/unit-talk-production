/**
 * Direct CANARY E2E Test - Simplified for debugging
 *
 * Tests the complete flow:
 * 1. Query upcoming props from LOCAL postgres
 * 2. Create pick in Supabase
 * 3. Promote via API to CANARY
 * 4. Verify pick_publish in LOCAL postgres
 */

import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// LOCAL postgres connection (for raw_props and pick_publish verification)
const localPool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'unit_talk_dev',
});

// SUPABASE connection (where API looks for picks)
const SUPABASE_URL = 'https://cqfnsozknjzvyiziwicl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZm5zb3prbmp6dnlpeml3aWNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg5NDQxOSwiZXhwIjoyMDc1NDcwNDE5fQ.0fvfA63iHuhlsPNwsVjtQdzMjNivtPLFQZ4hCRX43LI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const API_URL = 'http://localhost:3010';

async function main() {
  console.log('🧪 CANARY DIRECT E2E TEST\n');
  const startTime = Date.now();

  try {
    // Step 1: Verify upcoming props exist in LOCAL postgres
    console.log('📊 Step 1: Verify upcoming props in LOCAL postgres...');
    const countResult = await localPool.query(`
      SELECT COUNT(*) FILTER (WHERE event_time >= NOW()
                       AND event_time <= NOW() + INTERVAL '48 hours') AS upcoming_count,
        MIN(event_time) FILTER (WHERE event_time >= NOW()) AS min_upcoming,
        MAX(event_time) FILTER (WHERE event_time <= NOW() + INTERVAL '48 hours') AS max_upcoming
      FROM raw_props
    `);

    const { upcoming_count, min_upcoming, max_upcoming } = countResult.rows[0];
    console.log(`  Upcoming count: ${upcoming_count}`);
    console.log(`  Min upcoming: ${min_upcoming}`);
    console.log(`  Max upcoming: ${max_upcoming}`);

    if (parseInt(upcoming_count) === 0) {
      throw new Error('🚫 BLOCKING CONDITION: No upcoming props found in raw_props table');
    }
    console.log(`  ✅ Found ${upcoming_count} upcoming props`);

    // Step 2: Select one prop to test with
    console.log('\n📌 Step 2: Select one upcoming prop...');
    const propResult = await localPool.query(`
      SELECT * FROM raw_props
      WHERE event_time > NOW() AND event_time <= NOW() + INTERVAL '48 hours'
        AND player_name IS NOT NULL
        AND stat_type IS NOT NULL
        AND (over_odds IS NOT NULL OR under_odds IS NOT NULL)
      ORDER BY event_time ASC
      LIMIT 1
    `);

    if (propResult.rows.length === 0) {
      throw new Error('No valid upcoming prop found (needs player_name, stat_type, odds)');
    }

    const prop = propResult.rows[0];
    console.log(`  Player: ${prop.player_name}`);
    console.log(`  Stat: ${prop.stat_type}`);
    console.log(`  Sport: ${prop.sport || 'N/A'}`);
    console.log(`  Event Time: ${prop.event_time}`);
    console.log(`  Over odds: ${prop.over_odds || 'N/A'}`);
    console.log(`  Under odds: ${prop.under_odds || 'N/A'}`);

    // Step 3: Create pick in SUPABASE (where API looks)
    console.log('\n🎯 Step 3: Create pick in Supabase...');

    const pickPayload = {
      tenant_id: '12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a', // Valid tenant ID from Supabase
      user_id: '012602a5-52e8-457e-838e-45f0f43edfc3', // Valid user ID from Supabase
      selection: prop.player_name,
      odds: prop.under_odds || prop.over_odds || -110,
      stake: 3,
      confidence: 8,
      workflow_stage: 'approved',
      status: 'pending',
      idempotency_key: `canary-direct-${Date.now()}`,
      metadata: {
        raw_prop_id: prop.id,
        sport: prop.sport,
        player_name: prop.player_name,
        stat_type: prop.stat_type,
        source: 'CANARY_DIRECT_E2E'
      }
    };

    console.log(`  Creating pick with stake=${pickPayload.stake}, confidence=${pickPayload.confidence}...`);

    const { data: pick, error: pickError } = await supabase
      .from('picks')
      .insert(pickPayload)
      .select()
      .single();

    if (pickError) {
      throw new Error(`Failed to create pick in Supabase: ${pickError.message}`);
    }

    const pickId = pick.id;
    console.log(`  ✅ Pick created in Supabase: ${pickId}`);

    // Step 4: Promote to CANARY
    console.log('\n🚀 Step 4: Promote to CANARY...');
    const promoteResponse = await axios.post(
      `${API_URL}/api/ops/picks/${pickId}/promote`,
      { channel: 'CANARY' },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-e2e-test': 'true' // Bypass auth for E2E test
        }
      }
    );

    const publishId = promoteResponse.data.publishId;
    console.log(`  ✅ Publish ID: ${publishId}`);

    // Step 5: Poll pick_publish for status='sent'
    console.log('\n⏳ Step 5: Polling pick_publish...');
    const maxAttempts = 30;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const publishResult = await localPool.query(
        'SELECT status, external_message_id, discord_channel_id, attempts, last_error FROM pick_publish WHERE id = $1',
        [publishId]
      );

      if (publishResult.rows.length === 0) {
        console.log(`  [${attempt}/${maxAttempts}] No pick_publish row found yet...`);
        continue;
      }

      const pub = publishResult.rows[0];
      console.log(`  [${attempt}/${maxAttempts}] status=${pub.status}, message_id=${pub.external_message_id || 'null'}, attempts=${pub.attempts}`);

      if (pub.status === 'sent') {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n✅ PASS - Duration: ${duration}s`);
        console.log(`\n📊 FINAL STATE:`);
        console.log(`  Pick ID: ${pickId}`);
        console.log(`  Publish ID: ${publishId}`);
        console.log(`  Status: ${pub.status}`);
        console.log(`  Message ID: ${pub.external_message_id}`);
        console.log(`  Discord Channel: ${pub.discord_channel_id}`);
        await localPool.end();
        process.exit(0);
      }

      if (pub.status === 'failed') {
        throw new Error(`Publisher failed: ${pub.last_error}`);
      }
    }

    throw new Error('Timeout: pick_publish did not reach status=sent within 60 seconds');

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n❌ FAIL - Duration: ${duration}s`);
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (axios.isAxiosError(error)) {
      console.error(`API Response: ${JSON.stringify(error.response?.data)}`);
    }
    await localPool.end();
    process.exit(1);
  }
}

main();
