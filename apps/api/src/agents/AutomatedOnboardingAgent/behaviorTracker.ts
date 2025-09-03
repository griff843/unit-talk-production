import { redisCache } from '../../cache/enhanced-cache';
import { Logger } from '../../shared/logger/types';

import { MessageAnalysis, BehaviorEvent, FrustrationSignal, LearningSignal, ConversionSignal } from './types';

export class BehaviorTracker {
  private readonly logger: Logger;
  private activeTracking: Set<string> = new Set();
  private behaviorPatterns: Map<string, BehaviorEvent[]> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('🧠 Initializing BehaviorTracker');
    
    // Load active tracking users from cache
    const activeUsers = await redisCache.get('onboarding:active_tracking');
    if (activeUsers) {
      const users = JSON.parse(activeUsers);
      this.activeTracking = new Set(users);
    }
  }

  async startTracking(userId: string): Promise<void> {
    this.activeTracking.add(userId);
    this.behaviorPatterns.set(userId, []);
    
    // Persist to cache
    await redisCache.set(
      'onboarding:active_tracking',
      JSON.stringify(Array.from(this.activeTracking)),
      3600 // 1 hour TTL
    );

    this.logger.info('👁️ Started behavior tracking', { userId });
  }

  async stopTracking(userId: string): Promise<void> {
    this.activeTracking.delete(userId);
    this.behaviorPatterns.delete(userId);
    
    await redisCache.set(
      'onboarding:active_tracking',
      JSON.stringify(Array.from(this.activeTracking)),
      3600
    );

    this.logger.info('🛑 Stopped behavior tracking', { userId });
  }

  async analyzeMessage(message: any): Promise<MessageAnalysis> {
    const content = message.content?.toLowerCase() || '';
    const userId = message.author?.id;

    if (!userId || !this.activeTracking.has(userId)) {
      return this.getDefaultAnalysis();
    }

    const analysis: MessageAnalysis = {
      sentiment: this.analyzeSentiment(content),
      complexity: this.analyzeComplexity(content),
      urgency: this.analyzeUrgency(content, message.createdTimestamp),
      topicCategories: this.categorizeTopics(content),
      questions: this.extractQuestions(content),
      frustrationIndicators: this.detectFrustration(content),
      learningIndicators: this.detectLearning(content),
      conversionSignals: this.detectConversionSignals(content)
    };

    // Store behavior event
    await this.storeBehaviorEvent(userId, {
      userId,
      timestamp: new Date(message.createdTimestamp),
      eventType: 'message',
      eventData: {
        content: content.substring(0, 100), // Store first 100 chars only
        channelId: message.channelId,
        messageLength: content.length,
        hasAttachments: message.attachments?.size > 0,
        hasMentions: message.mentions?.users?.size > 0
      },
      analysis,
      context: await this.getEventContext(userId, message)
    });

    return analysis;
  }

  async analyzeInteraction(interaction: any): Promise<MessageAnalysis> {
    const userId = interaction.user?.id;
    
    if (!userId || !this.activeTracking.has(userId)) {
      return this.getDefaultAnalysis();
    }

    const analysis: MessageAnalysis = {
      sentiment: 'neutral',
      complexity: this.analyzeInteractionComplexity(interaction),
      urgency: interaction.customId?.includes('urgent') ? 'high' : 'low',
      topicCategories: this.categorizeInteractionTopics(interaction),
      questions: [],
      frustrationIndicators: [],
      learningIndicators: this.detectInteractionLearning(interaction),
      conversionSignals: this.detectInteractionConversion(interaction)
    };

    await this.storeBehaviorEvent(userId, {
      userId,
      timestamp: new Date(),
      eventType: 'interaction',
      eventData: {
        type: interaction.type,
        customId: interaction.customId,
        componentType: interaction.componentType,
        values: interaction.values
      },
      analysis,
      context: await this.getEventContext(userId, interaction)
    });

    return analysis;
  }

  async analyzeReaction(reaction: any, user: any): Promise<MessageAnalysis> {
    const userId = user.id;
    
    if (!userId || !this.activeTracking.has(userId)) {
      return this.getDefaultAnalysis();
    }

    const emojiName = reaction.emoji?.name || '';
    const isPositive = ['👍', '✅', '🎯', '💯', '🔥', '👌'].includes(emojiName);
    const isNegative = ['👎', '❌', '😕', '😤', '🤔'].includes(emojiName);

    const analysis: MessageAnalysis = {
      sentiment: isPositive ? 'positive' : isNegative ? 'negative' : 'neutral',
      complexity: 'basic',
      urgency: 'low',
      topicCategories: ['engagement'],
      questions: [],
      frustrationIndicators: isNegative ? [{ 
        type: 'confusion', 
        severity: 'low', 
        indicators: [emojiName], 
        timeframe: 'immediate' 
      }] : [],
      learningIndicators: isPositive ? [{ 
        concept: 'engagement', 
        understanding: 'good', 
        progression: 'normal', 
        needsReinforcement: false 
      }] : [],
      conversionSignals: []
    };

    await this.storeBehaviorEvent(userId, {
      userId,
      timestamp: new Date(),
      eventType: 'reaction',
      eventData: {
        emoji: emojiName,
        messageId: reaction.message?.id,
        channelId: reaction.message?.channelId
      },
      analysis,
      context: await this.getEventContext(userId, reaction)
    });

    return analysis;
  }

  async analyzePresence(_oldPresence: any, newPresence: any): Promise<MessageAnalysis> {
    const userId = newPresence.userId || newPresence.user?.id;
    
    if (!userId || !this.activeTracking.has(userId)) {
      return this.getDefaultAnalysis();
    }

    const analysis: MessageAnalysis = {
      sentiment: 'neutral',
      complexity: 'basic',
      urgency: 'low',
      topicCategories: ['activity'],
      questions: [],
      frustrationIndicators: [],
      learningIndicators: [],
      conversionSignals: []
    };

    await this.storeBehaviorEvent(userId, {
      userId,
      timestamp: new Date(),
      eventType: 'presence',
      eventData: {
        status: newPresence.status,
        activities: newPresence.activities?.map((a: any) => ({
          name: a.name,
          type: a.type
        }))
      },
      analysis,
      context: await this.getEventContext(userId, newPresence)
    });

    return analysis;
  }

  async analyzeUserPatterns(userId: string): Promise<any> {
    const events = this.behaviorPatterns.get(userId) || [];
    const recentEvents = events.filter(e => 
      e.timestamp.getTime() > Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
    );

    if (recentEvents.length === 0) {
      return this.getDefaultPatternAnalysis();
    }

    return {
      activityLevel: this.calculateActivityLevel(recentEvents),
      engagementTrend: this.calculateEngagementTrend(recentEvents),
      learningVelocity: this.calculateLearningVelocity(recentEvents),
      frustrationLevel: this.calculateFrustrationLevel(recentEvents),
      conversionReadiness: this.calculateConversionReadiness(recentEvents),
      responsePatterns: this.analyzeResponsePatterns(recentEvents),
      peakActivityTimes: this.identifyPeakTimes(recentEvents)
    };
  }

  // Analysis Helper Methods
  private analyzeSentiment(content: string): 'positive' | 'negative' | 'neutral' | 'confused' | 'frustrated' {
    const positiveWords = ['good', 'great', 'awesome', 'thanks', 'helpful', 'understand', 'perfect'];
    const negativeWords = ['bad', 'wrong', 'stupid', 'hate', 'difficult', 'sucks'];
    const confusionWords = ['confused', 'lost', 'don\'t understand', 'help', 'what', 'how'];
    const frustrationWords = ['frustrated', 'annoyed', 'doesn\'t work', 'broken', 'stupid'];

    const words = content.split(' ');
    
    if (words.some(_word => frustrationWords.some(fw => content.includes(fw)))) {
      return 'frustrated';
    }
    if (words.some(_word => confusionWords.some(cw => content.includes(cw)))) {
      return 'confused';
    }
    if (words.some(word => positiveWords.includes(word))) {
      return 'positive';
    }
    if (words.some(word => negativeWords.includes(word))) {
      return 'negative';
    }
    
    return 'neutral';
  }

  private analyzeComplexity(content: string): 'basic' | 'intermediate' | 'advanced' {
    const basicPhrases = ['what is', 'how do i', 'new to', 'don\'t know', 'explain'];
    const advancedPhrases = ['expected value', 'roi', 'kelly criterion', 'variance', 'closing line'];
    
    if (advancedPhrases.some(phrase => content.includes(phrase))) {
      return 'advanced';
    }
    if (basicPhrases.some(phrase => content.includes(phrase))) {
      return 'basic';
    }
    
    return 'intermediate';
  }

  private analyzeUrgency(content: string, _timestamp: number): 'low' | 'medium' | 'high' {
    const urgentWords = ['urgent', 'asap', 'quickly', 'immediate', 'help', 'stuck'];
    const isUrgent = urgentWords.some(word => content.includes(word));
    
    // Check if repeated similar messages (indicates urgency)
    const isRepeated = false; // Would implement based on recent history
    
    if (isUrgent || isRepeated) {
      return 'high';
    }
    
    return 'low';
  }

  private categorizeTopics(content: string): string[] {
    const categories: string[] = [];
    
    const topicMap = {
      'betting': ['bet', 'wager', 'stake', 'bankroll'],
      'picks': ['pick', 'prediction', 'tip', 'play'],
      'analysis': ['analysis', 'stats', 'data', 'research'],
      'technical': ['error', 'bug', 'not working', 'broken'],
      'account': ['account', 'subscription', 'upgrade', 'tier'],
      'learning': ['learn', 'understand', 'explain', 'tutorial']
    };

    for (const [category, keywords] of Object.entries(topicMap)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        categories.push(category);
      }
    }

    return categories.length > 0 ? categories : ['general'];
  }

  private extractQuestions(content: string): any[] {
    const questionPatterns = [
      /what (is|are|does|do)\b/gi,
      /how (do|does|can|to)\b/gi,
      /why (is|are|does|do)\b/gi,
      /when (is|are|does|do)\b/gi,
      /where (is|are|can)\b/gi
    ];

    const questions: any[] = [];
    
    questionPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          questions.push({
            question: match,
            category: this.categorizeQuestion(match),
            confidence: 0.8,
            previouslyAsked: false // Would check against history
          });
        });
      }
    });

    return questions;
  }

  private detectFrustration(content: string): FrustrationSignal[] {
    const frustrationIndicators = [
      { pattern: /doesn't work|not working|broken/gi, type: 'technical_issue' as const },
      { pattern: /don't understand|confused|lost/gi, type: 'confusion' as const },
      { pattern: /stupid|dumb|ridiculous/gi, type: 'impatience' as const },
      { pattern: /too hard|difficult|complicated/gi, type: 'difficulty' as const }
    ];

    const signals: FrustrationSignal[] = [];

    frustrationIndicators.forEach(indicator => {
      const matches = content.match(indicator.pattern);
      if (matches) {
        signals.push({
          type: indicator.type,
          severity: matches.length > 1 ? 'high' : 'medium',
          indicators: matches,
          timeframe: 'immediate'
        });
      }
    });

    return signals;
  }

  private detectLearning(content: string): LearningSignal[] {
    const learningIndicators = [
      { pattern: /understand|got it|makes sense/gi, level: 'good' as const },
      { pattern: /thanks|helpful|clear/gi, level: 'excellent' as const },
      { pattern: /still confused|not sure/gi, level: 'poor' as const }
    ];

    const signals: LearningSignal[] = [];

    learningIndicators.forEach(indicator => {
      const matches = content.match(indicator.pattern);
      if (matches) {
        signals.push({
          concept: 'general_understanding',
          understanding: indicator.level,
          progression: indicator.level === 'good' || indicator.level === 'excellent' ? 'normal' : 'stuck',
          needsReinforcement: indicator.level === 'poor'
        });
      }
    });

    return signals;
  }

  private detectConversionSignals(content: string): ConversionSignal[] {
    const conversionIndicators = [
      { pattern: /upgrade|premium|vip/gi, type: 'interest' as const },
      { pattern: /price|cost|how much/gi, type: 'value_recognition' as const },
      { pattern: /trust|reliable|proven/gi, type: 'trust_building' as const },
      { pattern: /ready|want to|let's do it/gi, type: 'ready_to_upgrade' as const }
    ];

    const signals: ConversionSignal[] = [];

    conversionIndicators.forEach(indicator => {
      const matches = content.match(indicator.pattern);
      if (matches) {
        signals.push({
          type: indicator.type,
          strength: matches.length > 1 ? 'strong' : 'moderate',
          timing: 'optimal', // Would be calculated based on user journey
          barriers: [] // Would identify from context
        });
      }
    });

    return signals;
  }

  // Storage and Context Methods
  private async storeBehaviorEvent(userId: string, event: BehaviorEvent): Promise<void> {
    const events = this.behaviorPatterns.get(userId) || [];
    events.push(event);
    
    // Keep only last 100 events per user
    if (events.length > 100) {
      events.splice(0, events.length - 100);
    }
    
    this.behaviorPatterns.set(userId, events);
    
    // Cache recent events
    await redisCache.set(
      `behavior:${userId}:recent`,
      JSON.stringify(events.slice(-10)), // Last 10 events
      1800 // 30 minutes TTL
    );
  }

  private async getEventContext(userId: string, sourceEvent: any): Promise<any> {
    const recentEvents = this.behaviorPatterns.get(userId)?.slice(-5) || [];
    
    return {
      channel: sourceEvent.channelId || sourceEvent.channel?.id,
      messageId: sourceEvent.id,
      previousActivity: recentEvents,
      sessionDuration: this.calculateSessionDuration(recentEvents),
      timeSinceLastActivity: this.calculateTimeSinceLastActivity(recentEvents)
    };
  }

  // Calculation Helper Methods
  private calculateActivityLevel(events: BehaviorEvent[]): number {
    return Math.min(events.length / 10, 1); // Normalize to 0-1
  }

  private calculateEngagementTrend(events: BehaviorEvent[]): 'increasing' | 'stable' | 'decreasing' {
    if (events.length < 3) return 'stable';
    
    const recent = events.slice(-3);
    const older = events.slice(-6, -3);
    
    const recentAvg = recent.length;
    const olderAvg = older.length;
    
    if (recentAvg > olderAvg * 1.2) return 'increasing';
    if (recentAvg < olderAvg * 0.8) return 'decreasing';
    return 'stable';
  }

  private calculateLearningVelocity(events: BehaviorEvent[]): number {
    const learningEvents = events.filter(e => 
      e.analysis.learningIndicators.length > 0
    );
    return learningEvents.length / Math.max(events.length, 1);
  }

  private calculateFrustrationLevel(events: BehaviorEvent[]): number {
    const frustrationEvents = events.filter(e => 
      e.analysis.frustrationIndicators.length > 0
    );
    return frustrationEvents.length / Math.max(events.length, 1);
  }

  private calculateConversionReadiness(events: BehaviorEvent[]): number {
    const conversionEvents = events.filter(e => 
      e.analysis.conversionSignals.length > 0
    );
    return conversionEvents.length / Math.max(events.length, 1);
  }

  private analyzeResponsePatterns(events: BehaviorEvent[]): any {
    const messagePairs = [];
    for (let i = 1; i < events.length; i++) {
      if (events[i].eventType === 'message' && events[i-1].eventType === 'message') {
        const timeDiff = events[i].timestamp.getTime() - events[i-1].timestamp.getTime();
        messagePairs.push(timeDiff);
      }
    }
    
    if (messagePairs.length === 0) {
      return { averageResponseTime: 0, consistency: 0 };
    }
    
    const avgResponseTime = messagePairs.reduce((a, b) => a + b, 0) / messagePairs.length;
    const variance = messagePairs.reduce((a, b) => a + Math.pow(b - avgResponseTime, 2), 0) / messagePairs.length;
    const consistency = 1 / (1 + Math.sqrt(variance) / avgResponseTime);
    
    return {
      averageResponseTime: avgResponseTime / 1000, // Convert to seconds
      consistency
    };
  }

  private identifyPeakTimes(events: BehaviorEvent[]): number[] {
    const hourCounts: Record<number, number> = {};
    
    events.forEach(event => {
      const hour = event.timestamp.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const maxCount = Math.max(...Object.values(hourCounts));
    return Object.entries(hourCounts)
      .filter(([_, count]) => count >= maxCount * 0.7)
      .map(([hour, _]) => parseInt(hour));
  }

  private calculateSessionDuration(events: BehaviorEvent[]): number {
    if (events.length < 2) return 0;
    
    const start = events[0].timestamp.getTime();
    const end = events[events.length - 1].timestamp.getTime();
    return (end - start) / 1000; // Return in seconds
  }

  private calculateTimeSinceLastActivity(events: BehaviorEvent[]): number {
    if (events.length === 0) return Infinity;
    
    const lastEvent = events[events.length - 1];
    return (Date.now() - lastEvent.timestamp.getTime()) / 1000; // Return in seconds
  }

  // Helper Methods
  private categorizeQuestion(question: string): 'basic' | 'advanced' | 'technical' | 'procedural' {
    if (question.includes('how') || question.includes('what')) {
      return 'basic';
    }
    return 'procedural';
  }

  private analyzeInteractionComplexity(interaction: any): 'basic' | 'intermediate' | 'advanced' {
    if (interaction.customId?.includes('advanced')) return 'advanced';
    if (interaction.customId?.includes('tutorial')) return 'basic';
    return 'intermediate';
  }

  private categorizeInteractionTopics(interaction: any): string[] {
    const customId = interaction.customId || '';
    if (customId.includes('onboarding')) return ['onboarding'];
    if (customId.includes('picks')) return ['picks'];
    if (customId.includes('upgrade')) return ['account'];
    return ['general'];
  }

  private detectInteractionLearning(interaction: any): LearningSignal[] {
    if (interaction.customId?.includes('understood')) {
      return [{
        concept: 'interaction_learning',
        understanding: 'good',
        progression: 'normal',
        needsReinforcement: false
      }];
    }
    return [];
  }

  private detectInteractionConversion(interaction: any): ConversionSignal[] {
    if (interaction.customId?.includes('upgrade') || interaction.customId?.includes('premium')) {
      return [{
        type: 'interest',
        strength: 'strong',
        timing: 'optimal',
        barriers: []
      }];
    }
    return [];
  }

  private getDefaultAnalysis(): MessageAnalysis {
    return {
      sentiment: 'neutral',
      complexity: 'basic',
      urgency: 'low',
      topicCategories: ['general'],
      questions: [],
      frustrationIndicators: [],
      learningIndicators: [],
      conversionSignals: []
    };
  }

  private getDefaultPatternAnalysis(): any {
    return {
      activityLevel: 0,
      engagementTrend: 'stable',
      learningVelocity: 0,
      frustrationLevel: 0,
      conversionReadiness: 0,
      responsePatterns: { averageResponseTime: 0, consistency: 0 },
      peakActivityTimes: []
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Check if we can access cache
      await redisCache.get('health_check');
      return true;
    } catch {
      return false;
    }
  }

  async recordBehavior(data: {
    userId: string;
    action: string;
    metadata: any;
    timestamp: Date;
  }): Promise<string> {
    const behaviorId = `behavior_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create behavior event
    const behaviorEvent = {
      userId: data.userId,
      timestamp: data.timestamp,
      eventType: 'action' as const,
      eventData: {
        action: data.action,
        metadata: data.metadata
      },
      analysis: this.getDefaultAnalysis(),
      context: await this.getEventContext(data.userId, data)
    };

    // Store the behavior event
    await this.storeBehaviorEvent(data.userId, behaviorEvent);
    
    this.logger.info('📊 Behavior recorded', { 
      userId: data.userId, 
      action: data.action,
      behaviorId 
    });

    return behaviorId;
  }

  async cleanup(): Promise<void> {
    this.activeTracking.clear();
    this.behaviorPatterns.clear();
    this.logger.info('🧹 BehaviorTracker cleanup completed');
  }
}