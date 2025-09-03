import { CommandInteraction, ButtonInteraction } from 'discord.js';
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getUserTier, getTierDisplayName, getTierColor } from '../utils/roleUtils';
import logger from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('debug-tier')
  .setDescription('Debug your current tier and role information');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const member = interaction.guild?.members.cache.get(interaction.user.id);

    if (!member) {
      await interaction.reply({
        content: '❌ Could not find your member information.',
        ephemeral: true,
      });
      return;
    }

    // Get role information
    const roles = member.roles.cache;
    const roleNames = roles.map(role => role.name).join(', ');
    const roleDetails = roles.map(role => `${role.name} (${role.id})`).join('\n');

    // Get tier information
    const currentTier = getUserTier(member);
    const tierDisplayName = getTierDisplayName(currentTier);

    // Log for debugging
    logger.info(`🔍 Debug tier for ${interaction.user.tag}:`);
    logger.info(`  - Detected tier: ${currentTier}`);
    logger.info(`  - Role names: ${roleNames}`);
    logger.info(`  - Role details: ${roleDetails}`);

    const embed = new EmbedBuilder()
      .setTitle('🔍 Debug: Your Tier Information')
      .setColor(getTierColor(currentTier))
      .addFields(
        {
          name: '👤 User',
          value: `${interaction.user.tag} (${interaction.user.id})`,
          inline: false,
        },
        {
          name: '🎯 Detected Tier',
          value: `**${currentTier}** (${tierDisplayName})`,
          inline: false,
        },
        {
          name: '🏷️ Your Roles',
          value: roleNames || 'No roles found',
          inline: false,
        },
        {
          name: '🔧 Role Details',
          value: roleDetails || 'No role details',
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    logger.error('Error in debug-tier command:', error);
    await interaction.reply({
      content: '❌ An error occurred while debugging your tier.',
      ephemeral: true,
    });
  }
}
