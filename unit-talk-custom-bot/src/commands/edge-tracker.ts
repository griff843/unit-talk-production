import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import { supabaseService } from '../services/supabase';
import { permissionsService } from '../services/permissions';
import { logger } from '../utils/logger';
import { createInfoEmbed, createErrorEmbed } from '../utils/embeds';
import { CommandUsageService } from '../services/commandUsage';

const commandUsageService = new CommandUsageService();

export const data = new SlashCommandBuilder()
  .setName('edge-tracker')
  .setDescription('🔥 View today\'s highest edge picks with heat signals (VIP+ only)')
  .setDefaultMemberPermissions(0); // Restrict to specific roles

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Check if user has VIP+ access
    const member = interaction.member;
    if (!member) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true
      });
      return;
    }

    const permissions = await permissionsService.getUserPermissions(member as any);
    if (!permissions.canViewVipPlusContent) {
      const errorEmbed = createErrorEmbed(
        '🔒 VIP+ Required',
        'This command is exclusive to VIP+ members. Upgrade to access edge tracking with heat signals!'
      );

      await interaction.reply({
        embeds: [errorEmbed],
        ephemeral: true
      });
      return;
    }

    // Check cooldown (1 per hour per user)
    const userId = interaction.user.id;
    const cooldownKey = `edge_tracker_${userId}`;
    const lastUsed = await commandUsageService.getCooldown(cooldownKey);
    const cooldownTime = 60 * 60 * 1000; // 1 hour in milliseconds

    if (lastUsed && Date.now() - lastUsed < cooldownTime) {
      const remainingTime = Math.ceil((cooldownTime - (Date.now() - lastUsed)) / (60 * 1000));
      await interaction.reply({
        content: `⏰ Edge Tracker is on cooldown. Try again in ${remainingTime} minutes.`,
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    // Query daily picks with high edge scores
    const today = new Date().toISOString().split('T')[0];
    const { data: picks, error } = await supabaseService.client
      .from('daily_picks')
      .select(`
        *,
        line_alerts(*),
        heat_signals(*)
      `)
      .eq('game_date', today)
      .gte('edge_score', 18)
      .in('tier', ['S+', 'S'])
      .not('odds', 'is', null)
      .order('edge_score', { ascending: false })
      .limit(5);

    if (error) {
      logger.error('Error fetching edge tracker data:', error);
      await interaction.editReply({
        content: '❌ Failed to fetch edge data. Please try again later.'
      });
      return;
    }

    if (!picks || picks.length === 0) {
      const noPicksEmbed = createInfoEmbed(
        '📊 Edge Tracker',
        'No high-edge picks found for today. Check back later for premium opportunities!'
      );
      
      await interaction.editReply({
        embeds: [noPicksEmbed]
      });
      return;
    }

    // Set cooldown
    await commandUsageService.setCooldown(cooldownKey, Date.now());

    // Create embeds for each pick
    const embeds = picks.map(pick => {
      const hasHeatSignal = pick.heat_signals && pick.heat_signals.length > 0;
      const heatSignal = hasHeatSignal ? pick.heat_signals[0] : null;
      
      const embed = new EmbedBuilder()
        .setTitle(`🔥 ${pick.player_name} ${pick.stat_type}`)
        .setColor(pick.tier === 'S+' ? '#FFD700' : '#C0C0C0')
        .addFields(
          {
            name: '📊 Edge Score',
            value: `**${pick.edge_score}**`,
            inline: true
          },
          {
            name: '🏆 Tier',
            value: `**${pick.tier}**`,
            inline: true
          },
          {
            name: '💰 Odds',
            value: `**${pick.odds}** at ${pick.book || 'Various'}`,
            inline: true
          },
          {
            name: '🔥 Heat Signal',
            value: hasHeatSignal ? '✅' : '❌',
            inline: true
          }
        );

      if (hasHeatSignal && heatSignal) {
        embed.addFields({
          name: '📈 Line Movement',
          value: `This edge has increased by **+${heatSignal.movement_percentage || 8}%** since open.`,
          inline: false
        });
      }

      if (pick.matchup_notes) {
        embed.addFields({
          name: '🎯 Analysis',
          value: pick.matchup_notes.substring(0, 200) + (pick.matchup_notes.length > 200 ? '...' : ''),
          inline: false
        });
      }

      embed.setTimestamp();
      return embed;
    });

    // Create action buttons
    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('ask_unit_talk')
          .setLabel('Ask Unit Talk')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🧠'),
        new ButtonBuilder()
          .setCustomId('track_pick')
          .setLabel('Track')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📊')
      );

    await interaction.editReply({
      embeds: embeds,
      components: [actionRow]
    });

    // Log usage
    logger.info(`Edge tracker used by ${interaction.user.username}`, {
      service: 'unit-talk-bot',
      userId: interaction.user.id,
      picksFound: picks.length
    });

  } catch (error) {
    logger.error('Error in edge-tracker command:', error);
    
    if (interaction.deferred) {
      await interaction.editReply({
        content: '❌ An error occurred while fetching edge data. Please try again later.'
      });
    } else {
      await interaction.reply({
        content: '❌ An error occurred while fetching edge data. Please try again later.',
        ephemeral: true
      });
    }
  }
}