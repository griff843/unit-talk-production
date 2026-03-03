import { EmbedBuilder } from 'discord.js';

import { UnifiedPick } from '../../types/picks';

import { getPlayerHeadshotUrl } from './parlayEmbedBuilder';

interface AlertPriority {
  level: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  color: number;
  emoji: string;
}

function getPickTypeEmoji(_marketType: string, isLive: boolean = false): string {
  if (isLive) return '🔴';
  return '📊';
}

function getSystemGradeEmoji(tier: string): string {
  // Remove diamond emojis, use new system grade emoji
  if (['S+', 'S'].includes(tier)) return '🏆';
  if (['A+', 'A'].includes(tier)) return '🎯';
  if (['B+', 'B'].includes(tier)) return '📈';
  return '📊';
}

function getAlertPriority(pick: UnifiedPick): AlertPriority {
  const confidence = typeof pick.confidence === 'number' ? pick.confidence : 50;
  const tier = pick.tier;

  // Urgent: S+ tier with high confidence
  if (tier === 'S+' && confidence >= 85) {
    return { level: 'URGENT', color: 0xff0000, emoji: '🚨' };
  }

  // High: S tier or high confidence A+
  if (tier === 'S' || (tier === 'A+' && confidence >= 80)) {
    return { level: 'HIGH', color: 0xff6600, emoji: '⚡' };
  }

  // Medium: A tier picks
  if (['A+', 'A'].includes(tier)) {
    return { level: 'MEDIUM', color: 0x00ff99, emoji: '📈' };
  }

  // Low: B and C tier
  return { level: 'LOW', color: 0x808080, emoji: '📊' };
}

function formatOdds(odds: number): string {
  if (odds > 0) {
    return `+${odds}`;
  }
  return odds.toString();
}

function getMatchupFromPick(pick: UnifiedPick): string | null {
  if (pick.matchup) return pick.matchup;
  const meta = (pick as any).meta || {};
  if (meta.matchup) return meta.matchup;
  if ((pick as any).manual_fields_blob?.matchup) return (pick as any).manual_fields_blob.matchup;
  return null;
}

function formatGameTime(pick: UnifiedPick): string | null {
  const gameTime =
    (pick as any).game_time || (pick as any).game_date || ((pick as any).meta as any)?.game_time;
  if (!gameTime) return null;

  try {
    const date = new Date(gameTime);
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    const time = date
      .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      .toLowerCase();
    return `(${month} ${day}, ${year}, ${time})`;
  } catch {
    return null;
  }
}

function getMarketTypeLabel(pick: UnifiedPick): string {
  const statType = String(pick.stat_type || '').toLowerCase();
  const marketType = String(pick.market_type || '').toLowerCase();

  if (statType.includes('points') || marketType.includes('total')) return 'Total Points';
  if (statType.includes('moneyline') || marketType.includes('ml')) return 'Money Line';
  if (statType.includes('spread') || marketType.includes('spread')) return 'Spread';
  if (statType) return statType.charAt(0).toUpperCase() + statType.slice(1).replace(/_/g, ' ');
  return 'Player Prop';
}

function formatAdvice(advice: string): string {
  // Extract recommendation and reasoning
  const match = advice.match(/^(HOLD|HEDGE|FADE):\s*(.+)$/i);
  if (match) {
    const [, recommendation, reasoning] = match;
    if (recommendation) {
      return `**${recommendation.toUpperCase()}**\n${reasoning || ''}`;
    }
  }
  return advice;
}

// eslint-disable-next-line max-lines-per-function, complexity
export function buildAlertEmbed(
  pick: UnifiedPick,
  advice: string,
  playerImageUrl?: string
): EmbedBuilder {
  const priority = getAlertPriority(pick);
  const isLive = pick.market_type === 'live';
  const pickTypeEmoji = getPickTypeEmoji(pick.market_type || 'pregame', isLive);
  const _systemGradeEmoji = getSystemGradeEmoji(pick.tier);

  // Standardized title format
  const pickType = 'SINGLE'; // Default since ticket_type is not in interface
  const title = `${pickTypeEmoji} ${isLive ? 'LIVE' : 'PREGAME'} • ${pickType} PICK`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(priority.color)
    .setTimestamp(new Date(pick.created_at));

  // Add player headshot - use provided URL or get from player enrichment
  let headshotUrl = playerImageUrl;
  if (!headshotUrl && pick.player_name) {
    headshotUrl = getPlayerHeadshotUrl('', '', pick.player_name) || undefined;
  }

  if (headshotUrl) {
    embed.setThumbnail(headshotUrl);
  }

  // Build context line: Sport • Matchup • (Date, Time)
  const sport = (pick as any).sport || (pick as any).league || 'Sports';
  const matchup = getMatchupFromPick(pick);
  const gameTime = formatGameTime(pick);
  const marketType = getMarketTypeLabel(pick);
  const contextParts = [sport];
  if (matchup) contextParts.push(matchup);
  if (gameTime) contextParts.push(gameTime);
  const contextLine = contextParts.join(' • ');

  // Header info: Capper
  const headerInfo = `**${pick.capper || 'System'}** • ${contextLine}`;
  embed.setDescription(headerInfo);

  // Main pick details - standardized format per PICK_PRESENTATION_STANDARD
  embed.addFields(
    {
      name: 'Selection',
      value: `**${pick.player_name || 'Unknown Player'}**${pick.outcome ? `\n${pick.outcome}` : ''}`,
      inline: false,
    },
    {
      name: 'Odds',
      value: `${formatOdds(pick.odds || 0)}`,
      inline: true,
    },
    {
      name: 'Market',
      value: marketType,
      inline: true,
    },
    {
      name: 'Units',
      value: `${pick.units || 1}U`,
      inline: true,
    },
    {
      name: 'Tier',
      value: `${pick.tier}-Tier`,
      inline: true,
    }
  );

  // AI Analysis section
  embed.addFields({
    name: '🧠 AI Analysis',
    value: formatAdvice(advice),
    inline: false,
  });

  // Metrics section - simplified for all tiers
  const edgeScore = pick.edge_score || 0;

  embed.addFields({
    name: '📊 Metrics',
    value: `**Edge Score:** ${edgeScore > 0 ? edgeScore.toFixed(1) + '%' : 'N/A'}`,
    inline: false,
  });

  // Footer with branding
  embed.setFooter({
    text: 'Unit Talk',
  });

  return embed;
}

// Export parlay builder for external use
export { getPlayerHeadshotUrl } from './parlayEmbedBuilder';

// Utility function for batch embed creation
export function buildBatchAlertEmbed(
  picks: UnifiedPick[],
  title: string = 'Daily Picks Summary'
): EmbedBuilder {
  const embed = new EmbedBuilder().setTitle(`📋 ${title}`).setColor(0x0099ff).setTimestamp();

  const pickSummaries = picks
    .slice(0, 10)
    .map(pick => {
      const priority = getAlertPriority(pick);
      return `${priority.emoji} **${pick.player_name || 'Unknown'}** ${pick.market_type} ${pick.line} @ ${formatOdds(pick.odds)} (${pick.tier})`;
    })
    .join('\n');

  embed.setDescription(pickSummaries);

  if (picks.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${picks.length} picks` });
  }

  return embed;
}
