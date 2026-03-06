import { Logger } from '../../shared/logger/types';

/**
 * 🎮 Discord Interaction Handler
 * Manages sophisticated Discord interactions for the onboarding system
 * Handles embeds, reactions, buttons, forms, and progressive learning flows
 */
export class DiscordInteractionHandler {
  private logger: Logger;
  private activeInteractions: Map<string, ActiveInteraction> = new Map();
  private embedTemplates: Map<string, EmbedTemplate> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeEmbedTemplates();
  }

  async initialize(): Promise<void> {
    this.logger.info('🎮 Initializing Discord Interaction Handler...');

    // Load interaction templates
    await this.loadInteractionTemplates();

    // Initialize reaction tracking
    await this.setupReactionTracking();

    this.logger.info('✅ Discord Interaction Handler initialized');
  }

  async isHealthy(): Promise<boolean> {
    return this.embedTemplates.size > 0;
  }

  /**
   * Creates a welcome interaction for new users
   */
  async createWelcomeInteraction(userId: string, userProfile: any): Promise<DiscordInteraction> {
    try {
      const welcomeEmbed = this.createWelcomeEmbed(userProfile);
      const interactionButtons = this.createWelcomeButtons();

      const interaction: DiscordInteraction = {
        id: `welcome-${userId}-${Date.now()}`,
        userId,
        type: 'welcome',
        embed: welcomeEmbed,
        components: interactionButtons,
        expectedResponses: ['🎯', '📚', '💰', '🏆'],
        timeout: 300000, // 5 minutes
        createdAt: new Date().toISOString(),
      };

      // Track this interaction
      this.activeInteractions.set(interaction.id, {
        interaction,
        startTime: Date.now(),
        responses: [],
        completed: false,
      });

      this.logger.info('🎯 Created welcome interaction', {
        userId,
        interactionId: interaction.id,
      });

      return interaction;
    } catch (error) {
      this.logger.error('❌ Failed to create welcome interaction:', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Creates a learning step interaction
   */
  async createLearningStepInteraction(
    userId: string,
    stepData: any,
    userProgress: any
  ): Promise<DiscordInteraction> {
    try {
      const stepEmbed = this.createStepEmbed(stepData, userProgress);
      const stepComponents = this.createStepComponents(stepData);

      const interaction: DiscordInteraction = {
        id: `step-${stepData.id}-${userId}-${Date.now()}`,
        userId,
        type: 'learning_step',
        embed: stepEmbed,
        components: stepComponents,
        expectedResponses: this.getExpectedResponses(stepData),
        timeout: stepData.estimated_time * 60 * 1000, // Convert minutes to milliseconds
        createdAt: new Date().toISOString(),
        metadata: {
          stepId: stepData.id,
          pathId: userProgress.current_path,
          difficulty: stepData.difficulty,
        },
      };

      this.activeInteractions.set(interaction.id, {
        interaction,
        startTime: Date.now(),
        responses: [],
        completed: false,
      });

      this.logger.info('📚 Created learning step interaction', {
        userId,
        stepId: stepData.id,
        interactionId: interaction.id,
      });

      return interaction;
    } catch (error) {
      this.logger.error('❌ Failed to create learning step interaction:', {
        userId,
        stepId: stepData.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Processes user response to an interaction
   */
  async processInteractionResponse(
    interactionId: string,
    responseType: string,
    responseData: any
  ): Promise<InteractionResult> {
    try {
      const activeInteraction = this.activeInteractions.get(interactionId);

      if (!activeInteraction) {
        return {
          success: false,
          error: 'Interaction not found or expired',
          nextAction: 'restart',
        };
      }

      // Record the response
      activeInteraction.responses.push({
        type: responseType,
        data: responseData,
        timestamp: new Date().toISOString(),
      });

      // Analyze response
      const analysisResult = await this.analyzeResponse(
        activeInteraction,
        responseType,
        responseData
      );

      // Determine next action
      const nextAction = this.determineNextAction(activeInteraction, analysisResult);

      // Update interaction state
      if (nextAction.type === 'complete') {
        activeInteraction.completed = true;
        this.activeInteractions.delete(interactionId);
      }

      this.logger.info('✅ Processed interaction response', {
        interactionId,
        responseType,
        nextAction: nextAction.type,
        userId: activeInteraction.interaction.userId,
      });

      return {
        success: true,
        analysisResult,
        nextAction: nextAction.type,
        nextInteraction: nextAction.nextInteraction,
        feedback: this.generateUserFeedback(analysisResult),
      };
    } catch (error) {
      this.logger.error('❌ Failed to process interaction response:', {
        interactionId,
        responseType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: 'Failed to process response',
        nextAction: 'retry',
      };
    }
  }

  /**
   * Creates adaptive follow-up interactions based on user behavior
   */
  async createAdaptiveFollowUp(
    userId: string,
    behaviorData: any,
    adaptationRecommendation: any
  ): Promise<DiscordInteraction | null> {
    try {
      if (adaptationRecommendation.type === 'no_change') {
        return null;
      }

      const adaptiveEmbed = this.createAdaptiveEmbed(behaviorData, adaptationRecommendation);
      const adaptiveComponents = this.createAdaptiveComponents(adaptationRecommendation);

      const interaction: DiscordInteraction = {
        id: `adaptive-${userId}-${Date.now()}`,
        userId,
        type: 'adaptive_followup',
        embed: adaptiveEmbed,
        components: adaptiveComponents,
        expectedResponses: ['✅', '❌', '🤔'],
        timeout: 180000, // 3 minutes
        createdAt: new Date().toISOString(),
        metadata: {
          adaptationType: adaptationRecommendation.type,
          confidence: adaptationRecommendation.confidence,
        },
      };

      this.activeInteractions.set(interaction.id, {
        interaction,
        startTime: Date.now(),
        responses: [],
        completed: false,
      });

      this.logger.info('🎯 Created adaptive follow-up interaction', {
        userId,
        adaptationType: adaptationRecommendation.type,
        confidence: adaptationRecommendation.confidence,
      });

      return interaction;
    } catch (error) {
      this.logger.error('❌ Failed to create adaptive follow-up:', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  private initializeEmbedTemplates(): void {
    // Welcome embed template
    this.embedTemplates.set('welcome', {
      title: '🎯 Welcome to Unit Talk Professional Betting Community!',
      description: "Let's start your journey to profitable sports betting",
      color: 0x00ff00,
      fields: [
        {
          name: '💎 What Makes Us Special',
          value:
            '✅ Verified Professional Cappers\n✅ 100% Transparent Records\n✅ Real-Time Analytics\n✅ Community-First Approach',
          inline: false,
        },
        {
          name: '🚀 Your Journey Starts Now',
          value: 'React below to personalize your learning experience!',
          inline: false,
        },
      ],
      footer: {
        text: 'Unit Talk - Where Professionals Share Their Edge',
      },
    });

    // Learning step template
    this.embedTemplates.set('learning_step', {
      title: '📚 Learning Step',
      description: 'Master the fundamentals step by step',
      color: 0x0099ff,
      fields: [],
      footer: {
        text: 'Unit Talk Professional Learning Path',
      },
    });

    // Progress template
    this.embedTemplates.set('progress', {
      title: '📊 Your Progress',
      description: "See how far you've come!",
      color: 0xffaa00,
      fields: [],
      footer: {
        text: 'Keep up the great work!',
      },
    });
  }

  private async loadInteractionTemplates(): Promise<void> {
    // Load additional templates from database or config
    this.logger.debug('📚 Loading interaction templates...');
  }

  private async setupReactionTracking(): Promise<void> {
    // Setup reaction event tracking
    this.logger.debug('👀 Setting up reaction tracking...');
  }

  private createWelcomeEmbed(userProfile: any): any {
    const template = this.embedTemplates.get('welcome')!;

    return {
      ...template,
      description: `Welcome ${userProfile.username || 'Future Pro'}! ${template.description}`,
      fields: [
        ...template.fields,
        {
          name: '🎯 Quick Setup',
          value:
            'React with your experience level:\n🔰 Complete Beginner\n📈 Some Experience\n🎯 Looking to Improve\n💎 Want Pro Strategies',
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  private createWelcomeButtons(): any[] {
    return [
      {
        type: 1, // Action Row
        components: [
          {
            type: 2, // Button
            style: 1, // Primary
            label: '🎯 Start Learning',
            custom_id: 'start_learning',
          },
          {
            type: 2, // Button
            style: 2, // Secondary
            label: '📊 View Cappers',
            custom_id: 'view_cappers',
          },
          {
            type: 2, // Button
            style: 3, // Success
            label: '💰 Calculator',
            custom_id: 'bankroll_calculator',
          },
        ],
      },
    ];
  }

  private createStepEmbed(stepData: any, userProgress: any): any {
    const template = this.embedTemplates.get('learning_step')!;

    return {
      ...template,
      title: stepData.title,
      description: stepData.description,
      fields: [
        {
          name: '📈 Progress',
          value: `Step ${userProgress.current_step_number || 1} of ${userProgress.total_steps || 6}`,
          inline: true,
        },
        {
          name: '⏱️ Estimated Time',
          value: `${stepData.estimated_time} minutes`,
          inline: true,
        },
        {
          name: '🎯 Learning Objective',
          value: stepData.learning_objective || 'Master this concept',
          inline: false,
        },
        ...(stepData.content.discord_embed?.fields || []),
      ],
      timestamp: new Date().toISOString(),
    };
  }

  private createStepComponents(stepData: any): any[] {
    const components = [];

    if (stepData.interactive_elements?.buttons) {
      components.push({
        type: 1, // Action Row
        components: [
          {
            type: 2, // Button
            style: 1, // Primary
            label: '✅ I Understand',
            custom_id: `understand_${stepData.id}`,
          },
          {
            type: 2, // Button
            style: 2, // Secondary
            label: '❓ Need Help',
            custom_id: `help_${stepData.id}`,
          },
          {
            type: 2, // Button
            style: 3, // Success
            label: '➡️ Next Step',
            custom_id: `next_${stepData.id}`,
          },
        ],
      });
    }

    return components;
  }

  private getExpectedResponses(stepData: any): string[] {
    const responses = ['✅', '❓'];

    if (stepData.content.reactions) {
      responses.push(...stepData.content.reactions);
    }

    return responses;
  }

  private async analyzeResponse(
    activeInteraction: ActiveInteraction,
    responseType: string,
    responseData: any
  ): Promise<ResponseAnalysis> {
    const interaction = activeInteraction.interaction;
    const responseTime = Date.now() - activeInteraction.startTime;

    // Analyze response quality
    const quality = this.assessResponseQuality(responseType, responseData, interaction);

    // Check completion criteria
    const meetsCompletion = this.checkCompletionCriteria(activeInteraction, responseType);

    // Calculate engagement professional_score
    const engagementScore = this.calculateEngagementScore(activeInteraction, responseTime);

    return {
      quality,
      engagementScore,
      responseTime,
      meetsCompletion,
      nextSuggestion: this.suggestNextAction(quality, engagementScore, meetsCompletion),
    };
  }

  private determineNextAction(
    activeInteraction: ActiveInteraction,
    analysisResult: ResponseAnalysis
  ): NextActionResult {
    if (analysisResult.meetsCompletion && analysisResult.quality > 0.7) {
      return {
        type: 'complete',
        confidence: 0.9,
        reasoning: 'User demonstrated understanding',
      };
    }

    if (analysisResult.quality < 0.5) {
      return {
        type: 'retry',
        confidence: 0.8,
        reasoning: 'Response quality below threshold',
        nextInteraction: this.createRetryInteraction(activeInteraction),
      };
    }

    return {
      type: 'continue',
      confidence: 0.7,
      reasoning: 'Proceeding to next step',
    };
  }

  private assessResponseQuality(
    responseType: string,
    responseData: any,
    interaction: DiscordInteraction
  ): number {
    // Simple quality assessment - in production this would be more sophisticated
    if (responseType === 'reaction' && interaction.expectedResponses.includes(responseData.emoji)) {
      return 0.8;
    }

    if (responseType === 'message' && responseData.content.length > 10) {
      return 0.9;
    }

    if (responseType === 'button') {
      return 0.7;
    }

    return 0.5;
  }

  private checkCompletionCriteria(
    activeInteraction: ActiveInteraction,
    responseType: string
  ): boolean {
    const interaction = activeInteraction.interaction;

    // Check if minimum responses received
    if (activeInteraction.responses.length < 1) {
      return false;
    }

    // Check specific completion criteria based on interaction type
    if (interaction.type === 'welcome') {
      return activeInteraction.responses.some(r => r.type === 'reaction' || r.type === 'button');
    }

    return true;
  }

  private calculateEngagementScore(
    activeInteraction: ActiveInteraction,
    responseTime: number
  ): number {
    const interaction = activeInteraction.interaction;
    const responseCount = activeInteraction.responses.length;
    const timeScore = Math.max(0, 1 - responseTime / interaction.timeout);
    const responseScore = Math.min(1, responseCount / 2);

    return timeScore * 0.6 + responseScore * 0.4;
  }

  private suggestNextAction(quality: number, engagement: number, meetsCompletion: boolean): string {
    if (meetsCompletion && quality > 0.8) {
      return 'proceed_to_next';
    }

    if (quality < 0.5) {
      return 'provide_clarification';
    }

    if (engagement < 0.4) {
      return 'increase_engagement';
    }

    return 'continue_current';
  }

  private createRetryInteraction(activeInteraction: ActiveInteraction): any {
    return {
      type: 'clarification',
      message: 'Let me explain that differently...',
      simplified: true,
    };
  }

  private createAdaptiveEmbed(behaviorData: any, adaptationRecommendation: any): any {
    return {
      title: '🎯 Personalized Learning Adjustment',
      description: `Based on your learning style, I'd like to adjust your experience`,
      color: 0xff6600,
      fields: [
        {
          name: '📊 What I Noticed',
          value: adaptationRecommendation.reasoning,
          inline: false,
        },
        {
          name: '🎯 Suggested Improvement',
          value: adaptationRecommendation.actions
            .map((action: any) => `• ${action.action}`)
            .join('\n'),
          inline: false,
        },
        {
          name: '❓ Apply Changes?',
          value: 'React ✅ to apply or ❌ to keep current settings',
          inline: false,
        },
      ],
      footer: {
        text: `Confidence: ${Math.round(adaptationRecommendation.confidence * 100)}%`,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private createAdaptiveComponents(adaptationRecommendation: any): any[] {
    return [
      {
        type: 1, // Action Row
        components: [
          {
            type: 2, // Button
            style: 3, // Success
            label: '✅ Apply Changes',
            custom_id: 'apply_adaptation',
          },
          {
            type: 2, // Button
            style: 4, // Danger
            label: '❌ Keep Current',
            custom_id: 'reject_adaptation',
          },
          {
            type: 2, // Button
            style: 2, // Secondary
            label: '🤔 Tell Me More',
            custom_id: 'explain_adaptation',
          },
        ],
      },
    ];
  }

  private generateUserFeedback(analysisResult: ResponseAnalysis): string {
    if (analysisResult.quality > 0.8) {
      return "🎉 Excellent! You're mastering this concept!";
    }

    if (analysisResult.quality > 0.6) {
      return "👍 Good progress! Let's continue building on this.";
    }

    return "💪 Let's work on this together. I'm here to help!";
  }

  async cleanup(): Promise<void> {
    this.logger.info('🧹 Cleaning up Discord Interaction Handler...');
    this.activeInteractions.clear();
  }
}

// 📊 Type Definitions
export interface DiscordInteraction {
  id: string;
  userId: string;
  type: 'welcome' | 'learning_step' | 'quiz' | 'assessment' | 'adaptive_followup';
  embed: any;
  components: any[];
  expectedResponses: string[];
  timeout: number;
  createdAt: string;
  metadata?: any;
}

export interface ActiveInteraction {
  interaction: DiscordInteraction;
  startTime: number;
  responses: InteractionResponse[];
  completed: boolean;
}

export interface InteractionResponse {
  type: string;
  data: any;
  timestamp: string;
}

export interface InteractionResult {
  success: boolean;
  analysisResult?: ResponseAnalysis;
  nextAction?: string;
  nextInteraction?: any;
  feedback?: string;
  error?: string;
}

export interface ResponseAnalysis {
  quality: number;
  engagementScore: number;
  responseTime: number;
  meetsCompletion: boolean;
  nextSuggestion: string;
}

export interface NextActionResult {
  type: 'complete' | 'continue' | 'retry' | 'escalate';
  confidence: number;
  reasoning: string;
  nextInteraction?: any;
}

export interface EmbedTemplate {
  title: string;
  description: string;
  color: number;
  fields: any[];
  footer: {
    text: string;
  };
}
