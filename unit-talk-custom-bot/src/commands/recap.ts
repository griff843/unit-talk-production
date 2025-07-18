import { CommandInteraction, CacheType, ButtonInteraction } from '@discordjs/core';
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getUserTier, hasMinimumTier } from '../utils/roleUtils';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('recap')
  .setDescription('View daily recap of picks and performance')
  .addStringOption(option =>
    option.setName('date')
      .setDescription('Date for recap (YYYY-MM-DD format, defaults to today)')
      .setRequired(false)
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
    const dateOption = interaction.options.getString('date');
    const targetDate = dateOption || new Date().toISOString().toISOString().split('T')[0];

    // Mock recap data (this would normally come from database)
    const recapData = {
      date: targetDate,
      totalPicks: 12,
      winningPicks: 8,
      losingPicks: 4,
      winRate: 66.7,
      totalUnits: 15.2,
      roi: 12.3,
      topCapper: "ProCapper1",
      topCapperWinRate: 75.0,
      sports: {
        nba: { picks: 5, wins: 3, units: 4.2 },
        nfl: { picks: 4, wins: 3, units: 6.8 },
        mlb: { picks: 3, wins: 2, units: 4.2 }
      }
    };

    const embed = new EmbedBuilder()
      .setTitle(`📊 Daily Recap - ${targetDate}`)
      .setColor(0x00FF00)
      .setTimestamp();

    // Free tier gets limited recap
    if (userTier === 'member') {
      embed.setDescription('🔒 **Limited Preview** - Upgrade for full recap access!')
        .addFields(
          {
            name: '📈 Overall Performance',
            value: `**Win Rate:** ${recapData.winRate}%\n**Total Picks:** ${recapData.totalPicks}\n**Top Capper:** ${recapData.topCapper}`,
            inline: false
          },
          {
            name: '🚀 Upgrade for Full Access',
            value: '• Detailed pick breakdowns\n• Individual capper performance\n• Sport-by-sport analysis\n• Unit tracking & ROI\n• Historical data access',
            inline: false
          }
        );
    } else if (hasMinimumTier(member as any, 'vip')) {
      // VIP and above get full recap
      embed.setDescription(`Complete performance breakdown for ${targetDate}`)
        .addFields(
          {
            name: '📈 Overall Performance',
            value: `**Win Rate:** ${recapData.winRate}% (${recapData.winningPicks}W-${recapData.losingPicks}L)\n**Total Units:** +${recapData.totalUnits}\n**ROI:** ${recapData.roi}%`,
            inline: true
          },
          {
            name: '🏆 Top Performer',
            value: `**${recapData.topCapper}**\nWin Rate: ${recapData.topCapperWinRate}%`,
            inline: true
          },
          {
            name: '🏀 NBA',
            value: `${recapData.sports.nba.wins}W-${recapData.sports.nba.picks - recapData.sports.nba.wins}L\n+${recapData.sports.nba.units} units`,
            inline: true
          },
          {
            name: '🏈 NFL',
            value: `${recapData.sports.nfl.wins}W-${recapData.sports.nfl.picks - recapData.sports.nfl.wins}L\n+${recapData.sports.nfl.units} units`,
            inline: true
          },
          {
            name: '⚾ MLB',
            value: `${recapData.sports.mlb.wins}W-${recapData.sports.mlb.picks - recapData.sports.mlb.wins}L\n+${recapData.sports.mlb.units} units`,
            inline: true
          }
        );
    } else {
      // Trial users get basic recap
      embed.setDescription('Basic daily performance summary')
        .addFields(
          {
            name: '📈 Performance',
            value: `**Win Rate:** ${recapData.winRate}%\n**Total Picks:** ${recapData.totalPicks}`,
            inline: false
          },
          {
            name: '⭐ Upgrade to VIP',
            value: 'Get detailed breakdowns, unit tracking, and full analytics!',
            inline: false
          }
        );
    }

    const components = [];
    
    // Add upgrade button for non-VIP users
    if (!hasMinimumTier(member as any, 'vip')) {
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('upgrade_to_vip')
            .setLabel('Upgrade to VIP')
            .setStyle(ButtonStyle.Success)
            .setEmoji('⭐'),
          new ButtonBuilder()
            .setCustomId('view_sample_picks')
            .setLabel('View Sample Picks')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊')
        );
      components.push(actionRow);
    } else {
      // VIP users get additional options
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('detailed_recap')
            .setLabel('Detailed View')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📈'),
          new ButtonBuilder()
            .setCustomId('capper_breakdown')
            .setLabel('Capper Breakdown')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👥')
        );
      components.push(actionRow);
    }

    await interaction.editReply({ 
      embeds: [embed], 
      components: components
    });

    logger.info(`Recap viewed by ${interaction.user.tag} (${userTier}) for date: ${targetDate}`);

  } catch (error) {
    logger.error('Error in recap command:', error);
    await interaction.editReply('❌ An error occurred while fetching the recap.');
  }
}