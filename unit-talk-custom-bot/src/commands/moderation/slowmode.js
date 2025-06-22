const {
    Client,
    Interaction,
    ApplicationCommandOptionType,
    PermissionFlagsBits,EmbedBuilder,ActionRowBuilder,ButtonBuilder, ButtonStyle,SlashCommandBuilder, ComponentType, ChannelType,
  } = require('discord.js');
  const fs = require('fs')
  
  module.exports = {
    data: new SlashCommandBuilder()
    .setName(`slowmode`)
    .setDescription(`Set the slowmode for the channel`)
    .addIntegerOption((option) => option.setName(`duration`).setDescription(`Duration of seconds slowmode to be set in the channel`).setRequired(true))
    .addChannelOption(option => option.setName('channel').setDescription('Channel you want to set the slowmode of').addChannelTypes(ChannelType.GuildText).setRequired(false)),

    async execute(interaction,client) {

       const duration = interaction.options.getInteger(`duration`);
       const channel = interaction.options.getChannel(`channel`) || interaction.channel;

       const {ViewChannel, SendMessages,ManageChannels,ReadMessageHistory,ManageMessages, Administrator, BanMembers, KickMembers,ModerateMembers} = PermissionFlagsBits;
       const nopermEmbed = new EmbedBuilder()
       .setDescription(`You don't have permissions to run this command. You need \`Ban Members\` permission to run this command!`)
       .setColor(`Red`)
 
       if (!interaction.member.permissions.has(ManageMessages)) {
       interaction.reply({embeds:[nopermEmbed]})
       return;}

       if (channel.type !== ChannelType.GuildText) {
        return interaction.reply({content:`Please select a text channel`});
    }

       const embed = new EmbedBuilder()
       .setTitle(`Success`)
       .setColor(`Blue`)
       .setDescription(`${channel} now has ${duration} seconds of slowmode.`)
    
       channel.setRateLimitPerUser(duration).catch(err => {
        return interaction.reply({content:`There was an error when performing this action`}) 
       })
       await interaction.reply({embeds:[embed]})
    }}