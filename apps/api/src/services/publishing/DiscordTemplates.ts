/**
 * Discord Message Templates Configuration
 *
 * Provides configurable message templates for Discord publishing
 * with support for canonical entities, CLV data, and professional insights.
 *
 * Phase 2 Step 4 - Publishing Hardening
 */

import { EmbedBuilder } from 'discord.js';

export interface PickContext {
  // Pick identifiers
  pickId: string;
  tenantId: string;

  // Canonical entities
  canonicalPlayerId?: string;
  canonicalGameId?: string;
  playerName: string;
  teamName?: string;
  opponentName?: string;

  // Pick details
  sport: string;
  statType: string;
  line: number;
  pickSide: 'over' | 'under';
  odds: string;
  units: number;

  // Grading & quality
  tier?: string;
  confidence?: number;
  professionalScore?: number;

  // CLV data
  clvValue?: number;
  clvPercentage?: number;
  openingOdds?: string;
  closingOdds?: string;

  // Professional insights
  steamDetected?: boolean;
  lineShoppingEdge?: number;
  optimalTimingScore?: number;
  publicVsSharpSplit?: string;

  // Metadata
  capper: string;
  timestamp: Date;
  source: string; // 'legacy' | 'canonical' | 'professional'
}

export interface GradedPickContext extends PickContext {
  result: 'win' | 'loss' | 'push';
  actualValue?: number;
  margin?: number;
  settledAt: Date;
}

export interface RecapContext {
  date: string;
  sport?: string;
  capper?: string;
  totalPicks: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  roi: number;
  totalUnits: number;
  avgCLV: number;
  topPicks: PickContext[];
}

export type MessageType = 'new_pick' | 'graded_pick' | 'daily_recap' | 'weekly_recap';

/**
 * Discord template renderer
 */
export class DiscordTemplates {
  /**
   * Render new pick announcement
   */
  static renderNewPick(context: PickContext): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`${this.getSportEmoji(context.sport)} NEW PICK - ${context.sport.toUpperCase()}`)
      .setDescription(this.formatPickDescription(context))
      .setColor(this.getTierColor(context.tier))
      .setTimestamp(context.timestamp);

    // Main pick details
    embed.addFields([
      {
        name: '🎯 Pick Details',
        value: this.formatPickDetails(context),
        inline: true,
      },
      {
        name: '📊 Confidence',
        value: this.formatConfidence(context),
        inline: true,
      },
    ]);

    // Add CLV data if available
    if (context.clvValue || context.clvPercentage) {
      embed.addFields({
        name: '💰 Closing Line Value (CLV)',
        value: this.formatCLV(context),
        inline: false,
      });
    }

    // Add professional insights if available
    if (context.professionalScore || context.steamDetected) {
      embed.addFields({
        name: '🔬 Professional Insights',
        value: this.formatProfessionalInsights(context),
        inline: false,
      });
    }

    // Capper and metadata
    embed.setFooter({
      text: `${context.capper} • ${context.source} pipeline • ID: ${context.pickId}`,
    });

    return embed;
  }

  /**
   * Render graded pick result
   */
  static renderGradedPick(context: GradedPickContext): EmbedBuilder {
    const resultEmoji = context.result === 'win' ? '✅' : context.result === 'loss' ? '❌' : '➖';
    const resultColor = context.result === 'win' ? 0x00ff00 : context.result === 'loss' ? 0xff0000 : 0xffff00;

    const embed = new EmbedBuilder()
      .setTitle(`${resultEmoji} GRADED - ${context.playerName} ${context.pickSide.toUpperCase()} ${context.line}`)
      .setDescription(this.formatGradedDescription(context))
      .setColor(resultColor)
      .setTimestamp(context.settledAt);

    embed.addFields([
      {
        name: '🎯 Original Pick',
        value: this.formatPickDetails(context),
        inline: true,
      },
      {
        name: '📈 Result',
        value: this.formatGradedResult(context),
        inline: true,
      },
    ]);

    // Add CLV performance if available
    if (context.clvValue) {
      embed.addFields({
        name: '💰 CLV Performance',
        value: this.formatCLVPerformance(context),
        inline: false,
      });
    }

    embed.setFooter({
      text: `${context.capper} • Settled ${this.formatTimestamp(context.settledAt)} • ID: ${context.pickId}`,
    });

    return embed;
  }

  /**
   * Render daily recap
   */
  static renderDailyRecap(context: RecapContext): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`📊 Daily Recap - ${context.date}`)
      .setDescription(this.formatRecapSummary(context))
      .setColor(0x5865f2)
      .setTimestamp();

    embed.addFields([
      {
        name: '🎯 Performance',
        value: this.formatRecapPerformance(context),
        inline: true,
      },
      {
        name: '💰 Units & ROI',
        value: this.formatRecapUnits(context),
        inline: true,
      },
    ]);

    // Add top picks if available
    if (context.topPicks && context.topPicks.length > 0) {
      embed.addFields({
        name: '🌟 Top Picks',
        value: this.formatTopPicks(context.topPicks),
        inline: false,
      });
    }

    embed.setFooter({
      text: `${context.capper || 'All Cappers'} • ${context.totalPicks} total picks`,
    });

    return embed;
  }

  /**
   * Format pick description
   */
  private static formatPickDescription(context: PickContext): string {
    return `**${context.playerName}** ${context.pickSide.toUpperCase()} ${context.line} ${context.statType}\n${context.teamName || ''} ${context.opponentName ? 'vs ' + context.opponentName : ''}`;
  }

  /**
   * Format pick details
   */
  private static formatPickDetails(context: PickContext): string {
    return [
      `**Player:** ${context.playerName}`,
      `**Stat:** ${context.statType}`,
      `**Line:** ${context.pickSide.toUpperCase()} ${context.line}`,
      `**Odds:** ${context.odds}`,
      `**Units:** ${context.units}`,
    ].join('\n');
  }

  /**
   * Format confidence metrics
   */
  private static formatConfidence(context: PickContext): string {
    const parts: string[] = [];

    if (context.tier) {
      parts.push(`**Tier:** ${context.tier}`);
    }

    if (context.confidence) {
      parts.push(`**Confidence:** ${context.confidence}/10`);
    }

    if (context.professionalScore) {
      parts.push(`**Pro Score:** ${context.professionalScore.toFixed(1)}/100`);
    }

    return parts.join('\n') || 'Standard pick';
  }

  /**
   * Format CLV data
   */
  private static formatCLV(context: PickContext): string {
    const parts: string[] = [];

    if (context.clvValue) {
      parts.push(`**Value:** ${context.clvValue > 0 ? '+' : ''}${context.clvValue.toFixed(2)} units`);
    }

    if (context.clvPercentage) {
      parts.push(`**Percentage:** ${context.clvPercentage > 0 ? '+' : ''}${context.clvPercentage.toFixed(1)}%`);
    }

    if (context.openingOdds && context.closingOdds) {
      parts.push(`**Movement:** ${context.openingOdds} → ${context.closingOdds}`);
    }

    return parts.join('\n');
  }

  /**
   * Format professional insights
   */
  private static formatProfessionalInsights(context: PickContext): string {
    const parts: string[] = [];

    if (context.steamDetected) {
      parts.push('🔥 **Steam Detected**');
    }

    if (context.lineShoppingEdge) {
      parts.push(`🛒 **Line Shopping Edge:** ${context.lineShoppingEdge.toFixed(1)}%`);
    }

    if (context.optimalTimingScore) {
      parts.push(`⏰ **Timing Score:** ${context.optimalTimingScore.toFixed(0)}/100`);
    }

    if (context.publicVsSharpSplit) {
      parts.push(`👥 **Public/Sharp:** ${context.publicVsSharpSplit}`);
    }

    return parts.join('\n');
  }

  /**
   * Format graded description
   */
  private static formatGradedDescription(context: GradedPickContext): string {
    const resultText = context.result === 'win' ? 'WON' : context.result === 'loss' ? 'LOST' : 'PUSHED';
    return `Pick ${resultText} • ${context.actualValue !== undefined ? `Actual: ${context.actualValue}` : 'Settled'}`;
  }

  /**
   * Format graded result
   */
  private static formatGradedResult(context: GradedPickContext): string {
    const parts: string[] = [];

    parts.push(`**Result:** ${context.result.toUpperCase()}`);

    if (context.actualValue !== undefined) {
      parts.push(`**Actual:** ${context.actualValue}`);
      parts.push(`**Line:** ${context.line}`);
    }

    if (context.margin !== undefined) {
      parts.push(`**Margin:** ${context.margin > 0 ? '+' : ''}${context.margin}`);
    }

    parts.push(`**Units:** ${context.result === 'win' ? '+' : context.result === 'loss' ? '-' : ''}${context.units}`);

    return parts.join('\n');
  }

  /**
   * Format CLV performance
   */
  private static formatCLVPerformance(context: GradedPickContext): string {
    const clvResult = context.result === 'win' && context.clvValue && context.clvValue > 0
      ? '✅ Positive CLV + Win'
      : context.result === 'win'
      ? '✅ Win (No CLV data)'
      : context.clvValue && context.clvValue > 0
      ? '⚠️ Positive CLV + Loss'
      : '❌ Negative CLV + Loss';

    return `${clvResult}\n**CLV:** ${context.clvValue ? (context.clvValue > 0 ? '+' : '') + context.clvValue.toFixed(2) : 'N/A'}`;
  }

  /**
   * Format recap summary
   */
  private static formatRecapSummary(context: RecapContext): string {
    const filter = context.sport || context.capper || 'All';
    return `Performance summary for ${filter} on ${context.date}`;
  }

  /**
   * Format recap performance
   */
  private static formatRecapPerformance(context: RecapContext): string {
    return [
      `**Record:** ${context.wins}-${context.losses}-${context.pushes}`,
      `**Win Rate:** ${(context.winRate * 100).toFixed(1)}%`,
      `**Avg CLV:** ${context.avgCLV > 0 ? '+' : ''}${context.avgCLV.toFixed(2)}`,
    ].join('\n');
  }

  /**
   * Format recap units
   */
  private static formatRecapUnits(context: RecapContext): string {
    return [
      `**Total Units:** ${context.totalUnits > 0 ? '+' : ''}${context.totalUnits.toFixed(2)}`,
      `**ROI:** ${(context.roi * 100).toFixed(1)}%`,
    ].join('\n');
  }

  /**
   * Format top picks
   */
  private static formatTopPicks(picks: PickContext[]): string {
    return picks.slice(0, 3).map((pick, index) =>
      `${index + 1}. ${pick.playerName} ${pick.pickSide.toUpperCase()} ${pick.line} ${pick.statType}`
    ).join('\n');
  }

  /**
   * Get sport emoji
   */
  private static getSportEmoji(sport: string): string {
    const emojis: Record<string, string> = {
      nfl: '🏈',
      nba: '🏀',
      mlb: '⚾',
      nhl: '🏒',
      ncaaf: '🏈',
      ncaab: '🏀',
      wnba: '🏀',
    };
    return emojis[sport.toLowerCase()] || '🎯';
  }

  /**
   * Get tier color
   */
  private static getTierColor(tier?: string): number {
    if (!tier) return 0x5865f2; // Default blue

    const colors: Record<string, number> = {
      'S-tier': 0xff0000, // Red
      'A-tier': 0xff8c00, // Orange
      'B-tier': 0xffd700, // Gold
      'C-tier': 0x00ff00, // Green
    };

    return colors[tier] || 0x5865f2;
  }

  /**
   * Format timestamp
   */
  private static formatTimestamp(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)}h ago`;
    } else {
      return `${Math.floor(diffMins / 1440)}d ago`;
    }
  }
}
