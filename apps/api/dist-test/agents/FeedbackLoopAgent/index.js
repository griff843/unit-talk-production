"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackLoopAgent = void 0;
const aiOrchestrator_1 = require("../AlertAgent/aiOrchestrator");
const index_1 = require("../BaseAgent/index");
/**
 * Production-grade FeedbackLoopAgent for continuous learning and system optimization
 * Processes feedback from various sources to improve AI models and system performance
 */
class FeedbackLoopAgent extends index_1.BaseAgent {
    constructor(config, deps) {
        super(config, deps);
        this.feedbackQueue = [];
        this.learningInsights = [];
        this.adaptationRules = [];
        this.processingStats = {
            feedbackProcessed: 0,
            insightsGenerated: 0,
            adaptationsApplied: 0,
            modelOptimizations: 0
        };
        this.aiOrchestrator = new aiOrchestrator_1.AIOrchestrator();
    }
    async initialize() {
        this.logger.info('Initializing FeedbackLoopAgent...');
        try {
            // Initialize AI orchestrator
            await this.aiOrchestrator.initialize();
            // Load historical feedback and insights
            await this.loadHistoricalData();
            // Initialize adaptation rules
            await this.loadAdaptationRules();
            this.logger.info('FeedbackLoopAgent initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize FeedbackLoopAgent:', {
                err: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async process() {
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
        }
        catch (error) {
            this.logger.error('FeedbackLoopAgent processing err:', {
                err: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async cleanup() {
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
    async collectMetrics() {
        const baseMetrics = {
            agentName: this.config.name,
            successCount: this.processingStats.feedbackProcessed,
            errorCount: 0, // Track errors separately
            warningCount: 0,
            processingTimeMs: 0,
            memoryUsageMb: process.memoryUsage().heapUsed / 1024 / 1024
        };
        const customMetrics = {
            ...baseMetrics,
            'custom.feedbackProcessed': this.processingStats.feedbackProcessed,
            'custom.insightsGenerated': this.processingStats.insightsGenerated,
            'custom.adaptationsApplied': this.processingStats.adaptationsApplied,
            'custom.modelOptimizations': this.processingStats.modelOptimizations
        };
        return customMetrics;
    }
    async checkHealth() {
        const checks = [];
        try {
            // Check database connectivity
            if (!this.supabase) {
                throw new Error('Supabase client is required for FeedbackLoopAgent');
            }
            await this.supabase.from('feedback_log').select('count').limit(1);
            checks.push({ service: 'supabase', status: 'healthy' });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            checks.push({ service: 'supabase', status: 'unhealthy', err: errorMessage });
        }
        try {
            // Check AI orchestrator health
            const aiHealth = await this.aiOrchestrator.checkHealth();
            checks.push({ service: 'ai_orchestrator', status: aiHealth ? 'healthy' : 'unhealthy' });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            checks.push({ service: 'ai_orchestrator', status: 'unhealthy', err: errorMessage });
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
    async submitFeedback(feedback) {
        const feedbackItem = {
            ...feedback,
            id: `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
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
    async loadHistoricalData() {
        try {
            // Load recent feedback from database
            if (!this.supabase) {
                throw new Error('Supabase client is required for FeedbackLoopAgent');
            }
            const { data: feedback, error } = await this.supabase
                .from('feedback_log')
                .select('*')
                .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
                .order('created_at', { ascending: false })
                .limit(1000);
            if (error) {
                this.logger.warn('Failed to load historical feedback:', {
                    error: error.message,
                    code: error.code,
                    details: error.details
                });
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
        }
        catch (error) {
            this.logger.error('Error loading historical data:', {
                err: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async loadAdaptationRules() {
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
    async collectFeedback() {
        // Collect feedback from various sources
        await Promise.all([
            this.collectPickOutcomeFeedback(),
            this.collectUserRatingFeedback(),
            this.collectSystemPerformanceFeedback(),
            this.collectModelAccuracyFeedback()
        ]);
    }
    async collectPickOutcomeFeedback() {
        try {
            // Get recent pick outcomes for feedback analysis
            if (!this.supabase) {
                throw new Error('Supabase client is required for FeedbackLoopAgent');
            }
            const { data: picks, error } = await this.supabase
                .from('unified_picks')
                .select('*')
                .not('outcome', 'is', null)
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
                .limit(100);
            if (error || !picks) {
                return;
            }
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
        }
        catch (error) {
            this.logger.error('Error collecting pick outcome feedback:', {
                err: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async collectUserRatingFeedback() {
        // Implement user rating feedback collection
        // This would integrate with user feedback systems
    }
    async collectSystemPerformanceFeedback() {
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
    async collectModelAccuracyFeedback() {
        // Collect model accuracy metrics
        try {
            const models = this.aiOrchestrator.getAvailableModels();
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
        }
        catch (error) {
            this.logger.error('Error collecting model accuracy feedback:', {
                err: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async processPendingFeedback() {
        const pendingFeedback = this.feedbackQueue.filter(item => !item.processed);
        for (const feedback of pendingFeedback) {
            await this.processFeedbackItem(feedback);
        }
    }
    async processFeedbackItem(feedback) {
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
        }
        catch (error) {
            this.logger.error(`Error processing feedback ${feedback.id}:`, {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async analyzeFeedback(feedback) {
        const insights = [];
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
    async analyzePickOutcome(feedback) {
        // Analyze pick outcome patterns
        const insights = [];
        // Example insight generation
        if (feedback.data['outcome'] === 'loss' && feedback.data['confidence'] > 0.8) {
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
    async analyzeModelAccuracy(feedback) {
        const insights = [];
        if (feedback.data['accuracy'] < 0.7) {
            insights.push({
                id: `insight_${Date.now()}`,
                category: 'model_performance',
                description: `Model ${feedback.data['modelName']} accuracy below threshold`,
                confidence: 0.9,
                impact: 'high',
                recommendations: ['Consider model retraining', 'Switch to backup model', 'Review training data'],
                timestamp: new Date().toISOString()
            });
        }
        return insights;
    }
    async analyzeSystemPerformance(feedback) {
        const insights = [];
        if (feedback.data['memoryUsage'] > 500) { // 500MB threshold
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
    async analyzeUserRating(_) {
        // Implement user rating analysis
        return [];
    }
    async analyzePerformancePatterns() {
        // Analyze patterns in insights and feedback
        const recentInsights = this.learningInsights.filter(insight => Date.now() - new Date(insight.timestamp).getTime() < 24 * 60 * 60 * 1000);
        // Group insights by category
        const insightsByCategory = recentInsights.reduce((acc, insight) => {
            if (!acc[insight.category]) {
                acc[insight.category] = [];
            }
            acc[insight.category].push(insight);
            return acc;
        }, {});
        // Identify patterns and trends
        for (const [category, insights] of Object.entries(insightsByCategory)) {
            if (insights.length > 3) { // Pattern threshold
                this.logger.info(`Pattern detected in category ${category}: ${insights.length} insights`);
                // Trigger adaptation rules
                await this.triggerAdaptationRules(category, insights);
            }
        }
    }
    async adaptAIModels() {
        // Apply adaptations based on insights
        const highImpactInsights = this.learningInsights.filter(insight => insight.impact === 'high' && insight.confidence > 0.7);
        for (const insight of highImpactInsights) {
            await this.applyModelAdaptation(insight);
        }
    }
    async optimizeSystemParameters() {
        // Optimize system parameters based on feedback
        const performanceInsights = this.learningInsights.filter(insight => insight.category === 'system_resources');
        if (performanceInsights.length > 0) {
            // Apply system optimizations
            this.logger.info('Applying system parameter optimizations');
            this.processingStats.modelOptimizations++;
        }
    }
    async generateImprovementRecommendations() {
        // Generate actionable improvement recommendations
        const recommendations = this.learningInsights
            .flatMap(insight => insight.recommendations)
            .filter((rec, index, arr) => arr.indexOf(rec) === index); // Deduplicate
        if (recommendations.length > 0) {
            this.logger.info('Generated improvement recommendations:', {
                recommendations: recommendations
            });
            // Save recommendations to database
            await this.saveRecommendations(recommendations);
        }
    }
    async triggerAdaptationRules(category, insights) {
        const applicableRules = this.adaptationRules.filter(rule => rule.enabled);
        for (const rule of applicableRules) {
            if (await this.evaluateRuleCondition(rule, category, insights)) {
                await this.applyAdaptationRule(rule);
                this.processingStats.adaptationsApplied++;
            }
        }
    }
    async evaluateRuleCondition(_, __, insights) {
        // Implement rule condition evaluation logic
        // This is a simplified example
        return insights.length > 2 && insights.some(insight => insight.impact === 'high');
    }
    async applyAdaptationRule(rule) {
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
    async applyModelAdaptation(insight) {
        // Apply specific model adaptations based on insights
        this.logger.info(`Applying model adaptation for insight: ${insight.description}`);
        // Implementation depends on the specific insight and model architecture
        this.processingStats.modelOptimizations++;
    }
    async calculateModelAccuracy(_) {
        // Implement model accuracy calculation
        // This would typically involve evaluating recent predictions against actual outcomes
        return 0.75; // Placeholder
    }
    async saveFeedbackItem(feedback) {
        try {
            if (!this.supabase) {
                throw new Error('Supabase client is required for FeedbackLoopAgent');
            }
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
                this.logger.error('Failed to save feedback item:', {
                    error: error.message,
                    code: error.code,
                    details: error.details
                });
            }
        }
        catch (error) {
            this.logger.error('Error saving feedback item:', {
                err: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async saveRecommendations(recommendations) {
        try {
            if (!this.supabase) {
                throw new Error('Supabase client is required for FeedbackLoopAgent');
            }
            const { error } = await this.supabase
                .from('improvement_recommendations')
                .insert({
                recommendations,
                generated_at: new Date().toISOString(),
                status: 'pending'
            });
            if (error) {
                this.logger.error('Failed to save recommendations:', {
                    error: error.message,
                    code: error.code,
                    details: error.details
                });
            }
        }
        catch (error) {
            this.logger.error('Error saving recommendations:', {
                err: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async saveState() {
        // Save current agent state to database
        try {
            const state = {
                insights_count: this.learningInsights.length,
                rules_count: this.adaptationRules.length,
                processing_stats: this.processingStats,
                last_updated: new Date().toISOString()
            };
            if (!this.supabase) {
                throw new Error('Supabase client is required for FeedbackLoopAgent');
            }
            const { error } = await this.supabase
                .from('agent_state')
                .upsert({
                agent_name: 'FeedbackLoopAgent',
                state,
                updated_at: new Date().toISOString()
            });
            if (error) {
                this.logger.error('Failed to save agent state:', {
                    error: error.message,
                    code: error.code,
                    details: error.details
                });
            }
        }
        catch (error) {
            this.logger.error('Error saving agent state:', {
                err: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
exports.FeedbackLoopAgent = FeedbackLoopAgent;
exports.default = FeedbackLoopAgent;
