import { 
  Client, 
  TextChannel, 
  ThreadChannel, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  Message,
  GuildMember
} from 'discord.js';
import { SupabaseService } from './supabase';
import { GameThread, UserTier } from '../types';
import { PermissionUtils } from '../utils/permissions';
import { logger } from '../utils/logger';
import { botConfig } from '../config';

export class ThreadService {
  private client: Client;
  private supabaseService: SupabaseService;
  private activeThreads: Map<string, GameThread> = new Map();

  constructor(client: Client, supabaseService: SupabaseService) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.loadActiveThreads();
  }

  /**
   * Load active threads from database
   */
  private async loadActiveThreads(): Promise<void> {
    try {
      const { data: threads } = await this.supabaseService.client
        .from('game_threads')
        .select('*')
        .gte('last_activity', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last 7 days

      if (threads) {
        this.activeThreads.clear();
        threads.forEach(thread => {
          this.activeThreads.set(thread.game_id, thread as GameThread);
        });
        logger.info(`Loaded ${threads.length} active game threads`);
      }
    } catch (error) {
      logger.error('Failed to load active threads:', error);
    }
  }

  /**
   * Create or get existing thread for a game
   */
  async createGameThread(gameData: {
    gameId: string;
    sport: string;
    teams: string;
    gameTime: string;
    description?: string;
    league?: string;
  }): Promise<ThreadChannel | null> {
    try {
      // Check if thread already exists
      const existingThread = this.activeThreads.get(gameData.gameId);
      if (existingThread) {
        try {
          const channel = await this.client.channels.fetch(existingThread.threadId || existingThread.thread_id);
          if (channel && channel.isThread() && !channel.archived) {
            return channel as ThreadChannel;
          }
        } catch (error) {
          // Thread might be deleted, create new one
          logger.warn(`Existing thread ${existingThread.threadId} not found, creating new one`);
        }
      }

      // Get threads channel
      const threadsChannel = await this.client.channels.fetch(botConfig.channels.threads) as TextChannel;
      if (!threadsChannel) {
        logger.error('Threads channel not found');
        return null;
      }

      // Create starter message
      const starterEmbed = this.createGameThreadEmbed(gameData);
      const starterMessage = await threadsChannel.send({
        embeds: [starterEmbed],
        components: [this.createThreadButtons(gameData.gameId)]
      });

      // Create thread
      const thread = await starterMessage.startThread({
        name: `🎯 ${gameData.teams} - ${gameData.sport}`,
        autoArchiveDuration: 1440, // 24 hours
        reason: `Game thread for ${gameData.teams}`
      });

      // Pin the starter message
      await starterMessage.pin();

      // Save to database
      const gameThread: GameThread = {
        id: `${gameData.gameId}_${Date.now()}`,
        threadId: thread.id,
        thread_id: thread.id,
        channel_id: thread.parentId || '',
        gameId: gameData.gameId,
        name: `🎯 ${gameData.teams} - ${gameData.sport}`,
        sport: gameData.sport,
        league: gameData.league || 'Unknown',
        teams: Array.isArray(gameData.teams) ? gameData.teams : [gameData.teams],
        game_time: gameData.gameTime ? (typeof gameData.gameTime === 'string' ? new Date(gameData.gameTime) : gameData.gameTime) : new Date(),
        gameTime: gameData.gameTime ? (typeof gameData.gameTime === 'string' ? new Date(gameData.gameTime) : gameData.gameTime) : new Date(),
        status: 'scheduled',
        created_at: new Date(),
        createdAt: new Date(),
        updated_at: new Date(),
        lastActivity: new Date(),
        messageCount: 1,
        participant_count: 0,
        pick_count: 0,
        userCount: 0,
        isPinned: true
      };

      await this.saveGameThread(gameThread);
      this.activeThreads.set(gameData.gameId, gameThread);

      // Send welcome message
      await thread.send({
        content: `Welcome to the **${gameData.teams}** discussion thread! 🏈\n\n` +
                `📊 All picks, updates, and analysis for this game will be posted here.\n` +
                `💬 Feel free to discuss your thoughts and strategies!\n` +
                `🔔 VIP+ members get real-time updates and exclusive insights.`
      });

      logger.info(`Created game thread for ${gameData.teams}: ${thread.id}`);
      return thread;

    } catch (error) {
      logger.error('Failed to create game thread:', error);
      return null;
    }
  }

  /**
   * Post pick to relevant game thread
   */
  async postPickToThread(pickData: any): Promise<void> {
    try {
      const thread = await this.getOrCreateThreadForPick(pickData);
      if (!thread) return;

      const pickEmbed = this.createPickEmbed(pickData);
      const message = await thread.send({
        content: `🚨 **NEW PICK ALERT** 🚨`,
        embeds: [pickEmbed],
        components: [this.createPickButtons(pickData.id)]
      });

      // Pin high-confidence picks
      if (pickData.confidence >= 8) {
        await message.pin();
      }

      // Update thread stats
      await this.updateThreadStats(pickData.gameId, 'pick_added');

      // Notify VIP+ users in thread
      if (pickData.tier === 'premium') {
        await this.notifyVIPUsers(thread, pickData);
      }

    } catch (error) {
      logger.error('Failed to post pick to thread:', error);
    }
  }

  /**
   * Post live update to game thread
   */
  async postLiveUpdate(gameId: string, updateData: any): Promise<void> {
    try {
      const gameThread = this.activeThreads.get(gameId);
      if (!gameThread) return;

      const channel = await this.client.channels.fetch(gameThread.threadId || gameThread.thread_id || '');
      if (!channel || !channel.isThread() || channel.archived) return;

      const thread = channel as ThreadChannel;
      const updateEmbed = this.createLiveUpdateEmbed(updateData);
      await thread.send({
        content: `🔴 **LIVE UPDATE** 🔴`,
        embeds: [updateEmbed]
      });

      await this.updateThreadStats(gameId, 'live_update');

    } catch (error) {
      logger.error('Failed to post live update:', error);
    }
  }

  /**
   * Post grading results to thread
   */
  async postGradingResult(gameId: string, gradingData: any): Promise<void> {
    try {
      const gameThread = this.activeThreads.get(gameId);
      if (!gameThread) return;

      const channel = await this.client.channels.fetch(gameThread.threadId || gameThread.thread_id || '');
      if (!channel || !channel.isThread() || channel.archived) return;

      const thread = channel as ThreadChannel;
      const gradingEmbed = this.createGradingEmbed(gradingData);
      const message = await thread.send({
        content: `📊 **PICK GRADED** 📊`,
        embeds: [gradingEmbed]
      });

      // Pin winning picks
      if (gradingData.result === 'win') {
        await message.pin();
      }

      await this.updateThreadStats(gameId, 'grading_posted');

    } catch (error) {
      logger.error('Failed to post grading result:', error);
    }
  }

  /**
   * Handle user interaction in thread
   */
  async handleThreadInteraction(interaction: any): Promise<void> {
    try {
      const customId = interaction.customId;
      const userId = interaction.user.id;
      const member = interaction.member as GuildMember;

      switch (customId) {
        case 'thread_follow':
          await this.followThread(userId, interaction.channelId);
          await interaction.reply({ content: '✅ You will now receive notifications for this thread!', ephemeral: true });
          break;

        case 'thread_unfollow':
          await this.unfollowThread(userId, interaction.channelId);
          await interaction.reply({ content: '❌ Thread notifications disabled.', ephemeral: true });
          break;

        case 'thread_stats':
          const stats = await this.getThreadStats(interaction.channelId);
          await interaction.reply({ embeds: [this.createStatsEmbed(stats)], ephemeral: true });
          break;

        case 'pick_track':
          if (await PermissionUtils.canSubmitPicks(member)) {
            await this.trackUserPick(userId, interaction.message.embeds[0]);
            await interaction.reply({ content: '📊 Pick tracked! Check your stats with `/mystats`', ephemeral: true });
          } else {
            await interaction.reply({ content: '❌ VIP+ required to track picks.', ephemeral: true });
          }
          break;

        case 'pick_analyze':
          if (await PermissionUtils.canAccessCoaching(member)) {
            const analysis = await this.analyzePick(interaction.message.embeds[0]);
            await interaction.reply({ embeds: [analysis], ephemeral: true });
          } else {
            await interaction.reply({ content: '❌ VIP+ required for pick analysis.', ephemeral: true });
          }
          break;
      }
    } catch (error) {
      logger.error('Failed to handle thread interaction:', error);
    }
  }

  /**
   * Archive old threads
   */
  async archiveOldThreads(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

      for (const [gameId, gameThread] of this.activeThreads) {
        const lastActivity = gameThread.lastActivity || gameThread.created_at;
        if (lastActivity && new Date(lastActivity) < cutoffDate) {
          try {
            const channel = await this.client.channels.fetch(gameThread.threadId || gameThread.thread_id || '');
            if (channel && channel.isThread() && !channel.archived) {
              const thread = channel as ThreadChannel;
              await thread.setArchived(true, 'Auto-archive after 3 days of inactivity');
              logger.info(`Archived thread for game ${gameId}`);
            }
          } catch (error) {
            logger.warn(`Failed to archive thread ${gameThread.threadId}:`, error);
          }

          this.activeThreads.delete(gameId);
        }
      }
    } catch (error) {
      logger.error('Failed to archive old threads:', error);
    }
  }

  /**
   * Get thread statistics
   */
  async getThreadStats(threadId: string): Promise<any> {
    try {
      const { data: stats } = await this.supabaseService.client
        .from('thread_stats')
        .select('*')
        .eq('thread_id', threadId)
        .single();

      return stats || {
        messages: 0,
        unique_users: 0,
        picks_posted: 0,
        reactions: 0
      };
    } catch (error) {
      return {
        messages: 0,
        unique_users: 0,
        picks_posted: 0,
        reactions: 0
      };
    }
  }

  /**
   * Create game thread embed
   */
  private createGameThreadEmbed(gameData: any): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`🎯 ${gameData.teams}`)
      .setDescription(`**${gameData.sport}** Game Discussion Thread`)
      .addFields(
        { name: '⏰ Game Time', value: gameData.gameTime, inline: true },
        { name: '🏟️ Sport', value: gameData.sport, inline: true },
        { name: '📊 Status', value: 'Pre-Game', inline: true }
      )
      .setColor(0x0099FF)
      .setTimestamp()
      .setFooter({ text: 'Unit Talk - Game Threads' });
  }

  /**
   * Create pick embed for thread
   */
  private createPickEmbed(pickData: any): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`🎯 ${pickData.sport} Pick`)
      .setDescription(pickData.description)
      .addFields(
        { name: '🎲 Odds', value: pickData.odds, inline: true },
        { name: '💰 Units', value: pickData.units.toString(), inline: true },
        { name: '📊 Confidence', value: `${pickData.confidence}/10`, inline: true },
        { name: '⚡ Edge', value: `${pickData.edge}%`, inline: true },
        { name: '🏆 Tier', value: pickData.tier, inline: true },
        { name: '⏰ Posted', value: new Date().toLocaleTimeString(), inline: true }
      )
      .setColor(pickData.confidence >= 8 ? 0x00FF00 : 0xFFFF00)
      .setTimestamp();
  }

  /**
   * Create live update embed
   */
  private createLiveUpdateEmbed(updateData: any): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('🔴 Live Game Update')
      .setDescription(updateData.description)
      .addFields(
        { name: '📊 Score', value: updateData.score, inline: true },
        { name: '⏱️ Time', value: updateData.time, inline: true },
        { name: '📈 Impact', value: updateData.impact, inline: true }
      )
      .setColor(0xFF0000)
      .setTimestamp();
  }

  /**
   * Create grading embed
   */
  private createGradingEmbed(gradingData: any): EmbedBuilder {
    const color = gradingData.result === 'win' ? 0x00FF00 : 
                  gradingData.result === 'loss' ? 0xFF0000 : 0xFFFF00;

    return new EmbedBuilder()
      .setTitle(`📊 Pick Result: ${gradingData.result.toUpperCase()}`)
      .setDescription(gradingData.description)
      .addFields(
        { name: '🎯 Final Score', value: gradingData.finalScore, inline: true },
        { name: '💰 Profit/Loss', value: `${gradingData.profitLoss} units`, inline: true },
        { name: '📈 Edge Realized', value: `${gradingData.edgeRealized}%`, inline: true }
      )
      .setColor(color)
      .setTimestamp();
  }

  /**
   * Create thread action buttons
   */
  private createThreadButtons(gameId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('thread_follow')
          .setLabel('Follow Thread')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔔'),
        new ButtonBuilder()
          .setCustomId('thread_stats')
          .setLabel('Thread Stats')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId('thread_unfollow')
          .setLabel('Unfollow')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔕')
      );
  }

  /**
   * Create pick action buttons
   */
  private createPickButtons(pickId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('pick_track')
          .setLabel('Track Pick')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId('pick_analyze')
          .setLabel('Analyze')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔍')
      );
  }

  /**
   * Get or create thread for pick
   */
  private async getOrCreateThreadForPick(pickData: any): Promise<ThreadChannel | null> {
    if (pickData.gameId) {
      return await this.createGameThread({
        gameId: pickData.gameId,
        sport: pickData.sport,
        teams: pickData.teams,
        gameTime: pickData.gameTime
      });
    }
    return null;
  }

  /**
   * Save game thread to database
   */
  private async saveGameThread(gameThread: GameThread): Promise<void> {
    try {
      await this.supabaseService.client
        .from('game_threads')
        .upsert({
          id: gameThread.id,
          thread_id: gameThread.threadId,
          game_id: gameThread.gameId,
          sport: gameThread.sport,
          teams: gameThread.teams,
          game_time: gameThread.gameTime,
          created_at: gameThread.createdAt,
          last_activity: gameThread.lastActivity,
          pick_count: gameThread.pickCount,
          user_count: gameThread.userCount,
          is_pinned: gameThread.isPinned
        });
    } catch (error) {
      logger.error('Failed to save game thread:', error);
    }
  }

  /**
   * Update thread statistics
   */
  private async updateThreadStats(gameId: string, action: string): Promise<void> {
    try {
      const gameThread = this.activeThreads.get(gameId);
      if (!gameThread) return;

      // Update local cache
      gameThread.lastActivity = new Date();
      if (action === 'pick_added') {
        gameThread.pickCount = (gameThread.pickCount || 0) + 1;
      }

      // Update database
      await this.supabaseService.client
        .from('game_threads')
        .update({
          last_activity: gameThread.lastActivity,
          pick_count: gameThread.pickCount || 0
        })
        .eq('id', gameThread.id);

    } catch (error) {
      logger.error('Failed to update thread stats:', error);
    }
  }

  /**
   * Notify VIP users in thread
   */
  private async notifyVIPUsers(thread: ThreadChannel, pickData: any): Promise<void> {
    try {
      // Get VIP+ users who follow this thread
      const { data: followers } = await this.supabaseService.client
        .from('thread_followers')
        .select('user_id, user_profiles!inner(tier)')
        .eq('thread_id', thread.id)
        .eq('user_profiles.tier', 'vip_plus');

      if (followers && followers.length > 0) {
        const mentions = followers.map(f => `<@${f.user_id}>`).join(' ');
        await thread.send(`🔔 VIP+ Alert: ${mentions}\nNew premium pick posted above! 👆`);
      }
    } catch (error) {
      logger.error('Failed to notify VIP users:', error);
    }
  }

  /**
   * Follow thread
   */
  private async followThread(userId: string, threadId: string): Promise<void> {
    try {
      await this.supabaseService.client
        .from('thread_followers')
        .upsert({
          user_id: userId,
          thread_id: threadId,
          followed_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Failed to follow thread:', error);
    }
  }

  /**
   * Unfollow thread
   */
  private async unfollowThread(userId: string, threadId: string): Promise<void> {
    try {
      await this.supabaseService.client
        .from('thread_followers')
        .delete()
        .eq('user_id', userId)
        .eq('thread_id', threadId);
    } catch (error) {
      logger.error('Failed to unfollow thread:', error);
    }
  }

  /**
   * Track user pick
   */
  private async trackUserPick(userId: string, pickEmbed: any): Promise<void> {
    try {
      // Extract pick data from embed
      const pickData = this.extractPickDataFromEmbed(pickEmbed);
      
      await this.supabaseService.client
        .from('user_picks')
        .insert({
          user_id: userId,
          description: pickData.description,
          odds: pickData.odds,
          units: pickData.units,
          confidence: pickData.confidence,
          submitted_at: new Date().toISOString(),
          source: 'thread_track'
        });
    } catch (error) {
      logger.error('Failed to track user pick:', error);
    }
  }

  /**
   * Analyze pick for user
   */
  private async analyzePick(pickEmbed: any): Promise<EmbedBuilder> {
    try {
      const pickData = this.extractPickDataFromEmbed(pickEmbed);
      
      // Perform analysis (this would integrate with your grading engine)
      const analysis = {
        edge: pickData.edge || 0,
        riskLevel: pickData.confidence >= 8 ? 'Low' : pickData.confidence >= 6 ? 'Medium' : 'High',
        recommendation: pickData.confidence >= 7 ? 'Strong Play' : 'Proceed with Caution',
        factors: ['Line movement favorable', 'Historical matchup data positive', 'Weather conditions optimal']
      };

      return new EmbedBuilder()
        .setTitle('🔍 Pick Analysis')
        .addFields(
          { name: '⚡ Edge', value: `${analysis.edge}%`, inline: true },
          { name: '⚠️ Risk Level', value: analysis.riskLevel, inline: true },
          { name: '💡 Recommendation', value: analysis.recommendation, inline: true },
          { name: '📊 Key Factors', value: analysis.factors.join('\n'), inline: false }
        )
        .setColor(0x9B59B6)
        .setTimestamp();
    } catch (error) {
      logger.error('Failed to analyze pick:', error);
      return new EmbedBuilder().setTitle('❌ Analysis Failed').setColor(0xFF0000);
    }
  }

  /**
   * Extract pick data from embed
   */
  private extractPickDataFromEmbed(embed: any): any {
    const fields = embed.fields || [];
    const data: any = {
      description: embed.description || '',
      odds: 0,
      units: 0,
      confidence: 0,
      edge: 0
    };

    fields.forEach((field: any) => {
      switch (field.name) {
        case '🎲 Odds':
          data.odds = field.value;
          break;
        case '💰 Units':
          data.units = parseInt(field.value) || 0;
          break;
        case '📊 Confidence':
          data.confidence = parseInt(field.value.split('/')[0]) || 0;
          break;
        case '⚡ Edge':
          data.edge = parseInt(field.value.replace('%', '')) || 0;
          break;
      }
    });

    return data;
  }

  /**
   * Create stats embed
   */
  private createStatsEmbed(stats: any): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('📊 Thread Statistics')
      .addFields(
        { name: '💬 Messages', value: stats.messages.toString(), inline: true },
        { name: '👥 Unique Users', value: stats.unique_users.toString(), inline: true },
        { name: '🎯 Picks Posted', value: stats.picks_posted.toString(), inline: true },
        { name: '⭐ Reactions', value: stats.reactions.toString(), inline: true }
      )
      .setColor(0x0099FF)
      .setTimestamp();
  }

  /**

   * Get all active threads
   */
  async getActiveThreads(): Promise<GameThread[]> {
    return Array.from(this.activeThreads.values());
  }

  /**
   * Handle potential game thread creation from message
   */
  async handlePotentialGameThread(message: any): Promise<void> {
    try {
      // Check if message contains game information that should trigger thread creation
      const gameInfo = this.extractGameInfo(message.content);
      if (gameInfo) {
        await this.createGameThread(gameInfo);
      }
    } catch (error) {
      logger.error('Failed to handle potential game thread:', error);
    }
  }

  /**
   * Handle thread creation event
   */
  async handleThreadCreate(thread: any): Promise<void> {
    try {
      logger.info(`Thread created: ${thread.name} (${thread.id})`);
      // Additional thread creation handling logic here
    } catch (error) {
      logger.error('Failed to handle thread create:', error);
    }
  }

  /**
   * Handle thread update event
   */
  async handleThreadUpdate(oldThread: any, newThread: any): Promise<void> {
    try {
      logger.info(`Thread updated: ${newThread.name} (${newThread.id})`);
      // Update thread information in database if needed
    } catch (error) {
      logger.error('Failed to handle thread update:', error);
    }
  }

  /**
   * Perform maintenance tasks
   */
  async performMaintenance(): Promise<void> {
    try {
      await this.archiveOldThreads();
      await this.cleanupInactiveThreads();
      logger.info('Thread maintenance completed');
    } catch (error) {
      logger.error('Failed to perform thread maintenance:', error);
    }
  }

  /**
   * Extract game information from message content
   */
  private extractGameInfo(content: string): any | null {
    // Simple regex patterns to detect game information
    const patterns = [
      /(\w+)\s+vs\s+(\w+)/i,
      /(\w+)\s+@\s+(\w+)/i,
      /(\w+)\s+-\s+(\w+)/i
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return {
          gameId: `game_${Date.now()}`,
          teams: `${match[1]} vs ${match[2]}`,
          sport: 'Unknown',
          gameTime: new Date().toISOString()
        };
      }
    }
    return null;
  }

  /**
   * Clean up inactive threads
   */
  private async cleanupInactiveThreads(): Promise<void> {
    try {
      const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago

      for (const [gameId, thread] of this.activeThreads) {
        const lastActivity = new Date(thread.lastActivity || thread.created_at || Date.now()).getTime();
        if (lastActivity < cutoffTime) {
          this.activeThreads.delete(gameId);
          logger.info(`Cleaned up inactive thread: ${thread.name}`);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup inactive threads:', error);
    }
  }

  /**
   * Clean up service
   */
  async cleanup(): Promise<void> {
    await this.archiveOldThreads();
  }
}

export const threadService = new ThreadService(
  {} as Client, // Will be initialized in main
  {} as SupabaseService // Will be initialized in main
);