const { ActivityType, Collection,Client,Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle
    , Partials,EmbedBuilder, Utils, AuditLogEvent,GuildHubType,GuildMember,MessageManager,Events
    ,GatewayIntentBits,PermissionsBitField,Permission, ComponentType
    , InteractionType,ModalBuilder,Message,TextInputBuilder,TextInputStyle, IntegrationExpireBehavior } = require("discord.js");
const Discord= require("discord.js");
require('dotenv').config()
const fs = require("fs");
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const mySql = require(`${config.directory}/data/mysql.js`);
let process = require('node:process');
const logSystem = require(`${config.directory}/manager/logging`);


const client = new Discord.Client({
    partials: [
        Partials.Channel, Partials.Reaction, Partials.Message
        ],
    intents: [
        ["Guilds"],
        ["GuildMessages"],
        ["GuildMessageReactions"],
        ["DirectMessages"],
        ["MessageContent"],
        ["GuildMembers"],
        ["DirectMessages"],
    ],
});

client.commands = new Collection();
client.events = new Collection();


const functionFolders = fs.readdirSync(`${config.directory}/functions`);
for (const folder of functionFolders) {
    const functionFiles = fs
        .readdirSync(`${config.directory}/functions/${folder}`)
        .filter((file) => file.endsWith(`.js`));
    for (const file of functionFiles)
        require(`${config.directory}/functions/${folder}/${file}`)(client);
}

 client.handleEvents()
 client.handleCommands();
 client.login(process.env.botToken)
logSystem(client)


// Handling errors

const { start } = require("repl");
process.on('unhandledRejection', async (reason, promise) => {
  let reasonString = reason instanceof Error ? reason.stack : String(reason);
  console.log('Unhandled Rejection error at:', promise, 'reason', reason);
})
process.on('uncaughtException', async(err) => {
  let errString = err instanceof Error ? err.stack : String(err);
  console.log('Uncaught Exception', err);
})
process.on('uncaughtExceptionMonitor', async(err, origin) => {

  let errString = err instanceof Error ? err.stack : String(err);
  console.log('Uncaught Exception Monitor', err, origin);
}) 
