import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { buildAlertEmbed } from './src/agents/AlertAgent/embedBuilder';
import sharp from 'sharp';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

/**
 * Multi-Headshot Solution Test
 * Creates a collage of ALL player headshots for parlays (smaller, more proportional)
 */

/**
 * Enhanced player headshot URL
 */
function getPlayerHeadshotUrl(sport: string, playerId?: string): string | null {
  if (!playerId) return null;

  switch (sport?.toUpperCase()) {
    case 'MLB':
      return `https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_100/v1/people/${playerId}/headshot/67/current`;
    case 'NBA':
      return `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`;
    case 'NFL':
      return `https://a.espncdn.com/i/headshots/nfl/players/full/${playerId}.png`;
    case 'NHL':
      return `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${playerId}.jpg`;
    default:
      return null;
  }
}

/**
 * Create a horizontal collage of player headshots
 */
async function createHeadshotCollage(picks: any[], outputPath: string): Promise<string | null> {
  try {
    const headshots: Buffer[] = [];

    // Download all headshots
    for (const pick of picks) {
      const headshotUrl = getPlayerHeadshotUrl(pick.sport, pick.player_id);
      if (headshotUrl) {
        try {
          const response = await fetch(headshotUrl);
          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            headshots.push(buffer);
          }
        } catch (error) {
          console.log(`Failed to fetch headshot for ${pick.player_name}:`, error);
        }
      }
    }

    if (headshots.length === 0) {
      return null;
    }

    // Resize all headshots to consistent size (120x120)
    const resizedHeadshots = await Promise.all(
      headshots.map(buffer => sharp(buffer).resize(120, 120, { fit: 'cover' }).png().toBuffer())
    );

    // Create horizontal collage
    const totalWidth = resizedHeadshots.length * 120;
    const collageHeight = 120;

    // Create base canvas
    let collage = sharp({
      create: {
        width: totalWidth,
        height: collageHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });

    // Composite all headshots horizontally
    const composite = resizedHeadshots.map((buffer, index) => ({
      input: buffer,
      left: index * 120,
      top: 0,
    }));

    await collage.composite(composite).png().toFile(outputPath);

    return outputPath;
  } catch (error) {
    console.error('Failed to create headshot collage:', error);
    return null;
  }
}

/**
 * Upload image to a temporary hosting service (Discord CDN via webhook)
 */
async function uploadToDiscord(imagePath: string, discordClient: Client): Promise<string | null> {
  try {
    // For testing, we'll just return the local path
    // In production, you'd upload to a CDN or use Discord's attachment system
    return `file://${imagePath}`;
  } catch (error) {
    console.error('Failed to upload image:', error);
    return null;
  }
}

/**
 * Build parlay embed with multi-headshot collage
 */
function buildMultiHeadshotParlayEmbed(
  picks: any[],
  advice: string,
  collageUrl?: string
): EmbedBuilder {
  const isLive = picks.some(p => p.bet_type === 'live');
  const pickTypeEmoji = isLive ? '🔴' : '📊';
  const title = `${pickTypeEmoji} ${isLive ? 'LIVE' : 'PREGAME'} • PARLAY PICK`;

  const embed = new EmbedBuilder().setTitle(title).setColor(0xff6600).setTimestamp();

  // Header info
  const capper = picks[0]?.capper || 'Griff843';
  const sports = [...new Set(picks.map(p => p.sport))].join('/');
  embed.setDescription(`**${capper}** • ${sports} Parlay`);

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

  // Use collage as thumbnail (smaller, more proportional)
  if (collageUrl) {
    embed.setThumbnail(collageUrl); // Smaller thumbnail like single picks
  }

  embed.setFooter({
    text: `Unit Talk Intelligence System • ${picks.length} Player Headshots`,
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

async function testMultiHeadshotSolution() {
  console.log('🏆 Multi-Headshot Solution: ALL Players Visible');
  console.log('='.repeat(60));

  let discordClient: Client | null = null;

  try {
    // Test parlay with multiple real player headshots
    const multiHeadshotPicks = [
      {
        id: `multi-1-${Date.now()}`,
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
        id: `multi-2-${Date.now()}`,
        player_name: 'Connor McDavid',
        player_id: '8478402',
        capper: 'Griff843',
        sport: 'NHL',
        bet_type: 'player_props',
        tier: 'S',
        outcome: 'Over 0.5 Goals',
        line: '0.5',
        odds: 165,
        unit_size: 4,
        confidence_score: 88,
      },
      {
        id: `multi-3-${Date.now()}`,
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

    const multiAdvice =
      `ELITE HOLD: Triple-superstar cross-sport parlay. Ohtani vs struggling LHP (.340 career avg), ` +
      `McDavid on 9-game point streak with elite linemates, Luka facing pace-up matchup (12+ assists in similar games). ` +
      `Each leg independently profitable with 15%+ edge. Weather/ice conditions optimal.`;

    // Create headshot collage
    console.log('\n🖼️ Creating headshot collage for all players...');
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const collagePath = path.join(tempDir, `parlay-collage-${Date.now()}.png`);
    const collageCreated = await createHeadshotCollage(multiHeadshotPicks, collagePath);

    if (collageCreated) {
      console.log('✅ Headshot collage created:', collagePath);
    } else {
      console.log('⚠️ Failed to create collage - using fallback');
    }

    // Single pick for comparison
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

    const singleAdvice = `HOLD: Elite Trout spot vs LHP (.330 career avg). Perfect launch angle trending up.`;

    const singleHeadshot = getPlayerHeadshotUrl(singlePick.sport, singlePick.player_id);
    const singleEmbed = buildAlertEmbed(singlePick, singleAdvice, singleHeadshot);

    // Use first player's headshot as fallback if collage fails
    const fallbackUrl = getPlayerHeadshotUrl(
      multiHeadshotPicks[0].sport,
      multiHeadshotPicks[0].player_id
    );
    const multiEmbed = buildMultiHeadshotParlayEmbed(
      multiHeadshotPicks,
      multiAdvice,
      collageCreated || fallbackUrl
    );

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
    console.log('\n📤 Posting multi-headshot comparison...');

    const singleMessage = await (channel as any).send({
      content: '**📊 REFERENCE: Single Pick (Small Thumbnail)**',
      embeds: [singleEmbed],
    });
    console.log('✅ Single pick posted:', singleMessage.url);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // For collage, we need to send as attachment since it's a local file
    if (collageCreated && fs.existsSync(collagePath)) {
      const attachment = {
        attachment: collagePath,
        name: 'parlay-headshots.png',
      };

      // Update embed to use attachment
      multiEmbed.setThumbnail('attachment://parlay-headshots.png');

      const parlayMessage = await (channel as any).send({
        content: '**🏆 NEW: Multi-Headshot Parlay (ALL Players Visible)**',
        embeds: [multiEmbed],
        files: [attachment],
      });
      console.log('✅ Multi-headshot parlay posted:', parlayMessage.url);
    } else {
      const parlayMessage = await (channel as any).send({
        content: '**🏆 NEW: Multi-Headshot Parlay (Fallback)**',
        embeds: [multiEmbed],
      });
      console.log('✅ Fallback parlay posted:', parlayMessage.url);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🏆 MULTI-HEADSHOT SOLUTION COMPLETE!');
    console.log('='.repeat(60));

    console.log('\n✅ IMPLEMENTED SOLUTION:');
    console.log('  📊 Single Pick: Small thumbnail (reference size)');
    console.log('  🏆 Parlay: Horizontal collage of ALL player headshots');
    console.log('  📏 Sizing: Proportional to single pick thumbnail');
    console.log('  👥 Visibility: All featured players shown');

    console.log('\n🎯 BENEFITS:');
    console.log('  ✓ Shows ALL player headshots (not just first)');
    console.log('  ✓ Consistent sizing with single picks');
    console.log('  ✓ Clear visual identification of all players');
    console.log('  ✓ No huge dominating image');
    console.log('  ✓ Professional appearance');

    // Cleanup
    if (collageCreated && fs.existsSync(collagePath)) {
      try {
        fs.unlinkSync(collagePath);
        console.log('🧹 Temporary collage file cleaned up');
      } catch (e) {
        console.log('Note: Temp file cleanup failed');
      }
    }
  } catch (error) {
    console.error('💥 Multi-headshot test failed:', error);
  } finally {
    if (discordClient) {
      console.log('\n🧹 Cleaning up Discord client...');
      await discordClient.destroy();
      console.log('✅ Discord client cleaned up');
    }
  }
}

// Run the test
testMultiHeadshotSolution();
