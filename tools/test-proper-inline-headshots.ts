import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { buildAlertEmbed } from './src/agents/AlertAgent/embedBuilder';
import 'dotenv/config';

/**
 * PROPER INLINE HEADSHOTS TEST
 * Uses direct URL embedding within each leg field for true inline display
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
 * Build parlay embed with PROPER inline headshots in each leg field
 * Uses direct URL embedding for true inline display
 */
function buildProperInlineHeadshotsEmbed(picks: any[], advice: string): EmbedBuilder {
  const isLive = picks.some(p => p.bet_type === 'live');
  const pickTypeEmoji = isLive ? '🔴' : '📊';
  const title = `${pickTypeEmoji} ${isLive ? 'LIVE' : 'PREGAME'} • PARLAY PICK`;

  const embed = new EmbedBuilder().setTitle(title).setColor(0xff6600).setTimestamp();

  // Header info
  const capper = picks[0]?.capper || 'Griff843';
  const sports = [...new Set(picks.map(p => p.sport))].join('/');
  embed.setDescription(`**${capper}** • ${sports} Parlay`);

  // *** PROPER APPROACH: Direct URL embedding in each leg field ***
  picks.forEach((pick, i) => {
    const tierEmoji = getTierEmoji(pick.tier);
    const headshotUrl = getPlayerHeadshotUrl(pick.sport, pick.player_id);

    // Build leg text with properly embedded headshot URL
    let legValue = `${tierEmoji} **${pick.player_name}**\n${pick.outcome} • **${pick.line}** @ **${formatOdds(pick.odds)}**`;

    if (headshotUrl) {
      // Add headshot directly in the field value using Discord's image embedding
      legValue += `\n\n${headshotUrl}`;
    }

    embed.addFields({
      name: `🎯 Leg ${i + 1} ${getSportEmoji(pick.sport)}`,
      value: legValue,
      inline: i % 2 === 0,
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

  // Featured players summary
  const playerList = picks.map(p => `${getSportEmoji(p.sport)} ${p.player_name}`).join(' • ');
  embed.addFields({
    name: '👥 Featured Players',
    value: `${playerList}\n\n*Headshots displayed inline with each leg above*`,
    inline: false,
  });

  embed.setFooter({
    text: `Unit Talk Intelligence • Direct URL Inline Headshots`,
  });

  return embed;
}

/**
 * Alternative approach: Use separate mini-embeds for each leg with individual thumbnails
 */
function buildSeparateLegEmbeds(picks: any[], advice: string): EmbedBuilder[] {
  const embeds: EmbedBuilder[] = [];

  // Main parlay header embed
  const isLive = picks.some(p => p.bet_type === 'live');
  const pickTypeEmoji = isLive ? '🔴' : '📊';
  const title = `${pickTypeEmoji} ${isLive ? 'LIVE' : 'PREGAME'} • PARLAY PICK`;

  const headerEmbed = new EmbedBuilder().setTitle(title).setColor(0xff6600).setTimestamp();

  const capper = picks[0]?.capper || 'Griff843';
  const sports = [...new Set(picks.map(p => p.sport))].join('/');
  headerEmbed.setDescription(`**${capper}** • ${sports} Parlay (${picks.length} legs)`);

  // Calculate parlay details
  const totalOdds = calculateParlayOdds(picks.map(p => p.odds));
  const totalUnits = Math.max(...picks.map(p => p.unit_size));

  headerEmbed.addFields({
    name: '🏆 Parlay Details',
    value: `**Total Odds:** ${formatOdds(totalOdds)}\n**Units:** ${totalUnits}\n**Legs:** ${picks.length}`,
    inline: false,
  });

  headerEmbed.addFields({
    name: '🧠 AI Analysis',
    value: advice,
    inline: false,
  });

  embeds.push(headerEmbed);

  // Individual leg embeds with thumbnails
  picks.forEach((pick, i) => {
    const tierEmoji = getTierEmoji(pick.tier);
    const headshotUrl = getPlayerHeadshotUrl(pick.sport, pick.player_id);

    const legEmbed = new EmbedBuilder()
      .setTitle(`🎯 Leg ${i + 1}: ${getSportEmoji(pick.sport)} ${pick.player_name}`)
      .setColor(0xff6600)
      .setDescription(
        `${tierEmoji} **${pick.outcome}**\n**Line:** ${pick.line}\n**Odds:** ${formatOdds(pick.odds)}\n**Units:** ${pick.unit_size}`
      );

    if (headshotUrl) {
      legEmbed.setThumbnail(headshotUrl);
    }

    legEmbed.setFooter({
      text: `Parlay Leg ${i + 1} of ${picks.length}`,
    });

    embeds.push(legEmbed);
  });

  return embeds;
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

async function testProperInlineHeadshots() {
  console.log('🎯 PROPER INLINE HEADSHOTS TEST');
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
      `CORRECTED APPROACH: Testing two methods for proper inline headshot display - ` +
      `direct URL embedding within fields, and separate mini-embeds for each leg with thumbnails.`;

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

    const directUrlEmbed = buildProperInlineHeadshotsEmbed(testPicks, advice);
    const separateEmbeds = buildSeparateLegEmbeds(testPicks, advice);

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

    // Post tests
    console.log('\n📤 Testing proper inline headshot placement...');

    const singleMessage = await (channel as any).send({
      content: '**📊 REFERENCE: Single Pick Format**',
      embeds: [singleEmbed],
    });
    console.log('✅ Single pick posted:', singleMessage.url);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test direct URL approach
    const directMessage = await (channel as any).send({
      content: '**🔗 TEST 1: Direct URL Embedding in Fields**',
      embeds: [directUrlEmbed],
    });
    console.log('✅ Direct URL embed posted:', directMessage.url);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test separate embeds approach
    const separateMessage = await (channel as any).send({
      content: '**📋 TEST 2: Separate Mini-Embeds for Each Leg**',
      embeds: separateEmbeds,
    });
    console.log('✅ Separate embeds posted:', separateMessage.url);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎯 PROPER INLINE HEADSHOTS TEST COMPLETE!');
    console.log('='.repeat(50));

    console.log('\n✅ TESTED APPROACHES:');
    console.log('  🔗 Direct URL embedding within embed fields');
    console.log('  📋 Separate mini-embeds for each leg with thumbnails');

    console.log('\n💡 ANALYSIS NEEDED:');
    console.log('  • Check which approach displays headshots correctly');
    console.log('  • Verify proper inline placement within leg fields');
    console.log('  • Ensure headshots appear with their specific leg data');
  } catch (error) {
    console.error('💥 Proper inline headshots test failed:', error);
  } finally {
    if (discordClient) {
      console.log('\n🧹 Cleaning up Discord client...');
      await discordClient.destroy();
      console.log('✅ Discord client cleaned up');
    }
  }
}

// Run the test
testProperInlineHeadshots();
