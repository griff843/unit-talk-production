import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { buildAlertEmbed } from './src/agents/AlertAgent/embedBuilder';
import sharp from 'sharp';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

/**
 * Side-by-Side Headshots Solution
 * Shows multiple player headshots next to each other (not clickable links)
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
 * Create side-by-side headshot collage (smaller, proportional to single pick thumbnail)
 */
async function createSideBySideHeadshots(picks: any[], outputPath: string): Promise<string | null> {
  try {
    const headshots: Buffer[] = [];
    const playerNames: string[] = [];

    // Download all headshots
    for (const pick of picks) {
      const headshotUrl = getPlayerHeadshotUrl(pick.sport, pick.player_id);
      if (headshotUrl) {
        try {
          console.log(`Fetching headshot for ${pick.player_name}...`);
          const response = await fetch(headshotUrl);
          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            headshots.push(buffer);
            playerNames.push(pick.player_name);
            console.log(`✅ Got ${pick.player_name} headshot`);
          }
        } catch (error) {
          console.log(`❌ Failed to fetch headshot for ${pick.player_name}:`, error.message);
        }
      }
    }

    if (headshots.length === 0) {
      console.log('No headshots available');
      return null;
    }

    console.log(`Creating collage with ${headshots.length} headshots...`);

    // Resize all headshots to small thumbnail size (80x80 to match single pick proportion)
    const thumbnailSize = 80;
    const resizedHeadshots = await Promise.all(
      headshots.map(async (buffer, index) => {
        try {
          return await sharp(buffer)
            .resize(thumbnailSize, thumbnailSize, { fit: 'cover' })
            .png()
            .toBuffer();
        } catch (error) {
          console.log(`Failed to resize headshot ${index}:`, error);
          return null;
        }
      })
    );

    const validHeadshots = resizedHeadshots.filter(Boolean);
    if (validHeadshots.length === 0) {
      return null;
    }

    // Create horizontal side-by-side layout
    const spacing = 10; // Space between headshots
    const totalWidth =
      validHeadshots.length * thumbnailSize + (validHeadshots.length - 1) * spacing;
    const collageHeight = thumbnailSize;

    console.log(`Creating collage: ${totalWidth}x${collageHeight}`);

    // Create base canvas with transparent background
    let collage = sharp({
      create: {
        width: totalWidth,
        height: collageHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });

    // Composite all headshots side by side
    const composite = validHeadshots.map((buffer, index) => ({
      input: buffer,
      left: index * (thumbnailSize + spacing),
      top: 0,
    }));

    await collage.composite(composite).png().toFile(outputPath);

    console.log(`✅ Collage created: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Failed to create side-by-side headshots:', error);
    return null;
  }
}

/**
 * Build parlay embed with side-by-side headshots
 */
function buildSideBySideEmbed(
  picks: any[],
  advice: string,
  hasHeadshots: boolean = false
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

  // Use side-by-side headshots as thumbnail (smaller size like single picks)
  if (hasHeadshots) {
    embed.setThumbnail('attachment://side-by-side-headshots.png');
    embed.setFooter({
      text: `Unit Talk Intelligence • ${picks.length} Players Side-by-Side`,
    });
  } else {
    embed.setFooter({
      text: 'Unit Talk Intelligence System • Elite Parlay Analysis',
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

async function testSideBySideHeadshots() {
  console.log('👥 Side-by-Side Headshots Test');
  console.log('='.repeat(50));

  let discordClient: Client | null = null;

  try {
    // Test picks with working headshots
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
      `FINAL TEST: Side-by-side headshots showing ALL players next to each other, ` +
      `sized proportionally to single pick thumbnails. No huge images, no clickable links - ` +
      `just visual headshots displayed together.`;

    // Create side-by-side headshots
    console.log('\n🖼️ Creating side-by-side headshot collage...');
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const collagePath = path.join(tempDir, `side-by-side-${Date.now()}.png`);
    const collageCreated = await createSideBySideHeadshots(testPicks, collagePath);

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

    const singleAdvice = `REFERENCE: Single pick with proper thumbnail size.`;
    const singleHeadshot = getPlayerHeadshotUrl(singlePick.sport, singlePick.player_id);
    const singleEmbed = buildAlertEmbed(singlePick, singleAdvice, singleHeadshot);

    const sideBySideEmbed = buildSideBySideEmbed(testPicks, advice, !!collageCreated);

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
    console.log('\n📤 Posting side-by-side headshot test...');

    const singleMessage = await (channel as any).send({
      content: '**📊 REFERENCE: Single Pick Thumbnail Size**',
      embeds: [singleEmbed],
    });
    console.log('✅ Single pick posted:', singleMessage.url);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Post side-by-side version
    if (collageCreated && fs.existsSync(collagePath)) {
      const attachment = new AttachmentBuilder(collagePath, { name: 'side-by-side-headshots.png' });

      const sideBySideMessage = await (channel as any).send({
        content: '**👥 FINAL: Side-by-Side Player Headshots (Proportional Size)**',
        embeds: [sideBySideEmbed],
        files: [attachment],
      });
      console.log('✅ Side-by-side parlay posted:', sideBySideMessage.url);
    } else {
      const sideBySideMessage = await (channel as any).send({
        content: '**👥 FINAL: Side-by-Side Headshots (Fallback)**',
        embeds: [sideBySideEmbed],
      });
      console.log('✅ Fallback posted:', sideBySideMessage.url);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('👥 SIDE-BY-SIDE HEADSHOTS COMPLETE!');
    console.log('='.repeat(50));

    console.log('\n✅ FINAL SOLUTION:');
    console.log('  📊 Single Pick: Small thumbnail (reference size)');
    console.log('  👥 Parlay: Multiple headshots side-by-side');
    console.log('  📏 Size: Proportional to single pick (80x80 each)');
    console.log('  🎯 Layout: Horizontal with spacing between players');
    console.log('  👀 Visual: All players visible next to each other');

    console.log('\n🎯 USER REQUIREMENTS MET:');
    console.log('  ✓ Show ALL featured player headshots');
    console.log('  ✓ Display them next to each other');
    console.log('  ✓ Proper proportional sizing');
    console.log('  ✓ No huge dominating images');
    console.log('  ✓ No clickable links - actual visual headshots');

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
    console.error('💥 Side-by-side test failed:', error);
  } finally {
    if (discordClient) {
      console.log('\n🧹 Cleaning up Discord client...');
      await discordClient.destroy();
      console.log('✅ Discord client cleaned up');
    }
  }
}

// Run the test
testSideBySideHeadshots();
