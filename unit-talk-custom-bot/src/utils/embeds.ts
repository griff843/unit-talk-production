import { EmbedBuilder, ColorResolvable, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { UserProfile, UserTier } from '../types/index';

export const COLORS = {
  primary: '#3498db' as const,
  success: '#2ecc71' as const,
  warning: '#f39c12' as const,
  error: '#e74c3c' as const,
  info: '#9b59b6' as const,
  member: '#95a5a6' as const,
  trial: '#17a2b8' as const,
  vip: '#f1c40f' as const,
  vip_plus: '#e67e22' as const,
  capper: '#E67E22' as const,
  staff: '#9b59b6' as const,
  admin: '#e74c3c' as const,
  owner: '#2c3e50' as const
};

export function getTierColor(tier: UserTier): ColorResolvable {
  return COLORS[tier] || COLORS.member;
}

export function getTierDisplayName(tier: UserTier): string {
  switch (tier) {
    case 'member': return 'Member';
    case 'trial': return 'Trial';
    case 'vip': return 'VIP';
    case 'vip_plus': return 'VIP+';
    case 'capper': return 'Capper';
    case 'staff': return 'Staff';
    case 'admin': return 'Admin';
    case 'owner': return 'Owner';
    default: return 'Member';
  }
}

export function getTierEmoji(tier: UserTier): string {
  switch (tier) {
    case 'member': return '👤';
    case 'trial': return '🆓';
    case 'vip': return '⭐';
    case 'vip_plus': return '🌟';
    case 'capper': return '🎯';
    case 'staff': return '🛡️';
    case 'admin': return '👑';
    case 'owner': return '💎';
    default: return '👤';
  }
}

/**
 * Create a basic info embed
 */
export function createInfoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(COLORS.info)
    .setTimestamp();
}

/**
 * Create a success embed
 */
export function createSuccessEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(COLORS.success)
    .setTimestamp();
}

/**
 * Create an error embed
 */
export function createErrorEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(COLORS.error)
    .setTimestamp();
}

/**
 * Create user profile embed
 */
export function createUserProfileEmbed(profile: UserProfile): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`${getTierEmoji(profile.tier)} ${profile.username || 'User Profile'}`)
    .setColor(getTierColor(profile.tier))
    .setThumbnail(profile.avatar_url || null)
    .addFields(
      {
        name: '📊 Account Info',
        value: [
          `**Tier:** ${getTierDisplayName(profile.tier)}`,
          `**Member Since:** <t:${Math.floor(new Date(profile.created_at || Date.now()).getTime() / 1000)}:R>`,
          `**Last Active:** <t:${Math.floor(new Date(profile.last_active || profile.created_at || Date.now()).getTime() / 1000)}:R>`
        ].join('\n'),
        inline: true
      }
    );

  // Add trial info if applicable
  if (profile.trial_ends_at) {
    const trialEnd = new Date(profile.trial_ends_at);
    const now = new Date();
    const hoursLeft = Math.max(0, Math.floor((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60)));

    embed.addFields({
      name: '⏰ Trial Status',
      value: `**Time Remaining:** ${hoursLeft} hours\n**Expires:** <t:${Math.floor(trialEnd.getTime() / 1000)}:R>`,
      inline: true
    });
  }

  return embed.setTimestamp();
}

/**
 * Create help embed based on user tier
 */
export function createHelpEmbed(userTier: UserTier): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🆘 Unit Talk Commands')
    .setColor(getTierColor(userTier))
    .setDescription('Here are the available commands based on your access level:')
    .addFields(
      {
        name: '📊 General Commands',
        value: [
          '`/help` - Show this help message',
          '`/profile` - View your profile',
          '`/stats` - View your betting statistics',
          '`/leaderboard` - View community leaderboard'
        ].join('\n'),
        inline: false
      }
    );

  // Add tier-specific commands
  if (userTier === 'vip' || userTier === 'vip_plus' || userTier === 'staff' || userTier === 'admin' || userTier === 'owner') {
    embed.addFields({
      name: '⭐ VIP Commands',
      value: [
        '`/pick` - Submit your betting picks',
        '`/coaching` - Get personalized coaching',
        '`/analytics` - Advanced betting analytics'
      ].join('\n'),
      inline: false
    });
  }

  if (userTier === 'vip_plus' || userTier === 'staff' || userTier === 'admin' || userTier === 'owner') {
    embed.addFields({
      name: '🌟 VIP+ Commands',
      value: [
        '`/premium-picks` - Access premium pick analysis',
        '`/trend-analysis` - Advanced trend analysis',
        '`/risk-management` - Risk management tools'
      ].join('\n'),
      inline: false
    });
  }

  if (userTier === 'staff' || userTier === 'admin' || userTier === 'owner') {
    embed.addFields({
      name: '🛡️ Staff Commands',
      value: [
        '`/moderate` - Moderation tools',
        '`/user-management` - User management',
        '`/system-status` - System status'
      ].join('\n'),
      inline: false
    });
  }

  return embed
    .setFooter({ text: 'Need more help? Contact our support team!' })
    .setTimestamp();
}

/**
 * Create leaderboard embed
 */
export function createLeaderboardEmbed(profiles: UserProfile[], type: 'activity' | 'wins' | 'profit'): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`🏆 Leaderboard - ${type.charAt(0).toUpperCase() + type.slice(1)}`)
    .setColor(COLORS.primary);

  if (profiles.length === 0) {
    return embed.setDescription('No data available for the leaderboard.');
  }

  const leaderboardText = profiles
    .slice(0, 10) // Top 10
    .map((profile, index) => {
      const position = index + 1;
      const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
      const tierEmoji = getTierEmoji(profile.tier);
      
      let value = '';
      switch (type) {
        case 'activity':
          value = `${profile.total_picks || 0} picks`;
          break;
        case 'wins':
          value = `${profile.total_wins || 0} wins`;
          break;
        case 'profit':
          const profit = profile.total_profit ?? 0;
          value = `${profit >= 0 ? '+' : ''}${profit.toFixed(2)} units`;
          break;
      }
      
      return `${medal} ${tierEmoji} **${profile.username}** - ${value}`;
    })
    .join('\n');

  return embed
    .setDescription(leaderboardText)
    .setFooter({ text: 'Rankings updated daily' })
    .setTimestamp();
}

/**
 * Create VIP info embed
 */
export function createVIPInfoEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('⭐ VIP Membership Benefits')
    .setColor(COLORS.vip)
    .setDescription('Unlock premium features and exclusive content!')
    .addFields(
      {
        name: '🎯 VIP Features',
        value: [
          '• Submit and track your betting picks',
          '• Access to VIP-only channels',
          '• Personalized betting coaching',
          '• Advanced analytics and insights',
          '• Priority customer support'
        ].join('\n'),
        inline: false
      },
      {
        name: '🌟 VIP+ Features (Additional)',
        value: [
          '• Premium pick analysis tools',
          '• Advanced trend analysis',
          '• Risk management dashboard',
          '• Exclusive market insights',
          '• Direct access to expert cappers'
        ].join('\n'),
        inline: false
      },
      {
        name: '💰 Pricing',
        value: [
          '**VIP:** $29.99/month',
          '**VIP+:** $49.99/month',
          '',
          '🎁 **Free 7-day trial available!**'
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ text: 'Ready to upgrade? Contact our team!' })
    .setTimestamp();
}

/**
 * Create trial status embed
 */
export function createTrialStatusEmbed(hoursRemaining: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('⏰ Trial Status')
    .setColor(COLORS.trial);

  if (hoursRemaining > 0) {
    const days = Math.floor(hoursRemaining / 24);
    const hours = hoursRemaining % 24;
    
    let timeText = '';
    if (days > 0) {
      timeText = `${days} day${days > 1 ? 's' : ''} and ${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      timeText = `${hours} hour${hours > 1 ? 's' : ''}`;
    }

    embed
      .setDescription(`Your free trial is active! You have **${timeText}** remaining.`)
      .addFields(
        {
          name: '🎯 Trial Benefits',
          value: [
            '• Access to VIP channels',
            '• Submit betting picks',
            '• Basic analytics',
            '• Community features'
          ].join('\n'),
          inline: true
        },
        {
          name: '⭐ Upgrade Benefits',
          value: [
            '• Unlimited access',
            '• Advanced coaching',
            '• Premium analytics',
            '• Priority support'
          ].join('\n'),
          inline: true
        }
      )
      .setFooter({ text: 'Upgrade anytime to continue enjoying premium features!' });
  } else {
    embed
      .setDescription('Your free trial has expired.')
      .setColor(COLORS.warning)
      .addFields({
        name: '🔄 What\'s Next?',
        value: [
          'Your trial has ended, but you can still:',
          '• View public content',
          '• Access basic features',
          '• Upgrade to VIP for full access'
        ].join('\n'),
        inline: false
      })
      .setFooter({ text: 'Ready to upgrade? Contact our team!' });
  }

  return embed.setTimestamp();
}

/**
 * Create free welcome embed with upgrade buttons
 */
export function createFreeWelcomeEmbed(username: string): { embed: EmbedBuilder, buttons: ActionRowBuilder<ButtonBuilder> } {
  const embed = new EmbedBuilder()
    .setTitle(`👋 Welcome to Unit Talk, ${username}!`)
    .setColor(COLORS.member)
    .setDescription('Thanks for joining our community! Here\'s what you can do:')
    .addFields(
      {
        name: '📊 Free Features',
        value: [
          '• View public picks and analysis',
          '• Access community discussions',
          '• Basic leaderboard access',
          '• Educational content'
        ].join('\n'),
        inline: false
      },
      {
        name: '🎁 Want More?',
        value: [
          'Start your **free 7-day VIP trial** to unlock:',
          '• Submit your own picks',
          '• Advanced analytics',
          '• Personalized coaching',
          '• VIP-only channels'
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ text: 'Use /help to see all available commands!' })
    .setTimestamp();

  const buttons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('start_vip_trial')
        .setLabel('Start Free Trial')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎯'),
      new ButtonBuilder()
        .setCustomId('free_user_upgrade')
        .setLabel('View Plans')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🚀'),
      new ButtonBuilder()
        .setCustomId('explore_free_features')
        .setLabel('Explore Free Features')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📊')
    );

  return { embed, buttons };
}

/**
 * Create VIP welcome embed
 */
export function createVIPWelcomeEmbed(username: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`⭐ Welcome VIP Member ${username}!`)
    .setColor(COLORS.vip)
    .setDescription('You now have access to exclusive VIP features!')
    .addFields(
      {
        name: '🎯 Your VIP Benefits',
        value: [
          '• Submit and track betting picks',
          '• Access VIP-only channels',
          '• Personalized coaching sessions',
          '• Advanced analytics dashboard',
          '• Priority customer support'
        ].join('\n'),
        inline: false
      },
      {
        name: '🚀 Getting Started',
        value: [
          '1. Use `/pick` to submit your first pick',
          '2. Check out the VIP channels',
          '3. Use `/coaching` for personalized advice',
          '4. Explore `/analytics` for insights'
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ text: 'Questions? Our VIP support team is here to help!' })
    .setTimestamp();
}

/**
 * Create VIP+ welcome embed
 */
export function createVIPPlusWelcomeEmbed(username: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`🌟 Welcome to VIP+ Exclusive!`)
    .setColor(COLORS.vip_plus)
    .setDescription(`Hey ${username}! Welcome to the elite tier of Unit Talk!`)
    .addFields(
      {
        name: '⚡ Instant Alerts',
        value: 'Get picks the moment they\'re released',
        inline: true
      },
      {
        name: '🤖 AI Coaching',
        value: 'Personal AI analysis and coaching',
        inline: true
      },
      {
        name: '🌍 Multi-language',
        value: 'Support in your preferred language',
        inline: true
      },
      {
        name: '📊 Advanced Analytics',
        value: 'Detailed performance tracking',
        inline: true
      },
      {
        name: '🎯 Premium Picks',
        value: 'Access to highest confidence plays',
        inline: true
      },
      {
        name: '💬 Direct Access',
        value: 'Priority support and feedback',
        inline: true
      },
      {
        name: '🎯 Advanced Tools',
        value: [
          '• `/premium-picks` - Enhanced analysis',
          '• `/trend-analysis` - Market trends',
          '• `/risk-management` - Portfolio tools',
          '• Exclusive VIP+ channels'
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ text: 'Welcome to the elite tier! Maximize your potential!' })
    .setTimestamp();
}

/**
 * Create trial welcome embed
 */

export function createTrialWelcomeEmbed(username: string): { embed: EmbedBuilder, buttons: ActionRowBuilder<ButtonBuilder> } {
  const embed = new EmbedBuilder()
    .setTitle(`🎁 Welcome to Your Free Trial, ${username}!`)
    .setColor(COLORS.trial)
    .setDescription('Your 7-day VIP trial has started! Explore all premium features.')
    .addFields(
      {
        name: '⏰ Trial Details',
        value: [
          '**Duration:** 7 days',
          '**Access Level:** Full VIP features',
          '**Auto-renewal:** No (trial only)',
          '**Upgrade:** Available anytime'
        ].join('\n'),
        inline: true
      },
      {
        name: '🎯 What to Try',
        value: [
          '• Submit picks with `/pick`',
          '• Get coaching with `/coaching`',
          '• Explore VIP channels',
          '• Use advanced analytics'
        ].join('\n'),
        inline: true
      }
    )
    .setFooter({ text: 'Make the most of your trial period!' })
    .setTimestamp();

  const buttons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('start_vip_tour')
        .setLabel('Start VIP Tour')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎯'),
      new ButtonBuilder()
        .setCustomId('trial_user_upgrade')
        .setLabel('Upgrade Now')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🚀'),
      new ButtonBuilder()
        .setCustomId('trial_status')
        .setLabel('Trial Status')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⏰')
    );

  return { embed, buttons };
}

/**
 * Create trial reminder embed
 */
export function createTrialReminderEmbed(hoursRemaining: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('⏰ Trial Reminder')
    .setColor(COLORS.warning);

  const days = Math.floor(hoursRemaining / 24);
  const hours = hoursRemaining % 24;

  let timeText = '';
  if (days > 0) {
    timeText = `${days} day${days > 1 ? 's' : ''} and ${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    timeText = `${hours} hour${hours > 1 ? 's' : ''}`;
  }

  if (hoursRemaining <= 24) {
    embed.setColor(COLORS.error);
  }

  return embed
    .setDescription(`Your free trial expires in **${timeText}**!`)
    .addFields(
      {
        name: '🎯 Don\'t Lose Access',
        value: [
          'Upgrade now to keep enjoying:',
          '• Unlimited pick submissions',
          '• Advanced analytics',
          '• Personalized coaching',
          '• VIP community access'
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ text: 'Upgrade now to avoid interruption!' })
    .setTimestamp();
}

/**
 * Create channel unlock embed
 */
export function createChannelUnlockEmbed(channelName: string, tier: UserTier): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🔓 Channel Unlocked!')
    .setColor(getTierColor(tier))
    .setDescription(`Welcome to **${channelName}**! This channel is now available to you.`)
    .addFields({
      name: '🎉 Congratulations!',
      value: `Your ${getTierDisplayName(tier)} status grants you access to this exclusive content.`,
      inline: false
    })
    .setFooter({ text: 'Enjoy your enhanced experience!' })
    .setTimestamp();
}

/**
 * Create re-engagement embed
 */
export function createReEngagementEmbed(username: string, daysSinceActive: number): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`👋 We Miss You, ${username}!`)
    .setColor(COLORS.info)
    .setDescription(`It's been ${daysSinceActive} days since your last visit. Here's what you've missed:`)
    .addFields(
      {
        name: '📈 Recent Highlights',
        value: [
          '• New winning strategies shared',
          '• Community leaderboard updates',
          '• Fresh market analysis',
          '• Improved analytics tools'
        ].join('\n'),
        inline: false
      },
      {
        name: '🎯 Jump Back In',
        value: [
          '• Check the latest picks',
          '• Review your performance',
          '• Connect with the community',
          '• Explore new features'
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ text: 'Welcome back! We\'re glad to see you again.' })
    .setTimestamp();
}

/**
 * Create first win congratulations embed
 */
export function createFirstWinCongratulationsEmbed(username: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`🎉 Congratulations ${username}!`)
    .setColor(COLORS.success)
    .setDescription('You just recorded your first winning pick! This is just the beginning.')
    .addFields(
      {
        name: '🏆 Achievement Unlocked',
        value: [
          '**First Win** - The foundation of success!',
          '',
          'Every expert started with their first win.',
          'Keep building on this momentum!'
        ].join('\n'),
        inline: false
      },
      {
        name: '📈 Next Steps',
        value: [
          '• Analyze what made this pick successful',
          '• Apply the same strategy to future picks',
          '• Track your progress with `/stats`',
          '• Share your success with the community'
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ text: 'This is just the beginning of your winning journey!' })
    .setTimestamp();
}

/**
 * Create missed value embed
 */
export function createMissedValueEmbed(username: string, missedWins: number, missedProfit: number): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`💡 Missed Opportunities, ${username}`)
    .setColor(COLORS.warning)
    .setDescription('Here\'s what you could have gained by following our premium picks:')
    .addFields(
      {
        name: '📊 Missed Value',
        value: [
          `**Winning Picks Missed:** ${missedWins}`,
          `**Potential Profit:** +${missedProfit.toFixed(2)} units`,
          '',
          'These were picks available to VIP members.'
        ].join('\n'),
        inline: false
      },
      {
        name: '⭐ Unlock This Value',
        value: [
          'Upgrade to VIP to access:',
          '• All premium picks',
          '• Advanced analysis',
          '• Real-time alerts',
          '• Expert insights'
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ text: 'Don\'t miss out on future opportunities!' })
    .setTimestamp();
}

/**
 * Create upgrade success embed
 */
export function createUpgradeSuccessEmbed(tier: UserTier): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`🎉 Upgrade Successful!`)
    .setColor(getTierColor(tier))
    .setDescription(`Welcome to ${getTierDisplayName(tier)}! Your account has been upgraded.`)
    .addFields({
      name: '✅ What\'s New',
      value: [
        `• ${getTierEmoji(tier)} ${getTierDisplayName(tier)} status activated`,
        '• All premium features unlocked',
        '• Access to exclusive channels',
        '• Enhanced support priority'
      ].join('\n'),
      inline: false
    })
    .setFooter({ text: 'Thank you for upgrading! Enjoy your enhanced experience.' })
    .setTimestamp();
}

/**
 * Create payment failed embed
 */
export function createPaymentFailedEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('⚠️ Payment Issue')
    .setColor(COLORS.error)
    .setDescription('We encountered an issue processing your payment.')
    .addFields(
      {
        name: '🔄 What to Do',
        value: [
          '1. Check your payment method',
          '2. Ensure sufficient funds',
          '3. Contact your bank if needed',
          '4. Try the payment again'
        ].join('\n'),
        inline: true
      },
      {
        name: '⚠️ Account Status',
        value: 'Your VIP features will be suspended until payment is resolved.'
      },
      {
        name: '🆘 Need Help?',
        value: 'Contact our support team if you need assistance.'
      }
    )
    .setFooter({ text: 'Update payment method to restore access' })
    .setTimestamp();
}

/**
 * Create user stats embed
 */
export function createUserStatsEmbed(profile: UserProfile, stats?: any): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`📊 ${profile.username || 'User'} Stats`)
    .setColor(getTierColor(profile.tier))
    .setThumbnail(profile.avatar_url || null)
    .addFields(
      {
        name: '👤 Profile',
        value: [
          `**Tier:** ${getTierEmoji(profile.tier)} ${getTierDisplayName(profile.tier)}`,
          `**Member Since:** <t:${Math.floor(new Date(profile.created_at || Date.now()).getTime() / 1000)}:R>`,
          `**Last Active:** <t:${Math.floor(new Date(profile.last_active || profile.created_at || Date.now()).getTime() / 1000)}:R>`
        ].join('\n'),
        inline: true
      }
    );

  // Add stats if provided
  if (stats) {
    if (stats.totalPicks !== undefined) {
      embed.addFields({
        name: '🎯 Betting Stats',
        value: [
          `**Total Picks:** ${stats.totalPicks || 0}`,
          `**Wins:** ${stats.wins || 0}`,
          `**Losses:** ${stats.losses || 0}`,
          `**Win Rate:** ${stats.winRate ? `${(stats.winRate * 100).toFixed(1)}%` : '0%'}`
        ].join('\n'),
        inline: true
      });
    }

    if (stats.totalProfit !== undefined) {
      embed.addFields({
        name: '💰 Financial Stats',
        value: [
          `**Total Profit:** ${stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit?.toFixed(2) || '0.00'} units`,
          `**Best Day:** +${stats.bestDay?.toFixed(2) || '0.00'} units`,
          `**Worst Day:** ${stats.worstDay?.toFixed(2) || '0.00'} units`,
          `**ROI:** ${stats.roi ? `${(stats.roi * 100).toFixed(1)}%` : '0%'}`
        ].join('\n'),
        inline: true
      });
    }

    if (stats.streak !== undefined) {
      embed.addFields({
        name: '🔥 Streaks',
        value: [
          `**Current Streak:** ${stats.currentStreak || 0} ${stats.currentStreakType || 'picks'}`,
          `**Best Win Streak:** ${stats.bestWinStreak || 0}`,
          `**Worst Loss Streak:** ${stats.worstLossStreak || 0}`
        ].join('\n'),
        inline: false
      });
    }
  }

  embed
    .setFooter({ text: 'Stats updated in real-time' })
    .setTimestamp();

  return embed;
}

/**
 * Create staff welcome embed
 */
export function createStaffWelcomeEmbed(username: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`👨‍💼 Welcome Staff Member ${username}!`)
    .setColor(COLORS.staff)
    .setDescription('Welcome to the Unit Talk staff team! You have access to all moderation and management tools.')
    .addFields(
      {
        name: '🛠️ Staff Tools',
        value: [
          '• Full moderation capabilities',
          '• User management tools',
          '• Analytics dashboard access',
          '• Content management system'
        ].join('\n'),
        inline: false
      },
      {
        name: '📊 Access Level',
        value: [
          '• All VIP+ features included',
          '• Staff-only channels',
          '• Administrative commands',
          '• System monitoring tools'
        ].join('\n'),
        inline: false
      },
      {
        name: '📋 Responsibilities',
        value: [
          '• Community moderation',
          '• User support assistance',
          '• Content quality control',
          '• System maintenance support'
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ text: 'Use /help-staff to see staff-specific commands' })
    .setTimestamp();
}

/**
 * Create admin welcome embed
 */
export function createAdminWelcomeEmbed(username: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`⚡ Welcome Administrator ${username}!`)
    .setColor(COLORS.admin)
    .setDescription('Welcome to the Unit Talk administration team! You have full system access and control.')
    .addFields(
      {
        name: '🔧 Admin Powers',
        value: [
          '• Complete system administration',
          '• Database management access',
          '• Server configuration control',
          '• Advanced analytics and reporting'
        ].join('\n'),
        inline: false
      },
      {
        name: '🎯 Full Access',
        value: [
          '• All user tier features',
          '• Admin-only channels and tools',
          '• System override capabilities',
          '• Emergency response tools'
        ].join('\n'),
        inline: false
      },
      {
        name: '⚠️ Key Responsibilities',
        value: [
          '• System security and integrity',
          '• Staff management and oversight',
          '• Critical decision making',
          '• Platform stability maintenance'
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ text: 'Use /help-admin to see administrator commands' })
    .setTimestamp();
}

/**
 * Create owner welcome embed
 */
export function createOwnerWelcomeEmbed(username: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`👑 Welcome Owner ${username}!`)
    .setColor(COLORS.owner)
    .setDescription('Welcome back, boss! You have ultimate control over the entire Unit Talk platform.')
    .addFields(
      {
        name: '🌟 Ultimate Authority',
        value: [
          '• Complete platform ownership',
          '• All system privileges',
          '• Financial and business controls',
          '• Strategic decision authority'
        ].join('\n'),
        inline: false
      },
      {
        name: '🚀 Platform Control',
        value: [
          '• All features and capabilities',
          '• Owner-exclusive channels',
          '• Business intelligence dashboard',
          '• Revenue and analytics oversight'
        ].join('\n'),
        inline: false
      },
      {
        name: '💼 Leadership Role',
        value: [
          '• Team leadership and vision',
          '• Strategic platform direction',
          '• Business development oversight',
          '• Community growth leadership'
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ text: 'Use /help-owner to see owner-specific commands' })
    .setTimestamp();
}

/**
 * NOTE: Multi-message onboarding functionality has been moved to OnboardingService
 * The old onboarding functions have been removed to avoid duplication and confusion
 * Use OnboardingService for all tier-based welcome sequences
 */