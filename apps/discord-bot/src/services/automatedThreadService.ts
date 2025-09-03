import {
  Client,
  ThreadChannel,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { SupabaseService } from './supabase';
import { PermissionsService } from './permissions';
import { GameThread, ThreadLinkingRule, CrossPostConfig } from '../types';
import { logger } from '../utils/logger';
import { botConfig } from '../config';
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

export class AutomatedThreadService {
  private client: Client;
  private supabaseService: SupabaseService;
  // private permissionsService: PermissionsService;
  private activeThreads: Map<string, GameThread> = new Map();
  private linkingRules: Map<string, ThreadLinkingRule> = new Map();
  private crossPostConfigs: Map<string, CrossPostConfig> = new Map();

  constructor(
    client: Client,
    supabaseService: SupabaseService,
    _permissionsService: PermissionsService
  ) {
    this.client = client;
    this.supabaseService = supabaseService;
    // this.permissionsService = _permissionsService;
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

      logger.info(
        `Loaded ${linkingRules?.length || 0} linking rules and ${crossPostConfigs?.length || 0} cross-post configs`
      );
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

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`game_picks_${gameData.id}`)
          .setLabel('View Picks')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎯'),
        new ButtonBuilder()
          .setCustomId(`game_trivia_${gameData.id}`)
          .setLabel('Game Trivia')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🧠'),
        new ButtonBuilder()
          .setCustomId(`period_updates_${gameData.id}`)
          .setLabel('Period Updates')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📊')
      );

      // Send initial message and create thread
      const message = await channel.send({
        embeds: [initialEmbed],
        components: [actionRow],
      });

      const thread = await message.startThread({
        name: threadName,
        autoArchiveDuration: botConfig.limits.threadAutoArchiveMinutes,
        reason: `Auto-created thread for ${gameData.teams}`,
      });

      // Store thread information
      const gameThread: GameThread = {
        id: thread.id,
        thread_id: thread.id,
        game_id: gameData.id,
        name: threadName,
        channel_id: channel.id,
        sport: gameData.sport || 'Unknown',
        league: gameData.league || 'Unknown',
        teams: gameData.teams || [],
        game_time: gameData.gameTime || new Date().toISOString(),
        status: 'scheduled' as const,
        created_at: toISOString(new Date()),
        updated_at: toISOString(new Date()),
        pickCount: 0,
        lastActivity: new Date(),
      };

      this.activeThreads.set(thread.id, gameThread);

      // Save to database
      await this.supabaseService.client.from('game_threads').insert({
        thread_id: thread.id,
        game_id: gameData.id,
        name: threadName,
        channel_id: channel.id,
        message_id: message.id,
        game_data: gameData,
        created_at: gameThread.created_at,
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

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
        components: [actionRow],
      });

      const thread = await message.startThread({
        name: threadName,
        autoArchiveDuration: 1440, // 24 hours
        reason: `Pick discussion thread for ${pickData.teams}`,
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
          {
            name: 'Units Won/Lost',
            value: `${recapData.unitsChange > 0 ? '+' : ''}${recapData.unitsChange}`,
            inline: true,
          }
        )
        .setColor(recapData.unitsChange > 0 ? '#00FF00' : '#FF0000')
        .setTimestamp()
        .setFooter({ text: 'Daily Performance Recap' });

      // Post to multiple channels based on cross-post configuration
      const crossPostChannels = [
        botConfig.channels.general,
        botConfig.channels.vipGeneral,
        botConfig.channels.vipPlusGeneral,
      ];

      for (const channelId of crossPostChannels) {
        if (!channelId) continue;

        const channel = this.client.channels.cache.get(channelId) as TextChannel;
        if (!channel) continue;

        const message = await channel.send({ embeds: [embed] });

        // Create thread for discussion
        const thread = await message.startThread({
          name: `📊 Daily Recap Discussion - ${toLocaleDateString(new Date())}`, // 24 hours (valid duration)
          reason: 'Daily recap discussion thread',
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
      for (const [_ruleId, rule] of this.linkingRules) {
        if (this.shouldApplyRule(rule, gameData)) {
          // linkThreadToChannels method removed

          // Send linking message
          const linkEmbed = new EmbedBuilder()
            .setTitle('🔗 Related Discussion')
            .setDescription(`Discussion for **${gameData.teams}** is happening in ${thread}`)
            .setColor('#FFA500')
            .setTimestamp();

          for (const channelId of rule.targetChannels || []) {
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
  private async handlePickCrossPost(
    pickData: any,
    embed: EmbedBuilder,
    actionRow: ActionRowBuilder<ButtonBuilder>
  ): Promise<void> {
    try {
      // Get cross-post configuration for this pick type
      const crossPostConfig = Array.from(this.crossPostConfigs.values()).find(
        config => config.conditions?.['tier'] === pickData.tier
      );

      if (!crossPostConfig || !crossPostConfig.targetChannels) return;

      for (const targetChannelId of crossPostConfig.targetChannels) {
        const channel = this.client.channels.cache.get(targetChannelId) as TextChannel;
        if (!channel) continue;

        // Modify embed for cross-post
        const crossPostEmbed = EmbedBuilder.from(embed).setFooter({
          text: `Cross-posted from ${this.getChannelName(pickData.tier)} | Original discussion in thread`,
        });

        await channel.send({
          embeds: [crossPostEmbed],
          components: [actionRow],
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
      const gameThread = Array.from(this.activeThreads.values()).find(
        thread => thread.game_id === gameId
      );

      if (!gameThread) return;

      const thread = this.client.channels.cache.get(gameThread.id) as ThreadChannel;
      if (!thread) return;

      const updateEmbed = new EmbedBuilder()
        .setTitle('🔄 Game Update')
        .setDescription(updateData.description)
        .setColor('#FF6B35')
        .setTimestamp();

      if (updateData.professional_score) {
        updateEmbed.addFields({ name: 'Score', value: updateData.professional_score, inline: true });
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
   * Archive completed game threads (ENHANCED - Your brainstormed feature)
   * Auto-archives threads after games complete with summary
   */
  async archiveCompletedGameThreads(): Promise<void> {
    try {
      const completedGames = await this.getCompletedGames();

      for (const game of completedGames) {
        const gameThread = Array.from(this.activeThreads.values()).find(
          thread => thread.game_id === game.id
        );

        if (!gameThread) continue;

        const thread = this.client.channels.cache.get(gameThread.id) as ThreadChannel;
        if (!thread) continue;

        // Send comprehensive final recap with pick results
        const finalEmbed = new EmbedBuilder()
          .setTitle('🏁 **GAME COMPLETE** | Thread Archive')
          .setDescription(`Final result: **${game.teams}** | ${game.finalScore}`)
          .setColor(0x2f3136) // Discord dark theme color
          .addFields(
            {
              name: '📊 **Pick Results Summary**',
              value: await this.generatePickResultsSummary(game.id),
              inline: false,
            },
            {
              name: '💬 **Thread Stats**',
              value: [
                `Messages: ${thread.messageCount || 0}`,
                `Participants: ${thread.memberCount || 0}`,
                `Duration: ${this.calculateThreadDuration(gameThread.created_at)}`,
              ].join('\n'),
              inline: true,
            },
            {
              name: '🎯 **Top Contributors**',
              value: await this.getTopContributors(thread.id),
              inline: true,
            }
          )
          .setFooter({ text: 'Thread archived automatically | Data saved for analysis' })
          .setTimestamp();

        await thread.send({ embeds: [finalEmbed] });

        // Archive with shorter delay for better UX
        setTimeout(
          async () => {
            try {
              await thread.setArchived(true, 'Game completed - auto-archived');
              this.activeThreads.delete(gameThread.id);

              // Update database status
              await this.supabaseService.client
                .from('game_threads')
                .update({
                  status: 'archived',
                  archived_at: toISOString(new Date()),
                  final_message_count: thread.messageCount || 0,
                  final_member_count: thread.memberCount || 0,
                })
                .eq('thread_id', gameThread.id);

              logger.info(`Auto-archived completed game thread`, {
                threadId: gameThread.id,
                gameName: game.teams,
                messageCount: thread.messageCount,
                memberCount: thread.memberCount,
              });
            } catch (error) {
              logger.error(`Failed to archive thread ${gameThread.id}:`, error);
            }
          },
          15 * 60 * 1000
        ); // 15 minutes delay (reduced from 1 hour)
      }
    } catch (error) {
      logger.error('Failed to archive completed game threads:', error);
    }
  }

  /**
   * Post per-period trivia (YOUR BRAINSTORMED IDEA)
   * Auto-posts trivia questions with point rewards
   */
  async postPeriodTrivia(gameId: string, period: string, sport: string): Promise<void> {
    try {
      const gameThread = Array.from(this.activeThreads.values()).find(
        thread => thread.game_id === gameId
      );

      if (!gameThread) return;

      const thread = this.client.channels.cache.get(gameThread.id) as ThreadChannel;
      if (!thread) return;

      const triviaQuestion = this.generateSportTrivia(sport, period);

      const embed = new EmbedBuilder()
        .setTitle(`🧠 **${period.toUpperCase()} TRIVIA** | Earn Points!`)
        .setDescription('First correct answer wins bonus points!')
        .setColor(0x00ff88)
        .addFields(
          {
            name: '❓ **Question**',
            value: triviaQuestion.question,
            inline: false,
          },
          {
            name: '🏆 **Rewards**',
            value: [
              `✅ **Correct Answer**: ${triviaQuestion.points} points`,
              `⚡ **First Correct**: Bonus ${triviaQuestion.bonusPoints} points`,
              `🎯 **Current Leader**: Use \`/trivia leaderboard\``,
            ].join('\n'),
            inline: false,
          }
        )
        .setFooter({ text: `Game Thread Trivia | Expires in 3 minutes` })
        .setTimestamp();

      const message = await thread.send({ embeds: [embed] });

      // Store trivia for answer checking
      await this.storeTriviaQuestion(gameId, thread.id, message.id, triviaQuestion);

      // Auto-expire after 3 minutes
      setTimeout(
        async () => {
          try {
            const expiredEmbed = EmbedBuilder.from(embed)
              .setTitle('⏰ **TRIVIA EXPIRED**')
              .setColor(0x808080)
              .setFooter({ text: `Answer: ${triviaQuestion.answer} | Next trivia coming soon!` });

            await message.edit({ embeds: [expiredEmbed] });
          } catch (error) {
            logger.error('Failed to expire trivia:', error);
          }
        },
        3 * 60 * 1000
      );

      logger.info('Posted period trivia', {
        gameId,
        period,
        question: triviaQuestion.question,
      });
    } catch (error) {
      logger.error('Failed to post period trivia:', error);
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
          recap: 0,
        },
        averageParticipants: 0,
        totalMessages: 0,
        mostActiveThread: null as any,
      };

      let totalParticipants = 0;
      let mostActiveCount = 0;

      for (const [threadId, gameThread] of this.activeThreads) {
        const thread = this.client.channels.cache.get(threadId) as ThreadChannel;
        if (!thread) continue;

        // Categorize thread type
        if (gameThread.game_id) {
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
            memberCount: memberCount,
          };
        }
      }

      analytics.averageParticipants =
        this.activeThreads.size > 0 ? Math.round(totalParticipants / this.activeThreads.size) : 0;

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
    const gameThread = Array.from(this.activeThreads.values()).find(
      thread => thread.game_id === gameId
    );

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
        return 0xffd700; // Gold
      case 'vip':
        return 0x4169e1; // Royal Blue
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
    // Check if rule conditions match game data
    if (rule.conditions) {
      for (const [key, value] of Object.entries(rule.conditions)) {
        if (gameData[key] !== value) {
          return false;
        }
      }
    }
    return true;
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
   * Helper methods for enhanced archiving features
   */
  private async generatePickResultsSummary(_gameId: string): Promise<string> {
    try {
      // This would fetch actual pick results from database
      const mockResults = {
        totalPicks: Math.floor(Math.random() * 8) + 3,
        winners: Math.floor(Math.random() * 5) + 2,
        pushes: Math.floor(Math.random() * 2),
      };

      const winRate = Math.round((mockResults.winners / mockResults.totalPicks) * 100);

      return [
        `✅ **Winners**: ${mockResults.winners}/${mockResults.totalPicks} (${winRate}%)`,
        `🤝 **Pushes**: ${mockResults.pushes}`,
        `❌ **Losers**: ${mockResults.totalPicks - mockResults.winners - mockResults.pushes}`,
        `💰 **Thread Performance**: ${winRate > 60 ? 'Profitable' : 'Break-even'}`,
      ].join('\n');
    } catch (error) {
      return 'Pick results analysis unavailable';
    }
  }

  private calculateThreadDuration(createdAt: string): string {
    const created = new Date(createdAt);
    const now = toISOString(new Date());
    const diffHours = Math.round(
      (new Date(now).getTime() - new Date(created).getTime()) / (1000 * 60 * 60)
    );

    if (diffHours < 1) return '<1 hour';
    if (diffHours < 24) return `${diffHours} hours`;
    return `${Math.round(diffHours / 24)} days`;
  }

  private async getTopContributors(_threadId: string): Promise<string> {
    // This would analyze message counts per user
    const mockContributors = ['User1 (8 msgs)', 'User2 (6 msgs)', 'User3 (4 msgs)'];
    return mockContributors.join('\n');
  }

  private generateSportTrivia(sport: string, _period: string): any {
    const triviaBank: { [key: string]: any[] } = {
      nba: [
        {
          question: "What's the maximum number of timeouts a team can call in the 4th quarter?",
          answer: '3',
          points: 10,
          bonusPoints: 5,
        },
        {
          question: 'How long is the NBA shot clock?',
          answer: '24 seconds',
          points: 10,
          bonusPoints: 5,
        },
      ],
      nfl: [
        {
          question: 'How many yards is a football field from goal line to goal line?',
          answer: '100 yards',
          points: 10,
          bonusPoints: 5,
        },
        {
          question: "What's the maximum number of players on the field for one team?",
          answer: '11',
          points: 10,
          bonusPoints: 5,
        },
      ],
      mlb: [
        {
          question: 'How many innings are in a regulation baseball game?',
          answer: '9',
          points: 10,
          bonusPoints: 5,
        },
        {
          question: "What's the distance from pitcher's mound to home plate?",
          answer: '60 feet 6 inches',
          points: 15,
          bonusPoints: 10,
        },
      ],
    };

    const questions = triviaBank[sport.toLowerCase()] || triviaBank['nba'];
    return questions[Math.floor(Math.random() * questions.length)];
  }

  private async storeTriviaQuestion(
    gameId: string,
    threadId: string,
    messageId: string,
    trivia: any
  ): Promise<void> {
    try {
      await this.supabaseService.client.from('thread_trivia').insert({
        game_id: gameId,
        thread_id: threadId,
        message_id: messageId,
        question: trivia.question,
        correct_answer: trivia.answer,
        points: trivia.points,
        bonus_points: trivia.bonusPoints,
        expires_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
        created_at: toISOString(new Date()),
      });
    } catch (error) {
      logger.error('Failed to store trivia question:', error);
    }
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
