import config from '../../config.json';

export const botConfig = {
  discord: {
    token: process.env['DISCORD_BOT_TOKEN'] || '',
    clientId: config.bot.clientid,
    guildId: config.discord.guildid
  }
};