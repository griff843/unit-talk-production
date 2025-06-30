import { GuildMember, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../utils/logger';
import { getUserTier } from '../utils/roleUtils';

export class OnboardingService {
  private recentOnboardings: Map<string, number> = new Map(); // userId -> timestamp
  private readonly ONBOARDING_COOLDOWN = 60000; // 1 minute cooldown

  constructor() {
    // Constructor no longer needs client parameter
  }

  /**
   * Handle member onboarding based on their tier
   */
  async handleMemberOnboarding(member: GuildMember, isNewMember: boolean = false): Promise<void> {
    try {
      // Check cooldown to prevent duplicate messages
      const now = Date.now();
      const lastOnboarding = this.recentOnboardings.get(member.id);

      if (lastOnboarding && (now - lastOnboarding) < this.ONBOARDING_COOLDOWN) {
        logger.info(`Skipping onboarding for ${member.user.tag} - cooldown active`);
        return;
      }

      // Set cooldown
      this.recentOnboardings.set(member.id, now);

      const userTier = getUserTier(member);
      logger.info(`Handling onboarding for ${member.user.tag} with tier: ${userTier}`);

      // Get appropriate welcome configuration
      const welcomeConfig = this.getWelcomeConfig(userTier, isNewMember);
      
      if (!welcomeConfig) {
        logger.warn(`No welcome config found for tier: ${userTier}`);
        return;
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(welcomeConfig.title)
        .setDescription(welcomeConfig.description)
        .setColor(welcomeConfig.color)
        .setTimestamp();

      // Add fields if they exist
      if (welcomeConfig.fields) {
        embed.addFields(welcomeConfig.fields);
      }

      // Create action row with buttons if they exist
      const components = [];
      if (welcomeConfig.buttons && welcomeConfig.buttons.length > 0) {
        const actionRow = new ActionRowBuilder<ButtonBuilder>();
        
        for (const buttonConfig of welcomeConfig.buttons) {
          const button = new ButtonBuilder()
            .setCustomId(buttonConfig.customId)
            .setLabel(buttonConfig.label)
            .setStyle(buttonConfig.style);
          
          if (buttonConfig.emoji) {
            button.setEmoji(buttonConfig.emoji);
          }
          
          actionRow.addComponents(button);
        }
        
        components.push(actionRow);
      }

      // Send DM to user
      try {
        const dmMessage: any = { embeds: [embed] };
        if (components.length > 0) {
          dmMessage.components = components;
        }
        
        await member.send(dmMessage);
        logger.info(`✅ Sent onboarding DM to ${member.user.tag} (${userTier})`);
      } catch (dmError) {
        logger.warn(`Failed to send DM to ${member.user.tag}:`, dmError);
        
        // Try to send in a welcome channel as fallback
        const welcomeChannel = member.guild.channels.cache.find(
          channel => channel.name.includes('welcome') || channel.name.includes('general')
        );
        
        if (welcomeChannel && welcomeChannel.isTextBased()) {
          const publicMessage: any = { 
            content: `Welcome ${member}!`, 
            embeds: [embed] 
          };
          if (components.length > 0) {
            publicMessage.components = components;
          }
          
          await welcomeChannel.send(publicMessage);
          logger.info(`✅ Sent welcome message in channel for ${member.user.tag}`);
        }
      }

    } catch (error) {
      logger.error('Error in handleMemberOnboarding:', error);
    }
  }

  /**
   * Handle role changes for existing members
   */
  async handleRoleChange(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
    try {
      const oldTier = getUserTier(oldMember);
      const newTier = getUserTier(newMember);
      
      // Only trigger onboarding if tier actually changed and upgraded
      if (oldTier !== newTier && this.isTierUpgrade(oldTier, newTier)) {
        logger.info(`Member ${newMember.user.tag} upgraded from ${oldTier} to ${newTier}`);
        await this.handleMemberOnboarding(newMember, false);
      }
    } catch (error) {
      logger.error('Error in handleRoleChange:', error);
    }
  }

  /**
   * Handle new member joining
   */
  async handleNewMember(member: GuildMember): Promise<void> {
    try {
      // Wait a moment for roles to be assigned
      setTimeout(async () => {
        await this.handleMemberOnboarding(member, true);
      }, 2000);
    } catch (error) {
      logger.error('Error in handleNewMember:', error);
    }
  }

  /**
   * Manually trigger onboarding for a member (for testing/admin purposes)
   */
  async triggerOnboarding(member: GuildMember): Promise<void> {
    try {
      await this.handleMemberOnboarding(member, false);
      logger.info(`✅ Manually triggered onboarding for ${member.user.tag}`);
    } catch (error) {
      logger.error('Error in triggerOnboarding:', error);
      throw error;
    }
  }

  /**
   * Check if a tier change represents an upgrade
   */
  private isTierUpgrade(oldTier: string, newTier: string): boolean {
    const tierHierarchy = ['member', 'trial', 'vip', 'vip_plus', 'capper', 'staff', 'admin', 'owner'];
    const oldIndex = tierHierarchy.indexOf(oldTier);
    const newIndex = tierHierarchy.indexOf(newTier);
    
    return newIndex > oldIndex;
  }

  /**
   * Get welcome configuration based on user tier
   */
  private getWelcomeConfig(tier: string, isNewMember: boolean): any {
    // Map tier names to config keys
    const tierConfigMap: Record<string, string> = {
      'member': 'BASIC',
      'trial': 'TRIAL', 
      'vip': 'VIP',
      'vip_plus': 'VIP_PLUS',
      'capper': 'CAPPER',
      'staff': 'STAFF',
      'admin': 'STAFF',
      'owner': 'STAFF'
    };

    const configKey = tierConfigMap[tier] || 'BASIC';

    const configs: Record<string, any> = {
      'BASIC': {
        title: '👋 Welcome to Unit Talk!',
        description: isNewMember
          ? 'Welcome to the Unit Talk community! We\'re excited to have you here.'
          : 'Thanks for joining Unit Talk!',
        color: 0x7289DA,
        fields: [
          {
            name: '🚀 Get Started',
            value: '• Check out our FAQ section\n• Browse community discussions\n• See what VIP members are saying\n• Start your VIP trial for full access to picks!',
            inline: false
          }
        ],
        buttons: [
          {
            customId: 'view_faq',
            label: 'View FAQ',
            style: ButtonStyle.Secondary,
            emoji: '❓'
          },
          {
            customId: 'start_vip_trial',
            label: 'Start VIP Trial',
            style: ButtonStyle.Success,
            emoji: '🚀'
          }
        ]
      },
      'TRIAL': {
        title: '🚀 Welcome to Unit Talk!',
        description: 'Welcome to the Unit Talk community! Start your journey with our expert picks and analysis.',
        color: 0xFFA500,
        fields: [
          {
            name: '🎯 Getting Started',
            value: '• Check out our FAQ section\n• Browse daily picks in Capper Corner\n• Join community discussions\n• Consider upgrading to VIP for full access',
            inline: false
          }
        ],
        buttons: [
          {
            customId: 'view_trial_features',
            label: 'Getting Started Guide',
            style: ButtonStyle.Primary,
            emoji: '🎯'
          },
          {
            customId: 'upgrade_to_vip',
            label: 'Upgrade to VIP',
            style: ButtonStyle.Success,
            emoji: '⭐'
          },
          {
            customId: 'upgrade_to_vip_plus',
            label: 'Upgrade to VIP+',
            style: ButtonStyle.Success,
            emoji: '💎'
          }
        ]
      },
      'VIP': {
        title: '⭐ Welcome VIP Member!',
        description: 'You now have access to all VIP features and benefits! Let\'s get you started.',
        color: 0xFFD700,
        fields: [
          {
            name: '🎯 VIP Benefits',
            value: '• Access to all capper picks\n• Exclusive VIP channels\n• Priority customer support\n• Advanced analytics\n• Early access to new features',
            inline: false
          },
          {
            name: '📍 Next Steps',
            value: '1. Check out <#1387837517298139270> for daily picks\n2. Enable notifications for your favorite cappers\n3. Join VIP discussions in exclusive channels',
            inline: false
          }
        ],
        buttons: [
          {
            customId: 'view_vip_guide',
            label: 'VIP Guide',
            style: ButtonStyle.Primary,
            emoji: '📖'
          },
          {
            customId: 'setup_notifications',
            label: 'Setup Notifications',
            style: ButtonStyle.Secondary,
            emoji: '🔔'
          }
        ]
      },
      'VIP_PLUS': {
        title: '✨ Welcome to Unit Talk VIP+ Elite!',
        description: 'You have unlocked the highest tier with exclusive VIP+ features and priority access!',
        color: 0x9932CC,
        fields: [
          {
            name: '🏆 Elite Access',
            value: '• All VIP benefits\n• Advanced analytics and insights\n• Priority support\n• Exclusive VIP+ channels\n• Early access to new features',
            inline: false
          },
          {
            name: '📍 Next Steps',
            value: '1. Explore VIP+ exclusive channels\n2. Access advanced analytics\n3. Connect with other elite members',
            inline: false
          }
        ],
        buttons: [
          {
            customId: 'view_vip_plus_guide',
            label: 'VIP+ Guide',
            style: ButtonStyle.Primary,
            emoji: '💎'
          },
          {
            customId: 'access_elite_features',
            label: 'Elite Features',
            style: ButtonStyle.Success,
            emoji: '⭐'
          },
          {
            customId: 'vip_plus_tour',
            label: 'Take Tour',
            style: ButtonStyle.Secondary,
            emoji: '🎯'
          },
          {
            customId: 'setup_vip_plus_notifications',
            label: 'Setup Notifications',
            style: ButtonStyle.Secondary,
            emoji: '🔔'
          }
        ]
      },
      'CAPPER': {
        title: '🎯 Welcome UT Capper!',
        description: 'You\'ve been granted capper privileges! Ready to share your expertise with the community.',
        color: 0xE67E22,
        fields: [
          {
            name: '🚀 Getting Started',
            value: 'Complete your capper setup and start building your reputation in the community!',
            inline: false
          },
          {
            name: '📊 Track Your Performance',
            value: 'All your picks are automatically tracked for wins, losses, ROI, and leaderboard rankings.',
            inline: false
          }
        ],
        buttons: [
          {
            customId: 'capper_guide',
            label: 'Capper Guide',
            style: ButtonStyle.Primary,
            emoji: '📋'
          },
          {
            customId: 'create_capper_thread',
            label: 'Create Threads',
            style: ButtonStyle.Success,
            emoji: '🧵'
          },
          {
            customId: 'capper_practice_pick',
            label: 'Practice Pick',
            style: ButtonStyle.Secondary,
            emoji: '🎯'
          },
          {
            customId: 'view_leaderboard',
            label: 'View Leaderboard',
            style: ButtonStyle.Secondary,
            emoji: '🏆'
          },
          {
            customId: 'capper_support',
            label: 'Get Support',
            style: ButtonStyle.Secondary,
            emoji: '💬'
          }
        ]
      },
      'STAFF': {
        title: '👮 Welcome Staff Member!',
        description: 'You have staff privileges. Welcome to the Unit Talk team!',
        color: 0x00FF00,
        fields: [
          {
            name: '🛡️ Staff Responsibilities',
            value: '• Help moderate the community\n• Assist members with questions\n• Maintain a positive environment\n• Report issues to admins',
            inline: false
          }
        ],
        buttons: [
          {
            customId: 'staff_guide',
            label: 'Staff Guide',
            style: ButtonStyle.Primary,
            emoji: '📋'
          }
        ]
      }
    };

    return configs[configKey] || configs['BASIC'];
  }

  /**
   * Get onboarding status for a user
   */
  async getOnboardingStatus(userId: string): Promise<any | null> {
    try {
      // Simple implementation - in a real app this would check database
      return null;
    } catch (error) {
      logger.error('Failed to get onboarding status', { userId, error });
      return null;
    }
  }

  /**
   * Start onboarding for a guild member
   */
  async startOnboarding(member: GuildMember): Promise<void> {
    try {
      await this.handleMemberOnboarding(member, true);
    } catch (error) {
      logger.error('Failed to start onboarding', { userId: member.id, error });
      throw error;
    }
  }

  /**
   * Reset onboarding progress for a user
   */
  async resetOnboardingProgress(userId: string): Promise<void> {
    try {
      // Remove from recent onboardings to allow immediate re-onboarding
      this.recentOnboardings.delete(userId);
      logger.info(`Reset onboarding progress for user: ${userId}`);
    } catch (error) {
      logger.error('Failed to reset onboarding progress', { userId, error });
      throw error;
    }
  }

  /**
   * Send a DM to a user
   */
  async sendDM(userId: string, message: string): Promise<boolean> {
    try {
      // Note: This method would need a Discord client instance to actually send DMs
      // For now, we'll just log the action and return true
      logger.info(`Would send DM to user ${userId}: ${message}`);
      return true;
    } catch (error) {
      logger.error('Failed to send DM', { userId, message, error });
      return false;
    }
  }
}