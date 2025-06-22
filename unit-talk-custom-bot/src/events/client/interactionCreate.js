const { EmbedBuilder } = require("discord.js");
const chalk = require("chalk");
const fs = require('fs')
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const { InteractionType } = require("discord.js");

module.exports = {
    name: "interactionCreate",
    async execute(interaction, client) {


        if (interaction.isMessageContextMenuCommand()) {
            const command = client.commands.get(interaction.commandName);
            await command.execute(interaction, client);
        }
    
        if (interaction.isChatInputCommand()) {
            const { commands } = client;
            const { commandName } = interaction;
            const command = commands.get(commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);

            } catch (error) {
            console.log(`Error in running command..`)
            console.log(error)
            }
        } else if (
            interaction.type == InteractionType.ApplicationCommandAutocomplete
        ) {
            const { commands } = client;
            const { commandName } = interaction;
            const command = commands.get(commandName);
            if (!command) return;

            try {
                await command.autocomplete(interaction, client);
            } catch (err) {
                console.error(err);
            }
        }
    },
};