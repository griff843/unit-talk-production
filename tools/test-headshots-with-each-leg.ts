import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { buildAlertEmbed } from './src/agents/AlertAgent/embedBuilder';
import 'dotenv/config';

/**
 * Headshots WITH Each Leg
 * Shows individual player headshots with their specific parlay leg
 */

/**
 * Get player headshot URL
 */
function getPlayerHeadshotUrl(sport: string, playerId?: string): string | null {
  if (!playerId) return null;

  switch (sport?.toUpperCase()) {
    case 'MLB':
      return `https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_100/v1/people/${playerId}/headshot/67/current`;
    case 'NBA':
      return `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`;
    case 'NHL':
      return `https://assets.nhle.com/mugs/nhl/20232024/${playerId}.png`;
    default:
      return null;
  }
}

/**
 * Build parlay embed with individual headshots for each leg
 */
function buildLegsWithHeadshotsEmbed(picks: any[], advice: string): EmbedBuilder {
  const isLive = picks.some(p => p.bet_type === 'live');
  const pickTypeEmoji = isLive ? '🔴' : '📊';
  const title = `${pickTypeEmoji} ${isLive ? 'LIVE' : 'PREGAME'} • PARLAY PICK`;

  const embed = new EmbedBuilder().setTitle(title).setColor(0xff6600).setTimestamp();

  // NO THUMBNAIL - clean look

  // Header info
  const capper = picks[0]?.capper || 'Griff843';
  const sports = [...new Set(picks.map(p => p.sport))].join('/');
  embed.setDescription(`**${capper}** • ${sports} Parlay`);

  // *** NEW APPROACH: Each leg with its own headshot ***
  picks.forEach((pick, i) => {
    const tierEmoji = getTierEmoji(pick.tier);
    const headshotUrl = getPlayerHeadshotUrl(pick.sport, pick.player_id);

    const legText = `${tierEmoji} **${pick.player_name}**\n${pick.outcome} • **${pick.line}** @ **${formatOdds(pick.odds)}**`;

    // Add each leg as its own field with inline headshot reference
    embed.addFields({
      name: `🎯 Leg ${i + 1} ${getSportEmoji(pick.sport)}`,
      value: headshotUrl
        ? `${legText}\n\n[👤 View ${pick.player_name}'s Headshot](${headshotUrl})`
        : legText,
      inline: i % 2 === 0, // Alternate inline for better layout
    });
  });

  // Calculate parlay details
  const totalOdds = calculateParlayOdds(picks.map(p => p.odds));
  const totalUnits = Math.max(...picks.map(p => p.unit_size));
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
      value: `**Avg Confidence:** ${avgConfidence.toFixed(0)}%\n**Highest Tier:** ${getHighestTier(picks)}`,
      inline: true,
    }
  );

  // AI Analysis
  embed.addFields({
    name: '🧠 AI Analysis',
    value: advice,
    inline: false,
  });

  // Featured players summary (without headshots since they're with each leg)
  const playerList = picks.map(p => `${getSportEmoji(p.sport)} ${p.player_name}`).join(' • ');
  embed.addFields({
    name: '👥 Featured Players',
    value: `${playerList}\n\n*Individual headshots linked with each leg above*`,
    inline: false,
  });

  embed.setFooter({
    text: `Unit Talk Intelligence • Individual Headshots with Each Leg`,
  });

  return embed;
}

/**
 * Alternative approach: Use actual image thumbnails for each leg (Discord limitation workaround)
 */
async function testIndividualHeadshotsApproach() {
  console.log('🎯 Individual Headshots with Each Leg Test');
  console.log('='.repeat(50));

  let discordClient: Client | null = null;

  try {
    // Test picks
    const testPicks = [
      {
        id: `test-1-${Date.now()}`,
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
        id: `test-2-${Date.now()}`,
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

    const advice =
      `FINAL APPROACH: Each parlay leg now shows the player's individual headshot. ` +
      `This creates a direct visual connection between each player and their specific bet. ` +
      `No combined images, no thumbnails - just clean individual headshots with each leg.`;

    // Single pick for reference
    const singlePick = {
      id: `single-${Date.now()}`,
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
      confidence: 94,
    };

    const singleAdvice = `REFERENCE: Single pick format (unchanged).`;
    const singleHeadshot = getPlayerHeadshotUrl(singlePick.sport, singlePick.player_id);
    const singleEmbed = buildAlertEmbed(singlePick, singleAdvice, singleHeadshot);

    const legsEmbed = buildLegsWithHeadshotsEmbed(testPicks, advice);

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

    // Post comparison
    console.log('\n📤 Posting individual headshots with each leg...');

    const singleMessage = await (channel as any).send({
      content: '**📊 REFERENCE: Single Pick Format**',
      embeds: [singleEmbed],
    });
    console.log('✅ Single pick posted:', singleMessage.url);

    await new Promise(resolve => setTimeout(resolve, 3000));

    const legsMessage = await (channel as any).send({
      content: '**🎯 FINAL APPROACH: Individual Headshots with Each Leg**',
      embeds: [legsEmbed],
    });
    console.log('✅ Legs with individual headshots posted:', legsMessage.url);

    // Also test the alternative: Send separate messages for each leg with its headshot
    console.log('\n📤 Alternative: Separate messages for each leg...');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send header message
    const headerMessage = await (channel as any).send({
      content: '**🔥 ALTERNATIVE: Each Leg as Separate Message with Headshot**',
    });
    console.log('✅ Header posted:', headerMessage.url);

    // Send each leg as a separate message with its headshot
    for (let i = 0; i < testPicks.length; i++) {
      const pick = testPicks[i];
      const tierEmoji = getTierEmoji(pick.tier);
      const headshotUrl = getPlayerHeadshotUrl(pick.sport, pick.player_id);

      const legEmbed = new EmbedBuilder()
        .setTitle(`🎯 Leg ${i + 1}: ${getSportEmoji(pick.sport)} ${pick.player_name}`)
        .setColor(0xff6600)
        .setDescription(
          `${tierEmoji} **${pick.outcome}** • **${pick.line}** @ **${formatOdds(pick.odds)}**`
        )
        .setTimestamp();

      if (headshotUrl) {
        legEmbed.setThumbnail(headshotUrl);
      }

      legEmbed.setFooter({
        text: `Parlay Leg ${i + 1} of ${testPicks.length} • Unit Talk Intelligence`,
      });

      const legMessage = await (channel as any).send({
        embeds: [legEmbed],
      });
      console.log(`✅ Leg ${i + 1} (${pick.player_name}) posted:`, legMessage.url);

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎯 INDIVIDUAL HEADSHOTS WITH LEGS COMPLETE!');
    console.log('='.repeat(50));

    console.log('\n✅ TESTED APPROACHES:');
    console.log('  📊 Approach 1: Single embed with clickable headshots per leg');
    console.log('  🔥 Approach 2: Separate message for each leg with individual headshot');

    console.log('\n🎯 BENEFITS:');
    console.log('  ✓ Each player headshot paired with their specific leg');
    console.log('  ✓ No combined/collage images');
    console.log('  ✓ Individual visual identification');
    console.log('  ✓ Clean, professional layout');
    console.log('  ✓ Direct player-to-bet connection');

    console.log('\n💡 RECOMMENDATION:');
    console.log('  Choose based on preference:');
    console.log('  • Single embed = More compact');
    console.log('  • Separate messages = Individual headshot thumbnails');
  } catch (error) {
    console.error('💥 Individual headshots test failed:', error);
  } finally {
    if (discordClient) {
      console.log('\n🧹 Cleaning up Discord client...');
      await discordClient.destroy();
      console.log('✅ Discord client cleaned up');
    }
  }
}

// Helper functions
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
  const decimalOdds = odds.map(o => {
    if (o > 0) return o / 100 + 1;
    else return 100 / Math.abs(o) + 1;
  });

  const totalDecimal = decimalOdds.reduce((acc, o) => acc * o, 1);

  if (totalDecimal >= 2) {
    return Math.round((totalDecimal - 1) * 100);
  } else {
    return Math.round(-100 / (totalDecimal - 1));
  }
}

function getHighestTier(picks: any[]): string {
  const tiers = ['S+', 'S', 'A+', 'A', 'B+', 'B', 'C'];
  return picks.reduce((highest, pick) => {
    const currentIndex = tiers.indexOf(pick.tier);
    const highestIndex = tiers.indexOf(highest);
    return currentIndex < highestIndex ? pick.tier : highest;
  }, 'C');
}

function getSportEmoji(sport: string): string {
  switch (sport?.toUpperCase()) {
    case 'MLB':
      return '⚾';
    case 'NBA':
      return '🏀';
    case 'NHL':
      return '🏒';
    default:
      return '🏆';
  }
}

// Run the test
testIndividualHeadshotsApproach();
