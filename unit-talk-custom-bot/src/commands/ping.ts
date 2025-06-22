import { CommandInteraction, SlashCommandBuilder, Message } from 'discord.js';
import { CommandContext } from '../types';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),

  async execute(interaction: CommandInteraction, _context: CommandContext) {
    await interaction.reply({ content: 'Pinging...' });
    const sent = await interaction.fetchReply() as Message;
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    await interaction.editReply(
      `🏓 Pong!\n` +
      `📡 Latency: ${latency}ms\n` +
      `💓 API Latency: ${apiLatency}ms`
    );
  },
};