import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getUserTier, hasMinimumTier } from '../utils/roleUtils';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('edge-tracker')
  .setDescription('Track your betting edge and performance analytics (VIP+ required)')
  .addSubcommand(subcommand =>
    subcommand
      .setName('overview')
      .setDescription('View your overall betting performance')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('sport')
      .setDescription('View performance by sport')
      .addStringOption(option =>
        option.setName('sport')
          .setDescription('Select sport to analyze')
          .setRequired(true)
          .addChoices(
            { name: 'NBA', value: 'nba' },
            { name: 'NFL', value: 'nfl' },
            { name: 'MLB', value: 'mlb' },
            { name: 'NHL', value: 'nhl' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('trends')
      .setDescription('View your betting trends and patterns')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('goals')
      .setDescription('Set and track your betting goals')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member;
    if (!member) {
      await interaction.editReply('❌ Unable to determine your membership status.');
      return;
    }

    const userTier = getUserTier(member as any);

    // Check if user has VIP+ access
    if (!hasMinimumTier(member as any, 'vip_plus')) {
      const embed = new EmbedBuilder()
        .setTitle('🔒 VIP+ Feature Required')
        .setDescription('Edge Tracker is available to VIP+ members and above.')
        .setColor(0xFF4500)
        .addFields(
          {
            name: '📊 Edge Tracker Features',
            value: '• Personal performance analytics\n• Win rate tracking by sport\n• ROI and unit tracking\n• Betting pattern analysis\n• Goal setting and progress\n• Advanced statistics',
            inline: false
          },
          {
            name: '⭐ VIP Benefits',
            value: 'VIP members get basic performance tracking. Upgrade to VIP+ for advanced analytics and edge tracking!',
            inline: false
          }
        );

      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('upgrade_to_vip_plus')
            .setLabel('Upgrade to VIP+')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💎'),
          new ButtonBuilder()
            .setCustomId('basic_stats')
            .setLabel('Basic Stats')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📈')
        );

      await interaction.editReply({ 
        embeds: [embed], 
        components: [actionRow]
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'overview':
        await handleOverview(interaction, userTier);
        break;
      case 'sport':
        await handleSport(interaction, userTier);
        break;
      case 'trends':
        await handleTrends(interaction, userTier);
        break;
      case 'goals':
        await handleGoals(interaction, userTier);
        break;
      default:
        await interaction.editReply('❌ Invalid subcommand.');
    }

  } catch (error) {
    logger.error('Error in edge-tracker command:', error);
    await interaction.editReply('❌ An error occurred while fetching your edge tracker data.');
  }
}

async function handleOverview(interaction: ChatInputCommandInteraction, userTier: string) {
  // Mock user performance data
  const performanceData = {
    totalBets: 247,
    wins: 142,
    losses: 105,
    winRate: 57.5,
    totalUnits: 28.4,
    roi: 11.5,
    avgOdds: -108,
    longestWinStreak: 8,
    longestLoseStreak: 4,
    currentStreak: 'W3',
    profitableDays: 18,
    totalDays: 31,
    bankrollGrowth: 15.2
  };

  const embed = new EmbedBuilder()
    .setTitle('📊 Your Betting Edge Overview')
    .setDescription(`Performance analytics for ${interaction.user.username}`)
    .setColor(performanceData.roi > 0 ? 0x00FF00 : 0xFF0000)
    .addFields(
      {
        name: '🎯 Win Rate',
        value: `**${performanceData.winRate}%**\n(${performanceData.wins}W-${performanceData.losses}L)`,
        inline: true
      },
      {
        name: '💰 Total Units',
        value: `**+${performanceData.totalUnits}**\nROI: ${performanceData.roi}%`,
        inline: true
      },
      {
        name: '🔥 Current Streak',
        value: `**${performanceData.currentStreak}**\nLongest: ${performanceData.longestWinStreak}W`,
        inline: true
      },
      {
        name: '📈 Bankroll Growth',
        value: `**+${performanceData.bankrollGrowth}%**\nProfitable Days: ${performanceData.profitableDays}/${performanceData.totalDays}`,
        inline: true
      },
      {
        name: '📊 Average Odds',
        value: `**${performanceData.avgOdds}**\nTotal Bets: ${performanceData.totalBets}`,
        inline: true
      },
      {
        name: '🏆 Edge Rating',
        value: getEdgeRating(performanceData.roi, performanceData.winRate),
        inline: true
      }
    )
    .setFooter({ text: 'Data updated in real-time' })
    .setTimestamp();

  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('detailed_breakdown')
        .setLabel('Detailed Breakdown')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📋'),
      new ButtonBuilder()
        .setCustomId('export_data')
        .setLabel('Export Data')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📤'),
      new ButtonBuilder()
        .setCustomId('set_goals')
        .setLabel('Set Goals')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎯')
    );

  await interaction.editReply({
    embeds: [embed],
    components: [actionRow]
  });
}

async function handleSport(interaction: ChatInputCommandInteraction, userTier: string) {
  const sport = interaction.options.getString('sport', true);
  
  // Mock sport-specific data
  const sportData = {
    nba: {
      bets: 89,
      wins: 54,
      losses: 35,
      winRate: 60.7,
      units: 12.8,
      roi: 14.4,
      avgOdds: -105,
      bestBetType: 'Spread',
      worstBetType: 'Player Props'
    },
    nfl: {
      bets: 67,
      wins: 38,
      losses: 29,
      winRate: 56.7,
      units: 8.9,
      roi: 13.3,
      avgOdds: -110,
      bestBetType: 'Totals',
      worstBetType: 'Moneyline'
    },
    mlb: {
      bets: 124,
      wins: 68,
      losses: 56,
      winRate: 54.8,
      units: 6.2,
      roi: 5.0,
      avgOdds: -108,
      bestBetType: 'Run Line',
      worstBetType: 'First Inning'
    },
    nhl: {
      bets: 45,
      wins: 23,
      losses: 22,
      winRate: 51.1,
      units: -2.1,
      roi: -4.7,
      avgOdds: -112,
      bestBetType: 'Puck Line',
      worstBetType: 'Period Betting'
    }
  };

  const data = sportData[sport as keyof typeof sportData];
  const sportName = sport.toUpperCase();

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${sportName} Performance Analysis`)
    .setDescription(`Your betting edge in ${sportName}`)
    .setColor(data.roi > 0 ? 0x00FF00 : 0xFF0000)
    .addFields(
      {
        name: '📊 Overall Stats',
        value: `**Win Rate:** ${data.winRate}%\n**Record:** ${data.wins}W-${data.losses}L\n**Total Bets:** ${data.bets}`,
        inline: true
      },
      {
        name: '💰 Profitability',
        value: `**Units:** ${data.units > 0 ? '+' : ''}${data.units}\n**ROI:** ${data.roi}%\n**Avg Odds:** ${data.avgOdds}`,
        inline: true
      },
      {
        name: '🎯 Bet Type Analysis',
        value: `**Best:** ${data.bestBetType}\n**Worst:** ${data.worstBetType}`,
        inline: true
      }
    )
    .setFooter({ text: `${sportName} season data` })
    .setTimestamp();

  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`${sport}_trends`)
        .setLabel('View Trends')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📈'),
      new ButtonBuilder()
        .setCustomId(`${sport}_breakdown`)
        .setLabel('Bet Type Breakdown')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋')
    );

  await interaction.editReply({
    embeds: [embed],
    components: [actionRow]
  });
}

async function handleTrends(interaction: ChatInputCommandInteraction, userTier: string) {
  const embed = new EmbedBuilder()
    .setTitle('📈 Your Betting Trends')
    .setDescription('Pattern analysis and insights')
    .setColor(0x7289DA)
    .addFields(
      {
        name: '🔥 Hot Streaks',
        value: '• Best on weekends (65% win rate)\n• Strong in primetime games\n• Favorites performing well\n• Home teams trending up',
        inline: true
      },
      {
        name: '❄️ Cold Spots',
        value: '• Struggling with player props\n• Weekday afternoon games\n• Road underdogs underperforming\n• Live betting needs work',
        inline: true
      },
      {
        name: '💡 Insights',
        value: '• Stick to your strengths\n• Avoid emotional betting\n• Consider reducing prop bets\n• Focus on weekend games',
        inline: false
      }
    );

  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('detailed_trends')
        .setLabel('Detailed Analysis')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔍'),
      new ButtonBuilder()
        .setCustomId('trend_alerts')
        .setLabel('Set Trend Alerts')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔔')
    );

  await interaction.editReply({
    embeds: [embed],
    components: [actionRow]
  });
}

async function handleGoals(interaction: ChatInputCommandInteraction, userTier: string) {
  // Mock user goals data
  const goals = {
    monthlyROI: { target: 15, current: 11.5, progress: 77 },
    winRate: { target: 60, current: 57.5, progress: 96 },
    totalUnits: { target: 50, current: 28.4, progress: 57 }
  };

  const embed = new EmbedBuilder()
    .setTitle('🎯 Your Betting Goals')
    .setDescription('Track your progress towards betting objectives')
    .setColor(0x00FF00)
    .addFields(
      {
        name: '📊 Monthly ROI Goal',
        value: `**Target:** ${goals.monthlyROI.target}%\n**Current:** ${goals.monthlyROI.current}%\n**Progress:** ${goals.monthlyROI.progress}%`,
        inline: true
      },
      {
        name: '🎯 Win Rate Goal',
        value: `**Target:** ${goals.winRate.target}%\n**Current:** ${goals.winRate.current}%\n**Progress:** ${goals.winRate.progress}%`,
        inline: true
      },
      {
        name: '💰 Unit Goal',
        value: `**Target:** +${goals.totalUnits.target}\n**Current:** +${goals.totalUnits.current}\n**Progress:** ${goals.totalUnits.progress}%`,
        inline: true
      }
    );

  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('update_goals')
        .setLabel('Update Goals')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✏️'),
      new ButtonBuilder()
        .setCustomId('goal_reminders')
        .setLabel('Set Reminders')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⏰')
    );

  await interaction.editReply({
    embeds: [embed],
    components: [actionRow]
  });
}

function getEdgeRating(roi: number, winRate: number): string {
  if (roi >= 15 && winRate >= 60) return '🔥 **Elite Edge**';
  if (roi >= 10 && winRate >= 55) return '⭐ **Strong Edge**';
  if (roi >= 5 && winRate >= 52) return '📈 **Positive Edge**';
  if (roi >= 0 && winRate >= 50) return '🟡 **Break Even**';
  return '❌ **Needs Improvement**';
}