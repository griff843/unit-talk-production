import {
  SlashCommandBuilder,
  CommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  ButtonInteraction,
  GuildMember
} from 'discord.js';
import { capperService } from '../services/capperService';
import { logger } from '../shared/logger';
import { hasRole } from '../utils/roleUtils';
import { Database } from '../db/types/supabase';

// Use existing database types
type DailyPickInsert = Database['public']['Tables']['daily_picks']['Insert'];

// Store temporary data in memory (better than global variables)
const tempPickData = new Map<string, any>();

export const data = new SlashCommandBuilder()
  .setName('submit-pick')
  .setDescription('Submit a new pick for today');

export async function execute(interaction: CommandInteraction) {
  try {
    // Check if user has capper role
    const member = interaction.member as GuildMember;
    if (!hasRole(member, 'UT Capper')) {
      await interaction.reply({
        content: '❌ You need the **UT Capper** role to submit picks.',
        ephemeral: true
      });
      return;
    }

    // Check if user has a capper profile
    const capperProfile = await capperService.getCapperByDiscordId(interaction.user.id);
    
    if (!capperProfile) {
      await interaction.reply({
        content: '❌ You need to complete capper onboarding first. Use `/capper-onboard` to get started.',
        ephemeral: true
      });
      return;
    }

    // Check if user already has picks for today
    const today = new Date().toISOString().split('T')[0];
    const existingPicks = await capperService.getCapperPicks(capperProfile.id, today, 'pending');
    
    if (existingPicks.length >= 3) {
      await interaction.reply({
        content: '❌ You can only submit up to 3 picks per day. Edit or delete existing picks if needed.',
        ephemeral: true
      });
      return;
    }

    // Show pick type selection
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('pick_type_select')
      .setPlaceholder('Choose your pick type')
      .addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel('Single Bet')
          .setValue('single')
          .setDescription('A single bet on one outcome'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Parlay')
          .setValue('parlay')
          .setDescription('Multiple bets combined into one')
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);

    await interaction.reply({
      content: '**📝 Submit New Pick**\n\nChoose the type of pick you want to submit:',
      components: [row],
      ephemeral: true
    });

  } catch (error) {
    logger.error('Error in submit-pick command', { error });
    await interaction.reply({
      content: '❌ An error occurred while processing your request.',
      ephemeral: true
    });
  }
}

export async function handlePickTypeSelect(interaction: StringSelectMenuInteraction) {
  try {
    const pickType = interaction.values[0] as 'single' | 'parlay';
    
    // Store pick type temporarily
    tempPickData.set(interaction.user.id, { pickType });

    if (pickType === 'single') {
      await showSinglePickForm(interaction);
    } else {
      await showParlayForm(interaction);
    }
  } catch (error) {
    logger.error('Error handling pick type selection', { error });
    await interaction.reply({
      content: '❌ An error occurred while processing your selection.',
      ephemeral: true
    });
  }
}

async function showSinglePickForm(interaction: StringSelectMenuInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('single_pick_modal')
    .setTitle('Submit Single Pick');

  const gameInput = new TextInputBuilder()
    .setCustomId('game')
    .setLabel('Game/Match')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., Lakers vs Warriors')
    .setRequired(true);

  const betTypeInput = new TextInputBuilder()
    .setCustomId('bet_type')
    .setLabel('Bet Type')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., Moneyline, Spread, Over/Under')
    .setRequired(true);

  const selectionInput = new TextInputBuilder()
    .setCustomId('selection')
    .setLabel('Your Pick')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., Lakers -5.5, Over 220.5')
    .setRequired(true);

  const oddsInput = new TextInputBuilder()
    .setCustomId('odds')
    .setLabel('Odds')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., -110, +150')
    .setRequired(true);

  const unitsInput = new TextInputBuilder()
    .setCustomId('units')
    .setLabel('Units (1-5)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 2')
    .setRequired(true);

  // const analysisInput = new TextInputBuilder()
  //   .setCustomId('analysis')
  //   .setLabel('Analysis (Optional)')
  //   .setStyle(TextInputStyle.Paragraph)
  //   .setPlaceholder('Brief explanation of your pick...')
  //   .setRequired(false);

  const rows = [
    new ActionRowBuilder<TextInputBuilder>().addComponents(gameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(betTypeInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(selectionInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(oddsInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(unitsInput)
  ];

  modal.addComponents(...rows);
  await interaction.showModal(modal);
}

async function showParlayForm(interaction: StringSelectMenuInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('parlay_pick_modal')
    .setTitle('Submit Parlay Pick');

  const leg1Input = new TextInputBuilder()
    .setCustomId('leg1')
    .setLabel('Leg 1')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Game | Bet Type | Selection | Odds')
    .setRequired(true);

  const leg2Input = new TextInputBuilder()
    .setCustomId('leg2')
    .setLabel('Leg 2')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Game | Bet Type | Selection | Odds')
    .setRequired(true);

  const leg3Input = new TextInputBuilder()
    .setCustomId('leg3')
    .setLabel('Leg 3 (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Game | Bet Type | Selection | Odds')
    .setRequired(false);

  const unitsInput = new TextInputBuilder()
    .setCustomId('units')
    .setLabel('Units (1-5)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 2')
    .setRequired(true);

  const analysisInput = new TextInputBuilder()
    .setCustomId('analysis')
    .setLabel('Analysis (Optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Brief explanation of your parlay...')
    .setRequired(false);

  const rows = [
    new ActionRowBuilder<TextInputBuilder>().addComponents(leg1Input),
    new ActionRowBuilder<TextInputBuilder>().addComponents(leg2Input),
    new ActionRowBuilder<TextInputBuilder>().addComponents(leg3Input),
    new ActionRowBuilder<TextInputBuilder>().addComponents(unitsInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(analysisInput)
  ];

  modal.addComponents(...rows);
  await interaction.showModal(modal);
}

export async function handleSinglePickModal(interaction: ModalSubmitInteraction) {
  try {
    const game = interaction.fields.getTextInputValue('game');
    const betType = interaction.fields.getTextInputValue('bet_type');
    const selection = interaction.fields.getTextInputValue('selection');
    const oddsStr = interaction.fields.getTextInputValue('odds');
    const unitsStr = interaction.fields.getTextInputValue('units');
    const analysis = interaction.fields.getTextInputValue('analysis') || null;

    // Validate inputs
    const units = parseFloat(unitsStr);
    if (isNaN(units) || units < 1 || units > 5) {
      await interaction.reply({
        content: '❌ Units must be a number between 1 and 5.',
        ephemeral: true
      });
      return;
    }

    // Parse odds
    let odds = 0;
    try {
      odds = parseFloat(oddsStr.replace(/[+]/g, ''));
    } catch {
      await interaction.reply({
        content: '❌ Invalid odds format. Use format like -110 or +150.',
        ephemeral: true
      });
      return;
    }

    // Get capper profile
    const capperProfile = await capperService.getCapperByDiscordId(interaction.user.id);
    if (!capperProfile) {
      await interaction.reply({
        content: '❌ Capper profile not found.',
        ephemeral: true
      });
      return;
    }

    // Create pick data
    const pickData: DailyPickInsert = {
      capper_id: capperProfile.id,
      capper_discord_id: interaction.user.id,
      capper_username: interaction.user.username,
      event_date: new Date().toISOString().split('T')[0]!,
      status: 'pending',
      pick_type: 'single',
      total_legs: 1,
      total_odds: odds,
      total_units: units,
      analysis,
      legs: [{
        game,
        bet_type: betType,
        selection,
        odds
      }],
      metadata: {
        submitted_at: new Date().toISOString(),
        submitted_by: interaction.user.id
      }
    };

    // Store for preview
    tempPickData.set(interaction.user.id, { ...tempPickData.get(interaction.user.id), pickData });

    await showPickPreview(interaction, pickData);

  } catch (error) {
    logger.error('Error handling single pick modal', { error });
    await interaction.reply({
      content: '❌ An error occurred while processing your pick.',
      ephemeral: true
    });
  }
}

export async function handleParlayPickModal(interaction: ModalSubmitInteraction) {
  try {
    const leg1 = interaction.fields.getTextInputValue('leg1');
    const leg2 = interaction.fields.getTextInputValue('leg2');
    const leg3 = interaction.fields.getTextInputValue('leg3') || null;
    const unitsStr = interaction.fields.getTextInputValue('units');
    const analysis = interaction.fields.getTextInputValue('analysis') || null;

    // Validate units
    const units = parseFloat(unitsStr);
    if (isNaN(units) || units < 1 || units > 5) {
      await interaction.reply({
        content: '❌ Units must be a number between 1 and 5.',
        ephemeral: true
      });
      return;
    }

    // Parse legs
    const legs = [leg1, leg2];
    if (leg3) legs.push(leg3);

    const parsedLegs = legs.map((leg, index) => {
      const parts = leg.split('|').map(p => p.trim());
      if (parts.length !== 4) {
        throw new Error(`Leg ${index + 1} format invalid. Use: Game | Bet Type | Selection | Odds`);
      }
      
      const [game, betType, selection, oddsStr] = parts;
      const odds = parseFloat(oddsStr!.replace(/[+]/g, ''));
      
      if (isNaN(odds)) {
        throw new Error(`Invalid odds in leg ${index + 1}`);
      }

      return { game, bet_type: betType, selection, odds };
    });

    // Calculate total odds (multiply all odds)
    const totalOdds = parsedLegs.reduce((total, leg) => {
      const decimal = leg.odds > 0 ? (leg.odds / 100) + 1 : (100 / Math.abs(leg.odds)) + 1;
      return total * decimal;
    }, 1);

    // Convert back to American odds
    const americanOdds = totalOdds >= 2 ? Math.round((totalOdds - 1) * 100) : Math.round(-100 / (totalOdds - 1));

    // Get capper profile
    const capperProfile = await capperService.getCapperByDiscordId(interaction.user.id);
    if (!capperProfile) {
      await interaction.reply({
        content: '❌ Capper profile not found.',
        ephemeral: true
      });
      return;
    }

    // Create pick data
    const pickData: DailyPickInsert = {
      capper_id: capperProfile.id,
      capper_discord_id: interaction.user.id,
      capper_username: interaction.user.username,
      event_date: new Date().toISOString().split('T')[0]!,
      status: 'pending',
      pick_type: 'parlay',
      total_legs: parsedLegs.length,
      total_odds: americanOdds,
      total_units: units,
      analysis,
      legs: parsedLegs,
      metadata: {
        submitted_at: new Date().toISOString(),
        submitted_by: interaction.user.id
      }
    };

    // Store for preview
    tempPickData.set(interaction.user.id, { ...tempPickData.get(interaction.user.id), pickData });

    await showPickPreview(interaction, pickData);

  } catch (error) {
    logger.error('Error handling parlay pick modal', { error });
    await interaction.reply({
      content: `❌ Error processing parlay: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ephemeral: true
    });
  }
}

async function showPickPreview(interaction: ModalSubmitInteraction, pickData: DailyPickInsert) {
  const embed = new EmbedBuilder()
    .setTitle('📝 Pick Preview')
    .setColor(0x00ff00)
    .addFields(
      { name: 'Type', value: pickData.pick_type.toUpperCase(), inline: true },
      { name: 'Units', value: pickData.total_units.toString(), inline: true },
      { name: 'Total Odds', value: pickData.total_odds > 0 ? `+${pickData.total_odds}` : pickData.total_odds.toString(), inline: true }
    );

  // Add legs
  const legs = pickData.legs as any[];
  legs.forEach((leg, index) => {
    const legNum = pickData.pick_type === 'single' ? '' : ` ${index + 1}`;
    embed.addFields({
      name: `Pick${legNum}`,
      value: `**${leg.game}**\n${leg.bet_type}: ${leg.selection}\nOdds: ${leg.odds > 0 ? `+${leg.odds}` : leg.odds}`,
      inline: false
    });
  });

  if (pickData.analysis) {
    embed.addFields({ name: 'Analysis', value: pickData.analysis, inline: false });
  }

  const confirmButton = new ButtonBuilder()
    .setCustomId('confirm_pick')
    .setLabel('✅ Submit Pick')
    .setStyle(ButtonStyle.Success);

  const cancelButton = new ButtonBuilder()
    .setCustomId('cancel_pick')
    .setLabel('❌ Cancel')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(confirmButton, cancelButton);

  await interaction.reply({
    content: '**Review your pick before submitting:**',
    embeds: [embed],
    components: [row],
    ephemeral: true
  });
}

export async function handlePickConfirmation(interaction: ButtonInteraction) {
  try {
    if (interaction.customId === 'cancel_pick') {
      tempPickData.delete(interaction.user.id);
      await interaction.update({
        content: '❌ Pick submission cancelled.',
        embeds: [],
        components: []
      });
      return;
    }

    if (interaction.customId === 'confirm_pick') {
      const userData = tempPickData.get(interaction.user.id);
      if (!userData?.pickData) {
        await interaction.reply({
          content: '❌ Pick data not found. Please try again.',
          ephemeral: true
        });
        return;
      }

      // Submit the pick
      const pick = await capperService.createDailyPick(userData.pickData);
      
      // Clean up temp data
      tempPickData.delete(interaction.user.id);

      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Pick Submitted Successfully!')
        .setColor(0x00ff00)
        .setDescription(`Your ${pick.pick_type} pick has been submitted and will be published at the scheduled time.`)
        .addFields(
          { name: 'Pick ID', value: pick.id, inline: true },
          { name: 'Status', value: pick.status.toUpperCase(), inline: true }
        )
        .setTimestamp();

      await interaction.update({
        content: '',
        embeds: [successEmbed],
        components: []
      });
    }
  } catch (error) {
    logger.error('Error handling pick confirmation', { error });
    await interaction.reply({
      content: '❌ An error occurred while submitting your pick.',
      ephemeral: true
    });
  }
}