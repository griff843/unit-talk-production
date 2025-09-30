import { ChatInputCommandInteraction, SlashCommandBuilder, User } from 'discord.js';
import Redis from 'ioredis';

const CHANNEL = 'ut:roles:change';

export const data = new SlashCommandBuilder()
  .setName('simulate-tier')
  .setDescription('Admin: simulate a tier change event through the Whop pipeline')
  .addStringOption(option =>
    option
      .setName('tier')
      .setDescription('Target tier to simulate')
      .setRequired(true)
      .addChoices(
        { name: 'trial', value: 'trial' },
        { name: 'member', value: 'member' },
        { name: 'vip', value: 'vip' },
        { name: 'vip_plus', value: 'vip_plus' },
      )
  )
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('Target user (defaults to yourself)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  // Admin/owner-only command is enforced via command config
  await interaction.deferReply({ ephemeral: true });

  const tier = interaction.options.getString('tier', true) as 'trial'|'member'|'vip'|'vip_plus';
  const user = (interaction.options.getUser('user') || interaction.user) as User;

  const payload = {
    type: 'role.change',
    source: 'manual',
    userId: user.id,
    targetTier: tier,
    occurred_at: new Date().toISOString(),
  };

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const pub = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });

  try {
    await pub.connect();
    await pub.publish(CHANNEL, JSON.stringify(payload));
    await pub.quit();

    await interaction.editReply({
      content: `✅ Published role change to ${CHANNEL}\n• User: ${user.tag} (${user.id})\n• Tier: ${tier}`,
    });
  } catch (error: any) {
    try { await pub.quit(); } catch {}
    await interaction.editReply({ content: `❌ Failed to publish role change: ${error?.message || error}` });
  }
}

