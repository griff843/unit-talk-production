import {
  Client,
  Message,
  GuildMember,
  PartialGuildMember,
  ThreadChannel,
  PartialMessage,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
  VoiceState,
} from 'discord.js';
import { SupabaseService } from '../services/supabase';
import { DMService } from '../services/dmService';
import { OnboardingService } from '../services/onboardingService';
import { VIPNotificationService } from '../services/vipNotificationService';
import { RoleChangeService } from '../services/roleChangeService';
import { UserTier } from '../types/index';
import { logger } from '../utils/logger';
import {
  toISOString,
  toDate,
  getHours,
  getMinutes,
  getFullYear,
  getMonth,
  getDate,
  setDate,
  toLocaleDateString,
} from '../utils/dateUtils';

export class EventHandler {
  private client: Client;
  private supabaseService: SupabaseService;
  private dmService: DMService;
  private onboardingService: OnboardingService;
  private vipNotificationService: VIPNotificationService;
  private roleChangeService: RoleChangeService;
  private recentOnboarding: Map<string, number> = new Map(); // Track recent onboarding to prevent duplicates

  constructor(
    client: Client,
    supabaseService: SupabaseService,
    dmService: DMService,
    onboardingService: OnboardingService,
    vipNotificationService: VIPNotificationService,
    roleChangeService: RoleChangeService
  ) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.dmService = dmService;
    this.onboardingService = onboardingService;
    this.vipNotificationService = vipNotificationService;
    this.roleChangeService = roleChangeService;

    logger.info('EventHandler initialized with all required services');
  }

  /**
   * Check if user has recently gone through onboarding
   */
  private hasRecentOnboarding(userId: string): boolean {
    const lastOnboarding = this.recentOnboarding.get(userId);
    if (!lastOnboarding) return false;

    // Prevent duplicate onboarding within 5 minutes
    const timeSinceLastOnboarding = Date.now() - lastOnboarding;
    return timeSinceLastOnboarding < 5 * 60 * 1000;
  }

  /**
   * Track onboarding for a user
   */
  private trackOnboarding(userId: string): void {
    this.recentOnboarding.set(userId, Date.now());

    // Clean up old entries after 10 minutes
    setTimeout(
      () => {
        this.recentOnboarding.delete(userId);
      },
      10 * 60 * 1000
    );
  }

  /**
   * Handle message creation events
   */
  async handleMessage(message: Message): Promise<void> {
    if (message.author.bot) return;

    try {
      // Update user activity
      await this.updateUserActivity(message.author.id, message.guildId!);

      // Track message for analytics
      // await this.services.advancedAnalyticsService.trackMessage(message); // This line was removed as per the new_code

      // Check for automated thread triggers
      await this.checkThreadTriggers(message);

      // Log message event
      // await this.services.advancedAnalyticsService.logEvent({ // This line was removed as per the new_code
      //   type: 'message_created',
      //   userId: message.author.id,
      //   channelId: message.channelId,
      //   guildId: message.guildId,
      //   data: {
      //     messageId: message.id,
      //     content: message.content.substring(0, 100), // First 100 chars for context
      //     attachments: message.attachments.size,
      //     embeds: message.embeds.length
      //   }
      // }); // This line was removed as per the new_code
    } catch (error) {
      logger.error('Error handling message event:', error);
    }
  }

  /**
   * Handle member join events
   */
  async handleMemberJoin(member: GuildMember): Promise<void> {
    try {
      // Create user profile
      await this.supabaseService.createUserProfile({
        discord_id: member.id,
        username: member.user.username,
        tier: 'member',
      });

      // Track join event
      // await this.services.advancedAnalyticsService.logEvent({ // This line was removed as per the new_code
      //   type: 'member_joined',
      //   userId: member.id,
      //   guildId: member.guild.id,
      //   data: {
      //     username: member.user.username,
      //     joinedAt: member.joinedAt?.toISOString(),
      //     accountCreated: member.user.(typeof createdAt === "string" ? createdAt : new Date(createdAt).toISOString())
      //   }
      // }); // This line was removed as per the new_code

      logger.info(`New member joined: ${member.user.username} (${member.id})`);

      // Only trigger onboarding if no recent onboarding
      if (!this.hasRecentOnboarding(member.id)) {
        const userTier = this.roleChangeService.getUserTier(member);
        await this.onboardingService.handleUserOnboarding(member.user, userTier);
        this.trackOnboarding(member.id);
      } else {
        logger.info(`Skipping onboarding for ${member.user.username} - recent onboarding detected`);
      }
    } catch (error) {
      logger.error('Error handling member join:', error);
    }
  }

  /**
   * Handle presence updates
   */
  async handlePresenceUpdate(oldPresence: any, newPresence: any): Promise<void> {
    try {
      const userId = newPresence.userId;
      if (!userId) return;

      // Track status changes for active users
      if (oldPresence?.status !== newPresence.status) {
        // await this.services.advancedAnalyticsService.logEvent({ // This line was removed as per the new_code
        //   type: 'presence_updated',
        //   userId,
        //   guildId: newPresence.guild?.id,
        //   data: {
        //     oldStatus: oldPresence?.status,
        //     newStatus: newPresence.status,
        //     activities: newPresence.activities?.map((a: any) => a.name)
        //   }
        // }); // This line was removed as per the new_code
      }
    } catch (error) {
      logger.error('Error handling presence update:', error);
    }
  }

  /**
   * Handle member updates (role changes, nickname changes, etc.)
   */
  async handleMemberUpdate(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember
  ): Promise<void> {
    logger.info('[DEBUG] Entered handleMemberUpdate', {
      oldId: oldMember.id,
      newId: newMember.id,
      oldUsername: (oldMember as any).user?.username,
      newUsername: newMember.user.username,
    });
    try {
      // Get tiers before role change handling
      const oldTier = this.roleChangeService.getUserTier(oldMember as GuildMember);
      const newTier = this.roleChangeService.getUserTier(newMember);

      // Handle role changes first
      if (oldTier !== newTier) {
        logger.info(
          `Tier change detected: ${oldTier} -> ${newTier} for ${newMember.user.username}`,
          {
            userId: newMember.id,
            username: newMember.user.username,
            oldTier,
            newTier,
            roles: newMember.roles.cache.map(r => ({ id: r.id, name: r.name })),
          }
        );

        try {
          // Update database first
          await this.supabaseService.updateUserProfile(newMember.id, {
            membership_tier: newTier,
            updated_at: toISOString(new Date()),
          });

          // Only trigger onboarding for upgrades
          if (this.isUpgrade(oldTier, newTier)) {
            if (!this.hasRecentOnboarding(newMember.id)) {
              logger.info(
                `Triggering onboarding for tier upgrade: ${newTier} for ${newMember.user.username}`
              );
              await this.onboardingService.handleUserOnboarding(newMember.user, newTier);
              this.trackOnboarding(newMember.id);
            } else {
              logger.info(
                `Skipping onboarding for ${newMember.user.username} - recent onboarding detected`
              );
            }
          } else {
            logger.info(
              `Skipping onboarding for ${newMember.user.username} - not an upgrade (${oldTier} -> ${newTier})`
            );
          }

          // Handle role change notifications through RoleChangeService
          await this.roleChangeService.handleRoleChange(oldMember as GuildMember, newMember);
        } catch (error) {
          logger.error('Error handling tier change:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            userId: newMember.id,
            username: newMember.user.username,
            oldTier,
            newTier,
          });
          throw error; // Re-throw to be caught by outer try-catch
        }
      }

      // Handle nickname changes
      if (oldMember.displayName !== newMember.displayName) {
        await this.supabaseService.updateUserProfile(newMember.id, {
          username: newMember.displayName || newMember.user.username,
          updated_at: toISOString(new Date()),
        });

        logger.info(
          `User nickname changed: ${newMember.user.username} (${oldMember.displayName} → ${newMember.displayName})`
        );
      }
    } catch (error) {
      logger.error('Error handling member update:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: newMember.id,
        username: newMember.user.username,
        oldTier: this.roleChangeService.getUserTier(oldMember as GuildMember),
        newTier: this.roleChangeService.getUserTier(newMember),
      });
    }
  }

  /**
   * Handle member leave events
   */
  async handleMemberLeave(member: GuildMember | PartialGuildMember): Promise<void> {
    try {
      // Mark user as inactive
      await this.supabaseService.updateUserStatus(member.id, false);

      // Track leave event
      // await this.services.advancedAnalyticsService.logEvent({ // This line was removed as per the new_code
      //   type: 'member_left',
      //   userId: member.id,
      //   guildId: member.guild.id,
      //   data: {
      //     username: member.user?.username,
      //     leftAt: toISOString(new Date()).toISOString()
      //   }
      // }); // This line was removed as per the new_code

      logger.info(`Member left: ${member.user?.username} (${member.id})`);
    } catch (error) {
      logger.error('Error handling member leave:', error);
    }
  }

  /**
   * Handle thread creation events
   */
  async handleThreadCreate(thread: ThreadChannel): Promise<void> {
    try {
      // Track thread creation
      // await this.services.advancedAnalyticsService.incrementThreadCount(); // This line was removed as per the new_code

      // Log thread creation event
      // await this.services.advancedAnalyticsService.logEvent({ // This line was removed as per the new_code
      //   type: 'thread_created',
      //   channelId: thread.id,
      //   guildId: thread.guildId,
      //   data: {
      //     threadName: thread.name,
      //     parentChannelId: thread.parentId,
      //     ownerId: thread.ownerId,
      //     autoArchiveDuration: thread.autoArchiveDuration
      //   }
      // }); // This line was removed as per the new_code

      // Check if this thread should be linked to other channels
      // await this.services.automatedThreadService.handleThreadCreation(thread); // This line was removed as per the new_code

      logger.info(`Thread created: ${thread.name} (${thread.id})`);
    } catch (error) {
      logger.error('Error handling thread creation:', error);
    }
  }

  /**
   * Handle message deletion events
   */
  async handleMessageDelete(message: Message | PartialMessage): Promise<void> {
    try {
      // Log message deletion
      // await this.services.advancedAnalyticsService.logEvent({ // This line was removed as per the new_code
      //   type: 'message_deleted',
      //   userId: message.author?.id,
      //   channelId: message.channelId,
      //   guildId: message.guildId,
      //   data: {
      //     messageId: message.id,
      //     deletedAt: toISOString(new Date()).toISOString()
      //   }
      // }); // This line was removed as per the new_code
    } catch (error) {
      logger.error('Error handling message deletion:', error);
    }
  }

  /**
   * Handle message edit events
   */
  async handleMessageUpdate(
    oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage
  ): Promise<void> {
    try {
      // Log message edit
      // await this.services.advancedAnalyticsService.logEvent({ // This line was removed as per the new_code
      //   type: 'message_edited',
      //   userId: newMessage.author?.id,
      //   channelId: newMessage.channelId,
      //   guildId: newMessage.guildId,
      //   data: {
      //     messageId: newMessage.id,
      //     editedAt: toISOString(new Date()).toISOString(),
      //     oldContent: oldMessage.content?.substring(0, 100),
      //     newContent: newMessage.content?.substring(0, 100)
      //   }
      // }); // This line was removed as per the new_code
    } catch (error) {
      logger.error('Error handling message update:', error);
    }
  }

  /**
   * Update user activity in database
   */
  private async updateUserActivity(userId: string, _guildId: string): Promise<void> {
    try {
      await this.supabaseService.updateUserActivity(userId, {
        lastActive: toISOString(new Date()),
        totalMessages: { increment: 1 },
        activity_score: { increment: 1 },
      });
    } catch (error) {
      logger.error('Error updating user activity:', error);
    }
  }

  /**
   * Check for automated thread triggers
   */
  private async checkThreadTriggers(message: Message): Promise<void> {
    try {
      // Check if message should trigger thread creation
      // const shouldCreateThread = await this.services.automatedThreadService.shouldCreateThread(message); // This line was removed as per the new_code
      // if (shouldCreateThread) {
      //   await this.services.automatedThreadService.createGameThread(message);
      // }
    } catch (error) {
      logger.error('Error checking thread triggers:', error);
    }
  }

  /**
   * Handle reaction add events
   */
  async handleReactionAdd(reaction: any, user: any): Promise<void> {
    if (user.bot) return;

    try {
      // Update user reaction count
      await this.supabaseService.updateUserActivity(user.id, {
        totalReactions: { increment: 1 },
        activity_score: { increment: 0.5 },
      });

      // Track reaction for analytics
      // await this.services.advancedAnalyticsService.logEvent({ // This line was removed as per the new_code
      //   type: 'reaction_added',
      //   userId: user.id,
      //   channelId: reaction.message.channelId,
      //   guildId: reaction.message.guildId,
      //   data: {
      //     messageId: reaction.message.id,
      //     emoji: reaction.emoji.name,
      //     emojiId: reaction.emoji.id
      //   }
      // }); // This line was removed as per the new_code
    } catch (error) {
      logger.error('Error handling reaction add:', error);
    }
  }

  /**
   * Handle voice state updates
   */
  async handleVoiceStateUpdate(oldState: any, newState: any): Promise<void> {
    try {
      const userId = newState.member?.id;
      if (!userId) return;

      // Track voice activity
      if (!oldState.channelId && newState.channelId) {
        // User joined voice channel
        // await this.services.advancedAnalyticsService.logEvent({ // This line was removed as per the new_code
        //   type: 'voice_joined',
        //   userId,
        //   channelId: newState.channelId,
        //   guildId: newState.guild.id,
        //   data: {
        //     channelName: newState.channel?.name
        //   }
        // }); // This line was removed as per the new_code
      } else if (oldState.channelId && !newState.channelId) {
        // User left voice channel
        // await this.services.advancedAnalyticsService.logEvent({ // This line was removed as per the new_code
        //   type: 'voice_left',
        //   userId,
        //   channelId: oldState.channelId,
        //   guildId: oldState.guild.id,
        //   data: {
        //     channelName: oldState.channel?.name
        //   }
        // }); // This line was removed as per the new_code
      }
    } catch (error) {
      logger.error('Error handling voice state update:', error);
    }
  }

  /**
   * Check if tier change is an upgrade
   */
  private isUpgrade(oldTier: string, newTier: string): boolean {
    const tierOrder = ['member', 'vip', 'vip_plus'];
    const oldIndex = tierOrder.indexOf(oldTier);
    const newIndex = tierOrder.indexOf(newTier);
    return newIndex > oldIndex;
  }
}
