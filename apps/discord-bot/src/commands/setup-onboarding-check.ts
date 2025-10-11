import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('setup-onboarding-check')
  .setDescription('Admin: verify onboarding channels/roles are accessible by the bot')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) return interaction.editReply('\u274c Must be used in a guild');

  const envKeys = Object.keys(process.env).filter(k => k.startsWith('CH_'));
  const results: string[] = [];

  for (const k of envKeys) {
    const id = process.env[k]!;
    try {
      const ch = await interaction.client.channels.fetch(id);
      if (!ch) {
        results.push(`\u274c ${k} (${id}): not found`);
      } else {
        const perms = interaction.guild!.members.me?.permissionsIn(ch.id);
        const canView = perms?.has('ViewChannel');
        results.push(`${canView ? '✅' : '⚠️'} ${k} (${id}): ${ch?.toString()} view=${!!canView}`);
      }
    } catch (e) {
      results.push(`\u274c ${k} (${id}): ${(e as Error).message}`);
    }
  }

  const staffRole = process.env.STAFF_ROLE_ID;
  if (staffRole) {
    const roleObj = await interaction.guild.roles.fetch(staffRole).catch(() => null);
    results.push(roleObj ? `✅ STAFF_ROLE_ID ${staffRole} exists` : `\u274c STAFF_ROLE_ID ${staffRole} missing`);
  } else {
    results.push('⚠️ STAFF_ROLE_ID not set');
  }

  await interaction.editReply(results.length ? results.join('\n') : 'No CH_* env vars found.');
}

