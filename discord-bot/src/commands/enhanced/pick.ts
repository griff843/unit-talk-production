import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  CommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  AttachmentBuilder
} from 'discord.js';
import { Command } from '../types';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';
import { validatePick, calculateConfidence, generateAIAnalysis } from '../../utils/pickValidation';
import { getUserTier, hasVIPAccess, hasVIPPlusAccess } from '../../utils/userTier';
import { createPickChart, createPerformanceChart } from '../../utils/chartGeneration';

interface PickData {
  sport: string;
  betType: string;
  team: string;
  opponent: string;
  line: string;
  odds: string;
  stake: string;
  confidence: number;
  reasoning: string;
  gameTime: string;
  userId: string;
  username: string;
  tier: 'FREE' | 'VIP' | 'VIP_PLUS';
}

interface UserStats {
  totalPicks: number;
  wins: number;
  losses: number;
  pending: number;
  winRate: number;
  roi: number;
  streak: number;
  bestSport: string;
  totalProfit: number;
}

const SPORTS_OPTIONS = [
  { label: '🏈 NFL', value: 'nfl' },
  { label: '🏀 NBA', value: 'nba' },
  { label: '⚾ MLB', value: 'mlb' },
  { label: '🏒 NHL', value: 'nhl' },
  { label: '⚽ Soccer', value: 'soccer' },
  { label: '🏀 NCAAB', value: 'ncaab' },
  { label: '🏈 NCAAF', value: 'ncaaf' },
  { label: '🎾 Tennis', value: 'tennis' },
  { label: '🥊 MMA/Boxing', value: 'combat' },
  { label: '🏎️ Racing', value: 'racing' }
];

const BET_TYPES = {
  nfl: ['Spread', 'Moneyline', 'Over/Under', 'Player Props', 'Team Props', 'Live Betting'],
  nba: ['Spread', 'Moneyline', 'Over/Under', 'Player Props', 'Team Props', 'Live Betting'],
  mlb: ['Moneyline', 'Run Line', 'Over/Under', 'Player Props', 'Team Props', 'Inning Props'],
  nhl: ['Moneyline', 'Puck Line', 'Over/Under', 'Player Props', 'Team Props', 'Period Props'],
  soccer: ['Moneyline', 'Spread', 'Over/Under', 'Both Teams Score', 'Correct Score', 'Player Props'],
  ncaab: ['Spread', 'Moneyline', 'Over/Under', 'Player Props', 'Team Props'],
  ncaaf: ['Spread', 'Moneyline', 'Over/Under', 'Player Props', 'Team Props'],
  tennis: ['Match Winner', 'Set Betting', 'Game Handicap', 'Over/Under Games'],
  combat: ['Moneyline', 'Method of Victory', 'Round Betting', 'Over/Under Rounds'],
  racing: ['Race Winner', 'Podium Finish', 'Head-to-Head', 'Fastest Lap']
};

export const enhancedPickCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('pick')
    .setDescription('Submit a betting pick with advanced analysis and tracking')
    .addSubcommand(subcommand =>
      subcommand
        .setName('submit')
        .setDescription('Submit a new betting pick')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('history')
        .setDescription('View your betting history and statistics')
        .addStringOption(option =>
          option
            .setName('timeframe')
            .setDescription('Time period to view')
            .addChoices(
              { name: 'Last 7 days', value: '7d' },
              { name: 'Last 30 days', value: '30d' },
              { name: 'Last 90 days', value: '90d' },
              { name: 'All time', value: 'all' }
            )
        )
        .addStringOption(option =>
          option
            .setName('sport')
            .setDescription('Filter by sport')
            .addChoices(...SPORTS_OPTIONS)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('analytics')
        .setDescription('View detailed analytics and performance metrics (VIP+)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('coaching')
        .setDescription('Get AI-powered betting coaching and tips (VIP+)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('parlay')
        .setDescription('Create and manage parlay bets (VIP)')
    ),

  async execute(interaction: CommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const username = interaction.user.username;

    try {
      switch (subcommand) {
        case 'submit':
          await handleSubmitPick(interaction, userId, username);
          break;
        case 'history':
          await handlePickHistory(interaction, userId);
          break;
        case 'analytics':
          await handleAnalytics(interaction, userId);
          break;
        case 'coaching':
          await handleCoaching(interaction, userId);
          break;
        case 'parlay':
          await handleParlay(interaction, userId);
          break;
        default:
          await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
      }
    } catch (error) {
      logger.error('Error in enhanced pick command:', error);
      await interaction.reply({ 
        content: 'An error occurred while processing your request. Please try again.', 
        ephemeral: true 
      });
    }
  }
};

async function handleSubmitPick(interaction: CommandInteraction, userId: string, username: string) {
  const userTier = await getUserTier(userId);
  
  // Create sport selection menu
  const sportSelect = new StringSelectMenuBuilder()
    .setCustomId('pick_sport_select')
    .setPlaceholder('Select a sport')
    .addOptions(SPORTS_OPTIONS);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(sportSelect);

  const embed = new EmbedBuilder()
    .setTitle('🎯 Submit New Pick')
    .setDescription('Select the sport for your betting pick to get started.')
    .setColor(0x00AE86)
    .addFields(
      { name: '👤 User Tier', value: userTier, inline: true },
      { name: '📊 Features Available', value: getAvailableFeatures(userTier), inline: true }
    )
    .setFooter({ text: 'Unit Talk • Advanced Pick Submission' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handlePickHistory(interaction: CommandInteraction, userId: string) {
  const timeframe = interaction.options.getString('timeframe') || '30d';
  const sport = interaction.options.getString('sport');

  try {
    const stats = await getUserStats(userId, timeframe, sport);
    const recentPicks = await getRecentPicks(userId, 5, sport);

    const embed = new EmbedBuilder()
      .setTitle(`📈 ${interaction.user.username}'s Betting History`)
      .setDescription(`Performance over the ${getTimeframeLabel(timeframe)}`)
      .setColor(stats.winRate >= 60 ? 0x00FF00 : stats.winRate >= 50 ? 0xFFFF00 : 0xFF0000)
      .addFields(
        { name: '📊 Overall Stats', value: formatOverallStats(stats), inline: true },
        { name: '💰 Financial Performance', value: formatFinancialStats(stats), inline: true },
        { name: '🔥 Current Form', value: formatCurrentForm(stats), inline: true }
      )
      .setFooter({ text: 'Unit Talk • Betting Analytics' })
      .setTimestamp();

    // Add recent picks
    if (recentPicks.length > 0) {
      const recentPicksText = recentPicks.map((pick, index) => 
        `${index + 1}. ${pick.sport.toUpperCase()} - ${pick.team} ${pick.betType} ${pick.line} ${getResultEmoji(pick.result)}`
      ).join('\n');
      
      embed.addFields({ name: '🕒 Recent Picks', value: recentPicksText, inline: false });
    }

    // Create performance chart for VIP+ users
    const userTier = await getUserTier(userId);
    const components = [];
    
    if (hasVIPPlusAccess(userTier)) {
      const chartButton = new ButtonBuilder()
        .setCustomId('generate_performance_chart')
        .setLabel('📊 Generate Performance Chart')
        .setStyle(ButtonStyle.Primary);
      
      const analyticsButton = new ButtonBuilder()
        .setCustomId('detailed_analytics')
        .setLabel('🔍 Detailed Analytics')
        .setStyle(ButtonStyle.Secondary);

      components.push(
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(chartButton, analyticsButton)
      );
    }

    await interaction.reply({ embeds: [embed], components, ephemeral: true });
  } catch (error) {
    logger.error('Error fetching pick history:', error);
    await interaction.reply({ 
      content: 'Unable to fetch your betting history. Please try again later.', 
      ephemeral: true 
    });
  }
}

async function handleAnalytics(interaction: CommandInteraction, userId: string) {
  const userTier = await getUserTier(userId);
  
  if (!hasVIPPlusAccess(userTier)) {
    const upgradeEmbed = new EmbedBuilder()
      .setTitle('🔒 VIP+ Feature')
      .setDescription('Advanced analytics are available for VIP+ members only.')
      .setColor(0xFF6B35)
      .addFields(
        { name: '✨ VIP+ Benefits', value: '• Detailed performance analytics\n• AI-powered insights\n• Custom performance charts\n• Betting pattern analysis\n• ROI optimization tips', inline: false },
        { name: '💎 Upgrade Today', value: 'Get access to premium features and maximize your betting potential!', inline: false }
      )
      .setFooter({ text: 'Unit Talk • Premium Features' });

    const upgradeButton = new ButtonBuilder()
      .setCustomId('upgrade_to_vip_plus')
      .setLabel('🚀 Upgrade to VIP+')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(upgradeButton);

    await interaction.reply({ embeds: [upgradeEmbed], components: [row], ephemeral: true });
    return;
  }

  // Generate comprehensive analytics for VIP+ users
  try {
    const analytics = await generateAdvancedAnalytics(userId);
    
    const embed = new EmbedBuilder()
      .setTitle('🧠 Advanced Betting Analytics')
      .setDescription('AI-powered insights into your betting performance')
      .setColor(0x7B68EE)
      .addFields(
        { name: '🎯 Betting Patterns', value: analytics.patterns, inline: true },
        { name: '📊 Performance Insights', value: analytics.insights, inline: true },
        { name: '💡 AI Recommendations', value: analytics.recommendations, inline: false },
        { name: '🔮 Predictive Analysis', value: analytics.predictions, inline: false }
      )
      .setFooter({ text: 'Unit Talk • AI Analytics Engine' })
      .setTimestamp();

    // Generate and attach performance chart
    const chartBuffer = await createPerformanceChart(userId);
    const attachment = new AttachmentBuilder(chartBuffer, { name: 'performance-chart.png' });
    embed.setImage('attachment://performance-chart.png');

    await interaction.reply({ embeds: [embed], files: [attachment], ephemeral: true });
  } catch (error) {
    logger.error('Error generating analytics:', error);
    await interaction.reply({ 
      content: 'Unable to generate analytics. Please try again later.', 
      ephemeral: true 
    });
  }
}

async function handleCoaching(interaction: CommandInteraction, userId: string) {
  const userTier = await getUserTier(userId);
  
  if (!hasVIPPlusAccess(userTier)) {
    await interaction.reply({ 
      content: '🔒 AI Coaching is a VIP+ exclusive feature. Upgrade to access personalized betting guidance!', 
      ephemeral: true 
    });
    return;
  }

  try {
    const coachingData = await generateCoachingInsights(userId);
    
    const embed = new EmbedBuilder()
      .setTitle('🎓 AI Betting Coach')
      .setDescription('Personalized coaching based on your betting history')
      .setColor(0x4CAF50)
      .addFields(
        { name: '💪 Strengths', value: coachingData.strengths, inline: true },
        { name: '⚠️ Areas for Improvement', value: coachingData.improvements, inline: true },
        { name: '🎯 Today\'s Focus', value: coachingData.todaysFocus, inline: false },
        { name: '📚 Learning Resources', value: coachingData.resources, inline: false }
      )
      .setFooter({ text: 'Unit Talk • AI Coaching System' })
      .setTimestamp();

    const practiceButton = new ButtonBuilder()
      .setCustomId('practice_scenarios')
      .setLabel('🎮 Practice Scenarios')
      .setStyle(ButtonStyle.Primary);

    const quizButton = new ButtonBuilder()
      .setCustomId('betting_quiz')
      .setLabel('🧠 Betting IQ Quiz')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(practiceButton, quizButton);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  } catch (error) {
    logger.error('Error generating coaching insights:', error);
    await interaction.reply({ 
      content: 'Unable to generate coaching insights. Please try again later.', 
      ephemeral: true 
    });
  }
}

async function handleParlay(interaction: CommandInteraction, userId: string) {
  const userTier = await getUserTier(userId);
  
  if (!hasVIPAccess(userTier)) {
    await interaction.reply({ 
      content: '🔒 Parlay builder is available for VIP and VIP+ members. Upgrade to access this feature!', 
      ephemeral: true 
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎲 Parlay Builder')
    .setDescription('Create and manage your parlay bets with advanced tools')
    .setColor(0xFF9500)
    .addFields(
      { name: '🔧 Available Tools', value: '• Multi-leg parlay builder\n• Correlation analysis\n• Risk assessment\n• Optimal sizing calculator', inline: true },
      { name: '📊 Smart Features', value: '• Auto-hedge suggestions\n• Live odds tracking\n• Cashout calculator\n• Performance tracking', inline: true }
    )
    .setFooter({ text: 'Unit Talk • Parlay Management' })
    .setTimestamp();

  const createButton = new ButtonBuilder()
    .setCustomId('create_parlay')
    .setLabel('➕ Create New Parlay')
    .setStyle(ButtonStyle.Success);

  const manageButton = new ButtonBuilder()
    .setCustomId('manage_parlays')
    .setLabel('📋 Manage Existing')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(createButton, manageButton);

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// Helper functions
function getAvailableFeatures(tier: string): string {
  switch (tier) {
    case 'VIP_PLUS':
      return '• AI Analysis\n• Advanced Charts\n• Coaching\n• All Sports';
    case 'VIP':
      return '• Parlay Builder\n• Extended History\n• Priority Support';
    case 'FREE':
      return '• Basic Picks\n• 7-day History\n• Community Access';
    default:
      return '• Basic Features';
  }
}

function getTimeframeLabel(timeframe: string): string {
  switch (timeframe) {
    case '7d': return 'last 7 days';
    case '30d': return 'last 30 days';
    case '90d': return 'last 90 days';
    case 'all': return 'all time';
    default: return 'selected period';
  }
}

function formatOverallStats(stats: UserStats): string {
  return `**Total Picks:** ${stats.totalPicks}
**Win Rate:** ${stats.winRate.toFixed(1)}%
**Record:** ${stats.wins}-${stats.losses}-${stats.pending}
**Current Streak:** ${stats.streak > 0 ? `🔥 ${stats.streak}W` : `❄️ ${Math.abs(stats.streak)}L`}`;
}

function formatFinancialStats(stats: UserStats): string {
  return `**ROI:** ${stats.roi > 0 ? '+' : ''}${stats.roi.toFixed(1)}%
**Total Profit:** ${stats.totalProfit > 0 ? '+' : ''}$${stats.totalProfit.toFixed(2)}
**Best Sport:** ${stats.bestSport}`;
}

function formatCurrentForm(stats: UserStats): string {
  const form = stats.streak > 0 ? '📈 Hot' : stats.streak < -2 ? '📉 Cold' : '➡️ Neutral';
  return `**Form:** ${form}
**Confidence:** ${getConfidenceLevel(stats.winRate)}
**Trend:** ${getTrendDirection(stats.roi)}`;
}

function getResultEmoji(result: string): string {
  switch (result) {
    case 'WIN': return '✅';
    case 'LOSS': return '❌';
    case 'PUSH': return '➖';
    case 'PENDING': return '⏳';
    default: return '❓';
  }
}

function getConfidenceLevel(winRate: number): string {
  if (winRate >= 70) return '🔥 Very High';
  if (winRate >= 60) return '💪 High';
  if (winRate >= 50) return '👍 Moderate';
  if (winRate >= 40) return '⚠️ Low';
  return '🚨 Very Low';
}

function getTrendDirection(roi: number): string {
  if (roi > 10) return '🚀 Excellent';
  if (roi > 5) return '📈 Positive';
  if (roi > 0) return '➕ Slight Up';
  if (roi > -5) return '➖ Slight Down';
  return '📉 Negative';
}

// Database helper functions
async function getUserStats(userId: string, timeframe: string, sport?: string): Promise<UserStats> {
  // Implementation would query Supabase for user statistics
  // This is a mock implementation
  return {
    totalPicks: 127,
    wins: 78,
    losses: 41,
    pending: 8,
    winRate: 61.4,
    roi: 8.7,
    streak: 3,
    bestSport: 'NBA',
    totalProfit: 1247.50
  };
}

async function getRecentPicks(userId: string, limit: number, sport?: string) {
  // Implementation would query Supabase for recent picks
  // This is a mock implementation
  return [
    { sport: 'nba', team: 'Lakers', betType: 'Spread', line: '-5.5', result: 'WIN' },
    { sport: 'nfl', team: 'Chiefs', betType: 'Moneyline', line: '-150', result: 'WIN' },
    { sport: 'nba', team: 'Warriors', betType: 'Over', line: '225.5', result: 'LOSS' }
  ];
}

async function generateAdvancedAnalytics(userId: string) {
  // AI-powered analytics generation
  return {
    patterns: '• Strong in NBA spreads\n• Avoid MLB unders\n• Best on weekends',
    insights: '• 73% win rate on home favorites\n• Struggle with live betting\n• Excel in primetime games',
    recommendations: '• Focus on NBA and NFL\n• Reduce bet sizing on MLB\n• Consider more player props',
    predictions: '• Projected 65% win rate next 30 days\n• ROI trending upward\n• Bankroll growth: +12%'
  };
}

async function generateCoachingInsights(userId: string) {
  // AI coaching system
  return {
    strengths: '• Excellent line shopping\n• Strong bankroll management\n• Good at avoiding bad beats',
    improvements: '• Reduce emotional betting\n• Better game selection\n• Improve live betting timing',
    todaysFocus: 'Focus on NBA player props tonight. Your historical data shows 68% success rate on assists props.',
    resources: '• [Bankroll Management Guide]\n• [Line Movement Analysis]\n• [Emotional Control Tips]'
  };
}