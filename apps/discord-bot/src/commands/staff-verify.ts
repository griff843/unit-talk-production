import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { verifyStaffCode } from '../services/onboarding/flows/staffGate';

export const data = new SlashCommandBuilder()
  .setName('staff-verify')
  .setDescription('Enter your 6-digit staff access code to receive the Staff role')
  .addStringOption(o =>
    o
      .setName('code')
      .setDescription('Your 6-digit code')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const code = interaction.options.getString('code', true).trim();
  const member = interaction.member as GuildMember | null;
  if (!member || !member.manageable) {
    return interaction.editReply('This command must be used in the server where the Staff role exists.');
  }

  const result = await verifyStaffCode(member, code);
  if (!result.ok) {
    return interaction.editReply(`❌ ${result.message}`);
  }
  return interaction.editReply('✅ Verified. Staff role granted. Welcome aboard!');
}

