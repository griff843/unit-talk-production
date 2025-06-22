import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { UserProfile, SportsPick, UserTier } from '../types';

// Color scheme for different tiers and statuses
export const COLORS = {
  // Tier colors
  member: '#95A5A6' as ColorResolvable,
  vip: '#F39C12' as ColorResolvable,
  vip_plus: '#9B59B6' as ColorResolvable,
  staff: '#E67E22' as ColorResolvable,
  admin: '#E74C3C' as ColorResolvable,
  owner: '#8E44AD' as ColorResolvable,
  free: '#95A5A6' as ColorResolvable, // Add free tier for backward compatibility

  // Status colors
  success: '#2ECC71' as ColorResolvable,
  error: '#E74C3C' as ColorResolvable,
  warning: '#F39C12' as ColorResolvable,
  info: '#3498DB' as ColorResolvable,

  // Pick colors
  win: '#2ECC71' as ColorResolvable,
  loss: '#E74C3C' as ColorResolvable,
  push: '#95A5A6' as ColorResolvable,
  pending: '#F39C12' as ColorResolvable
};

export function createPickEmbed(pick: SportsPick): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`${pick.sport} Pick`)
    .setDescription(pick.description || 'No description provided')
    .setColor(COLORS[pick.tier || 'member'] || COLORS.info)
    .addFields(
      { name: '🎯 Pick', value: pick.pick || pick.selection, inline: true },
      { name: '📊 Odds', value: pick.odds?.toString() || 'N/A', inline: true },
      { name: '💰 Units', value: pick.units?.toString() || 'N/A', inline: true },
      { name: '🔥 Confidence', value: `${pick.confidence || 0}/10`, inline: true },
      { name: '⚡ Teams', value: Array.isArray(pick.teams) ? pick.teams.join(' vs ') : (pick.game || 'N/A'), inline: true },
      { name: '🏆 League', value: pick.league || 'N/A', inline: true }
    )
    .setTimestamp(pick.submittedAt || pick.created_at)
    .setFooter({ text: `Submitted by ${pick.submittedBy || 'Unknown'}` });

  if (pick.reasoning) {
    embed.addFields({ name: '💭 Reasoning', value: pick.reasoning });
  }

  // Add status indicator
  if (pick.status && pick.status !== 'pending') {
    const statusEmoji = pick.status === 'won' ? '✅' : pick.status === 'lost' ? '❌' : '➖';
    embed.addFields({ name: '📈 Result', value: `${statusEmoji} ${pick.status.toUpperCase()}` });
  }

  return embed;
}

export function createUserStatsEmbed(user: UserProfile): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`📊 Stats for ${user.display_name || user.username}`)
    .setColor(COLORS[user.tier])
    .addFields(
      { name: '🎖️ Tier', value: formatTierName(user.tier), inline: true },
      { name: '💬 Messages', value: (user.total_messages || 0).toString(), inline: true },
      { name: '⭐ Reactions', value: (user.total_reactions || 0).toString(), inline: true },
      { name: '📈 Activity Score', value: Math.round(user.activity_score || 0).toString(), inline: true }
    )
    .setThumbnail(`https://cdn.discordapp.com/avatars/${user.discord_id}/avatar.png`)
    .setTimestamp();

  // Add last active if available
  if (user.last_active) {
    embed.addFields({
      name: '🕒 Last Active',
      value: `<t:${Math.floor(new Date(user.last_active).getTime() / 1000)}:R>`
    });
  }

  // Add join date
  if (user.created_at) {
    embed.addFields({
      name: '📅 Joined',
      value: `<t:${Math.floor(new Date(user.created_at).getTime() / 1000)}:D>`
    });
  }

  return embed;
}

export function createWelcomeEmbed(username: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🎉 Welcome to Unit Talk!')
    .setDescription(`Hey ${username}! Welcome to our sports betting community.`)
    .setColor(COLORS.success)
    .addFields(
      { 
        name: '🎯 What We Offer', 
        value: '• Expert sports picks\n• Community discussions\n• Betting analysis\n• Educational content' 
      },
      { 
        name: '📋 Getting Started', 
        value: '• Check out our channels\n• Read the rules\n• Introduce yourself\n• Start engaging!' 
      },
      { 
        name: '💎 VIP Benefits', 
        value: '• Premium picks\n• Advanced analytics\n• Priority support\n• Exclusive content' 
      }
    )
    .setFooter({ text: 'Use /help to see available commands' })
    .setTimestamp();
}

export function createErrorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setColor(COLORS.error)
    .setTimestamp();
}

export function createSuccessEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setColor(COLORS.success)
    .setTimestamp();
}

export function createWarningEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setColor(COLORS.warning)
    .setTimestamp();
}

export function createInfoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description)
    .setColor(COLORS.info)
    .setTimestamp();
}

export function createHelpEmbed(userTier: UserTier): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🤖 Bot Commands')
    .setDescription('Here are the available commands based on your tier:')
    .setColor(COLORS[userTier])
    .addFields(
      {
        name: '📊 General Commands',
        value: '`/help` - Show this help message\n`/ping` - Check bot latency\n`/stats` - View your stats'
      }
    );

  // Add tier-specific commands
  if (userTier === 'vip' || userTier === 'vip_plus') {
    embed.addFields({
      name: '💎 VIP Commands',
      value: '`/picks` - View premium picks\n`/analysis` - Get betting analysis'
    });
  }

  if (userTier === 'vip_plus') {
    embed.addFields({
      name: '👑 VIP+ Commands',
      value: '`/coaching` - Personal coaching insights\n`/advanced-stats` - Detailed analytics'
    });
  }

  return embed.setFooter({ text: `Your tier: ${formatTierName(userTier)}` });
}

export function createLeaderboardEmbed(users: UserProfile[], title: string = 'Leaderboard'): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${title}`)
    .setColor(COLORS.info)
    .setTimestamp();

  if (users.length === 0) {
    embed.setDescription('No users found.');
    return embed;
  }

  const leaderboardText = users
    .slice(0, 10) // Top 10
    .map((user, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const tierEmoji = getTierEmoji(user.tier);
      return `${medal} ${tierEmoji} **${user.display_name || user.username}** - ${Math.round(user.activity_score || 0)} pts`;
    })
    .join('\n');

  embed.setDescription(leaderboardText);
  return embed;
}

export function createSystemStatusEmbed(status: any): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🖥️ System Status')
    .setColor(status.healthy ? COLORS.success : COLORS.error)
    .addFields(
      { name: '🟢 Status', value: status.healthy ? 'Online' : 'Issues Detected', inline: true },
      { name: '⏱️ Uptime', value: formatUptime(status.uptime), inline: true },
      { name: '👥 Users', value: status.userCount?.toString() || 'N/A', inline: true },
      { name: '💾 Memory', value: formatMemoryUsage(status.memoryUsage), inline: true },
      { name: '📊 Events/Hour', value: status.eventsPerHour?.toString() || 'N/A', inline: true },
      { name: '⚠️ Errors', value: status.errorCount?.toString() || '0', inline: true }
    )
    .setTimestamp();

  if (status.lastError) {
    embed.addFields({ name: '🚨 Last Error', value: status.lastError });
  }

  return embed;
}

// Utility functions
export function formatTierName(tier: UserTier): string {
  switch (tier) {
    case 'member':
      return '👤 Member';
    case 'vip':
      return '💎 VIP';
    case 'vip_plus':
      return '👑 VIP+';
    default:
      return '❓ Unknown';
  }
}

export function getTierEmoji(tier: UserTier): string {
  switch (tier) {
    case 'member':
      return '👤';
    case 'vip':
      return '💎';
    case 'vip_plus':
      return '👑';
    default:
      return '❓';
  }
}

export function formatUptime(uptime: number): string {
  const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
  const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

export function formatMemoryUsage(memoryUsage: NodeJS.MemoryUsage): string {
  const used = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
  const total = Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100;
  return `${used}MB / ${total}MB`;
}

export function createPickGradingEmbed(grading: any): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('📊 Pick Analysis')
    .setDescription(grading.feedback)
    .setColor(getGradingColor(grading.tier))
    .addFields(
      { name: '🎯 Grade', value: grading.tier, inline: true },
      { name: '📈 Edge', value: `${grading.edge.toFixed(1)}%`, inline: true },
      { name: '🔥 Confidence', value: `${grading.confidence}/100`, inline: true },
      { name: '⚠️ Risk Level', value: grading.riskLevel.toUpperCase(), inline: true },
      { name: '💰 Expected Value', value: grading.expectedValue.toFixed(2), inline: true }
    )
    .setTimestamp();

  // Add factors breakdown
  if (grading.factors && grading.factors.length > 0) {
    const factorsText = grading.factors
      .slice(0, 5) // Top 5 factors
      .map((factor: any) => `**${factor.name}**: ${factor.score}/100`)
      .join('\n');
    
    embed.addFields({ name: '🔍 Key Factors', value: factorsText });
  }

  // Add recommendations
  if (grading.recommendations && grading.recommendations.length > 0) {
    const recommendationsText = grading.recommendations
      .slice(0, 3) // Top 3 recommendations
      .map((rec: string) => `• ${rec}`)
      .join('\n');
    
    embed.addFields({ name: '💡 Recommendations', value: recommendationsText });
  }

  return embed;
}

function getGradingColor(tier: string): ColorResolvable {
  switch (tier.toLowerCase()) {
    case 'elite':
      return '#9B59B6';
    case 'premium':
      return '#3498DB';
    case 'strong':
      return '#2ECC71';
    case 'good':
      return '#F39C12';
    case 'fair':
      return '#E67E22';
    case 'poor':
      return '#E74C3C';
    default:
      return COLORS.info;
  }
}