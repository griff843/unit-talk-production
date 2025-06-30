import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getUserTier } from '../utils/roleUtils';
import { TrendAnalysisService } from '../services/trendAnalysisService';
import { DatabaseService } from '../services/database';

export const data = new SlashCommandBuilder()
  .setName('trend-breaker')
  .setDescription('Analyze picks for streaks, trend breaks, and statistical anomalies (VIP+ only)')
  .addStringOption(option =>
    option.setName('analysis-type')
      .setDescription('Type of trend analysis to perform')
      .setRequired(false)
      .addChoices(
        { name: 'All Analysis', value: 'all' },
        { name: 'Streaks Only', value: 'streaks' },
        { name: 'Trend Breaks', value: 'breaks' },
        { name: 'Statistical Outliers', value: 'outliers' },
        { name: 'Regression Analysis', value: 'regression' }
      ))
  .addStringOption(option =>
    option.setName('sport')
      .setDescription('Filter by sport')
      .setRequired(false)
      .addChoices(
        { name: 'NBA', value: 'nba' },
        { name: 'NFL', value: 'nfl' },
        { name: 'NHL', value: 'nhl' },
        { name: 'MLB', value: 'mlb' }
      ))
  .addIntegerOption(option =>
    option.setName('days')
      .setDescription('Number of days to analyze (default: 30)')
      .setRequired(false)
      .setMinValue(7)
      .setMaxValue(90));

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Fetch the full guild member to avoid API member type issues
    const member = await interaction.guild?.members.fetch(interaction.user.id);
    if (!member) {
      await interaction.reply({ content: 'Unable to fetch your member information.', ephemeral: true });
      return;
    }

    const userTier = getUserTier(member);

    if (userTier !== 'vip_plus') {
      const embed = new EmbedBuilder()
        .setTitle('🔒 VIP+ Exclusive')
        .setDescription('This command is for VIP+ members only. Type `/vip-info` to see what you\'re missing.')
        .setColor(0xff0000);
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Defer reply as analysis might take time
    await interaction.deferReply({ ephemeral: true });

    // Get command options
    const analysisType = interaction.options.getString('analysis-type') || 'all';
    const sport = interaction.options.getString('sport');
    const days = interaction.options.getInteger('days') || 30;

    // Initialize services
    const databaseService = new DatabaseService();
    const trendService = new TrendAnalysisService(databaseService);

    // Perform trend analysis
    const analysis = await trendService.performTrendAnalysis({
      days_back: days,
      min_sample_size: 5,
      confidence_threshold: 0.7,
      sport_filter: sport || undefined
    });

    // Create response based on analysis type
    let embed: EmbedBuilder;
    let components: ActionRowBuilder<ButtonBuilder>[] = [];

    switch (analysisType) {
      case 'streaks':
        embed = createStreaksEmbed(analysis, days, sport);
        break;
      case 'breaks':
        embed = createTrendBreaksEmbed(analysis, days, sport);
        break;
      case 'outliers':
        embed = createOutliersEmbed(analysis, days, sport);
        break;
      case 'regression':
        embed = createRegressionEmbed(analysis, days, sport);
        break;
      default:
        embed = createComprehensiveEmbed(analysis, days, sport);
        components = createNavigationButtons(analysisType);
        break;
    }

    await interaction.editReply({ 
      embeds: [embed], 
      components: components.length > 0 ? components : undefined
    });

  } catch (error) {
    console.error('Error in trend-breaker command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Analysis Error')
      .setDescription('An error occurred while analyzing trends. Please try again later.')
      .setColor(0xff0000);

    if (interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}

/**
 * Create comprehensive analysis embed showing all types
 */
function createComprehensiveEmbed(analysis: any, days: number, sport?: string | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🔍 Comprehensive Trend Analysis')
    .setColor(0xff4500)
    .setFooter({ text: `VIP+ Trend Breaker | ${analysis.analysis_metadata.total_picks_analyzed} picks analyzed` });

  let description = `**Analysis Period:** Last ${days} days${sport ? ` (${sport.toUpperCase()})` : ''}\n\n`;

  // High-confidence streaks
  const topStreaks = analysis.streaks.slice(0, 3);
  if (topStreaks.length > 0) {
    description += `🔥 **Active Streaks:**\n`;
    for (const streak of topStreaks) {
      const streakEmoji = streak.streak_type === 'win' ? '✅' : '❌';
      description += `${streakEmoji} **${streak.player_name}** ${streak.stat_type}\n`;
      description += `   ${streak.current_streak} ${streak.streak_type} streak (${(streak.confidence_score * 100).toFixed(0)}% confidence)\n`;
      description += `   Historical: ${(streak.historical_win_rate * 100).toFixed(1)}% win rate\n\n`;
    }
  }

  // Top trend breaks
  const topBreaks = analysis.trend_breaks.slice(0, 2);
  if (topBreaks.length > 0) {
    description += `🚨 **Trend Breaks:**\n`;
    for (const trendBreak of topBreaks) {
      const breakEmoji = trendBreak.trend_break_type === 'performance_decline' ? '📉' : '📈';
      description += `${breakEmoji} **${trendBreak.player_name}** ${trendBreak.stat_type}\n`;
      description += `   ${trendBreak.reasoning}\n`;
      description += `   Confidence: ${(trendBreak.confidence_score * 100).toFixed(0)}%\n\n`;
    }
  }

  // Statistical outliers
  const topOutliers = analysis.statistical_outliers.slice(0, 2);
  if (topOutliers.length > 0) {
    description += `📊 **Statistical Outliers:**\n`;
    for (const outlier of topOutliers) {
      const outlierEmoji = outlier.outlier_type === 'high' ? '⬆️' : '⬇️';
      description += `${outlierEmoji} **${outlier.player_name}** ${outlier.stat_type}\n`;
      description += `   Line: ${outlier.current_line} vs Avg: ${outlier.historical_average.toFixed(1)}\n`;
      description += `   Z-Score: ${outlier.z_score.toFixed(2)} (${(outlier.confidence_score * 100).toFixed(0)}% confidence)\n\n`;
    }
  }

  // Regression candidates
  const topRegression = analysis.regression_candidates.slice(0, 2);
  if (topRegression.length > 0) {
    description += `🎯 **Regression Candidates:**\n`;
    for (const regression of topRegression) {
      description += `📈 **${regression.player_name}** ${regression.stat_type}\n`;
      description += `   Expected regression: ${regression.expected_regression > 0 ? '+' : ''}${regression.expected_regression.toFixed(1)}\n`;
      description += `   Confidence: ${(regression.regression_confidence * 100).toFixed(0)}%\n\n`;
    }
  }

  if (description.length < 100) {
    description += `No significant trends detected in the last ${days} days.\nTry expanding the analysis period or removing sport filters.`;
  }

  embed.setDescription(description);
  return embed;
}

/**
 * Create streaks-focused embed
 */
function createStreaksEmbed(analysis: any, days: number, sport?: string | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🔥 Active Streaks Analysis')
    .setColor(0xff6b35)
    .setFooter({ text: `VIP+ Streak Analysis | ${analysis.streaks.length} streaks found` });

  let description = `**Analysis Period:** Last ${days} days${sport ? ` (${sport.toUpperCase()})` : ''}\n\n`;

  if (analysis.streaks.length === 0) {
    description += `No significant streaks (3+ games) detected in the analysis period.\nTry expanding the time range or removing filters.`;
  } else {
    description += `**🔥 Hot Streaks & Cold Spells:**\n\n`;
    
    const winStreaks = analysis.streaks.filter((s: any) => s.streak_type === 'win').slice(0, 5);
    const lossStreaks = analysis.streaks.filter((s: any) => s.streak_type === 'loss').slice(0, 5);

    if (winStreaks.length > 0) {
      description += `✅ **Win Streaks:**\n`;
      for (const streak of winStreaks) {
        description += `• **${streak.player_name}** ${streak.stat_type}\n`;
        description += `  ${streak.current_streak} wins (${(streak.streak_probability * 100).toFixed(2)}% probability)\n`;
        description += `  Historical: ${(streak.historical_win_rate * 100).toFixed(1)}% | Sample: ${streak.games_analyzed}\n\n`;
      }
    }

    if (lossStreaks.length > 0) {
      description += `❌ **Loss Streaks:**\n`;
      for (const streak of lossStreaks) {
        description += `• **${streak.player_name}** ${streak.stat_type}\n`;
        description += `  ${streak.current_streak} losses (${(streak.streak_probability * 100).toFixed(2)}% probability)\n`;
        description += `  Historical: ${(streak.historical_win_rate * 100).toFixed(1)}% | Sample: ${streak.games_analyzed}\n\n`;
      }
    }
  }

  embed.setDescription(description);
  return embed;
}

/**
 * Create trend breaks embed
 */
function createTrendBreaksEmbed(analysis: any, days: number, sport?: string | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🚨 Trend Break Analysis')
    .setColor(0xff1744)
    .setFooter({ text: `VIP+ Trend Analysis | ${analysis.trend_breaks.length} breaks detected` });

  let description = `**Analysis Period:** Last ${days} days${sport ? ` (${sport.toUpperCase()})` : ''}\n\n`;

  if (analysis.trend_breaks.length === 0) {
    description += `No significant trend breaks detected.\nAll players performing within historical ranges.`;
  } else {
    description += `**🚨 Significant Pattern Changes:**\n\n`;
    
    for (const trendBreak of analysis.trend_breaks.slice(0, 8)) {
      const breakEmoji = trendBreak.trend_break_type === 'performance_decline' ? '📉' : '📈';
      const directionText = trendBreak.trend_break_type === 'performance_decline' ? 'DECLINE' : 'SURGE';
      
      description += `${breakEmoji} **${trendBreak.player_name}** ${trendBreak.stat_type}\n`;
      description += `**${directionText}:** ${trendBreak.line} ${trendBreak.over_under}\n`;
      description += `Recent: ${(trendBreak.recent_hit_rate * 100).toFixed(1)}% vs Historical: ${(trendBreak.historical_hit_rate * 100).toFixed(1)}%\n`;
      description += `Deviation: ${trendBreak.deviation_percentage.toFixed(1)}% | Confidence: ${(trendBreak.confidence_score * 100).toFixed(0)}%\n`;
      description += `*${trendBreak.reasoning}*\n\n`;
    }
  }

  embed.setDescription(description);
  return embed;
}

/**
 * Create statistical outliers embed
 */
function createOutliersEmbed(analysis: any, days: number, sport?: string | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('📊 Statistical Outliers')
    .setColor(0x9c27b0)
    .setFooter({ text: `VIP+ Statistical Analysis | ${analysis.statistical_outliers.length} outliers found` });

  let description = `**Analysis Period:** Last ${days} days${sport ? ` (${sport.toUpperCase()})` : ''}\n\n`;

  if (analysis.statistical_outliers.length === 0) {
    description += `No statistical outliers detected.\nAll lines within 2 standard deviations of historical averages.`;
  } else {
    description += `**📊 Lines Deviating from Historical Norms:**\n\n`;
    
    for (const outlier of analysis.statistical_outliers.slice(0, 8)) {
      const outlierEmoji = outlier.outlier_type === 'high' ? '⬆️' : '⬇️';
      const directionText = outlier.outlier_type === 'high' ? 'HIGH' : 'LOW';
      
      description += `${outlierEmoji} **${outlier.player_name}** ${outlier.stat_type}\n`;
      description += `**${directionText} OUTLIER:** Current line ${outlier.current_line}\n`;
      description += `Historical Avg: ${outlier.historical_average.toFixed(1)} (±${outlier.standard_deviation.toFixed(1)})\n`;
      description += `Z-Score: ${outlier.z_score.toFixed(2)} | Confidence: ${(outlier.confidence_score * 100).toFixed(0)}%\n`;
      description += `Sample Size: ${outlier.sample_size} games\n\n`;
    }
  }

  embed.setDescription(description);
  return embed;
}

/**
 * Create regression analysis embed
 */
function createRegressionEmbed(analysis: any, days: number, sport?: string | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🎯 Regression to Mean Analysis')
    .setColor(0x2196f3)
    .setFooter({ text: `VIP+ Regression Analysis | ${analysis.regression_candidates.length} candidates found` });

  let description = `**Analysis Period:** Last ${days} days${sport ? ` (${sport.toUpperCase()})` : ''}\n\n`;

  if (analysis.regression_candidates.length === 0) {
    description += `No regression candidates identified.\nAll players performing within expected ranges.`;
  } else {
    description += `**🎯 Players Due for Performance Correction:**\n\n`;
    
    for (const regression of analysis.regression_candidates.slice(0, 8)) {
      const performanceEmoji = regression.current_performance > regression.expected_regression ? '📈' : '📉';
      const directionText = regression.current_performance > regression.expected_regression ? 'OVER' : 'UNDER';
      
      description += `${performanceEmoji} **${regression.player_name}** ${regression.stat_type}\n`;
      description += `**${directionText}-PERFORMING:** Current ${regression.current_performance > 0 ? '+' : ''}${regression.current_performance.toFixed(1)}\n`;
      description += `Expected Regression: ${regression.expected_regression > 0 ? '+' : ''}${regression.expected_regression.toFixed(1)}\n`;
      description += `Confidence: ${(regression.regression_confidence * 100).toFixed(0)}%\n`;
      
      if (regression.over_performance_streak > 0) {
        description += `Over-performance streak: ${regression.over_performance_streak} games\n`;
      }
      if (regression.under_performance_streak > 0) {
        description += `Under-performance streak: ${regression.under_performance_streak} games\n`;
      }
      description += `\n`;
    }
  }

  embed.setDescription(description);
  return embed;
}

/**
 * Create navigation buttons for different analysis types
 */
function createNavigationButtons(currentType: string): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('trend_streaks')
        .setLabel('Streaks')
        .setEmoji('🔥')
        .setStyle(currentType === 'streaks' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('trend_breaks')
        .setLabel('Trend Breaks')
        .setEmoji('🚨')
        .setStyle(currentType === 'breaks' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('trend_outliers')
        .setLabel('Outliers')
        .setEmoji('📊')
        .setStyle(currentType === 'outliers' ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

  const row2 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('trend_regression')
        .setLabel('Regression')
        .setEmoji('🎯')
        .setStyle(currentType === 'regression' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('trend_all')
        .setLabel('All Analysis')
        .setEmoji('🔍')
        .setStyle(currentType === 'all' ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

  return [row1, row2];
}