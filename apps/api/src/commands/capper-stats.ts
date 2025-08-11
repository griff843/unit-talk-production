import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  GuildMember
} from 'discord.js';

import { capperService } from '../services/capperService';
import { logger } from '../shared/logger';
import { CapperProfile, CapperStats } from '../types/capper';
import { hasRole, getTierColor } from '../utils/roleUtils';

export const data = new SlashCommandBuilder()
  .setName('capper-stats')
  .setDescription('View capper statistics and performance');

export async function execute(interaction: CommandInteraction) {
  try {
    // Check if user has capper role
    const member = interaction.member as GuildMember;
    if (!hasRole(member, 'UT Capper')) {
      await interaction.reply({
        content: '❌ You need the **UT Capper** role to view stats.',
        ephemeral: true
      });
      return;
    }

    // Get capper profile
    const capperProfile = await capperService.getCapperByDiscordId(interaction.user.id) as CapperProfile | null;
    if (!capperProfile) {
      await interaction.reply({
        content: '❌ You need to complete capper onboarding first. Use `/capper-onboard` to get started.',
        ephemeral: true
      });
      return;
    }

    // Get stats
    const stats = await capperService.getCapperStats(capperProfile.id) as unknown as CapperStats;

    // Create stats embed
    const embed = new EmbedBuilder()
      .setTitle(`📊 ${capperProfile.display_name || capperProfile.discord_username}'s Stats`)
      .setColor(getTierColor(capperProfile.tier || 'rookie'))
      .addFields(
        { name: 'Tier', value: (capperProfile.tier || 'rookie').toUpperCase(), inline: true },
        { name: 'Total Picks', value: stats.total_picks.toString(), inline: true },
        { name: 'Win Rate', value: `${(stats.win_rate * 100).toFixed(1)}%`, inline: true },
        { name: 'Pushes', value: (stats.pushes || 0).toString(), inline: true },
        { name: 'ROI', value: `${(stats.roi * 100).toFixed(1)}%`, inline: true },
        { name: 'Profit/Loss', value: `${(stats.profit_loss || 0) > 0 ? '+' : ''}${(stats.profit_loss || 0).toFixed(2)} units`, inline: true },
        { name: 'Current Streak', value: (stats.current_streak || 0).toString(), inline: true }
      );

    if (capperProfile.specialties && capperProfile.specialties.length > 0) {
      embed.addFields({ 
        name: 'Specialties', 
        value: capperProfile.specialties.join(', '), 
        inline: false 
      });
    }

    if (capperProfile.bio) {
      embed.setDescription(capperProfile.bio);
    }

    embed.setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });

  } catch (error) {
    logger.error('Error in capper-stats command', { error });
    await interaction.reply({
      content: '❌ An error occurred while fetching your stats.',
      ephemeral: true
    });
  }
}