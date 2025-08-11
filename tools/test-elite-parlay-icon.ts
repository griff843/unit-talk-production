import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import 'dotenv/config';

/**
 * Test Elite Parlay Icon Design
 * Demonstrates professional parlay icon approach for Unit Talk
 */

// Elite Parlay Icon URLs (hosted examples)
const PARLAY_ICON_OPTIONS = {
  // Option 1: Connected nodes/network style
  connected_nodes: 'https://cdn-icons-png.flaticon.com/512/3524/3524336.png',

  // Option 2: Multi-layered diamond/gem style
  diamond_stack: 'https://cdn-icons-png.flaticon.com/512/2995/2995467.png',

  // Option 3: Interconnected circles
  network_circles: 'https://cdn-icons-png.flaticon.com/512/1087/1087815.png',

  // Option 4: Layered cards/betting style
  stacked_cards: 'https://cdn-icons-png.flaticon.com/512/4320/4320350.png',

  // Option 5: Unit Talk custom (we'll create this)
  unit_talk_custom: 'https://i.imgur.com/unit-talk-parlay.png',
};

/**
 * Create elite parlay embed with custom icon
 */
function createEliteParlayEmbed(
  picks: any[],
  advice: string,
  iconUrl: string,
  iconName: string
): EmbedBuilder {
  const isLive = picks.some(p => p.bet_type === 'live');
  const pickTypeEmoji = isLive ? '🔴' : '📊';
  const title = `${pickTypeEmoji} ${isLive ? 'LIVE' : 'PREGAME'} • PARLAY PICK`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(0xff6600) // Elite orange color
    .setTimestamp()
    .setThumbnail(iconUrl); // Use parlay icon instead of player headshot

  // Header info
  const capper = picks[0]?.capper || 'Griff843';
  const sports = [...new Set(picks.map(p => p.sport))].join('/');
  embed.setDescription(`**${capper}** • ${sports} Parlay • **Icon: ${iconName}**`);

  // Format parlay legs with enhanced styling
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

  // Calculate parlay odds
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
      value: `**Avg Confidence:** ${avgConfidence.toFixed(0)}%\n**Risk Level:** Elite`,
      inline: true,
    }
  );

  // AI Analysis
  embed.addFields({
    name: '🧠 AI Analysis',
    value: advice,
    inline: false,
  });

  // Player list for multi-pick identification
  const playerList = picks.map(p => `${getSportEmoji(p.sport)} ${p.player_name}`).join(' • ');
  embed.addFields({
    name: '👥 Featured Players',
    value: playerList,
    inline: false,
  });

  // Elite footer
  embed.setFooter({
    text: 'Unit Talk Intelligence System • Elite Parlay Analysis',
    iconURL: iconUrl,
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

async function testEliteParlayIcons() {
  console.log('🏆 Testing Elite Parlay Icon Designs');
  console.log('='.repeat(50));

  let discordClient: Client | null = null;

  try {
    // Sample elite 3-leg parlay
    const eliteParlayPicks = [
      {
        id: `elite-1-${Date.now()}`,
        player_name: 'Shohei Ohtani',
        capper: 'Griff843',
        sport: 'MLB',
        bet_type: 'player_props',
        tier: 'S+',
        outcome: 'Over 1.5 Total Bases + RBI',
        line: '1.5',
        odds: 140,
        unit_size: 5,
        confidence_score: 92,
      },
      {
        id: `elite-2-${Date.now()}`,
        player_name: 'Connor McDavid',
        capper: 'Griff843',
        sport: 'NHL',
        bet_type: 'player_props',
        tier: 'S',
        outcome: 'Over 0.5 Goals',
        line: '0.5',
        odds: 165,
        unit_size: 5,
        confidence_score: 89,
      },
      {
        id: `elite-3-${Date.now()}`,
        player_name: 'Nikola Jokic',
        capper: 'Griff843',
        sport: 'NBA',
        bet_type: 'player_props',
        tier: 'A+',
        outcome: 'Over 11.5 Assists',
        line: '11.5',
        odds: -105,
        unit_size: 5,
        confidence_score: 85,
      },
    ];

    const eliteAdvice =
      `ELITE HOLD: Premium cross-sport parlay featuring three dominant players in elite matchups. ` +
      `Ohtani vs struggling LHP (.340 avg), McDavid on 8-game point streak, Jokic leads league in triple-doubles. ` +
      `Each leg independently profitable with 15%+ edge. Uncorrelated outcomes maximize probability. ` +
      `Weather/ice conditions optimal. Maximum confidence allocation for elite bankroll management.`;

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

    console.log('\n📤 Testing Elite Parlay Icon Options...\n');

    // Test each icon option
    for (const [iconName, iconUrl] of Object.entries(PARLAY_ICON_OPTIONS)) {
      if (iconName === 'unit_talk_custom') continue; // Skip custom for now

      console.log(`🎨 Testing ${iconName.replace('_', ' ').toUpperCase()} icon...`);

      const embed = createEliteParlayEmbed(
        eliteParlayPicks,
        eliteAdvice,
        iconUrl,
        iconName.replace('_', ' ').toUpperCase()
      );

      const message = await (channel as any).send({ embeds: [embed] });
      console.log(`✅ Posted: ${message.url}`);

      // Wait between posts
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 ELITE PARLAY ICON TEST COMPLETE!');
    console.log('='.repeat(50));

    console.log('\n✅ TESTED ICON STYLES:');
    console.log('1. Connected Nodes: Network/graph style connections');
    console.log('2. Diamond Stack: Layered premium gems');
    console.log('3. Network Circles: Interconnected betting nodes');
    console.log('4. Stacked Cards: Premium card game aesthetic');

    console.log('\n🏆 DESIGN PRINCIPLES FOR ELITE ICON:');
    console.log('- Premium/luxury aesthetic matching Unit Talk brand');
    console.log('- Clear visual distinction from single pick headshots');
    console.log('- Scalable at small thumbnail sizes (64x64px)');
    console.log('- Professional betting/analytics theme');
    console.log('- Consistent with Fortune 100 quality standards');

    console.log('\n📋 NEXT STEPS:');
    console.log('1. Review posted examples and select preferred style');
    console.log('2. Commission custom Unit Talk parlay icon in chosen style');
    console.log('3. Implement larger player headshots for single picks');
    console.log('4. Deploy final embed formatting');
  } catch (error) {
    console.error('💥 Elite parlay icon test failed:', error);
  } finally {
    if (discordClient) {
      console.log('\n🧹 Cleaning up Discord client...');
      await discordClient.destroy();
      console.log('✅ Discord client cleaned up');
    }
  }
}

// Run the test
testEliteParlayIcons();
