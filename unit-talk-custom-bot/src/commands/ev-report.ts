import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getUserTier } from '../utils/roleUtils';
import { EVService } from '../services/evService';
import { DatabaseService } from '../services/database';
import { logger } from '../utils/logger';

const databaseService = new DatabaseService();
const evService = new EVService(databaseService);

export const data = new SlashCommandBuilder()
  .setName('ev-report')
  .setDescription('View Expected Value (EV) analysis and leaderboards (VIP/VIP+ only)')
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Type of EV report to generate')
      .setRequired(false)
      .addChoices(
        { name: 'Today\'s Top EV', value: 'today' },
        { name: 'Weekly Summary', value: 'week' },
        { name: 'Monthly Analysis', value: 'month' },
        { name: 'User Leaderboard', value: 'leaderboard' },
        { name: 'Sport Breakdown', value: 'sports' }
      ))
  .addStringOption(option =>
    option.setName('sport')
      .setDescription('Filter by specific sport')
      .setRequired(false)
      .addChoices(
        { name: 'NBA', value: 'nba' },
        { name: 'NFL', value: 'nfl' },
        { name: 'NHL', value: 'nhl' },
        { name: 'MLB', value: 'mlb' },
        { name: 'Soccer', value: 'soccer' }
      ))
  .addUserOption(option =>
    option.setName('user')
      .setDescription('View EV analysis for specific user (VIP+ only)')
      .setRequired(false))
  .addIntegerOption(option =>
    option.setName('min-ev')
      .setDescription('Minimum EV percentage to display')
      .setRequired(false)
      .setMinValue(-100)
      .setMaxValue(100));

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Fetch the full guild member to avoid API member type issues
    const member = await interaction.guild?.members.fetch(interaction.user.id);
    if (!member) {
      await interaction.reply({ content: 'Unable to fetch your member information.', ephemeral: true });
      return;
    }

    const userTier = getUserTier(member);

    // Check access permissions
    if (userTier !== 'vip_plus' && userTier !== 'vip') {
      const embed = new EmbedBuilder()
        .setTitle('🔒 VIP Feature')
        .setDescription('This command is for VIP members and above. Type `/vip-info` to see what you\'re missing.')
        .setColor(0xff0000);
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Get command options
    const reportType = interaction.options.getString('type') || 'today';
    const sport = interaction.options.getString('sport');
    const targetUser = interaction.options.getUser('user');
    const minEV = interaction.options.getInteger('min-ev');

    // VIP+ only features
    if (targetUser && userTier !== 'vip_plus') {
      const embed = new EmbedBuilder()
        .setTitle('🔒 VIP+ Feature')
        .setDescription('User-specific EV analysis is available for VIP+ members only.')
        .setColor(0xff4500);
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    let embed: EmbedBuilder;
    let actionRow: ActionRowBuilder<ButtonBuilder> | null = null;

    try {
      switch (reportType) {
        case 'today':
          embed = await createTodayEVReport(sport, minEV, userTier);
          break;
        case 'week':
          embed = await createWeeklyEVReport(userTier);
          break;
        case 'month':
          embed = await createMonthlyEVReport(userTier);
          break;
        case 'leaderboard':
          embed = await createUserLeaderboard(userTier);
          break;
        case 'sports':
          embed = await createSportBreakdown(userTier);
          break;
        default:
          embed = await createTodayEVReport(sport, minEV, userTier);
      }

      // Add user-specific analysis if requested
      if (targetUser && userTier === 'vip_plus') {
        const userEmbed = await createUserEVAnalysis(targetUser.id, reportType as 'today' | 'week' | 'month');
        await interaction.editReply({ embeds: [embed, userEmbed] });
        return;
      }

      // Create action buttons for navigation
      actionRow = createNavigationButtons(reportType, userTier);

    } catch (error) {
      logger.error('Error generating EV report:', error);
      embed = createErrorEmbed();
    }

    const response: any = { embeds: [embed] };
    if (actionRow) {
      response.components = [actionRow];
    }

    await interaction.editReply(response);

  } catch (error) {
    logger.error('Error in ev-report command:', error);
    
    const errorResponse = {
      content: '❌ An error occurred while generating the EV report. Please try again later.',
      ephemeral: true
    };

    if (interaction.deferred) {
      await interaction.editReply(errorResponse);
    } else {
      await interaction.reply(errorResponse);
    }
  }
}

async function createTodayEVReport(sport?: string | null, minEV?: number | null, userTier?: string): Promise<EmbedBuilder> {
  const topPicks = await evService.getTopEVPicks({
    timeRange: 'today',
    limit: 10,
    minEV: minEV || 0
  });

  const filteredPicks = sport ? topPicks.filter(pick => pick.sport.toLowerCase() === sport.toLowerCase()) : topPicks;

  const embed = new EmbedBuilder()
    .setTitle('📊 Today\'s Expected Value Report')
    .setColor(userTier === 'vip_plus' ? 0xff4500 : 0xffd700)
    .setTimestamp();

  if (filteredPicks.length === 0) {
    embed.setDescription('No picks found matching your criteria for today.');
    return embed;
  }

  const summary = await evService.getEVSummary({ 
    startDate: new Date(new Date().setHours(0, 0, 0, 0)).toISOString() 
  });

  let description = `**📈 Today's Summary:**\n`;
  description += `• Total Picks: ${summary.totalPicks}\n`;
  description += `• Positive EV: ${summary.positiveEVPicks} (${((summary.positiveEVPicks / summary.totalPicks) * 100).toFixed(1)}%)\n`;
  description += `• Average EV: ${summary.averageEV.toFixed(2)}%\n`;
  description += `• Expected Profit: $${summary.totalExpectedProfit.toFixed(2)}\n\n`;

  description += `**🔥 Top EV Picks:**\n`;
  
  filteredPicks.slice(0, 5).forEach((pick) => {
    const evIcon = pick.expectedValue > 0 ? '💰' : '⚠️';
    const evColor = pick.expectedValue > 0 ? '🟢' : '🔴';

    description += `${evIcon} **${pick.playerName} ${pick.overUnder.toUpperCase()} ${pick.line} ${pick.statType}**\n`;
    description += `   ${evColor} EV: ${pick.evPercentage.toFixed(2)}% | Odds: ${pick.odds > 0 ? '+' : ''}${pick.odds}\n`;
    description += `   Expected: $${pick.expectedProfit.toFixed(2)} per $${pick.stake}\n\n`;
  });

  if (sport) {
    description += `\n*Filtered by: ${sport.toUpperCase()}*`;
  }

  if (minEV) {
    description += `\n*Minimum EV: ${minEV}%*`;
  }

  embed.setDescription(description);
  embed.setFooter({ text: `${userTier?.toUpperCase()} EV Report | Updated every hour` });

  return embed;
}

async function createWeeklyEVReport(userTier?: string): Promise<EmbedBuilder> {
  const summary = await evService.getEVSummary({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  const embed = new EmbedBuilder()
    .setTitle('📊 Weekly EV Analysis')
    .setColor(userTier === 'vip_plus' ? 0xff4500 : 0xffd700)
    .setTimestamp();

  let description = `**📈 7-Day Performance:**\n`;
  description += `• Total Picks: ${summary.totalPicks}\n`;
  description += `• Positive EV Rate: ${((summary.positiveEVPicks / summary.totalPicks) * 100).toFixed(1)}%\n`;
  description += `• Average EV: ${summary.averageEV.toFixed(2)}%\n`;
  description += `• Total Expected Profit: $${summary.totalExpectedProfit.toFixed(2)}\n\n`;

  // Daily breakdown
  description += `**📅 Daily Breakdown:**\n`;
  summary.evByTimeRange.slice(0, 7).forEach(day => {
    const date = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    description += `• ${date}: ${day.totalPicks} picks, ${day.averageEV.toFixed(1)}% avg EV\n`;
  });

  // Top sports
  description += `\n**🏆 Top Sports by EV:**\n`;
  const sortedSports = Object.values(summary.evBySport)
    .sort((a, b) => b.averageEV - a.averageEV)
    .slice(0, 3);

  sortedSports.forEach(sport => {
    description += `• ${sport.sport}: ${sport.averageEV.toFixed(2)}% (${sport.totalPicks} picks)\n`;
  });

  embed.setDescription(description);
  embed.setFooter({ text: `${userTier?.toUpperCase()} Weekly Report | Data from last 7 days` });

  return embed;
}

async function createMonthlyEVReport(userTier?: string): Promise<EmbedBuilder> {
  const summary = await evService.getEVSummary({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  });

  const embed = new EmbedBuilder()
    .setTitle('📊 Monthly EV Analysis')
    .setColor(userTier === 'vip_plus' ? 0xff4500 : 0xffd700)
    .setTimestamp();

  let description = `**📈 30-Day Performance:**\n`;
  description += `• Total Picks: ${summary.totalPicks}\n`;
  description += `• Positive EV Rate: ${((summary.positiveEVPicks / summary.totalPicks) * 100).toFixed(1)}%\n`;
  description += `• Average EV: ${summary.averageEV.toFixed(2)}%\n`;
  description += `• Total Expected Profit: $${summary.totalExpectedProfit.toFixed(2)}\n\n`;

  // Best and worst picks
  if (summary.bestEVPick) {
    description += `**🔥 Best EV Pick:**\n`;
    description += `• ${summary.bestEVPick.playerName} ${summary.bestEVPick.overUnder.toUpperCase()} ${summary.bestEVPick.line}\n`;
    description += `• EV: ${summary.bestEVPick.evPercentage.toFixed(2)}% | Expected: $${summary.bestEVPick.expectedProfit.toFixed(2)}\n\n`;
  }

  // Sport performance
  description += `**🏆 Sport Performance:**\n`;
  const sortedSports = Object.values(summary.evBySport)
    .sort((a, b) => b.averageEV - a.averageEV);

  sortedSports.forEach(sport => {
    const profitIcon = sport.totalExpectedProfit > 0 ? '💰' : '📉';
    description += `${profitIcon} **${sport.sport}**: ${sport.averageEV.toFixed(2)}% EV (${sport.totalPicks} picks)\n`;
  });

  embed.setDescription(description);
  embed.setFooter({ text: `${userTier?.toUpperCase()} Monthly Report | Data from last 30 days` });

  return embed;
}

async function createUserLeaderboard(userTier?: string): Promise<EmbedBuilder> {
  const leaderboard = await evService.getUserEVLeaderboard({
    timeRange: 'week',
    limit: 10
  });

  const embed = new EmbedBuilder()
    .setTitle('🏆 EV Leaderboard - Weekly')
    .setColor(userTier === 'vip_plus' ? 0xff4500 : 0xffd700)
    .setTimestamp();

  if (leaderboard.length === 0) {
    embed.setDescription('No user data available for the leaderboard.');
    return embed;
  }

  let description = `**📊 Top Performers (Last 7 Days):**\n\n`;

  leaderboard.forEach((user, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    const username = user.username || `User ${user.discordId.slice(-4)}`;
    
    description += `${medal} **${username}**\n`;
    description += `   • Avg EV: ${user.averageEV.toFixed(2)}% (${user.totalPicks} picks)\n`;
    description += `   • Win Rate: ${(user.winRate * 100).toFixed(1)}%\n`;
    description += `   • ROI: ${user.roi.toFixed(1)}%\n\n`;
  });

  embed.setDescription(description);
  embed.setFooter({ text: `${userTier?.toUpperCase()} Leaderboard | Updated hourly` });

  return embed;
}

async function createSportBreakdown(userTier?: string): Promise<EmbedBuilder> {
  const summary = await evService.getEVSummary({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  const embed = new EmbedBuilder()
    .setTitle('🏈 Sport-by-Sport EV Breakdown')
    .setColor(userTier === 'vip_plus' ? 0xff4500 : 0xffd700)
    .setTimestamp();

  const sortedSports = Object.values(summary.evBySport)
    .sort((a, b) => b.totalPicks - a.totalPicks);

  if (sortedSports.length === 0) {
    embed.setDescription('No sport data available.');
    return embed;
  }

  let description = `**📊 Weekly Sport Performance:**\n\n`;

  sortedSports.forEach(sport => {
    const sportIcon = getSportIcon(sport.sport);
    const evIcon = sport.averageEV > 0 ? '📈' : '📉';
    
    description += `${sportIcon} **${sport.sport}**\n`;
    description += `   ${evIcon} Avg EV: ${sport.averageEV.toFixed(2)}%\n`;
    description += `   📊 Total Picks: ${sport.totalPicks}\n`;
    description += `   💰 Expected Profit: $${sport.totalExpectedProfit.toFixed(2)}\n`;
    
    if (sport.bestEVPick) {
      description += `   🔥 Best Pick: ${sport.bestEVPick.playerName} (${sport.bestEVPick.evPercentage.toFixed(1)}% EV)\n`;
    }
    
    description += `\n`;
  });

  embed.setDescription(description);
  embed.setFooter({ text: `${userTier?.toUpperCase()} Sport Analysis | Last 7 days` });

  return embed;
}

async function createUserEVAnalysis(discordId: string, timeRange: 'today' | 'week' | 'month'): Promise<EmbedBuilder> {
  const startDate = getStartDateForRange(timeRange);
  const userAnalyses = await evService.getEVAnalysis({
    startDate,
    discordId,
    limit: 20
  });

  const embed = new EmbedBuilder()
    .setTitle(`👤 User EV Analysis - ${timeRange.charAt(0).toUpperCase() + timeRange.slice(1)}`)
    .setColor(0xff4500);

  if (userAnalyses.length === 0) {
    embed.setDescription('No picks found for this user in the selected time range.');
    return embed;
  }

  const positiveEV = userAnalyses.filter(a => a.expectedValue > 0).length;
  const avgEV = userAnalyses.reduce((sum, a) => sum + a.evPercentage, 0) / userAnalyses.length;
  const totalExpectedProfit = userAnalyses.reduce((sum, a) => sum + a.expectedProfit, 0);

  let description = `**📊 Performance Summary:**\n`;
  description += `• Total Picks: ${userAnalyses.length}\n`;
  description += `• Positive EV: ${positiveEV} (${((positiveEV / userAnalyses.length) * 100).toFixed(1)}%)\n`;
  description += `• Average EV: ${avgEV.toFixed(2)}%\n`;
  description += `• Expected Profit: $${totalExpectedProfit.toFixed(2)}\n\n`;

  description += `**🔥 Recent Picks:**\n`;
  userAnalyses.slice(0, 5).forEach(pick => {
    const evIcon = pick.expectedValue > 0 ? '💰' : '⚠️';
    description += `${evIcon} ${pick.playerName} ${pick.overUnder.toUpperCase()} ${pick.line}\n`;
    description += `   EV: ${pick.evPercentage.toFixed(2)}% | Expected: $${pick.expectedProfit.toFixed(2)}\n`;
  });

  embed.setDescription(description);
  embed.setFooter({ text: `VIP+ User Analysis | ${timeRange} data` });

  return embed;
}

function createNavigationButtons(currentType: string, userTier?: string): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  const buttons = [
    new ButtonBuilder()
      .setCustomId('ev_today')
      .setLabel('Today')
      .setStyle(currentType === 'today' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('📅'),
    new ButtonBuilder()
      .setCustomId('ev_week')
      .setLabel('Week')
      .setStyle(currentType === 'week' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('📊'),
    new ButtonBuilder()
      .setCustomId('ev_leaderboard')
      .setLabel('Leaderboard')
      .setStyle(currentType === 'leaderboard' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('🏆'),
    new ButtonBuilder()
      .setCustomId('ev_sports')
      .setLabel('Sports')
      .setStyle(currentType === 'sports' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setEmoji('🏈')
  ];

  if (userTier === 'vip_plus') {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('ev_month')
        .setLabel('Month')
        .setStyle(currentType === 'month' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji('📈')
    );
  }

  row.addComponents(buttons);
  return row;
}

function createErrorEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('❌ Error')
    .setDescription('Unable to generate EV report. Please try again later.')
    .setColor(0xff0000);
}

function getSportIcon(sport: string): string {
  const icons: { [key: string]: string } = {
    'NBA': '🏀',
    'NFL': '🏈',
    'NHL': '🏒',
    'MLB': '⚾',
    'Soccer': '⚽',
    'Other': '🎯'
  };
  return icons[sport] || '🎯';
}

function getStartDateForRange(timeRange: 'today' | 'week' | 'month'): string {
  const now = new Date();
  
  switch (timeRange) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }
}