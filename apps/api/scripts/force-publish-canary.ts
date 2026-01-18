/**
 * Force CANARY publish bypassing circuit breaker
 *
 * Directly calls discord-sender without going through OutboxPublisher
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env FIRST
const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath });

// Verify token before importing modules
if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN not found');
  process.exit(1);
}

console.log(`✅ Token loaded: ${process.env.DISCORD_BOT_TOKEN.substring(0, 30)}...\n`);

// Now import modules
import { sendEmbed, formatPickEmbed } from '../src/publish/discord-sender';
import { buildPickView } from '../src/publish/pick-view';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function forcePublish(publishId: string): Promise<void> {
  console.log(`🚀 Force publishing CANARY pick...\n`);
  console.log(`Publish ID: ${publishId}\n`);

  try {
    // 1. Get publish record
    const { data: publishRecord, error: publishError } = await supabase
      .from('pick_publish')
      .select('*')
      .eq('id', publishId)
      .single();

    if (publishError || !publishRecord) {
      throw new Error(`Publish record not found: ${publishId}`);
    }

    console.log('✅ Found publish record:');
    console.log(`   Pick ID: ${publishRecord.pick_id}`);
    console.log(`   Channel: ${publishRecord.channel}`);
    console.log(`   Discord Channel ID: ${publishRecord.discord_channel_id}\n`);

    // 2. Get pick data
    const { data: pick, error: pickError } = await supabase
      .from('picks')
      .select('*')
      .eq('id', publishRecord.pick_id)
      .single();

    if (pickError || !pick) {
      throw new Error(`Pick not found: ${publishRecord.pick_id}`);
    }

    console.log('✅ Found pick:');
    console.log(`   Player: ${pick.player_name || 'N/A'}`);
    console.log(`   Selection: ${pick.selection}`);
    console.log(`   Odds: ${pick.odds}\n`);

    // 3. Build pick view
    const pickView = buildPickView(pick, publishRecord);

    console.log('📝 Building embed...\n');

    // 4. Format embed
    const embed = formatPickEmbed(pickView);

    console.log('📡 Sending to Discord...\n');

    // 5. Send directly
    const result = await sendEmbed(embed, {
      discordChannelId: publishRecord.discord_channel_id,
      pickId: pick.id,
      tenantId: pick.tenant_id,
    });

    if (result.success) {
      console.log('✅ SUCCESS! Message sent to CANARY!\n');
      console.log(`Discord Message ID: ${result.messageId}\n`);

      // Update publish record
      await supabase
        .from('pick_publish')
        .update({
          status: 'sent',
          external_message_id: result.messageId,
        })
        .eq('id', publishId);

      console.log('✅ Database updated\n');

      console.log('======================================\n');
      console.log('HARD PROOF:\n');
      console.log(`✅ Discord Message ID: ${result.messageId}`);
      console.log(`✅ Channel ID: ${publishRecord.discord_channel_id}`);
      console.log(`✅ Pick ID: ${pick.id}`);
      console.log(`✅ Publish ID: ${publishId}\n`);

      console.log('SQL Verification:');
      console.log(`   SELECT * FROM pick_publish WHERE id = '${publishId}';\n`);

    } else {
      console.error('❌ FAILED:', result.error);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const publishId = process.argv[2] || '5c30638e-2d1f-4fa0-ba21-8cb6542d3cbd';

forcePublish(publishId).catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
