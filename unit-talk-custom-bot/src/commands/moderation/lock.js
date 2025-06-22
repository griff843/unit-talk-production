const {
    Client,
    Interaction,
    ApplicationCommandOptionType,
    PermissionFlagsBits,EmbedBuilder,ActionRowBuilder,ButtonBuilder, ButtonStyle,SlashCommandBuilder, ComponentType
  } = require('discord.js');
  const fs = require('fs')
  const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
  
  module.exports = {
    data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription(`Locks the channel`),
    async execute(interaction,client)  {
    
        const roleId = config.discord.everyone
        const {ViewChannel, SendMessages,ManageChannels,ReadMessageHistory,ManageMessages, Administrator, BanMembers, KickMembers,ModerateMembers} = PermissionFlagsBits;

      const nopermEmbed = new EmbedBuilder()
      .setDescription(`You don't have permissions to run this command. You need \`Manage Channels\` permission to run this command!`)
      .setColor(`Red`)

      if (!interaction.member.permissions.has(ManageChannels)) {
      interaction.editReply({embeds:[nopermEmbed]})
      return;}
   
  
        const enableEmbed = new EmbedBuilder()
        .setTitle(`Success`)
        .setDescription(`Channel has been locked :lock:`)
        .setColor("Blue")

        const enbSuccess = new EmbedBuilder()
        .setDescription(`This channel has been locked by the Administrators :lock:`)
        .setColor("Blue")
           
        interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id,{SendMessages:false,AddReactions: false,Connect:false});
        interaction.reply({embeds: [enableEmbed]});
            interaction.channel.send({embeds: [enbSuccess]});
    }

};
           



