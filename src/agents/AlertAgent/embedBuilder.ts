import { EmbedBuilder } from 'discord.js';
import { FinalPick } from '../../db/types/final_picks';

interface AlertPriority {
  level: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  color: number;
  emoji: string;
}

function getAlertPriority(pick: FinalPick): AlertPriority {
  const confidence = pick.confidence || 50;
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
  if (odds > 0) return `+${odds}`;
  return odds.toString();
}

function calculateImpliedProbability(odds: number): string {
  let probability: number;
  
  if (odds > 0) {
    probability = 100 / (odds + 100);
  } else {
    probability = Math.abs(odds) / (Math.abs(odds) + 100);
  }
  
  return `${(probability * 100).toFixed(1)}%`;
}

function getConfidenceBar(confidence: number): string {
  const filled = Math.floor(confidence / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
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

export function buildAlertEmbed(pick: FinalPick, advice: string): EmbedBuilder {
  const priority = getAlertPriority(pick);
  const impliedProb = calculateImpliedProbability(pick.odds);
  const confidenceBar = getConfidenceBar(pick.confidence || 50);
  
  const embed = new EmbedBuilder()
    .setTitle(`${priority.emoji} ${pick.player_id} - ${pick.stat_type}`)
    .setColor(priority.color)
    .setTimestamp(new Date(pick.created_at));

  // Main pick details
  embed.addFields(
    { 
      name: '🎯 Line & Odds', 
      value: `**${pick.line}** @ **${formatOdds(pick.odds)}**\n*Implied: ${impliedProb}*`, 
      inline: true 
    },
    { 
      name: '⭐ Tier & Confidence', 
      value: `**${pick.tier}** Tier\n${confidenceBar} ${pick.confidence || 50}%`, 
      inline: true 
    },
    { 
      name: '🏆 League', 
      value: `${pick.sport}\n${pick.league}`, 
      inline: true 
    }
  );

  // Advice section
  embed.addFields({
    name: '🧠 Unit Talk Analysis',
    value: formatAdvice(advice),
    inline: false
  });

  // Additional context if available
  if (pick.analysis) {
    embed.addFields({
      name: '📊 Additional Context',
      value: pick.analysis.length > 200 ? 
        pick.analysis.substring(0, 200) + '...' : 
        pick.analysis,
      inline: false
    });
  }

  // Footer with metadata
  const footerText = [
    `ID: ${pick.id}`,
    pick.payout ? `Payout: ${pick.payout}x` : null,
    `Stake: ${pick.stake} units`
  ].filter(Boolean).join(' • ');

  embed.setFooter({ text: footerText });

  // Add priority indicator in description
  if (priority.level === 'URGENT') {
    embed.setDescription('🔥 **URGENT ALERT** - High-confidence S+ tier pick');
  } else if (priority.level === 'HIGH') {
    embed.setDescription('⚡ **HIGH PRIORITY** - Strong value opportunity');
  }

  return embed;
}

// Utility function for batch embed creation
export function buildBatchAlertEmbed(picks: FinalPick[], title: string = 'Daily Picks Summary'): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`📋 ${title}`)
    .setColor(0x0099FF)
    .setTimestamp();

  const pickSummaries = picks.slice(0, 10).map((pick) => {
    const priority = getAlertPriority(pick);
    return `${priority.emoji} **${pick.player_id}** ${pick.stat_type} ${pick.line} @ ${formatOdds(pick.odds)} (${pick.tier})`;
  }).join('\n');

  embed.setDescription(pickSummaries);

  if (picks.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${picks.length} picks` });
  }

  return embed;
}