import {
  Client,
  GuildMember,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  User
} from 'discord.js';
import {
  OnboardingStep,
  OnboardingProgress,
  UserPreferences,
  UserTier,
  UserProfile
} from '../types/index';

// Mock database and logger for now - will be replaced with actual implementations
const database = {
  async getOnboardingProgress(userId: string): Promise<OnboardingProgress | null> {
    // Mock implementation
    return null;
  },
  async saveOnboardingProgress(progress: OnboardingProgress): Promise<void> {
    // Mock implementation
  },
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    // Mock implementation
    return null;
  },
  async updateUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
    // Mock implementation
  }
};

const logger = {
  info: (message: string, meta?: any) => console.log(`[INFO] ${message}`, meta),
  error: (message: string, meta?: any) => console.error(`[ERROR] ${message}`, meta),
  warn: (message: string, meta?: any) => console.warn(`[WARN] ${message}`, meta),
  debug: (message: string, meta?: any) => console.debug(`[DEBUG] ${message}`, meta)
};

export class OnboardingService {
  private client: Client;
  private onboardingFlows: Map<string, OnboardingProgress> = new Map();

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Start the onboarding process for a new user
   */
  /**
   * Start onboarding for a guild member or user
   */
  async startOnboarding(userOrMember: User | GuildMember, tier: UserTier = 'member'): Promise<void> {
    const user = userOrMember instanceof GuildMember ? userOrMember.user : userOrMember;
    return this.startOnboardingForUser(user, tier);
  }

  /**
   * Internal method to start onboarding for a user
   */
  private async startOnboardingForUser(user: User, tier: UserTier = 'member'): Promise<void> {
    try {
      const existingProgress = await database.getOnboardingProgress(user.id);
      if (existingProgress && existingProgress.completed_at) {
        logger.info(`User ${user.username} has already completed onboarding`);
        return;
      }

      const progress: OnboardingProgress = {
        user_id: user.id,
        current_step: 'welcome',
        completed_steps: [],
        started_at: new Date().toISOString(),
        preferences: {}
      };

      this.onboardingFlows.set(user.id, progress);
      await database.saveOnboardingProgress(progress);

      // Send welcome DM
      await this.sendWelcomeMessage(user, tier);

      logger.info(`Started onboarding for user ${user.username} (${user.id})`);
    } catch (error) {
      logger.error('Failed to start onboarding', { userId: user.id, error });
      throw error;
    }
  }

  /**
   * Handle onboarding step progression
   */
  async handleStepProgression(userId: string, step: OnboardingStep, data?: any): Promise<void> {
    try {
      const progress = this.onboardingFlows.get(userId) || await database.getOnboardingProgress(userId);
      if (!progress) {
        throw new Error('No onboarding progress found');
      }

      progress.completed_steps.push(progress.current_step);
      progress.current_step = step;

      if (data) {
        progress.preferences = { ...progress.preferences, ...data };
      }

      this.onboardingFlows.set(userId, progress);
      await database.saveOnboardingProgress(progress);

      const user = await this.client.users.fetch(userId);
      await this.sendStepMessage(user, step, progress);

      logger.info(`User ${userId} progressed to step: ${step}`);
    } catch (error) {
      logger.error('Failed to handle step progression', { userId, step, error });
      throw error;
    }
  }

  /**
   * Complete the onboarding process
   */
  async completeOnboarding(userId: string): Promise<void> {
    try {
      const progress = this.onboardingFlows.get(userId) || await database.getOnboardingProgress(userId);
      if (!progress) {
        throw new Error('No onboarding progress found');
      }

      progress.completed_at = new Date().toISOString();
      progress.current_step = 'completion';
      progress.completed_steps.push('completion');

      // Save preferences to user profile
      if (progress.preferences) {
        await database.updateUserPreferences(userId, progress.preferences as UserPreferences);
      }

      await database.saveOnboardingProgress(progress);
      this.onboardingFlows.delete(userId);

      const user = await this.client.users.fetch(userId);
      await this.sendCompletionMessage(user);

      // Schedule follow-up messages
      await this.scheduleFollowUpMessages(userId);

      logger.info(`Completed onboarding for user ${userId}`);
    } catch (error) {
      logger.error('Failed to complete onboarding', { userId, error });
      throw error;
    }
  }

  /**
   * Send welcome message with tier-specific content
   */
  private async sendWelcomeMessage(user: User, tier: UserTier): Promise<void> {
    const tierConfig = this.getTierConfig(tier);
    
    const embed = new EmbedBuilder()
      .setTitle(`${tierConfig.emoji} Welcome to Unit Talk!`)
      .setDescription(this.getWelcomeMessage(tier))
      .setColor(tierConfig.color)
      .addFields([
        {
          name: '🎯 What\'s Next?',
          value: 'Let\'s get you set up with a personalized experience tailored to your betting goals.',
          inline: false
        },
        {
          name: '⏱️ Time Required',
          value: '~3 minutes to complete setup',
          inline: true
        },
        {
          name: '🎁 Your Benefits',
          value: this.getTierBenefits(tier),
          inline: true
        }
      ])
      .setFooter({ text: 'Step 1 of 5 • Welcome' })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('onboarding_start_profile')
          .setLabel('Get Started')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🚀'),
        new ButtonBuilder()
          .setCustomId('onboarding_skip')
          .setLabel('Skip Setup')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⏭️')
      );

    try {
      await user.send({ embeds: [embed], components: [actionRow] });
    } catch (error) {
      logger.error('Failed to send welcome DM', { userId: user.id, error });
      // Fallback: could send to a welcome channel instead
    }
  }

  /**
   * Send step-specific messages
   */
  private async sendStepMessage(user: User, step: OnboardingStep, progress: OnboardingProgress): Promise<void> {
    switch (step) {
      case 'profile':
        await this.sendProfileStep(user);
        break;
      case 'preferences':
        await this.sendPreferencesStep(user);
        break;
      case 'tutorial':
        await this.sendTutorialStep(user, progress);
        break;
      case 'completion':
        await this.sendCompletionMessage(user);
        break;
    }
  }

  /**
   * Send profile setup step
   */
  private async sendProfileStep(user: User): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📋 Tell Us About Yourself')
      .setDescription('Help us personalize your Unit Talk experience by sharing a bit about your betting background.')
      .setColor(0x3498db)
      .addFields([
        {
          name: '🎯 Why This Matters',
          value: 'We\'ll use this info to provide better recommendations and coaching tailored to your experience level.',
          inline: false
        }
      ])
      .setFooter({ text: 'Step 2 of 5 • Profile Setup' })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('onboarding_experience_level')
      .setPlaceholder('Select your betting experience level')
      .addOptions([
        {
          label: 'Beginner',
          description: 'New to sports betting',
          value: 'beginner',
          emoji: '🌱'
        },
        {
          label: 'Intermediate',
          description: 'Some experience, looking to improve',
          value: 'intermediate',
          emoji: '📈'
        },
        {
          label: 'Advanced',
          description: 'Experienced bettor with solid strategy',
          value: 'advanced',
          emoji: '🎯'
        },
        {
          label: 'Expert',
          description: 'Professional or semi-professional level',
          value: 'expert',
          emoji: '👑'
        }
      ]);

    const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);

    try {
      await user.send({ embeds: [embed], components: [actionRow] });
    } catch (error) {
      logger.error('Failed to send profile step DM', { userId: user.id, error });
    }
  }

  /**
   * Send preferences setup step
   */
  private async sendPreferencesStep(user: User): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Customize Your Experience')
      .setDescription('Choose your favorite sports and set up your notification preferences.')
      .setColor(0x9b59b6)
      .addFields([
        {
          name: '🏈 Sports Selection',
          value: 'Pick the sports you\'re most interested in betting on.',
          inline: false
        },
        {
          name: '🔔 Notifications',
          value: 'Control how and when you receive updates.',
          inline: false
        }
      ])
      .setFooter({ text: 'Step 3 of 5 • Preferences' })
      .setTimestamp();

    const sportsMenu = new StringSelectMenuBuilder()
      .setCustomId('onboarding_sports_selection')
      .setPlaceholder('Select your favorite sports (up to 5)')
      .setMaxValues(5)
      .addOptions([
        { label: 'NFL', value: 'nfl', emoji: '🏈' },
        { label: 'NBA', value: 'nba', emoji: '🏀' },
        { label: 'MLB', value: 'mlb', emoji: '⚾' },
        { label: 'NHL', value: 'nhl', emoji: '🏒' },
        { label: 'Soccer', value: 'soccer', emoji: '⚽' },
        { label: 'College Football', value: 'ncaaf', emoji: '🏟️' },
        { label: 'College Basketball', value: 'ncaab', emoji: '🎓' },
        { label: 'Tennis', value: 'tennis', emoji: '🎾' },
        { label: 'MMA/Boxing', value: 'combat', emoji: '🥊' },
        { label: 'Racing', value: 'racing', emoji: '🏁' }
      ]);

    const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(sportsMenu);

    try {
      await user.send({ embeds: [embed], components: [actionRow] });
    } catch (error) {
      logger.error('Failed to send preferences step DM', { userId: user.id, error });
    }
  }

  /**
   * Send tutorial step with tier-specific content
   */
  private async sendTutorialStep(user: User, progress: OnboardingProgress): Promise<void> {
    const userProfile = await database.getUserProfile(user.id);
    const tier = userProfile?.tier || 'member';
    
    const embed = new EmbedBuilder()
      .setTitle('🎓 Quick Tutorial')
      .setDescription('Learn how to make the most of Unit Talk\'s features.')
      .setColor(0xe74c3c)
      .addFields([
        {
          name: '📝 Submitting Picks',
          value: 'Use `/pick submit` to submit your betting picks with analysis.',
          inline: false
        },
        {
          name: '📊 Viewing Analytics',
          value: 'Track your performance with `/pick analytics`.',
          inline: false
        }
      ])
      .setFooter({ text: 'Step 4 of 5 • Tutorial' })
      .setTimestamp();

    // Add tier-specific tutorial content
    if (tier === 'vip' || tier === 'vip_plus') {
      embed.addFields([
        {
          name: '🤖 AI Coaching',
          value: 'Get personalized betting advice with `/pick coaching`.',
          inline: false
        }
      ]);
    }

    if (tier === 'vip_plus') {
      embed.addFields([
        {
          name: '📈 Advanced Charts',
          value: 'Access detailed performance charts and analytics.',
          inline: false
        },
        {
          name: '🎯 Parlay Builder',
          value: 'Build optimized parlays with correlation analysis.',
          inline: false
        }
      ]);
    }

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('onboarding_complete_tutorial')
          .setLabel('I\'m Ready!')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId('onboarding_need_help')
          .setLabel('Need Help')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❓')
      );

    try {
      await user.send({ embeds: [embed], components: [actionRow] });
    } catch (error) {
      logger.error('Failed to send tutorial step DM', { userId: user.id, error });
    }
  }

  /**
   * Send completion message
   */
  private async sendCompletionMessage(user: User): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎉 Welcome to the Unit Talk Community!')
      .setDescription('You\'re all set up and ready to start your profitable betting journey.')
      .setColor(0x27ae60)
      .addFields([
        {
          name: '🚀 Next Steps',
          value: '• Submit your first pick with `/pick submit`\n• Join the community discussion\n• Check out today\'s featured picks',
          inline: false
        },
        {
          name: '💡 Pro Tips',
          value: '• Start with smaller stakes while you learn\n• Focus on sports you know well\n• Track your performance regularly',
          inline: false
        },
        {
          name: '🆘 Need Help?',
          value: 'Use `/help` anytime or ask questions in our community channels.',
          inline: false
        }
      ])
      .setFooter({ text: 'Step 5 of 5 • Complete!' })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('onboarding_first_pick')
          .setLabel('Submit First Pick')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎯'),
        new ButtonBuilder()
          .setCustomId('onboarding_join_community')
          .setLabel('Join Community')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('👥')
      );

    try {
      await user.send({ embeds: [embed], components: [actionRow] });
    } catch (error) {
      logger.error('Failed to send completion DM', { userId: user.id, error });
    }
  }

  /**
   * Handle button and select menu interactions
   */
  async handleInteraction(interaction: any): Promise<void> {
    if (!interaction.customId.startsWith('onboarding_')) return;

    const userId = interaction.user.id;
    const action = interaction.customId.replace('onboarding_', '');

    try {
      switch (action) {
        case 'start_profile':
          await this.handleStepProgression(userId, 'profile');
          break;
        case 'skip':
          await this.skipOnboarding(userId);
          break;
        case 'complete_tutorial':
          await this.completeOnboarding(userId);
          break;
        case 'experience_level':
          await this.handleExperienceSelection(userId, interaction.values[0]);
          break;
        case 'sports_selection':
          await this.handleSportsSelection(userId, interaction.values);
          break;
        case 'toggle_dm':
          await this.toggleDMPreferences(userId);
          break;
        default:
          logger.warn(`Unknown onboarding action: ${action}`);
      }

      await interaction.deferUpdate();
    } catch (error) {
      logger.error('Failed to handle onboarding interaction', { userId, action, error });
      await interaction.reply({ 
        content: 'Sorry, something went wrong. Please try again or contact support.', 
        ephemeral: true 
      });
    }
  }

  /**
   * Handle experience level selection
   */
  private async handleExperienceSelection(userId: string, experienceLevel: string): Promise<void> {
    const progress = this.onboardingFlows.get(userId);
    if (!progress) return;

    progress.preferences = {
      ...progress.preferences,
      experience_level: experienceLevel as any
    };

    await this.handleStepProgression(userId, 'preferences', { experience_level: experienceLevel });
  }

  /**
   * Handle sports selection
   */
  private async handleSportsSelection(userId: string, sports: string[]): Promise<void> {
    const progress = this.onboardingFlows.get(userId);
    if (!progress) return;

    progress.preferences = {
      ...progress.preferences,
      sports
    };

    await this.handleStepProgression(userId, 'tutorial', { sports });
  }

  /**
   * Skip onboarding process
   */
  private async skipOnboarding(userId: string): Promise<void> {
    const progress = this.onboardingFlows.get(userId);
    if (!progress) return;

    progress.completed_at = new Date().toISOString();
    await database.saveOnboardingProgress(progress);
    this.onboardingFlows.delete(userId);

    const user = await this.client.users.fetch(userId);
    const embed = new EmbedBuilder()
      .setTitle('⏭️ Onboarding Skipped')
      .setDescription('No problem! You can always customize your preferences later using `/settings`.')
      .setColor(0x95a5a6)
      .addFields([
        {
          name: '🚀 Quick Start',
          value: 'Use `/pick submit` to submit your first pick and get started right away!',
          inline: false
        }
      ]);

    try {
      await user.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Failed to send skip confirmation DM', { userId, error });
    }
  }

  /**
   * Toggle DM preferences
   */
  private async toggleDMPreferences(userId: string): Promise<void> {
    // Implementation for toggling DM preferences
    logger.info(`Toggling DM preferences for user ${userId}`);
  }

  /**
   * Schedule follow-up messages
   */
  private async scheduleFollowUpMessages(userId: string): Promise<void> {
    const userProfile = await database.getUserProfile(userId);
    const tier = userProfile?.tier || 'member';
    
    const followUpSchedule = this.getFollowUpSchedule(tier);
    
    // Schedule messages (in a real implementation, this would use a job queue)
    followUpSchedule.forEach(({ delay, message }: { delay: number; message: string }) => {
      setTimeout(async () => {
        try {
          const user = await this.client.users.fetch(userId);
          await user.send(message);
        } catch (error) {
          logger.error('Failed to send follow-up message', { userId, error });
        }
      }, delay);
    });
  }

  /**
   * Get tier-specific configuration
   */
  private getTierConfig(tier: UserTier) {
    const configs = {
      member: { emoji: '👋', color: 0x3498db, title: 'Member' },
      trial: { emoji: '🆓', color: 0x17a2b8, title: 'Trial Member' },
      vip: { emoji: '⭐', color: 0xf39c12, title: 'VIP Member' },
      vip_plus: { emoji: '💎', color: 0x9b59b6, title: 'VIP+ Member' },
      capper: { emoji: '🎯', color: 0xE67E22, title: 'Capper' },
      staff: { emoji: '🛡️', color: 0xe74c3c, title: 'Staff Member' },
      admin: { emoji: '👑', color: 0x27ae60, title: 'Administrator' },
      owner: { emoji: '🔥', color: 0xff6b6b, title: 'Owner' }
    };

    return configs[tier] || configs.member;
  }

  /**
   * Get welcome message based on tier
   */
  private getWelcomeMessage(tier: UserTier): string {
    const messages = {
      member: 'Welcome to Unit Talk! We\'re excited to help you improve your betting game with our community-driven insights and tools.',
      trial: 'Welcome to Unit Talk! You\'re on a trial membership - explore our features and upgrade anytime for full access.',
      vip: 'Welcome to Unit Talk VIP! You now have access to premium features including advanced analytics and priority support.',
      vip_plus: 'Welcome to Unit Talk VIP+! Enjoy our most exclusive features including AI coaching, custom charts, and personalized strategies.',
      capper: 'Welcome UT Capper! You have special privileges to submit picks and contribute to our community insights.',
      staff: 'Welcome to the Unit Talk team! You have staff-level access to help manage and support our community.',
      admin: 'Welcome, Administrator! You have full access to all platform features and administrative tools.',
      owner: 'Welcome back, Owner! Full platform access enabled.'
    };

    return messages[tier] || messages.member;
  }

  /**
   * Get tier benefits description
   */
  private getTierBenefits(tier: UserTier): string {
    const benefits = {
      member: '• Community access\n• Basic pick tracking\n• Daily recaps',
      trial: '• Limited community access\n• Basic pick tracking\n• 7-day trial period',
      vip: '• Everything in Member\n• Advanced analytics\n• Priority support\n• Exclusive channels',
      vip_plus: '• Everything in VIP\n• AI coaching\n• Custom charts\n• Parlay optimization\n• 1-on-1 support',
      capper: '• Pick submission privileges\n• Performance tracking\n• Capper dashboard\n• Community recognition',
      staff: '• All platform features\n• Moderation tools\n• Admin dashboard access',
      admin: '• Full administrative access\n• User management\n• System configuration',
      owner: '• Complete platform control\n• All features unlocked'
    };

    return benefits[tier] || benefits.member;
  }

  /**
   * Get tutorial content based on tier
   */
  private getTutorialContent(tier: UserTier): string[] {
    const baseContent = [
      'Submit picks with `/pick submit`',
      'View your history with `/pick history`',
      'Check analytics with `/pick analytics`'
    ];

    if (tier === 'vip' || tier === 'vip_plus') {
      baseContent.push('Get AI coaching with `/pick coaching`');
    }

    if (tier === 'vip_plus') {
      baseContent.push('Build parlays with `/pick parlay`');
      baseContent.push('Access advanced charts and insights');
    }

    return baseContent;
  }

  /**
   * Get follow-up message schedule
   */
  private getFollowUpSchedule(tier: UserTier) {
    const schedules: Record<UserTier, { delay: number; message: string }[]> = {
      member: [
        { delay: 24 * 60 * 60 * 1000, message: '👋 How\'s your first day going? Remember to submit your picks with `/pick submit`!' },
        { delay: 3 * 24 * 60 * 60 * 1000, message: '📊 Check out your performance so far with `/pick analytics`. Keep up the great work!' },
        { delay: 7 * 24 * 60 * 60 * 1000, message: '🎯 One week in! Consider upgrading to VIP for advanced features and better insights.' }
      ],
      trial: [
        { delay: 24 * 60 * 60 * 1000, message: '🆓 Welcome to your trial! You have 7 days to explore our features.' },
        { delay: 3 * 24 * 60 * 60 * 1000, message: '⏰ 4 days left in your trial! Consider upgrading to keep access to all features.' },
        { delay: 6 * 24 * 60 * 60 * 1000, message: '🚨 Last day of trial! Upgrade now to continue your betting journey with us.' }
      ],
      vip: [
        { delay: 24 * 60 * 60 * 1000, message: '⭐ Welcome to VIP! Try out the advanced analytics and let us know what you think.' },
        { delay: 3 * 24 * 60 * 60 * 1000, message: '📈 Your VIP analytics are looking great! Keep leveraging those insights.' },
        { delay: 7 * 24 * 60 * 60 * 1000, message: '💎 Ready for the ultimate experience? VIP+ includes AI coaching and custom charts!' }
      ],
      vip_plus: [
        { delay: 24 * 60 * 60 * 1000, message: '💎 VIP+ activated! Your AI coach is ready to help optimize your strategy.' },
        { delay: 3 * 24 * 60 * 60 * 1000, message: '🤖 How are you finding the AI coaching? It gets smarter as you use it more!' },
        { delay: 7 * 24 * 60 * 60 * 1000, message: '🏆 You\'re making the most of VIP+! Keep up the excellent work.' }
      ],
      capper: [
        { delay: 24 * 60 * 60 * 1000, message: '🎯 Welcome, Capper! Start submitting your picks and building your reputation.' },
        { delay: 3 * 24 * 60 * 60 * 1000, message: '📊 How are your picks performing? Check your capper dashboard for insights.' },
        { delay: 7 * 24 * 60 * 60 * 1000, message: '🏆 Keep up the great work! Your picks are helping the community.' }
      ],
      staff: [
        { delay: 24 * 60 * 60 * 1000, message: '👨‍💼 Welcome to the staff team! Check out the admin tools and let us know if you need help.' }
      ],
      admin: [
        { delay: 24 * 60 * 60 * 1000, message: '🛡️ Admin access granted! You have full control over the platform.' }
      ],
      owner: [
        { delay: 24 * 60 * 60 * 1000, message: '👑 Welcome, owner! The platform is yours to command.' }
      ]
    };

    return schedules[tier] || schedules.member;
  }

  /**
   * Get onboarding status for a user
   */
  async getOnboardingStatus(userId: string): Promise<OnboardingProgress | null> {
    try {
      return this.onboardingFlows.get(userId) || await database.getOnboardingProgress(userId);
    } catch (error) {
      logger.error('Failed to get onboarding status', { userId, error });
      return null;
    }
  }



  /**
   * Reset onboarding for a user
   */
  async resetOnboarding(userId: string): Promise<void> {
    try {
      this.onboardingFlows.delete(userId);
      // In a real implementation, this would also clear the database record
      logger.info(`Reset onboarding for user ${userId}`);
    } catch (error) {
      logger.error('Failed to reset onboarding', { userId, error });
      throw error;
    }
  }
}