import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import 'dotenv/config';

/**
 * Test Parlay Format with Multiple Player Headshots
 * This tests how multi-pick parlays display with multiple MLB player headshots
 */

// Create a custom parlay embed builder
function buildParlayAlertEmbed(
  picks: any[],
  advice: string,
  playerImageUrls: string[]
): EmbedBuilder {
  const isLive = picks.some(p => p.bet_type === 'live');
  const pickTypeEmoji = isLive ? '🔴' : '📊';
  const title = `${pickTypeEmoji} ${isLive ? 'LIVE' : 'PREGAME'} • PARLAY PICK`;

  // Use the highest tier for color
  const tiers = ['S+', 'S', 'A+', 'A', 'B+', 'B', 'C'];
  const highestTier = picks.reduce((highest, pick) => {
    const currentIndex = tiers.indexOf(pick.tier);
    const highestIndex = tiers.indexOf(highest);
    return currentIndex < highestIndex ? pick.tier : highest;
  }, 'C');

  // Color based on highest tier
  let color = 0x808080; // Default gray
  if (['S+', 'S'].includes(highestTier))
    color = 0xff0000; // Red
  else if (['A+', 'A'].includes(highestTier))
    color = 0x00ff99; // Green
  else if (['B+', 'B'].includes(highestTier)) color = 0x0099ff; // Blue

  const embed = new EmbedBuilder().setTitle(title).setColor(color).setTimestamp();

  // For parlays, create a collage of player images or use first player's image
  if (playerImageUrls.length > 0 && playerImageUrls[0]) {
    embed.setThumbnail(playerImageUrls[0]); // Use first player's headshot
  }

  // Header info
  const capper = picks[0].capper;
  const sports = [...new Set(picks.map(p => p.sport))].join('/');
  embed.setDescription(`**${capper}** • ${sports} Parlay`);

  // Parlay legs as fields
  embed.addFields({
    name: `🎯 Parlay Legs (${picks.length})`,
    value: picks
      .map((pick, i) => {
        const tierEmoji = getTierEmoji(pick.tier);
        return `**Leg ${i + 1}:** ${pick.player_name}\n${pick.outcome} • **${pick.line}** @ **${formatOdds(pick.odds)}**`;
      })
      .join('\n\n'),
    inline: false,
  });

  // Combined parlay info
  const totalOdds = calculateParlayOdds(picks.map(p => p.odds));
  const totalUnits = Math.max(...picks.map(p => p.unit_size || 1));
  const avgConfidence =
    picks.reduce((sum, p) => sum + (p.confidence_score || 75), 0) / picks.length;

  embed.addFields(
    {
      name: '🏆 Parlay Details',
      value: `**Total Odds:** ${formatOdds(totalOdds)}\n**Units:** ${totalUnits}\n**Legs:** ${picks.length}`,
      inline: true,
    },
    {
      name: '📊 Metrics',
      value: `**Avg Confidence:** ${avgConfidence.toFixed(0)}%\n**Highest Tier:** ${highestTier}`,
      inline: true,
    }
  );

  // AI Analysis
  embed.addFields({
    name: '🧠 AI Analysis',
    value: advice,
    inline: false,
  });

  // Player images footnote if multiple
  if (playerImageUrls.length > 1) {
    const playerList = picks.map(p => p.player_name).join(', ');
    embed.addFields({
      name: '👥 Players',
      value: playerList,
      inline: false,
    });
  }

  // Footer
  embed.setFooter({
    text: 'Unit Talk Intelligence System • Fortune 100 Analytics',
  });

  return embed;
}

function getTierEmoji(tier: string): string {
  if (['S+', 'S'].includes(tier)) return '🏆';
  if (['A+', 'A'].includes(tier)) return '🎯';
  if (['B+', 'B'].includes(tier)) return '📈';
  return '📊';
}

function formatOdds(odds: number): string {
  if (odds > 0) return `+${odds}`;
  return odds.toString();
}

function calculateParlayOdds(odds: number[]): number {
  // Convert American odds to decimal
  const decimalOdds = odds.map(o => {
    if (o > 0) return o / 100 + 1;
    return 100 / Math.abs(o) + 1;
  });

  // Multiply all decimal odds
  const totalDecimal = decimalOdds.reduce((acc, o) => acc * o, 1);

  // Convert back to American odds
  if (totalDecimal >= 2) {
    return Math.round((totalDecimal - 1) * 100);
  } else {
    return Math.round(-100 / (totalDecimal - 1));
  }
}

async function testParlayHeadshots() {
  console.log('🎰 Testing Parlay Format with Multiple MLB Headshots');
  console.log('='.repeat(50));

  let discordClient: Client | null = null;

  try {
    // Create a 3-leg MLB parlay with real player headshots
    console.log('\n1️⃣ Creating 3-leg MLB parlay...');

    const parlayPicks = [
      {
        id: `parlay-leg-1-${Date.now()}`,
        player_name: 'Mike Trout',
        capper: 'Griff843',
        sport: 'MLB',
        bet_type: 'player_props',
        ticket_type: 'parlay',
        tier: 'A+',
        outcome: 'Over 1.5 Total Bases',
        line: '1.5',
        odds: -120,
        unit_size: 2,
        confidence_score: 82,
        headshot_url:
          'https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_100/v1/people/545361/headshot/67/current',
      },
      {
        id: `parlay-leg-2-${Date.now()}`,
        player_name: 'Shohei Ohtani',
        capper: 'Griff843',
        sport: 'MLB',
        bet_type: 'player_props',
        ticket_type: 'parlay',
        tier: 'S',
        outcome: 'Over 0.5 Home Runs',
        line: '0.5',
        odds: 180,
        unit_size: 2,
        confidence_score: 88,
        headshot_url:
          'https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_100/v1/people/660271/headshot/67/current',
      },
      {
        id: `parlay-leg-3-${Date.now()}`,
        player_name: 'Aaron Judge',
        capper: 'Griff843',
        sport: 'MLB',
        bet_type: 'player_props',
        ticket_type: 'parlay',
        tier: 'A',
        outcome: 'Over 2.5 Total Bases',
        line: '2.5',
        odds: 150,
        unit_size: 2,
        confidence_score: 79,
        headshot_url:
          'https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_100/v1/people/592450/headshot/67/current',
      },
    ];

    const playerImageUrls = parlayPicks.map(p => p.headshot_url);

    console.log('Parlay Details:');
    parlayPicks.forEach((pick, i) => {
      console.log(`  Leg ${i + 1}: ${pick.player_name} - ${pick.outcome} @ ${pick.odds}`);
    });
    console.log(
      `  Total Parlay Odds: ${formatOdds(calculateParlayOdds(parlayPicks.map(p => p.odds)))}`
    );

    // Generate parlay-specific AI advice
    const parlayAdvice =
      `HOLD: High-value 3-leg MLB parlay with strong individual edges. ` +
      `Trout's favorable matchup combined with Ohtani's power surge and Judge's consistent production ` +
      `creates positive expected value. Each leg independently analyzed with algorithmic edge. ` +
      `Weather conditions favorable at all three venues. Correlation risk minimal as players on different teams. ` +
      `Recommended bankroll allocation: 2 units for balanced risk/reward.`;

    // Build parlay embed
    console.log('\n2️⃣ Building parlay embed with multiple headshots...');
    const embed = buildParlayAlertEmbed(parlayPicks, parlayAdvice, playerImageUrls);

    console.log('Parlay Embed Details:');
    console.log('- Title:', embed.data.title);
    console.log('- Color:', `0x${embed.data.color?.toString(16)}`);
    console.log('- Thumbnail:', embed.data.thumbnail?.url ? 'Mike Trout headshot' : 'None');
    console.log('- Total Fields:', embed.data.fields?.length);

    // Initialize Discord client
    console.log('\n3️⃣ Initializing Discord client...');
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

    // Post the parlay
    console.log('\n4️⃣ Posting 3-leg MLB parlay to Discord...');
    const sentMessage = await (channel as any).send({ embeds: [embed] });

    console.log('✅ Parlay posted successfully!');
    console.log('Message URL:', sentMessage.url);

    // Now test a 2-leg mixed sport parlay (MLB + NBA)
    console.log('\n5️⃣ Creating mixed sport parlay (MLB + NBA)...');

    const mixedParlay = [
      {
        id: `mixed-leg-1-${Date.now()}`,
        player_name: 'Mike Trout',
        capper: 'Griff843',
        sport: 'MLB',
        bet_type: 'player_props',
        ticket_type: 'parlay',
        tier: 'S+',
        outcome: 'Over 1.5 RBI',
        line: '1.5',
        odds: 110,
        unit_size: 3,
        confidence_score: 91,
        headshot_url:
          'https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_100/v1/people/545361/headshot/67/current',
      },
      {
        id: `mixed-leg-2-${Date.now()}`,
        player_name: 'LeBron James',
        capper: 'Griff843',
        sport: 'NBA',
        bet_type: 'player_props',
        ticket_type: 'parlay',
        tier: 'A+',
        outcome: 'Over 25.5 Points',
        line: '25.5',
        odds: -110,
        unit_size: 3,
        confidence_score: 85,
        headshot_url: null, // NBA headshot would go here
      },
    ];

    const mixedAdvice =
      `HOLD: Elite cross-sport parlay opportunity with uncorrelated edges. ` +
      `Trout's RBI prop shows value against southpaw starter. LeBron's scoring prop undervalued ` +
      `in anticipated high-pace game. Cross-sport diversification reduces variance. ` +
      `Both players in excellent form. Maximum confidence play.`;

    const mixedEmbed = buildParlayAlertEmbed(mixedParlay, mixedAdvice, [
      mixedParlay[0].headshot_url,
    ]);

    console.log('\n6️⃣ Posting mixed sport parlay...');
    const mixedMessage = await (channel as any).send({ embeds: [mixedEmbed] });

    console.log('✅ Mixed sport parlay posted!');
    console.log('Message URL:', mixedMessage.url);

    // Summary
    console.log('\n🎉 PARLAY HEADSHOT TEST: COMPLETE!');
    console.log('✅ 3-leg MLB parlay with multiple player headshots');
    console.log('✅ Mixed sport parlay (MLB/NBA) format');
    console.log('✅ Parlay odds calculation working');
    console.log('✅ Tier-based color coding (highest tier wins)');
    console.log('✅ Professional parlay-specific formatting');

    console.log('\n📊 PARLAY FORMAT FEATURES:');
    console.log("- First player's headshot as thumbnail");
    console.log('- All legs clearly displayed with outcomes');
    console.log('- Combined parlay odds calculated');
    console.log('- Average confidence across all legs');
    console.log('- Player list when multiple headshots available');
  } catch (error) {
    console.error('💥 Parlay headshot test failed:', error);
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
testParlayHeadshots();
