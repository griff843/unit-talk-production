const { PermissionFlagsBits, EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ComponentType } = require('discord.js');
const fs = require('fs');
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile);
const mysql = require(`${config.directory}/data/mysql`);
const axios = require("axios");

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('...'),

  async execute(interaction, client) {
   
    await interaction.reply(`ping`)
  }
};
