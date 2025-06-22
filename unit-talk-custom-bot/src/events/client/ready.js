const chalk = require("chalk");
const { Discord, EmbedBuilder, MessageMentions, Collection, ActivityType } = require('discord.js');
const moment = require('moment');
const fs = require(`fs`);
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const ms = require(`ms`)
const os = require('os'); 
const cron = require (`cron`)

module.exports = { 
    name: "ready",
    once: true,
    async execute(client) {

      
     console.log(chalk.magenta(`[CLIENT] Logged in as ${client.user.tag}`));

      const commandCount = client.commands.size; 
      const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
      const totalGuilds = client.guilds.cache.size;

      function displayAdvancedConsole() {
        console.log('==================================');
        console.log('Bot Status Console');
        console.log('==================================');
        console.log(`Command Count: ${commandCount}`);
        console.log(`Total Members: ${totalMembers}`);
        console.log(`Total Guilds: ${totalGuilds}`);
        console.log(`Bot Launch Time: ${new Date().toLocaleString()}`);
        console.log(`Storage Used: ${Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)} MB`);
        console.log(`Total RAM: ${Math.round(os.totalmem() / 1024 / 1024)} MB`);
        console.log(`CPU: ${os.cpus()[0].model}`);
        console.log('==================================');
    }
    displayAdvancedConsole();       
    },
};