import { SlashCommandBuilder } from '@discordjs/builders';
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

import { SupabaseService } from '../services/supabase';
import { toGuildMember } from '../utils/discordUtils';
import { logger } from '../utils/logger';
import { getUserTier } from '../utils/roleUtils';

const supabaseService = new SupabaseService();

export const data = new SlashCommandBuilder()
  .setName('pick-result')
  .setDescription('Update the result of your pick')
  .addStringOption(option =>
    option
      .setName('status')
      .setDescription('Result of the pick')
      .setRequired(true)
      .addChoices(
        { name: 'Won', value: 'won' },
        { name: 'Lost', value: 'lost' },
        { name: 'Push', value: 'pushed' },
        { name: 'Cancelled', value: 'cancelled' }
      )
  )
  .addNumberOption(option =>
    option.setName('profit_loss').setDescription('Profit/Loss in units (required for Won status)')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const userTier = getUserTier(await toGuildMember(interaction.member, interaction.guild));

    // Check if user has access
    if (!['vip_plus', 'black_label', 'admin', 'owner'].includes(userTier)) {
      await interaction.reply({
        content: '❌ Pick result updates are only available for VIP+ members and above.',
        ephemeral: true,
      });
      return;
    }

    // Get recent picks to choose from
    const recentPicks = await supabaseService.getPickHistory(interaction.user.id, 5);

    if (!recentPicks || recentPicks.length === 0) {
      await interaction.reply({
        content: '❌ No recent picks found to update.',
        ephemeral: true,
      });
      return;
    }

    // Create buttons for each recent pick
    const rows = recentPicks.map((pick: any) => {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(
            `pick_result_${pick.id}_${interaction.options.getString('status')}_${interaction.options.getNumber('profit_loss') || 0}`
          )
          .setLabel(`${pick.team_name} (${pick.pick_type}) - ${pick.odds}`)
          .setStyle(ButtonStyle.Primary)
      );
      return row;
    });

    await interaction.reply({
      content: 'Select the pick to update:',
      components: rows,
      ephemeral: true,
    });
  } catch (error) {
    logger.error('Error executing pick-result command:', error);
    await interaction.reply({
      content: '❌ An error occurred while processing your request.',
      ephemeral: true,
    });
  }
}
