import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  GuildMember
} from 'discord.js';
import { capperService } from '../services/capperService';
import { logger } from '../shared/logger';
import { hasRole } from '../utils/roleUtils';

export const data = new SlashCommandBuilder()
  .setName('delete-pick')
  .setDescription('Delete one of your pending picks');

export async function execute(interaction: CommandInteraction) {
  try {
    // Check if user has capper role
    const member = interaction.member as GuildMember;
    if (!hasRole(member, 'UT Capper')) {
      await interaction.reply({
        content: '❌ You need the **UT Capper** role to delete picks.',
        ephemeral: true
      });
      return;
    }

    // Check if user has a capper profile
    const capperProfile = await capperService.getCapperByDiscordId(interaction.user.id);
    if (!capperProfile) {
      await interaction.reply({
        content: '❌ You need to complete capper onboarding first. Use `/capper-onboard` to get started.',
        ephemeral: true
      });
      return;
    }

    // Get today's picks
    const today = new Date().toISOString().split('T')[0];
    const picks = await capperService.getCapperPicks(capperProfile.id, today, 'pending');

    if (picks.length === 0) {
      await interaction.reply({
        content: '❌ You have no pending picks to delete for today.',
        ephemeral: true
      });
      return;
    }

    // Show picks list
    const embed = new EmbedBuilder()
      .setTitle('🗑️ Your Pending Picks')
      .setColor(0xff0000)
      .setDescription('Here are your pending picks for today:');

    picks.forEach((pick: any, index: number) => {
      const legs = pick.legs as any[];
      const legText = legs.map(leg => `${leg.selection} (${leg.odds > 0 ? '+' : ''}${leg.odds})`).join('\n');

      embed.addFields({
        name: `Pick ${index + 1} - ${pick.pick_type.toUpperCase()}`,
        value: `${legText}\nUnits: ${pick.total_units}\nID: ${pick.id}`,
        inline: false
      });
    });

    embed.setFooter({ text: 'Contact an admin to delete specific picks using the Pick ID.' });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });

  } catch (error) {
    logger.error('Error in delete-pick command', { error });
    await interaction.reply({
      content: '❌ An error occurred while fetching your picks.',
      ephemeral: true
    });
  }
}