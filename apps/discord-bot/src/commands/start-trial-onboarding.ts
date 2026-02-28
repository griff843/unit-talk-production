import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';

import { DMService } from '../services/dmService';
import { OnboardingService } from '../services/onboardingService';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('start-trial-onboarding')
  .setDescription('Start the elite Unit Talk Concierge onboarding experience')
  .addStringOption(option =>
    option
      .setName('type')
      .setDescription('Type of onboarding to start')
      .setRequired(false)
      .addChoices(
        { name: 'Trial Discovery (WHY-based)', value: 'trial' },
        { name: 'Capper Onboarding', value: 'capper' },
        { name: 'Admin Onboarding', value: 'admin' },
        { name: 'VIP Onboarding', value: 'vip' },
        { name: 'VIP+ Onboarding', value: 'vip_plus' },
        { name: 'Free Member', value: 'free' }
      )
  )
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user to start onboarding for (admin only)')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option
      .setName('test')
      .setDescription('Run in test mode (immediate delivery)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    const onboardingType = interaction.options.getString('type') || 'trial';
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const testMode = interaction.options.getBoolean('test') || false;

    // Only allow self-targeting unless user has admin permissions
    if (
      targetUser.id !== interaction.user.id &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    ) {
      await interaction.editReply({
        content: '❌ You can only start onboarding for yourself unless you have admin permissions.',
      });
      return;
    }

    logger.info('[ELITE_ONBOARDING] Starting personalized onboarding', {
      userId: targetUser.id,
      username: targetUser.username,
      onboardingType,
      initiatedBy: interaction.user.id,
      testMode,
    });

    // Initialize services
    const dmService = new DMService(interaction.client, null as any); // Simplified for demo
    const onboardingService = new OnboardingService(interaction.client, dmService);

    // Start the personalized onboarding sequence
    await onboardingService.handleUserOnboarding(targetUser, onboardingType, testMode);

    const modeText = testMode
      ? ' (Test mode - immediate delivery)'
      : ' (Normal mode - timed delivery)';

    // Create type-specific descriptions
    const typeDescriptions = {
      trial: `🎩 **Personal WHY Discovery** - Your concierge will ask what brought you to Unit Talk, then create a completely personalized 7-day experience based on your specific goals`,
      capper: `🏆 **Capper Network Welcome** - Professional onboarding for verified cappers with dashboard access and capper responsibilities`,
      admin: `🛡️ **Admin Access Setup** - Complete admin tools overview and platform management capabilities`,
      vip: `👑 **VIP Professional Status** - Enhanced member experience with premium features and priority support`,
      vip_plus: `💎 **VIP+ Elite Experience** - Ultimate tier with algorithm picks, whale tracking, and exclusive intelligence`,
      free: `🎉 **Unit Talk Community** - Welcome to the community with server navigation and upgrade opportunities`,
    };

    await interaction.editReply({
      content:
        `✅ **${onboardingType.toUpperCase()} onboarding started** for ${targetUser.username}!${modeText}\n\n` +
        `${typeDescriptions[onboardingType] || typeDescriptions['trial']}\n\n` +
        `*Check your DMs to experience the personalized onboarding!*`,
    });

    logger.info('[ELITE_ONBOARDING] Personalized onboarding initiated successfully', {
      userId: targetUser.id,
      username: targetUser.username,
      onboardingType,
      testMode,
    });
  } catch (error) {
    logger.error('[TRIAL_ONBOARDING] Error starting trial onboarding', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: interaction.user.id,
    });

    await interaction.editReply({
      content:
        '❌ An error occurred while starting the onboarding process. Your Unit Talk Concierge has been notified.',
    });
  }
}
