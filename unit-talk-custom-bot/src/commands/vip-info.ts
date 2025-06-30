import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { onboardingPrompts } from '../config/onboarding.prompts';
import { getUserTier } from '../utils/roleUtils';

export const data = new SlashCommandBuilder()
  .setName('vip-info')
  .setDescription('View benefits of upgrading to VIP/VIP+');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Fetch the full guild member to avoid API member type issues
    const member = await interaction.guild?.members.fetch(interaction.user.id);
    if (!member) {
      await interaction.reply({ content: 'Unable to fetch your member information.', ephemeral: true });
      return;
    }

    const userTier = getUserTier(member);

    let embed: EmbedBuilder;

    if (userTier === 'vip_plus') {
      embed = new EmbedBuilder()
        .setTitle('🔥 You\'re already VIP+ Elite!')
        .setDescription('You have access to all our premium features. Use `/edge-tracker` and `/trend-breaker` to maximize your edge!')
        .setColor(0xff4500);
    } else if (userTier === 'vip') {
      embed = new EmbedBuilder()
        .setTitle(onboardingPrompts.vipPlusPreview.embed.title)
        .setDescription(onboardingPrompts.vipPlusPreview.embed.description)
        .setColor(onboardingPrompts.vipPlusPreview.embed.color)
        .setFooter({ text: onboardingPrompts.vipPlusPreview.embed.footer.text });
    } else {
      embed = new EmbedBuilder()
        .setTitle(onboardingPrompts.vipFeatures.embed.title)
        .setDescription(onboardingPrompts.vipFeatures.embed.description)
        .setColor(onboardingPrompts.vipFeatures.embed.color)
        .setFooter({ text: onboardingPrompts.vipFeatures.embed.footer.text });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('Error in vip-info command:', error);
    await interaction.reply({ 
      content: '❌ An error occurred while showing VIP information.', 
      ephemeral: true 
    });
  }
}