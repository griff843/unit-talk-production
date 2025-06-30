import { GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { logger } from '../utils/logger';
import { botConfig } from '../config';

export class RoleChangeService {
  private client: any;
  private vipNotificationService?: any;

  constructor(client: any, vipNotificationService?: any) {
    this.client = client;
    this.vipNotificationService = vipNotificationService;
  }

  /**
   * Set the VIP notification service (for dependency injection)
   */
  setVipNotificationService(vipNotificationService: any): void {
    this.vipNotificationService = vipNotificationService;
  }

  /**
   * Handle role changes for a guild member
   */
  async handleRoleChange(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    try {
      // Get role changes
      const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
      const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

      // Check for tier changes
      const oldTier = this.getUserTier(oldMember);
      const newTier = this.getUserTier(newMember);

      if (oldTier !== newTier) {
        // Only use VIP notification service to avoid duplicates
        if (this.vipNotificationService) {
          await this.vipNotificationService.handleTierChange(newMember, oldTier, newTier);
        }
      }

      // Log role changes
      if (addedRoles.size > 0 || removedRoles.size > 0) {
        logger.info('Role change detected', {
          userId: newMember.id,
          username: newMember.user.username,
          addedRoles: addedRoles.map(role => role.name),
          removedRoles: removedRoles.map(role => role.name),
          oldTier,
          newTier
        });
      }

    } catch (error) {
      logger.error('Error handling role change:', error);
    }
  }

  /**
   * Send upgrade notification via DM
   */
  private async _sendUpgradeNotification(member: GuildMember, oldTier: string, newTier: string): Promise<void> {
    try {
      const embed = this.createUpgradeEmbed(member, oldTier, newTier);

      // Send DM to user
      await member.send({ embeds: [embed] });

      // Log the notification
      logger.info('Upgrade notification sent', {
        userId: member.id,
        username: member.user.username,
        oldTier,
        newTier
      });

    } catch (error) {
      logger.error('Error sending upgrade notification:', error);

      // If DM fails, try to notify in a channel
      await this.fallbackChannelNotification(member, newTier);
    }
  }

  /**
   * Create upgrade embed
   */
  private createUpgradeEmbed(member: GuildMember, _oldTier: string, newTier: string): EmbedBuilder {
    const isVipPlus = newTier === 'vip_plus';
    const isVip = newTier === 'vip';

    let title = '🎉 Congratulations!';
    let description = `${member.displayName || member.user.username}, you've been upgraded!`;
    let color = 0x00FF00;
    let features = '';

    if (isVipPlus) {
      title = '💎+ Welcome to VIP Plus!';
      description = `Congratulations ${member.displayName || member.user.username}! You now have VIP+ access!`;
      color = 0xFFD700;
      features = '• VIP+ exclusive channels\n• Premium analytics dashboard\n• Direct expert access\n• Exclusive high-value picks\n• Priority support\n• Advanced betting tools';
    } else if (isVip) {
      title = '💎 Welcome to VIP!';
      description = `Congratulations ${member.displayName || member.user.username}! You now have VIP access!`;
      color = 0x9932CC;
      features = '• VIP channels access\n• Advanced analytics\n• Priority picks\n• Community insights\n• Enhanced support\n• Exclusive content';
    }

    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .addFields(
        {
          name: '🔓 New Access Unlocked',
          value: features,
          inline: false
        },
        {
          name: '🚀 Getting Started',
          value: `• Check out your new channels\n• Use \`/help\` to see updated commands\n• Explore your exclusive content!\n• Join the ${isVipPlus ? 'VIP+' : 'VIP'} community`,
          inline: false
        },
        {
          name: '💡 Need Help?',
          value: 'Feel free to reach out to our team if you have any questions about your new features!',
          inline: false
        }
      )
      .setFooter({ text: `Unit Talk - Welcome to ${isVipPlus ? 'VIP+' : 'VIP'}!` })
      .setTimestamp()
      .setThumbnail(member.user.displayAvatarURL());
  }

  /**
   * Notify admins of user upgrade
   */
  private async _notifyAdminsOfUpgrade(member: GuildMember, oldTier: string, newTier: string): Promise<void> {
    try {
      const adminChannel = this.client.channels.cache.get(botConfig.channels.admin) as TextChannel;
      if (!adminChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('🔔 Member Upgrade Notification')
        .setDescription(`${member.user.username} has been upgraded from ${oldTier.toUpperCase()} to ${newTier.toUpperCase()}`)
        .setColor(0x00FF00)
        .addFields(
          {
            name: 'User Details',
            value: `**Username:** ${member.user.username}\n**Display Name:** ${member.displayName || 'N/A'}\n**User ID:** ${member.id}`,
            inline: false
          },
          {
            name: 'Upgrade Details',
            value: `**Previous Tier:** ${oldTier.toUpperCase()}\n**New Tier:** ${newTier.toUpperCase()}\n**Upgraded At:** <t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: false
          }
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

      await adminChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Error notifying admins of upgrade:', error);
    }
  }

  /**
   * Fallback notification in channel if DM fails
   */
  private async fallbackChannelNotification(member: GuildMember, tier: string): Promise<void> {
    try {
      let channelId = botConfig.channels.general;

      if (tier === 'vip_plus') {
        channelId = botConfig.channels.vipPlusGeneral;
      } else if (tier === 'vip') {
        channelId = botConfig.channels.vipGeneral;
      }

      const channel = this.client.channels.cache.get(channelId) as TextChannel;

      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('🎉 Welcome to the VIP Family!')
          .setDescription(`Welcome ${member}! You've been upgraded to ${tier.toUpperCase()} status!`)
          .setColor(tier === 'vip_plus' ? 0xFFD700 : tier === 'vip' ? 0x9932CC : 0x00FF00)
          .addFields({
            name: '📬 DM Notice',
            value: 'We tried to send you a welcome DM but couldn\'t reach you. Make sure your DMs are open for important notifications!',
            inline: false
          })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      logger.error('Error sending fallback channel notification:', error);
    }
  }

  /**
   * Get user's current tier based on roles
   */
  getUserTier(member: GuildMember): 'member' | 'trial' | 'vip' | 'vip_plus' | 'capper' | 'staff' | 'admin' | 'owner' {
    // Use the centralized getUserTier function from roleUtils
    const { getUserTier } = require('../utils/roleUtils');
    return getUserTier(member) as 'member' | 'trial' | 'vip' | 'vip_plus' | 'capper' | 'staff' | 'admin' | 'owner';
  }
}