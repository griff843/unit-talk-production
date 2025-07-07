import { GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { logger } from '../utils/logger';
import { botConfig } from '../config';
import { getUserTier, handleRoleUpgradeWithDelay, setOptimisticTier } from '../utils/roleUtils';

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
  /**
   * Handle role changes for a guild member with enhanced detection
   */
  async handleRoleChange(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    try {
      // Get role changes
      const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
      const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

      // Check for tier changes with enhanced detection
      const oldTier = getUserTier(oldMember);
      const newTier = getUserTier(newMember);

      if (oldTier !== newTier) {
        logger.info(`🔄 Tier change detected for ${newMember.user.tag}`, {
          userId: newMember.id,
          username: newMember.user.username,
          oldTier,
          newTier,
          addedRoles: addedRoles.map(role => role.name),
          removedRoles: removedRoles.map(role => role.name)
        });

        // Set optimistic tier for immediate recognition
        setOptimisticTier(newMember.id, newTier);

        // Handle tier upgrade with delay for Discord propagation
        if (this.isUpgrade(oldTier, newTier)) {
          await this.handleTierUpgrade(newMember, oldTier, newTier);
        }

        // Only use VIP notification service to avoid duplicates
        if (this.vipNotificationService) {
          await this.vipNotificationService.handleTierChange(newMember, oldTier, newTier);
        }
      }

      // Log role changes with enhanced details
      if (addedRoles.size > 0 || removedRoles.size > 0) {
        logger.info('Role change detected', {
          userId: newMember.id,
          username: newMember.user.username,
          tag: newMember.user.tag,
          addedRoles: addedRoles.map(role => ({ name: role.name, id: role.id })),
          removedRoles: removedRoles.map(role => ({ name: role.name, id: role.id })),
          oldTier,
          newTier,
          isUpgrade: this.isUpgrade(oldTier, newTier)
        });
      }

    } catch (error) {
      logger.error(`Error handling role change for ${newMember.user.tag} (${newMember.id}):`, {
        userId: newMember.id,
        username: newMember.user.username,
        tag: newMember.user.tag,
        error: error instanceof Error ? error.message : String(error),
        fullError: error
      });
    }
  }

  /**
   * Check if a tier change is an upgrade
   */
  private isUpgrade(oldTier: string, newTier: string): boolean {
    const tierHierarchy = ['member', 'trial', 'vip', 'vip_plus', 'capper', 'staff', 'admin', 'owner'];
    const oldIndex = tierHierarchy.indexOf(oldTier);
    const newIndex = tierHierarchy.indexOf(newTier);
    return newIndex > oldIndex;
  }

  /**
   * Handle tier upgrade with enhanced processing
   */
  private async handleTierUpgrade(member: GuildMember, oldTier: string, newTier: string): Promise<void> {
    try {
      logger.info(`🎉 Processing tier upgrade for ${member.user.tag}`, {
        userId: member.id,
        oldTier,
        newTier
      });

      // Wait a moment for Discord to fully propagate the role change
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send upgrade notification
      await this._sendUpgradeNotification(member, oldTier, newTier);

      // Notify admins
      await this._notifyAdminsOfUpgrade(member, oldTier, newTier);

    } catch (error) {
      logger.error(`Error processing tier upgrade for ${member.user.tag}:`, {
        userId: member.id,
        oldTier,
        newTier,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send upgrade notification via DM
   * DISABLED: ComprehensiveOnboardingService now handles all welcome messages
   */
  private async _sendUpgradeNotification(member: GuildMember, oldTier: string, newTier: string): Promise<void> {
    try {
      // DISABLED: Preventing duplicate welcome messages
      // ComprehensiveOnboardingService now handles all tier-based onboarding
      logger.info(`Upgrade notification disabled for ${member.user.username} (${oldTier} -> ${newTier}) - handled by ComprehensiveOnboardingService`);
      return;
    } catch (error) {
      logger.error('Error in upgrade notification method:', error);
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
    // Deprecated / unused method, since we now use imported getUserTier directly
    return getUserTier(member) as 'member' | 'trial' | 'vip' | 'vip_plus' | 'capper' | 'staff' | 'admin' | 'owner';
  }
}