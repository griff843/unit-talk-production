#!/usr/bin/env node
/**
 * Fix Discord Channel Permissions for VIP Alert Channels
 * Makes alert channels read-only for @everyone, allows bot posting
 */

require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const ALERT_CHANNELS = [
  process.env.CHANNEL_STEAM_ID,      // #steam-alerts
  process.env.CHANNEL_INJURY_ID,     // #injury-shockwave
  process.env.CHANNEL_HEDGE_ID,      // #hedge-lab
  process.env.CHANNEL_CURATED_ID     // #alerts-feed
];

async function fixChannelPermissions() {
  console.log('🔧 Fixing channel permissions for VIP alert channels...');

  let guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID || process.env.GUILD_ID);
  if (!guild) {
    // Try fetching if not in cache
    try {
      guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID || process.env.GUILD_ID);
    } catch (error) {
      throw new Error(`Guild not found: ${process.env.DISCORD_GUILD_ID || process.env.GUILD_ID}`);
    }
  }

  const everyoneRole = guild.roles.everyone;
  const botMember = guild.members.cache.get(client.user.id);

  for (const channelId of ALERT_CHANNELS) {
    if (!channelId) continue;

    try {
      const channel = await guild.channels.fetch(channelId);
      console.log(`📝 Updating permissions for #${channel.name}...`);

      // Remove Send Messages permission from @everyone
      await channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
        SendMessagesInThreads: false
      });

      // Ensure bot can still post
      await channel.permissionOverwrites.edit(botMember, {
        SendMessages: true,
        EmbedLinks: true,
        MentionEveryone: true
      });

      console.log(`✅ #${channel.name} is now read-only for members`);
    } catch (error) {
      console.error(`❌ Failed to update #${channelId}:`, error.message);
    }
  }

  console.log('🎯 Channel permissions updated successfully!');
}

client.once('ready', async () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);

  try {
    await fixChannelPermissions();
  } catch (error) {
    console.error('❌ Permission fix failed:', error);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

client.login(process.env.DISCORD_TOKEN);