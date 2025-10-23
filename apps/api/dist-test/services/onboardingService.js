"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingService = void 0;
const logger_1 = require("../utils/logger");
class OnboardingService {
    constructor() {
        this.activeSequences = new Map();
        logger_1.logger.info('OnboardingService initialized');
    }
    async handleUserOnboarding(user, tier, testMode = false) {
        try {
            logger_1.logger.info('Starting user onboarding', {
                userId: user.id,
                username: user.username,
                tier,
                testMode
            });
            // Cancel any existing onboarding sequence for this user
            await this.cancelOnboarding(user.id);
            const sequence = this.createOnboardingSequence(user, tier);
            if (!sequence || sequence.messages.length === 0) {
                logger_1.logger.warn('No onboarding sequence available', { tier });
                return;
            }
            logger_1.logger.info('Created onboarding sequence', {
                userId: user.id,
                tier,
                messageCount: sequence.messages.length
            });
            if (testMode) {
                // In test mode, send all messages immediately with 2-second intervals
                await this.sendTestSequence(user, sequence);
            }
            else {
                // Normal mode with proper delays
                await this.sendSequenceWithDelays(user, sequence);
            }
            logger_1.logger.info('Completed user onboarding', {
                userId: user.id,
                username: user.username,
                tier,
                testMode
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to handle user onboarding', {
                userId: user.id,
                username: user.username,
                tier,
                err: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async cancelOnboarding(userId) {
        const timeouts = this.activeSequences.get(userId);
        if (timeouts) {
            timeouts.forEach(clearTimeout);
            this.activeSequences.delete(userId);
            logger_1.logger.info('Cancelled existing onboarding sequence', { userId });
        }
    }
    async sendTestSequence(user, sequence) {
        const dmChannel = await user.createDM();
        for (let i = 0; i < sequence.messages.length; i++) {
            const message = sequence.messages[i];
            try {
                await dmChannel.send({
                    embeds: [message.embed],
                    components: message.components || []
                });
                logger_1.logger.info('Sent test message', {
                    userId: user.id,
                    username: user.username,
                    messageNumber: i + 1,
                    totalMessages: sequence.messages.length,
                    tier: sequence.tier
                });
                // Short delay between test messages (2 seconds)
                if (i < sequence.messages.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            catch (error) {
                logger_1.logger.error('Failed to send test message', {
                    userId: user.id,
                    username: user.username,
                    messageNumber: i + 1,
                    err: error instanceof Error ? error.message : String(error)
                });
                throw error;
            }
        }
    }
    async sendSequenceWithDelays(user, sequence) {
        const timeouts = [];
        for (let i = 0; i < sequence.messages.length; i++) {
            const message = sequence.messages[i];
            const timeout = setTimeout(async () => {
                try {
                    const dmChannel = await user.createDM();
                    await dmChannel.send({
                        embeds: [message.embed],
                        components: message.components || []
                    });
                    logger_1.logger.info('Sent onboarding message', {
                        userId: user.id,
                        username: user.username,
                        messageNumber: i + 1,
                        totalMessages: sequence.messages.length,
                        tier: sequence.tier,
                        delay: message.delay
                    });
                }
                catch (error) {
                    logger_1.logger.error('Failed to send onboarding message', {
                        userId: user.id,
                        username: user.username,
                        messageNumber: i + 1,
                        err: error instanceof Error ? error.message : String(error)
                    });
                    throw error;
                }
            }, message.delay);
            timeouts.push(timeout);
        }
        // Store timeouts for potential cancellation
        this.activeSequences.set(user.id, timeouts);
        // Clean up after the last message
        const maxDelay = Math.max(...sequence.messages.map(m => m.delay));
        setTimeout(() => {
            this.activeSequences.delete(user.id);
            logger_1.logger.info('Completed onboarding sequence', {
                userId: user.id,
                username: user.username,
                tier: sequence.tier,
                totalMessages: sequence.messages.length,
                totalDuration: maxDelay
            });
        }, maxDelay + 5000);
    }
    createOnboardingSequence(user, tier) {
        logger_1.logger.info('Creating onboarding sequence', { userId: user.id, tier });
        const sequence = (() => {
            switch (tier) {
                case 'vip_plus':
                    return this.createVIPPlusSequence(user);
                case 'vip':
                    return this.createVIPSequence(user);
                case 'capper':
                    return this.createCapperSequence(user);
                case 'staff':
                case 'admin':
                    return this.createStaffSequence(user, tier);
                default:
                    return this.createFreeSequence(user);
            }
        })();
        logger_1.logger.info('Created onboarding sequence', {
            userId: user.id,
            tier,
            messageCount: sequence.messages.length
        });
        return sequence;
    }
    createVIPPlusSequence(user) {
        return {
            messages: [{
                    embed: {
                        color: 0xFFD700,
                        title: '💎+ Welcome to VIP+ Elite - The Ultimate Edge',
                        description: `${user.username}, you've reached the pinnacle of sports intelligence. Welcome to VIP+ Elite - where institutional-grade analytics meet professional execution.`,
                        fields: [
                            {
                                name: '🏆 Your VIP+ Elite Arsenal',
                                value: [
                                    '• **AI-Powered Advice Engine** - Real-time pick analysis with OpenAI integration',
                                    '• **S/A Tier Picks Only** - Unified edge scoring system filters top opportunities',
                                    '• **Market Resistance Analysis** - Sharp money tracking & line movement detection',
                                    '• **SGO Data Integration** - Professional-grade odds feeds from SportsGameOdds',
                                    '• **Automated Grading System** - Instant pick results with performance tracking',
                                    '• **Advanced Analytics Dashboard** - ROI by tier, trend analysis, streak tracking'
                                ].join('\n')
                            }
                        ],
                        footer: { text: 'Unit Talk - Professional Sports Intelligence Platform' },
                        timestamp: new Date()
                    },
                    delay: 0
                }],
            tier: 'vip_plus'
        };
    }
    createVIPSequence(user) {
        return {
            messages: [{
                    embed: {
                        color: 0x0099FF,
                        title: '💎 Welcome to VIP Professional',
                        description: `${user.username}, welcome to the professional tier. You now have access to our institutional-grade technology stack.`,
                        fields: [
                            {
                                name: '🏆 Your VIP Professional Features',
                                value: [
                                    '• **AI Analysis Engine** - Advanced pick analysis',
                                    '• **Premium Picks** - A/B tier opportunities',
                                    '• **Performance Analytics** - Detailed tracking',
                                    '• **Priority Support** - Fast response times',
                                    '• **Enhanced Tools** - Professional features'
                                ].join('\n')
                            }
                        ],
                        footer: { text: 'Unit Talk - Professional Sports Intelligence Platform' },
                        timestamp: new Date()
                    },
                    delay: 0
                }],
            tier: 'vip'
        };
    }
    createCapperSequence(user) {
        return {
            messages: [{
                    embed: {
                        color: 0x8E44AD,
                        title: '🎯 Welcome to the Professional Capper Program',
                        description: `${user.username}, welcome to Unit Talk's exclusive Capper Program - where your expertise meets our institutional-grade technology platform.`,
                        fields: [
                            {
                                name: '🏆 Your Professional Capper Platform',
                                value: [
                                    '• **Advanced Submission System** - Professional pick management',
                                    '• **Automated Grading** - Instant performance tracking',
                                    '• **Analytics Dashboard** - Comprehensive stats',
                                    '• **Revenue Sharing** - Earn from your success',
                                    '• **Professional Tools** - Expert features'
                                ].join('\n')
                            }
                        ],
                        footer: { text: 'Unit Talk - Professional Sports Intelligence Platform' },
                        timestamp: new Date()
                    },
                    delay: 0
                }],
            tier: 'capper'
        };
    }
    createStaffSequence(user, tier) {
        return {
            messages: [{
                    embed: {
                        color: 0x3498DB,
                        title: `🛡️ Welcome ${tier.toUpperCase()} - Administrative Access`,
                        description: `Welcome to the team, ${user.username}! You now have administrative access to Unit Talk's professional platform.`,
                        fields: [
                            {
                                name: '⚙️ Administrative Tools & Systems',
                                value: [
                                    '• **Agent Management** - Monitor and control system agents',
                                    '• **User Management** - Handle permissions and access',
                                    '• **Analytics Dashboard** - System-wide monitoring',
                                    '• **Configuration Management** - System settings'
                                ].join('\n')
                            }
                        ],
                        footer: { text: 'Unit Talk - Professional Sports Intelligence Platform' },
                        timestamp: new Date()
                    },
                    delay: 0
                }],
            tier: tier
        };
    }
    createFreeSequence(user) {
        return {
            messages: [{
                    embed: {
                        color: 0x2C3E50,
                        title: '🏆 Welcome to Unit Talk - Professional Sports Intelligence Platform',
                        description: `Welcome ${user.username}! You've joined the premier destination for institutional-grade sports betting intelligence and technology.`,
                        fields: [
                            {
                                name: '🎯 What Makes Unit Talk Different',
                                value: [
                                    '• **Professional Technology** - Agent-based system',
                                    '• **Expert Network** - Vetted cappers',
                                    '• **Advanced Analytics** - Edge scoring',
                                    '• **Real-Time Data** - Live updates'
                                ].join('\n')
                            }
                        ],
                        footer: { text: 'Unit Talk - Professional Sports Intelligence Platform' },
                        timestamp: new Date()
                    },
                    delay: 0
                }],
            tier: 'free'
        };
    }
}
exports.OnboardingService = OnboardingService;
