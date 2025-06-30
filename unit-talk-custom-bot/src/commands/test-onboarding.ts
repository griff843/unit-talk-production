import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { OnboardingService } from '../services/onboardingService';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('test-onboarding')
  .setDescription('Test: Trigger onboarding flow for yourself');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const member = interaction.member as GuildMember;
    
    if (!member) {
      await interaction.reply({
        content: '❌ Could not get member information.',
        ephemeral: true
      });
      return;
    }

    const onboardingService = new OnboardingService();
    
    await interaction.reply({
      content: '🚀 Triggering onboarding flow... Check your DMs!',
      ephemeral: true
    });
    
    // Trigger onboarding
    await onboardingService.triggerOnboarding(member);
    
    logger.info(`Manually triggered onboarding for ${member.user.tag}`);
    
  } catch (error) {
    logger.error('Error in test-onboarding command:', error);
    await interaction.followUp({
      content: '❌ An error occurred while triggering onboarding.',
      ephemeral: true
    });
  }
}