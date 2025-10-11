import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { getCache } from '../services/enterpriseCache';

const ROLE_CHOICES = [
  { name: 'member', value: 'member' },
  { name: 'trial', value: 'trial' },
  { name: 'vip', value: 'vip' },
  { name: 'vip_plus', value: 'vip_plus' },
  { name: 'capper', value: 'capper' },
  { name: 'staff', value: 'staff' },
];

export const data = new SlashCommandBuilder()
  .setName('gen-invite')
  .setDescription('Admin: generate a role-intent invite (default uses=1, unique)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o =>
    o.setName('role')
      .setDescription('Role intent for this invite')
      .setRequired(true)
      .addChoices(...ROLE_CHOICES)
  )
  .addIntegerOption(o =>
    o.setName('uses')
      .setDescription('Max uses (default 1)')
      .setMinValue(1)
  )
  .addBooleanOption(o =>
    o.setName('unique')
      .setDescription('Unique code (default true)')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild || !interaction.channel) {
    return interaction.editReply('❌ Must be used in a guild channel.');
  }

  const role = interaction.options.getString('role', true);
  const uses = interaction.options.getInteger('uses') ?? 1;
  const unique = interaction.options.getBoolean('unique') ?? true;

  // Permission validation: channel invite creation
  const me = await interaction.guild.members.fetchMe();
  const channel = interaction.channel as TextChannel;
  const canInvite = channel.permissionsFor(me)?.has('CreateInstantInvite');
  if (!canInvite) {
    return interaction.editReply('❌ I lack Create Invite permission in this channel.');
  }

  try {
    const invite = await channel.createInvite({ maxUses: uses, unique });

    // Persist role intent mapping in Redis for attribution (7 days TTL)
    const cache = getCache();
    const key = `invites:intents:${interaction.guild.id}:${invite.code}`;
    await cache.set(key, {
      role_intent: role,
      created_by: interaction.user.id,
      channel_id: channel.id,
      created_at: new Date().toISOString(),
    }, { ttl: 7 * 24 * 3600 });

    await interaction.editReply(
      `✅ Invite created for role intent "${role}"\nLink: https://discord.gg/${invite.code} (uses: ${uses}, unique: ${unique})`
    );
  } catch (error) {
    await interaction.editReply(`❌ Failed to create invite: ${(error as Error).message}`);
  }
}

