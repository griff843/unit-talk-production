export interface UserBehaviorProfile {
  id: string;
  userId: string;
  joinDate: Date;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  engagementScore: number;
  learningVelocity: number;
  responsePatterns: ResponsePattern[];
  commandProficiency: CommandProficiency;
  timezoneBehavior: TimezoneActivity;
  socialInteraction: SocialMetrics;
  conversionLikelihood: number;
  churnRisk: number;
  lastActivity: Date;
  onboardingStage: OnboardingStage;
  preferences: UserPreferences;
  interventionHistory: InterventionRecord[];
}

export interface ResponsePattern {
  averageResponseTime: number;
  responseConsistency: number;
  engagementTrend: 'increasing' | 'stable' | 'decreasing';
  timeOfDayActivity: Record<string, number>;
  dayOfWeekActivity: Record<string, number>;
}

export interface CommandProficiency {
  commandsUsed: string[];
  successRate: number;
  errorPatterns: string[];
  helpRequestFrequency: number;
  advancedFeatureUsage: number;
}

export interface TimezoneActivity {
  detectedTimezone: string;
  activeHours: number[];
  peakActivityTime: string;
  weekendPattern: 'active' | 'inactive' | 'same';
}

export interface SocialMetrics {
  messageCount: number;
  reactionsGiven: number;
  reactionsReceived: number;
  questionsAsked: number;
  helpProvided: number;
  channelsActive: string[];
}

export interface UserPreferences {
  communicationStyle: 'detailed' | 'concise' | 'visual';
  learningPace: 'slow' | 'moderate' | 'fast';
  notificationTiming: 'immediate' | 'batched' | 'scheduled';
  contentType: 'beginner' | 'intermediate' | 'advanced';
  interactionMode: 'guided' | 'self-directed' | 'minimal';
}

export interface OnboardingStage {
  currentStage: 'welcome' | 'tutorial' | 'first_picks' | 'upgrade_consideration' | 'active_user';
  completedSteps: string[];
  stuckPoints: string[];
  timeInStage: number;
  progressScore: number;
}

export interface InterventionRecord {
  id: string;
  type: InterventionType;
  timestamp: Date;
  trigger: string;
  response: string;
  outcome: 'successful' | 'failed' | 'ignored';
  followUpNeeded: boolean;
}

export interface MessageAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral' | 'confused' | 'frustrated';
  complexity: 'basic' | 'intermediate' | 'advanced';
  urgency: 'low' | 'medium' | 'high';
  topicCategories: string[];
  questions: DetectedQuestion[];
  frustrationIndicators: FrustrationSignal[];
  learningIndicators: LearningSignal[];
  conversionSignals: ConversionSignal[];
}

export interface DetectedQuestion {
  question: string;
  category: 'basic' | 'advanced' | 'technical' | 'procedural';
  confidence: number;
  previouslyAsked: boolean;
}

export interface FrustrationSignal {
  type: 'confusion' | 'impatience' | 'difficulty' | 'technical_issue';
  severity: 'low' | 'medium' | 'high';
  indicators: string[];
  timeframe: string;
}

export interface LearningSignal {
  concept: string;
  understanding: 'poor' | 'partial' | 'good' | 'excellent';
  progression: 'stuck' | 'slow' | 'normal' | 'fast';
  needsReinforcement: boolean;
}

export interface ConversionSignal {
  type: 'interest' | 'value_recognition' | 'trust_building' | 'ready_to_upgrade';
  strength: 'weak' | 'moderate' | 'strong';
  timing: 'early' | 'optimal' | 'late';
  barriers: string[];
}

export interface InterventionType {
  type: 'confusion_help' | 'engagement_boost' | 'conversion_prompt' | 'churn_prevention' | 'learning_acceleration';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  timing: 'immediate' | 'scheduled' | 'optimal_moment';
  method: 'dm' | 'channel_mention' | 'guided_tutorial' | 'human_handoff';
}

export interface ConversationContext {
  userId: string;
  conversationHistory: ConversationTurn[];
  currentTopic: string;
  userState: UserState;
  goals: ConversationGoal[];
}

export interface ConversationTurn {
  timestamp: Date;
  speaker: 'user' | 'bot';
  message: string;
  intent: string;
  sentiment: string;
  responseTime?: number;
}

export interface UserState {
  onboardingStage: string;
  knowledgeLevel: string;
  currentConfusion?: string;
  goalProgress: Record<string, number>;
  lastInteraction: Date;
}

export interface ConversationGoal {
  id: string;
  type: 'education' | 'engagement' | 'conversion' | 'support';
  priority: number;
  completed: boolean;
  steps: ConversationStep[];
}

export interface ConversationStep {
  id: string;
  description: string;
  completed: boolean;
  nextSteps: string[];
}

export interface BehaviorEvent {
  userId: string;
  timestamp: Date;
  eventType: 'message' | 'reaction' | 'command' | 'presence' | 'interaction' | 'action';
  eventData: any;
  analysis: MessageAnalysis;
  context: EventContext;
}

export interface EventContext {
  channel: string;
  messageId?: string;
  previousActivity: BehaviorEvent[];
  sessionDuration: number;
  timesSinceLastActivity: number;
}

export interface OnboardingMetrics {
  totalUsers: number;
  activeUsers: number;
  completedOnboarding: number;
  averageCompletionTime: number;
  conversionRate: number;
  churnRate: number;
  engagementScore: number;
  interventionSuccess: number;
  commonStuckPoints: Record<string, number>;
  bestPerformingFlows: string[];
}

export interface PersonalizationEngine {
  generatePersonalizedContent(userId: string, contentType: string): Promise<any>;
  adaptConversationStyle(userId: string, context: ConversationContext): Promise<any>;
  predictOptimalTiming(userId: string, actionType: string): Promise<Date>;
  calculateConversionProbability(userId: string): Promise<number>;
}