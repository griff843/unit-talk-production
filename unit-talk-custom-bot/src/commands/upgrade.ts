import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createVIPInfoEmbed } from '../utils/embeds';
import { permissionsService } from '../services/permissions';
import { logger } from '../utils/logger';

export const upgradeCommand = {
  data: new SlashCommandBuilder()
    .setName('upgrade')
    .setDescription('Quick upgrade to VIP membership'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      // Get user's current permissions
      const member = interaction.member;
      if (!member || typeof member === 'string') {
        await interaction.reply({ 
          content: 'Unable to determine your permissions.', 
          ephemeral: true 
        });
        return;
      }

      const permissions = await permissionsService.getUserPermissions(member as any);
      
      // Check if user is already VIP or higher
      if (permissions.tier === 'vip' || permissions.tier === 'vip_plus') {
        await interaction.reply({ 
          content: `You're already a ${permissions.tier === 'vip' ? 'VIP' : 'VIP+'} member! Use \`/vip-info\` to see upgrade options.`, 
          ephemeral: true 
        });
        return;
      }

      const vipInfoEmbed = createVIPInfoEmbed();
      
      // Create upgrade buttons
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
            .setLabel('🎟️ Try $1 Trial First')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.reply({ 
        embeds: [vipInfoEmbed], 
        components: [actionRow],
        ephemeral: true 
      });

      logger.info(`Upgrade command used by ${interaction.user.username} (current tier: ${permissions.tier})`);
    } catch (error) {
      logger.error('Error in upgrade command:', error);
      await interaction.reply({ 
        content: 'An error occurred while processing your upgrade request.', 
        ephemeral: true 
      });
    }
  }
};