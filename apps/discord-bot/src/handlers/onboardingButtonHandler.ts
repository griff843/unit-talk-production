import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
} from 'discord.js';
import { logger } from '../utils/logger';
import { OnboardingService } from '../services/onboardingService';
import { DMService } from '../services/dmService';

/**
 * Elite Trial Onboarding Button Handler
 * Handles all button interactions for the Unit Talk Concierge experience
 */
export class OnboardingButtonHandler {
  private client: Client;
  private onboardingService: OnboardingService;

  constructor(client: Client) {
    this.client = client;
    // Initialize services - in production, these would be injected
    const dmService = new DMService(client, null as any);
    this.onboardingService = new OnboardingService(client, dmService);
  }

  /**
   * Handle all onboarding button interactions
   */
  async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    try {
      logger.info('[ONBOARDING_BUTTONS] Button interaction received', {
        customId: interaction.customId,
        userId: interaction.user.id,
        username: interaction.user.username,
      });

      // Route to appropriate handler based on button ID
      switch (interaction.customId) {
        // WHY Discovery Buttons - Personal Motivation Selection
        case 'why_losing_money':
          await this.handleMotivationSelection(interaction, 'losing_money');
          break;
        case 'why_need_analysis':
          await this.handleMotivationSelection(interaction, 'need_analysis');
          break;
        case 'why_learn_strategy':
          await this.handleMotivationSelection(interaction, 'learn_strategy');
          break;
        case 'why_community':
          await this.handleMotivationSelection(interaction, 'community');
          break;
        case 'why_profit_system':
          await this.handleMotivationSelection(interaction, 'profit_system');
          break;
        case 'why_expert_picks':
          await this.handleMotivationSelection(interaction, 'expert_picks');
          break;

        // Personalized Journey Buttons
        case 'personalized_losing_money_start':
        case 'personalized_need_analysis_start':
        case 'personalized_learn_strategy_start':
        case 'personalized_community_start':
        case 'personalized_profit_system_start':
        case 'personalized_expert_picks_start':
          await this.handlePersonalizedStart(interaction);
          break;

        // Trial Welcome Buttons
        case 'trial_get_first_pick':
          await this.handleGetFirstPick(interaction);
          break;
        case 'trial_server_tour':
          await this.handleServerTour(interaction);
          break;
        case 'trial_vip_plus_preview':
          await this.handleVIPPlusPreview(interaction);
          break;

        // Day 2 Follow-up Buttons
        case 'trial_command_tutorial':
          await this.handleCommandTutorial(interaction);
          break;
        case 'trial_set_preferences':
          await this.handleSetPreferences(interaction);
          break;

        // Conversion Buttons
        case 'trial_upgrade_now':
          await this.handleUpgradeNow(interaction);
          break;
        case 'trial_vip_plus_special':
          await this.handleVIPPlusSpecial(interaction);
          break;
        case 'trial_extend_request':
          await this.handleExtendRequest(interaction);
          break;

        default:
          logger.warn('[ONBOARDING_BUTTONS] Unknown button interaction', {
            customId: interaction.customId,
            userId: interaction.user.id,
          });
          await interaction.reply({
            content: 'I apologize, but this feature is currently being updated. Please contact support if you need assistance.',
            ephemeral: true,
          });
      }
    } catch (error) {
      logger.error('[ONBOARDING_BUTTONS] Error handling button interaction', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        customId: interaction.customId,
        userId: interaction.user.id,
      });

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'An error occurred. Your Unit Talk Concierge has been notified and will assist you shortly.',
          ephemeral: true,
        });
      }
    }
  }

  /**
   * Handle "Get My First VIP Pick" button
   */
  private async handleGetFirstPick(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🎯 Your First VIP Pick is Ready!')
      .setDescription(
        `**${interaction.user.username}**, your concierge here with your first exclusive pick.\n\n` +
        `**Today's VIP Intelligence Alert:**\n` +
        `🏀 **Lakers vs Warriors** (8:00 PM ET)\n` +
        `📊 **Pick:** Under 223.5 (-110)\n` +
        `⭐ **Edge Score:** 8.7/10 (S-Tier)\n\n` +
        `**Why this pick?** Our analysis shows strong historical patterns when these teams play with similar total lines. ` +
        `Plus, both teams have been hitting unders at 68% over their last 10 games.`
      )
      .addFields(
        {
          name: '🧠 The Analysis',
          value: [
            '• **Pace Analysis:** Both teams averaging 2.3 possessions slower than season avg',
            '• **Injury Report:** Key scorers questionable, defensive players confirmed',
            '• **Weather/Venue:** Indoor venue favors under trends historically',
            '• **Sharp Money:** 67% of big bets on the under',
          ].join('\n'),
          inline: false,
        },
        {
          name: '💡 How to Use This',
          value: 'Head to your sportsbook and place this bet. Then come back and use `/submit-pick` to track your results with us!',
          inline: false,
        }
      )
      .setFooter({ text: 'Unit Talk Concierge • This is the intelligence VIP members get daily' })
      .setTimestamp();

    const components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('trial_more_picks')
          .setLabel('🔥 Show Me More VIP Picks')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('trial_server_tour')
          .setLabel('🗺️ Take Server Tour')
          .setStyle(ButtonStyle.Primary)
      ),
    ];

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    });
  }

  /**
   * Handle "Elite Server Tour" button
   */
  private async handleServerTour(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('#4169E1')
      .setTitle('🗺️ Your Elite Server Navigation Guide')
      .setDescription(
        `**${interaction.user.username}**, let me show you around your new home.\n\n` +
        `As a trial member, you have **exclusive access** to areas most people never see. ` +
        `Here's your personal guide to navigating like a VIP:`
      )
      .addFields(
        {
          name: '🏆 VIP Arena - Your Main Hub',
          value: [
            '• **<#1288610443723538584>** - Your VIP general chat',
            '• **<#1356624814831304744>** - Strategy discussions with experts',
            '• **Live picks posted here first** - refresh often!',
          ].join('\n'),
          inline: false,
        },
        {
          name: '💎 What You\'re Missing (VIP+ Preview)',
          value: [
            '• **<#1288612794584924171>** - VIP+ Arena (ultimate tier)',
            '• **<#1288613114815840466>** - Exclusive insights and analysis',
            '• **<#1356613995175481405>** - Trader insights (whale movements)',
          ].join('\n'),
          inline: false,
        },
        {
          name: '⚡ Pro Navigation Tips',
          value: [
            '• Use `/ask-unit-talk` anywhere - I can answer strategy questions',
            '• Check pins in channels for important announcements',
            '• React with 🔥 on picks you like - cappers notice!',
            '• Use `/capper-stats` to see who\'s hot right now',
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter({ text: 'Unit Talk Concierge • Your personal navigation guide' })
      .setTimestamp();

    const components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('trial_command_tutorial')
          .setLabel('📚 Learn Slash Commands')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('trial_vip_plus_preview')
          .setLabel('👑 VIP+ Preview')
          .setStyle(ButtonStyle.Secondary)
      ),
    ];

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    });
  }

  /**
   * Handle "VIP+ Preview" button - Creates FOMO
   */
  private async handleVIPPlusPreview(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('👑 VIP+ Elite: What You\'re Missing')
      .setDescription(
        `**${interaction.user.username}**, since you're a valued trial member, here's an exclusive preview of what our VIP+ Elite members are getting right now...\n\n` +
        `**🔥 LIVE VIP+ Algorithm Pick** (Posted 15 minutes ago):\n` +
        `🏈 **Chiefs vs Bills** - *[Details hidden - VIP+ only]*\n` +
        `💎 **Edge Score:** 9.2/10 (S+ Tier)\n` +
        `📈 **Historical:** 87% win rate on this pattern\n\n` +
        `*This is the kind of intelligence that separates VIP+ from everyone else...*`
      )
      .addFields(
        {
          name: '💎 Exclusive VIP+ Features You Don\'t Have',
          value: [
            '• **Premium Analysis** - Enhanced betting intelligence',
            '• **Whale Tracking** - Follow the biggest money movements',
            '• **Injury Intel** - Get injury news 30+ minutes before public',
            '• **Line Movement Alerts** - Know when sharp money moves',
            '• **Personal Pick Reviews** - Direct feedback from cappers',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🔥 What VIP+ Members Made Today',
          value: [
            '"*The analysis here has helped me improve my betting significantly*" - @Sarah_VIP+',
            '"*Hit 4/5 picks following the whale movements. This system is insane.*" - @Jake_VIP+',
          ].join('\n'),
          inline: false,
        },
        {
          name: '⏰ Special Trial Offer',
          value: '**Upgrade to VIP+ during your trial and save 30% for 3 months.** This offer expires when your trial ends.',
          inline: false,
        }
      )
      .setFooter({ text: 'Unit Talk Concierge • This preview is only for trial members' })
      .setTimestamp();

    const components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('trial_vip_plus_special')
          .setLabel('🚀 Get VIP+ Special Offer')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('trial_set_preferences')
          .setLabel('⚙️ Maybe Later - Set Preferences')
          .setStyle(ButtonStyle.Secondary)
      ),
    ];

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    });
  }

  /**
   * Handle "Command Tutorial" button
   */
  private async handleCommandTutorial(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('#9370DB')
      .setTitle('📚 Master Your VIP Command Suite')
      .setDescription(
        `**${interaction.user.username}**, these slash commands are your secret weapons. ` +
        `Most members don't use them properly - here's how to maximize your edge:\n\n` +
        `**💡 Pro Tip:** Start typing \`/\` in any channel to see all available commands!`
      )
      .addFields(
        {
          name: '🤖 Intelligent Commands',
          value: [
            '• **`/ask-unit-talk`** - Ask me anything about betting strategy, teams, or analysis',
            '   *Try: "/ask-unit-talk What\'s the best strategy for NBA totals?"*',
            '• **`/capper-stats [capper]`** - Get live performance data on any capper',
            '   *Try: "/capper-stats Griff843" to see recent picks and win rate*',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📊 VIP Analytics Commands',
          value: [
            '• **`/submit-pick`** - Submit your pick for tracking and get feedback',
            '• **`/recap`** - Get personalized daily/weekly performance summaries',
            '• **`/trend-breaker`** - Find contrarian opportunities (VIP feature)',
            '• **`/ev-report`** - Expected value analysis on games',
          ].join('\n'),
          inline: false,
        },
        {
          name: '⚡ Quick Start Commands',
          value: [
            '1. **Try this now:** `/ask-unit-talk What makes Unit Talk different?`',
            '2. **Then try:** `/capper-stats` (see all our experts)',
            '3. **Practice:** `/submit-pick` on today\'s game',
            '',
            '**Your concierge tip:** Use these commands in VIP channels for priority responses!',
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter({ text: 'Unit Talk Concierge • Master these and you\'ll bet like a pro' })
      .setTimestamp();

    const components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('trial_test_ask_command')
          .setLabel('🎯 Test Ask Command')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('trial_see_capper_stats')
          .setLabel('📊 See Capper Performance')
          .setStyle(ButtonStyle.Secondary)
      ),
    ];

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    });
  }

  /**
   * Handle "Set My Preferences" button
   */
  private async handleSetPreferences(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('#FF6B35')
      .setTitle('⚙️ Customize Your Elite Experience')
      .setDescription(
        `**${interaction.user.username}**, let me personalize your Unit Talk experience.\n\n` +
        `**Your preferences help me serve you better:**\n` +
        `• More relevant picks and analysis\n` +
        `• Customized alerts and notifications\n` +
        `• Better follow-up recommendations\n\n` +
        `**What sports interest you most?** (Choose all that apply)`
      )
      .addFields(
        {
          name: '🏆 Available Sports',
          value: [
            '🏈 **NFL** - Professional football',
            '🏀 **NBA** - Professional basketball', 
            '⚾ **MLB** - Major League Baseball',
            '🏒 **NHL** - National Hockey League',
            '⚽ **Soccer** - International and MLS',
            '🏫 **College** - NCAAF and NCAAB',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📱 Communication Preferences',
          value: 'How often would you like me to check in during your trial?',
          inline: false,
        }
      )
      .setFooter({ text: 'Unit Talk Concierge • Your preferences, your experience' })
      .setTimestamp();

    const components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('prefs_nfl_nba')
          .setLabel('🏈🏀 NFL + NBA')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('prefs_all_major')
          .setLabel('🔥 All Major Sports')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('prefs_custom')
          .setLabel('⚙️ Custom Selection')
          .setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('comm_daily')
          .setLabel('📅 Daily Check-ins')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('comm_key_moments')
          .setLabel('⚡ Key Moments Only')
          .setStyle(ButtonStyle.Secondary)
      ),
    ];

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    });
  }

  /**
   * Handle upgrade buttons and conversion actions
   */
  private async handleUpgradeNow(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🚀 Ready to Keep Your Edge?')
      .setDescription(
        `**Excellent choice, ${interaction.user.username}!**\n\n` +
        `Your concierge is excited to continue working with you. Here's how to upgrade and keep your elite access:\n\n` +
        `**🎯 Your VIP Upgrade Benefits:**`
      )
      .addFields(
        {
          name: '✅ You Keep Everything From Your Trial',
          value: [
            '• All VIP channels and picks continue',
            '• Your personal concierge service (me)',
            '• Advanced slash commands and analytics',
            '• Priority support and early features',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🎁 Plus These VIP Exclusive Bonuses',
          value: [
            '• **Monthly Strategy Sessions** with top cappers',
            '• **Custom Pick Requests** - ask for specific analysis',
            '• **ROI Tracking Dashboard** - see your profit over time',
            '• **VIP-Only Contests** with cash prizes',
          ].join('\n'),
          inline: false,
        },
        {
          name: '💰 VIP Pricing',
          value: [
            '**Trial:** $1 for 7 days',
            '**VIP:** $49.99/month',
            '',
            '*Continue your betting intelligence journey with full VIP access*',
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter({ text: 'Unit Talk Concierge • Secure your edge before your trial expires' })
      .setTimestamp();

    const components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('🔐 Upgrade to VIP ($49.99/mo)')
          .setStyle(ButtonStyle.Link)
          .setURL('https://unittalk.com/upgrade-vip'), // Replace with actual upgrade URL
        new ButtonBuilder()
          .setCustomId('trial_vip_plus_special')
          .setLabel('👑 What About VIP+?')
          .setStyle(ButtonStyle.Secondary)
      ),
    ];

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    });
  }

  /**
   * Handle VIP+ special offer
   */
  private async handleVIPPlusSpecial(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('👑 VIP+ Elite: Premium Features')
      .setDescription(
        `**${interaction.user.username}**, interested in our premium tier?\n\n` +
        `VIP+ Elite is our highest tier with exclusive features. ` +
        `Since you're a trial member, here's information about what VIP+ includes:`
      )
      .addFields(
        {
          name: '💎 VIP+ Elite Includes Everything in VIP, Plus:',
          value: [
            '• **Advanced Analytics** - Enhanced betting intelligence',
            '• **Market Movement Alerts** - Track significant line movements',
            '• **Injury Intelligence** - Early injury impact analysis',
            '• **Personal Pick Reviews** - Direct feedback from cappers',
            '• **Priority Support** - Faster response times',
            '• **Exclusive Content** - VIP+ only picks and analysis',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🎯 What You Get',
          value: [
            '• Access to all VIP+ exclusive channels',
            '• Enhanced pick tracking and analytics',
            '• Direct access to capper insights',
            '• Premium community features',
          ].join('\n'),
          inline: false,
        },
        {
          name: '💰 Pricing Information',
          value: [
            '**Trial:** $1 for 7 days',
            '**VIP:** $49.99/month',
            '**VIP+:** Pricing to be announced',
            '',
            '*All features subject to availability*',
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter({ text: 'Unit Talk Concierge • Features in development' })
      .setTimestamp();

    const components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('trial_more_info')
          .setLabel('📚 Learn More About VIP+')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('trial_need_time')
          .setLabel('⏰ I Need Time to Decide')
          .setStyle(ButtonStyle.Secondary)
      ),
    ];

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    });
  }

  /**
   * Handle extend request
   */
  private async handleExtendRequest(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('⏰ Need More Time? I Understand')
      .setDescription(
        `**${interaction.user.username}**, your concierge understands that 7 days can feel rushed for such an important decision.\n\n` +
        `While I can't extend trials automatically, here's what I can do for you:`
      )
      .addFields(
        {
          name: '🤝 Your Options',
          value: [
            '**Option 1:** Message our admin team directly in <#support-channel>',
            '**Option 2:** Reply to this DM with your specific concerns',
            '**Option 3:** Schedule a quick call with our team',
          ].join('\n'),
          inline: false,
        },
        {
          name: '💡 In the Meantime',
          value: [
            '• Make sure you\'ve tried all the slash commands',
            '• Check out both VIP channels you have access to',
            '• Review your pick performance if you\'ve been tracking',
            '• Ask me any questions using `/ask-unit-talk`',
          ].join('\n'),
          inline: false,
        },
        {
          name: '⚡ Quick Decision Helper',
          value: 'The biggest question: **"Am I making better betting decisions with Unit Talk than without it?"** If yes, the choice is clear.',
          inline: false,
        }
      )
      .setFooter({ text: 'Unit Talk Concierge • I\'m here to help you decide' })
      .setTimestamp();

    const components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('trial_contact_admin')
          .setLabel('💬 Contact Admin Team')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('trial_ask_question')
          .setLabel('❓ Ask Me Anything')
          .setStyle(ButtonStyle.Secondary)
      ),
    ];

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    });
  }

  /**
   * Handle motivation selection - The key to personalized onboarding
   */
  private async handleMotivationSelection(interaction: ButtonInteraction, motivation: string): Promise<void> {
    try {
      // Store the user's motivation choice (in production, save to database)
      logger.info('[ONBOARDING_BUTTONS] User selected motivation', {
        userId: interaction.user.id,
        username: interaction.user.username,
        motivation,
      });

      // Get motivation display names
      const motivationNames = {
        'losing_money': 'Stop Losing, Start Winning',
        'need_analysis': 'Institutional-Grade Intelligence', 
        'learn_strategy': 'Betting Education Mastery',
        'community': 'Elite Betting Community',
        'profit_system': 'Consistent Profit Engine',
        'expert_picks': 'Expert Capper Network',
      };

      const themeName = motivationNames[motivation] || 'Personalized Experience';

      // Create confirmation embed
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎯 Perfect! Your Experience is Being Personalized')
        .setDescription(
          `**${interaction.user.username}**, excellent choice!\n\n` +
          `I'm now personalizing your entire 7-day Unit Talk experience around:\n` +
          `**🌟 ${themeName}**\n\n` +
          `Everything you receive over the next week will be tailored specifically to help you achieve this goal. ` +
          `Your personalized journey starts in just a moment...`
        )
        .addFields(
          {
            name: '🚀 What Happens Next',
            value: [
              '• **Personalized welcome** - Crafted just for your goals',
              '• **Custom recommendations** - Focused on what matters to you',
              '• **Targeted content** - Every message addresses your specific needs',
              '• **Tailored conversion** - Upgrade offers matching your priorities',
            ].join('\n'),
            inline: false,
          },
          {
            name: '💡 Your Concierge Promise',
            value: `Over the next 7 days, I'll focus entirely on helping you ${this.getGoalDescription(motivation)}. ` +
                   `This isn't generic onboarding - this is your personal journey to success.`,
            inline: false,
          }
        )
        .setFooter({ text: `Unit Talk Concierge • ${themeName} journey starting...` })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });

      // Launch the personalized sequence after a brief delay
      setTimeout(async () => {
        try {
          await this.onboardingService.createMotivationDrivenSequence(interaction.user, motivation);
          logger.info('[ONBOARDING_BUTTONS] Personalized sequence launched', {
            userId: interaction.user.id,
            motivation,
          });
        } catch (error) {
          logger.error('[ONBOARDING_BUTTONS] Error launching personalized sequence', {
            error: error instanceof Error ? error.message : String(error),
            userId: interaction.user.id,
            motivation,
          });
        }
      }, 3000); // 3 second delay to build anticipation

    } catch (error) {
      logger.error('[ONBOARDING_BUTTONS] Error handling motivation selection', {
        error: error instanceof Error ? error.message : String(error),
        userId: interaction.user.id,
        motivation,
      });

      await interaction.reply({
        content: 'Thank you for your selection! Your personalized experience is being prepared...',
        ephemeral: true,
      });
    }
  }

  /**
   * Handle personalized journey start
   */
  private async handlePersonalizedStart(interaction: ButtonInteraction): Promise<void> {
    // Extract motivation from button ID
    const motivation = interaction.customId.replace('personalized_', '').replace('_start', '');
    
    const embed = new EmbedBuilder()
      .setColor('#4169E1')
      .setTitle('🎯 Your Personalized Journey Begins!')
      .setDescription(
        `**${interaction.user.username}**, your concierge here with your first personalized action.\n\n` +
        `Based on your goal of ${this.getGoalDescription(motivation)}, here's exactly what you should do first:`
      )
      .addFields(
        {
          name: '⚡ Your First Personal Action',
          value: this.getFirstPersonalizedAction(motivation),
          inline: false,
        },
        {
          name: '🎯 Why This Matters for You',
          value: this.getPersonalizedReasoning(motivation),
          inline: false,
        }
      )
      .setFooter({ text: 'Unit Talk Concierge • Your personalized journey continues...' })
      .setTimestamp();

    const components = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`action_${motivation}`)
          .setLabel('✅ I Did It!')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('trial_server_tour')
          .setLabel('🗺️ Show Me Around')
          .setStyle(ButtonStyle.Primary)
      ),
    ];

    await interaction.reply({
      embeds: [embed],
      components,
      ephemeral: true,
    });
  }

  /**
   * Get goal description for messaging
   */
  private getGoalDescription(motivation: string): string {
    const goals = {
      'losing_money': 'stopping losses and building consistent profits',
      'need_analysis': 'gaining access to institutional-grade betting intelligence',
      'learn_strategy': 'mastering winning strategies from expert bettors',
      'community': 'connecting with a community of successful bettors',
      'profit_system': 'building a systematic approach to consistent profits',
      'expert_picks': 'following verified expert picks and analysis',
    };
    return goals[motivation] || goals['losing_money'];
  }

  /**
   * Get first personalized action based on motivation
   */
  private getFirstPersonalizedAction(motivation: string): string {
    const actions = {
      'losing_money': '**Try `/ask-unit-talk`** and ask: "What\'s the biggest mistake losing bettors make?" - Learn what to avoid immediately.',
      'need_analysis': '**Use `/ask-unit-talk`** and ask: "How does your edge scoring system work?" - Understand our analytical advantage.',
      'learn_strategy': '**Ask `/ask-unit-talk`**: "What\'s the first strategy every successful bettor learns?" - Start your education.',
      'community': '**Head to <#1288610443723538584>** and introduce yourself - Tell us your betting background and goals.',
      'profit_system': '**Try `/ask-unit-talk`** and ask: "How do I start building a systematic betting approach?" - Learn the framework.',
      'expert_picks': '**Use `/capper-stats`** to see our top performers - Identify which experts match your style.',
    };
    return actions[motivation] || actions['losing_money'];
  }

  /**
   * Get personalized reasoning for the first action
   */
  private getPersonalizedReasoning(motivation: string): string {
    const reasoning = {
      'losing_money': 'Most losing bettors make the same fundamental mistakes. Understanding these immediately protects your bankroll while you learn.',
      'need_analysis': 'Our edge scoring is what separates Unit Talk from everyone else. Understanding how it works gives you is_instant analytical advantage.',
      'learn_strategy': 'There\'s a foundational strategy that every profitable bettor uses. Master this first, everything else builds on top.',
      'community': 'The community is where the real value happens. Introduce yourself and you\'ll get personalized advice from successful members.',
      'profit_system': 'Consistent profits come from systems, not luck. Learning our framework gives you the structure for long-term success.',
      'expert_picks': 'Not all cappers are equal. Finding the right match for your style and bankroll is crucial for following expert picks successfully.',
    };
    return reasoning[motivation] || reasoning['losing_money'];
  }
}