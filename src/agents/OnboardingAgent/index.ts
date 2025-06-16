import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies } from '../BaseAgent/types';
import { AIOrchestrator } from '../AlertAgent/aiOrchestrator';
import { logger } from '../../services/logging';

interface UserProfile {
  id: string;
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
  preferred_sports: string[];
  bankroll_size: 'small' | 'medium' | 'large' | 'institutional';
  goals: string[];
  learning_style: 'visual' | 'analytical' | 'hands-on' | 'social';
  onboarding_stage: string;
  created_at: string;
  updated_at: string;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  type: 'education' | 'assessment' | 'practice' | 'verification';
  content: any;
  prerequisites: string[];
  estimated_time: number;
  completion_criteria: any;
}

interface LearningPath {
  id: string;
  name: string;
  description: string;
  target_audience: string;
  steps: OnboardingStep[];
  estimated_duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface AdaptivePrompt {
  context: string;
  user_profile: UserProfile;
  current_step: OnboardingStep;
  performance_history: any[];
  personalization_factors: any;
}

export class OnboardingAgent extends BaseAgent {
  private aiOrchestrator: AIOrchestrator;
  private learningPaths: Map<string, LearningPath> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    this.aiOrchestrator = new AIOrchestrator();
    this.initializeLearningPaths();
  }

  protected async initialize(): Promise<void> {
    this.logger.info('🎓 OnboardingAgent initializing...');
    await this.loadUserProfiles();
    await this.initializeAdaptiveSystems();
  }

  protected async process(): Promise<void> {
    try {
      // Process active onboarding sessions
      await this.processActiveOnboardings();
      
      // Update learning paths based on user feedback
      await this.updateLearningPaths();
      
      // Generate personalized content
      await this.generatePersonalizedContent();
      
      // Analyze onboarding effectiveness
      await this.analyzeOnboardingMetrics();
      
    } catch (error) {
      this.logger.error('Error in OnboardingAgent process:', error as Error);
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 OnboardingAgent cleanup complete');
  }

  protected async collectMetrics(): Promise<any> {
    const { data: onboardingStats } = await this.supabase
      .from('user_onboarding')
      .select('status, completion_rate, satisfaction_score')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return {
      agentName: 'OnboardingAgent',
      activeOnboardings: onboardingStats?.filter(s => s.status === 'active').length || 0,
      completedOnboardings: onboardingStats?.filter(s => s.status === 'completed').length || 0,
      averageCompletionRate: this.calculateAverageCompletionRate(onboardingStats || []),
      averageSatisfaction: this.calculateAverageSatisfaction(onboardingStats || []),
      successCount: onboardingStats?.filter(s => s.completion_rate > 0.8).length || 0,
      warningCount: onboardingStats?.filter(s => s.completion_rate < 0.5).length || 0,
      errorCount: 0
    };
  }

  public async checkHealth(): Promise<any> {
    try {
      // Check AI orchestrator health
      const models = this.aiOrchestrator.getAvailableModelIds();
      
      // Check database connectivity
      const { error } = await this.supabase
        .from('user_onboarding')
        .select('id')
        .limit(1);

      if (error) throw error;

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        details: {
          availableModels: models.length,
          database: 'connected',
          learningPaths: this.learningPaths.size
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // AI-Enhanced Onboarding Methods
  async createPersonalizedOnboarding(userId: string, initialAssessment: any): Promise<LearningPath> {
    try {
      // Analyze user assessment with AI
      const userProfile = await this.analyzeUserProfile(userId, initialAssessment);
      
      // Generate personalized learning path
      const learningPath = await this.generatePersonalizedPath(userProfile);
      
      // Store user profile and path
      this.userProfiles.set(userId, userProfile);
      
      // Create onboarding record
      await this.supabase
        .from('user_onboarding')
        .insert({
          user_id: userId,
          learning_path_id: learningPath.id,
          profile: userProfile,
          status: 'active',
          created_at: new Date().toISOString()
        });

      this.logger.info(`Created personalized onboarding for user ${userId}`, {
        pathId: learningPath.id,
        experienceLevel: userProfile.experience_level,
        estimatedDuration: learningPath.estimated_duration
      });

      return learningPath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create onboarding for user ${userId}:`, error as Error);
      throw error;
    }
  }

  private async analyzeUserProfile(userId: string, assessment: any): Promise<UserProfile> {
    const prompt = this.buildProfileAnalysisPrompt(assessment);
    
    try {
      const aiResponse = await this.aiOrchestrator.getAdviceForPick({
        id: `profile-${userId}`,
        market_type: 'user_analysis',
        line: 0,
        odds: 0
      } as any);

      // Parse AI response to extract profile characteristics
      const profile = this.parseProfileFromAI(aiResponse, userId);
      
      return {
        ...profile,
        id: userId,
        experience_level: profile.experience_level || 'beginner',
        risk_tolerance: profile.risk_tolerance || 'moderate',
        preferred_sports: profile.preferred_sports || [],
        bankroll_size: profile.bankroll_size || 'small',
        goals: profile.goals || [],
        learning_style: profile.learning_style || 'analytical',
        onboarding_stage: profile.onboarding_stage || 'initial',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('AI profile analysis failed, using fallback:', { error: errorMessage });
      return this.createFallbackProfile(userId, assessment);
    }
  }

  private buildProfileAnalysisPrompt(assessment: any): string {
    return `
USER PROFILE ANALYSIS

Assessment Data:
${JSON.stringify(assessment, null, 2)}

Please analyze this user assessment and determine:

1. Experience Level: beginner/intermediate/advanced/professional
2. Risk Tolerance: conservative/moderate/aggressive  
3. Learning Style: visual/analytical/hands-on/social
4. Bankroll Category: small/medium/large/institutional
5. Primary Goals: List 3-5 main objectives
6. Preferred Sports: Extract mentioned sports interests

Provide a structured analysis with reasoning for each classification.

Response Format:
Experience: [level] - [reasoning]
Risk Tolerance: [level] - [reasoning]
Learning Style: [style] - [reasoning]
Bankroll: [size] - [reasoning]
Goals: [list of goals]
Sports: [list of sports]
`;
  }

  private parseProfileFromAI(aiResponse: any, userId: string): Partial<UserProfile> {
    // Parse AI response and extract profile data
    // This would use more sophisticated parsing in production
    return {
      experience_level: 'intermediate',
      risk_tolerance: 'moderate',
      learning_style: 'analytical',
      bankroll_size: 'medium',
      preferred_sports: ['NFL', 'NBA'],
      goals: ['Learn bankroll management', 'Improve win rate', 'Understand value betting'],
      onboarding_stage: 'assessment_complete'
    };
  }

  private createFallbackProfile(userId: string, assessment: any): UserProfile {
    return {
      id: userId,
      experience_level: 'beginner',
      risk_tolerance: 'conservative',
      preferred_sports: ['NFL'],
      bankroll_size: 'small',
      goals: ['Learn basics'],
      learning_style: 'hands-on',
      onboarding_stage: 'started',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  private async generatePersonalizedPath(profile: UserProfile): Promise<LearningPath> {
    const basePathId = this.selectBaseLearningPath(profile);
    const basePath = this.learningPaths.get(basePathId);
    
    if (!basePath) {
      throw new Error(`Base learning path ${basePathId} not found`);
    }

    // Customize path based on profile
    const customizedSteps = await this.customizeSteps(basePath.steps, profile);
    
    return {
      ...basePath,
      id: `${basePathId}-${profile.id}`,
      name: `Personalized ${basePath.name}`,
      steps: customizedSteps,
      estimated_duration: this.calculateDuration(customizedSteps)
    };
  }

  private selectBaseLearningPath(profile: UserProfile): string {
    if (profile.experience_level === 'beginner') {
      return 'beginner-fundamentals';
    } else if (profile.experience_level === 'intermediate') {
      return 'intermediate-strategy';
    } else {
      return 'advanced-optimization';
    }
  }

  private async customizeSteps(steps: OnboardingStep[], profile: UserProfile): Promise<OnboardingStep[]> {
    const customized: OnboardingStep[] = [];
    
    for (const step of steps) {
      // Use AI to customize step content based on profile
      const customizedStep = await this.customizeStepWithAI(step, profile);
      customized.push(customizedStep);
    }
    
    return customized;
  }

  private async customizeStepWithAI(step: OnboardingStep, profile: UserProfile): Promise<OnboardingStep> {
    const prompt = this.buildStepCustomizationPrompt(step, profile);
    
    try {
      const aiResponse = await this.aiOrchestrator.getAdviceForPick({
        id: `step-${step.id}`,
        market_type: 'content_customization',
        line: 0,
        odds: 0
      } as any);

      // Parse AI response to customize step content
      return {
        ...step,
        content: this.parseCustomizedContent(aiResponse, step, profile)
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Step customization failed, using original:', { error: errorMessage });
      return step;
    }
  }

  private buildStepCustomizationPrompt(step: OnboardingStep, profile: UserProfile): string {
    return `
LEARNING STEP CUSTOMIZATION

Step Details:
- Title: ${step.title}
- Type: ${step.type}
- Description: ${step.description}

User Profile:
- Experience: ${profile.experience_level}
- Risk Tolerance: ${profile.risk_tolerance}
- Learning Style: ${profile.learning_style}
- Preferred Sports: ${profile.preferred_sports.join(', ')}
- Goals: ${profile.goals.join(', ')}

Please customize this learning step to match the user's profile:
1. Adjust complexity level for their experience
2. Include examples from their preferred sports
3. Align with their learning style preferences
4. Connect to their stated goals

Provide customized content that will be most effective for this specific user.
`;
  }

  private parseCustomizedContent(aiResponse: any, step: OnboardingStep, profile: UserProfile): any {
    // Parse AI response and create customized content
    // This would be more sophisticated in production
    return {
      ...step.content,
      customized: true,
      personalization_applied: [
        'experience_level_adjustment',
        'sport_specific_examples',
        'learning_style_optimization'
      ]
    };
  }

  // Feedback Loop and Adaptive Learning
  async processFeedback(userId: string, stepId: string, feedback: any): Promise<void> {
    try {
      // Store feedback
      await this.supabase
        .from('onboarding_feedback')
        .insert({
          user_id: userId,
          step_id: stepId,
          feedback,
          timestamp: new Date().toISOString()
        });

      // Analyze feedback with AI
      const analysis = await this.analyzeFeedbackWithAI(feedback);
      
      // Update user profile if needed
      if (analysis.profileUpdates) {
        await this.updateUserProfile(userId, analysis.profileUpdates);
      }
      
      // Adjust future steps if needed
      if (analysis.pathAdjustments) {
        await this.adjustLearningPath(userId, analysis.pathAdjustments);
      }

      this.logger.info(`Processed feedback for user ${userId}, step ${stepId}`, {
        sentiment: analysis.sentiment,
        adjustments: analysis.pathAdjustments
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process feedback for user ${userId}:`, { error: errorMessage });
    }
  }

  private async analyzeFeedbackWithAI(feedback: any): Promise<any> {
    const prompt = `
FEEDBACK ANALYSIS

User Feedback:
${JSON.stringify(feedback, null, 2)}

Please analyze this feedback and provide:
1. Sentiment: positive/neutral/negative
2. Key insights about user preferences
3. Suggested profile updates
4. Recommended path adjustments
5. Confidence level in analysis

Focus on actionable insights that can improve the learning experience.
`;

    try {
      const aiResponse = await this.aiOrchestrator.getAdviceForPick({
        id: 'feedback-analysis',
        market_type: 'feedback_analysis',
        line: 0,
        odds: 0
      } as any);

      return this.parseFeedbackAnalysis(aiResponse);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('AI feedback analysis failed:', { error: errorMessage });
      return { sentiment: 'neutral', profileUpdates: null, pathAdjustments: null };
    }
  }

  private parseFeedbackAnalysis(aiResponse: any): any {
    // Parse AI response for feedback insights
    return {
      sentiment: 'positive',
      profileUpdates: null,
      pathAdjustments: null,
      confidence: 0.7
    };
  }

  // Initialize learning paths
  private initializeLearningPaths(): void {
    // Beginner path
    this.learningPaths.set('beginner-fundamentals', {
      id: 'beginner-fundamentals',
      name: 'Betting Fundamentals',
      description: 'Learn the basics of sports betting',
      target_audience: 'beginners',
      difficulty: 'beginner',
      estimated_duration: 120, // minutes
      steps: [
        {
          id: 'basics-1',
          title: 'Understanding Odds',
          description: 'Learn how to read and interpret betting odds',
          type: 'education',
          content: { modules: ['odds-formats', 'probability', 'value'] },
          prerequisites: [],
          estimated_time: 15,
          completion_criteria: { quiz_score: 0.8 }
        },
        {
          id: 'basics-2',
          title: 'Bankroll Management',
          description: 'Learn how to manage your betting bankroll',
          type: 'education',
          content: { modules: ['unit-sizing', 'kelly-criterion', 'risk-management'] },
          prerequisites: ['basics-1'],
          estimated_time: 20,
          completion_criteria: { quiz_score: 0.8 }
        }
      ]
    });

    // Add more learning paths...
  }

  private async loadUserProfiles(): Promise<void> {
    const { data: profiles } = await this.supabase
      .from('user_profiles')
      .select('*');

    if (profiles) {
      profiles.forEach(profile => {
        this.userProfiles.set(profile.id, profile);
      });
    }
  }

  private async initializeAdaptiveSystems(): Promise<void> {
    // Initialize AI models for personalization
    // Set up feedback processing pipelines
    // Configure adaptive algorithms
  }

  private async processActiveOnboardings(): Promise<void> {
    const { data: activeOnboardings } = await this.supabase
      .from('user_onboarding')
      .select('*')
      .eq('status', 'active');

    if (activeOnboardings) {
      for (const onboarding of activeOnboardings) {
        await this.processOnboardingSession(onboarding);
      }
    }
  }

  private async processOnboardingSession(onboarding: any): Promise<void> {
    // Check for stalled sessions
    // Send reminders if needed
    // Update progress tracking
    // Generate next steps
  }

  private async updateLearningPaths(): Promise<void> {
    // Analyze completion rates and feedback
    // Update path effectiveness
    // Optimize step ordering
  }

  private async generatePersonalizedContent(): Promise<void> {
    // Create custom content based on user preferences
    // Generate sport-specific examples
    // Adapt difficulty levels
  }

  private async analyzeOnboardingMetrics(): Promise<void> {
    // Track completion rates
    // Measure satisfaction scores
    // Identify improvement opportunities
  }

  private calculateAverageCompletionRate(stats: any[]): number {
    if (!stats || stats.length === 0) return 0;
    const total = stats.reduce((sum, stat) => sum + (stat.completion_rate || 0), 0);
    return total / stats.length;
  }

  private calculateAverageSatisfaction(stats: any[]): number {
    if (!stats || stats.length === 0) return 0;
    const validScores = stats.filter(stat => stat.satisfaction_score != null);
    if (validScores.length === 0) return 0;
    const total = validScores.reduce((sum, stat) => sum + stat.satisfaction_score, 0);
    return total / validScores.length;
  }

  private calculateDuration(steps: OnboardingStep[]): number {
    return steps.reduce((total, step) => total + step.estimated_time, 0);
  }

  private async updateUserProfile(userId: string, updates: any): Promise<void> {
    const profile = this.userProfiles.get(userId);
    if (profile) {
      Object.assign(profile, updates, { updated_at: new Date().toISOString() });
      this.userProfiles.set(userId, profile);
      
      await this.supabase
        .from('user_profiles')
        .upsert(profile);
    }
  }

  private async adjustLearningPath(userId: string, adjustments: any): Promise<void> {
    // Implement path adjustments based on AI recommendations
    this.logger.info(`Adjusting learning path for user ${userId}`, adjustments);
  }
}