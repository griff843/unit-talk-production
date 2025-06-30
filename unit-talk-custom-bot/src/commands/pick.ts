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

export const data = new SlashCommandBuilder()
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
          .setName('sport')
          .setDescription('Sport category')
          .setRequired(true)
          .addChoices(
            { name: 'NFL', value: 'nfl' },
            { name: 'NBA', value: 'nba' },
            { name: 'MLB', value: 'mlb' },
            { name: 'NHL', value: 'nhl' },
            { name: 'College Football', value: 'ncaaf' },
            { name: 'College Basketball', value: 'ncaab' },
            { name: 'Soccer', value: 'soccer' },
            { name: 'Other', value: 'other' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('history')
      .setDescription('View your pick history and stats')
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription('Number of recent picks to show (default: 10)')
          .setMinValue(1)
          .setMaxValue(50)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('coaching')
      .setDescription('Get personalized coaching on your picks')
      .addStringOption(option =>
        option
          .setName('pick_id')
          .setDescription('Specific pick ID for detailed coaching')
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    // Check VIP+ permissions
    const member = interaction.member as GuildMember;
    if (!member) {
      await interaction.reply({
        content: 'Unable to determine your permissions.',
        ephemeral: true
      });
      return;
    }

    const hasVipPlus = await PermissionUtils.hasVipPlusAccess(member);
    if (!hasVipPlus) {
      const accessDeniedEmbed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('🔒 VIP+ Access Required')
        .setDescription('Pick submission and management is exclusive to VIP+ members.')
        .addFields({
          name: '🎯 VIP+ Features',
          value: '• Advanced pick grading\n• Personalized coaching\n• Detailed analytics\n• Priority support'
        });

      const upgradeButton = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('upgrade_vip_plus')
            .setLabel('👑 Upgrade to VIP+')
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.reply({
        embeds: [accessDeniedEmbed],
        components: [upgradeButton],
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'submit':
        await handlePickSubmission(interaction);
        break;
      case 'history':
        await handlePickHistory(interaction);
        break;
      case 'coaching':
        await handlePickCoaching(interaction);
        break;
      default:
        await interaction.reply({
          content: 'Unknown subcommand.',
          ephemeral: true
        });
    }

  } catch (error) {
    logger.error('Error in pick command:', error);
    await interaction.reply({
      content: 'An error occurred while processing your pick command.',
      ephemeral: true
    });
  }
}

async function handlePickSubmission(interaction: ChatInputCommandInteraction): Promise<void> {
  const description = interaction.options.getString('description', true);
  const odds = interaction.options.getNumber('odds', true);
  const units = interaction.options.getNumber('units', true);
  const confidence = interaction.options.getInteger('confidence', true);
  const sport = interaction.options.getString('sport', true);

  // Create pick submission
  const pickSubmission: UserPickSubmission = {
    id: `temp-${Date.now()}`, // Add required id
    userId: interaction.user.id,
    gameId: `game-${Date.now()}`, // Add required gameId
    description,
    odds: odds.toString(), // Convert number to string
    units,
    confidence,
    sport,
    timestamp: new Date(),
    status: 'pending',
    betType: 'single', // Add required betType
    legs: [], // Add required legs array
    stake: units, // Add required stake (same as units for now)
    pick: { // Add required pick object
      id: `pick-${Date.now()}`,
      user_id: interaction.user.id,
      message_id: interaction.id || '',
      channel_id: interaction.channelId || '',
      sport,
      league: 'Unknown',
      team1: 'Team A',
      team2: 'Team B',
      pick_type: 'single',
      description,
      odds: odds,
      units,
      confidence,
      reasoning: undefined,
      result: undefined,
      profit_loss: undefined,
      created_at: new Date(),
      updated_at: new Date()
    }
  };

  try {
    // Submit to grading service
    const supabaseService = new SupabaseService();
    const gradingService = new PickGradingService(supabaseService);
    const gradingResult = await gradingService.gradeUserPick(pickSubmission);

    // Save to database
    const savedPick = await supabaseService.createPick({
      ...pickSubmission,
      grade: gradingResult.grade,
      analysis: gradingResult.feedback || gradingResult.notes || 'No analysis available'
    });

    // Create response embed
    const resultEmbed = new EmbedBuilder()
      .setColor(getGradeColor(gradingResult.grade))
      .setTitle(`${getGradeEmoji(gradingResult.grade)} Pick Submitted & Graded`)
      .setDescription(`**${description}**`)
      .addFields(
        { name: '📊 Grade', value: gradingResult.grade, inline: true },
        { name: '🎯 Confidence', value: `${confidence}/10`, inline: true },
        { name: '💰 Units', value: units.toString(), inline: true },
        { name: '📈 Odds', value: formatOdds(odds), inline: true },
        { name: '🏆 Sport', value: sport.toUpperCase(), inline: true },
        { name: '🆔 Pick ID', value: savedPick.id, inline: true },
        { name: '🔍 Analysis', value: gradingResult.feedback || gradingResult.notes || 'Analysis pending...' }
      )
      .setTimestamp()
      .setFooter({ text: 'Unit Talk Pro Grading System' });

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`coaching_${savedPick.id}`)
          .setLabel('Get Coaching')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎯'),
        new ButtonBuilder()
          .setCustomId(`share_pick_${savedPick.id}`)
          .setLabel('Share Pick')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📤')
      );

    await interaction.reply({
      embeds: [resultEmbed],
      components: [actionRow],
      ephemeral: true
    });

    logger.info(`Pick submitted and graded for user ${interaction.user.username}`, {
      pickId: savedPick.id,
      grade: gradingResult.grade,
      sport
    });

  } catch (error) {
    logger.error('Error submitting pick:', error);
    await interaction.reply({
      content: 'Failed to submit pick. Please try again.',
      ephemeral: true
    });
  }
}

async function handlePickHistory(interaction: ChatInputCommandInteraction): Promise<void> {
  const limit = interaction.options.getInteger('limit') || 10;

  try {
    const supabaseService = new SupabaseService();
    const picks = await supabaseService.getUserPicks(interaction.user.id, limit);

    if (picks.length === 0) {
      await interaction.reply({
        content: 'You haven\'t submitted any picks yet. Use `/pick submit` to get started!',
        ephemeral: true
      });
      return;
    }

    // Calculate stats
    const stats = calculatePickStats(picks);

    const historyEmbed = new EmbedBuilder()
      .setColor('#4ECDC4')
      .setTitle(`📊 Your Pick History (Last ${picks.length})`)
      .addFields(
        { name: '🎯 Total Picks', value: stats.total.toString(), inline: true },
        { name: '✅ Wins', value: stats.wins.toString(), inline: true },
        { name: '❌ Losses', value: stats.losses.toString(), inline: true },
        { name: '📈 Win Rate', value: `${stats.winRate}%`, inline: true },
        { name: '💰 Total Units', value: stats.totalUnits.toFixed(2), inline: true },
        { name: '📊 ROI', value: `${stats.roi}%`, inline: true }
      );

    // Add recent picks
    const recentPicks = picks.slice(0, 5).map(pick => 
      `${getGradeEmoji(pick.grade)} **${pick.description}** (${pick.grade})`
    ).join('\n');

    historyEmbed.addFields({
      name: '🕒 Recent Picks',
      value: recentPicks || 'No recent picks'
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('detailed_stats')
          .setLabel('Detailed Stats')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📈'),
        new ButtonBuilder()
          .setCustomId('export_picks')
          .setLabel('Export Data')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📤')
      );

    await interaction.reply({
      embeds: [historyEmbed],
      components: [actionRow],
      ephemeral: true
    });

  } catch (error) {
    logger.error('Error fetching pick history:', error);
    await interaction.reply({
      content: 'Failed to fetch pick history. Please try again.',
      ephemeral: true
    });
  }
}

async function handlePickCoaching(interaction: ChatInputCommandInteraction): Promise<void> {
  const pickId = interaction.options.getString('pick_id');

  try {
    const supabaseService = new SupabaseService();
    const gradingService = new PickGradingService(supabaseService);
    const coachingService = new CoachingService(supabaseService, gradingService);
    let coachingResult: BettingAnalysis;

    if (pickId) {
      // Get coaching for specific pick
      const supabaseService = new SupabaseService();
      const pick = await supabaseService.getPick(pickId);
      
      if (!pick || pick.userId !== interaction.user.id) {
        await interaction.reply({
          content: 'Pick not found or you don\'t have permission to view it.',
          ephemeral: true
        });
        return;
      }

      coachingResult = await coachingService.getDetailedCoaching(pick);
    } else {
      // Get general coaching based on recent picks
      const supabaseService = new SupabaseService();
      const recentPicks = await supabaseService.getUserPicks(interaction.user.id, 10);
      coachingResult = await coachingService.getGeneralCoaching(recentPicks);
    }

    const coachingEmbed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('🎯 Personalized Coaching Session')
      .setDescription(coachingResult.summary || 'No summary available')
      .addFields(
        { name: '💡 Key Insights', value: coachingResult.insights?.join('\n') || 'No insights available' },
        { name: '📈 Improvement Areas', value: coachingResult.improvements?.join('\n') || 'No improvements identified' },
        { name: '🎯 Next Steps', value: coachingResult.recommendations?.join('\n') || 'No recommendations available' }
      )
      .setTimestamp()
      .setFooter({ text: 'Unit Talk Pro Coaching' });

    const actionRow = createCoachingActionRow();

    await interaction.reply({
      embeds: [coachingEmbed],
      components: [actionRow],
      ephemeral: true
    });

  } catch (error) {
    logger.error('Error providing coaching:', error);
    await interaction.reply({
      content: 'Failed to provide coaching. Please try again.',
      ephemeral: true
    });
  }
}

// Helper functions
function getGradeColor(grade: string): number {
  switch (grade.toUpperCase()) {
    case 'S': return 0x00FF00; // Green
    case 'A': return 0x32CD32; // Lime Green
    case 'B': return 0xFFD700; // Gold
    case 'C': return 0xFF8C00; // Orange
    case 'D': return 0xFF4500; // Red Orange
    case 'F': return 0xFF0000; // Red
    default: return 0x808080; // Gray
  }
}

function getGradeEmoji(grade: string): string {
  switch (grade.toUpperCase()) {
    case 'S': return '🏆';
    case 'A': return '⭐';
    case 'B': return '👍';
    case 'C': return '👌';
    case 'D': return '👎';
    case 'F': return '❌';
    default: return '❓';
  }
}

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : odds.toString();
}

function calculatePickStats(picks: any[]): any {
  const total = picks.length;
  const wins = picks.filter(p => p.result === 'win').length;
  const losses = picks.filter(p => p.result === 'loss').length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const totalUnits = picks.reduce((sum, pick) => sum + (pick.units || 0), 0);
  const roi = totalUnits > 0 ? Math.round(((wins - losses) / totalUnits) * 100) : 0;

  return { total, wins, losses, winRate, totalUnits, roi };
}

function createCoachingActionRow(): ActionRowBuilder<ButtonBuilder> {
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