import { ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createTrialStatusEmbed, createErrorEmbed } from '../utils/embeds';
import { SupabaseService } from '../services/supabase';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('trial-status')
  .setDescription('Check your trial status and remaining time');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
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
    const timeRemaining = trialEndTime.getTime() - now.getTime();
    
    if (timeRemaining <= 0) {
      const expiredEmbed = createErrorEmbed(
        'Trial Expired',
        'Your trial has expired. Upgrade to continue accessing VIP features!'
      );
      
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('upgrade_vip')
            .setLabel('👑 Upgrade Now')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('view_pricing')
            .setLabel('💰 View Pricing')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.reply({ 
        embeds: [expiredEmbed], 
        components: [actionRow],
        ephemeral: true 
      });
      return;
    }

    // Create trial status embed
    const trialEmbed = createTrialStatusEmbed(timeRemaining);
    
    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('upgrade_early')
          .setLabel('👑 Upgrade Early')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('trial_features')
          .setLabel('🎯 Trial Features')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('extend_trial')
          .setLabel('⏰ Extend Trial')
          .setStyle(ButtonStyle.Success)
      );

    await interaction.reply({ 
      embeds: [trialEmbed], 
      components: [actionRow],
      ephemeral: true 
    });

    logger.info(`Trial status checked by user ${interaction.user.username}`, {
      trialId: trialData.id,
      timeRemaining: Math.floor(timeRemaining / (1000 * 60 * 60 * 24)) // days
    });

  } catch (error) {
    logger.error('Error in trial-status command:', error);
    await interaction.reply({ 
      content: 'An error occurred while checking your trial status.', 
      ephemeral: true 
    });
  }
}