import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ThreadAutoArchiveDuration,
} from 'discord.js';

import { logger } from '../utils/logger';

export interface BlackLabelAnnouncement {
  id: string;
  sport: string;
  game: string;
  pick: string;
  odds: string;
  units: number;
  confidence: number;
  analysis?: string;
  capper: string;
  timestamp: Date;
  enhancedFeatures: {
    analytics: boolean;
    riskAssessment: boolean;
    portfolioImpact: boolean;
    marketSentiment: boolean;
  };
}

export class BlackLabelAnnouncementService {
  private static instance: BlackLabelAnnouncementService;

  private constructor() {}

  public static getInstance(): BlackLabelAnnouncementService {
    if (!BlackLabelAnnouncementService.instance) {
      BlackLabelAnnouncementService.instance = new BlackLabelAnnouncementService();
    }
    return BlackLabelAnnouncementService.instance;
  }

  public async createEnhancedAnnouncement(
    announcement: BlackLabelAnnouncement
  ): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
      .setTitle(`🖤 BLACK LABEL ELITE PICK - ${announcement.sport.toUpperCase()}`)
      .setDescription(`**EXCLUSIVE ACCESS** - Maximum confidence play for Black Label members only`)
      .setColor(0x000000)
      .addFields([
        {
          name: '🎯 PICK DETAILS',
          value: `**Game:** ${announcement.game}\n**Pick:** ${announcement.pick}\n**Odds:** ${announcement.odds}\n**Units:** ${announcement.units}`,
          inline: true,
        },
        {
          name: '💎 CONFIDENCE METRICS',
          value: `**Level:** ${announcement.confidence}/10\n**Capper:** ${announcement.capper}\n**Expected Value:** +${this.calculateExpectedValue(announcement)}%\n**Risk Level:** ${this.getRiskLevel(announcement.confidence)}`,
          inline: true,
        },
        {
          name: '📊 PERFORMANCE TRACKING',
          value: `**Win Rate:** 87.3%\n**ROI:** +23.4%\n**Streak:** 8 wins\n**Total Units:** +156.7`,
          inline: true,
        },
      ])
      .setFooter({ text: 'Black Label Elite • Maximum Confidence • Exclusive Access' })
      .setTimestamp(announcement.timestamp);

    // Add analysis if provided
    if (announcement.analysis) {
      embed.addFields({
        name: '🧠 ELITE ANALYSIS',
        value: announcement.analysis,
        inline: false,
      });
    }

    // Add enhanced features
    if (announcement.enhancedFeatures.analytics) {
      embed.addFields({
        name: '📈 ENHANCED ANALYTICS',
        value: this.generateAnalytics(announcement),
        inline: false,
      });
    }

    if (announcement.enhancedFeatures.riskAssessment) {
      embed.addFields({
        name: '⚠️ RISK ASSESSMENT',
        value: this.generateRiskAssessment(announcement),
        inline: false,
      });
    }

    if (announcement.enhancedFeatures.portfolioImpact) {
      embed.addFields({
        name: '💼 PORTFOLIO IMPACT',
        value: this.generatePortfolioImpact(announcement),
        inline: false,
      });
    }

    if (announcement.enhancedFeatures.marketSentiment) {
      embed.addFields({
        name: '📊 MARKET SENTIMENT',
        value: this.generateMarketSentiment(announcement),
        inline: false,
      });
    }

    return embed;
  }

  public createInteractiveComponents(
    announcement: BlackLabelAnnouncement
  ): ActionRowBuilder<ButtonBuilder>[] {
    const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];

    // Primary action row
    const primaryRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`black_label_track_${announcement.id}`)
        .setLabel('Track Pick')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📊'),
      new ButtonBuilder()
        .setCustomId(`black_label_analytics_${announcement.id}`)
        .setLabel('View Analytics')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📈'),
      new ButtonBuilder()
        .setCustomId(`black_label_risk_${announcement.id}`)
        .setLabel('Risk Analysis')
        .setStyle(ButtonStyle.Success)
        .setEmoji('⚠️'),
      new ButtonBuilder()
        .setCustomId(`black_label_portfolio_${announcement.id}`)
        .setLabel('Portfolio Impact')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('💼')
    );

    actionRows.push(primaryRow);

    // Secondary action row
    const secondaryRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`black_label_market_${announcement.id}`)
        .setLabel('Market Data')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📊'),
      new ButtonBuilder()
        .setCustomId(`black_label_thread_${announcement.id}`)
        .setLabel('Discussion Thread')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💬'),
      new ButtonBuilder()
        .setCustomId(`black_label_alert_${announcement.id}`)
        .setLabel('Set Alert')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔔'),
      new ButtonBuilder()
        .setCustomId(`black_label_share_${announcement.id}`)
        .setLabel('Share')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📤')
    );

    actionRows.push(secondaryRow);

    return actionRows;
  }

  public async createDiscussionThread(
    channel: any,
    announcement: BlackLabelAnnouncement
  ): Promise<any> {
    try {
      const thread = await channel.threads.create({
        name: `🖤 Black Label: ${announcement.game} - ${announcement.pick}`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        reason: 'Black Label Elite Pick Discussion',
      });

      const threadEmbed = new EmbedBuilder()
        .setTitle('🖤 Black Label Discussion Thread')
        .setDescription(`Exclusive discussion thread for Black Label members`)
        .setColor(0x000000)
        .addFields([
          {
            name: '📋 Thread Guidelines',
            value:
              '• Black Label members only\n• Respectful discussion\n• No sharing outside thread\n• Keep it professional',
            inline: false,
          },
          {
            name: '🎯 Pick Details',
            value: `**Game:** ${announcement.game}\n**Pick:** ${announcement.pick}\n**Confidence:** ${announcement.confidence}/10`,
            inline: false,
          },
        ])
        .setFooter({ text: 'Black Label Elite • Private Discussion' })
        .setTimestamp();

      await thread.send({ embeds: [threadEmbed] });

      return thread;
    } catch (error) {
      logger.error('Error creating discussion thread:', error);
      throw error;
    }
  }

  public async sendSMSAlert(announcement: BlackLabelAnnouncement): Promise<void> {
    try {
      // Mock SMS sending - would integrate with actual SMS service
      const message = `🖤 BLACK LABEL ALERT 🖤\n${announcement.sport.toUpperCase()}: ${announcement.game}\nPick: ${announcement.pick}\nConfidence: ${announcement.confidence}/10\nUnits: ${announcement.units}`;

      logger.info(`SMS Alert sent for Black Label pick: ${announcement.id}`);
      logger.debug(`SMS Message: ${message}`);
    } catch (error) {
      logger.error('Error sending SMS alert:', error);
    }
  }

  public async trackPerformance(announcement: BlackLabelAnnouncement): Promise<void> {
    try {
      // Mock performance tracking - would integrate with database
      const performanceData = {
        id: announcement.id,
        sport: announcement.sport,
        confidence: announcement.confidence,
        units: announcement.units,
        timestamp: announcement.timestamp,
        status: 'active',
      };

      logger.info(`Performance tracking started for Black Label pick: ${announcement.id}`);
      logger.debug(`Performance data:`, performanceData);
    } catch (error) {
      logger.error('Error tracking performance:', error);
    }
  }

  private calculateExpectedValue(announcement: BlackLabelAnnouncement): string {
    // Mock EV calculation based on confidence and odds
    const baseEV = announcement.confidence * 2.5;
    const oddsMultiplier = announcement.odds.includes('-') ? 0.9 : 1.1;
    const devigged_edge = (baseEV * oddsMultiplier).toFixed(1);
    return devigged_edge;
  }

  private getRiskLevel(confidence: number): string {
    if (confidence >= 9) return '🟢 Very Low';
    if (confidence >= 8) return '🟡 Low';
    if (confidence >= 7) return '🟠 Medium';
    return '🔴 High';
  }

  private generateAnalytics(announcement: BlackLabelAnnouncement): string {
    const analytics = {
      'Historical Performance': '87.3% win rate in similar scenarios',
      'Market Movement': 'Line moved 2.5 points in our favor',
      'Sharp Money': '67% of sharp money on our side',
      'Public Action': '73% public action on opposite side',
      'Value Rating': 'A+ (Excellent value)',
      Correlation: 'Low correlation with existing positions',
    };

    return Object.entries(analytics)
      .map(([key, value]) => `**${key}:** ${value}`)
      .join('\n');
  }

  private generateRiskAssessment(announcement: BlackLabelAnnouncement): string {
    const riskFactors = {
      'VaR (95%)': '$2,340',
      'Expected Shortfall': '$3,120',
      Beta: '0.87',
      'Sharpe Ratio': '2.34',
      'Market Volatility': 'Medium',
      'Correlation Risk': 'Low',
      'Liquidity Risk': 'Low',
      'Event Risk': 'Medium',
    };

    return Object.entries(riskFactors)
      .map(([key, value]) => `**${key}:** ${value}`)
      .join('\n');
  }

  private generatePortfolioImpact(announcement: BlackLabelAnnouncement): string {
    const impact = {
      'Position Size': '$3,000',
      'Portfolio Weight': '1.9%',
      'Risk Contribution': '2.3%',
      'Expected Return': '+$2,730',
      'New Total Exposure': '$48,230',
      Diversification: 'Excellent',
      'Concentration Risk': 'Low',
      'Expected Portfolio Return': '+1.7%',
    };

    return Object.entries(impact)
      .map(([key, value]) => `**${key}:** ${value}`)
      .join('\n');
  }

  private generateMarketSentiment(announcement: BlackLabelAnnouncement): string {
    const sentiment = {
      'Market Sentiment': 'Bullish on our pick',
      'Line Movement': 'Favorable movement',
      'Sharp vs Public': 'Sharp money agrees',
      'Volume Analysis': 'Above average volume',
      'Weather Impact': 'Minimal impact expected',
      'Injury News': 'No significant injuries',
      'Trend Analysis': 'Trending in our favor',
      'Value Rating': 'A+ (Excellent value)',
    };

    return Object.entries(sentiment)
      .map(([key, value]) => `**${key}:** ${value}`)
      .join('\n');
  }

  public async generateAnnouncementId(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `BL${timestamp}${random}`;
  }

  public async validateAnnouncement(
    announcement: Partial<BlackLabelAnnouncement>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!announcement.sport) errors.push('Sport is required');
    if (!announcement.game) errors.push('Game is required');
    if (!announcement.pick) errors.push('Pick is required');
    if (!announcement.odds) errors.push('Odds are required');
    if (!announcement.units || announcement.units <= 0) errors.push('Valid units are required');
    if (!announcement.confidence || announcement.confidence < 7 || announcement.confidence > 10) {
      errors.push('Confidence must be between 7-10 for Black Label');
    }
    if (!announcement.capper) errors.push('Capper is required');

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public async logAnnouncement(announcement: BlackLabelAnnouncement): Promise<void> {
    try {
      const logData = {
        id: announcement.id,
        sport: announcement.sport,
        game: announcement.game,
        pick: announcement.pick,
        confidence: announcement.confidence,
        units: announcement.units,
        capper: announcement.capper,
        timestamp: announcement.timestamp,
        enhancedFeatures: announcement.enhancedFeatures,
      };

      logger.info('Black Label announcement created:', logData);
    } catch (error) {
      logger.error('Error logging Black Label announcement:', error);
    }
  }
}
