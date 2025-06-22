import { EmbedBuilder } from 'discord.js';
import {
  RecapSummary,
  CapperStats,
  TierStats,
  ParlayGroup,
  MicroRecapData,
  RecapConfig,
  HotStreak
} from '../../types/picks';

/**
 * Enhanced RecapFormatter with production-ready features
 * Handles Discord embed generation with configurable features
 */
export class RecapFormatter {
  private config: RecapConfig;

  constructor(config?: Partial<RecapConfig>) {
    this.config = {
      legendFooter: process.env.LEGEND_FOOTER === 'true',
      microRecap: process.env.MICRO_RECAP === 'true',
      notionSync: process.env.NOTION_SYNC === 'true',
      clvDelta: process.env.CLV_DELTA === 'true',
      streakSparkline: process.env.STREAK_SPARKLINE === 'true',
      roiThreshold: parseFloat(process.env.ROI_THRESHOLD || '5.0'),
      microRecapCooldown: parseInt(process.env.MICRO_RECAP_COOLDOWN || '60'),
      slashCommands: process.env.SLASH_COMMANDS === 'true',
      metricsEnabled: process.env.METRICS_ENABLED !== 'false',
      metricsPort: parseInt(process.env.METRICS_PORT || '3001'),
      ...config
    };
  }

  /**
   * Build daily recap embed with enhanced features
   */
  buildDailyRecapEmbed(summary: RecapSummary, parlayGroups: ParlayGroup[] = []): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`📊 DAILY RECAP — ${this.formatDate(summary.date)}`)
      .setColor(summary.netUnits >= 0 ? 0x00ff00 : 0xff0000)
      .setTimestamp();

    // Performance summary
    const profitEmoji = summary.netUnits >= 0 ? '📈' : '📉';
    const unitsText = summary.netUnits >= 0 ? `+${summary.netUnits.toFixed(1)}U` : `${summary.netUnits.toFixed(1)}U`;
    
    embed.addFields({
      name: `${profitEmoji} Net: ${unitsText}`,
      value: `${summary.totalPicks}U Wagered • ${summary.wins}W-${summary.losses}L${summary.pushes > 0 ? `-${summary.pushes}P` : ''} • ${summary.winRate.toFixed(1)}% Win Rate`,
      inline: false
    });

    // Performance breakdown
    const avgEdgeText = summary.avgEdge > 0 ? `${summary.avgEdge.toFixed(1)}` : 'N/A';
    const clvText = this.config.clvDelta && summary.avgClvDelta !== undefined ? 
      ` • CLV Δ: ${summary.avgClvDelta > 0 ? '+' : ''}${summary.avgClvDelta.toFixed(1)}` : '';
    
    embed.addFields({
      name: '🎯 Performance Breakdown',
      value: `• Solo: ${this.getSoloStats(summary)}U wagered • ${this.getSoloWinRate(summary)}%\n` +
             `• Parlays: ${this.getParlayStats(parlayGroups)}U wagered • ${this.getParlayWinRate(parlayGroups)}%\n` +
             `• Total: ${summary.totalUnits}U wagered • ${unitsText}\n` +
             `• Avg Edge: ${avgEdgeText}${clvText}`,
      inline: false
    });

    // Solo picks section
    if (summary.totalPicks > 0) {
      const soloPicksText = this.buildSoloPicksText(summary);
      if (soloPicksText) {
        embed.addFields({
          name: '🏈 Solo Picks',
          value: soloPicksText,
          inline: false
        });
      }
    }

    // Parlay results
    if (parlayGroups.length > 0) {
      const parlayText = this.buildParlayText(parlayGroups);
      embed.addFields({
        name: '🎲 Parlay Results',
        value: parlayText,
        inline: false
      });
    }

    // Capper breakdown with sparklines
    if (summary.capperBreakdown.length > 0) {
      const capperText = this.buildCapperBreakdownText(summary.capperBreakdown);
      embed.addFields({
        name: '👥 Capper Breakdown',
        value: capperText,
        inline: false
      });
    }

    // Hot streaks
    if (summary.hotStreaks.length > 0) {
      const streakText = this.buildHotStreaksText(summary.hotStreaks);
      embed.addFields({
        name: '🔥 Hot Streaks',
        value: streakText,
        inline: false
      });
    }

    // Add legend footer if enabled
    if (this.config.legendFooter) {
      embed.setFooter({ 
        text: this.getLegendFooter() + ` • Generated in ${summary.metadata?.processingTimeMs || 0}ms`
      });
    } else {
      embed.setFooter({ 
        text: `Unit Talk • Recap Engine v${summary.metadata?.version || '3.0.0'} • Generated in ${summary.metadata?.processingTimeMs || 0}ms`
      });
    }

    return embed;
  }

  /**
   * Build weekly recap embed
   */
  buildWeeklyRecapEmbed(summary: RecapSummary, parlayGroups: ParlayGroup[] = []): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('📊 WEEKLY RECAP — TBD → TBD')
      .setColor(summary.netUnits >= 0 ? 0x00ff00 : 0xff0000)
      .setTimestamp();

    // Weekly performance
    const profitEmoji = summary.netUnits >= 0 ? '📈' : '📉';
    const unitsText = summary.netUnits >= 0 ? `+${summary.netUnits.toFixed(1)}U` : `${summary.netUnits.toFixed(1)}U`;
    
    embed.addFields({
      name: `${profitEmoji} Record: ${summary.wins}W - ${summary.losses}L`,
      value: `Net Units: ${unitsText}\n` +
             `ROI: ${summary.roi.toFixed(1)}%\n` +
             `Win Rate: ${summary.winRate.toFixed(1)}%\n` +
             `Avg Edge: ${summary.avgEdge.toFixed(1)}`,
      inline: false
    });

    // Capper breakdown
    if (summary.capperBreakdown.length > 0) {
      const capperText = this.buildWeeklyCapperText(summary.capperBreakdown);
      embed.addFields({
        name: '👥 Capper Breakdown',
        value: capperText,
        inline: false
      });
    }

    // Top cappers
    const topCappers = summary.capperBreakdown
      .filter(c => c.netUnits > 0)
      .sort((a, b) => b.netUnits - a.netUnits)
      .slice(0, 3);

    if (topCappers.length > 0) {
      const topCappersText = topCappers
        .map((capper, index) => {
          const medal = ['🥇', '🥈', '🥉'][index] || '🏆';
          return `${medal} ${capper.capper}: ${capper.netUnits > 0 ? '+' : ''}${capper.netUnits.toFixed(1)}U`;
        })
        .join('\n');

      embed.addFields({
        name: '🏆 Top Cappers',
        value: topCappersText,
        inline: false
      });
    }

    // Weekly highlights
    const highlights = this.buildWeeklyHighlights(summary);
    if (highlights) {
      embed.addFields({
        name: '💫 Weekly Highlights',
        value: highlights,
        inline: false
      });
    }

    // Tier breakdown
    if (summary.tierBreakdown.length > 0) {
      const tierText = this.buildTierBreakdownText(summary.tierBreakdown);
      embed.addFields({
        name: '📊 Tier Performance Breakdown',
        value: tierText,
        inline: false
      });
    }

    // Add legend footer if enabled
    if (this.config.legendFooter) {
      embed.setFooter({ text: this.getLegendFooter() });
    } else {
      embed.setFooter({ text: `Unit Talk • Weekly Recap Engine v${summary.metadata?.version || '3.0.0'}` });
    }

    return embed;
  }

  /**
   * Build monthly recap embed
   */
  buildMonthlyRecapEmbed(summary: RecapSummary, parlayGroups: ParlayGroup[] = []): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('📊 MONTHLY RECAP — TBD')
      .setColor(summary.netUnits >= 0 ? 0x00ff00 : 0xff0000)
      .setTimestamp();

    // Monthly performance
    const profitEmoji = summary.netUnits >= 0 ? '📈' : '📉';
    const unitsText = summary.netUnits >= 0 ? `+${summary.netUnits.toFixed(1)}U` : `${summary.netUnits.toFixed(1)}U`;
    
    embed.addFields({
      name: `${profitEmoji} Record: ${summary.wins}W - ${summary.losses}L`,
      value: `Net Units: ${unitsText}\n` +
             `ROI: ${summary.roi.toFixed(1)}%\n` +
             `Win Rate: ${summary.winRate.toFixed(1)}%\n` +
             `Avg Edge: ${summary.avgEdge.toFixed(1)}\n` +
             `$100/Better Profit: $${(summary.netUnits * 100).toFixed(0)}`,
      inline: false
    });

    // Capper of the month
    const topCapper = summary.capperBreakdown
      .sort((a, b) => b.netUnits - a.netUnits)[0];

    if (topCapper) {
      embed.addFields({
        name: '👑 Capper of the Month',
        value: `${topCapper.capper}: ${topCapper.netUnits > 0 ? '+' : ''}${topCapper.netUnits.toFixed(1)}U • ` +
               `${topCapper.winRate.toFixed(1)}% Win Rate • ` +
               `${topCapper.roi.toFixed(1)}% ROI`,
        inline: false
      });
    }

    // Monthly highlights
    const highlights = this.buildMonthlyHighlights(summary);
    if (highlights) {
      embed.addFields({
        name: '🌟 Monthly Highlights',
        value: highlights,
        inline: false
      });
    }

    // Tier breakdown
    if (summary.tierBreakdown.length > 0) {
      const tierText = this.buildTierBreakdownText(summary.tierBreakdown);
      embed.addFields({
        name: '📊 Tier Performance Breakdown',
        value: tierText,
        inline: false
      });
    }

    // Add legend footer if enabled
    if (this.config.legendFooter) {
      embed.setFooter({ text: this.getLegendFooter() });
    } else {
      embed.setFooter({ text: `Unit Talk • Monthly Recap Engine v${summary.metadata?.version || '3.0.0'}` });
    }

    return embed;
  }

  /**
   * Build micro-recap embed for instant notifications
   */
  buildMicroRecapEmbed(microData: MicroRecapData): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('⚡ MICRO-RECAP')
      .setColor(microData.dailyRoi >= 0 ? 0x00ff00 : 0xff0000)
      .setTimestamp();

    const triggerText = microData.trigger === 'last_pick_graded' ? 
      '🏁 All picks graded' : 
      `📊 ROI swing: ${microData.roiChange.toFixed(1)}U`;

    const roiText = microData.dailyRoi >= 0 ? 
      `+${microData.dailyRoi.toFixed(1)}%` : 
      `${microData.dailyRoi.toFixed(1)}%`;

    embed.addFields({
      name: triggerText,
      value: `**Daily ROI:** ${roiText}\n` +
             `**Record:** ${microData.winLoss}\n` +
             `**Units:** Solo ${microData.unitBreakdown.solo}U • Parlay ${microData.unitBreakdown.parlay}U • Total ${microData.unitBreakdown.total}U\n` +
             `**Top Capper:** ${microData.topCapper.name} (${microData.topCapper.netUnits > 0 ? '+' : ''}${microData.topCapper.netUnits.toFixed(1)}U, ${microData.topCapper.winRate.toFixed(1)}%)`,
      inline: false
    });

    if (this.config.legendFooter) {
      embed.setFooter({ text: this.getLegendFooter() });
    } else {
      embed.setFooter({ text: 'Unit Talk • Micro-Recap Engine v3.0.0' });
    }

    return embed;
  }

  // Helper methods for building embed sections

  private buildSoloPicksText(summary: RecapSummary): string {
    const soloWins = summary.capperBreakdown.reduce((sum, capper) => sum + capper.wins, 0);
    const soloLosses = summary.capperBreakdown.reduce((sum, capper) => sum + capper.losses, 0);

    const picks = [];

    // Add sample picks (in production, you'd get actual pick details)
    if (summary.bestPick) {
      const profitLoss = typeof summary.bestPick.profit_loss === 'number' ?
        summary.bestPick.profit_loss.toFixed(1) : '0';
      picks.push(`✅ ${this.formatPick(summary.bestPick)} (+${profitLoss}U)`);
    }

    if (summary.worstPick) {
      const profitLoss = (summary.worstPick.profit_loss !== null && typeof summary.worstPick.profit_loss === 'number') ?
        summary.worstPick.profit_loss.toFixed(1) : '0';
      picks.push(`❌ ${this.formatPick(summary.worstPick)} (${profitLoss}U)`);
    }

    return picks.join('\n') || `${soloWins}W-${soloLosses}L solo picks processed`;
  }

  private buildParlayText(parlayGroups: ParlayGroup[]): string {
    return parlayGroups.map(parlay => {
      const outcome = parlay.outcome === 'win' ? '✅' : parlay.outcome === 'loss' ? '❌' : '🟡';
      const profitText = parlay.profit_loss ? 
        (parlay.profit_loss > 0 ? `(+${parlay.profit_loss.toFixed(1)}U)` : `(${parlay.profit_loss.toFixed(1)}U)`) : '';
      
      return `${outcome} ${parlay.capper || 'Unknown'} - Parlay (${parlay.picks.length} Legs) ${profitText}`;
    }).join('\n');
  }

  private buildCapperBreakdownText(cappers: CapperStats[]): string {
    return cappers.map(capper => {
      const unitsText = capper.netUnits >= 0 ? `+${capper.netUnits.toFixed(1)}U` : `${capper.netUnits.toFixed(1)}U`;
      const roiText = `${capper.roi.toFixed(1)}%`;
      const winRateText = `${capper.winRate.toFixed(1)}%`;
      
      let streakText = '';
      if (capper.currentStreak > 0) {
        const streakEmoji = capper.streakType === 'win' ? '🔥' : '❄️';
        streakText = ` ${streakEmoji}${capper.currentStreak}`;
      }

      let sparklineText = '';
      if (this.config.streakSparkline && capper.streakSparkline) {
        sparklineText = ` ${capper.streakSparkline}`;
      }

      return `• ${capper.capper}: ${capper.picks}W-${capper.losses}L • ${unitsText} • ROI: ${roiText} • Win Rate: ${winRateText}${streakText}${sparklineText}`;
    }).join('\n');
  }

  private buildWeeklyCapperText(cappers: CapperStats[]): string {
    return cappers.map(capper => {
      const unitsText = capper.netUnits >= 0 ? `+${capper.netUnits.toFixed(1)}U` : `${capper.netUnits.toFixed(1)}U`;
      return `• ${capper.capper}: ${capper.wins}W - ${capper.losses}L • ${unitsText} • ROI: ${capper.roi.toFixed(1)}% • Win Rate: ${capper.winRate.toFixed(1)}%`;
    }).join('\n');
  }

  private buildHotStreaksText(streaks: HotStreak[]): string {
    return streaks.map(streak => {
      const emoji = streak.streakType === 'win' ? '🔥' : '❄️';
      return `${emoji} ${streak.capper}: ${streak.streakLength} ${streak.streakType} streak (${streak.totalUnits > 0 ? '+' : ''}${streak.totalUnits.toFixed(1)}U)`;
    }).join('\n');
  }

  private buildTierBreakdownText(tiers: TierStats[]): string {
    return tiers.map(tier => {
      const unitsText = tier.netUnits >= 0 ? `+${tier.netUnits.toFixed(1)}U` : `${tier.netUnits.toFixed(1)}U`;
      return `• ${tier.tier}: ${tier.picks} picks • ${unitsText} • ${tier.winRate.toFixed(1)}% • ROI: ${tier.roi.toFixed(1)}%`;
    }).join('\n');
  }

  private buildWeeklyHighlights(summary: RecapSummary): string {
    const highlights = [];

    if (summary.bestPick) {
      const profitLoss = typeof summary.bestPick.profit_loss === 'number' ?
        summary.bestPick.profit_loss.toFixed(1) : '0';
      highlights.push(`• Best Play: ${this.formatPick(summary.bestPick)} (+${profitLoss}U)`);
    }

    if (summary.badBeat) {
      const profitLoss = typeof summary.badBeat.profit_loss === 'number' ?
        summary.badBeat.profit_loss.toFixed(1) : '0';
      highlights.push(`• Bad Beat: ${this.formatPick(summary.badBeat)} (${profitLoss}U)`);
    }

    if (summary.hotStreaks.length > 0) {
      const longestStreak = summary.hotStreaks[0];
      highlights.push(`• Longest Streak: ${longestStreak.capper} (${longestStreak.streakLength} ${longestStreak.streakType}s)`);
    }

    return highlights.join('\n');
  }

  private buildMonthlyHighlights(summary: RecapSummary): string {
    const highlights = [];
    
    if (summary.biggestWin) {
      const profitLoss = typeof summary.biggestWin.profit_loss === 'number' ?
        summary.biggestWin.profit_loss.toFixed(1) : '0';
      highlights.push(`• Best Day: ${this.formatPick(summary.biggestWin)} (+${profitLoss}U)`);
    }
    
    if (summary.badBeat) {
      highlights.push(`• Bad Beat: ${this.formatPick(summary.badBeat)}`);
    }

    if (summary.hotStreaks.length > 0) {
      const longestStreak = summary.hotStreaks[0];
      highlights.push(`• Longest Streak: ${longestStreak.capper} (${longestStreak.streakLength} ${longestStreak.streakType}s)`);
    }

    highlights.push(`• Avg Units/Pick: ${(summary.totalUnits / summary.totalPicks).toFixed(1)}U`);
    highlights.push(`• Best Day: Unknown`);
    highlights.push(`• Worst Day: Unknown`);

    return highlights.join('\n');
  }

  private getSoloStats(summary: RecapSummary): number {
    // Calculate solo units (excluding parlays)
    const parlayUnits = summary.tierBreakdown
      .filter(tier => tier.tier.toLowerCase().includes('parlay'))
      .reduce((sum, tier) => sum + tier.totalUnits, 0);
    
    return summary.totalUnits - parlayUnits;
  }

  private getSoloWinRate(summary: RecapSummary): number {
    // Calculate solo win rate (excluding parlays)
    const soloWins = summary.capperBreakdown.reduce((sum, capper) => sum + capper.wins, 0);
    const soloLosses = summary.capperBreakdown.reduce((sum, capper) => sum + capper.losses, 0);
    
    return soloWins + soloLosses > 0 ? (soloWins / (soloWins + soloLosses)) * 100 : 0;
  }

  private getParlayStats(parlayGroups: ParlayGroup[]): number {
    return parlayGroups.reduce((sum, parlay) => sum + parlay.units, 0);
  }

  private getParlayWinRate(parlayGroups: ParlayGroup[]): number {
    const wins = parlayGroups.filter(p => p.outcome === 'win').length;
    const losses = parlayGroups.filter(p => p.outcome === 'loss').length;
    
    return wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;
  }

  private formatPick(pick: any): string {
    if (pick.player_name) {
      return `${pick.player_name} ${pick.market_type} ${pick.line}`;
    } else if (pick.team_name) {
      return `${pick.team_name} ${pick.market_type} ${pick.line}`;
    } else if (pick.matchup) {
      return `${pick.matchup} ${pick.market_type}`;
    }
    return `${pick.market_type} ${pick.line || ''}`;
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  }

  private getLegendFooter(): string {
    return '✅ Win  ❌ Loss  💰 Profit  🔥 Streak  📊 Stats';
  }

  // Configuration getters
  getConfig(): RecapConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<RecapConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}