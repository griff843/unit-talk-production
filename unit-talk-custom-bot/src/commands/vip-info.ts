import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createVIPInfoEmbed } from '../utils/embeds';
import { logger } from '../utils/logger';

export const vipInfoCommand = {
  data: new SlashCommandBuilder()
    .setName('vip-info')
    .setDescription('View VIP membership benefits, pricing, and upgrade options'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const vipInfoEmbed = createVIPInfoEmbed();
      
      // Create action buttons
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('upgrade_vip')
            .setLabel('🚀 Upgrade to VIP')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('upgrade_vip_plus')
            .setLabel('👑 Upgrade to VIP+')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('start_trial')
            .setLabel('🎟️ Start $1 Trial')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.reply({ 
        embeds: [vipInfoEmbed], 
        components: [actionRow],
        ephemeral: true 
      });

      logger.info(`VIP info command used by ${interaction.user.username}`);
    } catch (error) {
      logger.error('Error in vip-info command:', error);
      await interaction.reply({ 
        content: 'An error occurred while showing VIP information.', 
        ephemeral: true 
      });
    }
  }
};