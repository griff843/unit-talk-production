import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChatInputCommandInteraction } from 'discord.js';
import { CapperSystem } from '../services/capperSystem';
import { capperService } from '../services/capperService';
import { logger } from '../utils/logger';

export async function handleCapperInteraction(interaction: ChatInputCommandInteraction, _capperSystem?: CapperSystem) {
  try {
    const commandName = interaction.commandName;

    switch (commandName) {
      case 'submit-pick':
        await handleSubmitPick(interaction);
        break;
      case 'capper-onboard':
        await handleCapperOnboard(interaction);
        break;
      case 'edit-pick':
        await handleEditPick(interaction);
        break;
      case 'delete-pick':
        await handleDeletePick(interaction);
        break;
      case 'capper-stats':
        await handleCapperStats(interaction);
        break;
      default:
        await interaction.reply({
          content: '❌ Unknown capper command.',
          ephemeral: true
        });
    }
  } catch (error) {
    logger.error('Error in capper interaction handler', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      command: interaction.commandName,
      userId: interaction.user.id
    });

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ An error occurred while processing your request.',
        ephemeral: true
      });
    }
  }
}

async function handleSubmitPick(interaction: ChatInputCommandInteraction) {
  // Check if user has capper permissions
  const hasPermissions = await capperService.hasCapperPermissions(interaction.user.id);
  if (!hasPermissions) {
    await interaction.reply({
      content: '❌ You need to be an approved capper to submit picks. Use `/capper-onboard` to get started.',
      ephemeral: true
    });
    return;
  }

  const _pickType = interaction.options.getString('pick_type');
  const _units = interaction.options.getNumber('units');
  const analysis = interaction.options.getString('analysis');

  // Create modal for detailed pick submission
  const modal = new ModalBuilder()
    .setCustomId('submit_pick_modal')
    .setTitle('Submit Your Pick');

  const gameInput = new TextInputBuilder()
    .setCustomId('game')
    .setLabel('Game/Match')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., Lakers vs Warriors')
    .setRequired(true);

  const betInput = new TextInputBuilder()
    .setCustomId('bet')
    .setLabel('Bet Details')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., Lakers -5.5, Over 220.5')
    .setRequired(true);

  const oddsInput = new TextInputBuilder()
    .setCustomId('odds')
    .setLabel('Odds')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., -110, +150')
    .setRequired(true);

  const analysisInput = new TextInputBuilder()
    .setCustomId('analysis')
    .setLabel('Analysis (Optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Your reasoning for this pick...')
    .setValue(analysis || '')
    .setRequired(false);

  const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(gameInput);
  const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(betInput);
  const thirdActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(oddsInput);
  const fourthActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(analysisInput);

  modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

  await interaction.showModal(modal);
}

async function handleCapperOnboard(interaction: ChatInputCommandInteraction) {
  // Check if user is already a capper
  const existingCapper = await capperService.getCapperByDiscordId(interaction.user.id);
  if (existingCapper) {
    await interaction.reply({
      content: `❌ You are already registered as a capper with the tier **${existingCapper.tier}**. Your status is **${existingCapper.status}**.`,
      ephemeral: true
    });
    return;
  }

  const displayName = interaction.options.getString('display_name', true);
  const tier = interaction.options.getString('tier', true) as 'rookie' | 'pro' | 'elite' | 'legend';

  const embed = new EmbedBuilder()
    .setTitle('🎯 Capper Onboarding')
    .setDescription(`Welcome to the UT Cappers program, **${displayName}**!`)
    .addFields(
      { name: 'Display Name', value: displayName, inline: true },
      { name: 'Tier', value: tier.charAt(0).toUpperCase() + tier.slice(1), inline: true },
      { name: 'Status', value: 'Pending Approval', inline: true }
    )
    .setColor(0x00ff00)
    .setTimestamp();

  const confirmButton = new ButtonBuilder()
    .setCustomId(`confirm_onboard_${interaction.user.id}_${tier}_${displayName}`)
    .setLabel('Confirm Onboarding')
    .setStyle(ButtonStyle.Success);

  const cancelButton = new ButtonBuilder()
    .setCustomId('cancel_onboard')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(confirmButton, cancelButton);

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true
  });
}

async function handleEditPick(interaction: ChatInputCommandInteraction) {
  // Check if user has capper permissions
  const hasPermissions = await capperService.hasCapperPermissions(interaction.user.id);
  if (!hasPermissions) {
    await interaction.reply({
      content: '❌ You need to be an approved capper to edit picks.',
      ephemeral: true
    });
    return;
  }

  // This would show a list of pending picks to edit
  const embed = new EmbedBuilder()
    .setTitle('📝 Edit Pick')
    .setDescription('Select a pick to edit from your pending picks.')
    .setColor(0xffa500);

  // Mock data - in real implementation, fetch from database
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_pick_to_edit')
    .setPlaceholder('Choose a pick to edit')
    .addOptions([
      {
        label: 'Lakers vs Warriors - Lakers -5.5',
        description: '2 units • Pending',
        value: 'pick_1'
      },
      {
        label: 'Over 220.5 Total Points',
        description: '1.5 units • Pending',
        value: 'pick_2'
      }
    ]);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(selectMenu);

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true
  });
}

async function handleDeletePick(interaction: ChatInputCommandInteraction) {
  // Check if user has capper permissions
  const hasPermissions = await capperService.hasCapperPermissions(interaction.user.id);
  if (!hasPermissions) {
    await interaction.reply({
      content: '❌ You need to be an approved capper to delete picks.',
      ephemeral: true
    });
    return;
  }

  // Similar to edit pick but for deletion
  const embed = new EmbedBuilder()
    .setTitle('🗑️ Delete Pick')
    .setDescription('Select a pick to delete from your pending picks.')
    .setColor(0xff0000);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_pick_to_delete')
    .setPlaceholder('Choose a pick to delete')
    .addOptions([
      {
        label: 'Lakers vs Warriors - Lakers -5.5',
        description: '2 units • Pending',
        value: 'pick_1'
      },
      {
        label: 'Over 220.5 Total Points',
        description: '1.5 units • Pending',
        value: 'pick_2'
      }
    ]);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(selectMenu);

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true
  });
}

async function handleCapperStats(interaction: ChatInputCommandInteraction) {
  // Check if user has capper permissions
  const capper = await capperService.getCapperByDiscordId(interaction.user.id);
  if (!capper) {
    await interaction.reply({
      content: '❌ You need to be an approved capper to view stats. Use `/capper-onboard` to get started.',
      ephemeral: true
    });
    return;
  }

  const stats = await capperService.getCapperStats(capper.id);
  if (!stats) {
    await interaction.reply({
      content: '❌ Unable to fetch your statistics at this time.',
      ephemeral: true
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('📊 Your Capper Statistics')
    .setDescription(`Statistics for **${capper.display_name || capper.username}**`)
    .addFields(
      { name: 'Total Picks', value: stats.totalPicks.toString(), inline: true },
      { name: 'Wins', value: stats.wins.toString(), inline: true },
      { name: 'Losses', value: stats.losses.toString(), inline: true },
      { name: 'Win Rate', value: `${(stats.winRate * 100).toFixed(1)}%`, inline: true },
      { name: 'Total Units', value: stats.totalUnits > 0 ? `+${stats.totalUnits.toFixed(1)}` : stats.totalUnits.toFixed(1), inline: true },
      { name: 'ROI', value: `${(stats.roi * 100).toFixed(1)}%`, inline: true },
      { name: 'Current Streak', value: stats.currentStreak > 0 ? `${stats.currentStreak}W` : stats.currentStreak < 0 ? `${Math.abs(stats.currentStreak)}L` : '0', inline: true },
      { name: 'Tier', value: capper.tier.charAt(0).toUpperCase() + capper.tier.slice(1), inline: true },
      { name: 'Status', value: capper.status.charAt(0).toUpperCase() + capper.status.slice(1), inline: true }
    )
    .setColor(0x0099ff)
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}