const { PermissionFlagsBits, EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ComponentType } = require('discord.js');
const fs = require('fs');
const { re } = require('mathjs');
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile);
const mysql = require(`${config.directory}/data/mysql`);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('updatepick')
    .setDescription('Updates the sport pick')
    .addIntegerOption((option)=> option.setName(`id`).setDescription(`Enter the id of pick to be modified`).setRequired(true))
    .addStringOption((option)=> option.setName(`result`).setDescription(`Enter the result of pick`).setRequired(true))
    .addStringOption((option)=> option.setName(`units`).setDescription(`Enter the units`).setRequired(true))
    .addStringOption((option)=> option.setName(`notes`).setDescription(`Enter notes you wish to add`).setRequired(false)),


    
  async execute(interaction, client) {

    const result = interaction.options.getString(`result`)
    const id = interaction.options.getInteger(`id`)
    const units = interaction.options.getString(`units`)
    const notes = interaction.options.getString(`notes`) || 'No notes added';

    const data = await mysql.queryExecute(`SELECT * FROM SportsPick WHERE Id = ?`,[id])
    if (data.length == 0) {
        return interaction.reply(`❌ There is no pick with such id.`)
    } else {
        await mysql.queryExecute(`UPDATE SportsPick SET Result = ?, Units = ?, Notes = ? WHERE Id = ?`,[result,units, notes, id])
    }

    await interaction.reply({content:`✅ Pick has been updated`})
    
  }
};
