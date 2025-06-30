import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('capper-stats')
  .setDescription('View your capper statistics and performance');

export async function execute(interaction: any) {
  // This will be handled by the capper interaction handler
  const { handleCapperInteraction } = await import('../handlers/capperInteractionHandler');
  await handleCapperInteraction(interaction);
}