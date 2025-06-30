import { 
  Interaction, 
  StringSelectMenuInteraction, 
  ModalSubmitInteraction, 
  ButtonInteraction 
} from 'discord.js';
import { logger } from '../shared/logger';

// Import command handlers
import * as submitPickCommand from '../commands/submit-pick';
import * as capperOnboardCommand from '../commands/capper-onboard';

export async function handleCapperInteraction(interaction: Interaction) {
  try {
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenuInteraction(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmitInteraction(interaction);
    } else if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }
  } catch (error) {
    logger.error('Error handling capper interaction', { error });
    
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ An error occurred while processing your request.',
        ephemeral: true
      });
    }
  }
}

async function handleSelectMenuInteraction(interaction: StringSelectMenuInteraction) {
  const customId = interaction.customId;

  switch (customId) {
    case 'pick_type_select':
      await submitPickCommand.handlePickTypeSelect(interaction);
      break;
    case 'tier_select':
      await capperOnboardCommand.handleTierSelect(interaction);
      break;
    default:
      logger.warn('Unknown select menu interaction', { customId });
      await interaction.reply({
        content: '❌ Unknown selection menu.',
        ephemeral: true
      });
  }
}

async function handleModalSubmitInteraction(interaction: ModalSubmitInteraction) {
  const customId = interaction.customId;

  if (customId === 'single_pick_modal') {
    await submitPickCommand.handleSinglePickModal(interaction);
  } else if (customId === 'parlay_pick_modal') {
    await submitPickCommand.handleParlayPickModal(interaction);
  } else if (customId.startsWith('onboard_modal_')) {
    await capperOnboardCommand.handleOnboardModal(interaction);
  } else {
    logger.warn('Unknown modal submit interaction', { customId });
    await interaction.reply({
      content: '❌ Unknown modal submission.',
      ephemeral: true
    });
  }
}

async function handleButtonInteraction(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  if (customId === 'confirm_pick' || customId === 'cancel_pick') {
    await submitPickCommand.handlePickConfirmation(interaction);
  } else {
    logger.warn('Unknown button interaction', { customId });
    await interaction.reply({
      content: '❌ Unknown button interaction.',
      ephemeral: true
    });
  }
}