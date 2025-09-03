import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits } from 'discord.js';
import { buildAlertEmbed } from './src/agents/AlertAgent/embedBuilder';
import { getPlayerHeadshotUrl } from './src/agents/AlertAgent/parlayEmbedBuilder';
import 'dotenv/config';

/**
 * NBA HEADSHOT DEBUG TEST
 *
 * ISSUE: NBA headshots are showing as blank/empty - need to debug why
 * Only Luka Doncic seems to work, others are blank
 */

async function debugNbaHeadshots() {
  console.log('🔍 NBA HEADSHOT DEBUG TEST');
  console.log('='.repeat(60));
  console.log('🚨 ISSUE: NBA headshots showing as blank (except Luka)');
  console.log('🎯 GOAL: Identify why NBA headshots are failing');
  console.log('='.repeat(60));

  let discordClient: Client | null = null;

  try {
    // Test popular NBA players with known IDs
    const nbaPlayers = [
      { name: 'Luka Doncic', id: '1629029', note: 'WORKS - User confirmed this shows' },
      { name: 'Stephen Curry', id: '201939', note: 'FAILING - Should be GSW superstar' },
      { name: 'LeBron James', id: '2544', note: 'FAILING - Should be Lakers legend' },
      { name: 'Jayson Tatum', id: '1628369', note: 'FAILING - Should be Celtics star' },
      { name: 'Giannis Antetokounmpo', id: '203507', note: 'FAILING - Should be Bucks MVP' },
      { name: 'Nikola Jokic', id: '203999', note: 'FAILING - Should be Nuggets center' },
      { name: 'Kevin Durant', id: '201142', note: 'FAILING - Should be Suns veteran' },
      { name: 'Anthony Davis', id: '203076', note: 'FAILING - Should be Lakers big man' },
    ];

    console.log('\n🔍 TESTING NBA HEADSHOT URLS:');

    // Test each player's headshot URL
    for (const player of nbaPlayers) {
      const headshotUrl = getPlayerHeadshotUrl('NBA', player.id, player.name);
      console.log(`\n${player.name} (${player.id}):`);
      console.log(`  URL: ${headshotUrl}`);
      console.log(`  Note: ${player.note}`);

      // Try accessing the URL directly
      try {
        const response = await fetch(headshotUrl || '');
        console.log(`  Status: ${response.status} ${response.statusText}`);
        console.log(`  Content-Type: ${response.headers.get('content-type')}`);
        console.log(`  Content-Length: ${response.headers.get('content-length')}`);
      } catch (error) {
        console.log(`  ❌ URL FETCH ERROR: ${error}`);
      }
    }

    // Test alternative NBA URL formats
    const testId = '201939'; // Stephen Curry
    const alternativeFormats = [
      `https://cdn.nba.com/headshots/nba/latest/1040x760/${testId}.png`,
      `https://cdn.nba.com/headshots/nba/latest/260x190/${testId}.png`,
      `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/1040x760/${testId}.png`,
      `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${testId}.png`,
      `https://a.espncdn.com/i/headshots/nba/players/full/${testId}.png`,
      `https://www.nba.com/.element/media/2.5/headshots/current/260x190/${testId}.png`,
    ];

    console.log('\n🔄 TESTING ALTERNATIVE NBA URL FORMATS (Stephen Curry):');
    for (let i = 0; i < alternativeFormats.length; i++) {
      const url = alternativeFormats[i];
      console.log(`\n${i + 1}. Testing: ${url}`);

      try {
        const response = await fetch(url);
        console.log(`   Status: ${response.status} ${response.statusText}`);
        if (response.ok) {
          console.log(`   ✅ WORKING FORMAT FOUND!`);
          console.log(`   Content-Type: ${response.headers.get('content-type')}`);
          console.log(`   Size: ${response.headers.get('content-length')} bytes`);
        }
      } catch (error) {
        console.log(`   ❌ FAILED: ${error}`);
      }
    }

    // Now test in Discord
    console.log('\n📤 TESTING IN DISCORD...');

    // Initialize Discord client
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

    // Test first 3 NBA players in Discord
    const testPlayers = nbaPlayers.slice(0, 3);

    for (let i = 0; i < testPlayers.length; i++) {
      const player = testPlayers[i];

      const testPick = {
        id: `nba-debug-${i}-${Date.now()}`,
        player_name: player.name,
        player_id: player.id,
        capper: 'Griff843',
        sport: 'NBA',
        bet_type: 'player_props',
        ticket_type: 'single',
        tier: 'A+',
        outcome: 'Over 25.5 Points',
        line: '25.5',
        odds: -110,
        unit_size: 3,
        confidence_score: 85,
        created_at: new Date().toISOString(),
      };

      const advice = `NBA HEADSHOT DEBUG: ${player.note}`;
      const embed = buildAlertEmbed(testPick, advice);

      const message = await (channel as any).send({
        content: `**🔍 NBA DEBUG: ${player.name.toUpperCase()}**\n*${player.note}*`,
        embeds: [embed],
      });

      console.log(`✅ ${player.name} debug posted: ${message.url}`);

      if (i < testPlayers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🔍 NBA HEADSHOT DEBUG COMPLETE');
    console.log('='.repeat(60));

    console.log('\n📋 CHECK DISCORD RESULTS:');
    console.log('  1. Compare which headshots show vs which are blank');
    console.log('  2. Note any pattern in working vs failing IDs');
    console.log('  3. Check if URL format needs to be changed');

    console.log('\n💡 POSSIBLE CAUSES:');
    console.log('  • Player IDs might be incorrect/outdated');
    console.log('  • NBA CDN URL format might have changed');
    console.log('  • Some players might not have headshots in the system');
    console.log('  • URL might need different format/parameters');
  } catch (error) {
    console.error('💥 NBA headshot debug failed:', error);
  } finally {
    if (discordClient) {
      console.log('\n🧹 Cleaning up Discord client...');
      await discordClient.destroy();
      console.log('✅ Discord client cleaned up');
    }
  }
}

// Run the debug test
debugNbaHeadshots();
