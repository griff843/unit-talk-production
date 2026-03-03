import { EmbedBuilder, AttachmentBuilder } from 'discord.js';

import { AlertData, AlertType } from './DiscordAlertRouter';

/**
 * Enhanced Fortune 100-grade Discord message formatter
 * Provides premium visual experience with rich analytics, logos, and insights
 */
export class EnhancedDiscordFormatter {
  /**
   * Create enhanced pick embed with premium features
   */
  static createEnhancedPickEmbed(alertData: AlertData, alertType: AlertType): EmbedBuilder {
    const embed = new EmbedBuilder().setTimestamp().setFooter({
      text: 'Unit Talk Intelligence System • Fortune 100 Analytics',
      iconURL: 'https://cdn.discordapp.com/attachments/your-cdn/unit-talk-logo.png',
    });

    // Set color based on tier and live status
    const colors = {
      'S-tier': alertData.isLive ? 0xff0000 : 0xffd700, // Red for live, Gold for S-tier
      'A-tier': alertData.isLive ? 0xff4500 : 0x00ff00, // OrangeRed for live, Green for A-tier
      'B-tier': alertData.isLive ? 0xff6347 : 0x1e90ff, // Tomato for live, Blue for B-tier
      'C-tier': alertData.isLive ? 0xff69b4 : 0x9370db, // Hot pink for live, Purple for C-tier
    };

    const tierColor = colors[alertData.systemGrade as keyof typeof colors] || 0x808080;
    embed.setColor(tierColor);

    if (alertType === 'pick_post') {
      return this.formatEnhancedPickPost(embed, alertData);
    } else {
      return this.formatEnhancedAlert(embed, alertData, alertType);
    }
  }

  /**
   * Enhanced pick post with Fortune 100 analytics
   */
  private static formatEnhancedPickPost(embed: EmbedBuilder, alertData: AlertData): EmbedBuilder {
    const isLive = alertData.isLive;
    const liveIndicator = isLive ? '🔴 **LIVE**' : '';

    embed
      .setTitle(
        `${liveIndicator} ${this.getTierEmoji(alertData.systemGrade)} ${alertData.pickType?.toUpperCase()} PICK`
      )
      .setDescription(
        `**${alertData.capper}** • ${alertData.sport}${isLive ? ' • **LIVE BETTING**' : ''}`
      );

    // Main selection with enhanced formatting
    embed.addFields({
      name: '🎯 Selection',
      value: `**${alertData.selection}** \`${alertData.odds}\``,
      inline: false,
    });

    // Core metrics in premium layout
    embed.addFields([
      {
        name: '💎 System Grade',
        value: `${this.getTierEmoji(alertData.systemGrade)} **${alertData.systemGrade}**`,
        inline: true,
      },
      {
        name: '🎲 Units',
        value: `**${alertData.units}** ${this.getUnitsEmoji(alertData.units || 1)}`,
        inline: true,
      },
      {
        name: '📊 Confidence',
        value: `**${alertData.confidence}%** ${this.getConfidenceBar(alertData.confidence || 0)}`,
        inline: true,
      },
    ]);

    // Enhanced analytics section (if available in metadata)
    if (alertData.metadata?.analysis) {
      embed.addFields({
        name: '🧠 AI Analysis',
        value: `${alertData.metadata.analysis}`,
        inline: false,
      });
    }

    // Add advanced metrics if available
    if (alertData.metadata?.edgeScore) {
      embed.addFields([
        {
          name: '⚡ Edge Score',
          value: `**${alertData.metadata.edgeScore}%**`,
          inline: true,
        },
        {
          name: '🎯 Expected Value',
          value: `**+${alertData.metadata.expectedValue || 'N/A'}%**`,
          inline: true,
        },
        {
          name: '📈 Kelly %',
          value: `**${alertData.metadata.kellyFraction || 'N/A'}%**`,
          inline: true,
        },
      ]);
    }

    // Risk assessment
    if (alertData.metadata?.riskScore) {
      const riskLevel = this.getRiskLevel(alertData.metadata.riskScore);
      embed.addFields({
        name: '⚠️ Risk Assessment',
        value: `${riskLevel.emoji} **${riskLevel.label}** Risk (${alertData.metadata.riskScore}/10)`,
        inline: false,
      });
    }

    return embed;
  }

  /**
   * Enhanced alert formatting with rich context
   */
  private static formatEnhancedAlert(
    embed: EmbedBuilder,
    alertData: AlertData,
    alertType: AlertType
  ): EmbedBuilder {
    switch (alertType) {
      case 'hedge_opportunity':
        return embed
          .setTitle('🔄 **HEDGE OPPORTUNITY DETECTED**')
          .setDescription(
            `**${alertData.capper}** • ${alertData.sport} • ${this.getTierEmoji(alertData.systemGrade)} **${alertData.systemGrade}**`
          )
          .addFields([
            {
              name: '🎯 Original Position',
              value: `**${alertData.selection}** \`${alertData.odds}\` • ${alertData.units} units`,
              inline: false,
            },
            {
              name: '🔄 Hedge Setup',
              value: alertData.hedgeDetails || 'Arbitrage opportunity detected',
              inline: false,
            },
            {
              name: '💰 Guaranteed Profit',
              value: `${alertData.expectedProfit || 'Profit calculation available'}`,
              inline: false,
            },
            {
              name: '⏰ Action Required',
              value: '**Move quickly** - hedge opportunities close fast!',
              inline: false,
            },
          ])
          .setColor(0x00ff00);

      case 'injury_impact':
        return embed
          .setTitle('🏥 **INJURY IMPACT ALERT**')
          .setDescription(`**${alertData.capper}** • ${alertData.sport} • High Impact Detected`)
          .addFields([
            {
              name: '🎯 Affected Pick',
              value: `**${alertData.selection}** \`${alertData.odds}\` • ${alertData.units} units • ${this.getTierEmoji(alertData.systemGrade)} ${alertData.systemGrade}`,
              inline: false,
            },
            {
              name: '⚠️ Injury Report',
              value: alertData.injuryDetails || 'Significant player status change detected',
              inline: false,
            },
            {
              name: '📊 Impact Analysis',
              value: alertData.impact || 'Analyzing impact on pick probability...',
              inline: false,
            },
            {
              name: '🎯 Recommendation',
              value: '**Monitor closely** - Consider position adjustment if status confirmed',
              inline: false,
            },
          ])
          .setColor(0xff0000);

      case 'steam_move':
        return embed
          .setTitle('🚀 **STEAM MOVE DETECTED**')
          .setDescription(`**${alertData.capper}** • ${alertData.sport} • Sharp Money Alert`)
          .addFields([
            {
              name: '🎯 Target Pick',
              value: `**${alertData.selection}** \`${alertData.odds}\` • ${alertData.units} units • ${this.getTierEmoji(alertData.systemGrade)} ${alertData.systemGrade}`,
              inline: false,
            },
            {
              name: '📊 Sharp Action Detected',
              value: alertData.steamDetails || 'Coordinated professional betting activity detected',
              inline: false,
            },
            {
              name: '⚡ Market Intelligence',
              value: '**Professional syndicates** moving significant volume on this line',
              inline: false,
            },
            {
              name: '🎯 Action Window',
              value: '**ACT IMMEDIATELY** - Steam moves create narrow windows of opportunity',
              inline: false,
            },
          ])
          .setColor(0x00bfff);

      case 'middle_opportunity':
        return embed
          .setTitle('🎯 **MIDDLE OPPORTUNITY DETECTED**')
          .setDescription(`**${alertData.capper}** • ${alertData.sport} • Win-Win Scenario`)
          .addFields([
            {
              name: '🎲 Middle Setup',
              value: alertData.middleSetup || 'Both sides of spread available for middle',
              inline: false,
            },
            {
              name: '💵 Win Scenario',
              value: alertData.potentialWin || 'Potential to win both bets',
              inline: false,
            },
            {
              name: '📊 Probability Analysis',
              value: 'Calculating optimal bet sizing for maximum expected value...',
              inline: false,
            },
          ])
          .setColor(0xffa500);

      default:
        return embed
          .setTitle(this.getAlertTitle(alertType))
          .setDescription(`**${alertData.capper}** • ${alertData.sport}`)
          .setColor(this.getAlertColor(alertType));
    }
  }

  /**
   * Get tier emoji for visual hierarchy
   */
  private static getTierEmoji(tier?: string): string {
    const emojis = {
      'S-tier': '👑',
      'A-tier': '💎',
      'B-tier': '🔥',
      'C-tier': '⭐',
      'D-tier': '📊',
    };
    return emojis[tier as keyof typeof emojis] || '📊';
  }

  /**
   * Get units emoji for bet sizing
   */
  private static getUnitsEmoji(units: number): string {
    if (units >= 5) {
      return '🚀';
    }
    if (units >= 3) {
      return '💪';
    }
    if (units >= 2) {
      return '👍';
    }
    return '📝';
  }

  /**
   * Generate confidence bar visualization
   */
  private static getConfidenceBar(confidence: number): string {
    const bars = Math.floor(confidence / 10);
    const filled = '█'.repeat(Math.min(bars, 10));
    const empty = '░'.repeat(10 - Math.min(bars, 10));
    return `\`${filled}${empty}\``;
  }

  /**
   * Risk level assessment
   */
  private static getRiskLevel(riskScore: number): { emoji: string; label: string } {
    if (riskScore <= 3) {
      return { emoji: '🟢', label: 'Low' };
    }
    if (riskScore <= 6) {
      return { emoji: '🟡', label: 'Moderate' };
    }
    if (riskScore <= 8) {
      return { emoji: '🟠', label: 'High' };
    }
    return { emoji: '🔴', label: 'Very High' };
  }

  /**
   * Alert title mapping
   */
  private static getAlertTitle(alertType: AlertType): string {
    const titles = {
      hedge_opportunity: '🔄 Hedge Opportunity',
      middle_opportunity: '🎯 Middle Opportunity',
      injury_impact: '🏥 Injury Alert',
      steam_move: '🚀 Steam Move',
      line_movement: '📈 Line Movement',
      stale_line: '⏰ Stale Line',
      pick_post: '📊 Pick Alert',
      system_error: '🚨 System Error',
      processing_error: '⚠️ Processing Error',
    };
    return titles[alertType] || '📢 Alert';
  }

  /**
   * Alert color mapping
   */
  private static getAlertColor(alertType: AlertType): number {
    const colors = {
      hedge_opportunity: 0x00ff00, // Green
      middle_opportunity: 0xffa500, // Orange
      injury_impact: 0xff0000, // Red
      steam_move: 0x00bfff, // Blue
      line_movement: 0xffff00, // Yellow
      stale_line: 0x800080, // Purple
      pick_post: 0x0099ff, // Blue
      system_error: 0xff0000, // Red
      processing_error: 0xffa500, // Orange
    };
    return colors[alertType] || 0x808080;
  }

  /**
   * Generate chart/graph attachments for advanced analytics
   */
  static async generateAnalyticsChart(_alertData: AlertData): Promise<AttachmentBuilder | null> {
    // TODO: Implement chart generation using Chart.js or similar
    // This would generate confidence trends, risk breakdowns, etc.
    return null;
  }

  /**
   * Create team logo attachment
   */
  static async getTeamLogo(teamName: string): Promise<string | null> {
    // TODO: Implement team logo lookup
    // Integration with ESPN API, team logo databases, or local assets
    const logoMappings: Record<string, string> = {
      Lakers: 'https://cdn.nba.com/logos/nba/1610612747/global/L/logo.svg',
      Celtics: 'https://cdn.nba.com/logos/nba/1610612738/global/L/logo.svg',
      Chiefs: 'https://static.www.nfl.com/league/api/clubs/logos/KC.svg',
      Yankees: 'https://www.mlbstatic.com/team-logos/147.svg',
      // Add more teams as needed
    };

    return logoMappings[teamName] || null;
  }

  /**
   * Create player headshot attachment
   */
  static async getPlayerHeadshot(_playerName: string): Promise<string | null> {
    // TODO: Implement player headshot lookup
    // Integration with sports APIs or headshot databases
    return null;
  }
}
