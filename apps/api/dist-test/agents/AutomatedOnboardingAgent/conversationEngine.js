"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationEngine = void 0;
const enhanced_cache_1 = require("../../cache/enhanced-cache");
const enhanced_circuit_breaker_1 = require("../../services/enhanced-circuit-breaker");
class ConversationEngine {
    constructor(logger) {
        this.conversationTemplates = new Map();
        this.userContexts = new Map();
        this.logger = logger;
    }
    async initialize() {
        this.logger.info('💬 Initializing ConversationEngine');
        await this.loadConversationTemplates();
    }
    async sendWelcomeMessage(userId, userProfile) {
        this.logger.info('👋 Generating welcome message', { userId });
        const welcomeTemplate = this.getWelcomeTemplate(userProfile.experienceLevel);
        const personalizedMessage = {
            type: 'welcome',
            content: welcomeTemplate.content,
            embeds: [{
                    title: '🎯 Welcome to Unit Talk!',
                    description: welcomeTemplate.description,
                    color: 0x00ff00,
                    fields: [
                        {
                            name: '🤖 Your Personal Assistant',
                            value: 'I\'ll help you get the most out of our winning picks!',
                            inline: false
                        },
                        {
                            name: '📊 Quick Question',
                            value: 'How would you describe your sports betting experience?',
                            inline: false
                        }
                    ]
                }],
            components: [{
                    type: 1, // Action Row
                    components: [
                        {
                            type: 2, // Button
                            style: 3, // Success (Green)
                            label: '🟢 Completely New',
                            custom_id: 'onboarding_experience_beginner'
                        },
                        {
                            type: 2,
                            style: 2, // Secondary (Gray)
                            label: '🟡 Some Experience',
                            custom_id: 'onboarding_experience_intermediate'
                        },
                        {
                            type: 2,
                            style: 1, // Primary (Blue)
                            label: '🔴 Very Experienced',
                            custom_id: 'onboarding_experience_advanced'
                        }
                    ]
                }]
        };
        // Store conversation context
        await this.initializeConversationContext(userId, userProfile);
        return personalizedMessage;
    }
    async generateResponse(userId, message, behaviorAnalysis) {
        const context = this.userContexts.get(userId);
        if (!context) {
            this.logger.warn('No conversation context found', { userId });
            return null;
        }
        // Update conversation history
        await this.updateConversationHistory(userId, message, behaviorAnalysis);
        // Determine if response is needed
        const shouldRespond = await this.shouldGenerateResponse(context, behaviorAnalysis);
        if (!shouldRespond) {
            return null;
        }
        // Generate contextual response
        const response = await this.generateContextualResponse(context, behaviorAnalysis);
        this.logger.info('💬 Generated conversation response', {
            userId,
            responseType: response?.type,
            sentiment: behaviorAnalysis.sentiment
        });
        return response;
    }
    async generateInterventionResponse(userId, intervention) {
        this.logger.info('🚨 Generating intervention response', {
            userId,
            interventionType: intervention.type,
            urgency: intervention.urgency
        });
        const context = this.userContexts.get(userId);
        const template = this.getInterventionTemplate(intervention.type, intervention.urgency);
        let response;
        switch (intervention.type) {
            case 'confusion_help':
                response = await this.generateConfusionHelp(context, template);
                break;
            case 'engagement_boost':
                response = await this.generateEngagementBoost(context, template);
                break;
            case 'conversion_prompt':
                response = await this.generateConversionPrompt(context, template);
                break;
            case 'churn_prevention':
                response = await this.generateChurnPrevention(context, template);
                break;
            case 'learning_acceleration':
                response = await this.generateLearningAcceleration(context, template);
                break;
            default:
                response = this.getGenericInterventionResponse();
        }
        return response;
    }
    async generateConversionMessage(userId, userProfile) {
        if (userProfile.conversionLikelihood < 0.7) {
            return null; // Not ready for conversion
        }
        this.logger.info('💰 Generating conversion message', {
            userId,
            conversionLikelihood: userProfile.conversionLikelihood
        });
        const conversionStrategy = this.determineConversionStrategy(userProfile);
        const template = this.getConversionTemplate(conversionStrategy);
        const message = {
            type: 'conversion',
            content: template.content.replace('{userName}', `<@${userId}>`),
            embeds: [{
                    title: '🚀 Ready for the Next Level?',
                    description: template.description,
                    color: 0xffd700, // Gold
                    fields: template.benefits.map((benefit) => ({
                        name: benefit.title,
                        value: benefit.description,
                        inline: true
                    })),
                    footer: {
                        text: 'Limited time offer - upgrade today!'
                    }
                }],
            components: [{
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 3, // Success
                            label: '🎯 Start Free Trial',
                            custom_id: 'onboarding_conversion_trial'
                        },
                        {
                            type: 2,
                            style: 2, // Secondary
                            label: '📊 See Pricing',
                            custom_id: 'onboarding_conversion_pricing'
                        },
                        {
                            type: 2,
                            style: 4, // Danger
                            label: '⏰ Maybe Later',
                            custom_id: 'onboarding_conversion_later'
                        }
                    ]
                }]
        };
        return message;
    }
    async handleOnboardingFlow(userId, interaction) {
        const customId = interaction.customId;
        this.logger.info('🔄 Handling onboarding flow', {
            userId,
            customId
        });
        if (customId.startsWith('onboarding_experience_')) {
            return await this.handleExperienceSelection(userId, interaction);
        }
        if (customId.startsWith('onboarding_conversion_')) {
            return await this.handleConversionFlow(userId, interaction);
        }
        if (customId.startsWith('onboarding_tutorial_')) {
            return await this.handleTutorialFlow(userId, interaction);
        }
        return this.getGenericFlowResponse();
    }
    // Private Methods
    async loadConversationTemplates() {
        // Load templates from cache or create defaults
        const templates = {
            welcome: {
                beginner: {
                    content: "Welcome! I'll make sports betting simple for you.",
                    description: "Perfect! I'll explain everything in easy terms and help you get started safely."
                },
                intermediate: {
                    content: "Welcome! Ready to take your betting to the next level?",
                    description: "Great! I'll help you leverage our advanced analytics to improve your success rate."
                },
                advanced: {
                    content: "Welcome! Let's dive into our professional-grade analytics.",
                    description: "Excellent! I'll show you our sophisticated models and how to maximize your edge."
                }
            },
            confusion_help: {
                high: {
                    content: "I notice you might be having trouble. Let me help you right away!",
                    options: [
                        "🔄 Start over with basics",
                        "👨‍💻 Connect with human support",
                        "📚 Access tutorial library"
                    ]
                },
                medium: {
                    content: "No worries if this seems confusing - we'll take it step by step!",
                    options: [
                        "🎯 Explain differently",
                        "📖 Show examples",
                        "⏰ Take a break"
                    ]
                }
            },
            engagement_boost: {
                content: "Hey! I noticed you've been quiet. Here's what's happening today:",
                examples: [
                    "🎯 Today's free pick is crushing it!",
                    "📊 Check out our latest winning streak",
                    "💡 New tutorial just dropped"
                ]
            },
            conversion: {
                value_focused: {
                    content: "Based on your engagement, I think you're ready for premium features!",
                    benefits: [
                        { title: "📈 5x More Picks", description: "Get 8-12 daily picks vs 2" },
                        { title: "⚡ Live Alerts", description: "Real-time line movement notifications" },
                        { title: "🧠 Advanced Analysis", description: "Full model breakdown for each pick" }
                    ]
                },
                trust_focused: {
                    content: "You've seen our accuracy - ready to maximize your profits?",
                    benefits: [
                        { title: "✅ Proven Track Record", description: "67% win rate, +23% ROI" },
                        { title: "🔒 Risk Management", description: "Bankroll protection algorithms" },
                        { title: "📞 Expert Support", description: "Direct access to our cappers" }
                    ]
                }
            }
        };
        // Store templates
        for (const [category, template] of Object.entries(templates)) {
            this.conversationTemplates.set(category, template);
        }
        this.logger.info('✅ Conversation templates loaded');
    }
    getWelcomeTemplate(experienceLevel) {
        const welcomeTemplates = this.conversationTemplates.get('welcome');
        return welcomeTemplates?.[experienceLevel] || welcomeTemplates?.beginner;
    }
    getInterventionTemplate(type, urgency) {
        const interventionTemplates = this.conversationTemplates.get(type);
        return interventionTemplates?.[urgency] || interventionTemplates?.medium;
    }
    async initializeConversationContext(userId, userProfile) {
        const context = {
            userId,
            conversationHistory: [],
            currentTopic: 'welcome',
            userState: {
                onboardingStage: 'welcome',
                knowledgeLevel: userProfile.experienceLevel,
                goalProgress: {},
                lastInteraction: new Date()
            },
            goals: [
                {
                    id: 'complete_onboarding',
                    type: 'education',
                    priority: 1,
                    completed: false,
                    steps: [
                        { id: 'experience_assessment', description: 'Assess user experience', completed: false, nextSteps: [] },
                        { id: 'explain_basics', description: 'Explain core concepts', completed: false, nextSteps: [] },
                        { id: 'first_pick_tutorial', description: 'Show how picks work', completed: false, nextSteps: [] }
                    ]
                }
            ]
        };
        this.userContexts.set(userId, context);
        // Cache context
        await enhanced_cache_1.redisCache.set(`conversation:${userId}:context`, JSON.stringify(context), 3600 // 1 hour TTL
        );
    }
    async updateConversationHistory(userId, message, analysis) {
        const context = this.userContexts.get(userId);
        if (!context)
            return;
        context.conversationHistory.push({
            timestamp: new Date(),
            speaker: 'user',
            message: message.content?.substring(0, 200) || '', // Limit message length
            intent: analysis.topicCategories[0] || 'general',
            sentiment: analysis.sentiment
        });
        // Keep only last 20 conversation turns
        if (context.conversationHistory.length > 20) {
            context.conversationHistory = context.conversationHistory.slice(-20);
        }
        context.userState.lastInteraction = new Date();
        this.userContexts.set(userId, context);
    }
    async shouldGenerateResponse(context, analysis) {
        // Always respond to questions
        if (analysis.questions.length > 0)
            return true;
        // Respond to frustration
        if (analysis.frustrationIndicators.length > 0)
            return true;
        // Respond to conversion signals
        if (analysis.conversionSignals.length > 0)
            return true;
        // Check if user needs guidance based on context
        const timeSinceLastBot = this.getTimeSinceLastBotResponse(context);
        if (timeSinceLastBot > 300000) { // 5 minutes
            return true;
        }
        return false;
    }
    async generateContextualResponse(context, analysis) {
        // Handle questions
        if (analysis.questions.length > 0) {
            return await this.generateQuestionResponse(context, analysis.questions[0]);
        }
        // Handle frustration
        if (analysis.frustrationIndicators.length > 0) {
            return await this.generateFrustrationResponse(context, analysis.frustrationIndicators[0]);
        }
        // Handle learning signals
        if (analysis.learningIndicators.length > 0) {
            return await this.generateLearningResponse(context, analysis.learningIndicators[0]);
        }
        // Generate contextual guidance
        return await this.generateGuidanceResponse(context);
    }
    async generateConfusionHelp(_context, template) {
        return {
            type: 'confusion_help',
            content: template.content,
            embeds: [{
                    title: '🤝 Let me help you!',
                    description: 'No worries - everyone needs help sometimes. What would work best for you?',
                    color: 0x00bfff,
                    fields: template.options.map((option, index) => ({
                        name: `Option ${index + 1}`,
                        value: option,
                        inline: false
                    }))
                }],
            components: [{
                    type: 1,
                    components: template.options.slice(0, 3).map((option, index) => ({
                        type: 2,
                        style: 2,
                        label: option,
                        custom_id: `onboarding_help_${index}`
                    }))
                }]
        };
    }
    async generateEngagementBoost(_context, template) {
        return {
            type: 'engagement_boost',
            content: template.content,
            embeds: [{
                    title: '🔥 You\'re Missing Out!',
                    description: 'Here\'s what\'s happening in Unit Talk today:',
                    color: 0xff6b35,
                    fields: template.examples.map((example) => ({
                        name: 'Hot Update',
                        value: example,
                        inline: false
                    }))
                }]
        };
    }
    async generateConversionPrompt(_context, _template) {
        return {
            type: 'conversion_prompt',
            content: "Based on your activity, I think you're ready for our premium features!",
            embeds: [{
                    title: '💎 Upgrade to VIP',
                    description: 'You\'ve been crushing it with our free picks. Ready for the full experience?',
                    color: 0xffd700,
                    fields: [
                        { name: '📊 Your Results', value: 'Following our picks perfectly!', inline: true },
                        { name: '🎯 Win Rate', value: '4 out of 5 this week', inline: true },
                        { name: '💰 Potential', value: 'Upgrade = 5x more picks', inline: true }
                    ]
                }],
            components: [{
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 3,
                            label: '🚀 Try VIP Free',
                            custom_id: 'onboarding_conversion_trial'
                        }
                    ]
                }]
        };
    }
    async generateChurnPrevention(_context, _template) {
        return {
            type: 'churn_prevention',
            content: "Hey! I noticed you haven't been around much. Everything okay?",
            embeds: [{
                    title: '👋 We Miss You!',
                    description: 'Is there anything I can help you with? Or maybe you need a different approach?',
                    color: 0xffb347,
                    fields: [
                        { name: '🎯 Personalize Experience', value: 'Let me adjust to your preferences', inline: false },
                        { name: '📞 Human Support', value: 'Connect with our team directly', inline: false },
                        { name: '⏰ Take a Break', value: 'Pause notifications for a while', inline: false }
                    ]
                }]
        };
    }
    async generateLearningAcceleration(_context, _template) {
        return {
            type: 'learning_acceleration',
            content: "You're learning fast! Ready for more advanced concepts?",
            embeds: [{
                    title: '🧠 Level Up Your Knowledge',
                    description: 'I can see you\'re getting the hang of this. Want to dive deeper?',
                    color: 0x9370db,
                    fields: [
                        { name: '📈 Advanced Analytics', value: 'Learn about our ML models', inline: false },
                        { name: '💰 Bankroll Management', value: 'Professional money management', inline: false },
                        { name: '🎯 Line Movement', value: 'How to read market changes', inline: false }
                    ]
                }]
        };
    }
    async generateQuestionResponse(_context, _question) {
        // Use AI to generate helpful response
        return await enhanced_circuit_breaker_1.withCircuitBreaker.openai(async () => {
            // This would call OpenAI to generate a helpful response
            return {
                type: 'question_response',
                content: `Great question! Let me explain that for you...`,
                embeds: [{
                        title: '💡 Answer',
                        description: 'Based on your question, here\'s what you need to know:',
                        color: 0x00ff7f
                    }]
            };
        }, async () => {
            // Fallback response
            return {
                type: 'question_response',
                content: `That's a great question! Let me help you with that...`,
                embeds: [{
                        title: '💡 Quick Answer',
                        description: 'I\'d love to give you a detailed answer. Can you be more specific about what you\'d like to know?',
                        color: 0x00ff7f
                    }]
            };
        });
    }
    async generateFrustrationResponse(_context, _frustration) {
        return {
            type: 'frustration_response',
            content: "I can sense this might be frustrating. Let me help make this easier!",
            embeds: [{
                    title: '🤗 No Worries!',
                    description: 'Everyone struggles with this at first. You\'re not alone!',
                    color: 0xff69b4,
                    fields: [
                        { name: '🎯 Simplify', value: 'Let me break this down step by step', inline: false },
                        { name: '👨‍💻 Human Help', value: 'Connect with our support team', inline: false }
                    ]
                }]
        };
    }
    async generateLearningResponse(_context, _learning) {
        return {
            type: 'learning_response',
            content: "Awesome! I can see you're getting it. Keep up the great work! 🎉",
            embeds: [{
                    title: '🌟 Great Progress!',
                    description: 'You\'re learning fast. Ready for the next step?',
                    color: 0x32cd32
                }]
        };
    }
    async generateGuidanceResponse(_context) {
        return {
            type: 'guidance',
            content: "How are you finding everything so far? Any questions?",
            embeds: [{
                    title: '🧭 How Can I Help?',
                    description: 'I\'m here to make sure you get the most out of Unit Talk!',
                    color: 0x4169e1
                }]
        };
    }
    async handleExperienceSelection(_userId, interaction) {
        const experienceLevel = interaction.customId.split('_').pop();
        const responses = {
            beginner: {
                content: "Perfect! I'll explain everything in simple terms and help you start safely.",
                nextStep: "Let me show you how our pick system works with a real example..."
            },
            intermediate: {
                content: "Great! I'll help you leverage our analytics to improve your success rate.",
                nextStep: "Let me show you our advanced features and what makes us different..."
            },
            advanced: {
                content: "Excellent! Let's dive into our professional-grade analytics and models.",
                nextStep: "Here's our transparent track record and methodology breakdown..."
            }
        };
        const response = responses[experienceLevel] || responses.beginner;
        return {
            type: 'experience_response',
            content: response.content,
            embeds: [{
                    title: '🎯 Perfect!',
                    description: response.nextStep,
                    color: 0x00ff00
                }],
            components: [{
                    type: 1,
                    components: [{
                            type: 2,
                            style: 1,
                            label: '📚 Start Tutorial',
                            custom_id: `onboarding_tutorial_${experienceLevel}`
                        }]
                }]
        };
    }
    async handleConversionFlow(_userId, interaction) {
        const action = interaction.customId.split('_').pop();
        const responses = {
            trial: "🎉 Amazing! I'll set up your free VIP trial right now...",
            pricing: "💰 Here's our transparent pricing structure...",
            later: "👍 No problem! I'll check back with you in a few days."
        };
        return {
            type: 'conversion_response',
            content: responses[action] || "Thanks for your interest!",
            embeds: [{
                    title: action === 'trial' ? '🚀 Welcome to VIP!' : '📊 Pricing Info',
                    description: 'Let me get that set up for you...',
                    color: 0xffd700
                }]
        };
    }
    async handleTutorialFlow(_userId, _interaction) {
        return {
            type: 'tutorial_response',
            content: "🎓 Great! Let's start your personalized tutorial...",
            embeds: [{
                    title: '📚 Tutorial Starting',
                    description: 'This will take about 3 minutes and will be customized to your experience level.',
                    color: 0x9370db
                }]
        };
    }
    determineConversionStrategy(userProfile) {
        if (userProfile.experienceLevel === 'beginner') {
            return 'trust_focused';
        }
        return 'value_focused';
    }
    getConversionTemplate(strategy) {
        const conversionTemplates = this.conversationTemplates.get('conversion');
        return conversionTemplates?.[strategy] || conversionTemplates?.value_focused;
    }
    getTimeSinceLastBotResponse(context) {
        const lastBotMessage = context.conversationHistory
            .filter(turn => turn.speaker === 'bot')
            .pop();
        if (!lastBotMessage)
            return Infinity;
        return Date.now() - lastBotMessage.timestamp.getTime();
    }
    getGenericInterventionResponse() {
        return {
            type: 'generic_intervention',
            content: "I'm here to help! What can I assist you with?",
            embeds: [{
                    title: '🤖 Support',
                    description: 'How can I make your experience better?',
                    color: 0x6495ed
                }]
        };
    }
    getGenericFlowResponse() {
        return {
            type: 'generic_flow',
            content: "Thanks for that! How else can I help you today?",
            embeds: [{
                    title: '👍 Got it!',
                    description: 'Is there anything else you\'d like to know?',
                    color: 0x32cd32
                }]
        };
    }
    async isHealthy() {
        return this.conversationTemplates.size > 0;
    }
    async cleanup() {
        this.userContexts.clear();
        this.conversationTemplates.clear();
        this.logger.info('🧹 ConversationEngine cleanup completed');
    }
}
exports.ConversationEngine = ConversationEngine;
