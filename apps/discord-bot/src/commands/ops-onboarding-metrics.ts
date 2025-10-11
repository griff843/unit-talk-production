import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { getCache } from '../services/enterpriseCache';

const METRIC_KEYS = [
  'metrics:discord:invite_unknown',
  'metrics:discord:staff_code_fail',
  'metrics:discord:staff_code_success',
];

export const data = new SlashCommandBuilder()
  .setName('ops-onboarding-metrics')
  .setDescription('Admin: view onboarding-related Redis metrics')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const cache = getCache();
  const vals = await Promise.all(
    METRIC_KEYS.map(k => cache.get<string | number>(k, { serialize: false }))
  );

  const lines = METRIC_KEYS.map((k, i) => `• ${k}: ${vals[i] ?? 0}`);
  await interaction.editReply([`\u2705 Onboarding metrics:`, ...lines].join('\n'));
}

