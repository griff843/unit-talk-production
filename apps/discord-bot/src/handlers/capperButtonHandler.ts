import { CommandInteraction, ButtonInteraction, EmbedBuilder } from 'discord.js';
import { capperService } from '../services/capperService';
import { logger } from '../utils/logger';

export class CapperButtonHandler {
  private static instance: CapperButtonHandler;

  public static getInstance(): CapperButtonHandler {
    if (!CapperButtonHandler.instance) {
      CapperButtonHandler.instance = new CapperButtonHandler();
    }
    return CapperButtonHandler.instance;
  }

  public async handleButton(interaction: ButtonInteraction): Promise<void> {
    try {
      const customId = interaction.customId;

      if (customId.startsWith('confirm_onboard_')) {
        await this.handleOnboardConfirmation(interaction);
      } else if (customId === 'cancel_onboard') {
        await this.handleOnboardCancellation(interaction);
      }
    } catch (error) {
      logger.error('Error in capper button interaction handler', {
        error: error instanceof Error ? error.message : String(error),
        customId: interaction.customId,
        userId: interaction.user.id,
      });

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while processing your request.',
          ephemeral: true,
        });
      }
    }
  }

  private async handleOnboardConfirmation(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;
    const parts = customId.split('_');

    if (parts.length < 5) {
      await interaction.reply({
        content: '❌ Invalid onboarding data.',
        ephemeral: true,
      });
      return;
    }

    const userId = parts[2];
    const tier = parts[3] as 'rookie' | 'pro' | 'elite' | 'legend';
    const displayName = parts.slice(4).join('_'); // Handle display names with underscores

    // Verify the user clicking is the same as the one onboarding
    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: '❌ You can only confirm your own onboarding.',
        ephemeral: true,
      });
      return;
    }

    // Check if user is already a capper
    const existingCapper = await capperService.getCapperByDiscordId(userId);
    if (existingCapper) {
      await interaction.reply({
        content: '❌ You are already registered as a capper.',
        ephemeral: true,
      });
      return;
    }

    // Create the capper profile
    const newCapper = await capperService.createCapperProfile({
      discordId: userId,
      username: interaction.user.username,
      displayName: displayName,
      tier: tier,
    });

    if (!newCapper) {
      await interaction.reply({
        content: '❌ Failed to create your capper profile. Please try again later.',
        ephemeral: true,
      });
      return;
    }

    const successEmbed = new EmbedBuilder()
      .setTitle('✅ Capper Onboarding Complete!')
      .setDescription(`Welcome to the UT Cappers program, **${displayName}**!`)
      .addFields(
        { name: 'Display Name', value: displayName, inline: true },
        { name: 'Tier', value: tier.charAt(0).toUpperCase() + tier.slice(1), inline: true },
        { name: 'Status', value: 'Active', inline: true },
        {
          name: 'Next Steps',
          value: 'You can now use `/submit-pick` to submit your picks!',
          inline: false,
        }
      )
      .setColor(0x00ff00)
      .setTimestamp();

    await interaction.update({
      embeds: [successEmbed],
      components: [],
    });

    logger.info('New capper onboarded successfully', {
      capperId: newCapper.id,
      discordId: userId,
      username: interaction.user.username,
      displayName: displayName,
      tier: tier,
    });
  }

  private async handleOnboardCancellation(interaction: ButtonInteraction): Promise<void> {
    const cancelEmbed = new EmbedBuilder()
      .setTitle('❌ Onboarding Cancelled')
      .setDescription(
        'Your capper onboarding has been cancelled. You can start again anytime with `/capper-onboard`.'
      )
      .setColor(0xff0000);

    await interaction.update({
      embeds: [cancelEmbed],
      components: [],
    });
  }
}

// Export the function for backward compatibility
export async function handleCapperButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const handler = CapperButtonHandler.getInstance();
  await handler.handleButton(interaction);
}
