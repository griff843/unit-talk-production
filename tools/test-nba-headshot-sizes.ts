import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits } from 'discord.js';
import { buildAlertEmbed } from './src/agents/AlertAgent/embedBuilder';
import 'dotenv/config';

/**
 * NBA HEADSHOT SIZE IMPROVEMENT TEST
 *
 * ISSUE: NBA headshots are too small (260x190)
 * GOAL: Find larger, higher quality NBA headshot URLs while maintaining quality
 */

async function testNbaHeadshotSizes() {
  console.log('🏀 NBA HEADSHOT SIZE IMPROVEMENT TEST');
  console.log('='.repeat(60));
  console.log('🔍 CURRENT: 260x190 (too small)');
  console.log('🎯 GOAL: Find larger, higher quality NBA headshots');
  console.log('='.repeat(60));

  let discordClient: Client | null = null;

  try {
    // Test different NBA headshot URL formats with Luka Doncic (known player)
    const lukaDoncicId = '1629029'; // Known working NBA player ID

    const nbaUrlFormats = [
      {
        name: 'Current (260x190)',
        url: `https://cdn.nba.com/headshots/nba/latest/260x190/${lukaDoncicId}.png`,
        note: 'Current format - reported as too small',
      },
      {
        name: 'Larger (1040x760)',
        url: `https://cdn.nba.com/headshots/nba/latest/1040x760/${lukaDoncicId}.png`,
        note: 'Testing 4x larger size',
      },
      {
        name: 'Medium (520x380)',
        url: `https://cdn.nba.com/headshots/nba/latest/520x380/${lukaDoncicId}.png`,
        note: 'Testing 2x larger size',
      },
      {
        name: 'NBA Media (High Quality)',
        url: `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/1040x760/${lukaDoncicId}.png`,
        note: 'NBA media CDN - highest quality',
      },
      {
        name: 'ESPN NBA Alternative',
        url: `https://a.espncdn.com/i/headshots/nba/players/full/${lukaDoncicId}.png`,
        note: 'ESPN format like NFL (no size constraint)',
      },
      {
        name: 'Basketball Reference Style',
        url: `https://d2cwpp38twqe55.cloudfront.net/req/202310181/images/players/${lukaDoncicId}.jpg`,
        note: 'Alternative sports database',
      },
    ];

    console.log('\n🔍 TESTING NBA HEADSHOT FORMATS:');
    nbaUrlFormats.forEach((format, index) => {
      console.log(`  ${index + 1}. ${format.name}`);
      console.log(`     URL: ${format.url}`);
      console.log(`     Note: ${format.note}`);
    });

    // Create test picks for each format
    const testPicks = nbaUrlFormats.map((format, index) => ({
      id: `nba-size-test-${index}-${Date.now()}`,
      player_name: 'Luka Doncic',
      player_id: lukaDoncicId,
      capper: 'Griff843',
      sport: 'NBA',
      bet_type: 'player_props',
      ticket_type: 'single',
      tier: 'A+',
      outcome: 'Over 9.5 Assists',
      line: '9.5',
      odds: -108,
      unit_size: 4,
      confidence_score: 85,
      created_at: new Date().toISOString(),
      testFormat: format.name,
      testUrl: format.url,
      testNote: format.note,
    }));

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

    // Post NBA headshot size tests
    console.log('\n📤 Posting NBA headshot size tests...');

    for (let i = 0; i < testPicks.length; i++) {
      const pick = testPicks[i];
      const advice = `NBA HEADSHOT SIZE TEST: ${pick.testNote}`;

      // Build embed with custom headshot URL for testing
      const embed = buildAlertEmbed(pick, advice, pick.testUrl);

      const message = await (channel as any).send({
        content: `**🏀 NBA SIZE TEST ${i + 1}: ${pick.testFormat}**\n*${pick.testNote}*`,
        embeds: [embed],
      });

      console.log(`✅ Test ${i + 1} posted: ${pick.testFormat}`);
      console.log(`   Format: ${pick.testNote}`);
      console.log(`   URL: ${message.url}`);

      // Wait between posts
      if (i < testPicks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Summary and analysis guide
    console.log('\n' + '='.repeat(60));
    console.log('🏀 NBA HEADSHOT SIZE TEST COMPLETE!');
    console.log('='.repeat(60));

    console.log('\n📋 WHAT TO ANALYZE:');
    console.log('  1. Compare image sizes - which looks best?');
    console.log('  2. Check image quality - crisp vs blurry?');
    console.log('  3. Verify all URLs work (no broken images)');
    console.log('  4. Compare with NFL/MLB headshot sizes for consistency');

    console.log('\n🎯 SELECTION CRITERIA:');
    console.log('  • Size: Should match NFL/MLB headshot scale');
    console.log('  • Quality: High resolution, crisp image');
    console.log('  • Reliability: URL should work consistently');
    console.log('  • Performance: Fast loading time');

    console.log('\n💡 EXPECTED BEST OPTIONS:');
    console.log('  1. 520x380 (2x current) - Good balance');
    console.log('  2. 1040x760 (4x current) - Highest quality');
    console.log('  3. ESPN format - Consistent with NFL');
  } catch (error) {
    console.error('💥 NBA headshot size test failed:', error);
  } finally {
    if (discordClient) {
      console.log('\n🧹 Cleaning up Discord client...');
      await discordClient.destroy();
      console.log('✅ Discord client cleaned up');
    }
  }
}

// Run the test
testNbaHeadshotSizes();
