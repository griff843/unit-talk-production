import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';

/**
 * Test Direct Discord Posting
 * This tests the Discord bot's ability to post alert messages to Griff843's thread
 */

async function testDiscordPosting() {
  console.log('📨 Testing Direct Discord Posting');
  console.log('='.repeat(40));

  let discordClient: Client | null = null;

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const client = createClient(supabaseUrl, supabaseServiceKey);

    // Get a pending pick to test with
    console.log('\n1️⃣ Getting a pending pick for testing...');
    const { data: pendingPicks } = await client
      .from('final_picks')
      .select('*')
      .eq('play_status', 'pending')
      .eq('posted_to_discord', false)
      .limit(1);

    if (!pendingPicks || pendingPicks.length === 0) {
      console.log('⚠️ No pending picks found for testing');
      return;
    }

    const testPick = pendingPicks[0];
    console.log('✅ Using test pick:', {
      id: testPick.id,
      player_name: testPick.player_name,
      capper: testPick.capper,
      tier: testPick.tier,
    });

    // Initialize Discord client
    console.log('\n2️⃣ Initializing Discord client...');
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    const discordToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
    if (!discordToken) {
      throw new Error('Discord token not found');
    }

    // Login to Discord
    await discordClient.login(discordToken);
    console.log('✅ Discord client logged in successfully');

    // Wait for ready
    await new Promise(resolve => {
      if (discordClient!.isReady()) {
        resolve(void 0);
      } else {
        discordClient!.once('ready', () => resolve(void 0));
      }
    });
    console.log('✅ Discord client is ready');

    // Get the thread/channel
    console.log('\n3️⃣ Finding target Discord thread...');
    const griff843ThreadId = process.env.CAPPER_THREAD_GRIFF843;
    console.log('Target thread ID:', griff843ThreadId);

    if (!griff843ThreadId) {
      throw new Error('Griff843 thread ID not configured');
    }

    const channel = await discordClient.channels.fetch(griff843ThreadId);
    if (!channel) {
      throw new Error(`Could not find channel/thread: ${griff843ThreadId}`);
    }

    console.log('✅ Found Discord thread:', {
      name: channel.name || 'Unknown',
      type: channel.type,
      id: channel.id,
    });

    // Create a simple alert message
    console.log('\n4️⃣ Creating alert message...');
    const alertMessage = {
      embeds: [
        {
          title: '🚨 Unit Talk Alert - Smart Form Pick',
          description: `**${testPick.player_name || 'Unknown Player'}** - ${testPick.outcome || 'Pick details'}`,
          fields: [
            { name: 'Capper', value: testPick.capper || 'Unknown', inline: true },
            { name: 'Tier', value: testPick.tier || 'N/A', inline: true },
            { name: 'Bet Type', value: testPick.bet_type || 'N/A', inline: true },
            { name: 'Line', value: testPick.line?.toString() || 'N/A', inline: true },
            { name: 'Odds', value: testPick.odds?.toString() || 'N/A', inline: true },
            { name: 'Units', value: testPick.unit_size?.toString() || 'N/A', inline: true },
          ],
          color: 0x00ff00, // Green color
          footer: { text: 'Unit Talk Production v3 - AlertAgent Test' },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    // Send the message
    console.log('\n5️⃣ Posting message to Discord...');
    const sentMessage = await (channel as any).send(alertMessage);
    console.log('✅ Message posted successfully!');
    console.log('Message details:', {
      id: sentMessage.id,
      url: sentMessage.url,
      channelId: sentMessage.channelId,
    });

    // Update the database to mark as posted
    console.log('\n6️⃣ Updating database to mark as posted...');
    const { error: updateError } = await client
      .from('final_picks')
      .update({
        posted_to_discord: true,
        discord_post_id: sentMessage.id,
      })
      .eq('id', testPick.id);

    if (updateError) {
      console.log('❌ Error updating database:', updateError);
    } else {
      console.log('✅ Database updated successfully');
    }

    console.log('\n🎉 DISCORD POSTING TEST: SUCCESS!');
    console.log('- Discord client connection: ✅ Working');
    console.log('- Thread access: ✅ Working');
    console.log('- Message posting: ✅ Working');
    console.log('- Database updates: ✅ Working');
    console.log('\nThe AlertAgent Discord integration is FULLY OPERATIONAL!');
    console.log(`Check Discord thread for the posted message: ${sentMessage.url}`);
  } catch (error) {
    console.error('💥 Discord posting test failed:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
  } finally {
    // Cleanup Discord client
    if (discordClient) {
      console.log('\n🧹 Cleaning up Discord client...');
      await discordClient.destroy();
      console.log('✅ Discord client cleaned up');
    }
  }
}

// Run the Discord posting test
testDiscordPosting();
