import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createTrialStatusEmbed, createErrorEmbed } from '../utils/embeds';
import { SupabaseService } from '../services/supabase';
import { logger } from '../utils/logger';

export const trialStatusCommand = {
  data: new SlashCommandBuilder()
    .setName('trial-status')
    .setDescription('Check your trial status and remaining time'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const supabaseService = new SupabaseService();
      
      // Get user's trial information from database
      const { data: trialData, error } = await supabaseService.client
        .from('user_trials')
        .select('*')
        .eq('discord_id', interaction.user.id)
        .eq('active', true)
        .single();

      if (error || !trialData) {
        const noTrialEmbed = createErrorEmbed(
          'No Active Trial',
          'You don\'t have an active trial. Use `/vip-info` to start your $1 trial!'
        );
        
        const actionRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('start_trial')
              .setLabel('🎟️ Start $1 Trial')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('view_vip_info')
              .setLabel('💎 View VIP Info')
              .setStyle(ButtonStyle.Secondary)
          );

        await interaction.reply({ 
          embeds: [noTrialEmbed], 
          components: [actionRow],
          ephemeral: true 
        });
        return;
      }

      // Calculate remaining time
      const trialEndTime = new Date(trialData.expires_at);
      const now = new Date();
      const hoursRemaining = Math.max(0, Math.floor((trialEndTime.getTime() - now.getTime()) / (1000 * 60 * 60)));

      if (hoursRemaining <= 0) {
        const expiredEmbed = createErrorEmbed(
          'Trial Expired',
          'Your trial has expired. Upgrade now to maintain your VIP access!'
        );
        
        const actionRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('upgrade_vip')
              .setLabel('🚀 Upgrade to VIP')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('upgrade_vip_plus')
              .setLabel('👑 Upgrade to VIP+')
              .setStyle(ButtonStyle.Success)
          );

        await interaction.reply({ 
          embeds: [expiredEmbed], 
          components: [actionRow],
          ephemeral: true 
        });
        return;
      }

      const trialStatusEmbed = createTrialStatusEmbed(hoursRemaining);
      
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('upgrade_vip')
            .setLabel('💎 Upgrade to Full VIP')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('extend_trial')
            .setLabel('⏰ Extend Trial')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('trial_help')
            .setLabel('❓ Trial Help')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.reply({ 
        embeds: [trialStatusEmbed], 
        components: [actionRow],
        ephemeral: true 
      });

      logger.info(`Trial status command used by ${interaction.user.username}, ${hoursRemaining}h remaining`);
    } catch (error) {
      logger.error('Error in trial-status command:', error);
      await interaction.reply({ 
        content: 'An error occurred while checking your trial status.', 
        ephemeral: true 
      });
    }
  }
};