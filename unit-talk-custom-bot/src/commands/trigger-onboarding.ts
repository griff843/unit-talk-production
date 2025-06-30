import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { OnboardingService } from '../services/onboardingService.js';

export const data = new SlashCommandBuilder()
  .setName('trigger-onboarding')
  .setDescription('Manually trigger onboarding for a user (Admin only)')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('The user to trigger onboarding for')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const targetUser = interaction.options.getUser('user', true);
    const member = await interaction.guild?.members.fetch(targetUser.id);

    if (!member) {
      await interaction.reply({ 
        content: '❌ Could not find that member in this server.', 
        ephemeral: true 
      });
      return;
    }

    // Create onboarding service instance
    const onboardingService = new OnboardingService(interaction.client);
    
    // Trigger onboarding
    await onboardingService.triggerOnboarding(member);

    await interaction.reply({ 
      content: `✅ Onboarding triggered for ${targetUser.username}`, 
      ephemeral: true 
    });
  } catch (error) {
    console.error('Error in trigger-onboarding command:', error);
    await interaction.reply({ 
      content: '❌ An error occurred while triggering onboarding.', 
      ephemeral: true 
    });
  }
}