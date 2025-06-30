import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
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
import { OnboardingService } from './services/onboardingService';
import { ComprehensiveOnboardingService } from './services/comprehensiveOnboardingService';
import { AdminDashboardService } from './services/adminDashboardService';
import { AdminCommands } from './commands/adminCommands';
import { CommandHandler } from './handlers/commandHandler';
import { EventHandler } from './handlers/eventHandler';
import { InteractionHandler } from './handlers/interactionHandler';
import { OnboardingButtonHandler } from './handlers/onboardingButtonHandler';
import { CapperSystem, createCapperSystem, CapperSystemConfig } from './services/capperSystem';
import { FAQService } from './services/faqService';
import { DiscordOnboardingAgent } from './agents/DiscordOnboardingAgent';

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
  private comprehensiveOnboardingService!: ComprehensiveOnboardingService;
  private onboardingButtonHandler!: OnboardingButtonHandler;
  private adminDashboardService!: AdminDashboardService;
  private adminCommands!: AdminCommands;
  private commandHandler!: CommandHandler;
  private eventHandler!: EventHandler;
  private interactionHandler!: InteractionHandler;
  private faqService!: FAQService;
  private capperSystem!: CapperSystem;
  private discordOnboardingAgent!: DiscordOnboardingAgent;

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

    // Initialize services and setup handlers asynchronously
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
   * Initialize all bot services
   */
  private async initializeServices(): Promise<void> {
    try {
      console.log('🔧 Initializing core services...');

      // Core services
      this.supabaseService = new SupabaseService();
      this.permissionsService = new PermissionsService();

      console.log('✅ Core services initialized');
      console.log('🔧 Initializing analytics service...');

      // Initialize analytics service first (needed by other services)
      this.advancedAnalyticsService = new AdvancedAnalyticsService(
        this.client,
        this.supabaseService
      );

      console.log('✅ Analytics service initialized');
      console.log('🔧 Initializing feature services...');

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

      this.aiPoweredService = new AIPoweredService(
        this.client,
        this.supabaseService,
        this.permissionsService
      );

      console.log('✅ Feature services initialized');
      console.log('🔧 Initializing onboarding services...');

      // Onboarding services
      this.onboardingService = new OnboardingService();

      // Discord Onboarding Agent - NEW!
      this.discordOnboardingAgent = new DiscordOnboardingAgent();
      await this.discordOnboardingAgent.initialize();

      // Comprehensive onboarding service with tier-based flows
      this.comprehensiveOnboardingService = new ComprehensiveOnboardingService(
        this.client,
        this.supabaseService,
        this.permissionsService,
        this.advancedAnalyticsService
      );

      // Onboarding button handler
      this.onboardingButtonHandler = new OnboardingButtonHandler();

      this.adminDashboardService = new AdminDashboardService(
        this.client,
        this.supabaseService,
        this.permissionsService,
        this.onboardingService,
        this.advancedAnalyticsService
      );

      console.log('✅ Onboarding services initialized');
      console.log('🔧 Initializing admin services...');

      // Admin services
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

      this.adminCommands = new AdminCommands(
        this.adminDashboardService,
        null, // this.onboardingService,
        this.advancedAnalyticsService,
        this.permissionsService
      );

      console.log('✅ Admin services initialized');
      console.log('🔧 Initializing capper system...');

      // Initialize Capper System
      const capperConfig: CapperSystemConfig = {
        discordClient: this.client,
        publishingChannelId: process.env.CAPPER_PICKS_CHANNEL_ID || '',
        enabled: process.env.CAPPER_SYSTEM_ENABLED === 'true'
      };

      this.capperSystem = createCapperSystem(capperConfig);
      await this.capperSystem.initialize();

      console.log('✅ Capper system initialized');
      console.log('🔧 Initializing FAQ service...');

      // FAQ Service
      this.faqService = new FAQService(this.client);

      console.log('✅ FAQ service initialized');
      console.log('🔧 Initializing handlers...');

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

      console.log('✅ All handlers initialized');
      logger.info('All services initialized successfully');
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
      onboardingService: this.onboardingService,
      comprehensiveOnboardingService: this.comprehensiveOnboardingService,
      onboardingButtonHandler: this.onboardingButtonHandler,
      adminDashboardService: this.adminDashboardService,
      capperSystem: this.capperSystem,
      faqService: this.faqService,
      discordOnboardingAgent: this.discordOnboardingAgent
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
            activities: [{
              name: 'Unit Talk Community',
              type: 3 // Watching
            }],
            status: 'online'
          });
        }
        console.log('✅ Bot presence set to online');
      } catch (error) {
        console.log('⚠️ Failed to set bot presence:', error);
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
        await this.advancedAnalyticsService.logError(
          error instanceof Error ? error : new Error(String(error)),
          'message_handling'
        );
      }
    });

    // Member events
    this.client.on('guildMemberAdd', async (member) => {
      try {
        console.log(`👋 New member joined: ${member.user.username} (${member.id})`);

        // Use Discord Onboarding Agent for enhanced onboarding
        await this.discordOnboardingAgent.handleNewMemberOnboarding(member);

        // Legacy handlers for backward compatibility
        await this.eventHandler.handleMemberJoin(member);
        await this.vipNotificationService.handleNewMember(member);
      } catch (error) {
        logger.error('Error handling member join:', error);
        await this.advancedAnalyticsService.logError(
          error instanceof Error ? error : new Error(String(error)),
          'member_join'
        );
      }
    });

    this.client.on('guildMemberUpdate', async (oldMember, newMember) => {
      try {
        // Ensure we have full member objects, not partial ones
        if (oldMember.partial) {
          oldMember = await oldMember.fetch();
        }
        if (newMember.partial) {
          newMember = await newMember.fetch();
        }

        // Use Discord Onboarding Agent for enhanced role change handling
        await this.discordOnboardingAgent.handleRoleChangeOnboarding(oldMember, newMember);

        await this.eventHandler.handleMemberUpdate(oldMember, newMember);

        // Role change handling is now done in roleChangeService.ts to avoid duplicates
        // The roleChangeService will handle tier changes and notifications
      } catch (error) {
        logger.error('Error handling member update:', error);
        await this.advancedAnalyticsService.logError(
          error instanceof Error ? error : new Error(String(error)),
          'member_update'
        );
      }
    });

    // Thread events
    this.client.on('threadCreate', async (thread) => {
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
    this.client.on('interactionCreate', async (interaction) => {
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
    this.client.on('error', async (error) => {
      logger.error('Discord client error:', error);
      await this.advancedAnalyticsService.logError(error, 'discord_client');
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
        const stats = await this.advancedAnalyticsService.getRealTimeStats();
        await this.advancedAnalyticsService.sendDashboardUpdate(stats);
      } catch (error) {
        logger.error('Failed to send dashboard update:', error);
      }
    }, 30 * 60 * 1000);

    // Cleanup old analytics data every 24 hours
    setInterval(async () => {
      try {
        await this.advancedAnalyticsService.cleanupOldData();
        logger.info('Analytics data cleanup completed');
      } catch (error) {
        logger.error('Failed to cleanup analytics data:', error);
      }
    }, 24 * 60 * 60 * 1000);

    // Update bot presence every 5 minutes
    setInterval(async () => {
      try {
        const stats = await this.advancedAnalyticsService.getRealTimeStats();
        if (this.client.user) {
          this.client.user.setPresence({
            activities: [{
              name: `${stats.totalUsers} members | ${stats.totalMessages} messages`,
              type: 3 // Watching
            }],
            status: 'online'
          });
        }
      } catch (error) {
        logger.error('Failed to update bot presence:', error);
      }
    }, 5 * 60 * 1000);

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
      const token = process.env.DISCORD_BOT_TOKEN;
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
}

// Create and start the bot
console.log('🏗️ Creating bot instance...');
const bot = new UnitTalkBot();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
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