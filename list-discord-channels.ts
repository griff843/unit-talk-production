import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'apps/discord-bot/.env' });

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;

async function main() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });

  await client.login(DISCORD_TOKEN);

  await new Promise<void>(resolve => {
    client.once('ready', async () => {
      console.log('✅ Discord client ready\n');
      console.log('📋 Servers (Guilds) the bot is in:\n');

      client.guilds.cache.forEach(guild => {
        console.log(`  Server: ${guild.name} (ID: ${guild.id})`);
        console.log(`  Channels:`);

        guild.channels.cache
          .filter(ch => ch.isTextBased())
          .forEach(channel => {
            console.log(`    - #${channel.name} (ID: ${channel.id})`);
          });
        console.log('');
      });

      await client.destroy();
      resolve();
    });
  });
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
