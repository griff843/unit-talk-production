import {
  Client,
  GuildMember,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  DMChannel,
  User
} from 'discord.js';
import { SupabaseService } from './supabase';
import { PermissionsService } from './permissions';
import { AdvancedAnalyticsService } from './advancedAnalyticsService';
import { logger } from '../utils/logger';
import { botConfig } from '../config';

export interface OnboardingStep {
  id: string;
  name: string;
  description: string;
  required: boolean;
  order: number;
  dmTemplate: string;
  buttonText?: string;
  nextStep?: string;
  roleToAssign?: string;
  channelToNotify?: string;
}

export interface OnboardingFlow {
  id: string;
  name: string;
  description: string;
  targetRole: string;
  steps: OnboardingStep[];
  welcomeMessage: string;
  completionMessage: string;
  failureMessage: string;
  isActive: boolean;
}

export interface OnboardingProgress {
  userId: string;
  flowId: string;
  currentStep: string;
  completedSteps: string[];
  startedAt: Date;
  lastActivity: Date;
  status: 'started' | 'in_progress' | 'completed' | 'failed' | 'abandoned';
  preferences: Record<string, any>;
  dmFailures: string[];
  retryCount: number;
}

export interface OnboardingPreferences {
  sports: string[];
  notificationLevel: 'all' | 'important' | 'minimal';
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  timezone: string;
  favoriteTeams: string[];
  bettingStyle: 'conservative' | 'moderate' | 'aggressive';
}

export interface DMFailure {
  id: string;
  userId: string;
  step: string;
  flowId: string;
  failureReason: string;
  attemptedAt: Date;
  retryCount: number;
  resolved: boolean;
  adminNotified: boolean;
}

export class OnboardingService {
  private client: Client;
  private supabaseService: SupabaseService;
  private permissionsService: PermissionsService;
  private analyticsService: AdvancedAnalyticsService;
  private onboardingFlows: Map<string, OnboardingFlow> = new Map();
  private userProgress: Map<string, OnboardingProgress> = new Map();

  constructor(
    client: Client,
    supabaseService: SupabaseService,
    permissionsService: PermissionsService,
    analyticsService: AdvancedAnalyticsService
  ) {
    this.client = client;
    this.supabaseService = supabaseService;
    this.permissionsService = permissionsService;
    this.analyticsService = analyticsService;
    
    this.initializeOnboardingFlows();
  }

  /**
   * Initialize default onboarding flows
   */
  private async initializeOnboardingFlows(): Promise<void> {
    try {
      // Load flows from Supabase or use defaults
      const flows = await this.loadOnboardingFlowsFromDB();
      
      if (flows.length === 0) {
        // Create default flows
        await this.createDefaultOnboardingFlows();
      } else {
        flows.forEach(flow => {
          this.onboardingFlows.set(flow.id, flow);
        });
      }
      
      logger.info(`Loaded ${this.onboardingFlows.size} onboarding flows`);
    } catch (error) {
      logger.error('Failed to initialize onboarding flows:', error);
      // Fall back to hardcoded defaults
      this.createHardcodedDefaults();
    }
  }

  /**
   * Start onboarding process for a new member
   */
  async startOnboarding(member: GuildMember): Promise<void> {
    try {
      // Log analytics event
      await this.logOnboardingEvent('onboarding_started', member.id, {
        flowType: 'default',
        timestamp: new Date().toISOString()
      });

      // Determine appropriate onboarding flow
      const flow = this.determineOnboardingFlow(member);

      // Create progress tracking
      const progress: OnboardingProgress = {
        userId: member.id,
        flowId: flow.id,
        currentStep: flow.steps[0]?.id || 'welcome',
        completedSteps: [],
        startedAt: new Date(),
        lastActivity: new Date(),
        status: 'started',
        preferences: {},
        dmFailures: [],
        retryCount: 0
      };

      this.userProgress.set(member.id, progress);
      await this.saveProgressToDB(progress);

      // Send welcome message
      await this.sendWelcomeMessage(member, flow);
      
      // Start first step
      await this.executeOnboardingStep(member, flow.steps[0], flow);

    } catch (error) {
      logger.error('Failed to start onboarding:', error);
      await this.handleOnboardingError(member, error);
    }
  }

  /**
   * Send welcome message with fallback logic
   */
  private async sendWelcomeMessage(member: GuildMember, flow: OnboardingFlow): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎉 Welcome to Unit Talk!')
      .setDescription(flow.welcomeMessage)
      .setColor(0x00AE86)
      .setThumbnail(member.user.displayAvatarURL())
      .addFields([
        {
          name: '📋 What\'s Next?',
          value: 'We\'ll guide you through a quick setup process to personalize your experience.',
          inline: false
        },
        {
          name: '⏱️ Time Required',
          value: '~2-3 minutes',
          inline: true
        },
        {
          name: '🎯 Goal',
          value: 'Get you the best betting insights!',
          inline: true
        }
      ])
      .setFooter({ text: 'Unit Talk - Your Betting Edge' });

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`onboarding_start_${member.id}`)
          .setLabel('🚀 Start Setup')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`onboarding_skip_${member.id}`)
          .setLabel('⏭️ Skip for Now')
          .setStyle(ButtonStyle.Secondary)
      );

    try {
      // Try to send DM first
      await member.send({ embeds: [embed], components: [actionRow] });

      await this.logOnboardingEvent('onboarding_welcome_dm_sent', member.id, {
        method: 'dm',
        flowId: flow.id,
        timestamp: new Date().toISOString()
      });

    } catch (dmError) {
      // DM failed, log failure and notify admin
      await this.logOnboardingEvent('onboarding_dm_failed', member.id, {
        flowId: flow.id,
        stepType: 'welcome',
        timestamp: new Date().toISOString(),
        error: dmError instanceof Error ? dmError.message : String(dmError)
      });
      await this.handleDMFailure(member, 'welcome', flow.id, dmError);

      // Try to send in welcome channel as fallback
      await this.sendWelcomeChannelFallback(member, embed, actionRow, flow);
    }
  }

  /**
   * Handle DM failures with comprehensive logging and admin notification
   */
  private async handleDMFailure(
    member: GuildMember, 
    step: string, 
    flowId: string, 
    error: any
  ): Promise<void> {
    const failure: DMFailure = {
      id: `${member.id}_${step}_${Date.now()}`,
      userId: member.id,
      step,
      flowId,
      failureReason: error.message || 'Unknown error',
      attemptedAt: new Date(),
      retryCount: 0,
      resolved: false,
      adminNotified: false
    };

    // Log to database
    await this.logDMFailure(failure);
    
    // Update user progress
    const progress = this.userProgress.get(member.id);
    if (progress) {
      progress.dmFailures.push(step);
      await this.saveProgressToDB(progress);
    }

    // Notify admin channel
    await this.notifyAdminOfDMFailure(member, failure);

    // Log analytics event if progress exists
    if (progress) {
      await this.logOnboardingEvent('onboarding_dm_failure', progress.userId, {
        step,
        flowId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Send fallback message in welcome channel
   */
  private async sendWelcomeChannelFallback(
    member: GuildMember,
    embed: EmbedBuilder,
    actionRow: ActionRowBuilder<ButtonBuilder>,
    flow: OnboardingFlow
  ): Promise<void> {
    try {
      const welcomeChannelId = process.env.WELCOME_CHANNEL_ID || botConfig.channels.general;
      const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId) as TextChannel;
      
      if (welcomeChannel) {
        const fallbackEmbed = new EmbedBuilder(embed.toJSON())
          .setTitle(`🎉 Welcome ${member.displayName}!`)
          .addFields([
            {
              name: '📬 DM Issue',
              value: 'We couldn\'t send you a direct message. Please check your DM settings or click the button below to continue setup.',
              inline: false
            }
          ]);

        await welcomeChannel.send({
          content: `${member} - Welcome to Unit Talk!`,
          embeds: [fallbackEmbed],
          components: [actionRow]
        });

        await this.logOnboardingEvent('onboarding_welcome_channel_fallback', member.id, {
          channelId: welcomeChannelId,
          flowId: flow.id,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Failed to send welcome channel fallback:', error);
    }
  }

  /**
   * Execute a specific onboarding step
   */
  private async executeOnboardingStep(
    member: GuildMember,
    step: OnboardingStep,
    flow: OnboardingFlow
  ): Promise<void> {
    try {
      const progress = this.userProgress.get(member.id);
      if (!progress) return;

      // Update progress
      progress.currentStep = step.id;
      progress.lastActivity = new Date();
      await this.saveProgressToDB(progress);

      // Create step-specific embed and components
      const { embed, components } = await this.createStepMessage(member, step, flow);

      // Try to send DM
      try {
        await member.send({ embeds: [embed], components });
        
        await this.logOnboardingEvent('onboarding_step_dm_sent', member.id, {
          step: step.id,
          flowId: flow.id,
          timestamp: new Date().toISOString()
        });

      } catch (dmError) {
        await this.handleDMFailure(member, step.id, flow.id, dmError);
      }

    } catch (error) {
      logger.error(`Failed to execute onboarding step ${step.id}:`, error);
    }
  }

  /**
   * Create step-specific message content
   */
  private async createStepMessage(
    member: GuildMember,
    step: OnboardingStep,
    flow: OnboardingFlow
  ): Promise<{ embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] }> {
    
    const embed = new EmbedBuilder()
      .setTitle(`📋 ${step.name}`)
      .setDescription(step.dmTemplate)
      .setColor(0x00AE86)
      .setFooter({ text: `Step ${flow.steps.indexOf(step) + 1} of ${flow.steps.length}` });

    const components: ActionRowBuilder<ButtonBuilder>[] = [];

    // Create step-specific components based on step type
    if (step.id === 'preferences') {
      components.push(this.createPreferencesButtons(member.id));
    } else if (step.id === 'role_selection') {
      components.push(this.createRoleSelectionButtons(member.id));
    } else {
      // Default continue/skip buttons
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`onboarding_continue_${member.id}_${step.id}`)
            .setLabel(step.buttonText || '✅ Continue')
            .setStyle(ButtonStyle.Primary)
        );

      if (!step.required) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`onboarding_skip_${member.id}_${step.id}`)
            .setLabel('⏭️ Skip')
            .setStyle(ButtonStyle.Secondary)
        );
      }

      components.push(actionRow);
    }

    return { embed, components };
  }

  /**
   * Create preferences selection buttons
   */
  private createPreferencesButtons(userId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`pref_sports_${userId}`)
          .setLabel('🏈 Sports')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`pref_notifications_${userId}`)
          .setLabel('🔔 Notifications')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`pref_experience_${userId}`)
          .setLabel('📊 Experience')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`pref_complete_${userId}`)
          .setLabel('✅ Done')
          .setStyle(ButtonStyle.Primary)
      );
  }

  /**
   * Create role selection buttons
   */
  private createRoleSelectionButtons(userId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`role_member_${userId}`)
          .setLabel('👤 Member')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`role_vip_${userId}`)
          .setLabel('⭐ VIP')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`role_vip_plus_${userId}`)
          .setLabel('💎 VIP+')
          .setStyle(ButtonStyle.Primary)
      );
  }

  /**
   * Handle onboarding interaction (button clicks)
   */
  async handleOnboardingInteraction(interaction: any): Promise<void> {
    try {
      const [action, ...params] = interaction.customId.split('_');
      const userId = params[params.length - 1];

      if (interaction.user.id !== userId) {
        await interaction.reply({
          content: '❌ This onboarding is not for you.',
          ephemeral: true
        });
        return;
      }

      const progress = this.userProgress.get(userId);
      if (!progress) {
        await interaction.reply({
          content: '❌ Onboarding session not found. Please rejoin the server to restart.',
          ephemeral: true
        });
        return;
      }

      const flow = this.onboardingFlows.get(progress.flowId);
      if (!flow) {
        await interaction.reply({
          content: '❌ Onboarding flow not found.',
          ephemeral: true
        });
        return;
      }

      // Handle different interaction types
      if (action === 'onboarding') {
        await this.handleOnboardingAction(interaction, params, progress, flow);
      } else if (action === 'pref') {
        await this.handlePreferenceAction(interaction, params, progress, flow);
      } else if (action === 'role') {
        await this.handleRoleAction(interaction, params, progress, flow);
      }

    } catch (error) {
      logger.error('Failed to handle onboarding interaction:', error);
      await interaction.reply({
        content: '❌ An error occurred. Please contact an administrator.',
        ephemeral: true
      });
    }
  }

  /**
   * Handle main onboarding actions
   */
  private async handleOnboardingAction(
    interaction: any,
    params: string[],
    progress: OnboardingProgress,
    flow: OnboardingFlow
  ): Promise<void> {
    const action = params[0]; // start, continue, skip, etc.
    const stepId = params[1];

    if (action === 'start') {
      await this.startNextStep(interaction, progress, flow);
    } else if (action === 'continue') {
      await this.completeStep(interaction, stepId, progress, flow);
    } else if (action === 'skip') {
      await this.skipStep(interaction, stepId, progress, flow);
    }
  }

  /**
   * Complete current step and move to next
   */
  private async completeStep(
    interaction: any,
    stepId: string,
    progress: OnboardingProgress,
    flow: OnboardingFlow
  ): Promise<void> {
    // Mark step as completed
    if (!progress.completedSteps.includes(stepId)) {
      progress.completedSteps.push(stepId);
    }

    // Log step completion
    await this.logOnboardingEvent('onboarding_step_completed', progress.userId, {
      stepId,
      flowId: flow.id,
      completedSteps: progress.completedSteps.length,
      totalSteps: flow.steps.length,
      timestamp: new Date().toISOString()
    });

    // Find next step
    const currentStepIndex = flow.steps.findIndex(s => s.id === stepId);
    const nextStep = flow.steps[currentStepIndex + 1];

    if (nextStep) {
      // Continue to next step
      progress.currentStep = nextStep.id;
      await this.saveProgressToDB(progress);
      
      await interaction.reply({
        content: '✅ Step completed! Moving to next step...',
        ephemeral: true
      });

      // Execute next step
      const member = interaction.member || await interaction.guild.members.fetch(progress.userId);
      await this.executeOnboardingStep(member, nextStep, flow);
    } else {
      // Onboarding complete
      await this.completeOnboarding(interaction, progress, flow);
    }
  }

  /**
   * Complete entire onboarding process
   */
  private async completeOnboarding(
    interaction: any,
    progress: OnboardingProgress,
    flow: OnboardingFlow
  ): Promise<void> {
    progress.status = 'completed';
    progress.lastActivity = new Date();
    await this.saveProgressToDB(progress);

    // Assign final role if specified
    if (flow.targetRole) {
      const member = interaction.member || await interaction.guild.members.fetch(progress.userId);
      const role = interaction.guild.roles.cache.get(flow.targetRole);
      if (role && member) {
        await member.roles.add(role);
      }
    }

    // Send completion message
    const completionEmbed = new EmbedBuilder()
      .setTitle('🎉 Onboarding Complete!')
      .setDescription(flow.completionMessage)
      .setColor(0x00FF00)
      .addFields([
        {
          name: '✅ What\'s Next?',
          value: 'You now have access to all Unit Talk features. Check out our channels and start getting those winning picks!',
          inline: false
        }
      ]);

    await interaction.reply({
      embeds: [completionEmbed],
      ephemeral: true
    });

    // Log completion
    await this.logOnboardingEvent('onboarding_completed', progress.userId, {
      flowId: flow.id,
      completedSteps: progress.completedSteps.length,
      totalSteps: flow.steps.length,
      duration: Date.now() - progress.startedAt.getTime(),
      preferences: progress.preferences,
      timestamp: new Date().toISOString()
    });

    // Clean up progress tracking
    this.userProgress.delete(progress.userId);
  }

  /**
   * Handle onboarding errors with user-friendly messages
   */
  async handleOnboardingError(member: GuildMember, error: any): Promise<void> {
    try {
      const errorEmbed = new EmbedBuilder()
        .setTitle('⚠️ Onboarding Issue')
        .setDescription('We encountered an issue during your onboarding process.')
        .setColor(0xFF6B6B)
        .addFields([
          {
            name: '🔧 What can you do?',
            value: '• Try again in a few minutes\n• Contact an administrator\n• Use the `/help` command for assistance',
            inline: false
          },
          {
            name: '📞 Need Help?',
            value: 'Mention an admin or use our support channel.',
            inline: false
          }
        ])
        .setFooter({ text: 'We apologize for the inconvenience!' });

      // Try to send error message
      try {
        await member.send({ embeds: [errorEmbed] });
      } catch (dmError) {
        // If DM fails, try welcome channel
        const welcomeChannelId = process.env.WELCOME_CHANNEL_ID || botConfig.channels.general;
        const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId) as TextChannel;
        
        if (welcomeChannel) {
          await welcomeChannel.send({
            content: `${member} - There was an issue with your onboarding:`,
            embeds: [errorEmbed]
          });
        }
      }

      // Log error
      await this.logOnboardingEvent('onboarding_error', member.id, {
        error: error.message,
        stack: error.stack?.substring(0, 500),
        timestamp: new Date().toISOString()
      });

    } catch (logError) {
      logger.error('Failed to handle onboarding error:', logError);
    }
  }

  /**
   * Determine appropriate onboarding flow for member
   */
  private determineOnboardingFlow(member: GuildMember): OnboardingFlow {
    // Default to member flow
    let flowId = 'member_onboarding';
    
    // Check if user has special roles or permissions
    if (this.permissionsService.hasRole(member, 'vip')) {
      flowId = 'vip_onboarding';
    } else if (this.permissionsService.hasRole(member, 'vipPlus')) {
      flowId = 'vip_plus_onboarding';
    }

    return this.onboardingFlows.get(flowId) || this.getDefaultFlow();
  }

  /**
   * Get default onboarding flow
   */
  private getDefaultFlow(): OnboardingFlow {
    return {
      id: 'default',
      name: 'Default Onboarding',
      description: 'Standard member onboarding process',
      targetRole: botConfig.roles.member,
      welcomeMessage: 'Welcome to Unit Talk! Let\'s get you set up with the best betting insights.',
      completionMessage: 'You\'re all set! Welcome to the Unit Talk community.',
      failureMessage: 'We encountered an issue during setup. Please contact an administrator.',
      isActive: true,
      steps: [
        {
          id: 'welcome',
          name: 'Welcome',
          description: 'Welcome message and introduction',
          required: true,
          order: 1,
          dmTemplate: 'Welcome to Unit Talk! We\'re excited to have you join our community of successful bettors.',
          buttonText: 'Get Started'
        },
        {
          id: 'preferences',
          name: 'Preferences',
          description: 'Collect user preferences',
          required: false,
          order: 2,
          dmTemplate: 'Let\'s personalize your experience. What are your betting preferences?',
          buttonText: 'Set Preferences'
        },
        {
          id: 'role_assignment',
          name: 'Role Assignment',
          description: 'Assign appropriate role',
          required: true,
          order: 3,
          dmTemplate: 'Almost done! We\'ll assign you the appropriate role for your membership level.',
          buttonText: 'Assign Role'
        }
      ]
    };
  }

  // Database operations
  private async loadOnboardingFlowsFromDB(): Promise<OnboardingFlow[]> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('onboarding_flows')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to load onboarding flows from DB:', error);
      return [];
    }
  }

  private async saveProgressToDB(progress: OnboardingProgress): Promise<void> {
    try {
      const { error } = await this.supabaseService.client
        .from('onboarding_progress')
        .upsert({
          user_id: progress.userId,
          flow_id: progress.flowId,
          current_step: progress.currentStep,
          completed_steps: progress.completedSteps,
          started_at: progress.startedAt.toISOString(),
          last_activity: progress.lastActivity.toISOString(),
          status: progress.status,
          preferences: progress.preferences,
          dm_failures: progress.dmFailures,
          retry_count: progress.retryCount
        });

      if (error) throw error;
    } catch (error) {
      logger.error('Failed to save onboarding progress:', error);
    }
  }

  private async logDMFailure(failure: DMFailure): Promise<void> {
    try {
      const { error } = await this.supabaseService.client
        .from('onboarding_dm_failures')
        .insert({
          id: failure.id,
          user_id: failure.userId,
          step: failure.step,
          flow_id: failure.flowId,
          failure_reason: failure.failureReason,
          attempted_at: failure.attemptedAt.toISOString(),
          retry_count: failure.retryCount,
          resolved: failure.resolved,
          admin_notified: failure.adminNotified
        });

      if (error) throw error;
    } catch (error) {
      logger.error('Failed to log DM failure:', error);
    }
  }

  private async notifyAdminOfDMFailure(member: GuildMember, failure: DMFailure): Promise<void> {
    try {
      const adminChannelId = process.env.ADMIN_CHANNEL_ID || botConfig.channels.admin;
      const adminChannel = member.guild.channels.cache.get(adminChannelId) as TextChannel;

      if (adminChannel) {
        const embed = new EmbedBuilder()
          .setTitle('⚠️ Onboarding DM Failure')
          .setColor(0xFF6B6B)
          .addFields([
            { name: 'User', value: `${member.user.username} (${member.id})`, inline: true },
            { name: 'Step', value: failure.step, inline: true },
            { name: 'Reason', value: failure.failureReason, inline: false },
            { name: 'Time', value: failure.attemptedAt.toISOString(), inline: true }
          ]);

        const actionRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`retry_dm_${failure.id}`)
              .setLabel('🔄 Retry DM')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`resolve_failure_${failure.id}`)
              .setLabel('✅ Mark Resolved')
              .setStyle(ButtonStyle.Success)
          );

        await adminChannel.send({ embeds: [embed], components: [actionRow] });
      }
    } catch (error) {
      logger.error('Failed to notify admin of DM failure:', error);
    }
  }

  private categorizeDMFailure(error: any): string {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('cannot send messages to this user')) {
      return 'user_blocked_dms';
    } else if (message.includes('unknown user')) {
      return 'user_not_found';
    } else if (message.includes('missing permissions')) {
      return 'missing_permissions';
    } else {
      return 'unknown_error';
    }
  }

  private createHardcodedDefaults(): void {
    // Create hardcoded default flows as fallback
    const memberFlow = this.getDefaultFlow();
    this.onboardingFlows.set('member_onboarding', memberFlow);

    logger.info('Created hardcoded default onboarding flows');
  }

  private async createDefaultOnboardingFlows(): Promise<void> {
    // This would create default flows in the database
    // Implementation depends on your database schema
    logger.info('Creating default onboarding flows in database');
  }

  // Additional helper methods for admin dashboard
  async getOnboardingStats(): Promise<any> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('onboarding_progress')
        .select('status, flow_id, started_at, completed_steps')
        .gte('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      // Process stats
      const stats = {
        total: data?.length || 0,
        completed: data?.filter(p => p.status === 'completed').length || 0,
        inProgress: data?.filter(p => p.status === 'in_progress').length || 0,
        failed: data?.filter(p => p.status === 'failed').length || 0,
        abandoned: data?.filter(p => p.status === 'abandoned').length || 0
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get onboarding stats:', error);
      return null;
    }
  }

  async getDMFailures(limit: number = 50): Promise<DMFailure[]> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('onboarding_dm_failures')
        .select('*')
        .eq('resolved', false)
        .order('attempted_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to get DM failures:', error);
      return [];
    }
  }

  async retryFailedDM(failureId: string): Promise<boolean> {
    try {
      // Implementation for retrying failed DMs
      // This would involve looking up the failure, getting the user, and resending the message
      logger.info(`Retrying failed DM: ${failureId}`);
      return true;
    } catch (error) {
      logger.error('Failed to retry DM:', error);
      return false;
    }
  }

  /**
   * Reset onboarding progress for a user
   */
  async resetOnboardingProgress(userId: string): Promise<void> {
    try {
      // Delete existing progress
      await this.deleteProgress(userId);

      // Clear from memory
      this.userProgress.delete(userId);

      console.log(`🔄 Reset onboarding progress for user ${userId}`);
    } catch (error) {
      console.error('❌ Error resetting onboarding progress:', error);
      throw error;
    }
  }

  /**
   * Get onboarding status for a user
   */
  async getOnboardingStatus(userId: string): Promise<{
    flowType: string | null;
    currentStep: string | null;
    completed: boolean;
    startedAt: string | null;
    completedAt: string | null;
  }> {
    try {
      const progress = await this.loadProgress(userId);

      return {
        flowType: progress?.flowId || null,
        currentStep: progress?.currentStep || null,
        completed: progress?.status === 'completed' || false,
        startedAt: progress?.startedAt?.toISOString() || null,
        completedAt: progress?.status === 'completed' ? progress?.lastActivity?.toISOString() || null : null
      };
    } catch (error) {
      console.error('❌ Error getting onboarding status:', error);
      return {
        flowType: null,
        currentStep: null,
        completed: false,
        startedAt: null,
        completedAt: null
      };
    }
  }

  /**
   * Send DM to user
   */
  async sendDM(userId: string, message: string): Promise<boolean> {
    try {
      const user = await this.client.users.fetch(userId);
      if (!user) {
        console.error(`❌ User ${userId} not found`);
        return false;
      }

      await user.send(message);
      console.log(`✅ DM sent successfully to user ${userId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send DM to user ${userId}:`, error);
      return false;
    }
  }

  // Fix all the logEvent calls to include userId parameter
  private async logOnboardingEvent(eventType: string, userId: string, metadata?: Record<string, any>): Promise<void> {
    try {
      await this.analyticsService.logEvent(eventType, userId, metadata);
    } catch (error) {
      console.error('❌ Error logging onboarding event:', error);
    }
  }

  // Placeholder methods for additional functionality
  private async startNextStep(interaction: any, progress: OnboardingProgress, flow: OnboardingFlow): Promise<void> {
    // Implementation for starting next step
  }

  private async skipStep(interaction: any, stepId: string, progress: OnboardingProgress, flow: OnboardingFlow): Promise<void> {
    // Implementation for skipping step
  }

  private async handlePreferenceAction(interaction: any, params: string[], progress: OnboardingProgress, flow: OnboardingFlow): Promise<void> {
    // Implementation for handling preference actions
  }

  private async handleRoleAction(interaction: any, params: string[], progress: OnboardingProgress, flow: OnboardingFlow): Promise<void> {
    // Implementation for handling role actions
  }

  /**
   * Delete progress from database
   */
  private async deleteProgress(userId: string): Promise<void> {
    try {
      const { error } = await this.supabaseService.client
        .from('onboarding_progress')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      console.log(`🗑️ Deleted onboarding progress for user ${userId}`);
    } catch (error) {
      console.error('❌ Error deleting progress:', error);
      throw error;
    }
  }

  /**
   * Load progress from database
   */
  private async loadProgress(userId: string): Promise<OnboardingProgress | null> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('onboarding_progress')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No data found
          return null;
        }
        throw error;
      }

      return data as OnboardingProgress;
    } catch (error) {
      console.error('❌ Error loading progress:', error);
      return null;
    }
  }
}