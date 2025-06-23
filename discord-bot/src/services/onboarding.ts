import { 
  Client, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  User,
  TextChannel,
  DMChannel
} from 'discord.js';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  type: 'welcome' | 'profile' | 'preferences' | 'tutorial' | 'completion';
  requiredTier?: 'FREE' | 'VIP' | 'VIP_PLUS';
  nextStep?: string;
}

interface UserOnboardingState {
  userId: string;
  currentStep: string;
  completedSteps: string[];
  preferences: {
    favoriteSports: string[];
    bettingExperience: 'beginner' | 'intermediate' | 'advanced';
    notifications: boolean;
    timezone: string;
    preferredOddsFormat: 'american' | 'decimal' | 'fractional';
  };
  tier: 'FREE' | 'VIP' | 'VIP_PLUS';
  startedAt: Date;
  completedAt?: Date;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: '👋 Welcome to Unit Talk!',
    description: 'Your journey to smarter betting starts here',
    type: 'welcome',
    nextStep: 'profile'
  },
  {
    id: 'profile',
    title: '👤 Set Up Your Profile',
    description: 'Tell us about your betting experience',
    type: 'profile',
    nextStep: 'preferences'
  },
  {
    id: 'preferences',
    title: '⚙️ Configure Preferences',
    description: 'Customize your Unit Talk experience',
    type: 'preferences',
    nextStep: 'tutorial'
  },
  {
    id: 'tutorial',
    title: '🎓 Quick Tutorial',
    description: 'Learn how to use Unit Talk effectively',
    type: 'tutorial',
    nextStep: 'completion'
  },
  {
    id: 'completion',
    title: '🎉 Setup Complete!',
    description: 'You\'re ready to start your betting journey',
    type: 'completion'
  }
];

export class OnboardingService {
  private client: Client;
  private onboardingStates: Map<string, UserOnboardingState> = new Map();

  constructor(client: Client) {
    this.client = client;
    this.loadOnboardingStates();
  }

  async startOnboarding(user: User, tier: 'FREE' | 'VIP' | 'VIP_PLUS' = 'FREE'): Promise<void> {
    try {
      const userId = user.id;
      
      // Check if user has already completed onboarding
      const existingState = await this.getOnboardingState(userId);
      if (existingState?.completedAt) {
        await this.sendWelcomeBackMessage(user, existingState);
        return;
      }

      // Initialize onboarding state
      const onboardingState: UserOnboardingState = {
        userId,
        currentStep: 'welcome',
        completedSteps: [],
        preferences: {
          favoriteSports: [],
          bettingExperience: 'beginner',
          notifications: true,
          timezone: 'UTC',
          preferredOddsFormat: 'american'
        },
        tier,
        startedAt: new Date()
      };

      this.onboardingStates.set(userId, onboardingState);
      await this.saveOnboardingState(onboardingState);

      // Start the onboarding flow
      await this.sendOnboardingStep(user, 'welcome');
      
      logger.info(`Started onboarding for user ${userId} with tier ${tier}`);
    } catch (error) {
      logger.error('Error starting onboarding:', error);
      throw error;
    }
  }

  async handleOnboardingInteraction(userId: string, interactionType: string, data: any): Promise<void> {
    try {
      const state = this.onboardingStates.get(userId);
      if (!state) {
        logger.warn(`No onboarding state found for user ${userId}`);
        return;
      }

      const currentStep = ONBOARDING_STEPS.find(step => step.id === state.currentStep);
      if (!currentStep) {
        logger.error(`Invalid onboarding step: ${state.currentStep}`);
        return;
      }

      // Process the interaction based on step type
      await this.processStepInteraction(state, currentStep, interactionType, data);
      
      // Move to next step if current step is complete
      if (currentStep.nextStep && !state.completedSteps.includes(currentStep.id)) {
        state.completedSteps.push(currentStep.id);
        state.currentStep = currentStep.nextStep;
        
        const user = await this.client.users.fetch(userId);
        await this.sendOnboardingStep(user, currentStep.nextStep);
      }

      await this.saveOnboardingState(state);
    } catch (error) {
      logger.error('Error handling onboarding interaction:', error);
    }
  }

  private async sendOnboardingStep(user: User, stepId: string): Promise<void> {
    const step = ONBOARDING_STEPS.find(s => s.id === stepId);
    if (!step) return;

    const state = this.onboardingStates.get(user.id);
    if (!state) return;

    try {
      const dmChannel = await user.createDM();
      
      switch (step.type) {
        case 'welcome':
          await this.sendWelcomeStep(dmChannel, state);
          break;
        case 'profile':
          await this.sendProfileStep(dmChannel, state);
          break;
        case 'preferences':
          await this.sendPreferencesStep(dmChannel, state);
          break;
        case 'tutorial':
          await this.sendTutorialStep(dmChannel, state);
          break;
        case 'completion':
          await this.sendCompletionStep(dmChannel, state);
          break;
      }
    } catch (error) {
      logger.error(`Error sending onboarding step ${stepId}:`, error);
    }
  }

  private async sendWelcomeStep(channel: DMChannel, state: UserOnboardingState): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎯 Welcome to Unit Talk!')
      .setDescription('The premier platform for intelligent sports betting')
      .setColor(0x00AE86)
      .addFields(
        { 
          name: '🚀 What You Get', 
          value: this.getTierBenefits(state.tier), 
          inline: false 
        },
        { 
          name: '📈 Our Track Record', 
          value: '• 67.3% average win rate\n• $2.1M+ in tracked profits\n• 15,000+ successful picks\n• 24/7 expert analysis', 
          inline: false 
        },
        { 
          name: '🎓 Getting Started', 
          value: 'This quick setup will personalize your experience and help you maximize your betting potential.', 
          inline: false 
        }
      )
      .setFooter({ text: 'Unit Talk • Step 1 of 4' })
      .setTimestamp();

    const continueButton = new ButtonBuilder()
      .setCustomId('onboarding_continue_profile')
      .setLabel('🚀 Let\'s Get Started!')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(continueButton);

    await channel.send({ embeds: [embed], components: [row] });
  }

  private async sendProfileStep(channel: DMChannel, state: UserOnboardingState): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('👤 Tell Us About Yourself')
      .setDescription('Help us customize your Unit Talk experience')
      .setColor(0x4A90E2)
      .addFields(
        { 
          name: '🎯 Why This Matters', 
          value: 'Understanding your experience level helps us provide better recommendations and educational content.', 
          inline: false 
        }
      )
      .setFooter({ text: 'Unit Talk • Step 2 of 4' })
      .setTimestamp();

    const experienceSelect = new StringSelectMenuBuilder()
      .setCustomId('onboarding_experience_select')
      .setPlaceholder('Select your betting experience level')
      .addOptions([
        {
          label: '🌱 Beginner',
          description: 'New to sports betting or just getting started',
          value: 'beginner',
          emoji: '🌱'
        },
        {
          label: '📈 Intermediate',
          description: 'Some experience, looking to improve results',
          value: 'intermediate',
          emoji: '📈'
        },
        {
          label: '🏆 Advanced',
          description: 'Experienced bettor seeking edge and community',
          value: 'advanced',
          emoji: '🏆'
        }
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(experienceSelect);

    await channel.send({ embeds: [embed], components: [row] });
  }

  private async sendPreferencesStep(channel: DMChannel, state: UserOnboardingState): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Customize Your Experience')
      .setDescription('Set your preferences for the best Unit Talk experience')
      .setColor(0x9B59B6)
      .addFields(
        { 
          name: '🏈 Favorite Sports', 
          value: 'Select the sports you\'re most interested in betting on', 
          inline: false 
        }
      )
      .setFooter({ text: 'Unit Talk • Step 3 of 4' })
      .setTimestamp();

    const sportsSelect = new StringSelectMenuBuilder()
      .setCustomId('onboarding_sports_select')
      .setPlaceholder('Select your favorite sports (up to 5)')
      .setMinValues(1)
      .setMaxValues(5)
      .addOptions([
        { label: '🏈 NFL', value: 'nfl', emoji: '🏈' },
        { label: '🏀 NBA', value: 'nba', emoji: '🏀' },
        { label: '⚾ MLB', value: 'mlb', emoji: '⚾' },
        { label: '🏒 NHL', value: 'nhl', emoji: '🏒' },
        { label: '⚽ Soccer', value: 'soccer', emoji: '⚽' },
        { label: '🏀 College Basketball', value: 'ncaab', emoji: '🏀' },
        { label: '🏈 College Football', value: 'ncaaf', emoji: '🏈' },
        { label: '🎾 Tennis', value: 'tennis', emoji: '🎾' },
        { label: '🥊 MMA/Boxing', value: 'combat', emoji: '🥊' }
      ]);

    const row1 = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(sportsSelect);

    // Notification preferences
    const notificationButton = new ButtonBuilder()
      .setCustomId('onboarding_notifications_toggle')
      .setLabel(state.preferences.notifications ? '🔔 Notifications: ON' : '🔕 Notifications: OFF')
      .setStyle(state.preferences.notifications ? ButtonStyle.Success : ButtonStyle.Secondary);

    const oddsFormatSelect = new StringSelectMenuBuilder()
      .setCustomId('onboarding_odds_format')
      .setPlaceholder('Select preferred odds format')
      .addOptions([
        { label: 'American (-110, +150)', value: 'american' },
        { label: 'Decimal (1.91, 2.50)', value: 'decimal' },
        { label: 'Fractional (10/11, 3/2)', value: 'fractional' }
      ]);

    const row2 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(notificationButton);

    const row3 = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(oddsFormatSelect);

    await channel.send({ embeds: [embed], components: [row1, row2, row3] });
  }

  private async sendTutorialStep(channel: DMChannel, state: UserOnboardingState): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎓 Quick Tutorial')
      .setDescription('Learn the basics of using Unit Talk effectively')
      .setColor(0xE67E22)
      .addFields(
        { 
          name: '📝 Submitting Picks', 
          value: 'Use `/pick submit` to share your betting picks with the community. Include reasoning and confidence levels.', 
          inline: false 
        },
        { 
          name: '📊 Tracking Performance', 
          value: 'View your stats with `/pick history`. Track win rates, ROI, and identify your strongest sports.', 
          inline: false 
        },
        { 
          name: '🤝 Community Features', 
          value: 'Follow top performers, join discussions, and learn from experienced bettors in our channels.', 
          inline: false 
        }
      )
      .setFooter({ text: 'Unit Talk • Step 4 of 4' })
      .setTimestamp();

    // Add tier-specific features
    if (state.tier === 'VIP' || state.tier === 'VIP_PLUS') {
      embed.addFields({
        name: '💎 VIP Features',
        value: this.getVIPTutorialContent(state.tier),
        inline: false
      });
    }

    const tutorialButton = new ButtonBuilder()
      .setCustomId('onboarding_start_tutorial')
      .setLabel('📚 Start Interactive Tutorial')
      .setStyle(ButtonStyle.Primary);

    const skipButton = new ButtonBuilder()
      .setCustomId('onboarding_skip_tutorial')
      .setLabel('⏭️ Skip Tutorial')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(tutorialButton, skipButton);

    await channel.send({ embeds: [embed], components: [row] });
  }

  private async sendCompletionStep(channel: DMChannel, state: UserOnboardingState): Promise<void> {
    // Mark onboarding as complete
    state.completedAt = new Date();
    await this.saveOnboardingState(state);

    const embed = new EmbedBuilder()
      .setTitle('🎉 Welcome to the Unit Talk Family!')
      .setDescription('Your account is now fully set up and ready to go')
      .setColor(0x27AE60)
      .addFields(
        { 
          name: '🚀 What\'s Next?', 
          value: '• Join our main Discord server\n• Submit your first pick\n• Explore the community\n• Start tracking your performance', 
          inline: false 
        },
        { 
          name: '📞 Need Help?', 
          value: 'Use `/help` anytime or reach out to our support team. We\'re here to help you succeed!', 
          inline: false 
        },
        { 
          name: '🎯 Your Goals', 
          value: this.getPersonalizedGoals(state), 
          inline: false 
        }
      )
      .setFooter({ text: 'Unit Talk • Setup Complete!' })
      .setTimestamp();

    const joinServerButton = new ButtonBuilder()
      .setCustomId('onboarding_join_server')
      .setLabel('🏠 Join Main Server')
      .setStyle(ButtonStyle.Success);

    const firstPickButton = new ButtonBuilder()
      .setCustomId('onboarding_first_pick')
      .setLabel('🎯 Submit First Pick')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(joinServerButton, firstPickButton);

    await channel.send({ embeds: [embed], components: [row] });

    // Send follow-up messages
    await this.scheduleFollowUpMessages(state.userId);
  }

  private async processStepInteraction(
    state: UserOnboardingState, 
    step: OnboardingStep, 
    interactionType: string, 
    data: any
  ): Promise<void> {
    switch (step.id) {
      case 'profile':
        if (interactionType === 'experience_select') {
          state.preferences.bettingExperience = data.value;
        }
        break;
      case 'preferences':
        if (interactionType === 'sports_select') {
          state.preferences.favoriteSports = data.values;
        } else if (interactionType === 'notifications_toggle') {
          state.preferences.notifications = !state.preferences.notifications;
        } else if (interactionType === 'odds_format') {
          state.preferences.preferredOddsFormat = data.value;
        }
        break;
    }
  }

  private getTierBenefits(tier: string): string {
    switch (tier) {
      case 'VIP_PLUS':
        return '• AI-powered pick analysis\n• Advanced performance analytics\n• Personal betting coach\n• Priority support\n• Exclusive VIP+ channels\n• Custom performance charts';
      case 'VIP':
        return '• Parlay builder tools\n• Extended pick history\n• VIP-only channels\n• Priority notifications\n• Advanced statistics';
      case 'FREE':
        return '• Community pick sharing\n• Basic performance tracking\n• 7-day pick history\n• General chat access';
      default:
        return '• Basic community features';
    }
  }

  private getVIPTutorialContent(tier: string): string {
    if (tier === 'VIP_PLUS') {
      return '• Use `/pick analytics` for AI-powered insights\n• Access `/pick coaching` for personalized tips\n• Generate performance charts and reports';
    } else {
      return '• Build parlays with `/pick parlay`\n• Access VIP-only channels\n• Get priority support';
    }
  }

  private getPersonalizedGoals(state: UserOnboardingState): string {
    const experience = state.preferences.bettingExperience;
    const sports = state.preferences.favoriteSports.join(', ');
    
    switch (experience) {
      case 'beginner':
        return `Focus on learning ${sports} betting fundamentals and building a solid foundation with small, consistent bets.`;
      case 'intermediate':
        return `Improve your ${sports} analysis skills and work towards a 60%+ win rate with better bankroll management.`;
      case 'advanced':
        return `Leverage advanced analytics and community insights to optimize your ${sports} betting strategy and ROI.`;
      default:
        return 'Build a sustainable and profitable betting approach with our community support.';
    }
  }

  private async scheduleFollowUpMessages(userId: string): Promise<void> {
    // Schedule follow-up messages at 1 day, 3 days, and 1 week
    const followUpTimes = [
      { delay: 24 * 60 * 60 * 1000, message: 'day1' }, // 1 day
      { delay: 3 * 24 * 60 * 60 * 1000, message: 'day3' }, // 3 days
      { delay: 7 * 24 * 60 * 60 * 1000, message: 'week1' } // 1 week
    ];

    for (const followUp of followUpTimes) {
      setTimeout(async () => {
        await this.sendFollowUpMessage(userId, followUp.message);
      }, followUp.delay);
    }
  }

  private async sendFollowUpMessage(userId: string, messageType: string): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      const dmChannel = await user.createDM();
      
      let embed: EmbedBuilder;
      
      switch (messageType) {
        case 'day1':
          embed = new EmbedBuilder()
            .setTitle('👋 How\'s Your First Day Going?')
            .setDescription('Just checking in to see how you\'re settling into Unit Talk!')
            .setColor(0x3498DB)
            .addFields(
              { name: '🎯 Quick Tips', value: '• Start with small bets to get comfortable\n• Check out our daily picks channel\n• Don\'t hesitate to ask questions!', inline: false }
            );
          break;
        case 'day3':
          embed = new EmbedBuilder()
            .setTitle('📈 Ready to Level Up?')
            .setDescription('You\'ve been with us for 3 days - time to explore more features!')
            .setColor(0x9B59B6)
            .addFields(
              { name: '🚀 Next Steps', value: '• Try submitting your own picks\n• Follow some top performers\n• Join the community discussions', inline: false }
            );
          break;
        case 'week1':
          embed = new EmbedBuilder()
            .setTitle('🎉 One Week Strong!')
            .setDescription('Congratulations on your first week with Unit Talk!')
            .setColor(0x27AE60)
            .addFields(
              { name: '📊 Time to Analyze', value: '• Check your performance stats\n• Consider upgrading for advanced features\n• Share your success stories!', inline: false }
            );
          break;
        default:
          return;
      }
      
      await dmChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error(`Error sending follow-up message ${messageType} to user ${userId}:`, error);
    }
  }

  private async sendWelcomeBackMessage(user: User, state: UserOnboardingState): Promise<void> {
    try {
      const dmChannel = await user.createDM();
      
      const embed = new EmbedBuilder()
        .setTitle('👋 Welcome Back!')
        .setDescription('Great to see you again! Your account is already set up and ready to go.')
        .setColor(0x27AE60)
        .addFields(
          { name: '🎯 Your Preferences', value: `Sports: ${state.preferences.favoriteSports.join(', ')}\nExperience: ${state.preferences.bettingExperience}\nTier: ${state.tier}`, inline: false },
          { name: '🚀 Quick Actions', value: '• Submit a new pick\n• Check your stats\n• Browse community picks', inline: false }
        )
        .setFooter({ text: `Member since ${state.startedAt.toLocaleDateString()}` })
        .setTimestamp();

      await dmChannel.send({ embeds: [embed] });
    } catch (error) {
      logger.error('Error sending welcome back message:', error);
    }
  }

  // Database operations
  private async loadOnboardingStates(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('user_onboarding')
        .select('*')
        .is('completed_at', null);

      if (error) throw error;

      for (const record of data || []) {
        this.onboardingStates.set(record.user_id, {
          userId: record.user_id,
          currentStep: record.current_step,
          completedSteps: record.completed_steps || [],
          preferences: record.preferences || {},
          tier: record.tier || 'FREE',
          startedAt: new Date(record.started_at),
          completedAt: record.completed_at ? new Date(record.completed_at) : undefined
        });
      }
    } catch (error) {
      logger.error('Error loading onboarding states:', error);
    }
  }

  private async saveOnboardingState(state: UserOnboardingState): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_onboarding')
        .upsert({
          user_id: state.userId,
          current_step: state.currentStep,
          completed_steps: state.completedSteps,
          preferences: state.preferences,
          tier: state.tier,
          started_at: state.startedAt.toISOString(),
          completed_at: state.completedAt?.toISOString()
        });

      if (error) throw error;
    } catch (error) {
      logger.error('Error saving onboarding state:', error);
    }
  }

  private async getOnboardingState(userId: string): Promise<UserOnboardingState | null> {
    try {
      const { data, error } = await supabase
        .from('user_onboarding')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) return null;

      return {
        userId: data.user_id,
        currentStep: data.current_step,
        completedSteps: data.completed_steps || [],
        preferences: data.preferences || {},
        tier: data.tier || 'FREE',
        startedAt: new Date(data.started_at),
        completedAt: data.completed_at ? new Date(data.completed_at) : undefined
      };
    } catch (error) {
      logger.error('Error getting onboarding state:', error);
      return null;
    }
  }
}