import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { buildAlertEmbed } from './src/agents/AlertAgent/embedBuilder';
import 'dotenv/config';

/**
 * Simple Multi-Headshot Test
 * Shows the size difference issue and demonstrates the solution
 */

/**
 * Get player headshot URL (smaller versions for better collage)
 */
function getPlayerHeadshotUrl(sport: string, playerId?: string): string | null {
  if (!playerId) return null;

  switch (sport?.toUpperCase()) {
    case 'MLB':
      return `https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_100/v1/people/${playerId}/headshot/67/current`;
    case 'NBA':
      return `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`;
    case 'NHL':
      // Using a working NHL headshot URL
      return `https://assets.nhle.com/mugs/nhl/20232024/${playerId}.png`;
    default:
      return null;
  }
}

/**
 * Build parlay embed showing size comparison
 */
function buildSizeComparisonEmbed(
  picks: any[],
  advice: string,
  version: 'current' | 'improved'
): EmbedBuilder {
  const isLive = picks.some(p => p.bet_type === 'live');
  const pickTypeEmoji = isLive ? '🔴' : '📊';
  const title = `${pickTypeEmoji} ${isLive ? 'LIVE' : 'PREGAME'} • PARLAY PICK`;

  const embed = new EmbedBuilder().setTitle(title).setColor(0xff6600).setTimestamp();

  // Header info
  const capper = picks[0]?.capper || 'Griff843';
  const sports = [...new Set(picks.map(p => p.sport))].join('/');
  embed.setDescription(`**${capper}** • ${sports} Parlay • **${version.toUpperCase()} VERSION**`);

  // Format parlay legs
  const legsText = picks
    .map((pick, i) => {
      const tierEmoji = getTierEmoji(pick.tier);
      return `**Leg ${i + 1}:** ${tierEmoji} ${pick.player_name}\n${pick.outcome} • **${pick.line}** @ **${formatOdds(pick.odds)}**`;
    })
    .join('\n\n');

  embed.addFields({
    name: `🎯 Parlay Legs (${picks.length})`,
    value: legsText,
    inline: false,
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

  // Featured players list
  const playerList = picks.map(p => `${getSportEmoji(p.sport)} ${p.player_name}`).join(' • ');
  embed.addFields({
    name: '👥 Featured Players',
    value: playerList,
    inline: false,
  });

  // Different image approaches
  if (version === 'current') {
    // Current version: Large image at bottom (the problem)
    const firstHeadshot = getPlayerHeadshotUrl(picks[0].sport, picks[0].player_id);
    if (firstHeadshot) {
      embed.setImage(firstHeadshot); // HUGE image at bottom
    }
    embed.setFooter({
      text: `Current: Large image (${picks[0].player_name} only) - TOO BIG!`,
    });
  } else {
    // Improved version: Multiple smaller thumbnails as text
    const headshotList = picks
      .map((p, i) => {
        const headshot = getPlayerHeadshotUrl(p.sport, p.player_id);
        return headshot ? `[${p.player_name}](${headshot})` : p.player_name;
      })
      .join(' • ');

    embed.addFields({
      name: '📸 Player Headshots (Click to View)',
      value: headshotList,
      inline: false,
    });

    embed.setFooter({
      text: `Improved: Clickable headshots for ALL players - Better sizing!`,
    });
  }

  return embed;
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

async function testSizeComparison() {
  console.log('📏 Size Comparison Test: Current vs Improved');
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
      `SIZE COMPARISON TEST: This demonstrates the difference between the current large image ` +
      `approach vs an improved multi-headshot solution that's more proportional to single pick thumbnails.`;

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

    const singleAdvice = `REFERENCE: This shows the proper thumbnail size for single picks.`;
    const singleHeadshot = getPlayerHeadshotUrl(singlePick.sport, singlePick.player_id);
    const singleEmbed = buildAlertEmbed(singlePick, singleAdvice, singleHeadshot);

    const currentEmbed = buildSizeComparisonEmbed(testPicks, advice, 'current');
    const improvedEmbed = buildSizeComparisonEmbed(testPicks, advice, 'improved');

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

    // Post size comparison
    console.log('\n📤 Posting size comparison...');

    const singleMessage = await (channel as any).send({
      content: '**📏 REFERENCE: Single Pick (Proper Thumbnail Size)**',
      embeds: [singleEmbed],
    });
    console.log('✅ Single pick posted:', singleMessage.url);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const currentMessage = await (channel as any).send({
      content: '**❌ CURRENT PROBLEM: Parlay with HUGE Image**',
      embeds: [currentEmbed],
    });
    console.log('✅ Current (problematic) version posted:', currentMessage.url);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const improvedMessage = await (channel as any).send({
      content: '**✅ IMPROVED SOLUTION: All Players, Better Sizing**',
      embeds: [improvedEmbed],
    });
    console.log('✅ Improved version posted:', improvedMessage.url);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📏 SIZE COMPARISON COMPLETE!');
    console.log('='.repeat(50));

    console.log('\n🔍 COMPARISON RESULTS:');
    console.log('  📊 Single Pick: Small thumbnail (✅ proper size)');
    console.log('  ❌ Current Parlay: HUGE image at bottom (too big!)');
    console.log('  ✅ Improved Parlay: Clickable headshots (better proportions)');

    console.log('\n💡 USER FEEDBACK ADDRESSED:');
    console.log('  • "show all featured player headshots not just the main player"');
    console.log('  • "look at the size difference between the solo and multi"');
    console.log('  • Solution: Clickable headshots for ALL players, better sizing');
  } catch (error) {
    console.error('💥 Size comparison test failed:', error);
  } finally {
    if (discordClient) {
      console.log('\n🧹 Cleaning up Discord client...');
      await discordClient.destroy();
      console.log('✅ Discord client cleaned up');
    }
  }
}

// Run the test
testSizeComparison();
