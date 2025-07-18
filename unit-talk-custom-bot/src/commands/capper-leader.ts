import { CommandInteraction, CacheType, ButtonInteraction } from '@discordjs/core';
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getUserTier, hasMinimumTier } from '../utils/roleUtils';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('capper-leader')
  .setDescription('View capper leaderboard and performance rankings (VIP+ required)')
  .addStringOption(option =>
    option.setName('timeframe')
      .setDescription('Timeframe for leaderboard')
      .setRequired(false)
      .addChoices(
        { name: 'This Week', value: 'week' },
        { name: 'This Month', value: 'month' },
        { name: 'All Time', value: 'all' }
      )
  )
  .addStringOption(option =>
    option.setName('sport')
      .setDescription('Filter by sport')
      .setRequired(false)
      .addChoices(
        { name: 'All Sports', value: 'all' },
        { name: 'NBA', value: 'nba' },
        { name: 'NFL', value: 'nfl' },
        { name: 'MLB', value: 'mlb' },
        { name: 'NHL', value: 'nhl' }
      )
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
        .setDescription('The capper leaderboard is available to VIP+ members and above.')
        .setColor(0xFF4500)
        .addFields(
          {
            name: '💎 VIP+ Benefits',
            value: '• Full capper leaderboard access\n• Advanced performance metrics\n• Historical data & trends\n• Capper comparison tools\n• ROI tracking by sport',
            inline: false
          },
          {
            name: '⭐ Current VIP Benefits',
            value: 'As a VIP member, you have access to all picks and basic stats. Upgrade to VIP+ for advanced analytics!',
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
            .setCustomId('view_vip_plus_features')
            .setLabel('Learn More')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❓')
        );

      await interaction.editReply({ 
        embeds: [embed], 
        components: [actionRow]
      });
      return;
    }

    const timeframe = interaction.options.getString('timeframe') || 'month';
    const sport = interaction.options.getString('sport') || 'all';

    // Mock leaderboard data (this would normally come from database)
    const leaderboardData = [
      {
        rank: 1,
        name: "ProCapper1",
        winRate: 68.5,
        totalPicks: 127,
        wins: 87,
        losses: 40,
        units: 24.8,
        roi: 19.5,
        streak: "W5"
      },
      {
        rank: 2,
        name: "EliteAnalyst",
        winRate: 65.2,
        totalPicks: 115,
        wins: 75,
        losses: 40,
        units: 18.3,
        roi: 15.9,
        streak: "L1"
      },
      {
        rank: 3,
        name: "BaseballGuru",
        winRate: 63.8,
        totalPicks: 94,
        wins: 60,
        losses: 34,
        units: 15.7,
        roi: 16.7,
        streak: "W3"
      },
      {
        rank: 4,
        name: "SportsMaster",
        winRate: 61.4,
        totalPicks: 88,
        wins: 54,
        losses: 34,
        units: 12.4,
        roi: 14.1,
        streak: "W2"
      },
      {
        rank: 5,
        name: "PicksExpert",
        winRate: 59.7,
        totalPicks: 72,
        wins: 43,
        losses: 29,
        units: 8.9,
        roi: 12.4,
        streak: "L2"
      }
    ];

    const timeframeText = timeframe === 'week' ? 'This Week' : timeframe === 'month' ? 'This Month' : 'All Time';
    const sportText = sport === 'all' ? 'All Sports' : sport.toUpperCase();

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Capper Leaderboard - ${timeframeText}`)
      .setDescription(`Performance rankings for ${sportText}`)
      .setColor(0xFFD700)
      .setTimestamp();

    // Add top 5 cappers
    leaderboardData.forEach((capper, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${capper.rank}.`;
      embed.addFields({
        name: `${medal} ${capper.name}`,
        value: `**Win Rate:** ${capper.winRate}% (${capper.wins}W-${capper.losses}L)\n**Units:** +${capper.units} | **ROI:** ${capper.roi}%\n**Streak:** ${capper.streak}`,
        inline: true
      });
    });

    embed.addFields({
      name: '📊 Leaderboard Stats',
      value: `Showing top 5 cappers for ${timeframeText.toLowerCase()}\nFiltered by: ${sportText}`,
      inline: false
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('full_leaderboard')
          .setLabel('View Full Rankings')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId('capper_details')
          .setLabel('Capper Details')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('👤'),
        new ButtonBuilder()
          .setCustomId('export_data')
          .setLabel('Export Data')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📈')
      );

    await interaction.editReply({ 
      embeds: [embed], 
      components: [actionRow]
    });

    logger.info(`Capper leaderboard viewed by ${interaction.user.tag} (${userTier}) - ${timeframe}/${sport}`);

  } catch (error) {
    logger.error('Error in capper-leader command:', error);
    await interaction.editReply('❌ An error occurred while fetching the leaderboard.');
  }
}