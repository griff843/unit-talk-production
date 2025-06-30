import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('capper-onboard')
  .setDescription('Onboard as a new capper')
  .addStringOption(option =>
    option.setName('display_name')
      .setDescription('Your display name as a capper')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('tier')
      .setDescription('Your capper tier')
      .setRequired(true)
      .addChoices(
        { name: 'Rookie', value: 'rookie' },
        { name: 'Pro', value: 'pro' },
        { name: 'Elite', value: 'elite' },
        { name: 'Legend', value: 'legend' }
      ));

export async function execute(interaction: any) {
  // This will be handled by the capper interaction handler
  const { handleCapperInteraction } = await import('../handlers/capperInteractionHandler');
  await handleCapperInteraction(interaction);
}