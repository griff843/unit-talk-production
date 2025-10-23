import 'dotenv/config';
import { Client, GatewayIntentBits, TextChannel, ChannelType } from 'discord.js';

async function main() {
  const [channelIdArg, ...messageParts] = process.argv.slice(2);
  const channelId = channelIdArg;
  const message = messageParts.length > 0 ? messageParts.join(' ') : `✅ Bot connectivity test at ${new Date().toISOString()}`;

  if (!process.env.DISCORD_BOT_TOKEN) {
    console.error('ERROR: DISCORD_BOT_TOKEN is not set');
    process.exit(1);
  }
  if (!channelId) {
    console.error('USAGE: ts-node src/scripts/send-test-message.ts <channelId> [message]');
    process.exit(1);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  try {
    await client.login(process.env.DISCORD_BOT_TOKEN);
    console.log('[TEST] Logged in as', client.user?.tag);

    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error('[TEST] Failed to fetch channel. It may not exist or bot lacks access.');
      process.exit(2);
    }

    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.PublicThread && channel.type !== ChannelType.PrivateThread && channel.type !== ChannelType.AnnouncementThread) {
      console.error(`[TEST] Channel type ${channel.type} is not sendable.`);
      process.exit(3);
    }

    const textChannel = channel as TextChannel;
    await textChannel.send(message);
    console.log('[TEST] Message sent successfully to', channelId);
    await client.destroy();
    process.exit(0);
  } catch (err: any) {
    console.error('[TEST] Error sending message:', {
      name: err?.name,
      code: err?.code,
      message: err?.message,
      stack: err?.stack,
    });
    try { await client.destroy(); } catch {}
    process.exit(4);
  }
}

main().catch(err => {
  console.error('[TEST] Unhandled error:', err);
  process.exit(5);
});

