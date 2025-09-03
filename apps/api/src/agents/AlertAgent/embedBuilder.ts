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
    return { level: 'URGENT', color: 0xFF0000, emoji: '🚨' };
  }
  
  // High: S tier or high confidence A+
  if (tier === 'S' || (tier === 'A+' && confidence >= 80)) {
    return { level: 'HIGH', color: 0xFF6600, emoji: '⚡' };
  }
  
  // Medium: A tier picks
  if (['A+', 'A'].includes(tier)) {
    return { level: 'MEDIUM', color: 0x00FF99, emoji: '📈' };
  }
  
  // Low: B and C tier
  return { level: 'LOW', color: 0x808080, emoji: '📊' };
}

function formatOdds(odds: number): string {
  if (odds > 0) {return `+${odds}`;}
  return odds.toString();
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

export function buildAlertEmbed(pick: UnifiedPick, advice: string, playerImageUrl?: string): EmbedBuilder {
  const priority = getAlertPriority(pick);
  const isLive = pick.market_type === 'live';
  const pickTypeEmoji = getPickTypeEmoji(pick.market_type || 'pregame', isLive);
  const systemGradeEmoji = getSystemGradeEmoji(pick.tier);
  
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

  // Header info: Capper • League
  const headerInfo = `**${pick.capper || 'System'}** • Unknown League`;
  embed.setDescription(headerInfo);

  // Main pick details - standardized format
  embed.addFields(
    { 
      name: '🎯 Selection', 
      value: `**${pick.player_name || 'Unknown Player'}**${pick.outcome ? `\n${pick.outcome}` : ''}`, 
      inline: false 
    },
    { 
      name: `${systemGradeEmoji} System Grade • 🎯 Units`, 
      value: `**${pick.tier}**-tier • **${pick.units || 1}** ${(pick.units || 1) === 1 ? 'unit' : 'units'}`, 
      inline: true 
    },
    { 
      name: '📈 Line & Odds', 
      value: `**${pick.line || 'N/A'}** @ **${formatOdds(pick.odds || 0)}**`, 
      inline: true 
    }
  );

  // AI Analysis section
  embed.addFields({
    name: '🧠 AI Analysis',
    value: formatAdvice(advice),
    inline: false
  });

  // Metrics section - simplified for all tiers
  const edgeScore = pick.edge_score || 0;
  
  embed.addFields({
    name: '📊 Metrics',
    value: `**Edge Score:** ${edgeScore > 0 ? edgeScore.toFixed(1) + '%' : 'N/A'}`,
    inline: false
  });

  // Footer with branding
  embed.setFooter({ 
    text: 'Unit Talk Intelligence System • Fortune 100 Analytics',
    iconURL: 'https://i.imgur.com/unit-talk-logo.png' // You can add logo URL here
  });

  return embed;
}

// Export parlay builder for external use
export { getPlayerHeadshotUrl } from './parlayEmbedBuilder';

// Utility function for batch embed creation
export function buildBatchAlertEmbed(picks: UnifiedPick[], title: string = 'Daily Picks Summary'): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`📋 ${title}`)
    .setColor(0x0099FF)
    .setTimestamp();

  const pickSummaries = picks.slice(0, 10).map((pick) => {
    const priority = getAlertPriority(pick);
    return `${priority.emoji} **${pick.player_name || 'Unknown'}** ${pick.market_type} ${pick.line} @ ${formatOdds(pick.odds)} (${pick.tier})`;
  }).join('\n');

  embed.setDescription(pickSummaries);

  if (picks.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${picks.length} picks` });
  }

  return embed;
}