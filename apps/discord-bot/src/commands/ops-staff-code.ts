import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { supabaseService } from '../services/supabase';
import bcrypt from 'bcryptjs';

function generateSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const data = new SlashCommandBuilder()
  .setName('ops-staff-code')
  .setDescription('Admin: generate a 6-digit staff access code (hashed + stored)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addIntegerOption(o =>
    o.setName('expires')
      .setDescription('Expiry hours (default 168 = 7 days)')
      .setMinValue(1)
  )
  .addIntegerOption(o =>
    o.setName('max_attempts')
      .setDescription('Max verification attempts (default 3)')
      .setMinValue(1)
  )
  .addStringOption(o =>
    o.setName('label')
      .setDescription('Optional label / note for audit')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const code = generateSixDigitCode();
  const expiresHours = interaction.options.getInteger('expires') ?? 168;
  const maxAttempts = interaction.options.getInteger('max_attempts') ?? 3;
  const label = interaction.options.getString('label') ?? null;

  const hash = bcrypt.hashSync(code, 10);
  const expiresAt = new Date(Date.now() + expiresHours * 3600 * 1000).toISOString();

  const { error } = await supabaseService.client.from('staff_access_codes').insert({
    code_hash: hash,
    created_by: interaction.user.id,
    expires_at: expiresAt,
    max_attempts: maxAttempts,
    status: 'active',
    metadata: { label },
  } as any);

  if (error) {
    return interaction.editReply(`\u274c Failed to store code: ${error.message}`);
  }

  return interaction.editReply(`\u2705 Staff access code generated: **${code}** (expires in ${expiresHours}h, attempts: ${maxAttempts})`);
}

