import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('edit-pick')
  .setDescription('Edit one of your pending picks');

export async function execute(interaction: any) {
  // This will be handled by the capper interaction handler
  const { handleCapperInteraction } = await import('../handlers/capperInteractionHandler');
  await handleCapperInteraction(interaction);
}