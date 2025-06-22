import { Client, GatewayIntentBits, Partials, GuildMember } from 'discord.js';
import { botConfig } from './config';
import { logger } from './utils/logger';
import { SupabaseService } from './services/supabase';
import { PermissionsService } from './services/permissions';
import { VIPNotificationService } from './services/vipNotificationService';
import { AutomatedThreadService } from './services/automatedThreadService';
import { KeywordEmojiDMService } from './services/keywordEmojiDMService';
import { AdvancedAnalyticsService } from './services/advancedAnalyticsService';
import { AIPoweredService } from './services/aiPoweredService';
import { AdminOverrideService } from './services/adminOverrideService';
import { QuickEditConfigService } from './services/quickEditConfigService';
import { CommandHandler } from './handlers/commandHandler';
import { EventHandler } from './handlers/eventHandler';
import { InteractionHandler } from './handlers/interactionHandler';

class UnitTalkBot {
  private client: Client;
  private supabaseService!: SupabaseService;
  private permissionsService!: PermissionsService;
  private vipNotificationService!: VIPNotificationService;
  private automatedThreadService!: AutomatedThreadService;
  private keywordEmojiDMService!: KeywordEmojiDMService;
  private advancedAnalyticsService!: AdvancedAnalyticsService;
  private aiPoweredService!: AIPoweredService;
  private adminOverrideService!: AdminOverrideService;
  private quickEditConfigService!: QuickEditConfigService;
  private commandHandler!: CommandHandler;
  private eventHandler!: EventHandler;
  private interactionHandler!: InteractionHandler;

  constructor() {
    // Initialize Discord client with required intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember
      ]
    });

    this.initializeServices();
    this.setupEventHandlers();
  }

  /**
   * Initialize all bot services
   */
  private initializeServices(): void {
    try {
      // Core services
      this.supabaseService = new SupabaseService();
      this.permissionsService = new PermissionsService();

      // Feature services
      this.vipNotificationService = new VIPNotificationService(
        this.client,
        this.supabaseService,
        this.permissionsService
      );

      this.automatedThreadService = new AutomatedThreadService(
        this.client,
        this.supabaseService,
        this.permissionsService
      );

      this.keywordEmojiDMService = new KeywordEmojiDMService(
        this.client,
        this.supabaseService,
        this.permissionsService
      );

      this.advancedAnalyticsService = new AdvancedAnalyticsService(
        this.client,
        this.supabaseService,
        this.permissionsService
      );

      this.aiPoweredService = new AIPoweredService(
        this.client,
        this.supabaseService,
        this.permissionsService
      );

      this.adminOverrideService = new AdminOverrideService(
        this.client,
        this.supabaseService,
        this.permissionsService,
        this.advancedAnalyticsService,
        this.keywordEmojiDMService,
        this.automatedThreadService,
        this.vipNotificationService,
        this.aiPoweredService
      );

      this.quickEditConfigService = new QuickEditConfigService(
        this.client,
        this.supabaseService,
        this.permissionsService,
        this.keywordEmojiDMService,
        this.automatedThreadService,
        this.vipNotificationService
      );

      // Handlers
      this.commandHandler = new CommandHandler(
        this.client,
        this.supabaseService,
        this.permissionsService,
        this.getAllServices()
      );

      this.eventHandler = new EventHandler(
        this.client,
        this.supabaseService,
        this.permissionsService,
        this.getAllServices()
      );

      this.interactionHandler = new InteractionHandler(
        this.client,
        this.supabaseService,
        this.permissionsService,
        this.getAllServices()
      );

      logger.info('All services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Get all services for handlers
   */
  private getAllServices() {
    return {
      vipNotificationService: this.vipNotificationService,
      automatedThreadService: this.automatedThreadService,
      keywordEmojiDMService: this.keywordEmojiDMService,
      advancedAnalyticsService: this.advancedAnalyticsService,
      aiPoweredService: this.aiPoweredService,
      adminOverrideService: this.adminOverrideService,
      quickEditConfigService: this.quickEditConfigService
    };
  }

  /**
   * Setup Discord event handlers
   */
  private setupEventHandlers(): void {
    // Bot ready event
    this.client.once('ready', async () => {
      logger.info(`Bot logged in as ${this.client.user?.tag}`);
      logger.info(`Serving ${this.client.guilds.cache.size} guilds`);
      
      // Initialize services that need the client to be ready
      await this.postReadyInitialization();
      
      // Start periodic tasks
      this.startPeriodicTasks();
      
      logger.info('Unit Talk Discord Bot is fully operational!');
    });

    // Message events
    this.client.on('messageCreate', async (message) => {
      try {
        await this.eventHandler.handleMessage(message);
        
        // Track analytics
        this.advancedAnalyticsService.incrementMessageCount(message.channelId);
        
        // Check for keyword/emoji triggers
        if (!message.author.bot) {
          await this.keywordEmojiDMService.processMessageForKeywords(message);
        }
      } catch (error) {
        logger.error('Error handling message:', error);
        await this.advancedAnalyticsService.logError(error, {
          messageId: message.id,
          channelId: message.channelId,
          userId: message.author.id
        });
      }
    });

    // Member events
    this.client.on('guildMemberAdd', async (member) => {
      try {
        await this.eventHandler.handleMemberJoin(member);
        await this.vipNotificationService.handleNewMember(member);
      } catch (error) {
        logger.error('Error handling member join:', error);
        await this.advancedAnalyticsService.logError(error, {
          userId: member.id,
          guildId: member.guild.id
        });
      }
    });

    this.client.on('guildMemberUpdate', async (oldMember, newMember) => {
      try {
        await this.eventHandler.handleMemberUpdate(oldMember, newMember);

        // Check for tier changes
        const oldTier = this.permissionsService.getUserTier(oldMember as GuildMember);
        const newTier = this.permissionsService.getUserTier(newMember);

        if (oldTier !== newTier) {
          await this.vipNotificationService.handleTierChange(newMember, oldTier, newTier);
        }
      } catch (error) {
        logger.error('Error handling member update:', error);
        await this.advancedAnalyticsService.logError(error, {
          userId: newMember.id,
          guildId: newMember.guild.id
        });
      }
    });

    // Thread events
    this.client.on('threadCreate', async (thread) => {
      try {
        await this.eventHandler.handleThreadCreate(thread);
        this.advancedAnalyticsService.incrementThreadCount();
      } catch (error) {
        logger.error('Error handling thread create:', error);
        await this.advancedAnalyticsService.logError(error, {
          threadId: thread.id,
          channelId: thread.parentId
        });
      }
    });

    // Interaction events
    this.client.on('interactionCreate', async (interaction) => {
      try {
        await this.interactionHandler.handleInteraction(interaction);
        
        if (interaction.isCommand()) {
          this.advancedAnalyticsService.incrementCommandCount();
        }
      } catch (error) {
        logger.error('Error handling interaction:', error);
        await this.advancedAnalyticsService.logError(error, {
          interactionId: interaction.id,
          userId: interaction.user.id,
          channelId: interaction.channelId
        });
      }
    });

    // Reaction events for emoji triggers
    this.client.on('messageReactionAdd', async (reaction, user) => {
      try {
        if (!user.bot) {
          await this.keywordEmojiDMService.processReaction(reaction, user);
        }
      } catch (error) {
        logger.error('Error handling reaction add:', error);
        await this.advancedAnalyticsService.logError(error, {
          messageId: reaction.message.id,
          userId: user.id,
          emoji: reaction.emoji.name
        });
      }
    });

    // Error handling
    this.client.on('error', async (error) => {
      logger.error('Discord client error:', error);
      await this.advancedAnalyticsService.logError(error, { source: 'discord_client' });
    });

    this.client.on('warn', (warning) => {
      logger.warn('Discord client warning:', warning);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      this.shutdown();
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      this.shutdown();
    });
  }

  /**
   * Post-ready initialization for services that need the client to be ready
   */
  private async postReadyInitialization(): Promise<void> {
    try {
      // Initialize VIP notification flows
      await this.vipNotificationService.initializeNotificationFlows();
      
      // Load thread creation rules
      await this.automatedThreadService.loadThreadRules();
      
      // Load keyword and emoji triggers
      await this.keywordEmojiDMService.loadTriggers();
      
      // Start analytics collection
      await this.advancedAnalyticsService.getRealTimeStats();
      
      logger.info('Post-ready initialization completed');
    } catch (error) {
      logger.error('Post-ready initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start periodic tasks
   */
  private startPeriodicTasks(): void {
    // Send analytics dashboard updates every 30 minutes
    setInterval(async () => {
      try {
        await this.advancedAnalyticsService.sendDashboardUpdate();
      } catch (error) {
        logger.error('Failed to send dashboard update:', error);
      }
    }, 30 * 60 * 1000);

    // Process VIP notification queue every 5 minutes
    setInterval(async () => {
      try {
        await this.vipNotificationService.processNotificationQueue();
      } catch (error) {
        logger.error('Failed to process VIP notification queue:', error);
      }
    }, 5 * 60 * 1000);

    // Clean up expired cooldowns every hour
    setInterval(async () => {
      try {
        await this.cleanupExpiredCooldowns();
      } catch (error) {
        logger.error('Failed to cleanup expired cooldowns:', error);
      }
    }, 60 * 60 * 1000);

    // Health check every 15 minutes
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, 15 * 60 * 1000);

    logger.info('Periodic tasks started');
  }

  /**
   * Clean up expired cooldowns
   */
  private async cleanupExpiredCooldowns(): Promise<void> {
    try {
      await this.supabaseService.client
        .from('user_cooldowns')
        .delete()
        .lt('expires_at', new Date().toISOString());
      
      logger.info('Cleaned up expired cooldowns');
    } catch (error) {
      logger.error('Failed to cleanup expired cooldowns:', error);
    }
  }

  /**
   * Perform system health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const healthStatus = {
        timestamp: new Date().toISOString(),
        discord: {
          connected: this.client.isReady(),
          ping: this.client.ws.ping,
          guilds: this.client.guilds.cache.size
        },
        database: await this.checkDatabaseHealth(),
        memory: process.memoryUsage(),
        uptime: process.uptime()
      };

      // Log health status
      logger.info('Health check completed:', healthStatus);

      // Store health check in database
      await this.supabaseService.client
        .from('system_health_checks')
        .insert({
          timestamp: healthStatus.timestamp,
          performed_by: 'system',
          discord: healthStatus.discord,
          database: healthStatus.database,
          memory: healthStatus.memory,
          uptime: healthStatus.uptime,
          errors: [],
          recommendations: []
        });

    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<any> {
    try {
      const start = Date.now();
      const { data, error } = await this.supabaseService.client
        .from('user_profiles')
        .select('count')
        .limit(1);

      const responseTime = Date.now() - start;

      return {
        connected: !error,
        responseTime: responseTime,
        error: error?.message
      };
    } catch (error) {
      return {
        connected: false,
        responseTime: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting Unit Talk Discord Bot...');
      
      // Validate environment variables
      if (!process.env.DISCORD_TOKEN) {
        throw new Error('DISCORD_TOKEN environment variable is required');
      }

      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        throw new Error('Supabase environment variables are required');
      }

      // Login to Discord
      await this.client.login(process.env.DISCORD_TOKEN);
      
    } catch (error) {
      logger.error('Failed to start bot:', error);
      throw error;
    }
  }

  /**
   * Shutdown the bot gracefully
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Unit Talk Discord Bot...');
      
      // Cleanup services
      if (this.advancedAnalyticsService) {
        this.advancedAnalyticsService.destroy();
      }
      
      // Destroy Discord client
      this.client.destroy();
      
      logger.info('Bot shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Create and start the bot
const bot = new UnitTalkBot();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  bot.shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  bot.shutdown();
});

// Start the bot
bot.start().catch((error) => {
  logger.error('Failed to start bot:', error);
  process.exit(1);
});

export default bot;