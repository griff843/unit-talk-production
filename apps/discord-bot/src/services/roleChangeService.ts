import { GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { logger } from '../utils/logger';
import { botConfig } from '../config';
import { getUserTier, handleRoleUpgradeWithDelay, setOptimisticTier } from '../utils/roleUtils';
import { Client } from 'discord.js';
import { VIPNotificationService } from './vipNotificationService';
import { OnboardingService } from './onboardingService';

export class RoleChangeService {
  private client: Client;
  private vipNotificationService: VIPNotificationService;
  private onboardingService: OnboardingService;
  private recentUpgrades: Map<string, number> = new Map();
  private readonly UPGRADE_COOLDOWN = 5 * 60 * 1000; // 5 minutes

  constructor(
    client: Client,
    vipNotificationService: VIPNotificationService,
    onboardingService: OnboardingService
  ) {
    this.client = client;
    this.vipNotificationService = vipNotificationService;
    this.onboardingService = onboardingService;
  }

  /**
   * Handle role changes for a guild member
   */
  async handleRoleChange(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    const oldTier = this.getUserTier(oldMember);
    const newTier = this.getUserTier(newMember);
    logger.info('[ROLE_CHANGE] handleRoleChange called', {
      userId: newMember.id,
      username: newMember.user.username,
      oldTier,
      newTier,
    });

    if (this.isUpgrade(oldTier, newTier)) {
      const lastUpgrade = this.recentUpgrades.get(newMember.id);
      const now = Date.now();
      logger.info('[ROLE_CHANGE] Upgrade detected', {
        userId: newMember.id,
        username: newMember.user.username,
        oldTier,
        newTier,
        lastUpgrade,
        now,
        cooldown: this.UPGRADE_COOLDOWN,
      });
      if (lastUpgrade && now - lastUpgrade < this.UPGRADE_COOLDOWN && oldTier !== 'member') {
        logger.info('[ROLE_CHANGE] Skipping upgrade onboarding - recent upgrade detected', {
          userId: newMember.id,
          username: newMember.user.username,
          lastUpgrade,
          now,
          cooldown: this.UPGRADE_COOLDOWN,
        });
        return;
      }
      this.recentUpgrades.set(newMember.id, now);
      this.cleanupRecentUpgrades();
      await this.handleTierUpgrade(newMember, oldTier, newTier);
    } else if (this.isDowngrade(oldTier, newTier)) {
      logger.info('[ROLE_CHANGE] Downgrade detected', {
        userId: newMember.id,
        username: newMember.user.username,
        oldTier,
        newTier,
      });
      await this.handleTierDowngrade(newMember, oldTier, newTier);
    } else {
      logger.info('[ROLE_CHANGE] No upgrade or downgrade detected', {
        userId: newMember.id,
        username: newMember.user.username,
        oldTier,
        newTier,
      });
    }
  }

  /**
   * Clean up old entries from recentUpgrades
   */
  private cleanupRecentUpgrades(): void {
    const now = Date.now();
    for (const [userId, timestamp] of this.recentUpgrades.entries()) {
      if (now - timestamp > this.UPGRADE_COOLDOWN) {
        this.recentUpgrades.delete(userId);
      }
    }
  }

  /**
   * Check if tier change is an upgrade
   */
  private isUpgrade(oldTier: string, newTier: string): boolean {
    const tierOrder = ['member', 'vip', 'vip_plus'];
    return tierOrder.indexOf(newTier) > tierOrder.indexOf(oldTier);
  }

  /**
   * Check if tier change is a downgrade
   */
  private isDowngrade(oldTier: string, newTier: string): boolean {
    const tierOrder = ['member', 'vip', 'vip_plus'];
    return tierOrder.indexOf(newTier) < tierOrder.indexOf(oldTier);
  }

  /**
   * Handle tier upgrade with enhanced processing
   */
  private async handleTierUpgrade(
    member: GuildMember,
    oldTier: string,
    newTier: string
  ): Promise<void> {
    logger.info('[ROLE_CHANGE] handleTierUpgrade called', {
      userId: member.id,
      username: member.user.username,
      oldTier,
      newTier,
    });
    try {
      logger.info('[ROLE_CHANGE] Calling onboardingService.handleUserOnboarding', {
        userId: member.id,
        username: member.user.username,
        newTier,
      });
      await this.onboardingService.handleUserOnboarding(member.user, newTier, false);
      logger.info('[ROLE_CHANGE] Called onboardingService.handleUserOnboarding successfully', {
        userId: member.id,
        username: member.user.username,
        newTier,
      });
      await this._notifyAdminsOfTierChange(member, oldTier, newTier);
    } catch (error) {
      logger.error('[ROLE_CHANGE] Error in handleTierUpgrade', {
        userId: member.id,
        username: member.user.username,
        oldTier,
        newTier,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Handle tier downgrade with enhanced processing
   */
  private async handleTierDowngrade(
    member: GuildMember,
    oldTier: string,
    newTier: string
  ): Promise<void> {
    try {
      logger.info(`🔽 Processing tier downgrade for ${member.user.tag}`, {
        userId: member.id,
        oldTier,
        newTier,
      });

      // Wait a moment for Discord to fully propagate the role change
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Only notify admins for downgrades, no onboarding needed
      await this._notifyAdminsOfTierChange(member, oldTier, newTier);
    } catch (error) {
      logger.error(`Error processing tier downgrade for ${member.user.tag}:`, {
        userId: member.id,
        oldTier,
        newTier,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Notify admins of user upgrade
   */
  private async _notifyAdminsOfUpgrade(
    member: GuildMember,
    oldTier: string,
    newTier: string
  ): Promise<void> {
    try {
      const adminChannel = this.client.channels.cache.get(botConfig.channels.admin) as TextChannel;
      if (!adminChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('🔔 Member Upgrade Notification')
        .setDescription(
          `${member.user.username} has been upgraded from ${oldTier.toUpperCase()} to ${newTier.toUpperCase()}`
        )
        .setColor(0x00ff00)
        .addFields(
          {
            name: 'User Details',
            value: `**Username:** ${member.user.username}\n**Display Name:** ${member.displayName || 'N/A'}\n**User ID:** ${member.id}`,
            inline: false,
          },
          {
            name: 'Upgrade Details',
            value: `**Previous Tier:** ${oldTier.toUpperCase()}\n**New Tier:** ${newTier.toUpperCase()}\n**Upgraded At:** <t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: false,
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
   * Notify admins of user downgrade
   */
  private async _notifyAdminsOfDowngrade(
    member: GuildMember,
    oldTier: string,
    newTier: string
  ): Promise<void> {
    try {
      const adminChannel = this.client.channels.cache.get(botConfig.channels.admin) as TextChannel;
      if (!adminChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('🔔 Member Downgrade Notification')
        .setDescription(
          `${member.user.username} has been downgraded from ${oldTier.toUpperCase()} to ${newTier.toUpperCase()}`
        )
        .setColor(0xff0000)
        .addFields(
          {
            name: 'User Details',
            value: `**Username:** ${member.user.username}\n**Display Name:** ${member.displayName || 'N/A'}\n**User ID:** ${member.id}`,
            inline: false,
          },
          {
            name: 'Downgrade Details',
            value: `**Previous Tier:** ${oldTier.toUpperCase()}\n**New Tier:** ${newTier.toUpperCase()}\n**Downgraded At:** <t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: false,
          }
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

      await adminChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Error notifying admins of downgrade:', error);
    }
  }

  /**
   * Notify admins of user tier change
   */
  private async _notifyAdminsOfTierChange(
    member: GuildMember,
    oldTier: string,
    newTier: string
  ): Promise<void> {
    try {
      const adminChannel = this.client.channels.cache.get(botConfig.channels.admin) as TextChannel;
      if (!adminChannel) return;

      const embed = new EmbedBuilder()
        .setTitle('🔔 Member Tier Change Notification')
        .setDescription(
          `${member.user.username} has been changed from ${oldTier.toUpperCase()} to ${newTier.toUpperCase()}`
        )
        .setColor(0xffff00)
        .addFields(
          {
            name: 'User Details',
            value: `**Username:** ${member.user.username}\n**Display Name:** ${member.displayName || 'N/A'}\n**User ID:** ${member.id}`,
            inline: false,
          },
          {
            name: 'Tier Change Details',
            value: `**Previous Tier:** ${oldTier.toUpperCase()}\n**New Tier:** ${newTier.toUpperCase()}\n**Changed At:** <t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: false,
          }
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

      await adminChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Error notifying admins of tier change:', error);
    }
  }

  /**
   * Get user's current tier based on roles
   */
  getUserTier(member: GuildMember): string {
    try {
      const roles = member.roles.cache;
      const config = botConfig.roles;

      // Log roles for debugging
      logger.debug(`Checking roles for ${member.user.username}:`, {
        roles: roles.map(role => ({
          id: role.id,
          name: role.name,
        })),
      });

      // Check roles in order of precedence using role IDs
      if (roles.has(config.vipPlus)) {
        return 'vip_plus';
      }

      if (roles.has(config.vip)) {
        return 'vip';
      }

      // Default to member
      return 'member';
    } catch (error) {
      logger.error('Error determining member tier:', {
        error: error instanceof Error ? error.message : String(error),
        userId: member.id,
        username: member.user.username,
        roles: member.roles.cache.map(r => r.name).join(', '),
      });
      return 'member';
    }
  }
}
