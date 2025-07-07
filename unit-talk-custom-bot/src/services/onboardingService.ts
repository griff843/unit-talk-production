import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, User } from 'discord.js';
import { logger } from '../utils/logger';

// Define types locally since they don't exist in the project
type UserTier = 'free' | 'member' | 'trial' | 'vip' | 'vip_plus' | 'capper' | 'staff' | 'admin' | 'owner';

interface OnboardingMessage {
  embed: EmbedBuilder;
  components?: ActionRowBuilder<ButtonBuilder>[];
  delay: number;
}

interface OnboardingSequence {
  messages: OnboardingMessage[];
  tier: UserTier;
}

export class OnboardingService {
  private activeSequences: Map<string, NodeJS.Timeout[]> = new Map();

  constructor() {
    logger.info('OnboardingService initialized');
  }

  /**
   * Handle user onboarding based on their tier
   */
  async handleUserOnboarding(user: User, tier: UserTier, testMode: boolean = false): Promise<void> {
    try {
      // Cancel any existing onboarding sequence for this user
      await this.cancelOnboarding(user.id);

      const sequence = this.createOnboardingSequence(user, tier);
      if (!sequence || sequence.messages.length === 0) {
        logger.info(`No onboarding sequence for tier: ${tier}`);
        return;
      }

      logger.info(`Starting onboarding sequence for ${user.username} (${tier}) - ${sequence.messages.length} messages`);

      if (testMode) {
        // In test mode, send all messages immediately with 2-second intervals
        await this.sendTestSequence(user, sequence);
      } else {
        // Normal mode with proper delays
        await this.sendSequenceWithDelays(user, sequence);
      }

    } catch (error) {
      logger.error('Error in handleUserOnboarding:', error);
    }
  }

  /**
   * Send sequence in test mode (immediate with short intervals)
   */
  private async sendTestSequence(user: User, sequence: OnboardingSequence): Promise<void> {
    const dmChannel = await user.createDM();
    
    for (let i = 0; i < sequence.messages.length; i++) {
      const message = sequence.messages[i];
      
      try {
        await dmChannel.send({
          embeds: [message.embed],
          components: message.components || []
        });
        
        logger.info(`✅ Test message ${i + 1}/${sequence.messages.length} sent to ${user.username}`);
        
        // Short delay between test messages (2 seconds)
        if (i < sequence.messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        logger.error(`Failed to send test message ${i + 1} to ${user.username}:`, error);
      }
    }
  }

  /**
   * Send sequence with proper delays (production mode)
   */
  private async sendSequenceWithDelays(user: User, sequence: OnboardingSequence): Promise<void> {
    const timeouts: NodeJS.Timeout[] = [];
    
    for (let i = 0; i < sequence.messages.length; i++) {
      const message = sequence.messages[i];
      
      const timeout = setTimeout(async () => {
        try {
          const dmChannel = await user.createDM();
          await dmChannel.send({
            embeds: [message.embed],
            components: message.components || []
          });
          
          logger.info(`✅ Onboarding message ${i + 1}/${sequence.messages.length} sent to ${user.username}`);
        } catch (error) {
          logger.error(`Failed to send onboarding message ${i + 1} to ${user.username}:`, error);
        }
      }, message.delay);
      
      timeouts.push(timeout);
    }
    
    // Store timeouts for potential cancellation
    this.activeSequences.set(user.id, timeouts);
    
    // Clean up after the last message
    setTimeout(() => {
      this.activeSequences.delete(user.id);
    }, Math.max(...sequence.messages.map(m => m.delay)) + 5000);
  }

  /**
   * Cancel ongoing onboarding sequence for a user
   */
  async cancelOnboarding(userId: string): Promise<void> {
    const timeouts = this.activeSequences.get(userId);
    if (timeouts) {
      timeouts.forEach(timeout => clearTimeout(timeout));
      this.activeSequences.delete(userId);
      logger.info(`Cancelled onboarding sequence for user ${userId}`);
    }
  }

  /**
   * Create onboarding sequence based on user tier
   */
  private createOnboardingSequence(user: User, tier: UserTier): OnboardingSequence | null {
    switch (tier) {
      case 'vip_plus':
        return this.createVIPPlusSequence(user);
      case 'vip':
        return this.createVIPSequence(user);
      case 'capper':
        return this.createCapperSequence(user);
      case 'staff':
      case 'admin':
      case 'owner':
        return this.createStaffSequence(user, tier);
      default:
        return this.createFreeSequence(user);
    }
  }

  /**
   * Create VIP+ onboarding sequence - Ultimate Elite Experience
   */
  private createVIPPlusSequence(user: User): OnboardingSequence {
    const messages: OnboardingMessage[] = [
      // Single Comprehensive VIP+ Welcome Message
      {
        embed: new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('💎+ Welcome to VIP+ Elite - The Ultimate Edge')
          .setDescription(`${user.username}, you've reached the pinnacle of sports intelligence. Welcome to VIP+ Elite - where institutional-grade analytics meet professional execution.`)
          .addFields(
            {
              name: '🏆 Your VIP+ Elite Arsenal',
              value: [
                '• **AI-Powered Advice Engine** - Real-time pick analysis with OpenAI integration',
                '• **S/A Tier Picks Only** - Unified edge scoring system filters top opportunities',
                '• **Market Resistance Analysis** - Sharp money tracking & line movement detection',
                '• **SGO Data Integration** - Professional-grade odds feeds from SportsGameOdds',
                '• **Automated Grading System** - Instant pick results with performance tracking',
                '• **Advanced Analytics Dashboard** - ROI by tier, trend analysis, streak tracking'
              ].join('\n'),
              inline: false
            },
            {
              name: '⚡ Real-Time Intelligence Features',
              value: [
                '• **Instant Discord Alerts** - First to know with rate-limited delivery',
                '• **Circuit Breaker Protection** - Cost-optimized AI usage with fallback systems',
                '• **Duplicate Detection** - Smart alert deduplication prevents spam',
                '• **Multi-League Coverage** - NBA, MLB, NHL, NFL with league-specific rules'
              ].join('\n'),
              inline: false
            },
            {
              name: '📊 Your VIP+ Performance Advantage',
              value: [
                '• **Institutional-Grade Scoring** - Multi-factor edge detection algorithm',
                '• **Zone Threat Analysis** - Advanced player performance modeling',
                '• **Market Context Analysis** - Time-of-day and volatility considerations',
                '• **Performance Metrics** - Comprehensive tracking with Supabase integration'
              ].join('\n'),
              inline: false
            },
            {
              name: '🎯 What Makes VIP+ Elite Different',
              value: [
                '• **Agent-Based Architecture** - AlertAgent, GradingAgent, IngestionAgent working 24/7',
                '• **Professional Data Pipeline** - From raw props to graded picks automatically',
                '• **Enterprise Monitoring** - Prometheus metrics, health checks, error tracking',
                '• **Scalable Infrastructure** - Built for high-volume professional operations'
              ].join('\n'),
              inline: false
            },
            {
              name: '🚀 Ready to Dominate?',
              value: 'Your VIP+ Elite system is powered by the same technology used by institutional traders. Let\'s configure your ultimate edge and start your journey to consistent profitability.',
              inline: false
            }
          )
          .setFooter({ text: 'VIP+ Elite - Institutional-Grade Sports Intelligence | Welcome to the Top 1%' })
          .setThumbnail('https://cdn.discordapp.com/attachments/1234567890/wise-owl-avatar.png')
          .setTimestamp(),
        components: [
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('start_vip_plus_tour')
                .setLabel('🚀 Start VIP+ Elite Tour')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('ai_coach')
                .setLabel('🤖 Meet Your AI Coach')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId('analytics')
                .setLabel('📊 View Elite Analytics')
                .setStyle(ButtonStyle.Secondary)
            )
        ],
        delay: 0 // Immediate
      },

      // Follow-up: Technical Deep Dive
      {
        embed: new EmbedBuilder()
          .setColor('#FF6B35')
          .setTitle('🔥 Your VIP+ Elite Technical Architecture')
          .setDescription(`${user.username}, let's explore the sophisticated technology stack that gives you the ultimate edge.`)
          .addFields(
            {
              name: '🤖 AI-Powered Analysis Engine',
              value: [
                '• **OpenAI Integration** - GPT-powered pick analysis with cost optimization',
                '• **Market Context Analyzer** - Bull/bear/sideways regime detection',
                '• **Sentiment Analysis** - Multi-source sentiment aggregation',
                '• **Caching System** - 5-minute TTL for optimal performance'
              ].join('\n'),
              inline: false
            },
            {
              name: '📊 Advanced Scoring & Analytics',
              value: [
                '• **Unified Edge Score** - Multi-factor algorithm with version tracking',
                '• **League-Specific Rules** - NBA, MLB, NHL, NFL optimized scoring',
                '• **Tier Classification** - S/A/B/C automatic tier assignment',
                '• **Performance Tracking** - Win rate, ROI, streak analysis'
              ].join('\n'),
              inline: false
            },
            {
              name: '🎯 Professional Data Pipeline',
              value: [
                '• **SGO Integration** - Real-time odds from SportsGameOdds API',
                '• **Data Normalization** - Automated prop validation and cleaning',
                '• **Automated Grading** - Instant pick resolution and tracking',
                '• **Alert Distribution** - Multi-channel delivery with rate limiting'
              ].join('\n'),
              inline: false
            },
            {
              name: '⚡ Enterprise Infrastructure',
              value: [
                '• **Agent Architecture** - Microservices for scalability',
                '• **Supabase Backend** - Enterprise PostgreSQL with real-time sync',
                '• **Monitoring Stack** - Prometheus metrics with health checks',
                '• **Circuit Breakers** - Fault tolerance and cost protection'
              ].join('\n'),
              inline: false
            }
          )
          .setFooter({ text: 'VIP+ Elite - Technical Excellence | Your Competitive Advantage' })
          .setTimestamp(),
        components: [
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('notification_settings')
                .setLabel('⚙️ Configure Elite Alerts')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('access_elite_features')
                .setLabel('🔓 Access Elite Features')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId('vip_plus_settings')
                .setLabel('🎛️ Customize Experience')
                .setStyle(ButtonStyle.Secondary)
            )
        ],
        delay: 20 * 60 * 1000 // 20 minutes
      }
    ];

    return { messages, tier: 'vip_plus' };
  }

  /**
   * Create VIP onboarding sequence - Professional Grade Experience
   */
  private createVIPSequence(user: User): OnboardingSequence {
    const messages: OnboardingMessage[] = [
      // Message 1: Professional Welcome
      {
        embed: new EmbedBuilder()
          .setColor('#8B4513')
          .setTitle('👑 Welcome to VIP Professional Status')
          .setDescription(`Congratulations ${user.username}! You've joined the professional tier with access to institutional-grade sports intelligence.`)
          .addFields(
            {
              name: '🏆 Your VIP Professional Access',
              value: [
                '• **Professional Capper Network** - Vetted experts with proven track records',
                '• **Advanced Analytics Suite** - ROI tracking, trend analysis, performance metrics',
                '• **Priority Alert System** - First access to market-moving opportunities',
                '• **Edge Scoring Algorithm** - Multi-factor analysis for pick quality',
                '• **Automated Grading** - Instant pick resolution and performance tracking',
                '• **Professional Community** - Network with serious sports investors'
              ].join('\n'),
              inline: false
            },
            {
              name: '🎯 Your VIP Technology Stack',
              value: [
                '• **Real-Time Data Feeds** - SGO integration for live odds',
                '• **Market Analysis Tools** - Line movement and sharp money tracking',
                '• **Performance Dashboard** - Comprehensive analytics and reporting',
                '• **Alert Optimization** - Smart delivery with duplicate prevention'
              ].join('\n'),
              inline: false
            },
            {
              name: '📊 VIP Performance Metrics',
              value: [
                '• **A/B Tier Picks** - Access to high-quality opportunities',
                '• **Professional Analytics** - Same tools used by institutional traders',
                '• **24/7 System Monitoring** - Reliable service with health checks',
                '• **Scalable Architecture** - Built for professional-grade operations'
              ].join('\n'),
              inline: false
            },
            {
              name: '🚀 Next Steps',
              value: 'Your VIP professional dashboard is ready. Let\'s configure your alerts and start accessing institutional-grade sports intelligence.',
              inline: false
            }
          )
          .setFooter({ text: 'Unit Talk VIP - Professional Sports Intelligence | Welcome to Excellence' })
          .setThumbnail('https://cdn.discordapp.com/attachments/1234567890/wise-owl-avatar.png')
          .setTimestamp(),
        components: [
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('vip_tour')
                .setLabel('🎯 Start VIP Tour')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🚀'),
              new ButtonBuilder()
                .setCustomId('setup_notifications')
                .setLabel('⚙️ Configure Alerts')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔔'),
              new ButtonBuilder()
                .setCustomId('upgrade_to_vip_plus')
                .setLabel('💎 Upgrade to VIP+')
                .setStyle(ButtonStyle.Success)
                .setEmoji('⬆️')
            )
        ],
        delay: 0 // Immediate
      },

      // Message 2: VIP+ Upgrade Opportunity
      {
        embed: new EmbedBuilder()
          .setColor('#DAA520')
          .setTitle('💎 Ready for VIP+ Elite Technology?')
          .setDescription(`${user.username}, as a VIP professional, you have access to advanced tools. But VIP+ Elite unlocks our complete institutional-grade technology stack.`)
          .addFields(
            {
              name: '🔥 What VIP+ Elite Adds',
              value: [
                '• **AI-Powered Analysis** - OpenAI integration for intelligent pick advice',
                '• **S-Tier Exclusive Picks** - Highest-scoring opportunities only',
                '• **Advanced Market Intelligence** - Circuit breaker protection and cost optimization',
                '• **Professional Agent Architecture** - Dedicated microservices for your account',
                '• **Enterprise Monitoring** - Prometheus metrics and advanced health checks',
                '• **Priority Processing** - Dedicated resources for faster execution'
              ].join('\n'),
              inline: false
            },
            {
              name: '📊 VIP+ Technical Advantages',
              value: [
                '• **Enhanced Scoring Algorithm** - Multi-league optimization with version control',
                '• **Advanced Caching** - Optimized performance with intelligent data management',
                '• **Professional Data Pipeline** - From ingestion to grading, fully automated',
                '• **Enterprise Infrastructure** - Built for institutional-scale operations'
              ].join('\n'),
              inline: false
            },
            {
              name: '⚡ VIP Professional Exclusive Offer',
              value: 'Upgrade to VIP+ Elite and unlock the complete institutional-grade technology stack. Limited availability for existing VIP professionals.',
              inline: false
            }
          )
          .setFooter({ text: 'VIP+ Elite - Complete Technology Stack | Professional Upgrade Available' })
          .setTimestamp(),
        components: [
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('upgrade_to_vip_plus')
                .setLabel('💎 Upgrade to VIP+ Elite')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('view_vip_plus_guide')
                .setLabel('📋 Compare Technology')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('setup_notifications')
                .setLabel('⚙️ Optimize VIP Setup')
                .setStyle(ButtonStyle.Success)
            )
        ],
        delay: 45 * 60 * 1000 // 45 minutes
      }
    ];

    return { messages, tier: 'vip' };
  }

  /**
   * Create Capper onboarding sequence - Professional Contributor Program
   */
  private createCapperSequence(user: User): OnboardingSequence {
    const messages: OnboardingMessage[] = [
      // Message 1: Professional Capper Welcome
      {
        embed: new EmbedBuilder()
          .setColor('#8E44AD')
          .setTitle('🎯 Welcome to the Professional Capper Program')
          .setDescription(`${user.username}, welcome to Unit Talk's exclusive Capper Program - where your expertise meets our institutional-grade technology platform.`)
          .addFields(
            {
              name: '🏆 Your Professional Capper Platform',
              value: [
                '• **Advanced Submission System** - Professional pick management with validation',
                '• **Automated Grading Engine** - Instant pick resolution and performance tracking',
                '• **Unified Edge Scoring** - Your picks evaluated with institutional-grade algorithms',
                '• **Performance Analytics** - Comprehensive ROI, win rate, and streak analysis',
                '• **Leaderboard Integration** - Real-time ranking with professional recognition',
                '• **Revenue Sharing Program** - Earn from your successful pick performance'
              ].join('\n'),
              inline: false
            },
            {
              name: '📊 Professional Capper Technology',
              value: [
                '• **Real-Time Data Integration** - SGO feeds for accurate line information',
                '• **Market Analysis Tools** - Line movement tracking and sharp money detection',
                '• **AI-Powered Insights** - OpenAI integration for enhanced pick analysis',
                '• **Professional Dashboard** - Comprehensive performance monitoring'
              ].join('\n'),
              inline: false
            },
            {
              name: '💰 Capper Success Metrics & Earnings',
              value: [
                '• **Performance-Based Revenue** - Higher win rates generate higher earnings',
                '• **Tier-Based Recognition** - S/A tier picks receive premium placement',
                '• **Professional Reputation** - Build credibility with verified performance data',
                '• **Community Recognition** - Top performers featured in leaderboards'
              ].join('\n'),
              inline: false
            },
            {
              name: '🚀 Getting Started',
              value: 'Let\'s set up your professional capper profile and integrate you with our automated grading and analytics systems.',
              inline: false
            }
          )
          .setFooter({ text: 'Unit Talk Capper Program - Professional Technology Platform | Where Expertise Meets Innovation' })
          .setThumbnail('https://cdn.discordapp.com/attachments/1234567890/wise-owl-avatar.png')
          .setTimestamp(),
        components: [
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('capper_onboard_start')
                .setLabel('🎯 Complete Capper Setup')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('capper_practice_pick')
                .setLabel('📝 Submit Sample Pick')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId('capper_guide')
                .setLabel('📋 Technology Guide')
                .setStyle(ButtonStyle.Secondary)
            )
        ],
        delay: 0 // Immediate
      },

      // Message 2: Technical Integration & Tools
      {
        embed: new EmbedBuilder()
          .setColor('#E67E22')
          .setTitle('📝 Professional Pick Submission & Analytics')
          .setDescription(`${user.username}, let's integrate you with our professional-grade pick submission and automated grading systems.`)
          .addFields(
            {
              name: '🎯 Professional Submission Requirements',
              value: [
                '• **Detailed Analysis** - Comprehensive research methodology documentation',
                '• **Confidence Rating** - Professional confidence assessment (1-10 scale)',
                '• **Unit Recommendation** - Risk-appropriate unit sizing guidance',
                '• **Edge Score Integration** - Your picks evaluated by our unified scoring algorithm'
              ].join('\n'),
              inline: false
            },
            {
              name: '🔧 Professional Capper Technology Stack',
              value: [
                '• **Automated Grading System** - Instant pick resolution with GradingAgent',
                '• **Performance Analytics** - Real-time ROI, win rate, and trend analysis',
                '• **Market Intelligence** - Line movement tracking and resistance analysis',
                '• **Alert Distribution** - Your picks delivered via our AlertAgent system'
              ].join('\n'),
              inline: false
            },
            {
              name: '📊 Integration Process',
              value: [
                '1. **Submit Sample Pick** - Demonstrate your analysis methodology',
                '2. **System Integration** - Connect with our automated grading pipeline',
                '3. **Performance Baseline** - Establish your professional track record',
                '4. **Revenue Activation** - Begin earning from successful picks'
              ].join('\n'),
              inline: false
            },
            {
              name: '⚡ Advanced Features Available',
              value: [
                '• **AI-Enhanced Analysis** - OpenAI integration for pick optimization',
                '• **Multi-League Support** - NBA, MLB, NHL, NFL with league-specific rules',
                '• **Professional Monitoring** - Enterprise-grade system health and performance',
                '• **Scalable Infrastructure** - Built for high-volume professional operations'
              ].join('\n'),
              inline: false
            }
          )
          .setFooter({ text: 'Professional Capper Integration - Technology-Driven Excellence | Your Success, Automated' })
          .setTimestamp(),
        components: [
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('capper_practice_pick')
                .setLabel('📝 Submit Sample Pick')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('view_leaderboard')
                .setLabel('🏆 View Performance Rankings')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId('capper_support')
                .setLabel('🆘 Technical Support')
                .setStyle(ButtonStyle.Secondary)
            )
        ],
        delay: 15 * 60 * 1000 // 15 minutes
      },

      // Message 3: Professional Community & Advanced Features
      {
        embed: new EmbedBuilder()
          .setColor('#27AE60')
          .setTitle('🌟 Professional Capper Community & Technology')
          .setDescription(`${user.username}, you're now part of an exclusive network of professional cappers powered by institutional-grade technology.`)
          .addFields(
            {
              name: '🤝 Professional Capper Network',
              value: [
                '• **Private Capper Channels** - Discuss strategies with verified professionals',
                '• **Technology Collaboration** - Share insights on system optimization',
                '• **Performance Benchmarking** - Compare results with peer professionals',
                '• **Industry Integration** - Connect with sportsbook and data professionals'
              ].join('\n'),
              inline: false
            },
            {
              name: '💰 Revenue & Recognition Systems',
              value: [
                '• **Automated Revenue Tracking** - Performance-based earnings calculation',
                '• **Tier-Based Bonuses** - S/A tier picks receive premium compensation',
                '• **Professional Recognition** - Verified performance builds industry reputation',
                '• **Technology Partnerships** - Access to exclusive data and tool integrations'
              ].join('\n'),
              inline: false
            },
            {
              name: '🎯 Professional Success Optimization',
              value: [
                '• **Consistency Tracking** - Automated analysis of submission patterns',
                '• **Performance Analytics** - AI-powered insights for improvement',
                '• **Community Engagement** - Active participation increases opportunities',
                '• **Continuous Improvement** - System learns and adapts to your style'
              ].join('\n'),
              inline: false
            },
            {
              name: '⚡ Advanced Technology Access',
              value: [
                '• **Professional API Access** - Direct integration with our systems',
                '• **Custom Analytics** - Personalized performance dashboards',
                '• **Priority Processing** - Dedicated resources for your submissions',
                '• **Enterprise Support** - Professional-grade technical assistance'
              ].join('\n'),
              inline: false
            }
          )
          .setFooter({ text: 'Professional Capper Network - Technology-Driven Excellence | Your Success is Our Innovation' })
          .setTimestamp(),
        components: [
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('create_capper_thread')
                .setLabel('💬 Join Professional Network')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('capper_guide')
                .setLabel('📚 Advanced Technology Guide')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId('view_leaderboard')
                .setLabel('🏆 Performance Rankings')
                .setStyle(ButtonStyle.Secondary)
            )
        ],
        delay: 45 * 60 * 1000 // 45 minutes
      }
    ];

    return { messages, tier: 'capper' };
  }

  /**
   * Create Staff onboarding sequence - Administrative Access
   */
  private createStaffSequence(user: User, tier: UserTier): OnboardingSequence {
    const messages: OnboardingMessage[] = [
      {
        embed: new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle(`🛡️ Welcome ${tier.toUpperCase()} - Administrative Access`)
          .setDescription(`Welcome to the team, ${user.username}! You now have administrative access to Unit Talk's professional platform.`)
          .addFields(
            {
              name: '⚙️ Administrative Tools & Systems',
              value: [
                '• **Agent Management** - Monitor AlertAgent, GradingAgent, IngestionAgent',
                '• **User Management** - Tier assignments, permissions, and access control',
                '• **Analytics Dashboard** - System performance, user metrics, and reporting',
                '• **Configuration Management** - System settings and operational parameters'
              ].join('\n'),
              inline: false
            },
            {
              name: '📊 System Monitoring & Analytics',
              value: [
                '• **Prometheus Metrics** - Real-time system performance monitoring',
                '• **Health Check Dashboard** - Service status and operational health',
                '• **Performance Analytics** - User engagement and system efficiency',
                '• **Error Tracking** - System issues and resolution monitoring'
              ].join('\n'),
              inline: false
            },
            {
              name: '🔧 Technical Administration',
              value: [
                '• **Database Management** - Supabase administration and optimization',
                '• **API Management** - OpenAI, SGO, and other service integrations',
                '• **Alert System Control** - Discord, Notion, and Retool configurations',
                '• **Capper System Oversight** - Professional contributor management'
              ].join('\n'),
              inline: false
            },
            {
              name: '🚀 Administrative Responsibilities',
              value: [
                '• **System Maintenance** - Ensure optimal platform performance',
                '• **User Support** - Assist with technical issues and questions',
                '• **Quality Assurance** - Monitor pick quality and system accuracy',
                '• **Strategic Planning** - Contribute to platform development and growth'
              ].join('\n'),
              inline: false
            }
          )
          .setFooter({ text: `Unit Talk ${tier.toUpperCase()} - Administrative Excellence | Professional Platform Management` })
          .setTimestamp(),
        delay: 0
      }
    ];

    return { messages, tier };
  }

  /**
   * Create Free tier welcome message - Introduction to Professional Platform
   */
  private createFreeSequence(user: User): OnboardingSequence {
    const messages: OnboardingMessage[] = [
      {
        embed: new EmbedBuilder()
          .setColor('#2C3E50')
          .setTitle('🏆 Welcome to Unit Talk - Professional Sports Intelligence Platform')
          .setDescription(`Welcome ${user.username}! You've joined the premier destination for institutional-grade sports betting intelligence and technology.`)
          .addFields(
            {
              name: '🎯 What Makes Unit Talk Different',
              value: [
                '• **Institutional-Grade Technology** - Agent-based architecture with AI integration',
                '• **Professional Capper Network** - Vetted experts with automated performance tracking',
                '• **Advanced Analytics Engine** - Unified edge scoring with multi-league optimization',
                '• **Real-Time Data Integration** - SGO feeds with automated grading systems'
              ].join('\n'),
              inline: false
            },
            {
              name: '🔧 Our Technology Stack',
              value: [
                '• **AI-Powered Analysis** - OpenAI integration with cost optimization',
                '• **Automated Systems** - AlertAgent, GradingAgent, IngestionAgent working 24/7',
                '• **Enterprise Infrastructure** - Supabase backend with Prometheus monitoring',
                '• **Professional Tools** - Market resistance analysis and performance tracking'
              ].join('\n'),
              inline: false
            },
            {
              name: '📊 Your Current Access (Free Tier)',
              value: [
                '• **Community Discussions** - Connect with other sports intelligence enthusiasts',
                '• **Educational Content** - Learn about professional sports betting strategies',
                '• **Platform Overview** - Understand our institutional-grade technology',
                '• **Limited Previews** - Sample our professional-grade analysis'
              ].join('\n'),
              inline: false
            },
            {
              name: '🚀 Ready to Access Professional Tools?',
              value: 'Our VIP and VIP+ members have access to the complete institutional-grade technology stack. Join the professional tier that treats sports betting like the sophisticated technology-driven investment strategy it is.',
              inline: false
            }
          )
          .setFooter({ text: 'Unit Talk - Professional Sports Intelligence Platform | Upgrade to unlock institutional-grade technology' })
          .setThumbnail('https://cdn.discordapp.com/attachments/1234567890/wise-owl-avatar.png')
          .setTimestamp(),
        components: [
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('upgrade_to_vip')
                .setLabel('🔥 Upgrade to VIP Professional')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId('upgrade_to_vip_plus')
                .setLabel('💎 Upgrade to VIP+ Elite')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('view_faq')
                .setLabel('❓ Learn About Our Technology')
                .setStyle(ButtonStyle.Secondary)
            )
        ],
        delay: 0 // Immediate
      }
    ];

    return { messages, tier: 'free' };
  }
}