import { CommandInteraction, CacheType, ButtonInteraction } from '@discordjs/core';
import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createVIPInfoEmbed } from '../utils/embeds';
import { permissionsService } from '../services/permissions';
import { logger } from '../utils/logger';
import { fetchFreshMember, getUserTier } from '../utils/roleUtils';

export const data = new SlashCommandBuilder()
  .setName('upgrade')
  .setDescription('Quick upgrade to VIP membership');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    if (!interaction.guild) {
      await interaction.reply({ 
        content: 'This command can only be used in a server.', 
        ephemeral: true 
      });
      return;
    }

    // Fetch fresh member data
    const member = await fetchFreshMember(interaction.guild, interaction.user.id);
    if (!member) {
      logger.error(`❌ Could not fetch member data for upgrade command`, {
        userId: interaction.user.id,
        username: interaction.user.username
      });
      await interaction.reply({ 
        content: 'Unable to verify your membership status. Please try again later.', 
        ephemeral: true 
      });
      return;
    }

    // Get current tier with fresh data
    const currentTier = getUserTier(member);
    
    // Check if user is already VIP or higher
    if (currentTier === 'vip' || currentTier === 'vip_plus') {
      await interaction.reply({ 
        content: `You're already a ${currentTier === 'vip' ? 'VIP' : 'VIP+'} member! Use \`/vip-info\` to see upgrade options.`, 
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

    logger.info(`Upgrade command used by user ${interaction.user.username}`, {
      currentTier,
      userId: interaction.user.id
    });

  } catch (error) {
    logger.error('Error in upgrade command:', {
      userId: interaction.user.id,
      username: interaction.user.username,
      error: error instanceof Error ? error.message : String(error),
      fullError: error
    });
    await interaction.reply({ 
      content: 'An error occurred while processing your upgrade request.', 
      ephemeral: true 
    });
  }
}