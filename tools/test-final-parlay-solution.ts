import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits } from 'discord.js';
import { buildParlayAlertEmbed, getPlayerHeadshotUrl } from './src/agents/AlertAgent/embedBuilder';
import 'dotenv/config';

/**
 * Final Parlay Solution Test
 * Demonstrates the finalized approach for handling parlays with headshots
 */

async function testFinalParlaySolution() {
  console.log('🏆 Testing Final Parlay Solution with Headshots');
  console.log('='.repeat(50));

  let discordClient: Client | null = null;

  try {
    // Test 1: 3-leg MLB parlay with all real headshots
    console.log('\n📊 TEST 1: 3-Leg MLB Parlay (All Real Headshots)');
    console.log('-'.repeat(40));

    const mlbParlay = [
      {
        id: `mlb-1-${Date.now()}`,
        player_name: 'Mike Trout',
        player_id: '545361', // Real MLB player ID
        capper: 'Griff843',
        sport: 'MLB',
        bet_type: 'player_props',
        ticket_type: 'parlay',
        tier: 'S+',
        outcome: 'Over 1.5 Total Bases',
        line: '1.5',
        odds: -115,
        unit_size: 3,
        confidence_score: 88,
        created_at: new Date().toISOString(),
      },
      {
        id: `mlb-2-${Date.now()}`,
        player_name: 'Shohei Ohtani',
        player_id: '660271', // Real MLB player ID
        capper: 'Griff843',
        sport: 'MLB',
        bet_type: 'player_props',
        ticket_type: 'parlay',
        tier: 'A+',
        outcome: 'Over 0.5 Home Runs',
        line: '0.5',
        odds: 165,
        unit_size: 3,
        confidence_score: 82,
        created_at: new Date().toISOString(),
      },
      {
        id: `mlb-3-${Date.now()}`,
        player_name: 'Aaron Judge',
        player_id: '592450', // Real MLB player ID
        capper: 'Griff843',
        sport: 'MLB',
        bet_type: 'player_props',
        ticket_type: 'parlay',
        tier: 'A',
        outcome: 'Over 2.5 Total Bases',
        line: '2.5',
        odds: 140,
        unit_size: 3,
        confidence_score: 79,
        created_at: new Date().toISOString(),
      },
    ];

    // Add headshot URLs
    const mlbParlayWithHeadshots = mlbParlay.map(pick => ({
      ...pick,
      headshot_url: getPlayerHeadshotUrl(pick.sport, pick.player_id, pick.player_name),
    }));

    const mlbAdvice =
      `HOLD: Elite 3-leg MLB parlay targeting power hitters in favorable matchups. ` +
      `Each leg independently verified with positive EV. Trout facing LHP (.320 avg), ` +
      `Ohtani's launch angle trending up, Judge in hitter-friendly park. ` +
      `Uncorrelated outcomes maximize probability. Weather favorable at all venues.`;

    const mlbEmbed = buildParlayAlertEmbed(mlbParlayWithHeadshots, mlbAdvice, {
      showHeadshots: true,
      headshotStrategy: 'first', // Use first player's headshot
    });

    console.log('MLB Parlay created with first player headshot (Mike Trout)');

    // Test 2: Mixed sport parlay (MLB/NBA/NFL)
    console.log('\n🏀 TEST 2: Mixed Sport Parlay (MLB/NBA/NFL)');
    console.log('-'.repeat(40));

    const mixedParlay = [
      {
        id: `mixed-1-${Date.now()}`,
        player_name: 'Mike Trout',
        player_id: '545361',
        capper: 'Griff843',
        sport: 'MLB',
        bet_type: 'player_props',
        ticket_type: 'parlay',
        tier: 'A+',
        outcome: 'Over 1.5 RBI',
        line: '1.5',
        odds: 120,
        unit_size: 2,
        confidence_score: 83,
        created_at: new Date().toISOString(),
      },
      {
        id: `mixed-2-${Date.now()}`,
        player_name: 'LeBron James',
        player_id: '2544', // Real NBA player ID
        capper: 'Griff843',
        sport: 'NBA',
        bet_type: 'player_props',
        ticket_type: 'parlay',
        tier: 'S',
        outcome: 'Over 27.5 Points',
        line: '27.5',
        odds: -105,
        unit_size: 2,
        confidence_score: 86,
        created_at: new Date().toISOString(),
      },
      {
        id: `mixed-3-${Date.now()}`,
        player_name: 'Patrick Mahomes',
        player_id: '3139477', // Real NFL player ID
        capper: 'Griff843',
        sport: 'NFL',
        bet_type: 'player_props',
        ticket_type: 'parlay',
        tier: 'S+',
        outcome: 'Over 299.5 Passing Yards',
        line: '299.5',
        odds: -110,
        unit_size: 2,
        confidence_score: 90,
        created_at: new Date().toISOString(),
      },
    ];

    // Add headshot URLs
    const mixedParlayWithHeadshots = mixedParlay.map(pick => ({
      ...pick,
      headshot_url: getPlayerHeadshotUrl(pick.sport, pick.player_id, pick.player_name),
    }));

    const mixedAdvice =
      `HOLD: Premium cross-sport parlay with uncorrelated elite performers. ` +
      `Mahomes in primetime (78% over rate), LeBron vs bottom-5 defense, ` +
      `Trout batting cleanup with RISP opportunities. Diversification reduces variance. ` +
      `Each leg shows independent edge. Maximum confidence allocation.`;

    const mixedEmbed = buildParlayAlertEmbed(mixedParlayWithHeadshots, mixedAdvice, {
      showHeadshots: true,
      headshotStrategy: 'first', // Use Mike Trout's headshot
    });

    console.log('Mixed sport parlay created with first player headshot');

    // Test 3: Parlay without headshots option
    console.log('\n🚫 TEST 3: Parlay Without Headshots');
    console.log('-'.repeat(40));

    const noHeadshotEmbed = buildParlayAlertEmbed(mlbParlayWithHeadshots, mlbAdvice, {
      showHeadshots: false, // No headshot display
    });

    console.log('Parlay created without any headshot');

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

    // Post all three test parlays
    console.log('\n📤 Posting test parlays to Discord...');

    const message1 = await (channel as any).send({ embeds: [mlbEmbed] });
    console.log('✅ MLB parlay posted:', message1.url);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const message2 = await (channel as any).send({ embeds: [mixedEmbed] });
    console.log('✅ Mixed sport parlay posted:', message2.url);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const message3 = await (channel as any).send({ embeds: [noHeadshotEmbed] });
    console.log('✅ No-headshot parlay posted:', message3.url);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 FINAL PARLAY SOLUTION: COMPLETE!');
    console.log('='.repeat(50));

    console.log('\n✅ SOLUTION FEATURES:');
    console.log("1. First Player Headshot: Shows first player's headshot as thumbnail");
    console.log('2. Player List: All players listed in dedicated field');
    console.log('3. Sport Mixing: Handles multi-sport parlays gracefully');
    console.log('4. Flexible Options: Can disable headshots if needed');
    console.log('5. Professional Format: Clean, organized parlay display');

    console.log('\n🏆 HEADSHOT PATTERNS FOR ALL SPORTS:');
    console.log(
      '- MLB: https://img.mlbstatic.com/mlb-photos/image/upload/.../people/{playerId}/headshot/...'
    );
    console.log('- NBA: https://cdn.nba.com/headshots/nba/latest/1040x760/{playerId}.png');
    console.log('- NFL: https://a.espncdn.com/i/headshots/nfl/players/full/{playerId}.png');
    console.log(
      '- NHL: https://cms.nhl.bamgrid.com/images/headshots/current/168x168/{playerId}.jpg'
    );

    console.log('\n📋 RECOMMENDATION:');
    console.log('- Single Picks: Display player headshot as thumbnail');
    console.log("- Parlays: Use first player's headshot + list all players");
    console.log('- Alternative: Option to disable headshots for cleaner look');
    console.log('- Future: Could create headshot collages with image processing');
  } catch (error) {
    console.error('💥 Final parlay solution test failed:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
  } finally {
    if (discordClient) {
      console.log('\n🧹 Cleaning up Discord client...');
      await discordClient.destroy();
      console.log('✅ Discord client cleaned up');
    }
  }
}

// Run the test
testFinalParlaySolution();
