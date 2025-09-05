import { redisCache } from '../../cache/enhanced-cache';
import { withCircuitBreaker } from '../../services/enhanced-circuit-breaker';
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics } from '../BaseAgent/types';

import { AdaptiveLearningEngine } from './adaptiveLearningEngine';
import { BehaviorTracker } from './behaviorTracker';
import { ConversationEngine } from './conversationEngine';
import { DiscordInteractionHandler } from './discordInteractionHandler';
import { InterventionSystem } from './interventionSystem';
import { UserProfileManager } from './userProfileManager';
// import { OnboardingMetrics } from './types'; // Unused import

interface AutomatedOnboardingMetrics extends BaseMetrics {
  usersOnboarded: number;
  averageOnboardingTime: number;
  conversionRate: number;
  interventionsTrigger: number;
  successfulInterventions: number;
  userEngagementScore: number;
  churnPrevented: number;
  upgradeConversions: number;
  learningPathsCompleted: number;
  adaptiveAdjustments: number;
  personalizedInteractions: number;
}

// 🚀 ENHANCED: Professional Learning Path System
interface LearningPath {
  id: string;
  name: string;
  description: string;
  target_audience: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration: number; // minutes
  steps: OnboardingStep[];
  discord_integration: {
    welcome_message: string;
    interactive_elements: string[];
    progress_tracking: boolean;
    community_integration: boolean;
  };
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  type: 'education' | 'assessment' | 'practice' | 'verification' | 'discord_interaction';
  content: any;
  prerequisites: string[];
  estimated_time: number;
  completion_criteria: any;
  discord_commands?: string[];
  interactive_elements?: {
    buttons: boolean;
    reactions: boolean;
    forms: boolean;
    quizzes: boolean;
  };
}

interface EnhancedUserProfile {
  id: string;
  discord_id: string;
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
  preferred_sports: string[];
  bankroll_size: 'small' | 'medium' | 'large' | 'institutional';
  goals: string[];
  learning_style: 'visual' | 'analytical' | 'hands-on' | 'social';
  onboarding_stage: string;
  behavior_patterns: {
    message_frequency: number;
    reaction_patterns: string[];
    command_usage: Record<string, number>;
    peak_activity_hours: number[];
    engagement_quality: number;
  };
  learning_progress: {
    current_path: string;
    completed_steps: string[];
    current_step: string;
    completion_percentage: number;
    time_spent: number;
  };
  created_at: string;
  updated_at: string;
}

export class AutomatedOnboardingAgent extends BaseAgent {
  private behaviorTracker: BehaviorTracker;
  private conversationEngine: ConversationEngine;
  private userProfileManager: UserProfileManager;
  private interventionSystem: InterventionSystem;
  private onboardingMetrics: AutomatedOnboardingMetrics;
  
  // 🧠 ENHANCED: Intelligent Learning System
  private learningPaths: Map<string, LearningPath> = new Map();
  private userProfiles: Map<string, EnhancedUserProfile> = new Map();
  private adaptiveLearningEngine: AdaptiveLearningEngine;
  private discordInteractionHandler: DiscordInteractionHandler;
  
  // 🎯 PERFORMANCE TRACKING (unused - keeping for future implementation)
  // private readonly _PERFORMANCE_THRESHOLDS = {
  //   engagementScore: 0.7,
  //   completionRate: 0.8,
  //   responseTime: 2000, // 2 seconds
  //   adaptationAccuracy: 0.85
  // };

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    
    this.onboardingMetrics = {
      ...this.metrics,
      usersOnboarded: 0,
      averageOnboardingTime: 0,
      conversionRate: 0,
      interventionsTrigger: 0,
      successfulInterventions: 0,
      userEngagementScore: 0,
      churnPrevented: 0,
      upgradeConversions: 0,
      learningPathsCompleted: 0,
      adaptiveAdjustments: 0,
      personalizedInteractions: 0
    };

    // 🚀 INITIALIZE ENHANCED SYSTEMS
    this.adaptiveLearningEngine = new AdaptiveLearningEngine(this.logger);
    this.discordInteractionHandler = new DiscordInteractionHandler(this.logger);
    
    // Initialize professional learning paths
    this.initializeProfessionalLearningPaths();

    // Initialize subsystems
    this.behaviorTracker = new BehaviorTracker(this.logger);
    this.conversationEngine = new ConversationEngine(this.logger);
    this.userProfileManager = new UserProfileManager(this.supabase, this.logger);
    this.interventionSystem = new InterventionSystem(this.logger);
  }

  protected async initialize(): Promise<void> {
    this.logger.info('🤖 AutomatedOnboardingAgent initializing with enhanced learning intelligence...');

    // Initialize core systems
    await this.behaviorTracker.initialize();
    await this.setupDiscordListeners();
    await this.userProfileManager.initialize();
    await this.interventionSystem.initialize();
    
    // 🎆 ENHANCED: Initialize adaptive learning systems
    await this.adaptiveLearningEngine.initialize();
    // await this.discordInteractionHandler.initialize(); // DISABLED - handled by Discord bot
    await this.loadExistingUserProfiles();
    
    // Validate learning path integrity
    await this.validateLearningPaths();
    
    this.logger.info('✅ AutomatedOnboardingAgent initialized with professional learning intelligence');
  }

  private async setupDiscordListeners(): Promise<void> {
    // 🚨 DISABLED: Discord interaction handling moved to Discord bot layer
    // This API agent now focuses on backend analytics and behavior tracking only
    
    this.logger.info('📡 Discord interaction handling DISABLED - handled by Discord bot integration');
    
    // REMOVED: Discord event handlers to prevent conflicts with Discord bot
    // The rebuilt AutomatedOnboardingIntegration in Discord bot handles all interactions
    
    // Only keep non-interaction handlers for analytics
    const eventHandlers = {
      'guildMemberAdd': this.handleNewUser.bind(this),
      'messageCreate': this.handleMessage.bind(this),
      // 'interactionCreate': this.handleInteraction.bind(this), // DISABLED
      'messageReactionAdd': this.handleReaction.bind(this),
      'presenceUpdate': this.handlePresenceUpdate.bind(this)
    };

    // Store minimal handlers for Discord integration  
    await redisCache.set(
      'onboarding:discord:handlers',
      JSON.stringify(Object.keys(eventHandlers)),
      300 // 5 minutes TTL
    );

    this.logger.info('✅ Discord event handlers registered (interaction handling disabled)');
  }

  protected async process(): Promise<void> {
    this.logger.info('🔄 Running AutomatedOnboardingAgent cycle...');
    
    const cycleStartTime = Date.now();

    try {
      // 1. Process pending interventions
      await this.processPendingInterventions();
      
      // 2. Analyze user behavior patterns
      await this.analyzeUserBehaviors();
      
      // 3. Update user profiles and engagement scores
      await this.updateUserProfiles();
      
      // 4. Check for conversion opportunities
      await this.checkConversionOpportunities();
      
      // 5. Generate onboarding insights
      await this.generateOnboardingInsights();

    } catch (error) {
      this.logger.error('❌ Error in onboarding agent cycle', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }

    const cycleTime = Date.now() - cycleStartTime;
    this.onboardingMetrics.processingTimeMs = cycleTime;

    this.logger.info('✅ AutomatedOnboardingAgent cycle completed', {
      cycleTimeMs: cycleTime,
      metrics: this.onboardingMetrics
    });
  }

  // Discord Event Handlers
  private async handleNewUser(member: any): Promise<void> {
    this.logger.info('👋 New user joined, starting onboarding', {
      userId: member.id,
      username: member.user?.username
    });

    try {
      // Create initial user profile
      const userProfile = await this.userProfileManager.createProfile(member.id, {
        joinDate: new Date(),
        platform: 'discord',
        initialContext: {
          source: 'discord_invite',
          serverCount: member.user?.approximateGuildCount || 0
        }
      });

      // Start behavior tracking
      await this.behaviorTracker.startTracking(member.id);

      // Send initial welcome message
      await this.conversationEngine.sendWelcomeMessage(member.id, userProfile);

      this.onboardingMetrics.usersOnboarded++;

    } catch (error) {
      this.logger.error('❌ Failed to handle new user', {
        userId: member.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleMessage(message: any): Promise<void> {
    if (message.author?.bot) return;

    const userId = message.author.id;
    
    try {
      // Track message behavior
      const behaviorData = await this.behaviorTracker.analyzeMessage(message);
      
      // Update user profile
      await this.userProfileManager.updateBehavior(userId, behaviorData);
      
      // Check if intervention needed
      const interventionNeeded = await this.interventionSystem.assessIntervention(
        userId, 
        behaviorData
      );
      
      if (interventionNeeded) {
        await this.triggerIntervention(userId, interventionNeeded);
      }

      // Generate appropriate response if needed
      const response = await this.conversationEngine.generateResponse(
        userId,
        message,
        behaviorData
      );

      if (response) {
        await this.sendUserMessage(userId, response);
      }

    } catch (error) {
      this.logger.error('❌ Failed to handle message', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Removed unused _handleInteraction method - functionality moved to Discord bot layer

  private async handleReaction(reaction: any, user: any): Promise<void> {
    if (user.bot) return;

    try {
      // Track reaction behavior
      const reactionData = await this.behaviorTracker.analyzeReaction(reaction, user);
      
      // Update engagement metrics
      await this.userProfileManager.updateEngagement(user.id, reactionData);

    } catch (error) {
      this.logger.error('❌ Failed to handle reaction', {
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handlePresenceUpdate(oldPresence: any, newPresence: any): Promise<void> {
    const userId = newPresence.userId || newPresence.user?.id;
    if (!userId) return;

    try {
      // Track presence patterns for engagement scoring
      const presenceData = await this.behaviorTracker.analyzePresence(oldPresence, newPresence);
      
      // Update activity patterns
      await this.userProfileManager.updateActivity(userId, presenceData);

    } catch (error) {
      this.logger.error('❌ Failed to handle presence update', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Core Processing Methods
  private async processPendingInterventions(): Promise<void> {
    const pendingInterventions = await this.interventionSystem.getPendingInterventions();
    
    this.logger.info(`📋 Processing ${pendingInterventions.length} pending interventions`);

    for (const intervention of pendingInterventions) {
      try {
        await this.executeIntervention(intervention);
        this.onboardingMetrics.successfulInterventions++;
      } catch (error) {
        this.logger.error('❌ Failed to execute intervention', {
          interventionId: intervention.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async analyzeUserBehaviors(): Promise<void> {
    const activeUsers = await this.userProfileManager.getActiveUsers();
    
    this.logger.info(`🧠 Analyzing behavior for ${activeUsers.length} active users`);

    for (const user of activeUsers) {
      try {
        const behaviorAnalysis = await this.behaviorTracker.analyzeUserPatterns(user.id);
        await this.userProfileManager.updateAnalysis(user.id, behaviorAnalysis);
      } catch (error) {
        this.logger.error('❌ Failed to analyze user behavior', {
          userId: user.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async updateUserProfiles(): Promise<void> {
    const profiles = await this.userProfileManager.getAllProfiles();
    
    let totalEngagement = 0;

    for (const profile of profiles) {
      try {
        const updatedProfile = await this.userProfileManager.recalculateMetrics(profile.id);
        totalEngagement += updatedProfile.engagementScore;
      } catch (error) {
        this.logger.error('❌ Failed to update user profile', {
          userId: profile.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Update overall engagement metrics
    this.onboardingMetrics.userEngagementScore = profiles.length > 0 ? 
      totalEngagement / profiles.length : 0;
  }

  private async checkConversionOpportunities(): Promise<void> {
    const conversionCandidates = await this.userProfileManager.getConversionCandidates();
    
    this.logger.info(`💰 Found ${conversionCandidates.length} conversion opportunities`);

    for (const candidate of conversionCandidates) {
      try {
        const conversionStrategy = await this.conversationEngine.generateConversionMessage(
          candidate.id,
          candidate.profile
        );

        if (conversionStrategy) {
          await this.sendUserMessage(candidate.id, conversionStrategy);
          this.onboardingMetrics.upgradeConversions++;
        }
      } catch (error) {
        this.logger.error('❌ Failed to process conversion opportunity', {
          userId: candidate.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async generateOnboardingInsights(): Promise<void> {
    try {
      const insights = await this.userProfileManager.generateInsights();
      
      // Calculate key metrics
      this.onboardingMetrics.conversionRate = insights.conversionRate;
      this.onboardingMetrics.averageOnboardingTime = insights.averageCompletionTime;
      this.onboardingMetrics.churnPrevented = insights.churnRate;

      // Store insights for dashboard
      await withCircuitBreaker.supabase(
        async () => {
          if (this.hasSupabase()) {
            await this.requireSupabase()
              .from('onboarding_insights')
              .insert({
                timestamp: new Date().toISOString(),
                insights,
                metrics: this.onboardingMetrics
              });
          }
        },
        async () => {
          this.logger.warn('⚠️ Failed to store onboarding insights, Supabase circuit breaker open');
        }
      );

    } catch (error) {
      this.logger.error('❌ Failed to generate onboarding insights', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Helper Methods
  private async triggerIntervention(userId: string, intervention: any): Promise<void> {
    this.onboardingMetrics.interventionsTrigger++;
    
    try {
      await this.interventionSystem.scheduleIntervention(userId, intervention);
      
      this.logger.info('🚨 Intervention triggered', {
        userId,
        type: intervention.type,
        urgency: intervention.urgency
      });
    } catch (error) {
      this.logger.error('❌ Failed to trigger intervention', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async executeIntervention(intervention: any): Promise<void> {
    const response = await this.conversationEngine.generateInterventionResponse(
      intervention.userId,
      intervention
    );

    if (response) {
      await this.sendUserMessage(intervention.userId, response);
    }

    // Mark intervention as completed
    await this.interventionSystem.markCompleted(intervention.id);
  }

  private async _handleOnboardingInteraction(userId: string, interaction: any): Promise<void> {
    const response = await this.conversationEngine.handleOnboardingFlow(userId, interaction);
    
    if (response) {
      await interaction.reply(response);
    }
  }

  private async sendUserMessage(userId: string, message: any): Promise<void> {
    try {
      // This would integrate with Discord service to send DM
      await withCircuitBreaker.discord(
        async () => {
          // Discord API call would go here
          this.logger.info('📤 Sending onboarding message', {
            userId,
            messageType: message.type
          });
        },
        async () => {
          this.logger.warn('⚠️ Failed to send message, Discord circuit breaker open', {
            userId
          });
        }
      );
    } catch (error) {
      this.logger.error('❌ Failed to send user message', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 AutomatedOnboardingAgent cleanup...');
    
    await this.behaviorTracker.cleanup();
    await this.interventionSystem.cleanup();
    
    this.logger.info('✅ AutomatedOnboardingAgent cleanup complete');
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    return {
      ...this.onboardingMetrics,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  public async checkHealth(): Promise<any> {
    const checks: Array<{ component: string; status: string; details?: any }> = [];

    // Check core systems
    checks.push({
      component: 'behavior_tracker',
      status: await this.behaviorTracker.isHealthy() ? 'healthy' : 'unhealthy'
    });

    checks.push({
      component: 'conversation_engine', 
      status: await this.conversationEngine.isHealthy() ? 'healthy' : 'unhealthy'
    });

    checks.push({
      component: 'user_profile_manager',
      status: await this.userProfileManager.isHealthy() ? 'healthy' : 'unhealthy'
    });

    checks.push({
      component: 'intervention_system',
      status: await this.interventionSystem.isHealthy() ? 'healthy' : 'unhealthy'
    });
    
    // 🚀 ENHANCED: Check learning intelligence systems
    checks.push({
      component: 'adaptive_learning_engine',
      status: await this.adaptiveLearningEngine.isHealthy() ? 'healthy' : 'unhealthy'
    });
    
    checks.push({
      component: 'discord_interaction_handler',
      status: await this.discordInteractionHandler.isHealthy() ? 'healthy' : 'unhealthy'
    });
    
    checks.push({
      component: 'learning_paths',
      status: this.learningPaths.size > 0 ? 'healthy' : 'unhealthy',
      details: { pathCount: this.learningPaths.size }
    });

    const healthyComponents = checks.filter(c => c.status === 'healthy').length;
    const overallStatus = healthyComponents === checks.length ? 'healthy' : 
                         healthyComponents >= checks.length / 2 ? 'degraded' : 'unhealthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      details: {
        checks,
        metrics: this.onboardingMetrics,
        learningIntelligence: {
          activePaths: this.learningPaths.size,
          activeProfiles: this.userProfiles.size,
          averageCompletion: this.calculateAverageCompletion(),
          adaptationAccuracy: this.getAdaptationAccuracy()
        }
      }
    };
  }

  // 🎓 INDUSTRY-LEADING LEARNING PATH SYSTEM
  private initializeProfessionalLearningPaths(): void {
    this.logger.info('🎓 Initializing professional learning paths...');
    
    // 🔰 BEGINNER: Betting Fundamentals with Discord Integration
    this.learningPaths.set('beginner-fundamentals', {
      id: 'beginner-fundamentals',
      name: 'Unit Talk Betting Fundamentals',
      description: 'Master sports betting basics with professional guidance',
      target_audience: 'beginner',
      difficulty: 'beginner',
      estimated_duration: 120, // 2 hours
      discord_integration: {
        welcome_message: '🎯 Welcome to Unit Talk! Let\'s start your journey to profitable betting. React with 📚 to begin!',
        interactive_elements: ['reactions', 'buttons', 'progress_tracking'],
        progress_tracking: true,
        community_integration: true
      },
      steps: [
        {
          id: 'welcome-assessment',
          title: '🎯 Welcome & Experience Assessment',
          description: 'Quick assessment to personalize your learning path',
          type: 'discord_interaction',
          content: {
            discord_embed: {
              title: '🎯 Welcome to Unit Talk Professional Betting Community!',
              description: 'Let\'s customize your learning experience',
              fields: [
                { name: '📊 Experience Level', value: 'React with your level:\n🔰 Complete Beginner\n📈 Some Experience\n🎯 Looking to Improve\n💎 Want Pro Strategies' },
                { name: '💰 Goals', value: 'What\'s your main goal?\n💵 Side Income\n🏆 Consistent Profits\n📊 Learn Analytics\n🎓 Master Fundamentals' }
              ]
            },
            reactions: ['🔰', '📈', '🎯', '💎', '💵', '🏆', '📊', '🎓']
          },
          prerequisites: [],
          estimated_time: 5,
          completion_criteria: { reactions_received: 2 },
          interactive_elements: {
            buttons: true,
            reactions: true,
            forms: false,
            quizzes: false
          }
        },
        {
          id: 'unit-talk-intro',
          title: '🏛️ Unit Talk Platform Introduction',
          description: 'Learn about our professional cappers and community',
          type: 'education',
          content: {
            discord_embed: {
              title: '🏛️ Welcome to Unit Talk - Where Pros Share Their Edge',
              description: 'Meet our verified professional cappers',
              fields: [
                { name: '💎 Our Professional Cappers', value: '**Griff843** - NFL/NBA Specialist\n**Vicgo** - MLB Analytics Expert\n**Sauced** - NHL/Soccer Pro\n**MoneyReef** - Multi-Sport Veteran\n**Squirrel** - Props Specialist' },
                { name: '📊 What Makes Us Different', value: '✅ 100% Transparent Records\n✅ Real-Time Performance Tracking\n✅ Professional Grade Analytics\n✅ Community-First Approach' },
                { name: '🎯 Your Journey Starts Here', value: 'Follow along as we teach you:\n• How to read and interpret odds\n• Bankroll management strategies\n• How to follow our cappers\n• Community guidelines and culture' }
              ]
            },
            next_action: 'React with 🚀 to continue your journey!'
          },
          prerequisites: ['welcome-assessment'],
          estimated_time: 10,
          completion_criteria: { message_read: true, reaction_given: true },
          discord_commands: ['/cappers', '/stats'],
          interactive_elements: {
            buttons: true,
            reactions: true,
            forms: false,
            quizzes: false
          }
        },
        {
          id: 'odds-mastery',
          title: '📊 Understanding Odds Like a Pro',
          description: 'Master American, Decimal, and Fractional odds with live examples',
          type: 'education',
          content: {
            discord_embed: {
              title: '📊 Odds Mastery - Your Foundation to Success',
              description: 'Learn to read odds like our professional cappers',
              fields: [
                { name: '🇺🇸 American Odds', value: '**Favorites (-)**\n-150 = Risk $150 to win $100\n\n**Underdogs (+)**\n+130 = Risk $100 to win $130' },
                { name: '🎯 Quick Practice', value: 'If Mahomes Over 2.5 TDs is -120:\n• How much to risk for $100 profit?\n• Is this good value?\n\nReact with 💭 for the answer!' },
                { name: '💡 Pro Tip from Griff843', value: '"Always shop lines across books. A difference of -110 vs -120 adds up over time!"' }
              ]
            },
            interactive_quiz: {
              question: 'If a bet is +200, how much do you win on a $50 bet?',
              options: ['$100', '$150', '$200', '$250'],
              correct_answer: '$100',
              explanation: 'At +200, you win $2 for every $1 risked. $50 × 2 = $100 profit!'
            }
          },
          prerequisites: ['unit-talk-intro'],
          estimated_time: 15,
          completion_criteria: { quiz_score: 0.8, engagement_time: 300 },
          interactive_elements: {
            buttons: true,
            reactions: true,
            forms: false,
            quizzes: true
          }
        },
        {
          id: 'bankroll-fundamentals',
          title: '💰 Bankroll Management - Protect Your Capital',
          description: 'Learn professional bankroll strategies from our cappers',
          type: 'education',
          content: {
            discord_embed: {
              title: '💰 Bankroll Management - The Foundation of Long-Term Success',
              description: 'Learn how professionals protect their capital',
              fields: [
                { name: '📏 Unit Sizing', value: '**Conservative**: 1-2% per bet\n**Moderate**: 2-3% per bet\n**Aggressive**: 3-5% per bet\n\nNever bet more than 5% on any single play!' },
                { name: '🎯 MoneyReef\'s Golden Rules', value: '1. Never chase losses\n2. Set daily/weekly limits\n3. Track every bet\n4. Withdraw profits regularly\n5. Separate betting money from life money' },
                { name: '📊 Bankroll Calculator', value: 'Starting Bankroll: $1000\nUnit Size (3%): $30\nMonthly Goal: 10-15% growth\n\nUse `/calculator` for personalized sizing!' }
              ]
            }
          },
          prerequisites: ['odds-mastery'],
          estimated_time: 20,
          completion_criteria: { understanding_confirmed: true },
          discord_commands: ['/calculator', '/bankroll'],
          interactive_elements: {
            buttons: true,
            reactions: true,
            forms: true,
            quizzes: false
          }
        },
        {
          id: 'capper-following',
          title: '👥 Following Our Professional Cappers',
          description: 'Learn how to maximize value from our verified professionals',
          type: 'practice',
          content: {
            discord_embed: {
              title: '👥 Following Unit Talk Pros - Your Path to Consistent Profits',
              description: 'Learn the art of following professional cappers',
              fields: [
                { name: '🎯 Capper Specialties', value: '**Griff843**: NFL totals, NBA unders\n**Vicgo**: MLB analytics, sabermetrics\n**Sauced**: NHL favorites, soccer value\n**MoneyReef**: Multi-sport, live betting\n**Squirrel**: Player props, niche markets' },
                { name: '📊 How to Track Performance', value: '• Check daily/weekly records\n• Review historical performance\n• Understand their betting style\n• Follow their reasoning\n• Use `/stats capper-name` for details' },
                { name: '🚀 Getting Started', value: 'Start with one capper whose style matches your goals. Monitor their picks, learn their reasoning, and gradually build confidence.' }
              ]
            },
            practical_exercise: {
              task: 'Follow one capper for 3 days, track their performance, and share your observations',
              tracking_required: true
            }
          },
          prerequisites: ['bankroll-fundamentals'],
          estimated_time: 25,
          completion_criteria: { capper_followed: true, observations_shared: true },
          discord_commands: ['/follow', '/stats', '/unfollow'],
          interactive_elements: {
            buttons: true,
            reactions: true,
            forms: true,
            quizzes: false
          }
        },
        {
          id: 'community-integration',
          title: '🤝 Joining the Unit Talk Community',
          description: 'Become part of our winning culture and community guidelines',
          type: 'verification',
          content: {
            discord_embed: {
              title: '🤝 Welcome to the Unit Talk Family!',
              description: 'Community guidelines and culture integration',
              fields: [
                { name: '📜 Community Guidelines', value: '✅ Respect all members\n✅ No spam or excessive posting\n✅ Constructive discussions only\n✅ Follow capper reasoning, don\'t blindly tail\n✅ Share wins AND losses honestly' },
                { name: '🎯 How to Get the Most Value', value: '• Ask thoughtful questions\n• Share your analysis\n• Participate in discussions\n• Learn from other members\n• Support the community culture' },
                { name: '🏆 Graduation Requirements', value: 'To complete onboarding:\n✅ Acknowledge community guidelines\n✅ Follow at least one capper\n✅ Make your first thoughtful comment\n✅ Set up your profile with `/profile`' }
              ]
            }
          },
          prerequisites: ['capper-following'],
          estimated_time: 15,
          completion_criteria: { 
            guidelines_acknowledged: true,
            profile_setup: true,
            first_interaction: true
          },
          discord_commands: ['/profile', '/guidelines'],
          interactive_elements: {
            buttons: true,
            reactions: true,
            forms: true,
            quizzes: false
          }
        }
      ]
    });

    this.logger.info(`✅ Initialized ${this.learningPaths.size} professional learning paths`);
  }

  // 🧠 ADAPTIVE LEARNING ENGINE METHODS  
  private async loadExistingUserProfiles(): Promise<void> {
    try {
      if (!this.hasSupabase()) {
        this.logger.warn('⚠️ Supabase not available for loading user profiles');
        return;
      }

      const { data: profiles, error } = await this.requireSupabase()
        .from('enhanced_user_profiles')
        .select('*')
        .eq('platform', 'discord');

      if (error) {
        this.logger.error('❌ Failed to load user profiles:', { error: error instanceof Error ? error.message : String(error) });
        return;
      }

      if (profiles) {
        profiles.forEach(profile => {
          this.userProfiles.set(profile.discord_id, profile as EnhancedUserProfile);
        });
        this.logger.info(`📚 Loaded ${profiles.length} existing user profiles`);
      }
    } catch (error) {
      this.logger.error('❌ Error loading user profiles:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async validateLearningPaths(): Promise<void> {
    this.logger.info('🔍 Validating learning path integrity...');
    
    for (const [pathId, path] of this.learningPaths) {
      // Validate step dependencies
      for (const step of path.steps) {
        for (const prereq of step.prerequisites) {
          const prereqExists = path.steps.some(s => s.id === prereq);
          if (!prereq || !prereqExists) {
            this.logger.warn(`⚠️ Invalid prerequisite '${prereq}' in step '${step.id}' of path '${pathId}'`);
          }
        }
      }
      
      // Validate Discord integration
      if (path.discord_integration.interactive_elements.length === 0) {
        this.logger.warn(`⚠️ Learning path '${pathId}' has no Discord interactive elements`);
      }
    }
    
    this.logger.info('✅ Learning path validation completed');
  }

  // 📊 PERFORMANCE ANALYTICS
  private calculateAverageCompletion(): number {
    if (this.userProfiles.size === 0) return 0;
    
    let totalCompletion = 0;
    for (const profile of this.userProfiles.values()) {
      totalCompletion += profile.learning_progress.completion_percentage;
    }
    
    return totalCompletion / this.userProfiles.size;
  }

  private getAdaptationAccuracy(): number {
    // Calculate how well our adaptive system is performing
    return this.onboardingMetrics.adaptiveAdjustments > 0 ? 
           this.onboardingMetrics.successfulInterventions / this.onboardingMetrics.adaptiveAdjustments : 
           0;
  }
}