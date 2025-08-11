import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, GuildMember } from 'discord.js';
import { logger } from './utils/logger';
import { registerCommands } from './utils/registerCommands';
import { SupabaseService } from './services/supabase';
import { PermissionsService } from './services/permissions';
import { VIPNotificationService } from './services/vipNotificationService';
import { AutomatedThreadService } from './services/automatedThreadService';
import { KeywordEmojiDMService } from './services/keywordEmojiDMService';
import { AdvancedAnalyticsService } from './services/advancedAnalyticsService';
import { AIPoweredService } from './services/aiPoweredService';
import { AdminOverrideService } from './services/adminOverrideService';
import { QuickEditConfigService } from './services/quickEditConfigService';
import { OnboardingService } from './services/onboardingService';
import { OnboardingButtonHandler } from './handlers/onboardingButtonHandler';
import { WelcomeService } from './services/welcomeService';
// REMOVED: AutomatedOnboardingIntegration - nuked as part of clean slate rebuild
import { WelcomeButtonHandler } from './handlers/welcomeButtonHandler';
import { ContentButtonHandler } from './handlers/contentButtonHandler';
import { AdminDashboardService } from './services/adminDashboardService';
import { AdminCommands } from './commands/adminCommands';
import { FAQService } from './services/faqService';
import { CommandHandler } from './handlers/commandHandler';
import { EventHandler } from './handlers/eventHandler';
import { InteractionHandler } from './handlers/interactionHandler';
import { createCapperSystem, CapperSystemConfig } from './services/capperSystem';
import { interactiveTutorial, handleTutorialButton } from './commands/interactive-tutorial';
import { enhancedHelp, handleHelpButton } from './commands/enhanced-help';
import { DMService } from './services/dmService';
import { RoleChangeService } from './services/roleChangeService';

// Add startup logging
console.log('🚀 Unit Talk Discord Bot starting...');
console.log('📋 Loading environment configuration...');

export class UnitTalkBot {
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
  private onboardingService!: OnboardingService;
  private dmService!: DMService;
  private roleChangeService!: RoleChangeService;
  // REMOVED: automatedOnboardingIntegration - nuked as part of clean slate rebuild
  private onboardingButtonHandler!: OnboardingButtonHandler;
  private welcomeService!: WelcomeService;
  private welcomeButtonHandler!: WelcomeButtonHandler;
  private contentButtonHandler!: ContentButtonHandler;
  private adminDashboardService!: AdminDashboardService;
  private adminCommands!: AdminCommands;
  private faqService!: FAQService;
  private commandHandler!: CommandHandler;
  private eventHandler!: EventHandler;
  private interactionHandler!: InteractionHandler;
  private capperSystem: any;

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
        GatewayIntentBits.GuildPresences,
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember,
      ],
    });

    // Initialize core services first
    this.supabaseService = new SupabaseService();
    this.permissionsService = new PermissionsService();
    this.dmService = new DMService(this.client, this.supabaseService);
    this.onboardingService = new OnboardingService(this.client, this.dmService);
    this.vipNotificationService = new VIPNotificationService(
      this.client,
      this.supabaseService,
      this.permissionsService
    );
    this.roleChangeService = new RoleChangeService(
      this.client,
      this.vipNotificationService,
      this.onboardingService
    );
    
    // REMOVED: AI onboarding integration - nuked as part of clean slate rebuild

    // Initialize handlers with the core services
    this.eventHandler = new EventHandler(
      this.client,
      this.supabaseService,
      this.dmService,
      this.onboardingService,
      this.vipNotificationService,
      this.roleChangeService
    );

    // Initialize command handler
    this.commandHandler = new CommandHandler(this.supabaseService);

    // Initialize interaction handler with correct parameters
    this.interactionHandler = new InteractionHandler(
      this.client,
      this.supabaseService,
      this.permissionsService,
      this.getAllServices()
    );

    // Initialize remaining services
    this.initialize();
  }

  /**
   * Initialize the bot asynchronously
   */
  private async initialize(): Promise<void> {
    try {
      await this.initializeServices();
      this.setupEventHandlers();
    } catch (error) {
      logger.error('Failed to initialize bot:', error);
      process.exit(1);
    }
  }

  /**
   * Initialize all bot services with parallel loading for performance
   */
  private async initializeServices(): Promise<void> {
    try {
      console.log('🔧 Initializing remaining services (parallel loading)...');
      const startTime = Date.now();

      // Initialize lightweight services first (synchronous)
      this.onboardingButtonHandler = new OnboardingButtonHandler(this.client);
      this.welcomeButtonHandler = new WelcomeButtonHandler();
      this.welcomeService = new WelcomeService();

      // Initialize heavy services in parallel for faster startup
      const [
        advancedAnalyticsService,
        automatedThreadService,
        keywordEmojiDMService,
        aiPoweredService,
      ] = await Promise.all([
        // Core feature services
        Promise.resolve(new AdvancedAnalyticsService(this.client, this.supabaseService)),
        Promise.resolve(
          new AutomatedThreadService(this.client, this.supabaseService, this.permissionsService)
        ),
        Promise.resolve(
          new KeywordEmojiDMService(this.client, this.supabaseService, this.permissionsService)
        ),
        Promise.resolve(
          new AIPoweredService(this.client, this.supabaseService, this.permissionsService)
        ),
      ]);

      // Assign initialized services
      this.advancedAnalyticsService = advancedAnalyticsService;
      this.automatedThreadService = automatedThreadService;
      this.keywordEmojiDMService = keywordEmojiDMService;
      this.aiPoweredService = aiPoweredService;

      // Initialize admin services that depend on other services (sequential)
      this.adminDashboardService = new AdminDashboardService(
        this.client,
        this.supabaseService,
        this.permissionsService,
        this.onboardingService,
        this.advancedAnalyticsService
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

      const initTime = Date.now() - startTime;
      console.log(`✅ All services initialized in ${initTime}ms`);
      logger.info(`All services initialized successfully in ${initTime}ms`);
    } catch (error) {
      console.error('❌ Failed to initialize services:', error);
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
      quickEditConfigService: this.quickEditConfigService,
      onboardingButtonHandler: this.onboardingButtonHandler,
      adminDashboardService: this.adminDashboardService,
      capperSystem: this.capperSystem,
      faqService: this.faqService,
      permissionsService: this.permissionsService,
      commandHandler: this.commandHandler,
      dmService: this.dmService,
      onboardingService: this.onboardingService,
      // discordOnboardingAgent: this.discordOnboardingAgent // Temporarily disabled
    };
  }

  /**
   * Setup Discord event handlers
   */
  private setupEventHandlers(): void {
    // Bot ready event
    this.client.once('ready', async () => {
      console.log(`🤖 Bot online: ${this.client.user?.tag}`);
      console.log(`🏠 Serving ${this.client.guilds.cache.size} guilds`);
      logger.info(`Bot logged in as ${this.client.user?.tag}`);
      logger.info(`Serving ${this.client.guilds.cache.size} guilds`);

      // Set bot presence/status
      try {
        if (this.client.user) {
          this.client.user.setPresence({
            activities: [
              {
                name: 'Unit Talk Community',
                type: 3, // Watching
              },
            ],
            status: 'online',
          });
        }
        console.log('✅ Bot presence set to online');
      } catch (error) {
        console.log('⚠️ Failed to set bot presence:', error);
      }

      // Register slash commands
      console.log('🔧 Registering slash commands...');
      try {
        await registerCommands();
        console.log('✅ Slash commands registered successfully');
      } catch (error) {
        console.error('❌ Failed to register commands:', error);
      }

      // Initialize services that need the client to be ready
      console.log('🔧 Running post-ready initialization...');
      await this.postReadyInitialization();

      // Start periodic tasks
      console.log('⏰ Starting periodic tasks...');
      this.startPeriodicTasks();

      console.log('🎉 Unit Talk Discord Bot is fully operational!');
      logger.info('Unit Talk Discord Bot is fully operational!');
    });

    // Message events
    this.client.on('messageCreate', async message => {
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
        await this.advancedAnalyticsService.logError(
          error instanceof Error ? error : new Error(String(error)),
          'message_handling'
        );
      }
    });

    // Member events
    this.client.on('guildMemberAdd', async member => {
      try {
        console.log(`👋 New member joined: ${member.user.username} (${member.id})`);

        // REMOVED: AI onboarding - nuked as part of clean slate rebuild
        // New onboarding system will be implemented here

        // Handle user profile creation and analytics tracking
        await this.createUserProfileAndTrackJoin(member);
      } catch (error) {
        logger.error('Error handling member join:', error);
        await this.advancedAnalyticsService.logError(
          error instanceof Error ? error : new Error(String(error)),
          'member_join'
        );
      }
    });

    this.client.on('guildMemberUpdate', async (oldMember, newMember) => {
      console.log('[DEBUG] guildMemberUpdate event fired', {
        oldId: oldMember.id,
        newId: newMember.id,
        oldPartial: oldMember.partial,
        newPartial: newMember.partial,
      });
      try {
        // Ensure we have full member objects, not partial ones
        if (oldMember.partial) {
          oldMember = await oldMember.fetch();
        }
        if (newMember.partial) {
          newMember = await newMember.fetch();
        }
        console.log('[DEBUG] Calling eventHandler.handleMemberUpdate', {
          handlerType: typeof this.eventHandler,
          handlerExists: !!this.eventHandler,
        });
        await this.eventHandler.handleMemberUpdate(oldMember, newMember);
      } catch (error) {
        logger.error('Error handling member update:', error);
        await this.advancedAnalyticsService.logError(
          error instanceof Error ? error : new Error(String(error)),
          'member_update'
        );
      }
    });

    // Thread events
    this.client.on('threadCreate', async thread => {
      try {
        await this.eventHandler.handleThreadCreate(thread);
        this.advancedAnalyticsService.incrementThreadCount(thread.parentId || 'unknown');
      } catch (error) {
        logger.error('Error handling thread create:', error);
        await this.advancedAnalyticsService.logError(
          error instanceof Error ? error : new Error(String(error)),
          'thread_create'
        );
      }
    });

    // Interaction events
    this.client.on('interactionCreate', async interaction => {
      try {
        await this.interactionHandler.handleInteraction(interaction);

        if (interaction.isCommand()) {
          this.advancedAnalyticsService.incrementCommandCount(interaction.commandName);
        }
      } catch (error) {
        logger.error('Error handling interaction:', error);
        await this.advancedAnalyticsService.logError(
          error instanceof Error ? error : new Error(String(error)),
          'interaction_handling'
        );
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
        await this.advancedAnalyticsService.logError(
          error instanceof Error ? error : new Error(String(error)),
          'reaction_add'
        );
      }
    });

    // Error handling
    this.client.on('error', async error => {
      logger.error('Discord client error:', error);
      await this.advancedAnalyticsService.logError(error, 'discord_client');
    });

    this.client.on('warn', warning => {
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
    setInterval(
      async () => {
        try {
          const stats = await this.advancedAnalyticsService.getRealTimeStats();
          await this.advancedAnalyticsService.sendDashboardUpdate(stats);
        } catch (error) {
          logger.error('Failed to send dashboard update:', error);
        }
      },
      30 * 60 * 1000
    );

    // Cleanup old analytics data every 24 hours
    setInterval(
      async () => {
        try {
          await this.advancedAnalyticsService.cleanupOldData();
          logger.info('Analytics data cleanup completed');
        } catch (error) {
          logger.error('Failed to cleanup analytics data:', error);
        }
      },
      24 * 60 * 60 * 1000
    );

    // Update bot presence every 5 minutes
    setInterval(
      async () => {
        try {
          const stats = await this.advancedAnalyticsService.getRealTimeStats();
          if (this.client.user) {
            this.client.user.setPresence({
              activities: [
                {
                  name: `${stats.totalUsers} members | ${stats.totalMessages} messages`,
                  type: 3, // Watching
                },
              ],
              status: 'online',
            });
          }
        } catch (error) {
          logger.error('Failed to update bot presence:', error);
        }
      },
      5 * 60 * 1000
    );

    logger.info('Periodic tasks started');
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
    } catch (error: unknown) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Start the bot by logging into Discord
   */
  async start(): Promise<void> {
    try {
      const token = process.env['DISCORD_BOT_TOKEN'];
      if (!token) {
        throw new Error('DISCORD_BOT_TOKEN environment variable is not set');
      }

      logger.info('Logging into Discord...');
      await this.client.login(token);
      logger.info('Bot successfully logged into Discord');
    } catch (error: unknown) {
      logger.error('Failed to start bot:', error);
      throw error;
    }
  }

  // REMOVED: Public accessor for AI onboarding integration - nuked as part of clean slate rebuild

  /**
   * Helper method to create user profile and track join event without sending welcome messages
   */
  private async createUserProfileAndTrackJoin(member: GuildMember): Promise<void> {
    try {
      // Create user profile
      await this.supabaseService.createUserProfile({
        discord_id: member.id,
        username: member.user.username,
        tier: 'member',
      });

      // Track join event
      await this.advancedAnalyticsService.logEvent('member_joined', member.id, {
        guildId: member.guild.id,
        username: member.user.username,
        joinedAt: member.joinedAt?.toISOString(),
        accountCreated:
          typeof member.user.createdAt === 'string'
            ? member.user.createdAt
            : new Date(member.user.createdAt).toISOString(),
      });

      logger.info(`User profile created and join tracked: ${member.user.username} (${member.id})`);
    } catch (error) {
      logger.error('Error creating user profile and tracking join:', error);
    }
  }
}

// Create and start the bot
console.log('🏗️ Creating bot instance...');
const bot = new UnitTalkBot();

// Export for interaction handler access
export { bot };

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  console.error('💥 Uncaught Exception:', error);
  logger.error('Uncaught Exception:', error);
  bot.shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  bot.shutdown();
});

// Start the bot
console.log('🚀 Starting bot...');
bot.start().catch((error: any) => {
  console.error('💥 Failed to start bot:', error);
  logger.error('Failed to start bot:', error);
  process.exit(1);
});

export default bot;
