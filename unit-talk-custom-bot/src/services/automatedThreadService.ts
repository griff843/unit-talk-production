import { Client, ThreadChannel, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';
import { SupabaseService } from './supabase';
import { PermissionsService } from './permissions';
import { GameThread, ThreadLinkingRule, CrossPostConfig } from '../types';
import { logger } from '../utils/logger';
import { botConfig } from '../config';

export class AutomatedThreadService {
  private client: Client;
  private supabaseService: SupabaseService;
  private permissionsService: PermissionsService;
  private activeThreads: Map<string, GameThread> = new Map();
  private linkingRules: Map<string, ThreadLinkingRule> = new Map();
  private crossPostConfigs: Map<string, CrossPostConfig> = new Map();

  constructor(client: Client, supabaseService: SupabaseService, permissionsService: PermissionsService) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.permissionsService = permissionsService;
    this.loadThreadConfigurations();
  }

  /**
   * Load thread configurations from database
   */
  private async loadThreadConfigurations(): Promise<void> {
    try {
      // Load linking rules
      const { data: linkingRules } = await this.supabaseService.client
        .from('thread_linking_rules')
        .select('*')
        .eq('is_active', true);

      if (linkingRules) {
        linkingRules.forEach(rule => {
          this.linkingRules.set(rule.id, rule as ThreadLinkingRule);
        });
      }

      // Load cross-post configurations
      const { data: crossPostConfigs } = await this.supabaseService.client
        .from('cross_post_configs')
        .select('*')
        .eq('is_active', true);

      if (crossPostConfigs) {
        crossPostConfigs.forEach(config => {
          this.crossPostConfigs.set(config.id, config as CrossPostConfig);
        });
      }

      logger.info(`Loaded ${linkingRules?.length || 0} linking rules and ${crossPostConfigs?.length || 0} cross-post configs`);
    } catch (error) {
      logger.error('Failed to load thread configurations:', error);
    }
  }

  /**
   * Create automated game threads based on schedule
   * Updated to fix TypeScript errors
   */
  async createGameThread(gameData: any): Promise<ThreadChannel | null> {
    try {
      const channel = this.client.channels.cache.get(botConfig.channels.threads) as TextChannel;
      if (!channel) {
        logger.error('Threads channel not found');
        return null;
      }

      // Check if thread already exists for this game
      const existingThread = await this.findExistingGameThread(gameData.id);
      if (existingThread) {
        logger.info(`Thread already exists for game ${gameData.id}`);
        return existingThread;
      }

      // Create thread name
      const threadName = this.generateThreadName(gameData);
      
      // Create initial message for the thread
      const initialEmbed = new EmbedBuilder()
        .setTitle(`🏈 ${gameData.teams}`)
        .setDescription(`Game discussion thread for ${gameData.teams}`)
        .addFields(
          { name: 'Date & Time', value: gameData.gameTime, inline: true },
          { name: 'League', value: gameData.league, inline: true },
          { name: 'Status', value: 'Pre-Game', inline: true }
        )
        .setColor('#1E90FF')
        .setTimestamp()
        .setFooter({ text: 'Auto-generated game thread' });

      if (gameData.spread) {
        initialEmbed.addFields({ name: 'Spread', value: gameData.spread, inline: true });
      }
      if (gameData.total) {
        initialEmbed.addFields({ name: 'Total', value: gameData.total, inline: true });
      }

      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`game_picks_${gameData.id}`)
            .setLabel('View Picks')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎯'),
          new ButtonBuilder()
            .setCustomId(`game_stats_${gameData.id}`)
            .setLabel('Game Stats')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊'),
          new ButtonBuilder()
            .setCustomId(`game_alerts_${gameData.id}`)
            .setLabel('Get Alerts')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔔')
        );

      // Send initial message and create thread
      const message = await channel.send({ 
        embeds: [initialEmbed], 
        components: [actionRow] 
      });

      const thread = await message.startThread({
        name: threadName,
        autoArchiveDuration: botConfig.limits.threadAutoArchiveMinutes,
        reason: `Auto-created thread for ${gameData.teams}`
      });

      // Store thread information
      const gameThread: GameThread = {
        id: thread.id,
        thread_id: thread.id,
        gameId: gameData.id,
        name: threadName,
        channel_id: channel.id,
        sport: gameData.sport || 'Unknown',
        league: gameData.league || 'Unknown',
        teams: gameData.teams || [],
        game_time: gameData.gameTime || new Date(),
        status: 'scheduled' as const,
        created_at: new Date(),
        updated_at: new Date(),
        createdAt: new Date(),
        isActive: true,
        pickCount: 0,
        lastActivity: new Date()
      };

      this.activeThreads.set(thread.id, gameThread);

      // Save to database
      await this.supabaseService.client
        .from('game_threads')
        .insert({
          thread_id: thread.id,
          game_id: gameData.id,
          name: threadName,
          channel_id: channel.id,
          message_id: message.id,
          game_data: gameData,
          created_at: gameThread.createdAt
        });

      // Apply linking rules
      await this.applyLinkingRules(thread, gameData);

      logger.info(`Created game thread: ${threadName} (${thread.id})`);
      return thread;

    } catch (error) {
      logger.error('Failed to create game thread:', error);
      return null;
    }
  }

  /**
   * Create thread for pick drops
   */
  async createPickDropThread(pickData: any): Promise<ThreadChannel | null> {
    try {
      const channelId = this.getPickChannelByTier(pickData.tier);
      const channel = this.client.channels.cache.get(channelId) as TextChannel;
      if (!channel) return null;

      const threadName = `🎯 ${pickData.teams} - ${pickData.pick}`;
      
      const embed = new EmbedBuilder()
        .setTitle(`${pickData.tier.toUpperCase()} PICK: ${pickData.teams}`)
        .setDescription(`**${pickData.pick}**`)
        .addFields(
          { name: 'Units', value: `${pickData.units}`, inline: true },
          { name: 'Odds', value: `${pickData.odds}`, inline: true },
          { name: 'Confidence', value: `${pickData.confidence}%`, inline: true }
        )
        .setColor(this.getTierColor(pickData.tier))
        .setTimestamp();

      if (pickData.reasoning) {
        embed.addFields({ name: 'Reasoning', value: pickData.reasoning });
      }

      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`discuss_pick_${pickData.id}`)
            .setLabel('Discuss')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💬'),
          new ButtonBuilder()
            .setCustomId(`track_pick_${pickData.id}`)
            .setLabel('Track')
            .setStyle(ButtonStyle.Success)
            .setEmoji('📊')
        );

      const message = await channel.send({ 
        embeds: [embed], 
        components: [actionRow] 
      });

      const thread = await message.startThread({
        name: threadName,
        autoArchiveDuration: 1440, // 24 hours
        reason: `Pick discussion thread for ${pickData.teams}`
      });

      // Cross-post to related channels if configured
      await this.handlePickCrossPost(pickData, embed, actionRow);

      logger.info(`Created pick thread: ${threadName}`);
      return thread;

    } catch (error) {
      logger.error('Failed to create pick thread:', error);
      return null;
    }
  }

  /**
   * Create recap/alert cross-posting
   */
  async createRecapThread(recapData: any): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setTitle('📊 Daily Recap')
        .setDescription(recapData.summary)
        .addFields(
          { name: 'Total Picks', value: `${recapData.totalPicks}`, inline: true },
          { name: 'Winners', value: `${recapData.winners}`, inline: true },
          { name: 'Win Rate', value: `${recapData.winRate}%`, inline: true },
          { name: 'Units Won/Lost', value: `${recapData.unitsChange > 0 ? '+' : ''}${recapData.unitsChange}`, inline: true }
        )
        .setColor(recapData.unitsChange > 0 ? '#00FF00' : '#FF0000')
        .setTimestamp()
        .setFooter({ text: 'Daily Performance Recap' });

      // Post to multiple channels based on cross-post configuration
      const crossPostChannels = [
        botConfig.channels.general,
        botConfig.channels.vipGeneral,
        botConfig.channels.vipPlusGeneral
      ];

      for (const channelId of crossPostChannels) {
        if (!channelId) continue;
        
        const channel = this.client.channels.cache.get(channelId) as TextChannel;
        if (!channel) continue;

        const message = await channel.send({ embeds: [embed] });
        
        // Create thread for discussion
        const thread = await message.startThread({
          name: `📊 Daily Recap Discussion - ${new Date().toLocaleDateString()}`,
          autoArchiveDuration: 1440, // 24 hours (valid duration)
          reason: 'Daily recap discussion thread'
        });

        logger.info(`Posted recap to ${channel.name} with thread ${thread.name}`);
      }

    } catch (error) {
      logger.error('Failed to create recap threads:', error);
    }
  }

  /**
   * Handle automatic thread linking based on rules
   */
  private async applyLinkingRules(thread: ThreadChannel, gameData: any): Promise<void> {
    try {
      for (const [ruleId, rule] of this.linkingRules) {
        if (this.shouldApplyRule(rule, gameData)) {
          await this.linkThreadToChannels(thread, rule.targetChannels);
          
          // Send linking message
          const linkEmbed = new EmbedBuilder()
            .setTitle('🔗 Related Discussion')
            .setDescription(`Discussion for **${gameData.teams}** is happening in ${thread}`)
            .setColor('#FFA500')
            .setTimestamp();

          for (const channelId of rule.targetChannels) {
            const channel = this.client.channels.cache.get(channelId) as TextChannel;
            if (channel) {
              await channel.send({ embeds: [linkEmbed] });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to apply linking rules:', error);
    }
  }

  /**
   * Handle cross-posting of picks to multiple channels
   */
  private async handlePickCrossPost(pickData: any, embed: EmbedBuilder, actionRow: ActionRowBuilder<ButtonBuilder>): Promise<void> {
    try {
      // Get cross-post configuration for this pick type
      const crossPostConfig = Array.from(this.crossPostConfigs.values())
        .find(config => config.conditions?.['tier'] === pickData.tier);

      if (!crossPostConfig || !crossPostConfig.targetChannels) return;

      for (const targetChannelId of crossPostConfig.targetChannels) {
        const channel = this.client.channels.cache.get(targetChannelId) as TextChannel;
        if (!channel) continue;

        // Modify embed for cross-post
        const crossPostEmbed = EmbedBuilder.from(embed)
          .setFooter({ text: `Cross-posted from ${this.getChannelName(pickData.tier)} | Original discussion in thread` });

        await channel.send({
          embeds: [crossPostEmbed],
          components: [actionRow]
        });
      }
    } catch (error) {
      logger.error('Failed to handle pick cross-post:', error);
    }
  }

  /**
   * Update thread with live game updates
   */
  async updateGameThread(gameId: string, updateData: any): Promise<void> {
    try {
      const gameThread = Array.from(this.activeThreads.values())
        .find(thread => thread.gameId === gameId);

      if (!gameThread) return;

      const thread = this.client.channels.cache.get(gameThread.id) as ThreadChannel;
      if (!thread) return;

      const updateEmbed = new EmbedBuilder()
        .setTitle('🔄 Game Update')
        .setDescription(updateData.description)
        .setColor('#FF6B35')
        .setTimestamp();

      if (updateData.score) {
        updateEmbed.addFields({ name: 'Score', value: updateData.score, inline: true });
      }
      if (updateData.quarter) {
        updateEmbed.addFields({ name: 'Quarter', value: updateData.quarter, inline: true });
      }
      if (updateData.timeRemaining) {
        updateEmbed.addFields({ name: 'Time', value: updateData.timeRemaining, inline: true });
      }

      await thread.send({ embeds: [updateEmbed] });

      // Update thread activity
      gameThread.lastActivity = new Date();

    } catch (error) {
      logger.error(`Failed to update game thread for ${gameId}:`, error);
    }
  }

  /**
   * Archive completed game threads
   */
  async archiveCompletedGameThreads(): Promise<void> {
    try {
      const completedGames = await this.getCompletedGames();
      
      for (const game of completedGames) {
        const gameThread = Array.from(this.activeThreads.values())
          .find(thread => thread.gameId === game.id);

        if (!gameThread) continue;

        const thread = this.client.channels.cache.get(gameThread.id) as ThreadChannel;
        if (!thread) continue;

        // Send final recap
        const finalEmbed = new EmbedBuilder()
          .setTitle('🏁 Game Complete')
          .setDescription(`Final result for **${game.teams}**`)
          .addFields(
            { name: 'Final Score', value: game.finalScore, inline: true },
            { name: 'Result', value: game.result, inline: true }
          )
          .setColor(game.result === 'win' ? '#00FF00' : '#FF0000')
          .setTimestamp()
          .setFooter({ text: 'Thread will be archived in 1 hour' });

        await thread.send({ embeds: [finalEmbed] });

        // Archive after delay
        setTimeout(async () => {
          try {
            await thread.setArchived(true, 'Game completed');
            this.activeThreads.delete(gameThread.id);
            logger.info(`Archived thread for completed game: ${game.teams}`);
          } catch (error) {
            logger.error(`Failed to archive thread ${gameThread.id}:`, error);
          }
        }, 60 * 60 * 1000); // 1 hour delay
      }
    } catch (error) {
      logger.error('Failed to archive completed game threads:', error);
    }
  }

  /**
   * Get thread statistics and analytics
   */
  async getThreadAnalytics(): Promise<any> {
    try {
      const analytics = {
        totalActiveThreads: this.activeThreads.size,
        threadsByType: {
          game: 0,
          pick: 0,
          recap: 0
        },
        averageParticipants: 0,
        totalMessages: 0,
        mostActiveThread: null as any
      };

      let totalParticipants = 0;
      let mostActiveCount = 0;

      for (const [threadId, gameThread] of this.activeThreads) {
        const thread = this.client.channels.cache.get(threadId) as ThreadChannel;
        if (!thread) continue;

        // Categorize thread type
        if (gameThread.gameId) {
          analytics.threadsByType.game++;
        } else if (thread.name.includes('PICK')) {
          analytics.threadsByType.pick++;
        } else if (thread.name.includes('Recap')) {
          analytics.threadsByType.recap++;
        }

        // Count participants and messages
        const messageCount = thread.messageCount || 0;
        const memberCount = thread.memberCount || 0;

        totalParticipants += memberCount;
        analytics.totalMessages += messageCount;

        if (messageCount > mostActiveCount) {
          mostActiveCount = messageCount;
          analytics.mostActiveThread = {
            name: thread.name,
            messageCount: messageCount,
            memberCount: memberCount
          };
        }
      }

      analytics.averageParticipants = this.activeThreads.size > 0 
        ? Math.round(totalParticipants / this.activeThreads.size) 
        : 0;

      return analytics;
    } catch (error) {
      logger.error('Failed to get thread analytics:', error);
      return null;
    }
  }

  // Helper methods
  private generateThreadName(gameData: any): string {
    const date = new Date(gameData.gameTime).toLocaleDateString();
    return `🏈 ${gameData.teams} - ${date}`;
  }

  private async findExistingGameThread(gameId: string): Promise<ThreadChannel | null> {
    const gameThread = Array.from(this.activeThreads.values())
      .find(thread => thread.gameId === gameId);
    
    if (gameThread) {
      return this.client.channels.cache.get(gameThread.id) as ThreadChannel;
    }
    return null;
  }

  private getPickChannelByTier(tier: string): string {
    switch (tier) {
      case 'vip_plus':
        return botConfig.channels.vipPlusPicks;
      case 'vip':
        return botConfig.channels.vipPicks;
      default:
        return botConfig.channels.freePicks;
    }
  }

  private getTierColor(tier: string): number {
    switch (tier) {
      case 'vip_plus':
        return 0xFFD700; // Gold
      case 'vip':
        return 0x4169E1; // Royal Blue
      default:
        return 0x808080; // Gray
    }
  }

  private getChannelName(tier: string): string {
    switch (tier) {
      case 'vip_plus':
        return 'VIP+ Picks';
      case 'vip':
        return 'VIP Picks';
      default:
        return 'Free Picks';
    }
  }

  private shouldApplyRule(rule: ThreadLinkingRule, gameData: any): boolean {
    // Check if rule conditions match the game data
    return rule.conditions.every(condition => {
      switch (condition.type) {
        case 'custom':
          // Handle custom conditions based on the value structure
          if (condition.value && typeof condition.value === 'object') {
            if (condition.value.league && condition.value.league !== gameData.league) {
              return false;
            }
            if (condition.value.teams && !condition.value.teams.includes(gameData.teams)) {
              return false;
            }
            if (condition.value.dayOfWeek && condition.value.dayOfWeek !== new Date().getDay()) {
              return false;
            }
          }
          return true;
        default:
          return true;
      }
    });
  }

  private async linkThreadToChannels(thread: ThreadChannel, channelIds: string[]): Promise<void> {
    // Implementation for linking threads to specific channels
    // This could involve sending messages with thread links or other linking mechanisms
  }

  private async getCompletedGames(): Promise<any[]> {
    // Implementation to fetch completed games from database
    const { data } = await this.supabaseService.client
      .from('games')
      .select('*')
      .eq('status', 'completed')
      .gte('completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return data || [];
  }

  /**
   * Load thread rules from database
   */
  async loadThreadRules(): Promise<void> {
    try {
      const { data: rules } = await this.supabaseService.client
        .from('thread_rules')
        .select('*')
        .eq('is_active', true);

      if (rules) {
        // Store rules for use in thread creation
        logger.info(`Loaded ${rules.length} thread rules`);
      }
    } catch (error) {
      logger.error('Failed to load thread rules:', error);
    }
  }
}