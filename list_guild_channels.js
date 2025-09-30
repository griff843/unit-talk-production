require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID || process.env.DISCORD_GUILD_ID;
if (!token || !guildId) {
  console.error('Missing DISCORD_TOKEN or GUILD_ID/DISCORD_GUILD_ID');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

(async () => {
  await client.login(token);
  const guild = await client.guilds.fetch(guildId);
  const channels = await guild.channels.fetch();
  console.log(`Guild: ${guild.name} (${guild.id}) - ${channels.size} channels`);
  const rows = [];
  channels.forEach((ch) => {
    if (!ch) return;
    rows.push({ id: ch.id, name: ch.name, type: ChannelType[ch.type] || ch.type });
  });
  rows.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
  for (const r of rows) {
    console.log(`${r.name || '(no-name)'}\t${r.type}\t${r.id}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

