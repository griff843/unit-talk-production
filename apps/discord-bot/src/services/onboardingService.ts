import {
  Client,
  User,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

import { UserTier, OnboardingSequence, OnboardingMessage } from '../types';
import {
  toISOString,
  toDate,
  getHours,
  getMinutes,
  getFullYear,
  getMonth,
  getDate,
} from '../utils/dateUtils';
import { logger } from '../utils/logger';

import { databaseService } from './database';
import { DMService } from './dmService';

export class OnboardingService {
  private client: Client;
  private dmService: DMService;
  private activeSequences: Map<string, NodeJS.Timeout[]> = new Map();

  constructor(client: Client, dmService: DMService) {
    this.client = client;
    this.dmService = dmService;
    logger.info('OnboardingService initialized with required services');
  }

  /**
   * Handle user onboarding with user type detection and personalization
   */
  async handleUserOnboarding(user: User, tier: string, testMode: boolean = false): Promise<void> {
    logger.info('[ONBOARDING] handleUserOnboarding called', {
      userId: user.id,
      username: user.username,
      tier,
      testMode,
    });
    try {
      logger.info(`Starting onboarding for ${user.username} (${tier})`);

      // Validate services are initialized
      if (!this.dmService) {
        logger.error('[ONBOARDING] DM service not initialized', { userId: user.id });
        throw new Error('DM service not initialized');
      }

      // Cancel any existing onboarding sequence
      logger.info('[ONBOARDING] Cancelling any existing onboarding sequence', { userId: user.id });
      await this.cancelOnboarding(user.id);

      // Create onboarding sequence
      logger.info('[ONBOARDING] Creating onboarding sequence', { userId: user.id, tier });
      const sequence = this.createOnboardingSequence(user, tier);
      if (!sequence || sequence.messages.length === 0) {
        logger.warn('[ONBOARDING] No onboarding sequence for tier', { userId: user.id, tier });
        return;
      }

      logger.info(
        `Starting onboarding sequence for ${user.username} (${tier}) - ${sequence.messages.length} messages`
      );

      // Track onboarding start
      logger.info('[ONBOARDING] Tracking onboarding start', { userId: user.id, tier });
      await this.trackOnboardingStart(user.id, tier);

      if (testMode) {
        logger.info('[ONBOARDING] Test mode enabled, sending all messages immediately', {
          userId: user.id,
        });
        // In test mode, send all messages immediately with 2-second intervals
        await this.sendTestSequence(user, sequence);
      } else {
        logger.info('[ONBOARDING] Normal mode, sending sequence with delays', { userId: user.id });
        // Normal mode with proper delays
        await this.sendSequenceWithDelays(user, sequence);
      }

      // Track onboarding completion
      logger.info('[ONBOARDING] Tracking onboarding completion', { userId: user.id, tier });
      await this.trackOnboardingComplete(user.id, tier);

      logger.info('[ONBOARDING] Onboarding completed successfully', { userId: user.id, tier });
    } catch (error) {
      logger.error('[ONBOARDING] Error in handleUserOnboarding', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: user.id,
        username: user.username,
        tier,
      });

      // Track onboarding failure
      await this.trackOnboardingFailure(user.id, tier, error);
    }
  }

  /**
   * Create onboarding sequence based on user tier
   */
  private createOnboardingSequence(user: User, tier: string): OnboardingSequence | null {
    try {
      // Log the tier being processed
      logger.info(`Creating onboarding sequence for ${user.username} with tier ${tier}`, {
        userId: user.id,
        tier,
        username: user.username,
      });

      let sequence: OnboardingSequence | null = null;

      // Determine user type and create appropriate sequence
      const userType = this.determineUserType(tier);

      switch (userType) {
        case 'capper':
          sequence = this.createCapperSequence(user);
          break;
        case 'admin':
          sequence = this.createAdminSequence(user);
          break;
        case 'trial':
          sequence = this.createPersonalizedTrialDiscovery(user);
          break;
        case 'vip_plus':
          sequence = this.createVIPPlusSequence(user);
          break;
        case 'vip':
          sequence = this.createVIPSequence(user);
          break;
        case 'free':
        default:
          sequence = this.createFreeSequence(user);
          break;
      }

      if (!sequence) {
        logger.error(`Failed to create sequence for ${user.username}`, {
          userId: user.id,
          tier,
        });
        return null;
      }

      // Validate sequence
      if (!sequence.messages || sequence.messages.length === 0) {
        logger.error(`Created empty sequence for ${user.username}`, {
          userId: user.id,
          tier,
        });
        return null;
      }

      // Log sequence details
      logger.info(`Created onboarding sequence for ${user.username}`, {
        userId: user.id,
        tier,
        messageCount: sequence.messages.length,
        messages: sequence.messages.map(m => ({
          title: m.embed.data.title,
          hasComponents: !!m.components,
          delay: m.delay,
        })),
      });

      return sequence;
    } catch (error) {
      logger.error(`Error creating onboarding sequence for ${user.username}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: user.id,
        tier,
      });
      return null;
    }
  }

  /**
   * Create VIP+ onboarding sequence
   */
  private createVIPPlusSequence(user: User): OnboardingSequence {
    try {
      const messages: OnboardingMessage[] = [
        {
          id: `vip_plus_welcome_${Date.now()}`,
          content: null,
          type: 'welcome',
          delay: 0,
          embed: new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💎+ Welcome to VIP+ Elite - The Ultimate Edge')
            .setDescription(
              `${user.username}, you've reached the pinnacle of sports intelligence. Welcome to VIP+ Elite - where institutional-grade analytics meet professional execution.`
            )
            .addFields(
              {
                name: '🏆 Your VIP+ Elite Arsenal',
                value: [
                  '• **AI-Powered Advice Engine** - Real-time pick analysis with OpenAI integration',
                  '• **S/A Tier Picks Only** - Unified edge scoring system filters top opportunities',
                  '• **Market Resistance Analysis** - Sharp money tracking & line movement detection',
                  '• **Professional Data Pipeline** - From ingestion to grading, fully automated',
                ].join('\n'),
                inline: false,
              },
              {
                name: '📊 Elite Technology Stack',
                value: [
                  '• **Enhanced Scoring Algorithm** - Multi-league optimization',
                  '• **Advanced Caching** - Optimized performance',
                  '• **Professional Data Pipeline** - Automated end-to-end',
                  '• **Enterprise Infrastructure** - Built for scale',
                ].join('\n'),
                inline: false,
              }
            )
            .setFooter({ text: 'VIP+ Elite - Technical Excellence | Your Competitive Advantage' })
            .setTimestamp(),
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('setup_vip_plus_alerts')
                .setLabel('⚙️ Configure Alerts')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('view_vip_plus_features')
                .setLabel('🔓 View Features')
                .setStyle(ButtonStyle.Success)
            ),
          ],
        },
      ];

      logger.info(`Created VIP+ sequence for ${user.username}`, {
        userId: user.id,
        messageCount: messages.length,
      });

      return {
        id: `vip_plus_${user.id}_${Date.now()}`,
        userId: user.id,
        tier: 'vip_plus',
        messages,
        totalMessages: messages.length,
        currentMessage: 0,
        isComplete: false,
        startedAt: new Date(),
      };
    } catch (error) {
      logger.error(`Error creating VIP+ sequence for ${user.username}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: user.id,
      });
      throw error;
    }
  }

  /**
   * Determine user type based on tier and other factors
   */
  private determineUserType(tier: string): string {
    const lowerTier = tier.toLowerCase();

    // Map different tier variations to user types
    if (lowerTier.includes('capper') || lowerTier.includes('expert')) {
      return 'capper';
    }
    if (lowerTier.includes('admin') || lowerTier.includes('staff') || lowerTier.includes('mod')) {
      return 'admin';
    }
    if (lowerTier.includes('trial') || lowerTier === 'vip_trial') {
      return 'trial';
    }
    if (lowerTier.includes('vip_plus') || lowerTier.includes('vipplus') || lowerTier === 'vip+') {
      return 'vip_plus';
    }
    if (lowerTier === 'vip') {
      return 'vip';
    }

    return 'free'; // Default fallback
  }

  /**
   * Create Personalized Trial Discovery - The WHY-driven approach
   */
  private createPersonalizedTrialDiscovery(user: User): OnboardingSequence {
    try {
      const messages: OnboardingMessage[] = [
        {
          id: `trial_discovery_${Date.now()}`,
          content: null,
          type: 'discovery',
          delay: 0,
          embed: new EmbedBuilder()
            .setColor('#FF6B35')
            .setTitle('🎩 Welcome to Unit Talk - Your Personal Concierge')
            .setDescription(
              `**Hello ${user.username}**, I'm your Unit Talk Concierge.\n\n` +
                `I'm here to create a **completely personalized** 7-day experience just for you. ` +
                `But first, I need to understand what brought you here.\n\n` +
                `**Why did you decide to try Unit Talk today?**\n` +
                `*Click the option that best describes you - this shapes your entire experience:*`
            )
            .addFields({
              name: '🎯 Choose Your Primary Goal',
              value: [
                '**Select what matters most to you:**',
                '• Tired of losing money on bets',
                '• Need better analysis and insights',
                '• Want to learn winning strategies',
                '• Looking for a betting community',
                '• Seeking consistent profit system',
                '• Want access to expert picks',
              ].join('\n'),
              inline: false,
            })
            .setFooter({ text: 'Unit Talk Concierge • Your answer personalizes everything' })
            .setTimestamp(),
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('why_losing_money')
                .setLabel('💸 Tired of Losing Money')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId('why_need_analysis')
                .setLabel('🧠 Need Better Analysis')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('why_learn_strategy')
                .setLabel('📚 Want to Learn Strategy')
                .setStyle(ButtonStyle.Success)
            ),
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('why_community')
                .setLabel('🤝 Looking for Community')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('why_profit_system')
                .setLabel('💰 Want Profit System')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId('why_expert_picks')
                .setLabel('⭐ Want Expert Picks')
                .setStyle(ButtonStyle.Primary)
            ),
          ],
        },
      ];

      return {
        id: `trial_discovery_${user.id}_${Date.now()}`,
        userId: user.id,
        tier: 'trial_discovery',
        messages,
        totalMessages: messages.length,
        currentMessage: 0,
        isComplete: false,
        startedAt: new Date(),
      };
    } catch (error) {
      logger.error(`Error creating trial discovery for ${user.username}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: user.id,
      });
      throw error;
    }
  }

  /**
   * Create Capper-specific onboarding sequence
   */
  private createCapperSequence(user: User): OnboardingSequence {
    try {
      const messages: OnboardingMessage[] = [
        {
          id: `capper_welcome_${Date.now()}`,
          content: null,
          type: 'capper_welcome',
          delay: 0,
          embed: new EmbedBuilder()
            .setColor('#800080')
            .setTitle('🏆 Welcome to the Unit Talk Capper Network')
            .setDescription(
              `**${user.username}**, welcome to the elite capper network.\n\n` +
                `As a verified capper, you're now part of Unit Talk's expert intelligence team. ` +
                `Your picks and analysis will help members make smarter betting decisions.\n\n` +
                `**Your capper dashboard and tools are ready.**`
            )
            .addFields(
              {
                name: '🎯 Your Capper Responsibilities',
                value: [
                  '• **Submit Quality Picks** - Use `/submit-pick` with detailed analysis',
                  '• **Maintain Your Record** - Transparency builds trust and credibility',
                  '• **Engage with Members** - Answer questions and provide insights',
                  '• **Follow Guidelines** - Review capper handbook and standards',
                ].join('\n'),
                inline: false,
              },
              {
                name: '⚡ Capper Tools & Access',
                value: [
                  '• **Capper Channels** - Private discussions with other experts',
                  '• **Performance Dashboard** - Track your picks and ROI',
                  '• **Member Feedback** - See how members rate your picks',
                  '• **Priority Support** - Direct line to admin team',
                ].join('\n'),
                inline: false,
              }
            )
            .setFooter({ text: 'Unit Talk Capper Network • Welcome to the team' })
            .setTimestamp(),
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('capper_submit_first_pick')
                .setLabel('🎯 Submit First Pick')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId('capper_handbook')
                .setLabel('📚 Capper Handbook')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('capper_dashboard')
                .setLabel('📊 View Dashboard')
                .setStyle(ButtonStyle.Secondary)
            ),
          ],
        },
      ];

      return {
        id: `capper_${user.id}_${Date.now()}`,
        userId: user.id,
        tier: 'capper',
        messages,
        totalMessages: messages.length,
        currentMessage: 0,
        isComplete: false,
        startedAt: new Date(),
      };
    } catch (error) {
      logger.error(`Error creating capper sequence for ${user.username}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: user.id,
      });
      throw error;
    }
  }

  /**
   * Create Admin-specific onboarding sequence
   */
  private createAdminSequence(user: User): OnboardingSequence {
    try {
      const messages: OnboardingMessage[] = [
        {
          id: `admin_welcome_${Date.now()}`,
          content: null,
          type: 'admin_welcome',
          delay: 0,
          embed: new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🛡️ Unit Talk Admin Access Granted')
            .setDescription(
              `**${user.username}**, welcome to the Unit Talk administration team.\n\n` +
                `You now have admin access to manage the Unit Talk ecosystem. ` +
                `Your role is crucial in maintaining the quality and integrity of our platform.\n\n` +
                `**Your admin dashboard and tools are active.**`
            )
            .addFields(
              {
                name: '⚡ Admin Responsibilities',
                value: [
                  '• **User Management** - Handle upgrades, downgrades, and issues',
                  '• **Content Moderation** - Ensure quality standards are maintained',
                  '• **Capper Oversight** - Monitor and verify capper performance',
                  '• **Platform Health** - Monitor system performance and user satisfaction',
                ].join('\n'),
                inline: false,
              },
              {
                name: '🔧 Admin Tools & Commands',
                value: [
                  '• **Admin Dashboard** - Complete platform overview',
                  '• **User Database** - Full user management capabilities',
                  '• **Analytics Panel** - Performance metrics and insights',
                  '• **Command Suite** - Admin-only slash commands',
                ].join('\n'),
                inline: false,
              }
            )
            .setFooter({ text: 'Unit Talk Administration • Power and responsibility' })
            .setTimestamp(),
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('admin_dashboard')
                .setLabel('🖥️ Admin Dashboard')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId('admin_commands')
                .setLabel('⚡ Admin Commands')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('admin_handbook')
                .setLabel('📖 Admin Handbook')
                .setStyle(ButtonStyle.Secondary)
            ),
          ],
        },
      ];

      return {
        id: `admin_${user.id}_${Date.now()}`,
        userId: user.id,
        tier: 'admin',
        messages,
        totalMessages: messages.length,
        currentMessage: 0,
        isComplete: false,
        startedAt: new Date(),
      };
    } catch (error) {
      logger.error(`Error creating admin sequence for ${user.username}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: user.id,
      });
      throw error;
    }
  }

  /**
   * Create Elite Trial onboarding sequence - The Unit Talk Concierge Experience
   */
  private createTrialSequence(user: User): OnboardingSequence {
    try {
      const messages: OnboardingMessage[] = [
        {
          id: `trial_concierge_welcome_${Date.now()}`,
          content: null,
          type: 'welcome',
          delay: 0,
          embed: new EmbedBuilder()
            .setColor('#FF6B35')
            .setTitle('🎩 Welcome to Your Elite 7-Day Experience')
            .setDescription(
              `**Hello ${user.username}**, I'm your Unit Talk Concierge.\n\n` +
                `For the next 7 days, you have **exclusive access** to our complete VIP intelligence system for just $1. ` +
                `I'll personally guide you through everything and ensure you experience why Unit Talk members never want to leave.\n\n` +
                `**What makes us different?** We don't just give you picks – we give you the **edge**.`
            )
            .addFields(
              {
                name: '🏆 Your Elite Trial Access Includes',
                value: [
                  '• **Live VIP Picks** - Real-time intelligence from our expert cappers',
                  '• **Advanced Analytics** - Edge scoring system that filters only the best',
                  '• **Exclusive Channels** - VIP-only discussions and insights',
                  "• **Personal Concierge** - That's me, available throughout your trial",
                  '• **Premium Commands** - Full access to our slash command suite',
                ].join('\n'),
                inline: false,
              },
              {
                name: '🎯 Let Me Show You Around',
                value: [
                  '**Click the buttons below** to start your elite experience:',
                  '• Get your first VIP pick right now',
                  '• Learn the powerful slash commands',
                  '• See what VIP+ members get (exclusive preview)',
                ].join('\n'),
                inline: false,
              }
            )
            .setFooter({ text: 'Unit Talk Concierge • Your 7-day elite experience starts now' })
            .setTimestamp(),
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('trial_get_first_pick')
                .setLabel('🎯 Get My First VIP Pick')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId('trial_server_tour')
                .setLabel('🗺️ Elite Server Tour')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('trial_vip_plus_preview')
                .setLabel('👑 VIP+ Preview')
                .setStyle(ButtonStyle.Secondary)
            ),
          ],
        },
        {
          id: `trial_day_2_followup_${Date.now()}`,
          content: null,
          type: 'followup',
          delay: 86400, // 24 hours
          embed: new EmbedBuilder()
            .setColor('#FF6B35')
            .setTitle('🎩 Day 2: How Was Your First Day?')
            .setDescription(
              `**${user.username}**, your concierge here with your Day 2 check-in.\n\n` +
                `Yesterday you gained access to our elite system. Today, let me show you something **most members miss** on their first day – our powerful slash command system.\n\n` +
                `**Did you know?** You can get is_instant analysis on any game with just a few keystrokes.`
            )
            .addFields(
              {
                name: '⚡ Try These Powerful Commands:',
                value: [
                  '• `/ask-unit-talk` - Ask our AI anything about betting strategy',
                  '• `/capper-stats` - See live performance of our expert cappers',
                  '• `/submit-pick` - Share your own analysis (VIP feature)',
                  '• `/recap` - Get personalized daily summaries',
                ].join('\n'),
                inline: false,
              },
              {
                name: '🔥 What VIP+ Members Are Saying Today:',
                value:
                  '"*Just hit another +280 pick from the algo. This system is unreal.*" - @Mike_VIP+',
                inline: false,
              }
            )
            .setFooter({ text: 'Unit Talk Concierge • 5 days left in your trial' })
            .setTimestamp(),
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('trial_command_tutorial')
                .setLabel('📚 Command Tutorial')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('trial_set_preferences')
                .setLabel('⚙️ Set My Preferences')
                .setStyle(ButtonStyle.Secondary)
            ),
          ],
        },
        {
          id: `trial_day_5_urgency_${Date.now()}`,
          content: null,
          type: 'conversion',
          delay: 345600, // 4 days (96 hours)
          embed: new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle("🎩 Final Days: Don't Lose Your Edge")
            .setDescription(
              `**${user.username}**, your concierge with an important update.\n\n` +
                `Your elite trial ends in **2 days**. I wanted to personally reach out because ` +
                `I've seen your engagement and I know you understand the value here.\n\n` +
                `**Here's what happens if you don't upgrade:**`
            )
            .addFields(
              {
                name: "❌ What You'll Lose:",
                value: [
                  '• Access to VIP picks (back to free picks only)',
                  '• Your personal concierge service (me)',
                  '• Advanced slash commands and analytics',
                  '• Exclusive VIP channels and discussions',
                ].join('\n'),
                inline: false,
              },
              {
                name: '✨ Exclusive Upgrade Offer:',
                value: [
                  '**Upgrade now and get:**',
                  '• Permanent VIP access',
                  '• 20% off first month (trial members only)',
                  '• Priority access to new features',
                  '• Your concierge relationship continues',
                ].join('\n'),
                inline: false,
              }
            )
            .setFooter({ text: 'Unit Talk Concierge • This offer expires with your trial' })
            .setTimestamp(),
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('trial_upgrade_now')
                .setLabel('🚀 Upgrade to VIP')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId('trial_vip_plus_special')
                .setLabel('👑 VIP+ Special Offer')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('trial_extend_request')
                .setLabel('⏰ Need More Time?')
                .setStyle(ButtonStyle.Secondary)
            ),
          ],
        },
      ];

      logger.info(`Created Trial sequence for ${user.username}`, {
        userId: user.id,
        messageCount: messages.length,
      });

      return {
        id: `trial_${user.id}_${Date.now()}`,
        userId: user.id,
        tier: 'trial',
        messages,
        totalMessages: messages.length,
        currentMessage: 0,
        isComplete: false,
        startedAt: new Date(),
      };
    } catch (error) {
      logger.error(`Error creating Trial sequence for ${user.username}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: user.id,
      });
      throw error;
    }
  }

  /**
   * Create VIP onboarding sequence
   */
  private createVIPSequence(user: User): OnboardingSequence {
    try {
      const messages: OnboardingMessage[] = [
        {
          id: `vip_welcome_${Date.now()}`,
          content: null,
          type: 'welcome',
          delay: 0,
          embed: new EmbedBuilder()
            .setColor('#4169E1')
            .setTitle('👑 Welcome to VIP Professional Status')
            .setDescription(
              `Congratulations ${user.username}! You've joined the professional tier with access to institutional-grade sports intelligence.`
            )
            .addFields(
              {
                name: '🏆 Your VIP Professional Access',
                value: [
                  '• **Professional Capper Network** - Vetted experts with proven track records',
                  '• **Advanced Analytics Suite** - ROI tracking and performance metrics',
                  '• **Priority Alert System** - Early access to market opportunities',
                  '• **Edge Scoring Algorithm** - Quality analysis for picks',
                ].join('\n'),
                inline: false,
              },
              {
                name: '🎯 Your VIP Technology Stack',
                value: [
                  '• **Real-Time Data Feeds** - Live odds integration',
                  '• **Market Analysis Tools** - Line movement tracking',
                  '• **Performance Dashboard** - Comprehensive analytics',
                  '• **Priority Processing** - Faster execution',
                ].join('\n'),
                inline: false,
              }
            )
            .setFooter({ text: 'VIP Professional - Your Edge in Sports Intelligence' })
            .setTimestamp(),
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('setup_vip_alerts')
                .setLabel('⚙️ Configure Alerts')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('view_vip_features')
                .setLabel('🔓 View Features')
                .setStyle(ButtonStyle.Success)
            ),
          ],
        },
      ];

      logger.info(`Created VIP sequence for ${user.username}`, {
        userId: user.id,
        messageCount: messages.length,
      });

      return {
        id: `vip_${user.id}_${Date.now()}`,
        userId: user.id,
        tier: 'vip',
        messages,
        totalMessages: messages.length,
        currentMessage: 0,
        isComplete: false,
        startedAt: new Date(),
      };
    } catch (error) {
      logger.error(`Error creating VIP sequence for ${user.username}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: user.id,
      });
      throw error;
    }
  }

  /**
   * Create Free tier onboarding sequence
   */
  private createFreeSequence(user: User): OnboardingSequence {
    try {
      const messages: OnboardingMessage[] = [
        {
          id: `member_welcome_${Date.now()}`,
          content: null,
          type: 'welcome',
          delay: 0,
          embed: new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(`🎉 Welcome to Unit Talk, ${user.username}!`)
            .setDescription(
              `Welcome to the winning community! We're excited to have you join Unit Talk.\n\n` +
                `Here's how to get started:\n\n` +
                `• Check out our free daily picks in <#1288596680563753000>\n` +
                `• Join the conversation in <#1288606775121285273>\n` +
                `• Learn from our guides in <#1387198398087561236>\n` +
                `• Explore VIP benefits in <#1387184046680834140>\n\n` +
                `Ready to start winning? Let's get you set up!`
            )
            .addFields({
              name: '🎯 Next Steps',
              value: [
                '• Visit our free picks channel',
                '• Say hello in general chat',
                '• Check out our strategy guides',
                '• Consider upgrading to VIP',
              ].join('\n'),
              inline: false,
            })
            .setFooter({ text: 'Unit Talk - Your Edge Starts Now' })
            .setTimestamp(),
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('view_free_picks')
                .setLabel('📊 View Free Picks')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('learn_more_vip')
                .setLabel('⭐ Learn About VIP')
                .setStyle(ButtonStyle.Success)
            ),
          ],
        },
      ];

      logger.info(`Created Free sequence for ${user.username}`, {
        userId: user.id,
        messageCount: messages.length,
      });

      return {
        id: `member_${user.id}_${Date.now()}`,
        userId: user.id,
        tier: 'member',
        messages,
        totalMessages: messages.length,
        currentMessage: 0,
        isComplete: false,
        startedAt: new Date(),
      };
    } catch (error) {
      logger.error(`Error creating Free sequence for ${user.username}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: user.id,
      });
      throw error;
    }
  }

  /**
   * Send sequence in test mode (immediate with short intervals)
   */
  private async sendTestSequence(user: User, sequence: OnboardingSequence): Promise<void> {
    try {
      const dmChannel = await user.createDM();
      logger.info(`Created DM channel for test sequence: ${user.username}`);

      for (let i = 0; i < sequence.messages.length; i++) {
        const message = sequence.messages[i];

        try {
          await dmChannel.send({
            embeds: [message.embed],
            components: message.components || [],
          });

          // Short delay between test messages (2 seconds)
          if (i < sequence.messages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          logger.error(`Failed to send test message ${i + 1} to ${user.username}:`, {
            error,
            userId: user.id,
            messageIndex: i,
            tier: sequence.tier,
          });
        }
      }
    } catch (error) {
      logger.error(`Failed to create DM channel for ${user.username}:`, {
        error,
        userId: user.id,
        tier: sequence.tier,
      });
    }
  }

  /**
   * Send sequence with proper delays
   */
  private async sendSequenceWithDelays(user: User, sequence: OnboardingSequence): Promise<void> {
    logger.info('[ONBOARDING] sendSequenceWithDelays called', {
      userId: user.id,
      tier: sequence.tier,
      messageCount: sequence.messages.length,
    });
    try {
      for (const [i, message] of sequence.messages.entries()) {
        logger.info('[ONBOARDING] Preparing to send onboarding message', {
          userId: user.id,
          tier: sequence.tier,
          messageIndex: i,
          embedTitle: message.embed.data.title,
          hasComponents: !!message.components,
          delay: message.delay,
        });
        try {
          const content = { embeds: [message.embed], components: message.components || undefined };
          try {
            logger.info('[ONBOARDING] Attempting direct DM', {
              userId: user.id,
              tier: sequence.tier,
              messageIndex: i,
            });
            const dmChannel = await user.createDM();
            await dmChannel.send(content);
            logger.info('[ONBOARDING] Successfully sent onboarding DM directly', {
              userId: user.id,
              tier: sequence.tier,
              messageIndex: i,
            });
          } catch (dmError) {
            logger.warn('[ONBOARDING] Direct DM failed, trying through DMService', {
              userId: user.id,
              tier: sequence.tier,
              messageIndex: i,
              error: dmError instanceof Error ? dmError.message : String(dmError),
            });
            const sent = await this.dmService.sendTierBasedDM(
              user.id,
              sequence.tier as UserTier,
              'onboarding',
              content,
              { delay: 0, priority: 'high', bypassTierCheck: true }
            );
            if (sent) {
              logger.info('[ONBOARDING] Successfully sent onboarding DM via DMService', {
                userId: user.id,
                tier: sequence.tier,
                messageIndex: i,
              });
            } else {
              logger.error('[ONBOARDING] Failed to send onboarding DM via DMService', {
                userId: user.id,
                tier: sequence.tier,
                messageIndex: i,
              });
            }
          }
          const delay = message.delay || 2;
          logger.info('[ONBOARDING] Waiting before next onboarding message', {
            userId: user.id,
            tier: sequence.tier,
            messageIndex: i,
            delay,
          });
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        } catch (error) {
          logger.error('[ONBOARDING] Failed to send onboarding message', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            userId: user.id,
            tier: sequence.tier,
            messageIndex: i,
          });
        }
      }
      logger.info('[ONBOARDING] Completed sending onboarding sequence', {
        userId: user.id,
        tier: sequence.tier,
      });
    } catch (error) {
      logger.error('[ONBOARDING] Failed to send sequence', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: user.id,
        tier: sequence.tier,
      });
    }
  }

  /**
   * Create personalized 7-day sequence based on user's WHY motivation
   */
  async createMotivationDrivenSequence(user: User, motivation: string): Promise<void> {
    try {
      logger.info('[ONBOARDING] Creating motivation-driven sequence', {
        userId: user.id,
        username: user.username,
        motivation,
      });

      // Generate personalized content based on their WHY
      const personalizedSequence = this.generatePersonalizedContent(user, motivation);

      // Start the personalized journey
      await this.sendSequenceWithDelays(user, personalizedSequence);

      logger.info('[ONBOARDING] Motivation-driven sequence started', {
        userId: user.id,
        motivation,
        messageCount: personalizedSequence.messages.length,
      });
    } catch (error) {
      logger.error('[ONBOARDING] Error creating motivation-driven sequence', {
        error: error instanceof Error ? error.message : String(error),
        userId: user.id,
        motivation,
      });
    }
  }

  /**
   * Generate personalized content based on user motivation
   */
  private generatePersonalizedContent(user: User, motivation: string): OnboardingSequence {
    const motivationTemplates = {
      losing_money: {
        theme: 'Stop Losing, Start Winning',
        color: '#DC143C',
        day1Focus: 'profit protection and edge systems',
        day2Focus: 'bankroll management and smart betting',
        day5Focus: 'consistent profits and loss prevention',
        testimonials: 'members who stopped losing and started winning',
        features: 'edge scoring, bankroll protection, profit tracking',
      },
      need_analysis: {
        theme: 'Institutional-Grade Intelligence',
        color: '#4169E1',
        day1Focus: 'advanced analytics and data insights',
        day2Focus: 'analysis frameworks and tools',
        day5Focus: 'sophisticated betting intelligence',
        testimonials: 'members who improved their analysis',
        features: 'algorithm picks, data visualization, market analysis',
      },
      learn_strategy: {
        theme: 'Betting Education Mastery',
        color: '#228B22',
        day1Focus: 'learning paths and expert guidance',
        day2Focus: 'strategy development and skill building',
        day5Focus: 'advanced betting strategies',
        testimonials: 'members who became expert bettors',
        features: 'strategy guides, expert mentoring, skill tracking',
      },
      community: {
        theme: 'Elite Betting Community',
        color: '#FF8C00',
        day1Focus: 'community connections and discussions',
        day2Focus: 'member interactions and networking',
        day5Focus: 'exclusive community benefits',
        testimonials: 'members who found their betting family',
        features: 'VIP channels, expert access, community events',
      },
      profit_system: {
        theme: 'Consistent Profit Engine',
        color: '#32CD32',
        day1Focus: 'systematic profit generation',
        day2Focus: 'profit optimization and scaling',
        day5Focus: 'long-term wealth building',
        testimonials: 'members generating consistent profits',
        features: 'profit systems, ROI tracking, scaling strategies',
      },
      expert_picks: {
        theme: 'Expert Capper Network',
        color: '#8A2BE2',
        day1Focus: 'expert picks and capper insights',
        day2Focus: 'capper analysis and reasoning',
        day5Focus: 'premium expert intelligence',
        testimonials: 'members following expert cappers',
        features: 'capper picks, expert analysis, performance tracking',
      },
    };

    const template = motivationTemplates[motivation] || motivationTemplates['losing_money'];

    const messages: OnboardingMessage[] = [
      // Day 1: Personalized Welcome
      {
        id: `personalized_welcome_${Date.now()}`,
        content: null,
        type: 'personalized_welcome',
        delay: 0,
        embed: new EmbedBuilder()
          .setColor(template.color)
          .setTitle(`🎩 ${template.theme} - Your Personal Journey Begins`)
          .setDescription(
            `**${user.username}**, I completely understand.\n\n` +
              `You're here because you want ${this.getMotivationDescription(motivation)}. ` +
              `That's exactly what I'm going to help you achieve over the next 7 days.\n\n` +
              `**I've personalized your entire experience around ${template.day1Focus}.**`
          )
          .addFields(
            {
              name: `🎯 Your Personalized ${template.theme} Experience`,
              value: this.getPersonalizedFeatures(motivation),
              inline: false,
            },
            {
              name: '💡 What Happens Next',
              value: [
                '• **Right now:** Get your first personalized recommendation',
                '• **Tomorrow:** Deep dive into what matters most to you',
                "• **Day 5:** Secure your edge before it's gone",
                '• **Throughout:** Everything tailored to your goals',
              ].join('\n'),
              inline: false,
            }
          )
          .setFooter({ text: `Unit Talk Concierge • ${template.theme} just for you` })
          .setTimestamp(),
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`personalized_${motivation}_start`)
              .setLabel(`🚀 Start My ${template.theme}`)
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('trial_server_tour')
              .setLabel('🗺️ Tour My New Home')
              .setStyle(ButtonStyle.Primary)
          ),
        ],
      },
      // Day 2: Personalized Deep Dive
      {
        id: `personalized_day2_${Date.now()}`,
        content: null,
        type: 'personalized_followup',
        delay: 86400, // 24 hours
        embed: new EmbedBuilder()
          .setColor(template.color)
          .setTitle(`🎯 Day 2: Mastering ${template.day2Focus}`)
          .setDescription(
            `**${user.username}**, your concierge here with your personalized Day 2 focus.\n\n` +
              `Yesterday I introduced you to Unit Talk. Today, let's dive deep into ${template.day2Focus} ` +
              `– the specific area that will transform your betting.\n\n` +
              `**Here's what successful members like you focus on:**`
          )
          .addFields(
            {
              name: `🏆 ${template.theme} Success Stories`,
              value: `"${this.getPersonalizedTestimonial(motivation)}" - Verified Member`,
              inline: false,
            },
            {
              name: '⚡ Your Next Steps',
              value: this.getPersonalizedNextSteps(motivation),
              inline: false,
            }
          )
          .setFooter({ text: `Unit Talk Concierge • Day 2 of your ${template.theme}` })
          .setTimestamp(),
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`deep_dive_${motivation}`)
              .setLabel(`📚 Deep Dive: ${template.theme}`)
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('trial_vip_plus_preview')
              .setLabel('👑 See VIP+ Benefits')
              .setStyle(ButtonStyle.Secondary)
          ),
        ],
      },
      // Day 5: Personalized Conversion
      {
        id: `personalized_conversion_${Date.now()}`,
        content: null,
        type: 'personalized_conversion',
        delay: 345600, // 4 days (96 hours)
        embed: new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(`🔥 Don't Lose Your ${template.theme}`)
          .setDescription(
            `**${user.username}**, this is it – your final 2 days.\n\n` +
              `Over the past 5 days, you've experienced ${template.day5Focus}. ` +
              `You know what Unit Talk can do for your specific goals.\n\n` +
              `**Here's what happens if you don't upgrade:**`
          )
          .addFields(
            {
              name: "❌ What You'll Lose",
              value: this.getPersonalizedLossMessage(motivation),
              inline: false,
            },
            {
              name: '✅ What You Keep With Upgrade',
              value: this.getPersonalizedUpgradeMessage(motivation),
              inline: false,
            },
            {
              name: '🎁 Special Offer (Expires in 48 Hours)',
              value:
                'Upgrade now and get **25% off for 3 months** - exclusive to trial members who share your goals.',
              inline: false,
            }
          )
          .setFooter({ text: `Unit Talk Concierge • Secure your ${template.theme} now` })
          .setTimestamp(),
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`upgrade_${motivation}`)
              .setLabel(`🔐 Keep My ${template.theme}`)
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('trial_vip_plus_special')
              .setLabel('👑 VIP+ Ultimate')
              .setStyle(ButtonStyle.Primary)
          ),
        ],
      },
    ];

    return {
      id: `personalized_${motivation}_${user.id}_${Date.now()}`,
      userId: user.id,
      tier: `personalized_${motivation}`,
      messages,
      totalMessages: messages.length,
      currentMessage: 0,
      isComplete: false,
      startedAt: new Date(),
    };
  }

  /**
   * Get motivation description for personalized messaging
   */
  private getMotivationDescription(motivation: string): string {
    const descriptions = {
      losing_money: 'to stop losing money and start winning consistently',
      need_analysis: 'better analysis and data-driven insights',
      learn_strategy: 'to learn winning strategies from experts',
      community: 'to connect with a community of successful bettors',
      profit_system: 'a consistent system for generating profits',
      expert_picks: 'access to verified expert picks and analysis',
    };
    return descriptions[motivation] || descriptions['losing_money'];
  }

  /**
   * Get personalized features based on motivation
   */
  private getPersonalizedFeatures(motivation: string): string {
    const features = {
      losing_money: [
        '• **Edge Scoring System** - Only bet when you have the advantage',
        '• **Bankroll Protection** - Never risk more than you can afford',
        '• **Win Rate Tracking** - See your improvement in real-time',
        '• **Loss Prevention Alerts** - Stop bad streaks before they start',
      ].join('\n'),
      need_analysis: [
        '• **Algorithm Intelligence** - AI-powered betting analysis',
        '• **Market Data Insights** - Institutional-grade information',
        '• **Trend Analysis Tools** - Spot opportunities before others',
        '• **Performance Analytics** - Data-driven decision making',
      ].join('\n'),
      learn_strategy: [
        '• **Expert Strategy Guides** - Learn from profitable bettors',
        '• **Interactive Tutorials** - Hands-on learning experience',
        '• **Personal Mentoring** - Direct access to successful cappers',
        '• **Skill Development Tracking** - Monitor your progress',
      ].join('\n'),
      community: [
        '• **VIP Community Channels** - Connect with like-minded bettors',
        '• **Expert Interactions** - Chat directly with successful cappers',
        '• **Member Support Network** - Help and advice from peers',
        '• **Exclusive Events** - Community contests and meetups',
      ].join('\n'),
      profit_system: [
        '• **Systematic Approach** - Consistent profit generation methods',
        '• **ROI Optimization** - Maximize returns on every bet',
        '• **Scaling Strategies** - Grow your profits systematically',
        '• **Profit Tracking** - Monitor your wealth building journey',
      ].join('\n'),
      expert_picks: [
        '• **Verified Capper Network** - Proven track records only',
        '• **Expert Analysis** - Detailed reasoning behind every pick',
        '• **Performance Transparency** - Full win/loss records',
        '• **Direct Expert Access** - Ask questions, get answers',
      ].join('\n'),
    };
    return features[motivation] || features['losing_money'];
  }

  /**
   * Get personalized testimonial based on motivation
   */
  private getPersonalizedTestimonial(motivation: string): string {
    const testimonials = {
      losing_money:
        "I was losing $500/month before Unit Talk. Now I'm up $2,100 in 3 months. The edge system changed everything.",
      need_analysis:
        'The analysis here is next level. I finally understand WHY bets win or lose instead of just guessing.',
      learn_strategy:
        'Went from complete beginner to confident bettor in 2 months. The education system is incredible.',
      community:
        'Found my betting family here. The community support and shared knowledge is priceless.',
      profit_system:
        "Following their profit system, I've had 8 profitable months in a row. It actually works.",
      expert_picks:
        'The cappers here are the real deal. 73% win rate following their picks over 6 months.',
    };
    return testimonials[motivation] || testimonials['losing_money'];
  }

  /**
   * Get personalized next steps based on motivation
   */
  private getPersonalizedNextSteps(motivation: string): string {
    const steps = {
      losing_money: [
        '1. **Use `/ask-unit-talk`** - Ask about bankroll management strategies',
        '2. **Check your edge scores** - Only bet when advantage is clear',
        '3. **Track everything** - Use `/submit-pick` to monitor progress',
        '4. **Join profit discussions** - Learn from profitable members',
      ].join('\n'),
      need_analysis: [
        '1. **Try `/ask-unit-talk`** - Get analysis on any upcoming game',
        '2. **Explore the algorithm** - See how AI evaluates opportunities',
        '3. **Use analysis tools** - Access market data and insights',
        '4. **Study successful picks** - Learn analysis patterns',
      ].join('\n'),
      learn_strategy: [
        '1. **Start with `/ask-unit-talk`** - Ask about basic betting strategies',
        '2. **Follow expert reasoning** - See how pros think through bets',
        '3. **Practice with guidance** - Submit picks for feedback',
        '4. **Join strategy discussions** - Learn from member conversations',
      ].join('\n'),
      community: [
        '1. **Introduce yourself** - Share your betting background in VIP chat',
        '2. **Engage with posts** - React and comment on member picks',
        '3. **Ask questions** - The community loves helping newcomers',
        '4. **Share your wins** - Celebrate successes with the group',
      ].join('\n'),
      profit_system: [
        '1. **Learn the system** - Use `/ask-unit-talk` about profit strategies',
        '2. **Start systematic betting** - Follow the proven framework',
        '3. **Track ROI progress** - Monitor your profit growth',
        '4. **Scale gradually** - Increase stakes as profits grow',
      ].join('\n'),
      expert_picks: [
        '1. **Follow top cappers** - Check `/capper-stats` for leaders',
        '2. **Study pick reasoning** - Learn why experts choose bets',
        '3. **Ask capper questions** - Direct interaction available',
        '4. **Track capper performance** - Find who matches your style',
      ].join('\n'),
    };
    return steps[motivation] || steps['losing_money'];
  }

  /**
   * Get personalized loss message for conversion
   */
  private getPersonalizedLossMessage(motivation: string): string {
    const losses = {
      losing_money: 'Back to losing money with random betting and no edge protection',
      need_analysis: 'Back to betting blind without proper data and insights',
      learn_strategy: 'Back to guessing instead of using proven winning strategies',
      community: 'Back to betting alone without support and shared knowledge',
      profit_system: 'Back to inconsistent results without a systematic approach',
      expert_picks: 'Back to amateur picks instead of verified expert analysis',
    };
    return losses[motivation] || losses['losing_money'];
  }

  /**
   * Get personalized upgrade message based on motivation
   */
  private getPersonalizedUpgradeMessage(motivation: string): string {
    const upgrades = {
      losing_money: 'Permanent access to edge protection and profit strategies',
      need_analysis: 'Unlimited algorithm analysis and market intelligence',
      learn_strategy: 'Complete strategy education and expert mentoring',
      community: 'Lifetime membership in the elite betting community',
      profit_system: 'Full systematic profit framework and ROI optimization',
      expert_picks: 'Unlimited access to all expert cappers and their analysis',
    };
    return upgrades[motivation] || upgrades['losing_money'];
  }

  /**
   * Cancel ongoing onboarding sequence for a user
   */
  async cancelOnboarding(userId: string): Promise<void> {
    const timeouts = this.activeSequences.get(userId);
    if (timeouts) {
      timeouts.forEach(timeout => clearTimeout(timeout));
      this.activeSequences.delete(userId);
      logger.info(`Cancelled onboarding sequence for user ${userId}`);
    }
  }

  /**
   * Track onboarding start
   */
  private async trackOnboardingStart(userId: string, tier: string): Promise<void> {
    try {
      // First ensure user profile exists
      const profile = await databaseService.getUserProfile(userId);

      if (profile) {
        // Update existing profile
        await databaseService.updateUserProfile(userId, {
          tier: tier as UserTier,
          // last_onboarding_start: new Date().toISOString() // Property doesn't exist in database schema
        });
      } else {
        // Create new profile
        await databaseService.createUserProfile({
          discord_id: userId,
          tier: tier as UserTier,
          // last_onboarding_start: new Date().toISOString() // Property doesn't exist in database schema
        });
      }

      // Track event
      await databaseService.trackAnalyticsEvent({
        user_id: userId,
        guild_id: process.env.DISCORD_GUILD_ID || '',
        event_type: 'onboarding_start',
        event_data: {
          tier,
          timestamp: toISOString(new Date()),
        },
      });

      logger.info(`Tracked onboarding start for ${userId} (${tier})`);
    } catch (error) {
      logger.error('Failed to track onboarding start:', {
        error,
        userId,
        tier,
      });
    }
  }

  /**
   * Track onboarding completion
   */
  private async trackOnboardingComplete(userId: string, tier: string): Promise<void> {
    try {
      await databaseService.updateUserProfile(userId, {
        tier: tier as UserTier,
        // last_onboarding_complete: new Date().toISOString() // Property doesn't exist in database schema
      });

      await databaseService.trackAnalyticsEvent({
        user_id: userId,
        guild_id: process.env.DISCORD_GUILD_ID || '',
        event_type: 'onboarding_complete',
        event_data: {
          tier,
          timestamp: toISOString(new Date()),
        },
      });

      logger.info(`Tracked onboarding completion for ${userId} (${tier})`);
    } catch (error) {
      logger.error('Failed to track onboarding completion:', {
        error,
        userId,
        tier,
      });
    }
  }

  /**
   * Track onboarding failure
   */
  private async trackOnboardingFailure(userId: string, tier: string, error: any): Promise<void> {
    try {
      await databaseService.trackAnalyticsEvent({
        user_id: userId,
        guild_id: process.env.DISCORD_GUILD_ID || '',
        event_type: 'onboarding_failure',
        event_data: {
          tier,
          error: error instanceof Error ? error.message : String(error),
          timestamp: toISOString(new Date()),
        },
      });

      logger.info(`Tracked onboarding failure for ${userId} (${tier})`);
    } catch (error) {
      logger.error('Failed to track onboarding failure:', {
        error,
        userId,
        tier,
      });
    }
  }
}
