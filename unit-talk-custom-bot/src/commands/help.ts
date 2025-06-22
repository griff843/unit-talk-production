import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { createHelpEmbed } from '../utils/embeds';
import { permissionsService } from '../services/permissions';
import { logger } from '../utils/logger';

export const helpCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands and bot information'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      // Get user's permissions to determine available commands
      const member = interaction.member;
      if (!member || typeof member === 'string') {
        await interaction.reply({ 
          content: 'Unable to determine your permissions.', 
          ephemeral: true 
        });
        return;
      }

      const permissions = await permissionsService.getUserPermissions(member as any);
      const helpEmbed = createHelpEmbed(permissions.tier);

      await interaction.reply({ 
        embeds: [helpEmbed], 
        ephemeral: true 
      });

      logger.info(`Help command used by ${interaction.user.username}`);
    } catch (error) {
      logger.error('Error in help command:', error);
      await interaction.reply({ 
        content: 'An error occurred while showing help information.', 
        ephemeral: true 
      });
    }
  }
};