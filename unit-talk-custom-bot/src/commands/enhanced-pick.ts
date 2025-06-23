import { 
  SlashCommandBuilder, 
  CommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  User,
  AttachmentBuilder
} from 'discord.js';
import { 
  PickData, 
  EnhancedTicketFormData, 
  EnhancedTicketLeg,
  BettingAnalysis,
  AICoachingInsight,
  SubmissionResult,
  UserTier,
  SearchResults
} from '../types';
import { SportsDataService } from '../services/sportsData';
import { AIAnalysisService } from '../services/aiAnalysis';
import { ValidationService } from '../services/validation';

// Mock services initialization
const sportsDataService = new SportsDataService();
const aiAnalysisService = new AIAnalysisService();
const validationService = new ValidationService();

// Mock database service
const database = {
  async savePick(pickData: PickData): Promise<string> {
    return `pick_${Date.now()}`;
  },
  async getUserTier(userId: string): Promise<UserTier> {
    return 'vip_plus'; // Mock tier
  },
  async getUserStats(userId: string): Promise<any> {
    return {
      totalPicks: 45,
      winRate: 0.62,
      profit: 1250,
      avgOdds: -110,
      bestStreak: 8
    };
  }
};

export const data = new SlashCommandBuilder()
  .setName('pick')
  .setDescription('Enhanced pick management with AI analysis and advanced features')
  .addSubcommand(subcommand =>
    subcommand
      .setName('submit')
      .setDescription('Submit a betting pick with enhanced analysis')
      .addStringOption(option =>
        option
          .setName('sport')
          .setDescription('Sport for the pick')
          .setRequired(true)
          .addChoices(
            { name: 'NFL', value: 'nfl' },
            { name: 'NBA', value: 'nba' },
            { name: 'MLB', value: 'mlb' },
            { name: 'NHL', value: 'nhl' },
            { name: 'Soccer', value: 'soccer' },
            { name: 'College Football', value: 'ncaaf' },
            { name: 'College Basketball', value: 'ncaab' },
            { name: 'Tennis', value: 'tennis' },
            { name: 'MMA/Boxing', value: 'combat' }
          )
      )
      .addStringOption(option =>
        option
          .setName('type')
          .setDescription('Type of bet')
          .setRequired(true)
          .addChoices(
            { name: 'Point Spread', value: 'spread' },
            { name: 'Moneyline', value: 'moneyline' },
            { name: 'Total (Over/Under)', value: 'total' },
            { name: 'Player Props', value: 'player_props' },
            { name: 'Team Props', value: 'team_props' },
            { name: 'Parlay', value: 'parlay' },
            { name: 'Same Game Parlay', value: 'sgp' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('analytics')
      .setDescription('View your betting analytics and performance metrics')
      .addStringOption(option =>
        option
          .setName('timeframe')
          .setDescription('Analytics timeframe')
          .addChoices(
            { name: 'Last 7 Days', value: '7d' },
            { name: 'Last 30 Days', value: '30d' },
            { name: 'Last 90 Days', value: '90d' },
            { name: 'All Time', value: 'all' }
          )
      )
      .addStringOption(option =>
        option
          .setName('sport')
          .setDescription('Filter by sport')
          .addChoices(
            { name: 'All Sports', value: 'all' },
            { name: 'NFL', value: 'nfl' },
            { name: 'NBA', value: 'nba' },
            { name: 'MLB', value: 'mlb' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('coaching')
      .setDescription('Get AI-powered betting coaching and insights')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('parlay')
      .setDescription('Build an optimized parlay with correlation analysis')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('history')
      .setDescription('View your pick history with detailed breakdowns')
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription('Number of picks to show (default: 10)')
          .setMinValue(1)
          .setMaxValue(50)
      )
  );

export async function execute(interaction: CommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'submit':
        await handleSubmitPick(interaction);
        break;
      case 'analytics':
        await handleAnalytics(interaction);
        break;
      case 'coaching':
        await handleCoaching(interaction);
        break;
      case 'parlay':
        await handleParlayBuilder(interaction);
        break;
      case 'history':
        await handleHistory(interaction);
        break;
      default:
        await interaction.reply({ 
          content: 'Unknown subcommand. Please try again.', 
          ephemeral: true 
        });
    }
  } catch (error) {
    console.error('Enhanced pick command error:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Command Error')
      .setDescription('An error occurred while processing your request. Please try again.')
      .setColor(0xff0000)
      .setTimestamp();

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}

/**
 * Handle pick submission with enhanced form
 */
async function handleSubmitPick(interaction: CommandInteraction) {
  const sport = interaction.options.get('sport')?.value as string;
  const betType = interaction.options.get('type')?.value as string;
  const userTier = await database.getUserTier(interaction.user.id);

  // Create enhanced submission form
  const embed = new EmbedBuilder()
    .setTitle('🎯 Enhanced Pick Submission')
    .setDescription(`Submit your ${sport.toUpperCase()} ${betType} pick with AI-powered analysis`)
    .setColor(0x00ff00)
    .addFields([
      {
        name: '🔥 Enhanced Features',
        value: getTierFeatures(userTier),
        inline: false
      },
      {
        name: '📊 What You Get',
        value: '• Real-time odds validation\n• AI confidence scoring\n• Expected value calculation\n• Risk assessment\n• Personalized coaching tips',
        inline: false
      }
    ])
    .setFooter({ text: `${userTier.toUpperCase()} Member • Enhanced Submission` })
    .setTimestamp();

  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`enhanced_submit_${sport}_${betType}`)
        .setLabel('Open Enhanced Form')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🚀'),
      new ButtonBuilder()
        .setCustomId('quick_submit')
        .setLabel('Quick Submit')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚡'),
      new ButtonBuilder()
        .setCustomId('parlay_builder')
        .setLabel('Parlay Builder')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔗')
    );

  await interaction.reply({ embeds: [embed], components: [actionRow] });
}

/**
 * Handle analytics display with advanced charts
 */
async function handleAnalytics(interaction: CommandInteraction) {
  const timeframe = interaction.options.get('timeframe')?.value as string || '30d';
  const sport = interaction.options.get('sport')?.value as string || 'all';
  const userTier = await database.getUserTier(interaction.user.id);
  const userStats = await database.getUserStats(interaction.user.id);

  await interaction.deferReply();

  // Generate analytics data
  const analyticsData = await generateAnalyticsData(interaction.user.id, timeframe, sport);
  
  const embed = new EmbedBuilder()
    .setTitle('📊 Advanced Betting Analytics')
    .setDescription(`Performance analysis for ${timeframe === 'all' ? 'all time' : `last ${timeframe}`}`)
    .setColor(0x3498db)
    .addFields([
      {
        name: '🎯 Overall Performance',
        value: `**Win Rate:** ${(userStats.winRate * 100).toFixed(1)}%\n**Total Picks:** ${userStats.totalPicks}\n**Profit/Loss:** $${userStats.profit > 0 ? '+' : ''}${userStats.profit}`,
        inline: true
      },
      {
        name: '📈 Key Metrics',
        value: `**ROI:** ${((userStats.profit / (userStats.totalPicks * 100)) * 100).toFixed(1)}%\n**Avg Odds:** ${userStats.avgOdds}\n**Best Streak:** ${userStats.bestStreak}`,
        inline: true
      },
      {
        name: '🏆 Tier Benefits',
        value: getTierAnalyticsFeatures(userTier),
        inline: false
      }
    ])
    .setThumbnail(interaction.user.displayAvatarURL())
    .setFooter({ text: `${userTier.toUpperCase()} Analytics • Updated ${new Date().toLocaleString()}` })
    .setTimestamp();

  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('detailed_charts')
        .setLabel('Detailed Charts')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📊'),
      new ButtonBuilder()
        .setCustomId('export_data')
        .setLabel('Export Data')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📥'),
      new ButtonBuilder()
        .setCustomId('compare_peers')
        .setLabel('Compare to Peers')
        .setStyle(ButtonStyle.Success)
        .setEmoji('👥')
    );

  // Add tier-specific features
  if (userTier === 'vip_plus') {
    const chartAttachment = await generateAdvancedChart(analyticsData);
    await interaction.editReply({ 
      embeds: [embed], 
      components: [actionRow],
      files: chartAttachment ? [chartAttachment] : undefined
    });
  } else {
    await interaction.editReply({ embeds: [embed], components: [actionRow] });
  }
}

/**
 * Handle AI coaching insights
 */
async function handleCoaching(interaction: CommandInteraction) {
  const userTier = await database.getUserTier(interaction.user.id);
  
  if (userTier === 'member') {
    const upgradeEmbed = new EmbedBuilder()
      .setTitle('🤖 AI Coaching - VIP Feature')
      .setDescription('Unlock personalized AI coaching with VIP membership!')
      .setColor(0xf39c12)
      .addFields([
        {
          name: '🎯 What You\'ll Get',
          value: '• Personalized betting strategies\n• Bankroll management advice\n• Market timing insights\n• Performance optimization tips',
          inline: false
        },
        {
          name: '💎 Upgrade Benefits',
          value: '• Advanced analytics\n• Priority support\n• Exclusive channels\n• AI-powered insights',
          inline: false
        }
      ])
      .setFooter({ text: 'Upgrade to VIP to unlock AI coaching' });

    const upgradeRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('upgrade_vip')
          .setLabel('Upgrade to VIP')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⭐'),
        new ButtonBuilder()
          .setCustomId('learn_more')
          .setLabel('Learn More')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('ℹ️')
      );

    await interaction.reply({ embeds: [upgradeEmbed], components: [upgradeRow] });
    return;
  }

  await interaction.deferReply();

  // Get recent picks for analysis
  const recentPicks = await getRecentPicks(interaction.user.id, 20);
  const coachingInsights = await aiAnalysisService.generateCoachingInsights(
    interaction.user.id, 
    recentPicks
  );

  const embed = new EmbedBuilder()
    .setTitle('🤖 AI Betting Coach')
    .setDescription('Personalized insights based on your betting patterns')
    .setColor(0x9b59b6)
    .setThumbnail(interaction.user.displayAvatarURL())
    .setFooter({ text: `${userTier.toUpperCase()} AI Coaching • Powered by GPT-4` })
    .setTimestamp();

  // Add top 3 insights
  coachingInsights.slice(0, 3).forEach((insight, index) => {
    const priorityEmoji = insight.priority === 'high' ? '🔴' : insight.priority === 'medium' ? '🟡' : '🟢';
    embed.addFields([
      {
        name: `${priorityEmoji} ${insight.title}`,
        value: `${insight.description}\n\n**Action Steps:**\n${insight.actionable_steps.map(step => `• ${step}`).join('\n')}`,
        inline: false
      }
    ]);
  });

  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('more_insights')
        .setLabel('More Insights')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🧠'),
      new ButtonBuilder()
        .setCustomId('strategy_session')
        .setLabel('Strategy Session')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📋'),
      new ButtonBuilder()
        .setCustomId('coaching_history')
        .setLabel('Coaching History')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📚')
    );

  await interaction.editReply({ embeds: [embed], components: [actionRow] });
}

/**
 * Handle parlay builder with correlation analysis
 */
async function handleParlayBuilder(interaction: CommandInteraction) {
  const userTier = await database.getUserTier(interaction.user.id);
  
  const embed = new EmbedBuilder()
    .setTitle('🔗 Advanced Parlay Builder')
    .setDescription('Build optimized parlays with AI-powered correlation analysis')
    .setColor(0xe74c3c)
    .addFields([
      {
        name: '🧠 Smart Features',
        value: '• Correlation detection\n• EV optimization\n• Risk assessment\n• Alternative suggestions',
        inline: true
      },
      {
        name: '📊 Analysis Tools',
        value: '• Market movement tracking\n• Sharp vs public money\n• Injury impact assessment\n• Weather considerations',
        inline: true
      },
      {
        name: '🎯 Your Tier Benefits',
        value: getTierParlayFeatures(userTier),
        inline: false
      }
    ])
    .setFooter({ text: `${userTier.toUpperCase()} Parlay Builder` })
    .setTimestamp();

  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('start_parlay_builder')
        .setLabel('Start Building')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🚀'),
      new ButtonBuilder()
        .setCustomId('parlay_templates')
        .setLabel('Templates')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋'),
      new ButtonBuilder()
        .setCustomId('correlation_guide')
        .setLabel('Correlation Guide')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📚')
    );

  await interaction.reply({ embeds: [embed], components: [actionRow] });
}

/**
 * Handle pick history with detailed breakdowns
 */
async function handleHistory(interaction: CommandInteraction) {
  const limit = interaction.options.get('limit')?.value as number || 10;
  const userTier = await database.getUserTier(interaction.user.id);

  await interaction.deferReply();

  const recentPicks = await getRecentPicks(interaction.user.id, limit);
  
  const embed = new EmbedBuilder()
    .setTitle('📚 Pick History')
    .setDescription(`Your last ${recentPicks.length} picks with detailed analysis`)
    .setColor(0x95a5a6)
    .setThumbnail(interaction.user.displayAvatarURL())
    .setFooter({ text: `${userTier.toUpperCase()} History • ${recentPicks.length} picks shown` })
    .setTimestamp();

  // Add pick summaries
  recentPicks.slice(0, 5).forEach((pick, index) => {
    const statusEmoji = getStatusEmoji(pick.status);
    const profitLoss = calculatePickPL(pick);
    
    embed.addFields([
      {
        name: `${statusEmoji} ${pick.sport.toUpperCase()} - ${pick.bet_type}`,
        value: `**Selection:** ${pick.selection}\n**Odds:** ${pick.odds > 0 ? '+' : ''}${pick.odds}\n**Stake:** $${pick.stake}\n**P/L:** ${profitLoss > 0 ? '+' : ''}$${profitLoss.toFixed(2)}\n**Date:** ${new Date(pick.created_at).toLocaleDateString()}`,
        inline: true
      }
    ]);
  });

  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('full_history')
        .setLabel('Full History')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📖'),
      new ButtonBuilder()
        .setCustomId('filter_history')
        .setLabel('Filter & Search')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔍'),
      new ButtonBuilder()
        .setCustomId('export_history')
        .setLabel('Export CSV')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📊')
    );

  await interaction.editReply({ embeds: [embed], components: [actionRow] });
}

// Helper functions

function getTierFeatures(tier: UserTier): string {
  const features = {
    member: '• Basic pick submission\n• Standard validation\n• Community access',
    vip: '• AI analysis\n• Advanced validation\n• Priority support\n• Enhanced charts',
    vip_plus: '• Full AI coaching\n• Correlation analysis\n• Custom charts\n• Parlay optimization\n• OCR image processing',
    staff: '• All VIP+ features\n• Moderation tools\n• Admin dashboard',
    admin: '• Full platform access\n• User management\n• System configuration',
    owner: '• Complete control\n• All features unlocked'
  };
  
  return features[tier] || features.member;
}

function getTierAnalyticsFeatures(tier: UserTier): string {
  const features = {
    member: '• Basic win/loss tracking\n• Simple charts\n• 30-day history',
    vip: '• Advanced metrics\n• Custom timeframes\n• Peer comparisons\n• Export capabilities',
    vip_plus: '• AI-powered insights\n• Predictive analytics\n• Custom dashboards\n• Real-time updates\n• Advanced visualizations',
    staff: '• All VIP+ features\n• Community analytics\n• Moderation insights',
    admin: '• Platform-wide analytics\n• User behavior insights\n• System performance metrics',
    owner: '• Complete analytics suite\n• Business intelligence\n• Revenue tracking'
  };
  
  return features[tier] || features.member;
}

function getTierParlayFeatures(tier: UserTier): string {
  const features = {
    member: '• Basic parlay building\n• Up to 5 legs\n• Standard validation',
    vip: '• Correlation warnings\n• Up to 8 legs\n• EV calculations\n• Risk assessment',
    vip_plus: '• Full correlation analysis\n• Unlimited legs\n• AI optimization\n• Alternative suggestions\n• Market movement tracking',
    staff: '• All VIP+ features\n• Community parlay insights',
    admin: '• Platform parlay analytics\n• User parlay patterns',
    owner: '• Complete parlay intelligence\n• Revenue optimization'
  };
  
  return features[tier] || features.member;
}

function getStatusEmoji(status: string): string {
  const emojis = {
    won: '✅',
    lost: '❌',
    pending: '⏳',
    void: '🚫',
    pushed: '🤝'
  };
  
  return emojis[status as keyof typeof emojis] || '❓';
}

function calculatePickPL(pick: PickData): number {
  if (pick.status === 'pending') return 0;
  if (pick.status === 'void' || pick.status === 'pushed') return 0;
  
  if (pick.status === 'won') {
    if (pick.odds > 0) {
      return (pick.stake * pick.odds) / 100;
    } else {
      return (pick.stake * 100) / Math.abs(pick.odds);
    }
  } else {
    return -pick.stake;
  }
}

async function generateAnalyticsData(userId: string, timeframe: string, sport: string): Promise<any> {
  // Mock implementation - replace with actual database queries
  return {
    winRate: 0.62,
    totalPicks: 45,
    profit: 1250,
    chartData: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      datasets: [{
        label: 'Profit/Loss',
        data: [150, -75, 300, 200],
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 2
      }]
    }
  };
}

async function generateAdvancedChart(data: any): Promise<AttachmentBuilder | null> {
  // Mock implementation - in reality, this would generate actual charts
  // using libraries like Chart.js or similar
  return null;
}

async function getRecentPicks(userId: string, limit: number): Promise<PickData[]> {
  // Mock implementation - replace with actual database query
  return Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
    id: `pick_${i}`,
    user_id: userId,
    sport: ['NFL', 'NBA', 'MLB'][i % 3],
    bet_type: ['spread', 'moneyline', 'total'][i % 3],
    selection: `Mock Selection ${i + 1}`,
    odds: [-110, +150, -200][i % 3],
    stake: 100,
    confidence: Math.floor(Math.random() * 5) + 6,
    status: ['won', 'lost', 'pending'][i % 3] as any,
    created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
  }));
}