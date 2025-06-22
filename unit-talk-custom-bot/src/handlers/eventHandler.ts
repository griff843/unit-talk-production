import {
  Client,
  Message,
  GuildMember,
  PartialGuildMember
} from 'discord.js';
import { SupabaseService } from '../services/supabase';
import { PermissionsService } from '../services/permissions';
import { logger } from '../utils/logger';

export class EventHandler {
  private supabaseService: SupabaseService;
  private permissionsService: PermissionsService;
  private services: any;

  constructor(
    client: Client,
    supabaseService: SupabaseService,
    permissionsService: PermissionsService,
    services: any
  ) {
    this.supabaseService = supabaseService;
    this.permissionsService = permissionsService;
    this.services = services;
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
      await this.services.advancedAnalyticsService.trackMessage(message);
      
      // Check for automated thread triggers
      await this.checkThreadTriggers(message);
      
      // Log message event
      await this.services.advancedAnalyticsService.logEvent({
        type: 'message_created',
        userId: message.author.id,
        channelId: message.channelId,
        guildId: message.guildId,
        data: {
          messageId: message.id,
          content: message.content.substring(0, 100), // First 100 chars for context
          attachments: message.attachments.size,
          embeds: message.embeds.length
        }
      });

    } catch (error) {
      logger.error('Error handling message event:', error);
    }
  }

  /**
   * Handle member join events
   */
  async handleMemberJoin(member: GuildMember): Promise<void> {
    try {
      // Create or update user profile
      await this.supabaseService.createOrUpdateUserProfile(member.id, {
        discord_id: member.id,
        username: member.user.username,
        display_name: member.displayName || member.user.displayName,
        tier: 'member',
        is_active: true,
        total_messages: 0,
        total_reactions: 0,
        activity_score: 0,
        last_active: new Date(),
        metadata: {
          joinedAt: member.joinedAt?.toISOString(),
          avatar: member.user.avatarURL(),
          bot: member.user.bot
        }
      });

      // Send welcome notification
      await this.services.vipNotificationService.sendWelcomeNotification(member);

      // Track join event
      await this.services.advancedAnalyticsService.logEvent({
        type: 'member_joined',
        userId: member.id,
        guildId: member.guild.id,
        data: {
          username: member.user.username,
          joinedAt: member.joinedAt?.toISOString(),
          accountCreated: member.user.createdAt.toISOString()
        }
      });

      logger.info(`New member joined: ${member.user.username} (${member.id})`);

    } catch (error) {
      logger.error('Error handling member join:', error);
    }
  }

  /**
   * Handle member update events (role changes, etc.)
   */
  async handleMemberUpdate(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember): Promise<void> {
    try {
      // Check for role changes that affect tier
      const oldTier = this.permissionsService.getUserTier(oldMember as GuildMember);
      const newTier = this.permissionsService.getUserTier(newMember);

      if (oldTier !== newTier) {
        // Update user tier in database
        await this.supabaseService.updateUserTier(newMember.id, newTier);

        // Send tier change notification
        await this.services.vipNotificationService.handleTierChange(newMember, oldTier, newTier);

        // Track tier change event
        await this.services.advancedAnalyticsService.logEvent({
          type: 'tier_changed',
          userId: newMember.id,
          guildId: newMember.guild.id,
          data: {
            oldTier,
            newTier,
            username: newMember.user.username
          }
        });

        logger.info(`User tier changed: ${newMember.user.username} (${oldTier} -> ${newTier})`);
      }

      // Update user profile with latest info
      await this.supabaseService.createOrUpdateUserProfile(newMember.id, {
        discord_id: newMember.id,
        username: newMember.user.username,
        display_name: newMember.displayName || newMember.user.username,
        tier: newTier,
        is_active: true,
        last_active: new Date()
      });

    } catch (error) {
      logger.error('Error handling member update:', error);
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
      await this.services.advancedAnalyticsService.logEvent({
        type: 'member_left',
        userId: member.id,
        guildId: member.guild.id,
        data: {
          username: member.user?.username,
          leftAt: new Date().toISOString()
        }
      });

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
      await this.services.advancedAnalyticsService.incrementThreadCount();

      // Log thread creation event
      await this.services.advancedAnalyticsService.logEvent({
        type: 'thread_created',
        channelId: thread.id,
        guildId: thread.guildId,
        data: {
          threadName: thread.name,
          parentChannelId: thread.parentId,
          ownerId: thread.ownerId,
          autoArchiveDuration: thread.autoArchiveDuration
        }
      });

      // Check if this thread should be linked to other channels
      await this.services.automatedThreadService.handleThreadCreation(thread);

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
      await this.services.advancedAnalyticsService.logEvent({
        type: 'message_deleted',
        userId: message.author?.id,
        channelId: message.channelId,
        guildId: message.guildId,
        data: {
          messageId: message.id,
          deletedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error handling message deletion:', error);
    }
  }

  /**
   * Handle message edit events
   */
  async handleMessageUpdate(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void> {
    try {
      // Log message edit
      await this.services.advancedAnalyticsService.logEvent({
        type: 'message_edited',
        userId: newMessage.author?.id,
        channelId: newMessage.channelId,
        guildId: newMessage.guildId,
        data: {
          messageId: newMessage.id,
          editedAt: new Date().toISOString(),
          oldContent: oldMessage.content?.substring(0, 100),
          newContent: newMessage.content?.substring(0, 100)
        }
      });

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
        lastActive: new Date().toISOString(),
        totalMessages: { increment: 1 },
        activity_score: { increment: 1 }
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
      const shouldCreateThread = await this.services.automatedThreadService.shouldCreateThread(message);
      
      if (shouldCreateThread) {
        await this.services.automatedThreadService.createGameThread(message);
      }
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
        activity_score: { increment: 0.5 }
      });

      // Track reaction for analytics
      await this.services.advancedAnalyticsService.logEvent({
        type: 'reaction_added',
        userId: user.id,
        channelId: reaction.message.channelId,
        guildId: reaction.message.guildId,
        data: {
          messageId: reaction.message.id,
          emoji: reaction.emoji.name,
          emojiId: reaction.emoji.id
        }
      });

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
        await this.services.advancedAnalyticsService.logEvent({
          type: 'voice_joined',
          userId,
          channelId: newState.channelId,
          guildId: newState.guild.id,
          data: {
            channelName: newState.channel?.name
          }
        });
      } else if (oldState.channelId && !newState.channelId) {
        // User left voice channel
        await this.services.advancedAnalyticsService.logEvent({
          type: 'voice_left',
          userId,
          channelId: oldState.channelId,
          guildId: oldState.guild.id,
          data: {
            channelName: oldState.channel?.name
          }
        });
      }

    } catch (error) {
      logger.error('Error handling voice state update:', error);
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
        await this.services.advancedAnalyticsService.logEvent({
          type: 'presence_updated',
          userId,
          guildId: newPresence.guild?.id,
          data: {
            oldStatus: oldPresence?.status,
            newStatus: newPresence.status,
            activities: newPresence.activities?.map((a: any) => a.name)
          }
        });
      }

    } catch (error) {
      logger.error('Error handling presence update:', error);
    }
  }
}