import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits } from 'discord.js';
import { buildAlertEmbed } from './src/agents/AlertAgent/embedBuilder';
import 'dotenv/config';

/**
 * NBA HEADSHOT URL ALTERNATIVES TEST
 *
 * PROBLEM: NBA headshots are blank in Discord (except Luka)
 * SOLUTION: Test different URL formats to find working alternatives
 */

async function testNbaUrlAlternatives() {
  console.log('🔄 NBA HEADSHOT URL ALTERNATIVES TEST');
  console.log('='.repeat(60));
  console.log('🎯 GOAL: Find NBA URL format that works consistently in Discord');
  console.log('='.repeat(60));

  let discordClient: Client | null = null;

  try {
    // Test Stephen Curry with different URL formats
    const stephenCurryId = '201939';

    const urlFormats = [
      {
        name: 'Current NBA CDN (1040x760)',
        url: `https://cdn.nba.com/headshots/nba/latest/1040x760/${stephenCurryId}.png`,
        note: 'Current format - fails in Discord',
      },
      {
        name: 'NBA CDN (260x190)',
        url: `https://cdn.nba.com/headshots/nba/latest/260x190/${stephenCurryId}.png`,
        note: 'Smaller size - may work better',
      },
      {
        name: 'NBA Media CDN (1040x760)',
        url: `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/1040x760/${stephenCurryId}.png`,
        note: 'Alternative NBA CDN',
      },
      {
        name: 'NBA Media CDN (260x190)',
        url: `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${stephenCurryId}.png`,
        note: 'Alternative NBA CDN - smaller',
      },
      {
        name: 'WNBA Format (260x190)',
        url: `https://ak-static.cms.nba.com/wp-content/uploads/headshots/wnba/latest/260x190/${stephenCurryId}.png`,
        note: 'WNBA format adapted for NBA',
      },
    ];

    // Initialize Discord client
    console.log('\n🔌 Initializing Discord client...');
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

    await discordClient.login(discordToken);
    await new Promise(resolve => {
      if (discordClient!.isReady()) {
        resolve(void 0);
      } else {
        discordClient!.once('ready', () => resolve(void 0));
      }
    });

    // Get target thread
    const griff843ThreadId = process.env.CAPPER_THREAD_GRIFF843;
    if (!griff843ThreadId) {
      throw new Error('Griff843 thread ID not configured');
    }

    const channel = await discordClient.channels.fetch(griff843ThreadId);
    if (!channel) {
      throw new Error(`Could not find channel/thread: ${griff843ThreadId}`);
    }

    console.log('\n📤 Testing NBA URL alternatives in Discord...');

    // Test each URL format
    for (let i = 0; i < urlFormats.length; i++) {
      const format = urlFormats[i];

      const testPick = {
        id: `nba-url-test-${i}-${Date.now()}`,
        player_name: 'Stephen Curry',
        player_id: stephenCurryId,
        capper: 'Griff843',
        sport: 'NBA',
        bet_type: 'player_props',
        ticket_type: 'single',
        tier: 'A+',
        outcome: 'Over 4.5 Three-Pointers Made',
        line: '4.5',
        odds: 120,
        unit_size: 3,
        confidence_score: 88,
        created_at: new Date().toISOString(),
      };

      const advice = `NBA URL TEST: ${format.note}`;

      // Build embed with custom headshot URL
      const embed = buildAlertEmbed(testPick, advice, format.url);

      const message = await (channel as any).send({
        content: `**🔄 URL TEST ${i + 1}: ${format.name}**\n*${format.note}*\nURL: \`${format.url}\``,
        embeds: [embed],
      });

      console.log(`✅ Test ${i + 1} posted: ${format.name}`);
      console.log(`   URL: ${format.url}`);
      console.log(`   Discord: ${message.url}`);

      if (i < urlFormats.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🔄 NBA URL ALTERNATIVES TEST COMPLETE');
    console.log('='.repeat(60));

    console.log('\n📋 CHECK DISCORD TO SEE:');
    console.log('  1. Which URL formats show Stephen Curry headshot');
    console.log('  2. Which formats show blank/no image');
    console.log('  3. Compare image quality and size');

    console.log('\n💡 NEXT STEPS:');
    console.log('  • Identify working URL format(s)');
    console.log('  • Update getPlayerHeadshotUrl() function');
    console.log('  • Test with other NBA players to confirm fix');
    console.log('  • Implement fallback URL system if needed');
  } catch (error) {
    console.error('💥 NBA URL alternatives test failed:', error);
  } finally {
    if (discordClient) {
      console.log('\n🧹 Cleaning up Discord client...');
      await discordClient.destroy();
      console.log('✅ Discord client cleaned up');
    }
  }
}

// Run the test
testNbaUrlAlternatives();
