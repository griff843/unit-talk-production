import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { UserProfile, UserTier } from '../types';

export const COLORS = {
  primary: '#3498db' as const,
  success: '#2ecc71' as const,
  warning: '#f39c12' as const,
  error: '#e74c3c' as const,
  info: '#9b59b6' as const,
  member: '#95a5a6' as const,
  vip: '#f1c40f' as const,
  vip_plus: '#e67e22' as const,
  staff: '#9b59b6' as const,
  admin: '#e74c3c' as const,
  owner: '#2c3e50' as const,
  trial: '#95a5a6' as const
};

export function getTierColor(tier: UserTier): ColorResolvable {
  return COLORS[tier] || COLORS.member;
}

export function getTierDisplayName(tier: UserTier): string {
  switch (tier) {
    case 'member': return 'Member';
    case 'vip': return 'VIP';
    case 'vip_plus': return 'VIP+';
    case 'staff': return 'Staff';
    case 'admin': return 'Admin';
    case 'owner': return 'Owner';
    default: return 'Member';
  }
}

export function getTierEmoji(tier: UserTier): string {
  switch (tier) {
    case 'member': return '👤';
    case 'vip': return '⭐';
    case 'vip_plus': return '🌟';
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
  const profileData = profile as any; // Temporary type assertion
  const embed = new EmbedBuilder()
    .setTitle('👤 User Profile')
    .setDescription(`Profile for ${profileData.display_name || 'Unknown User'}`)
    .setColor(getTierColor(profileData.tier || 'member'))
    .addFields(
      {
        name: '🎯 Tier',
        value: getTierDisplayName(profileData.tier || 'member'),
        inline: true
      },
      {
        name: '📊 Activity',
        value: `Messages: ${profileData.total_messages || 0} | Reactions: ${profileData.total_reactions || 0} | Score: ${profileData.activity_score || 0}`,
        inline: false
      },
      {
        name: '🆔 Discord ID',
        value: profileData.discord_id || 'Unknown',
        inline: true
      }
    );

  if (profileData.last_active) {
    const lastActive = new Date(profileData.last_active);
    embed.addFields({
      name: '⏰ Last Active',
      value: lastActive.toLocaleDateString(),
      inline: true
    });
  }

  embed.setTimestamp();
  return embed;
}

/**
 * Create help embed with tier-based commands
 */
export function createHelpEmbed(userTier: UserTier): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🤖 Unit Talk Bot Commands')
    .setDescription('Here are the commands available to you:')
    .setColor(getTierColor(userTier))
    .addFields(
      {
        name: '📊 General Commands',
        value: '`/help` - Show this help menu\n`/ping` - Check bot status\n`/stats` - View your statistics',
        inline: false
      }
    );

  // Add tier-specific commands
  if (userTier === 'vip' || userTier === 'vip_plus' || userTier === 'staff' || userTier === 'admin' || userTier === 'owner') {
    embed.addFields({
      name: '💎 VIP Commands',
      value: '`/vip-info` - View VIP membership info\n`/trial-status` - Check trial status\n`/upgrade` - Upgrade membership',
      inline: false
    });
  }

  if (userTier === 'vip_plus' || userTier === 'staff' || userTier === 'admin' || userTier === 'owner') {
    embed.addFields({
      name: '🔥 VIP+ Commands',
      value: '`/heat-signal` - Access live heat signals\n`/line-alert` - Line movement alerts\n`/hedge-alert` - Hedge opportunities',
      inline: false
    });
  }

  if (userTier === 'staff' || userTier === 'admin' || userTier === 'owner') {
    embed.addFields({
      name: '🛠️ Staff Commands',
      value: '`/admin` - Admin panel\n`/moderate` - Moderation tools\n`/analytics` - View analytics',
      inline: false
    });
  }

  return embed.setTimestamp();
}

/**
 * Create leaderboard embed
 */
export function createLeaderboardEmbed(profiles: UserProfile[], type: 'activity' | 'wins' | 'profit'): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${type.charAt(0).toUpperCase() + type.slice(1)} Leaderboard`)
    .setColor('#FFD700');

  const sortedProfiles = profiles.sort((a, b) => {
    const profileA = a as any;
    const profileB = b as any;
    switch (type) {
      case 'activity':
        return (profileB.activity_score || 0) - (profileA.activity_score || 0);
      case 'wins':
        return (profileB.winning_picks || 0) - (profileA.winning_picks || 0);
      case 'profit':
        return (profileB.total_profit || 0) - (profileA.total_profit || 0);
      default:
        return 0;
    }
  });

  const leaderboardText = sortedProfiles
    .slice(0, 10)
    .map((profile, index) => {
      const profileData = profile as any;
      const position = index + 1;
      const name = profileData.display_name || 'Unknown User';
      const tier = getTierDisplayName(profileData.tier || 'member');

      let value: string;
      switch (type) {
        case 'activity':
          value = `${profileData.activity_score || 0} points`;
          break;
        case 'wins':
          value = `${profileData.winning_picks || 0} wins`;
          break;
        case 'profit':
          value = `$${profileData.total_profit || 0}`;
          break;
        default:
          value = '0';
      }

      return `${position}. **${name}** (${tier}) - ${value}`;
    })
    .join('\n');

  embed.setDescription(leaderboardText || 'No data available');
  embed.setTimestamp();

  return embed;
}

/**
 * Create a simple success embed
 */

/**
 * Create VIP info embed
 */
export function createVIPInfoEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('💎 VIP Membership Benefits')
    .setDescription('Unlock premium features and exclusive access!')
    .setColor(COLORS.vip)
    .addFields(
      {
        name: '🎯 VIP Features ($29/month)',
        value: '• Exclusive VIP picks\n• Daily analysis & recaps\n• VIP-only channels\n• Priority support\n• Performance tracking',
        inline: true
      },
      {
        name: '👑 VIP+ Features ($49/month)',
        value: '• Everything in VIP\n• Live heat signals\n• Line movement alerts\n• Analyst chat access\n• Advanced analytics',
        inline: true
      },
      {
        name: '🎟️ Try Before You Buy',
        value: 'Start with a 3-day trial for just $1!\nFull VIP access to test our service.',
        inline: false
      }
    )
    .setFooter({ text: 'Cancel anytime • Secure payment via Whop' })
    .setTimestamp();
}

/**
 * Create trial status embed
 */
export function createTrialStatusEmbed(hoursRemaining: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🎟️ Trial Status')
    .setColor(COLORS.trial);

  if (hoursRemaining > 0) {
    embed.setDescription(`Your trial is active with **${hoursRemaining} hours** remaining!`)
      .addFields(
        {
          name: '✅ Active Benefits',
          value: '• Full VIP access\n• Exclusive picks\n• VIP channels\n• Daily analysis',
          inline: true
        },
        {
          name: '⏰ Time Remaining',
          value: `**${hoursRemaining} hours**\n${Math.floor(hoursRemaining / 24)} days, ${hoursRemaining % 24} hours`,
          inline: true
        },
        {
          name: '💎 Upgrade Now',
          value: 'Upgrade to VIP to continue your access after trial ends!',
          inline: false
        }
      );
  } else {
    embed.setDescription('Your trial has expired.')
      .addFields({
        name: '🚀 Continue Your Journey',
        value: 'Upgrade to VIP to regain access to all premium features!',
        inline: false
      });
  }

  return embed.setTimestamp();
}

// Welcome message embeds for different tiers
export function createFreeWelcomeEmbed(username: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`👋 Welcome to Unit Talk, ${username}!`)
    .setDescription('Thanks for joining our community! Here\'s how to get started:')
    .setColor(COLORS.member)
    .addFields(
      {
        name: '📊 Free Features',
        value: '• Access to general channels\n• Community discussions\n• Basic pick tracking\n• Weekly free picks',
        inline: true
      },
      {
        name: '🚀 Ready to Upgrade?',
        value: '• VIP: $29/month\n• VIP+: $49/month\n• Trial: $1 for 3 days\n• Cancel anytime',
        inline: true
      },
      {
        name: '🆘 Need Help?',
        value: 'Use `/help` to see available commands or ask in <#general>!',
        inline: false
      }
    )
    .setFooter({ text: 'Welcome to the Unit Talk family!' })
    .setTimestamp();
}

export function createVIPWelcomeEmbed(username: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`💎 Welcome to VIP, ${username}!`)
    .setDescription('You now have access to exclusive VIP features!')
    .setColor(COLORS.vip)
    .addFields(
      {
        name: '🎯 Your VIP Benefits',
        value: '• Exclusive VIP picks\n• Daily analysis & recaps\n• VIP-only channels\n• Priority support\n• Performance tracking',
        inline: true
      },
      {
        name: '📍 VIP Channels',
        value: '<#vip-general> - VIP discussions\n<#vip-picks> - Exclusive picks\n<#vip-analysis> - Detailed breakdowns',
        inline: true
      },
      {
        name: '🚀 Getting Started',
        value: 'Check out today\'s picks and join the VIP discussion!',
        inline: false
      }
    )
    .setFooter({ text: 'Welcome to VIP! Let\'s make some money 💰' })
    .setTimestamp();
}

export function createVIPPlusWelcomeEmbed(username: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`👑 Welcome to VIP+, ${username}!`)
    .setDescription('🎉 **You\'ve unlocked our most exclusive tier!** Get ready for elite-level betting intelligence.')
    .setColor(COLORS.vip_plus)
    .addFields(
      {
        name: '🔥 VIP+ Elite Features',
        value: '• **Heat Signal** - Real-time line movement alerts\n• **Sharp Money Tracking** - Follow the pros\n• **Reverse Line Movement** - Catch the steam\n• **Analyst Direct Access** - Chat with experts\n• **Advanced Analytics** - Deep performance insights',
        inline: false
      },
      {
        name: '📊 Your Exclusive Channels',
        value: '🔥 <#1288616507315589250> - Premium picks & analysis\n💎 <#1288616331503075441> - VIP+ elite discussions\n📈 <#1288616564655276032> - Advanced performance tracking\n🚨 **Heat Signal alerts** - Coming to your DMs!',
        inline: false
      },
      {
        name: '⚡ Quick Start Guide',
        value: '1️⃣ **Check Heat Signal** - Use the button below\n2️⃣ **View Today\'s Picks** - Premium analysis ready\n3️⃣ **Set Up Alerts** - Never miss sharp action\n4️⃣ **Join Elite Chat** - Connect with top bettors',
        inline: false
      },
      {
        name: '💰 VIP+ Performance Stats',
        value: '📈 **Average ROI**: +31% higher than VIP\n🎯 **Win Rate**: 73% on Heat Signal plays\n⚡ **Speed Advantage**: 15min before public\n🏆 **Top Performers**: 85% are VIP+ members',
        inline: false
      }
    )
    .setFooter({ text: '👑 Welcome to the elite tier! Your edge starts now.' })
    .setTimestamp();
}

export function createTrialWelcomeEmbed(username: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`🎟️ Welcome to Your Trial, ${username}!`)
    .setDescription('You have 72 hours of full VIP access!')
    .setColor(COLORS.trial)
    .addFields(
      {
        name: '✅ Trial Includes',
        value: '• All VIP picks & analysis\n• VIP channel access\n• Daily recaps\n• Performance tracking\n• Priority support',
        inline: true
      },
      {
        name: '⏰ Trial Duration',
        value: '**72 hours** of full access\nWe\'ll remind you before it expires!',
        inline: true
      },
      {
        name: '💎 Love the service?',
        value: 'Upgrade to VIP anytime to continue your access without interruption!',
        inline: false
      }
    )
    .setFooter({ text: 'Make the most of your trial! 🚀' })
    .setTimestamp();
}

export function createTrialReminderEmbed(hoursRemaining: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('⏰ Trial Reminder')
    .setColor(COLORS.warning);

  if (hoursRemaining <= 1) {
    embed.setDescription('🚨 **Your trial expires in less than 1 hour!**')
      .addFields({
        name: '💎 Upgrade Now',
        value: 'Don\'t lose access! Upgrade to VIP to continue enjoying premium features.',
        inline: false
      });
  } else if (hoursRemaining <= 24) {
    embed.setDescription(`⚠️ **Your trial expires in ${hoursRemaining} hours!**`)
      .addFields({
        name: '💎 Upgrade Soon',
        value: 'Your trial is ending soon. Upgrade to VIP to maintain your access!',
        inline: false
      });
  } else {
    embed.setDescription(`📅 **Your trial expires in ${hoursRemaining} hours (${Math.floor(hoursRemaining / 24)} days)**`)
      .addFields({
        name: '💎 Consider Upgrading',
        value: 'Enjoying the VIP experience? Upgrade now to secure your continued access!',
        inline: false
      });
  }

  return embed.setTimestamp();
}

export function createChannelUnlockEmbed(channelName: string, tier: UserTier): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`🔓 ${channelName} Unlocked!`)
    .setDescription(`Welcome to your exclusive ${tier.replace('_', ' ').toUpperCase()} channel!`)
    .setColor(getTierColor(tier))
    .addFields({
      name: '🎉 You now have access to:',
      value: `• Exclusive ${tier} discussions\n• Premium content\n• Direct interaction with other ${tier} members`,
      inline: false
    })
    .setFooter({ text: 'Enjoy your exclusive access!' })
    .setTimestamp();
}

export function createReEngagementEmbed(username: string, daysSinceActive: number): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`👋 We miss you, ${username}!`)
    .setDescription(`It's been ${daysSinceActive} days since we've seen you. Here's what you've missed:`)
    .setColor(COLORS.info)
    .addFields(
      {
        name: '🔥 Recent Highlights',
        value: '• New winning strategies\n• Updated pick analysis\n• Community growth\n• Feature improvements',
        inline: true
      },
      {
        name: '📊 Your Stats',
        value: 'Check your performance and see how you\'re doing compared to other members!',
        inline: true
      },
      {
        name: '🎯 Come Back',
        value: 'Jump back in and see what\'s trending in the community!',
        inline: false
      }
    )
    .setFooter({ text: 'We\'re here when you\'re ready to return!' })
    .setTimestamp();
}

export function createFirstWinCongratulationsEmbed(username: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`🎉 Congratulations ${username}!`)
    .setDescription('You just hit your first win! This is just the beginning.')
    .setColor(COLORS.success)
    .addFields(
      {
        name: '🏆 First Win!',
        value: 'Great job on your first successful pick! This shows you\'re learning the system.',
        inline: true
      },
      {
        name: '📈 Keep Growing',
        value: 'VIP members see 3x more wins on average. Ready to level up?',
        inline: true
      },
      {
        name: '💎 Upgrade Benefits',
        value: '• More winning picks\n• Better analysis\n• Exclusive strategies\n• Higher success rate',
        inline: false
      }
    )
    .setFooter({ text: 'This is just the start of your winning journey!' })
    .setTimestamp();
}

export function createMissedValueEmbed(username: string, missedWins: number, missedProfit: number): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`💰 ${username}, you're missing out!`)
    .setDescription('Here\'s what VIP members have gained while you were away:')
    .setColor(COLORS.warning)
    .addFields(
      {
        name: '📊 Missed Opportunities',
        value: `**${missedWins} winning picks**\n**${missedProfit}u in profit**\n*Based on VIP member average*`,
        inline: true
      },
      {
        name: '💎 VIP Advantage',
        value: 'VIP members get exclusive picks with higher win rates and better analysis.',
        inline: true
      },
      {
        name: '🚀 Catch Up Now',
        value: 'Start your $1 trial today and see what you\'ve been missing!',
        inline: false
      }
    )
    .setFooter({ text: 'Don\'t let more opportunities slip away!' })
    .setTimestamp();
}

export function createUpgradeSuccessEmbed(tier: UserTier): EmbedBuilder {
  const tierName = tier.replace('_', ' ').toUpperCase();
  return new EmbedBuilder()
    .setTitle(`🎉 Welcome to ${tierName}!`)
    .setDescription('Your upgrade was successful! You now have access to premium features.')
    .setColor(getTierColor(tier))
    .addFields({
      name: '✅ Upgrade Complete',
      value: `You are now a ${tierName} member with full access to exclusive features!`,
      inline: false
    })
    .setFooter({ text: 'Thank you for upgrading!' })
    .setTimestamp();
}

export function createPaymentFailedEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('❌ Payment Failed')
    .setDescription('We couldn\'t process your payment. Please update your payment method.')
    .setColor(COLORS.error)
    .addFields(
      {
        name: '🔄 Next Steps',
        value: '1. Check your payment method\n2. Ensure sufficient funds\n3. Try again or contact support'
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