import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('submit-pick')
  .setDescription('Submit a new betting pick')
  .addStringOption(option =>
    option.setName('pick_type')
      .setDescription('Type of pick (single, parlay, teaser)')
      .setRequired(true)
      .addChoices(
        { name: 'Single', value: 'single' },
        { name: 'Parlay', value: 'parlay' },
        { name: 'Teaser', value: 'teaser' }
      ))
  .addNumberOption(option =>
    option.setName('units')
      .setDescription('Number of units to bet')
      .setRequired(true)
      .setMinValue(0.5)
      .setMaxValue(10))
  .addStringOption(option =>
    option.setName('analysis')
      .setDescription('Your analysis for this pick')
      .setRequired(false));

export async function execute(interaction: any) {
  // This will be handled by the capper interaction handler
  const { handleCapperInteraction } = await import('../handlers/capperInteractionHandler');
  await handleCapperInteraction(interaction);
}