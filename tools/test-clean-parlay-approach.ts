import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { buildAlertEmbed } from './src/agents/AlertAgent/embedBuilder';
import 'dotenv/config';

/**
 * Clean Parlay Approach Test
 * Shows: Clean parlays with NO thumbnail, player info in Featured Players section
 */

/**
 * Enhanced player headshot URL with larger size
 */
function getLargerPlayerHeadshot(sport: string, playerId?: string): string | null {
  if (!playerId) return null;

  switch (sport?.toUpperCase()) {
    case 'MLB':
      return `https://img.mlbstatic.com/mlb-photos/image/upload/w_320,q_100/v1/people/${playerId}/headshot/67/current`;
    case 'NBA':
      return `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;
    case 'NFL':
      return `https://a.espncdn.com/i/headshots/nfl/players/full/${playerId}.png`;
    case 'NHL':
      return `https://cms.nhl.bamgrid.com/images/headshots/current/240x240/${playerId}.jpg`;
    default:
      return null;
  }
}

/**
 * Build clean parlay embed with NO thumbnail
 */
function buildCleanParlayEmbed(
  picks: any[],
  advice: string,
  isTeamPlay: boolean = false
): EmbedBuilder {
  const isLive = picks.some(p => p.bet_type === 'live');
  const pickTypeEmoji = isLive ? '🔴' : '📊';
  const title = `${pickTypeEmoji} ${isLive ? 'LIVE' : 'PREGAME'} • PARLAY PICK`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(0xff6600) // Unit Talk orange
    .setTimestamp();
  // NO THUMBNAIL - clean professional look

  // Header info
  const capper = picks[0]?.capper || 'Griff843';
  const sports = [...new Set(picks.map(p => p.sport))].join('/');
  embed.setDescription(`**${capper}** • ${sports} Parlay`);

  // Format parlay legs
  const legsText = picks
    .map((pick, i) => {
      const tierEmoji = getTierEmoji(pick.tier);
      if (isTeamPlay) {
        return `**Leg ${i + 1}:** ${tierEmoji} ${pick.matchup}\n${pick.outcome} • **${pick.line}** @ **${formatOdds(pick.odds)}**`;
      } else {
        return `**Leg ${i + 1}:** ${tierEmoji} ${pick.player_name}\n${pick.outcome} • **${pick.line}** @ **${formatOdds(pick.odds)}**`;
      }
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

  // Featured Players section with headshot links (bottom section)
  if (isTeamPlay) {
    // For team plays, show matchups
    const teamList = picks.map(p => `${getSportEmoji(p.sport)} ${p.matchup}`).join(' • ');
    embed.addFields({
      name: '🏟️ Featured Matchups',
      value: teamList,
      inline: false,
    });
  } else {
    // For player props, show players with headshot links
    const playerList = picks
      .map(p => {
        const headshot = getLargerPlayerHeadshot(p.sport, p.player_id);
        if (headshot) {
          return `${getSportEmoji(p.sport)} [${p.player_name}](${headshot})`;
        } else {
          return `${getSportEmoji(p.sport)} ${p.player_name}`;
        }
      })
      .join(' • ');

    embed.addFields({
      name: '👥 Featured Players (Click for Headshots)',
      value: playerList,
      inline: false,
    });
  }

  // Clean footer
  embed.setFooter({
    text: 'Unit Talk Intelligence System • Clean Parlay Format',
  });

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
    case 'NFL':
      return '🏈';
    case 'NHL':
      return '🏒';
    default:
      return '🏆';
  }
}

async function testCleanParlayApproach() {
  console.log('🧹 Testing Clean Parlay Approach');
  console.log('='.repeat(50));

  let discordClient: Client | null = null;

  try {
    // Test 1: Single pick with larger headshot (approved format)
    console.log('\n⚾ SINGLE PICK: With Larger Player Headshot');
    console.log('-'.repeat(40));

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
      odds: -105,
      unit_size: 4,
      confidence_score: 91,
      created_at: new Date().toISOString(),
      confidence: 91,
      expected_value: 0.12,
      edge_score: 10.8,
    };

    const singleAdvice =
      `HOLD: Elite Trout spot vs LHP (.325 career avg). Perfect weather (75°F, 8mph wind out). ` +
      `Line movement from -120 to -105 indicates sharp action. Expected value +12% with high confidence.`;

    const largerHeadshot = getLargerPlayerHeadshot(singlePick.sport, singlePick.player_id);
    const singleEmbed = buildAlertEmbed(singlePick, singleAdvice, largerHeadshot);

    // Test 2: Player prop parlay with NO thumbnail, clean featured players
    console.log('\n👥 PLAYER PROP PARLAY: Clean Format with Featured Players');
    console.log('-'.repeat(40));

    const playerParlayPicks = [
      {
        id: `parlay-1-${Date.now()}`,
        player_name: 'Shohei Ohtani',
        player_id: '660271',
        capper: 'Griff843',
        sport: 'MLB',
        bet_type: 'player_props',
        tier: 'S+',
        outcome: 'Over 1.5 RBI',
        line: '1.5',
        odds: 130,
        unit_size: 3,
        confidence_score: 88,
      },
      {
        id: `parlay-2-${Date.now()}`,
        player_name: 'Luka Doncic',
        player_id: '1629029',
        capper: 'Griff843',
        sport: 'NBA',
        bet_type: 'player_props',
        tier: 'S',
        outcome: 'Over 9.5 Assists',
        line: '9.5',
        odds: -110,
        unit_size: 3,
        confidence_score: 85,
      },
    ];

    const playerParlayAdvice =
      `HOLD: Cross-sport excellence parlay. Ohtani batting cleanup with RISP opportunities, ` +
      `Luka facing pace-up matchup (12+ assists in last 4 similar games). Independent positive edges.`;

    const playerParlayEmbed = buildCleanParlayEmbed(playerParlayPicks, playerParlayAdvice, false);

    // Test 3: Team play parlay with featured matchups
    console.log('\n🏟️ TEAM PLAY PARLAY: Clean Format with Featured Matchups');
    console.log('-'.repeat(40));

    const teamParlayPicks = [
      {
        id: `team-1-${Date.now()}`,
        matchup: 'Lakers vs Warriors',
        capper: 'Griff843',
        sport: 'NBA',
        bet_type: 'team_total',
        tier: 'A+',
        outcome: 'Lakers Over 112.5 Points',
        line: '112.5',
        odds: -108,
        unit_size: 2,
        confidence_score: 82,
      },
      {
        id: `team-2-${Date.now()}`,
        matchup: 'Yankees vs Red Sox',
        capper: 'Griff843',
        sport: 'MLB',
        bet_type: 'team_total',
        tier: 'A',
        outcome: 'Yankees Over 4.5 Runs',
        line: '4.5',
        odds: 115,
        unit_size: 2,
        confidence_score: 79,
      },
    ];

    const teamParlayAdvice =
      `HOLD: Elite rivalry parlay targeting high-scoring environments. Lakers averaging 118 at home, ` +
      `Yankees vs Red Sox totals 8-2 over in last 10 meetings. Weather and pace factors favorable.`;

    const teamParlayEmbed = buildCleanParlayEmbed(teamParlayPicks, teamParlayAdvice, true);

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

    // Post clean parlay examples
    console.log('\n📤 Posting clean parlay format examples...');

    const singleMessage = await (channel as any).send({
      content: '**✅ APPROVED: Single Pick Format (Larger Headshot)**',
      embeds: [singleEmbed],
    });
    console.log('✅ Single pick posted:', singleMessage.url);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const playerMessage = await (channel as any).send({
      content: '**🧹 NEW: Clean Player Parlay (No Thumbnail, Featured Players)**',
      embeds: [playerParlayEmbed],
    });
    console.log('✅ Player parlay posted:', playerMessage.url);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const teamMessage = await (channel as any).send({
      content: '**🏟️ NEW: Clean Team Parlay (Featured Matchups)**',
      embeds: [teamParlayEmbed],
    });
    console.log('✅ Team parlay posted:', teamMessage.url);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🧹 CLEAN PARLAY APPROACH COMPLETE!');
    console.log('='.repeat(50));

    console.log('\n✅ SINGLE PICKS:');
    console.log('- Larger player headshot as thumbnail');
    console.log('- Clear player identification');
    console.log('- Professional format (APPROVED)');

    console.log('\n🧹 PARLAYS - CLEAN APPROACH:');
    console.log('- NO thumbnail/icon (eliminates confusion)');
    console.log('- Professional clean appearance');
    console.log('- Player info in "Featured Players" with clickable headshots');
    console.log('- Team plays show "Featured Matchups" instead');
    console.log('- Clear visual distinction from single picks');

    console.log('\n🏆 BENEFITS:');
    console.log('- No confusing parlay icons');
    console.log('- No misleading player headshots');
    console.log('- Still shows player identification in proper context');
    console.log('- Works for both player props and team plays');
    console.log('- Clean, professional Unit Talk branding');
  } catch (error) {
    console.error('💥 Clean parlay test failed:', error);
  } finally {
    if (discordClient) {
      console.log('\n🧹 Cleaning up Discord client...');
      await discordClient.destroy();
      console.log('✅ Discord client cleaned up');
    }
  }
}

// Run the test
testCleanParlayApproach();
