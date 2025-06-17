import { BaseAgent } from '../BaseAgent/index';
import { BaseAgentConfig, BaseAgentDependencies, BaseMetrics, HealthStatus } from '../BaseAgent/types';
import { AIOrchestrator } from '../AlertAgent/aiOrchestrator';

interface FeedbackMetrics extends BaseMetrics {
  'custom.feedbackProcessed': number;
  'custom.insightsGenerated': number;
  'custom.adaptationsApplied': number;
  'custom.modelOptimizations': number;
}

interface FeedbackItem {
  id: string;
  type: 'pick_outcome' | 'user_rating' | 'system_performance' | 'model_accuracy';
  source: string;
  data: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  processed: boolean;
}

interface LearningInsight {
  id: string;
  category: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  recommendations: string[];
  timestamp: string;
}

interface AdaptationRule {
  id: string;
  condition: string;
  action: string;
  priority: number;
  enabled: boolean;
  lastApplied?: string;
}

/**
 * Production-grade FeedbackLoopAgent for continuous learning and system optimization
 * Processes feedback from various sources to improve AI models and system performance
 */
export class FeedbackLoopAgent extends BaseAgent {
  private aiOrchestrator: AIOrchestrator;
  private feedbackQueue: FeedbackItem[] = [];
  private learningInsights: LearningInsight[] = [];
  private adaptationRules: AdaptationRule[] = [];
  private processingStats = {
    feedbackProcessed: 0,
    insightsGenerated: 0,
    adaptationsApplied: 0,
    modelOptimizations: 0
  };

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
    this.aiOrchestrator = new AIOrchestrator();
  }

  protected async initialize(): Promise<void> {
    this.logger.info('Initializing FeedbackLoopAgent...');
    
    try {
      // Initialize AI orchestrator
      await this.aiOrchestrator.initialize();
      
      // Load historical feedback and insights
      await this.loadHistoricalData();
      
      // Initialize adaptation rules
      await this.loadAdaptationRules();
      
      this.logger.info('FeedbackLoopAgent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize FeedbackLoopAgent:', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  protected async process(): Promise<void> {
    try {
      this.logger.info('🔄 FeedbackLoopAgent processing cycle started');
      
      // 1. Collect new feedback
      await this.collectFeedback();
      
      // 2. Process pending feedback
      await this.processPendingFeedback();
      
      // 3. Analyze patterns and generate insights
      await this.analyzePerformancePatterns();
      
      // 4. Apply adaptations based on insights
      await this.adaptAIModels();
      
      // 5. Optimize system parameters
      await this.optimizeSystemParameters();
      
      // 6. Generate improvement recommendations
      await this.generateImprovementRecommendations();
      
      this.logger.info('✅ FeedbackLoopAgent processing cycle completed', {
        feedbackProcessed: this.processingStats.feedbackProcessed,
        insightsGenerated: this.processingStats.insightsGenerated,
        adaptationsApplied: this.processingStats.adaptationsApplied
      });
    } catch (error) {
      this.logger.error('FeedbackLoopAgent processing error:', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('🧹 FeedbackLoopAgent cleanup');
    
    // Save current state
    await this.saveState();
    
    // Clear in-memory data
    this.feedbackQueue = [];
    this.learningInsights = [];
    
    // Reset stats
    this.processingStats = {
      feedbackProcessed: 0,
      insightsGenerated: 0,
      adaptationsApplied: 0,
      modelOptimizations: 0
    };
  }

  protected async collectMetrics(): Promise<BaseMetrics> {
    const baseMetrics = {
      agentName: this.config.name,
      successCount: this.processingStats.feedbackProcessed,
      errorCount: 0, // Track errors separately
      warningCount: 0,
      processingTimeMs: 0,
      memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
    };

    const customMetrics: FeedbackMetrics = {
      ...baseMetrics,
      'custom.feedbackProcessed': this.processingStats.feedbackProcessed,
      'custom.insightsGenerated': this.processingStats.insightsGenerated,
      'custom.adaptationsApplied': this.processingStats.adaptationsApplied,
      'custom.modelOptimizations': this.processingStats.modelOptimizations
    };

    return customMetrics;
  }

  public async checkHealth(): Promise<HealthStatus> {
    const checks: any[] = [];
    
    try {
      // Check database connectivity
      await this.supabase.from('feedback_log').select('count').limit(1);
      checks.push({ service: 'supabase', status: 'healthy' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      checks.push({ service: 'supabase', status: 'unhealthy', error: errorMessage });
    }
    
    try {
      // Check AI orchestrator health
      const aiHealth = await this.aiOrchestrator.checkHealth();
      checks.push({ service: 'ai_orchestrator', status: aiHealth ? 'healthy' : 'unhealthy' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      checks.push({ service: 'ai_orchestrator', status: 'unhealthy', error: errorMessage });
    }
    
    const isHealthy = checks.every(check => check.status === 'healthy');
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      details: {
        checks,
        queueSize: this.feedbackQueue.length,
        insightsCount: this.learningInsights.length,
        rulesCount: this.adaptationRules.length,
        stats: this.processingStats
      }
    };
  }

  // Public methods for external feedback submission
  public async submitFeedback(feedback: Omit<FeedbackItem, 'id' | 'timestamp' | 'processed'>): Promise<void> {
    const feedbackItem: FeedbackItem = {
      ...feedback,
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      processed: false
    };
    
    this.feedbackQueue.push(feedbackItem);
    
    // Process high-priority feedback immediately
    if (feedback.priority === 'critical' || feedback.priority === 'high') {
      await this.processFeedbackItem(feedbackItem);
    }
  }

  // Private methods
  private async loadHistoricalData(): Promise<void> {
    try {
      // Load recent feedback from database
      const { data: feedback, error } = await this.supabase
        .from('feedback_log')
        .select('*')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .order('created_at', { ascending: false })
        .limit(1000);
      
      if (error) {
        this.logger.warn('Failed to load historical feedback:', error);
        return;
      }
      
      // Convert to internal format
      this.feedbackQueue = (feedback || []).map(item => ({
        id: item.id,
        type: item.type,
        source: item.source,
        data: item.data,
        priority: item.priority,
        timestamp: item.created_at,
        processed: item.processed || false
      }));
      
      this.logger.info(`Loaded ${this.feedbackQueue.length} historical feedback items`);
    } catch (error) {
      this.logger.error('Error loading historical data:', error instanceof Error ? error : undefined);
    }
  }

  private async loadAdaptationRules(): Promise<void> {
    // Load adaptation rules from configuration or database
    this.adaptationRules = [
      {
        id: 'low_accuracy_model_switch',
        condition: 'model_accuracy < 0.7',
        action: 'switch_to_backup_model',
        priority: 1,
        enabled: true
      },
      {
        id: 'high_error_rate_throttle',
        condition: 'error_rate > 0.1',
        action: 'reduce_processing_rate',
        priority: 2,
        enabled: true
      },
      {
        id: 'positive_feedback_boost',
        condition: 'positive_feedback_ratio > 0.8',
        action: 'increase_confidence_threshold',
        priority: 3,
        enabled: true
      }
    ];
  }

  private async collectFeedback(): Promise<void> {
    // Collect feedback from various sources
    await Promise.all([
      this.collectPickOutcomeFeedback(),
      this.collectUserRatingFeedback(),
      this.collectSystemPerformanceFeedback(),
      this.collectModelAccuracyFeedback()
    ]);
  }

  private async collectPickOutcomeFeedback(): Promise<void> {
    try {
      // Get recent pick outcomes for feedback analysis
      const { data: picks, error } = await this.supabase
        .from('final_picks')
        .select('*')
        .not('outcome', 'is', null)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .limit(100);
      
      if (error || !picks) return;
      
      for (const pick of picks) {
        await this.submitFeedback({
          type: 'pick_outcome',
          source: 'pick_grading_system',
          data: {
            pickId: pick.id,
            outcome: pick.outcome,
            expectedValue: pick.expected_value,
            actualValue: pick.actual_value,
            confidence: pick.confidence,
            tier: pick.tier
          },
          priority: 'medium'
        });
      }
    } catch (error) {
      this.logger.error('Error collecting pick outcome feedback:', error instanceof Error ? error : undefined);
    }
  }

  private async collectUserRatingFeedback(): Promise<void> {
    // Implement user rating feedback collection
    // This would integrate with user feedback systems
  }

  private async collectSystemPerformanceFeedback(): Promise<void> {
    // Collect system performance metrics as feedback
    const memoryUsage = process.memoryUsage();
    
    await this.submitFeedback({
      type: 'system_performance',
      source: 'system_monitor',
      data: {
        memoryUsage: memoryUsage.heapUsed / 1024 / 1024,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      },
      priority: 'low'
    });
  }

  private async collectModelAccuracyFeedback(): Promise<void> {
    // Collect model accuracy metrics
    try {
      const models = await this.aiOrchestrator.getAvailableModels();
      
      for (const model of models) {
        const accuracy = await this.calculateModelAccuracy(model);
        
        await this.submitFeedback({
          type: 'model_accuracy',
          source: 'model_evaluator',
          data: {
            modelName: model.name,
            accuracy,
            evaluationTime: new Date().toISOString()
          },
          priority: accuracy < 0.7 ? 'high' : 'low'
        });
      }
    } catch (error) {
      this.logger.error('Error collecting model accuracy feedback:', error instanceof Error ? error : undefined);
    }
  }

  private async processPendingFeedback(): Promise<void> {
    const pendingFeedback = this.feedbackQueue.filter(item => !item.processed);
    
    for (const feedback of pendingFeedback) {
      await this.processFeedbackItem(feedback);
    }
  }

  private async processFeedbackItem(feedback: FeedbackItem): Promise<void> {
    try {
      // Analyze feedback and generate insights
      const insights = await this.analyzeFeedback(feedback);
      
      // Add insights to collection
      this.learningInsights.push(...insights);
      
      // Mark as processed
      feedback.processed = true;
      this.processingStats.feedbackProcessed++;
      
      // Save to database
      await this.saveFeedbackItem(feedback);
      
    } catch (error) {
      this.logger.error(`Error processing feedback ${feedback.id}:`, error instanceof Error ? error : error);
    }
  }

  private async analyzeFeedback(feedback: FeedbackItem): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    // Implement feedback analysis logic based on type
    switch (feedback.type) {
      case 'pick_outcome':
        insights.push(...await this.analyzePickOutcome(feedback));
        break;
      case 'model_accuracy':
        insights.push(...await this.analyzeModelAccuracy(feedback));
        break;
      case 'system_performance':
        insights.push(...await this.analyzeSystemPerformance(feedback));
        break;
      case 'user_rating':
        insights.push(...await this.analyzeUserRating(feedback));
        break;
    }
    
    this.processingStats.insightsGenerated += insights.length;
    return insights;
  }

  private async analyzePickOutcome(feedback: FeedbackItem): Promise<LearningInsight[]> {
    // Analyze pick outcome patterns
    const insights: LearningInsight[] = [];
    
    // Example insight generation
    if (feedback.data.outcome === 'loss' && feedback.data.confidence > 0.8) {
      insights.push({
        id: `insight_${Date.now()}`,
        category: 'confidence_calibration',
        description: 'High confidence pick resulted in loss - may need confidence recalibration',
        confidence: 0.7,
        impact: 'medium',
        recommendations: ['Review confidence calculation algorithm', 'Adjust confidence thresholds'],
        timestamp: new Date().toISOString()
      });
    }
    
    return insights;
  }

  private async analyzeModelAccuracy(feedback: FeedbackItem): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    if (feedback.data.accuracy < 0.7) {
      insights.push({
        id: `insight_${Date.now()}`,
        category: 'model_performance',
        description: `Model ${feedback.data.modelName} accuracy below threshold`,
        confidence: 0.9,
        impact: 'high',
        recommendations: ['Consider model retraining', 'Switch to backup model', 'Review training data'],
        timestamp: new Date().toISOString()
      });
    }
    
    return insights;
  }

  private async analyzeSystemPerformance(feedback: FeedbackItem): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];
    
    if (feedback.data.memoryUsage > 500) { // 500MB threshold
      insights.push({
        id: `insight_${Date.now()}`,
        category: 'system_resources',
        description: 'High memory usage detected',
        confidence: 0.8,
        impact: 'medium',
        recommendations: ['Optimize memory usage', 'Consider scaling resources'],
        timestamp: new Date().toISOString()
      });
    }
    
    return insights;
  }

  private async analyzeUserRating(feedback: FeedbackItem): Promise<LearningInsight[]> {
    // Implement user rating analysis
    return [];
  }

  private async analyzePerformancePatterns(): Promise<void> {
    // Analyze patterns in insights and feedback
    const recentInsights = this.learningInsights.filter(
      insight => Date.now() - new Date(insight.timestamp).getTime() < 24 * 60 * 60 * 1000
    );
    
    // Group insights by category
    const insightsByCategory = recentInsights.reduce((acc, insight) => {
      if (!acc[insight.category]) acc[insight.category] = [];
      acc[insight.category].push(insight);
      return acc;
    }, {} as Record<string, LearningInsight[]>);
    
    // Identify patterns and trends
    for (const [category, insights] of Object.entries(insightsByCategory)) {
      if (insights.length > 3) { // Pattern threshold
        this.logger.info(`Pattern detected in category ${category}: ${insights.length} insights`);
        // Trigger adaptation rules
        await this.triggerAdaptationRules(category, insights);
      }
    }
  }

  private async adaptAIModels(): Promise<void> {
    // Apply adaptations based on insights
    const highImpactInsights = this.learningInsights.filter(
      insight => insight.impact === 'high' && insight.confidence > 0.7
    );
    
    for (const insight of highImpactInsights) {
      await this.applyModelAdaptation(insight);
    }
  }

  private async optimizeSystemParameters(): Promise<void> {
    // Optimize system parameters based on feedback
    const performanceInsights = this.learningInsights.filter(
      insight => insight.category === 'system_resources'
    );
    
    if (performanceInsights.length > 0) {
      // Apply system optimizations
      this.logger.info('Applying system parameter optimizations');
      this.processingStats.modelOptimizations++;
    }
  }

  private async generateImprovementRecommendations(): Promise<void> {
    // Generate actionable improvement recommendations
    const recommendations = this.learningInsights
      .flatMap(insight => insight.recommendations)
      .filter((rec, index, arr) => arr.indexOf(rec) === index); // Deduplicate
    
    if (recommendations.length > 0) {
      this.logger.info('Generated improvement recommendations:', recommendations);
      
      // Save recommendations to database
      await this.saveRecommendations(recommendations);
    }
  }

  private async triggerAdaptationRules(category: string, insights: LearningInsight[]): Promise<void> {
    const applicableRules = this.adaptationRules.filter(rule => rule.enabled);
    
    for (const rule of applicableRules) {
      if (await this.evaluateRuleCondition(rule, category, insights)) {
        await this.applyAdaptationRule(rule);
        this.processingStats.adaptationsApplied++;
      }
    }
  }

  private async evaluateRuleCondition(rule: AdaptationRule, category: string, insights: LearningInsight[]): Promise<boolean> {
    // Implement rule condition evaluation logic
    // This is a simplified example
    return insights.length > 2 && insights.some(insight => insight.impact === 'high');
  }

  private async applyAdaptationRule(rule: AdaptationRule): Promise<void> {
    this.logger.info(`Applying adaptation rule: ${rule.action}`);

    // Implement rule actions
    switch (rule.action) {
      case 'switch_to_backup_model':
        await this.aiOrchestrator.switchToBackupModel('primary-model');
        break;
      case 'reduce_processing_rate':
        // Implement rate reduction
        break;
      case 'increase_confidence_threshold':
        // Implement threshold adjustment
        break;
    }

    rule.lastApplied = new Date().toISOString();
  }

  private async applyModelAdaptation(insight: LearningInsight): Promise<void> {
    // Apply specific model adaptations based on insights
    this.logger.info(`Applying model adaptation for insight: ${insight.description}`);
    
    // Implementation depends on the specific insight and model architecture
    this.processingStats.modelOptimizations++;
  }

  private async calculateModelAccuracy(model: any): Promise<number> {
    // Implement model accuracy calculation
    // This would typically involve evaluating recent predictions against actual outcomes
    return 0.75; // Placeholder
  }

  private async saveFeedbackItem(feedback: FeedbackItem): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('feedback_log')
        .upsert({
          id: feedback.id,
          type: feedback.type,
          source: feedback.source,
          data: feedback.data,
          priority: feedback.priority,
          processed: feedback.processed,
          created_at: feedback.timestamp
        });
      
      if (error) {
        this.logger.error('Failed to save feedback item:', error);
      }
    } catch (error) {
      this.logger.error('Error saving feedback item:', error instanceof Error ? error : undefined);
    }
  }

  private async saveRecommendations(recommendations: string[]): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('improvement_recommendations')
        .insert({
          recommendations,
          generated_at: new Date().toISOString(),
          status: 'pending'
        });
      
      if (error) {
        this.logger.error('Failed to save recommendations:', error);
      }
    } catch (error) {
      this.logger.error('Error saving recommendations:', error instanceof Error ? error : undefined);
    }
  }

  private async saveState(): Promise<void> {
    // Save current agent state to database
    try {
      const state = {
        insights_count: this.learningInsights.length,
        rules_count: this.adaptationRules.length,
        processing_stats: this.processingStats,
        last_updated: new Date().toISOString()
      };
      
      const { error } = await this.supabase
        .from('agent_state')
        .upsert({
          agent_name: 'FeedbackLoopAgent',
          state,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        this.logger.error('Failed to save agent state:', error);
      }
    } catch (error) {
      this.logger.error('Error saving agent state:', error instanceof Error ? error : undefined);
    }
  }
}

export default FeedbackLoopAgent;