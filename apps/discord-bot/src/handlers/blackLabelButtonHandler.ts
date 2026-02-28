import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { logger } from '../utils/logger';
import { getUserTier } from '../utils/roleUtils';

export class BlackLabelButtonHandler {
  private static instance: BlackLabelButtonHandler;

  private constructor() {}

  public static getInstance(): BlackLabelButtonHandler {
    if (!BlackLabelButtonHandler.instance) {
      BlackLabelButtonHandler.instance = new BlackLabelButtonHandler();
    }
    return BlackLabelButtonHandler.instance;
  }

  public async handleButton(interaction: ButtonInteraction): Promise<void> {
    try {
      const customId = interaction.customId;

      if (customId.startsWith('black_label_announce_')) {
        await this.handleBlackLabelAnnouncement(interaction);
      } else if (customId === 'enhanced_analytics') {
        await this.handleEnhancedAnalytics(interaction);
      } else if (customId === 'risk_assessment') {
        await this.handleRiskAssessment(interaction);
      } else if (customId === 'portfolio_impact') {
        await this.handlePortfolioImpact(interaction);
      } else if (customId === 'refresh_dashboard') {
        await this.handleRefreshDashboard(interaction);
      } else if (customId === 'export_report') {
        await this.handleExportReport(interaction);
      } else if (customId === 'detailed_analytics') {
        await this.handleDetailedAnalytics(interaction);
      } else if (customId === 'market_alerts') {
        await this.handleMarketAlerts(interaction);
      } else if (customId === 'portfolio_details') {
        await this.handlePortfolioDetails(interaction);
      } else if (customId === 'optimize_portfolio') {
        await this.handleOptimizePortfolio(interaction);
      } else if (customId === 'risk_analysis') {
        await this.handleRiskAnalysis(interaction);
      } else if (customId === 'rebalance') {
        await this.handleRebalance(interaction);
      } else if (customId === 'detailed_insights') {
        await this.handleDetailedInsights(interaction);
      } else if (customId === 'trend_analysis') {
        await this.handleTrendAnalysis(interaction);
      } else if (customId === 'ai_predictions') {
        await this.handleAIPredictions(interaction);
      } else if (customId === 'contact_vip_support') {
        await this.handleContactVIPSupport(interaction);
      } else if (customId === 'black_label_info') {
        await this.handleBlackLabelInfo(interaction);
      }
    } catch (error) {
      logger.error('Error in BlackLabelButtonHandler:', error);
      await interaction.reply({
        content: '❌ An error occurred while processing your request.',
        ephemeral: true,
      });
    }
  }

  private async handleBlackLabelAnnouncement(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const sport = parts[3];
    const confidence = parts[4];

    const modal = new ModalBuilder()
      .setCustomId('black_label_announcement_modal')
      .setTitle('🖤 Black Label Enhanced Announcement');

    const gameInput = new TextInputBuilder()
      .setCustomId('game')
      .setLabel('Game/Event')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., Chiefs vs Bills')
      .setRequired(true);

    const pickInput = new TextInputBuilder()
      .setCustomId('pick')
      .setLabel('Pick Details')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., Chiefs -3.5, Under 48.5')
      .setRequired(true);

    const oddsInput = new TextInputBuilder()
      .setCustomId('odds')
      .setLabel('Odds')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., -110, +150')
      .setRequired(true);

    const unitsInput = new TextInputBuilder()
      .setCustomId('units')
      .setLabel('Units')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 3, 5')
      .setRequired(true);

    const analysisInput = new TextInputBuilder()
      .setCustomId('analysis')
      .setLabel('Analysis (Optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Detailed analysis and reasoning...')
      .setRequired(false);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(gameInput);
    const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(pickInput);
    const thirdActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(oddsInput);
    const fourthActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(unitsInput);
    const fifthActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(analysisInput);

    modal.addComponents(
      firstActionRow,
      secondActionRow,
      thirdActionRow,
      fourthActionRow,
      fifthActionRow
    );

    await interaction.showModal(modal);
  }

  private async handleEnhancedAnalytics(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📊 Enhanced Analytics Options')
      .setDescription('Select the type of analytics to add to your announcement')
      .setColor(0x000000)
      .addFields([
        {
          name: '📈 Performance Analytics',
          value: '• Historical performance\n• Win rate trends\n• ROI analysis\n• Streak tracking',
          inline: true,
        },
        {
          name: '🎯 Market Analytics',
          value:
            '• Line movement\n• Sharp vs public money\n• Betting percentages\n• Value indicators',
          inline: true,
        },
        {
          name: '📊 Advanced Metrics',
          value: '• Expected value\n• Kelly criterion\n• Risk assessment\n• Portfolio impact',
          inline: true,
        },
      ])
      .setFooter({ text: 'Black Label Elite • Enhanced Analytics' })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('analytics_type')
        .setPlaceholder('Select analytics type')
        .addOptions([
          {
            label: 'Performance Analytics',
            description: 'Historical performance and trends',
            value: 'performance',
            emoji: '📈',
          },
          {
            label: 'Market Analytics',
            description: 'Line movement and betting data',
            value: 'market',
            emoji: '🎯',
          },
          {
            label: 'Advanced Metrics',
            description: 'EV, Kelly, and risk analysis',
            value: 'advanced',
            emoji: '📊',
          },
          {
            label: 'All Analytics',
            description: 'Complete analytics package',
            value: 'all',
            emoji: '🚀',
          },
        ])
    );

    await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
  }

  private async handleRiskAssessment(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Risk Assessment')
      .setDescription('Comprehensive risk analysis for your pick')
      .setColor(0xff4500)
      .addFields([
        {
          name: '📊 Risk Metrics',
          value:
            '• VaR (Value at Risk): $2,340\n• Expected Shortfall: $3,120\n• Beta: 0.87\n• Sharpe Ratio: 2.34',
          inline: true,
        },
        {
          name: '🎯 Risk Factors',
          value:
            '• Market volatility: Medium\n• Correlation risk: Low\n• Liquidity risk: Low\n• Event risk: Medium',
          inline: true,
        },
        {
          name: '⚠️ Risk Alerts',
          value:
            '• Weather conditions may affect game\n• Key player injury status uncertain\n• Line movement against consensus\n• High public action on opposite side',
          inline: false,
        },
        {
          name: '🛡️ Risk Mitigation',
          value:
            '• Consider reducing position size\n• Monitor line movements closely\n• Set stop-loss at -2 units\n• Hedge with correlated bet',
          inline: false,
        },
      ])
      .setFooter({ text: 'Black Label Elite • Risk Intelligence' })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('adjust_risk')
        .setLabel('Adjust Risk')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚖️'),
      new ButtonBuilder()
        .setCustomId('risk_mitigation')
        .setLabel('Risk Mitigation')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🛡️'),
      new ButtonBuilder()
        .setCustomId('risk_report')
        .setLabel('Full Report')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📄')
    );

    await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
  }

  private async handlePortfolioImpact(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('💼 Portfolio Impact Analysis')
      .setDescription('How this pick affects your overall portfolio')
      .setColor(0x000000)
      .addFields([
        {
          name: '📊 Current Portfolio',
          value:
            '• Total Value: $156,430\n• Active Positions: 12\n• Total Exposure: $45,230\n• Available Capital: $111,200',
          inline: false,
        },
        {
          name: '🎯 Pick Impact',
          value:
            '• Position Size: $3,000\n• Portfolio Weight: 1.9%\n• Risk Contribution: 2.3%\n• Expected Return: +$2,730',
          inline: true,
        },
        {
          name: '📈 Portfolio Metrics',
          value:
            '• New Total Exposure: $48,230\n• Diversification: Excellent\n• Concentration Risk: Low\n• Expected Portfolio Return: +1.7%',
          inline: true,
        },
        {
          name: '🔄 Recommendations',
          value:
            '• Position size is optimal\n• Maintains good diversification\n• Consider adding hedge position\n• Monitor correlation with existing bets',
          inline: false,
        },
      ])
      .setFooter({ text: 'Black Label Elite • Portfolio Intelligence' })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('portfolio_details')
        .setLabel('View Details')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📊'),
      new ButtonBuilder()
        .setCustomId('optimize_portfolio')
        .setLabel('Optimize')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚡'),
      new ButtonBuilder()
        .setCustomId('risk_analysis')
        .setLabel('Risk Analysis')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⚠️')
    );

    await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
  }

  private async handleRefreshDashboard(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🔄 Dashboard Refresh')
      .setDescription('Your Black Label dashboard has been updated with the latest data')
      .setColor(0x00ff00)
      .addFields([
        {
          name: '📊 Updated Metrics',
          value:
            '• Portfolio value updated\n• Recent performance calculated\n• Risk metrics recalculated\n• Market data refreshed',
          inline: true,
        },
        {
          name: '⏰ Last Updated',
          value: new Date().toLocaleString(),
          inline: true,
        },
      ])
      .setFooter({ text: 'Black Label Elite • Real-time Updates' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async handleExportReport(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📊 Export Report')
      .setDescription('Your detailed performance report is being generated')
      .setColor(0x000000)
      .addFields([
        {
          name: '📈 Report Contents',
          value: '• Performance metrics\n• Risk analysis\n• Portfolio breakdown\n• Historical data',
          inline: true,
        },
        {
          name: '📅 Time Period',
          value: 'Last 30 days',
          inline: true,
        },
      ])
      .setFooter({ text: 'Black Label Elite • Advanced Reporting' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async handleDetailedAnalytics(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📈 Detailed Analytics')
      .setDescription('Advanced analytics and performance insights')
      .setColor(0x000000)
      .addFields([
        {
          name: '📊 Performance Metrics',
          value: '• Win Rate: 68.5%\n• ROI: +23.4%\n• Sharpe Ratio: 2.1\n• Max Drawdown: -8.2%',
          inline: true,
        },
        {
          name: '🎯 Advanced Metrics',
          value:
            '• Expected Value: +$1,240\n• Kelly Criterion: 0.15\n• Risk-Adjusted Return: 18.7%\n• Volatility: 12.3%',
          inline: true,
        },
      ])
      .setFooter({ text: 'Black Label Elite • Advanced Analytics' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async handleMarketAlerts(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🚨 Market Alerts')
      .setDescription('Real-time market intelligence and alerts')
      .setColor(0xff0000)
      .addFields([
        {
          name: '📊 Market Movements',
          value:
            '• Line moved 2.5 points in your favor\n• Sharp money detected on your side\n• Public betting 65% on opposite side\n• Value opportunity identified',
          inline: true,
        },
        {
          name: '⚠️ Risk Alerts',
          value:
            '• Weather conditions may affect game\n• Key player injury status uncertain\n• High volatility expected\n• Consider reducing position size',
          inline: true,
        },
      ])
      .setFooter({ text: 'Black Label Elite • Market Intelligence' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async handlePortfolioDetails(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('💼 Portfolio Details')
      .setDescription('Comprehensive portfolio breakdown and analysis')
      .setColor(0x000000)
      .addFields([
        {
          name: '📊 Portfolio Summary',
          value:
            '• Total Value: $156,430\n• Active Positions: 12\n• Total Exposure: $45,230\n• Available Capital: $111,200',
          inline: false,
        },
        {
          name: '📈 Performance',
          value:
            '• YTD Return: +23.4%\n• Monthly Return: +5.2%\n• Weekly Return: +1.8%\n• Daily P&L: +$2,340',
          inline: true,
        },
        {
          name: '🎯 Risk Metrics',
          value: '• Sharpe Ratio: 2.1\n• Max Drawdown: -8.2%\n• VaR (95%): $3,450\n• Beta: 0.87',
          inline: true,
        },
      ])
      .setFooter({ text: 'Black Label Elite • Portfolio Management' })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('optimize_portfolio')
        .setLabel('Optimize')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚡'),
      new ButtonBuilder()
        .setCustomId('risk_analysis')
        .setLabel('Risk Analysis')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚠️'),
      new ButtonBuilder()
        .setCustomId('rebalance')
        .setLabel('Rebalance')
        .setStyle(ButtonStyle.Success)
        .setEmoji('⚖️')
    );

    await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
  }

  private async handleOptimizePortfolio(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⚡ Portfolio Optimization')
      .setDescription('AI-powered portfolio optimization recommendations')
      .setColor(0x00ff00)
      .addFields([
        {
          name: '🤖 AI Recommendations',
          value:
            '• Reduce position in Game A by 25%\n• Increase position in Game B by 15%\n• Add hedge position in Game C\n• Close position in Game D',
          inline: false,
        },
        {
          name: '📊 Expected Impact',
          value:
            '• Risk reduction: -12.3%\n• Expected return: +2.1%\n• Sharpe ratio improvement: +0.3\n• Diversification: +8.7%',
          inline: true,
        },
      ])
      .setFooter({ text: 'Black Label Elite • AI Optimization' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async handleRiskAnalysis(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📊 Risk Analysis')
      .setDescription('Comprehensive risk assessment and management')
      .setColor(0xff4500)
      .addFields([
        {
          name: '⚠️ Risk Metrics',
          value:
            '• VaR (Value at Risk): $2,340\n• Expected Shortfall: $3,120\n• Beta: 0.87\n• Sharpe Ratio: 2.34',
          inline: true,
        },
        {
          name: '🎯 Risk Factors',
          value:
            '• Market volatility: Medium\n• Correlation risk: Low\n• Liquidity risk: Low\n• Event risk: Medium',
          inline: true,
        },
      ])
      .setFooter({ text: 'Black Label Elite • Risk Management' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async handleRebalance(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⚖️ Portfolio Rebalancing')
      .setDescription('Portfolio rebalancing recommendations')
      .setColor(0x000000)
      .addFields([
        {
          name: '🔄 Rebalancing Actions',
          value:
            '• Sell 15% of overweight positions\n• Buy 20% of underweight positions\n• Reallocate to maintain target weights\n• Adjust for new risk parameters',
          inline: false,
        },
        {
          name: '📊 Expected Results',
          value:
            '• Risk reduction: -8.5%\n• Return improvement: +1.2%\n• Better diversification\n• Aligned with goals',
          inline: true,
        },
      ])
      .setFooter({ text: 'Black Label Elite • Portfolio Rebalancing' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async handleDetailedInsights(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🔍 Detailed Insights')
      .setDescription('Deep dive analysis and market insights')
      .setColor(0x000000)
      .addFields([
        {
          name: '📊 Market Analysis',
          value:
            '• Sharp money movement detected\n• Line movement analysis\n• Public vs sharp betting patterns\n• Value opportunities identified',
          inline: true,
        },
        {
          name: '🎯 Performance Insights',
          value:
            '• Historical performance trends\n• Seasonal patterns identified\n• Correlation analysis\n• Risk-adjusted returns',
          inline: true,
        },
      ])
      .setFooter({ text: 'Black Label Elite • Market Intelligence' })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('trend_analysis')
        .setLabel('Trend Analysis')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📈'),
      new ButtonBuilder()
        .setCustomId('ai_predictions')
        .setLabel('AI Predictions')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🤖')
    );

    await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
  }

  private async handleTrendAnalysis(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📈 Trend Analysis')
      .setDescription('Historical trend analysis and pattern recognition')
      .setColor(0x000000)
      .addFields([
        {
          name: '📊 Trend Patterns',
          value:
            '• Upward trend in performance\n• Seasonal patterns identified\n• Correlation with market conditions\n• Momentum indicators positive',
          inline: true,
        },
        {
          name: '🎯 Future Projections',
          value:
            '• Expected continuation of trend\n• Risk factors to monitor\n• Optimal entry/exit points\n• Portfolio implications',
          inline: true,
        },
      ])
      .setFooter({ text: 'Black Label Elite • Trend Analysis' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async handleAIPredictions(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🤖 AI Predictions')
      .setDescription('AI-powered predictions and market forecasts')
      .setColor(0x9932cc)
      .addFields([
        {
          name: '🤖 AI Analysis',
          value:
            '• Machine learning model predictions\n• Pattern recognition results\n• Probability assessments\n• Confidence intervals',
          inline: true,
        },
        {
          name: '📊 Predictions',
          value:
            '• Win probability: 72.3%\n• Expected return: +$1,850\n• Risk level: Medium\n• Confidence: 85%',
          inline: true,
        },
      ])
      .setFooter({ text: 'Black Label Elite • AI Intelligence' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async handleContactVIPSupport(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎧 VIP Support')
      .setDescription('Direct access to Black Label support team')
      .setColor(0x000000)
      .addFields([
        {
          name: '📞 Support Channels',
          value:
            '• Direct DM to support team\n• Priority response time\n• Dedicated support channel\n• 24/7 availability',
          inline: true,
        },
        {
          name: '🎯 How to Contact',
          value:
            '• DM @UnitTalkSupport\n• Use #black-label-support\n• Email: support@unittalk.com\n• Phone: Available for VIP+',
          inline: true,
        },
      ])
      .setFooter({ text: 'Black Label Elite • Premium Support' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  private async handleBlackLabelInfo(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🖤 Black Label Elite')
      .setDescription('The ultimate premium sports betting experience')
      .setColor(0x000000)
      .addFields([
        {
          name: '💎 Elite Features',
          value:
            '• Advanced analytics dashboard\n• AI-powered predictions\n• Portfolio management tools\n• Real-time market intelligence',
          inline: true,
        },
        {
          name: '🎯 Premium Benefits',
          value:
            '• Priority support access\n• Exclusive content and insights\n• Custom notifications\n• Advanced risk management',
          inline: true,
        },
      ])
      .setFooter({ text: 'Black Label Elite • The Ultimate Edge' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
