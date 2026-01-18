/**
 * Promote Pick to CANARY
 *
 * Creates pick_publish record for CANARY channel and processes it
 *
 * Usage:
 *   npx tsx apps/api/scripts/promote-pick-to-canary.ts <pickId>
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from workspace root
const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CANARY_CHANNEL_ID = process.env.DISCORD_CANARY_CHANNEL_ID || '1296531122234327100';

async function promoteToCanary(pickId: string): Promise<void> {
  console.log('🚀 Promoting pick to CANARY\n');
  console.log(`Pick ID: ${pickId}\n`);

  try {
    // 1. Fetch pick details
    const { data: pick, error: pickError } = await supabase
      .from('picks')
      .select('*')
      .eq('id', pickId)
      .single();

    if (pickError || !pick) {
      throw new Error(`Pick not found: ${pickId}`);
    }

    console.log('✅ Found pick:');
    console.log(`   Player: ${pick.metadata?.player_name || pick.player_name || 'N/A'}`);
    console.log(`   Selection: ${pick.selection || 'N/A'}`);
    console.log(`   Odds: ${pick.odds || 'N/A'}`);
    console.log(`   Units: ${pick.stake || 'N/A'}`);
    console.log(`   Confidence: ${pick.confidence || 'N/A'}%`);
    console.log(`   Status: ${pick.status}`);
    console.log(`   Workflow Stage: ${pick.workflow_stage}\n`);

    // Validate business rules
    if (pick.stake && pick.stake > 5) {
      console.error(`❌ BUSINESS RULE VIOLATION: Units (${pick.stake}) exceeds max (5)`);
      process.exit(1);
    }

    // 2. Check for existing CANARY publish record
    const { data: existingPublish } = await supabase
      .from('pick_publish')
      .select('*')
      .eq('pick_id', pickId)
      .eq('channel', 'CANARY')
      .maybeSingle();

    if (existingPublish) {
      console.log('⚠️  CANARY publish record already exists:');
      console.log(`   Publish ID: ${existingPublish.id}`);
      console.log(`   Status: ${existingPublish.status}`);
      console.log(`   Attempts: ${existingPublish.attempts}`);
      console.log(`   Message ID: ${existingPublish.external_message_id || 'none'}\n`);

      if (existingPublish.status === 'sent') {
        console.log('✅ Already published successfully!\n');
        process.exit(0);
      }

      console.log('ℹ️  Using existing publish record\n');
      return;
    }

    // 3. Create pick_publish record for CANARY
    console.log('📝 Creating CANARY publish record...\n');

    const { data: publishRecord, error: publishError} = await supabase
      .from('pick_publish')
      .insert({
        pick_id: pickId,
        tenant_id: pick.tenant_id,
        channel: 'CANARY',
        discord_channel_id: CANARY_CHANNEL_ID,
        status: 'pending',
        metadata: {
          message_type: 'new_pick',
          player_name: pick.metadata?.player_name || pick.player_name,
          selection: pick.selection,
          odds: pick.odds,
          stake: pick.stake,
          confidence: pick.confidence,
          matchup: pick.matchup,
          tier: pick.metadata?.tier || pick.tier,
          professional_score: pick.metadata?.professional_score || pick.professional_score,
          sport: pick.sport || pick.league,
          bet_type: pick.bet_type,
          book: pick.book,
          source: 'promote_to_canary_script',
          created_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (publishError) {
      throw new Error(`Failed to create publish record: ${publishError.message}`);
    }

    console.log('✅ CANARY publish record created!\n');
    console.log('======================================\n');
    console.log('📋 Summary:\n');
    console.log(`   Pick ID: ${pickId}`);
    console.log(`   Publish ID: ${publishRecord.id}`);
    console.log(`   Channel: CANARY`);
    console.log(`   Discord Channel ID: ${CANARY_CHANNEL_ID}`);
    console.log(`   Status: pending\n`);

    console.log('✅ Success! Pick is ready for outbox publisher.\n');
    console.log('Next Steps:');
    console.log('   1. Run OutboxPublisher to process this pick');
    console.log('   2. Check Discord CANARY channel (#✨・vip-canary)');
    console.log('   3. Verify with SQL:\n');
    console.log(`      SELECT * FROM pick_publish WHERE id = '${publishRecord.id}';\n`);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Parse command line args
const pickId = process.argv[2];

if (!pickId) {
  console.error('❌ Usage: npx tsx promote-pick-to-canary.ts <pickId>');
  process.exit(1);
}

promoteToCanary(pickId).catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
