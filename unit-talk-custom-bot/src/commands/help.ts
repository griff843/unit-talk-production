import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { onboardingPrompts } from '../config/onboarding.prompts';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show available commands based on your tier');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const embed = new EmbedBuilder()
      .setTitle(onboardingPrompts.commandHelp.embed.title)
      .setDescription(onboardingPrompts.commandHelp.embed.description)
      .setColor(onboardingPrompts.commandHelp.embed.color);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('Error in help command:', error);
    await interaction.reply({ 
      content: '❌ An error occurred while showing the help menu.', 
      ephemeral: true 
    });
  }
}