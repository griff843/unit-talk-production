const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const fs = require("fs");
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const chalk = require("chalk");
require('dotenv').config()
require("console-stamp")(console, {
  format:
    '(||).yellow :date(yyyy/mm/dd"] ["hh:MM TT  ss.l).blue :label(5) (||).yellow',
});

const clientId = config.bot.clientid
const guildId = config.discord.guildid

module.exports = (client) => {
  client.handleCommands = async () => {
    client.commands = new Map();
    client.commandArray = [];
    testArray = [];

    const commandFolders = fs.readdirSync(`${config.directory}/commands`);
    for (const folder of commandFolders) {
      const commandFiles = fs
        .readdirSync(`${config.directory}/commands/${folder}`)
        .filter((file) => file.endsWith(".js"));

      
      for (const file of commandFiles) {
        const command = require(`${config.directory}/commands/${folder}/${file}`);
        client.commands.set(command.data.name, command);
        client.commandArray.push(command.data.toJSON());
        console.log(
          chalk.cyan(
            `[COMMAND HANDLE] [/${command.data.name}] has passed through the handler`
          )
        );
      }
    }

    const rest = new REST({ version: "10" }).setToken(process.env.botToken);
    try {
      console.log(
        chalk.green(`[COMMAND HANDLE] Refreshing application (/) commands.`)
        
      );

     await rest.put(Routes.applicationCommands(clientId), { body: [] })

      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: client.commandArray,
      });
 
      console.log(
        chalk.green(`[COMMAND HANDLE] Refreshed application (/) commands.`)
      );
    } catch (error) {
      console.error(error);
    }
  };
};