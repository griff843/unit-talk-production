import { SlashCommandBuilder } from '@discordjs/builders';
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

import { SupabaseService } from '../services/supabase';
import { toGuildMember } from '../utils/discordUtils';
import { logger } from '../utils/logger';
import { getUserTier } from '../utils/roleUtils';

const supabaseService = new SupabaseService();

export const data = new SlashCommandBuilder()
  .setName('trends')
  .setDescription('View your betting trends and patterns')
  .addStringOption(option =>
    option
      .setName('period')
      .setDescription('Time period to analyze')
      .setRequired(true)
      .addChoices(
        { name: 'Last 24 Hours', value: '24h' },
        { name: 'Last 7 Days', value: '7d' },
        { name: 'Last 30 Days', value: '30d' },
        { name: 'All Time', value: 'all' }
      )
  )
  .addStringOption(option =>
    option
      .setName('sport')
      .setDescription('Filter by sport')
      .addChoices(
        { name: 'NBA', value: 'nba' },
        { name: 'NFL', value: 'nfl' },
        { name: 'MLB', value: 'mlb' },
        { name: 'NHL', value: 'nhl' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const userTier = getUserTier(await toGuildMember(interaction.member, interaction.guild));

    // Check if user has access
    if (!['vip_plus', 'black_label', 'admin', 'owner'].includes(userTier)) {
      await interaction.reply({
        content: '❌ Trend analysis is only available for VIP+ members and above.',
        ephemeral: true,
      });
      return;
    }

    const period = interaction.options.getString('period', true);
    const sport = interaction.options.getString('sport');

    // Get trend analysis
    const trends = await supabaseService.getEdgeTrackerTrends(interaction.user.id);

    if (!trends) {
      await interaction.reply({
        content: 'No trend data available. Submit some picks to start seeing patterns!',
        ephemeral: true,
      });
      return;
    }

    // Create trend analysis embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('📈 Your Betting Trends')
      .setDescription(
        `Analysis for ${getPeriodDisplay(period)}${sport ? ` - ${sport.toUpperCase()}` : ''}`
      )
      .addFields([
        {
          name: '🎯 Performance',
          value: [
            `Win Rate: ${trends.winRate.toFixed(1)}%`,
            `ROI: ${trends.roi.toFixed(1)}%`,
            `Units per Play: ${trends.unitsPerPlay.toFixed(1)}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '📊 Analysis',
          value: [
            `Favorite Pick Type: ${formatPickType(trends.favoritePickType)}`,
            `Best Sport: ${trends.bestSport.toUpperCase()}`,
            `Needs Work: ${trends.worstSport.toUpperCase()}`,
          ].join('\n'),
          inline: true,
        },
      ]);

    // Add recommendations based on trends
    const recommendations = generateRecommendations(trends);
    if (recommendations.length > 0) {
      embed.addFields({
        name: '💡 Recommendations',
        value: recommendations.join('\n'),
      });
    }

    // Add buttons for detailed analysis
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('trends_detailed')
        .setLabel('Detailed Analysis')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('trends_export')
        .setLabel('Export Data')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  } catch (error) {
    logger.error('Error executing trends command:', error);
    await interaction.reply({
      content: '❌ An error occurred while analyzing trends.',
      ephemeral: true,
    });
  }
}

function getPeriodDisplay(period: string): string {
  switch (period) {
    case '24h':
      return 'Last 24 Hours';
    case '7d':
      return 'Last 7 Days';
    case '30d':
      return 'Last 30 Days';
    case 'all':
      return 'All Time';
    default:
      return period;
  }
}

function formatPickType(pickType: string): string {
  return pickType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function generateRecommendations(trends: any): string[] {
  const recommendations: string[] = [];

  // Win rate recommendations
  if (trends.winRate < 50) {
    recommendations.push('🎯 Consider being more selective with picks');
  } else if (trends.winRate > 65) {
    recommendations.push('🎯 Your strategy is working well - stay consistent');
  }

  // ROI recommendations
  if (trends.roi < 0) {
    recommendations.push('💰 Review unit sizing and bankroll management');
  } else if (trends.roi > 15) {
    recommendations.push('💰 Strong ROI - consider increasing unit size');
  }

  // Units per play recommendations
  if (trends.unitsPerPlay > 3) {
    recommendations.push('⚠️ High average unit size - consider reducing risk');
  }

  return recommendations;
}
