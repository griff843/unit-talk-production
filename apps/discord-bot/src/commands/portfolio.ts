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
  .setName('portfolio')
  .setDescription('View and manage your betting portfolio')
  .addSubcommand(subcommand =>
    subcommand.setName('view').setDescription('View your portfolio statistics')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('submit')
      .setDescription('Submit a new pick')
      .addStringOption(option =>
        option
          .setName('sport')
          .setDescription('Sport category')
          .setRequired(true)
          .addChoices(
            { name: 'NBA', value: 'nba' },
            { name: 'NFL', value: 'nfl' },
            { name: 'MLB', value: 'mlb' },
            { name: 'NHL', value: 'nhl' }
          )
      )
      .addStringOption(option =>
        option
          .setName('pick_type')
          .setDescription('Type of pick')
          .setRequired(true)
          .addChoices(
            { name: 'Spread', value: 'spread' },
            { name: 'Moneyline', value: 'moneyline' },
            { name: 'Total', value: 'total' },
            { name: 'Prop', value: 'prop' }
          )
      )
      .addStringOption(option =>
        option.setName('team').setDescription('Team name').setRequired(true)
      )
      .addNumberOption(option =>
        option.setName('odds').setDescription('Odds (e.g., -110, +150)').setRequired(true)
      )
      .addNumberOption(option =>
        option.setName('units').setDescription('Number of units to risk').setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('confidence')
          .setDescription('Confidence level (1-10)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(10)
      )
      .addStringOption(option =>
        option.setName('notes').setDescription('Additional notes about the pick')
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const userTier = getUserTier(await toGuildMember(interaction.member, interaction.guild));

    // Check if user has access to portfolio features
    if (!['vip_plus', 'black_label', 'admin', 'owner'].includes(userTier)) {
      await interaction.reply({
        content: '❌ Portfolio features are only available for VIP+ members and above.',
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'view':
        await handleViewPortfolio(interaction);
        break;
      case 'submit':
        await handleSubmitPick(interaction);
        break;
    }
  } catch (error) {
    logger.error('Error executing portfolio command:', error);
    await interaction.reply({
      content: '❌ An error occurred while processing your request.',
      ephemeral: true,
    });
  }
}

async function handleViewPortfolio(interaction: ChatInputCommandInteraction) {
  const analytics = await supabaseService.getPickAnalytics(interaction.user.id);

  if (!analytics) {
    await interaction.reply({
      content: 'No portfolio data found. Start by submitting some picks!',
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('🎯 Your Betting Portfolio')
    .addFields([
      {
        name: '📊 Overall Stats',
        value: [
          `Total Picks: ${analytics.total_picks}`,
          `Win Rate: ${analytics.win_rate.toFixed(1)}%`,
          `ROI: ${analytics.roi.toFixed(1)}%`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '💰 Units',
        value: [
          `Total Risked: ${analytics.total_units_risked.toFixed(1)}u`,
          `Won: ${analytics.total_units_won.toFixed(1)}u`,
          `Lost: ${analytics.total_units_lost.toFixed(1)}u`,
        ].join('\n'),
        inline: true,
      },
      {
        name: '📈 Performance',
        value: [
          `Won: ${analytics.won_picks}`,
          `Lost: ${analytics.lost_picks}`,
          `Pushed: ${analytics.pushed_picks}`,
        ].join('\n'),
        inline: true,
      },
    ])
    .setFooter({ text: 'Updated stats are calculated after each pick result' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('portfolio_history')
      .setLabel('View History')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('portfolio_trends')
      .setLabel('View Trends')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}

async function handleSubmitPick(interaction: ChatInputCommandInteraction) {
  const sport = interaction.options.getString('sport', true);
  const pickType = interaction.options.getString('pick_type', true);
  const team = interaction.options.getString('team', true);
  const odds = interaction.options.getNumber('odds', true);
  const units = interaction.options.getNumber('units', true);
  const confidence = interaction.options.getInteger('confidence', true);
  const notes = interaction.options.getString('notes');

  const pick = {
    user_id: interaction.user.id,
    sport,
    pick_type: pickType,
    team_name: team,
    odds,
    units,
    confidence,
    notes: notes || undefined,
  };

  const success = await supabaseService.submitPick(pick);

  if (success) {
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('✅ Pick Submitted Successfully')
      .addFields([
        { name: 'Sport', value: sport.toUpperCase(), inline: true },
        { name: 'Pick Type', value: pickType, inline: true },
        { name: 'Team', value: team, inline: true },
        { name: 'Odds', value: odds.toString(), inline: true },
        { name: 'Units', value: units.toString(), inline: true },
        { name: 'Confidence', value: `${confidence}/10`, inline: true },
      ]);

    if (notes) {
      embed.addFields({ name: 'Notes', value: notes });
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: '❌ Failed to submit pick. Please try again.',
      ephemeral: true,
    });
  }
}
