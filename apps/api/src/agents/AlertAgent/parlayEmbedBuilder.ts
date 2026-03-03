import { EmbedBuilder } from 'discord.js';

import { UnifiedPick } from '../../types/picks';

interface ParlayLeg extends UnifiedPick {
  headshot_url?: string;
}

/**
 * Get player headshot URL based on sport and player ID/name
 */
export function getPlayerHeadshotUrl(
  sport: string,
  playerId?: string,
  playerName?: string
): string | null {
  if (!playerId && !playerName) return null;

  // Enhanced URLs for better headshot coverage across all sports
  switch (sport?.toUpperCase()) {
    case 'MLB':
      // MLB uses player ID in the URL
      // Primary: MLB official headshots (high quality)
      // Fallback: ESPN headshots if MLB ID unavailable
      if (playerId) {
        return `https://img.mlbstatic.com/mlb-photos/image/upload/w_213,q_100/v1/people/${playerId}/headshot/67/current`;
      }
      return null;

    case 'NBA':
      // NBA uses player ID - updated to working Discord-compatible domain
      // FIXED: Discord has issues with cdn.nba.com, switched to ak-static.cms.nba.com
      // Primary: NBA Media CDN headshots (1040x760 for high quality + Discord compatibility)
      if (playerId) {
        return `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/1040x760/${playerId}.png`;
      }
      return null;

    case 'NFL':
      // NFL uses ESPN CDN with player ID
      // ESPN has comprehensive NFL player database
      // CRITICAL: Ensure correct player IDs (e.g., Josh Allen: 3916387, not 3139477 which is Mahomes)
      if (playerId) {
        return `https://a.espncdn.com/i/headshots/nfl/players/full/${playerId}.png`;
      }
      return null;

    case 'NHL':
      // NHL official headshots - updated URL format
      // Using NHL's official CDN for current season
      if (playerId) {
        return `https://assets.nhle.com/mugs/nhl/20232024/${playerId}.png`;
      }
      return null;

    case 'NCAAF':
      // College football - ESPN coverage
      if (playerId) {
        return `https://a.espncdn.com/i/headshots/college-football/players/full/${playerId}.png`;
      }
      return null;

    case 'WNBA':
      // WNBA official headshots
      if (playerId) {
        return `https://ak-static.cms.nba.com/wp-content/uploads/headshots/wnba/latest/260x190/${playerId}.png`;
      }
      return null;

    default:
      // Fallback for other sports - ESPN generic
      if (playerId) {
        const sportCode = sport?.toLowerCase() || 'sports';
        return `https://a.espncdn.com/i/headshots/${sportCode}/players/full/${playerId}.png`;
      }
      return null;
  }
}

/**
 * Format odds for display
 */
function formatOdds(odds: number): string {
  if (odds > 0) return `+${odds}`;
  return odds.toString();
}

/**
 * Calculate parlay odds from individual leg odds
 */
export function calculateParlayOdds(odds: number[]): number {
  // Convert American odds to decimal
  const decimalOdds = odds.map(o => {
    if (o > 0) {
      return o / 100 + 1;
    } else {
      return 100 / Math.abs(o) + 1;
    }
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

/**
 * Get the highest tier from a list of picks
 */
function getHighestTier(picks: ParlayLeg[]): string {
  const tiers = ['S+', 'S', 'A+', 'A', 'B+', 'B', 'C'];
  return picks.reduce((highest, pick) => {
    const currentIndex = tiers.indexOf(pick.tier);
    const highestIndex = tiers.indexOf(highest);
    return currentIndex < highestIndex ? pick.tier : highest;
  }, 'C');
}

/**
 * Get color based on tier
 */
function getTierColor(tier: string): number {
  if (['S+', 'S'].includes(tier)) return 0xff0000; // Red for top tier
  if (['A+', 'A'].includes(tier)) return 0x00ff99; // Green for A tier
  if (['B+', 'B'].includes(tier)) return 0x0099ff; // Blue for B tier
  return 0x808080; // Gray for lower tiers
}

/**
 * Build Discord embed for parlay picks
 *
 * @param picks - Array of picks in the parlay
 * @param advice - AI-generated advice for the parlay
 * @param options - Display options for the embed
 */
export function buildParlayAlertEmbed(
  picks: ParlayLeg[],
  advice: string,
  _options: {
    showHeadshots?: boolean;
    headshotStrategy?: 'first' | 'collage' | 'none';
  } = {}
): EmbedBuilder {
  // FINAL DECISION: Remove all images from parlays

  const isLive = picks.some(p => p.market_type === 'live');
  const pickTypeEmoji = isLive ? '🔴' : '📊';
  const title = `${pickTypeEmoji} ${isLive ? 'LIVE' : 'PREGAME'} • PARLAY PICK`;

  const highestTier = getHighestTier(picks);
  const color = getTierColor(highestTier);

  const embed = new EmbedBuilder().setTitle(title).setColor(color).setTimestamp();

  // REMOVED: No headshots for parlays per final decision
  // Parlays will use clean text-only format without any images

  // Header info
  const capper = picks[0]?.capper || 'Unknown';
  const sports = [...new Set(picks.map(p => (p as any).sport || 'Unknown'))].join('/');
  embed.setDescription(`**${capper}** • ${sports} Parlay`);

  // Format parlay legs
  const legsText = picks
    .map((pick, i) => {
      return `**Leg ${i + 1}:** ${pick.player_name || 'Unknown Player'}\n${pick.outcome || 'TBD'} • **${pick.line}** @ **${formatOdds(pick.odds || 0)}**`;
    })
    .join('\n\n');

  embed.addFields({
    name: `🎯 Parlay Legs (${picks.length})`,
    value: legsText || 'No legs available',
    inline: false,
  });

  // Calculate parlay details
  const totalOdds = calculateParlayOdds(picks.map(p => p.odds || 0));
  const totalUnits = Math.max(...picks.map(p => p.units || 1));
  const avgConfidence =
    picks.reduce((sum, p) => sum + ((p as any).confidence || 75), 0) / picks.length;

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
    value: advice || 'Analysis pending...',
    inline: false,
  });

  // Featured players list (text-only, no headshots)
  if (picks.length > 1) {
    const playerList = formatParlayPlayerList(picks);
    embed.addFields({
      name: '👥 Featured Players',
      value: playerList,
      inline: false,
    });
  }

  // Footer with branding
  embed.setFooter({
    text: 'Unit Talk Intelligence System • Fortune 100 Analytics',
  });

  return embed;
}

/**
 * Alternative strategy: Create a simple text-based player list with emojis
 * This could be used instead of or in addition to headshots for parlays
 */
export function formatParlayPlayerList(picks: ParlayLeg[]): string {
  return picks
    .map(pick => {
      const sportEmoji = getSportEmoji((pick as any).sport || 'Unknown');
      return `${sportEmoji} ${pick.player_name || 'Unknown Player'}`;
    })
    .join(' • ');
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
