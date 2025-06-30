import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createInfoEmbed, createErrorEmbed } from '../utils/embeds';
import { permissionsService } from '../services/permissions';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('heat-signal')
  .setDescription('Access live heat signals and steam alerts (VIP+ only)');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    // Check user permissions
    const member = interaction.member;
    if (!member || typeof member === 'string') {
      await interaction.reply({ 
        content: 'Unable to determine your permissions.', 
        ephemeral: true 
      });
      return;
    }

    const permissions = await permissionsService.getUserPermissions(member as any);
    
    // Check if user has VIP+ access
    if (permissions.tier !== 'vip_plus') {
      const accessDeniedEmbed = createErrorEmbed(
        'VIP+ Access Required',
        'Heat Signal access is exclusive to VIP+ members.'
      );
      
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('upgrade_vip_plus')
            .setLabel('👑 Upgrade to VIP+')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('view_vip_info')
            .setLabel('💎 View VIP Info')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.reply({ 
        embeds: [accessDeniedEmbed], 
        components: [actionRow],
        ephemeral: true 
      });
      return;
    }

    // Create heat signal embed (placeholder for actual heat signal data)
    const heatSignalEmbed = createInfoEmbed(
      '🔥 Heat Signal Dashboard',
      'Live market movement and steam alerts'
    )
    .addFields(
      {
        name: '🚨 Active Alerts',
        value: '• NBA: Lakers vs Warriors - Line moved 2.5pts\n• NFL: Chiefs vs Bills - Heavy action on Over\n• MLB: Yankees vs Red Sox - Sharp money on Under',
      },
      {
        name: '📊 Market Temperature',
        value: '🔥🔥🔥 **HOT** - Multiple steam moves detected\n⚡ **LIVE** - Real-time monitoring active',
      },
      {
        name: '⏰ Last Updated',
        value: `<t:${Math.floor(Date.now() / 1000)}:R>`
      }
    );

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('refresh_heat_signal')
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('heat_signal_settings')
          .setLabel('⚙️ Settings')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('heat_signal_help')
          .setLabel('❓ Help')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.reply({ 
      embeds: [heatSignalEmbed], 
      components: [actionRow],
      ephemeral: true 
    });

    logger.info(`Heat signal command used by VIP+ member ${interaction.user.username}`);
  } catch (error) {
    logger.error('Error in heat-signal command:', error);
    await interaction.reply({ 
      content: 'An error occurred while accessing heat signals.', 
      ephemeral: true 
    });
  }
}