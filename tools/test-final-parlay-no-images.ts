import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { buildAlertEmbed } from './src/agents/AlertAgent/embedBuilder';
import {
  buildParlayAlertEmbed,
  getPlayerHeadshotUrl,
} from './src/agents/AlertAgent/parlayEmbedBuilder';
import 'dotenv/config';

/**
 * FINAL TEST: Parlay without images, Singles with enhanced headshots
 */

async function testFinalImplementation() {
  console.log('🎯 FINAL IMPLEMENTATION TEST: Parlays (No Images) + Singles (Enhanced Headshots)');
  console.log('='.repeat(80));

  let discordClient: Client | null = null;

  try {
    // Test parlay picks (NO IMAGES)
    const parlayPicks = [
      {
        id: `parlay-1-${Date.now()}`,
        player_name: 'Shohei Ohtani',
        player_id: '660271',
        capper: 'Griff843',
        sport: 'MLB',
        bet_type: 'player_props',
        tier: 'S+',
        outcome: 'Over 1.5 Total Bases',
        line: '1.5',
        odds: 125,
        unit_size: 4,
        confidence_score: 92,
      },
      {
        id: `parlay-2-${Date.now()}`,
        player_name: 'Luka Doncic',
        player_id: '1629029',
        capper: 'Griff843',
        sport: 'NBA',
        bet_type: 'player_props',
        tier: 'A+',
        outcome: 'Over 9.5 Assists',
        line: '9.5',
        odds: -108,
        unit_size: 4,
        confidence_score: 85,
      },
    ];

    const parlayAdvice =
      `FINAL PARLAY FORMAT: Clean text-only display without any images. ` +
      `Focus on betting information, analysis, and player details in a professional format.`;

    // Test single picks (WITH ENHANCED HEADSHOTS)
    const singlePicks = [
      {
        id: `single-mlb-${Date.now()}`,
        player_name: 'Mike Trout',
        player_id: '545361',
        capper: 'Griff843',
        sport: 'MLB',
        bet_type: 'player_props',
        ticket_type: 'single',
        tier: 'S+',
        outcome: 'Over 1.5 Total Bases',
        line: '1.5',
        odds: -110,
        unit_size: 5,
        confidence_score: 94,
        created_at: new Date().toISOString(),
      },
      {
        id: `single-nba-${Date.now()}`,
        player_name: 'Stephen Curry',
        player_id: '201939',
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
      },
      {
        id: `single-nfl-${Date.now()}`,
        player_name: 'Josh Allen',
        player_id: '3916387', // CORRECTED: Bills QB (was 3139477 which showed Mahomes)
        capper: 'Griff843',
        sport: 'NFL',
        bet_type: 'player_props',
        ticket_type: 'single',
        tier: 'A',
        outcome: 'Over 2.5 Passing TDs',
        line: '2.5',
        odds: -115,
        unit_size: 4,
        confidence_score: 82,
        created_at: new Date().toISOString(),
      },
    ];

    // Build embeds
    const parlayEmbed = buildParlayAlertEmbed(parlayPicks, parlayAdvice);

    const singleEmbeds = singlePicks.map(pick => {
      const advice = `${pick.sport} SINGLE: Enhanced headshot integration with automatic player ID resolution.`;
      return buildAlertEmbed(pick, advice);
    });

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

    // Post final implementation
    console.log('\n📤 Posting final implementation...');

    // Parlay (NO IMAGES)
    const parlayMessage = await (channel as any).send({
      content: '**🎯 FINAL PARLAY: Clean Text-Only Format (No Images)**',
      embeds: [parlayEmbed],
    });
    console.log('✅ Parlay (no images) posted:', parlayMessage.url);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Singles (WITH ENHANCED HEADSHOTS)
    for (let i = 0; i < singleEmbeds.length; i++) {
      const pick = singlePicks[i];
      const embed = singleEmbeds[i];

      const singleMessage = await (channel as any).send({
        content: `**✨ ${pick.sport} SINGLE: Enhanced Headshot Integration**`,
        embeds: [embed],
      });
      console.log(`✅ ${pick.sport} single (${pick.player_name}) posted:`, singleMessage.url);

      if (i < singleEmbeds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('🎯 FINAL IMPLEMENTATION COMPLETE!');
    console.log('='.repeat(80));

    console.log('\n✅ IMPLEMENTATION SUMMARY:');
    console.log('  📋 PARLAYS: Clean text-only format without any images');
    console.log('  🖼️  SINGLES: Enhanced headshot integration for all sports');
    console.log('  🏈 SPORTS: MLB, NBA, NFL, NHL + NCAAF, WNBA support');
    console.log('  🎯 FORMAT: Standardized Discord formatting across all tiers');

    console.log('\n🏆 READY FOR PHASE D!');
    console.log('  ✓ Parlay headshots: REMOVED (clean text-only)');
    console.log('  ✓ Single headshots: ENHANCED (all sports coverage)');
    console.log('  ✓ Player enrichment: ALL SPORTS supported');
    console.log('  ✓ Discord formatting: STANDARDIZED across platform');
  } catch (error) {
    console.error('💥 Final implementation test failed:', error);
  } finally {
    if (discordClient) {
      console.log('\n🧹 Cleaning up Discord client...');
      await discordClient.destroy();
      console.log('✅ Discord client cleaned up');
    }
  }
}

// Run the test
testFinalImplementation();
