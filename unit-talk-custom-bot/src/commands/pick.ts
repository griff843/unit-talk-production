import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { SupabaseService } from '../services/supabase';
import { PickGradingService, CoachingService } from '../services/gradingService';
import { PermissionUtils } from '../utils/permissions';
import { UserPickSubmission, GradingResult, BettingAnalysis } from '../types';
import { logger } from '../utils/logger';

export const pickCommand = {
  data: new SlashCommandBuilder()
    .setName('pick')
    .setDescription('Submit and manage your betting picks (VIP+ only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('submit')
        .setDescription('Submit a new pick for grading')
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Pick description (e.g., "Chiefs -3.5 vs Bills")')
            .setRequired(true)
            .setMaxLength(200)
        )
        .addNumberOption(option =>
          option
            .setName('odds')
            .setDescription('Odds (American format, e.g., -110)')
            .setRequired(true)
        )
        .addNumberOption(option =>
          option
            .setName('units')
            .setDescription('Unit size (1-10)')
            .setRequired(true)
            .setMinValue(0.5)
            .setMaxValue(10)
        )
        .addIntegerOption(option =>
          option
            .setName('confidence')
            .setDescription('Confidence level (1-10)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10)
        )
        .addStringOption(option =>
          option
            .setName('game_id')
            .setDescription('Game ID (optional, for thread linking)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('history')
        .setDescription('View your pick history')
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of picks to show (default: 10)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(50)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('View your betting statistics')
        .addStringOption(option =>
          option
            .setName('period')
            .setDescription('Time period')
            .setRequired(false)
            .addChoices(
              { name: 'Last 7 days', value: '7d' },
              { name: 'Last 30 days', value: '30d' },
              { name: 'Last 90 days', value: '90d' },
              { name: 'All time', value: 'all' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('coaching')
        .setDescription('Get personalized betting coaching (VIP+ only)')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Type of coaching analysis')
            .setRequired(false)
            .addChoices(
              { name: 'Full Analysis', value: 'full' },
              { name: 'Bankroll Management', value: 'bankroll' },
              { name: 'Sport Focus', value: 'sport' },
              { name: 'Risk Assessment', value: 'risk' }
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const subcommand = interaction.options.getSubcommand();
    const supabaseService = new SupabaseService();
    const gradingService = new PickGradingService(supabaseService);
    const coachingService = new CoachingService(supabaseService, gradingService);

    try {
      switch (subcommand) {
        case 'submit':
          await handlePickSubmission(interaction, member, gradingService);
          break;
        case 'history':
          await handlePickHistory(interaction, member, supabaseService);
          break;
        case 'stats':
          await handlePickStats(interaction, member, supabaseService);
          break;
        case 'coaching':
          await handleCoaching(interaction, member, coachingService);
          break;
      }
    } catch (error) {
      logger.error('Pick command error:', error);
      
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: '❌ An error occurred while processing your request. Please try again.'
        });
      } else {
        await interaction.reply({
          content: '❌ An error occurred while processing your request. Please try again.',
          ephemeral: true
        });
      }
    }
  }
};

async function handlePickSubmission(
  interaction: ChatInputCommandInteraction, 
  member: GuildMember, 
  gradingService: PickGradingService
) {
  // Check VIP+ permission
  if (!PermissionUtils.canSubmitPicks(member)) {
    await interaction.reply({
      content: '❌ Pick submission is available to VIP+ members only.\n' +
               'Upgrade your membership to access advanced pick grading and coaching features!',
      ephemeral: true
    });
    return;
  }

  // Check rate limiting
  if (await PermissionUtils.isRateLimited(interaction.user.id, 'pick_submission')) { // Simplified rate limit check
    await interaction.reply({
      content: '⏰ You\'ve reached the pick submission limit. Please wait before submitting more picks.',
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const description = interaction.options.getString('description', true);
    const odds = interaction.options.getNumber('odds', true);
    const units = interaction.options.getNumber('units', true);
    const confidence = interaction.options.getInteger('confidence', true);
    const gameId = interaction.options.getString('game_id');

    // Create pick submission
    const pickSubmission: UserPickSubmission = {
      id: `pick_${Date.now()}_${interaction.user.id}`,
      userId: interaction.user.id,
      gameId: gameId || `game_${Date.now()}`,
      description,
      odds: odds.toString(),
      units,
      confidence,
      submittedAt: new Date(),
      pick: {
        id: `pick_${Date.now()}_${interaction.user.id}`,
        user_id: interaction.user.id,
        message_id: '',
        channel_id: interaction.channelId || '',
        sport: 'Unknown',
        league: 'Unknown',
        game: gameId || `game_${Date.now()}`,
        pick_type: 'standard',
        selection: description,
        odds: odds.toString(),
        units,
        confidence,
        reasoning: description,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      }
    };

    // Grade the pick
    const gradingResult = await gradingService.gradeUserPick(pickSubmission);

    // Create response embed
    const resultEmbed = createPickGradingEmbed(pickSubmission, gradingResult);
    const actionButtons = createPickActionButtons(pickSubmission.id || 'unknown');

    await interaction.editReply({
      content: '✅ **Pick Submitted & Graded!**',
      embeds: [resultEmbed],
      components: [actionButtons]
    });

    // Log the submission
    logger.info(`User ${interaction.user.id} submitted pick: ${description} (Edge: ${gradingResult.edge}%)`);

  } catch (error) {
    logger.error('Pick submission error:', error);
    await interaction.editReply({
      content: '❌ Failed to submit and grade your pick. Please try again.'
    });
  }
}

async function handlePickHistory(
  interaction: ChatInputCommandInteraction, 
  member: GuildMember, 
  supabaseService: SupabaseService
) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const limit = interaction.options.getInteger('limit') || 10;
    
    const { data: picks } = await supabaseService.client
      .from('user_picks')
      .select(`
        *,
        pick_gradings (
          edge,
          tier,
          confidence,
          feedback
        )
      `)
      .eq('user_id', interaction.user.id)
      .order('submitted_at', { ascending: false })
      .limit(limit);

    if (!picks || picks.length === 0) {
      await interaction.editReply({
        content: '📝 You haven\'t submitted any picks yet.\n' +
                'Use `/pick submit` to get started with pick grading!'
      });
      return;
    }

    const historyEmbed = createPickHistoryEmbed(picks, interaction.user);
    const navigationButtons = createHistoryNavigationButtons();

    await interaction.editReply({
      embeds: [historyEmbed],
      components: [navigationButtons]
    });

  } catch (error) {
    logger.error('Pick history error:', error);
    await interaction.editReply({
      content: '❌ Failed to retrieve your pick history.'
    });
  }
}

async function handlePickStats(
  interaction: ChatInputCommandInteraction, 
  member: GuildMember, 
  supabaseService: SupabaseService
) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const period = interaction.options.getString('period') || '30d';
    
    // Calculate date range
    let dateFilter = '';
    if (period !== 'all') {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      dateFilter = cutoffDate.toISOString();
    }

    // Get user picks with results
    const query = supabaseService.client
      .from('user_picks')
      .select(`
        *,
        pick_gradings (
          edge,
          tier,
          confidence
        )
      `)
      .eq('user_id', interaction.user.id);

    if (dateFilter) {
      query.gte('submitted_at', dateFilter);
    }

    const { data: picks } = await query.order('submitted_at', { ascending: false });

    if (!picks || picks.length === 0) {
      await interaction.editReply({
        content: `📊 No picks found for the selected period (${period}).`
      });
      return;
    }

    const stats = calculatePickStats(picks);
    const statsEmbed = createPickStatsEmbed(stats, period, interaction.user);
    const actionButtons = createStatsActionButtons();

    await interaction.editReply({
      embeds: [statsEmbed],
      components: [actionButtons]
    });

  } catch (error) {
    logger.error('Pick stats error:', error);
    await interaction.editReply({
      content: '❌ Failed to calculate your pick statistics.'
    });
  }
}

async function handleCoaching(
  interaction: ChatInputCommandInteraction, 
  member: GuildMember, 
  coachingService: CoachingService
) {
  // Check VIP+ permission
  if (!PermissionUtils.canAccessCoaching(member)) {
    await interaction.reply({
      content: '❌ Personalized coaching is available to VIP+ members only.\n' +
               'Upgrade to VIP+ for advanced analytics and personalized betting advice!',
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const coachingType = interaction.options.getString('type') || 'full';
    
    // Generate betting analysis
    const analysis = await coachingService.generateBettingAnalysis(interaction.user.id, '30d');
    
    // Create coaching embed based on type
    const coachingEmbed = createCoachingEmbed(analysis, coachingType, interaction.user);
    const coachingButtons = createCoachingActionButtons();

    await interaction.editReply({
      content: '🎯 **Your Personalized Coaching Report**',
      embeds: [coachingEmbed],
      components: [coachingButtons]
    });

    // Log coaching session
    logger.info(`Generated ${coachingType} coaching for user ${interaction.user.id}`);

  } catch (error) {
    logger.error('Coaching error:', error);
    await interaction.editReply({
      content: '❌ Failed to generate your coaching report. Please try again.'
    });
  }
}

function createPickGradingEmbed(pick: UserPickSubmission, grading: GradingResult): EmbedBuilder {
  const tierColor = grading.tier === 'Elite' ? 0x9B59B6 :
                   grading.tier === 'Premium' ? 0xF1C40F :
                   grading.tier === 'Strong' ? 0x2ECC71 :
                   grading.tier === 'Good' ? 0x3498DB :
                   grading.tier === 'Fair' ? 0x95A5A6 : 0xE74C3C;

  const embed = new EmbedBuilder()
    .setTitle(`🎯 Pick Graded: ${grading.tier || 'Unknown' || 'Unknown'}`)
    .setDescription(`**${pick.description || 'No description' || 'No description'}**`)
    .addFields(
      { name: '🎲 Odds', value: (pick.odds !== undefined && pick.odds !== null) ? pick.odds.toString() : 'N/A', inline: true },
      { name: '💰 Units', value: (pick.units !== undefined && pick.units !== null) ? pick.units.toString() : '1', inline: true },
      { name: '📊 Your Confidence', value: `${pick.confidence !== undefined && pick.confidence !== null ? pick.confidence : 5}/10`, inline: true },
      { name: '⚡ Calculated Edge', value: `${grading.edge !== undefined && grading.edge !== null ? grading.edge : 0}%`, inline: true },
      { name: '🏆 Tier Rating', value: grading.tier || 'Unknown', inline: true },
      { name: '🎯 System Confidence', value: `${grading.confidence !== undefined && grading.confidence !== null ? grading.confidence : 0}%`, inline: true }
    )
    .setColor(tierColor)
    .setTimestamp();

  // Add key factors
  if (grading.factors && grading.factors.length > 0) {
    const topFactors = grading.factors
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 3)
      .map((f: any) => `${f.score >= 70 ? '✅' : f.score >= 50 ? '⚠️' : '❌'} ${f.name}: ${Math.round(f.score)}%`)
      .join('\n');

    embed.addFields({ name: '📈 Key Factors', value: topFactors, inline: false });
  }

  // Add feedback summary
  if (grading.feedback) {
    const strengths = grading.feedback.strengths?.join(', ') || '';
    const weaknesses = grading.feedback.weaknesses?.join(', ') || '';
    let feedbackSummary = `Strengths: ${strengths}\nWeaknesses: ${weaknesses}`;
    if (feedbackSummary.length > 200) {
      feedbackSummary = feedbackSummary.substring(0, 200) + '...';
    }

    embed.addFields({ name: '💡 AI Feedback', value: feedbackSummary, inline: false });
  }

  return embed;
}

function createPickActionButtons(pickId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`pick_details_${pickId}`)
        .setLabel('Full Analysis')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📊'),
      new ButtonBuilder()
        .setCustomId(`pick_coaching_${pickId}`)
        .setLabel('Coaching Notes')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎯'),
      new ButtonBuilder()
        .setCustomId(`pick_share_${pickId}`)
        .setLabel('Share Pick')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📤')
    );
}

function createPickHistoryEmbed(picks: any[], user: any): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`📝 Pick History - ${user.username}`)
    .setColor(0x0099FF)
    .setTimestamp();

  if (picks.length === 0) {
    embed.setDescription('No picks found.');
    return embed;
  }

  const pickList = picks.slice(0, 10).map((pick, index) => {
    const result = pick.result ? 
      (pick.result === 'win' ? '✅' : pick.result === 'loss' ? '❌' : '⏸️') : 
      '⏳';
    
    const tier = pick.pick_gradings?.[0]?.tier || 'Ungraded';
    const edge = pick.pick_gradings?.[0]?.edge || 0;
    
    return `${index + 1}. ${result} **${pick.description}**\n` +
           `   📊 ${tier} | ⚡ ${edge}% | 💰 ${pick.units}u | 📅 ${new Date(pick.submitted_at).toLocaleDateString()}`;
  }).join('\n\n');

  embed.setDescription(pickList);

  // Add summary stats
  const completedPicks = picks.filter(p => p.result && p.result !== 'pending');
  const wins = completedPicks.filter(p => p.result === 'win').length;
  const winRate = completedPicks.length > 0 ? (wins / completedPicks.length * 100).toFixed(1) : '0';
  
  embed.addFields({
    name: '📊 Quick Stats',
    value: `Total: ${picks.length} | Completed: ${completedPicks.length} | Win Rate: ${winRate}%`,
    inline: false
  });

  return embed;
}

function createHistoryNavigationButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('history_prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️'),
      new ButtonBuilder()
        .setCustomId('history_refresh')
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔄'),
      new ButtonBuilder()
        .setCustomId('history_next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('➡️')
    );
}

function calculatePickStats(picks: any[]): any {
  const total = picks.length;
  const completed = picks.filter(p => p.result && p.result !== 'pending');
  const wins = completed.filter(p => p.result === 'win').length;
  const losses = completed.filter(p => p.result === 'loss').length;
  const pushes = completed.filter(p => p.result === 'push').length;
  
  const winRate = completed.length > 0 ? wins / completed.length : 0;
  
  // Calculate profit/loss (simplified)
  const profitLoss = completed.reduce((sum, pick) => {
    if (pick.result === 'win') return sum + pick.units;
    if (pick.result === 'loss') return sum - pick.units;
    return sum;
  }, 0);

  const avgUnits = picks.reduce((sum, pick) => sum + pick.units, 0) / total;
  const avgEdge = picks
    .filter(p => p.pick_gradings?.[0]?.edge)
    .reduce((sum, pick) => sum + pick.pick_gradings[0].edge, 0) / 
    picks.filter(p => p.pick_gradings?.[0]?.edge).length || 0;

  // Tier distribution
  const tierCounts = picks.reduce((acc, pick) => {
    const tier = pick.pick_gradings?.[0]?.tier || 'Ungraded';
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {});

  return {
    total,
    completed,
    wins,
    losses,
    pushes,
    winRate,
    profitLoss,
    avgUnits,
    avgEdge,
    tierCounts
  };
}

function createPickStatsEmbed(stats: any, period: string, user: any): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`📊 Betting Statistics - ${user.username}`)
    .setDescription(`**Period:** ${period === 'all' ? 'All Time' : period.toUpperCase()}`)
    .addFields(
      { 
        name: '🎯 Record', 
        value: `${stats.wins}W - ${stats.losses}L - ${stats.pushes}P\n` +
               `Win Rate: ${(stats.winRate * 100).toFixed(1)}%`, 
        inline: true 
      },
      { 
        name: '💰 Performance', 
        value: `P&L: ${stats.profitLoss > 0 ? '+' : ''}${stats.profitLoss.toFixed(1)} units\n` +
               `Avg Units: ${stats.avgUnits.toFixed(1)}`, 
        inline: true 
      },
      { 
        name: '⚡ Edge Analysis', 
        value: `Avg Edge: ${stats.avgEdge.toFixed(1)}%\n` +
               `Total Picks: ${stats.total}`, 
        inline: true 
      }
    )
    .setColor(stats.profitLoss > 0 ? 0x2ECC71 : stats.profitLoss < 0 ? 0xE74C3C : 0x95A5A6)
    .setTimestamp();

  // Add tier breakdown
  const tierBreakdown = Object.entries(stats.tierCounts)
    .map(([tier, count]) => `${tier}: ${count}`)
    .join(' | ');
  
  if (tierBreakdown) {
    embed.addFields({ name: '🏆 Tier Breakdown', value: tierBreakdown, inline: false });
  }

  return embed;
}

function createStatsActionButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('stats_detailed')
        .setLabel('Detailed Analysis')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📈'),
      new ButtonBuilder()
        .setCustomId('stats_coaching')
        .setLabel('Get Coaching')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎯'),
      new ButtonBuilder()
        .setCustomId('stats_export')
        .setLabel('Export Data')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📊')
    );
}

function createCoachingEmbed(analysis: BettingAnalysis, type: string, user: any): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`🎯 Coaching Report - ${user.username}`)
    .setDescription(`**Analysis Type:** ${type.charAt(0).toUpperCase() + type.slice(1)}`)
    .setColor(0x9B59B6)
    .setTimestamp();

  // Overall performance
  embed.addFields(
    {
      name: '📊 Performance Overview',
      value: `Win Rate: ${((analysis.winRate || 0) * 100).toFixed(1)}%\n` +
             `P&L: ${(analysis.profitLoss || 0) > 0 ? '+' : ''}${(analysis.profitLoss || 0).toFixed(1)} units\n` +
             `Total Bets: ${analysis.totalBets || 0}`,
      inline: true
    },
    {
      name: '⚠️ Risk Assessment',
      value: `Risk Level: ${typeof analysis.riskAssessment === 'string' ? analysis.riskAssessment.toUpperCase() : 'MEDIUM'}\n` +
             `Max Units: ${typeof analysis.riskAssessment === 'object' && analysis.riskAssessment ? (analysis.riskAssessment as any).maxRecommendedUnits || 3 : 3}\n` +
             `Avg Bet Size: ${(analysis.avgUnits || 1).toFixed(1)}u`,
      inline: true
    }
  );

  // Top recommendations
  if (analysis.recommendations && analysis.recommendations.length > 0) {
    const topRecommendations = analysis.recommendations
      .filter(r => r.priority === 'high')
      .slice(0, 3)
      .map(r => `• **${r.title}**: ${r.description}`)
      .join('\n');

    if (topRecommendations) {
      embed.addFields({
        name: '🎯 Priority Recommendations',
        value: topRecommendations,
        inline: false
      });
    }
  }

  // Sport breakdown (if available)
  if (analysis.sportBreakdown && Object.keys(analysis.sportBreakdown).length > 0) {
    const sportStats = Object.entries(analysis.sportBreakdown)
      .sort(([,a], [,b]) => (b as any).units - (a as any).units)
      .slice(0, 3)
      .map(([sport, data]: [string, any]) =>
        `${sport}: ${data.wins}/${data.count} (${data.units > 0 ? '+' : ''}${data.units.toFixed(1)}u)`
      )
      .join('\n');

    embed.addFields({ name: '🏈 Sport Performance', value: sportStats, inline: false });
  }

  return embed;
}

function createCoachingActionButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('coaching_schedule')
        .setLabel('Schedule Session')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📅'),
      new ButtonBuilder()
        .setCustomId('coaching_detailed')
        .setLabel('Full Report')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📋'),
      new ButtonBuilder()
        .setCustomId('coaching_history')
        .setLabel('Coaching History')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📚')
    );
}