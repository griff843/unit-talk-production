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
    .setName('unlock')
    .setDescription(`Unlocks the channel`),
    async execute(interaction,client)  {

      const {ViewChannel, SendMessages,ManageChannels,ReadMessageHistory,ManageMessages, Administrator, BanMembers, KickMembers,ModerateMembers} = PermissionFlagsBits;

      const nopermEmbed = new EmbedBuilder()
      .setDescription(`You don't have permissions to run this command. You need \`Manage Channels\` permission to run this command!`)
      .setColor(`Red`)

      if (!interaction.member.permissions.has(ManageChannels)) {
      interaction.editReply({embeds:[nopermEmbed]})
      return;}
       
    
        const roleId = config.discord.everyone

        const disableEmbed = new EmbedBuilder()
        .setTitle(`Success`)
        .setDescription(`Channel has been unlocked :unlock:`)
        .setColor("Red")


        const disSuccess = new EmbedBuilder()
        .setDescription(`Channel is unlocked by the Administrators`)
        .setColor("Red")

            interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id,{SendMessages:true,AddReactions: true,Connect:true});
            interaction.reply({embeds: [disableEmbed], ephemeral:true});
            interaction.channel.send({embeds: [disSuccess]});
       
    }
};