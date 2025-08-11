import { Client, GatewayIntentBits, EmbedBuilder, TextChannel, DMChannel, NewsChannel, ThreadChannel } from 'discord.js';

import { env } from '../config/env';
import { logger } from '../shared/logger';

/**
 * DiscordBotService - Direct Discord bot integration for sending messages
 * Uses the Discord bot token to send messages directly to channels
 */
export class DiscordBotService {
  private static instance: DiscordBotService;
  private client: Client;
  private isReady: boolean = false;
  private readyPromise: Promise<void>;

  private constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    this.readyPromise = this.initialize();
  }

  public static getInstance(): DiscordBotService {
    if (!DiscordBotService.instance) {
      DiscordBotService.instance = new DiscordBotService();
    }
    return DiscordBotService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      // Get Discord token from environment
      const discordToken = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
      
      if (!discordToken) {
        throw new Error('Discord bot token not found in environment variables');
      }

      this.client.once('ready', () => {
        logger.info('Discord bot service initialized successfully', {
          botTag: this.client.user?.tag,
          guildCount: this.client.guilds.cache.size
        });
        this.isReady = true;
      });

      this.client.on('error', (error) => {
        logger.error('Discord bot service error', {
          error: error.message,
          stack: error.stack
        });
      });

      await this.client.login(discordToken);
      
      // Wait for ready event
      return new Promise((resolve) => {
        if (this.isReady) {
          resolve();
        } else {
          this.client.once('ready', () => resolve());
        }
      });

    } catch (error) {
      logger.error('Failed to initialize Discord bot service', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Send embed to specific Discord channel
   */
  public async sendEmbed(channelId: string, embed: EmbedBuilder): Promise<void> {
    await this.readyPromise;

    if (!this.isReady) {
      throw new Error('Discord bot service not ready');
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      // Check if channel can receive messages
      if (channel.isTextBased()) {
        const textChannel = channel as TextChannel | DMChannel | NewsChannel | ThreadChannel;
        await textChannel.send({ embeds: [embed] });
        
        logger.info('Message sent to Discord channel successfully', {
          channelId,
          channelName: 'name' in channel ? channel.name : 'DM',
          embedTitle: embed.data.title
        });
      } else {
        throw new Error(`Channel ${channelId} is not text-based`);
      }

    } catch (error) {
      logger.error('Failed to send message to Discord channel', {
        channelId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Send plain text message to specific Discord channel
   */
  public async sendMessage(channelId: string, content: string): Promise<void> {
    await this.readyPromise;

    if (!this.isReady) {
      throw new Error('Discord bot service not ready');
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      
      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      if (channel.isTextBased()) {
        const textChannel = channel as TextChannel | DMChannel | NewsChannel | ThreadChannel;
        await textChannel.send(content);
        
        logger.info('Text message sent to Discord channel successfully', {
          channelId,
          channelName: 'name' in channel ? channel.name : 'DM',
          messageLength: content.length
        });
      } else {
        throw new Error(`Channel ${channelId} is not text-based`);
      }

    } catch (error) {
      logger.error('Failed to send text message to Discord channel', {
        channelId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Send embed to specific Discord thread
   * CRITICAL FIX: This method was missing and causing VIPPlusChannelService errors
   */
  public async sendEmbedToThread(threadId: string, embed: EmbedBuilder): Promise<void> {
    await this.readyPromise;

    if (!this.isReady) {
      throw new Error('Discord bot service not ready');
    }

    try {
      const thread = await this.client.channels.fetch(threadId);
      
      if (!thread) {
        throw new Error(`Thread not found: ${threadId}`);
      }

      // Verify it's a thread channel
      if (!thread.isThread()) {
        throw new Error(`Channel ${threadId} is not a thread`);
      }

      const threadChannel = thread as ThreadChannel;
      
      // Check if thread is archived
      if (threadChannel.archived) {
        logger.warn('Attempting to send message to archived thread', {
          threadId,
          threadName: threadChannel.name
        });
        // Try to unarchive if possible
        try {
          await threadChannel.setArchived(false);
        } catch (unarchiveError) {
          throw new Error(`Thread ${threadId} is archived and cannot be unarchived`);
        }
      }

      await threadChannel.send({ embeds: [embed] });
      
      logger.info('Embed sent to Discord thread successfully', {
        threadId,
        threadName: threadChannel.name,
        parentChannelId: threadChannel.parentId,
        embedTitle: embed.data.title
      });

    } catch (error) {
      logger.error('Failed to send embed to Discord thread', {
        threadId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Send message with embed to specific Discord thread
   */
  public async sendMessageToThread(threadId: string, content: string, embed?: EmbedBuilder): Promise<void> {
    await this.readyPromise;

    if (!this.isReady) {
      throw new Error('Discord bot service not ready');
    }

    try {
      const thread = await this.client.channels.fetch(threadId);
      
      if (!thread) {
        throw new Error(`Thread not found: ${threadId}`);
      }

      if (!thread.isThread()) {
        throw new Error(`Channel ${threadId} is not a thread`);
      }

      const threadChannel = thread as ThreadChannel;
      
      if (threadChannel.archived) {
        try {
          await threadChannel.setArchived(false);
        } catch (unarchiveError) {
          throw new Error(`Thread ${threadId} is archived and cannot be unarchived`);
        }
      }

      const messageOptions: any = { content };
      if (embed) {
        messageOptions.embeds = [embed];
      }

      await threadChannel.send(messageOptions);
      
      logger.info('Message sent to Discord thread successfully', {
        threadId,
        threadName: threadChannel.name,
        hasEmbed: !!embed,
        messageLength: content.length
      });

    } catch (error) {
      logger.error('Failed to send message to Discord thread', {
        threadId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Send direct message to a specific user
   */
  public async sendDirectMessage(userId: string, embed: EmbedBuilder): Promise<void> {
    await this.readyPromise;

    if (!this.isReady) {
      throw new Error('Discord bot service not ready');
    }

    try {
      const user = await this.client.users.fetch(userId);
      
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      await user.send({ embeds: [embed] });
      
      logger.info('Direct message sent successfully', {
        userId,
        userTag: user.tag,
        embedTitle: embed.data.title
      });

    } catch (error) {
      logger.error('Failed to send direct message', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Test connection by sending a test message
   */
  public async testConnection(channelId?: string): Promise<boolean> {
    try {
      await this.readyPromise;
      
      const testChannelId = channelId || env.alertsChannelId;
      if (!testChannelId) {
        throw new Error('No test channel ID provided');
      }

      const testEmbed = new EmbedBuilder()
        .setTitle('🔧 Discord Connection Test')
        .setDescription('Discord bot service is working correctly!')
        .setColor(0x00FF00)
        .setTimestamp()
        .setFooter({ text: 'Unit Talk Bot Service Test' });

      await this.sendEmbed(testChannelId, testEmbed);
      return true;

    } catch (error) {
      logger.error('Discord connection test failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get bot status information
   */
  public getStatus(): { ready: boolean; guildCount: number; userTag: string | null } {
    return {
      ready: this.isReady,
      guildCount: this.client.guilds.cache.size,
      userTag: this.client.user?.tag || null
    };
  }

  /**
   * Gracefully shutdown the Discord bot
   */
  public async shutdown(): Promise<void> {
    if (this.client && this.isReady) {
      logger.info('Shutting down Discord bot service...');
      await this.client.destroy();
      this.isReady = false;
    }
  }
}

// Export singleton instance
export const discordBotService = DiscordBotService.getInstance();