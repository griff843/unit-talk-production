const {
    Client,
    Interaction,
    ApplicationCommandOptionType,
    PermissionFlagsBits,EmbedBuilder,ActionRowBuilder,ButtonBuilder, ButtonStyle,SlashCommandBuilder, ComponentType
  } = require('discord.js');
  const fs = require('fs');
  const { url } = require('inspector');
  const configFile = fs.readFileSync(`config.json`);
  const config = JSON.parse(configFile)
  const mysql = require(`${config.directory}/data/mysql`)
  
  module.exports = {
    data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warns a member in the server.')
    .addUserOption((option) => option.setName('user').setDescription(`Select the user to warn`).setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Enter the reason to warn the user').setRequired(true)),
    async execute(interaction,client)  {
        const warnUser = interaction.options.getMember('user');
      
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const server = interaction.guild.name;
        const moderator = interaction.user.tag;
        const {ViewChannel, SendMessages,ManageChannels,ReadMessageHistory,ManageMessages, Administrator, BanMembers, KickMembers,ModerateMembers} = PermissionFlagsBits;
  
      const nopermEmbed = new EmbedBuilder()
      .setDescription(`You don't have permissions to run this command. You need \`Moderate Members\` permission to run this command!`)
      .setColor(`Red`)
  
      if (!interaction.member.permissions.has(ModerateMembers)) {
      interaction.reply({embeds:[nopermEmbed]})
      return;}      
  
      if (!warnUser) {
        await interaction.reply({content:`That user doesn't exist in this server.`});
        return;
      }
  
      if (warnUser.id === interaction.guild.ownerId) {
        await interaction.reply(
          {content:`You can't warn that user because they're the server owner.`}
        );
        return;
      }
  
      const warnUserRolePosition = warnUser.roles.highest.position; // Highest role of the target user
      const requestUserRolePosition = interaction.member.roles.highest.position; // Highest role of the user running the cmd
      const botRolePosition = interaction.guild.members.me.roles.highest.position; // Highest role of the bot
  
      if (warnUserRolePosition >= requestUserRolePosition) {
        await interaction.reply(
          {content:`rYou can't warn that user because they have the same/higher role than you.`}
        );
        return;
      }
  
      if (warnUserRolePosition >= botRolePosition) {
        await interaction.reply(
          {content:`I can't warn that user because they have the same/higher role than me.`}
        );
        return;
      }
  
      // Warn the targetUser
      try {

        const dmembed = new EmbedBuilder()
        .setTitle(`Punishment received`)
        .setDescription(`Punishment received in: ${server} \nPunishment type: Warning \nReason: ${reason}`)
        .setColor(`Blue`)
        .setTimestamp();
  
        await mysql.queryExecute(`INSERT INTO Modlogs(Guild_id, User_id,Moderator_id,Punishment_type,Reason, Timestamp) VALUES (?,?,?,?,?,?)`,[interaction.guild.id,warnUser.id,interaction.user.id, 'Warning',reason,Math.floor(Date.now() / 1000)])
   
        try{
        await warnUser.send({embeds: [dmembed]});
        } catch (err) {
          console.log(`I can't dm the user!`)
        }
           
        const warnembed = new EmbedBuilder()
        .setTitle (`Success`)
        .setDescription(`Punishment type: Warning \nUser: ${warnUser} \nModerator: ${interaction.user} \nReason: ${reason}`)
        .setColor(`Blue`)
  
        const logembed = new EmbedBuilder()
        .setTitle(`Punishment issued`)
        .setDescription(`Punishment type: Warning \nModerator: ${moderator} \nUser: ${warnUser} \n$Reason: ${reason}`)
        .setTimestamp();
        
        await interaction.reply(
          {embeds: [warnembed]}
        );
  

        await client.channels.cache.get(config.modlogs).send({embeds: [logembed]});
      } catch (error) {
        console.log(`There was an error when warning: ${error}`);
      }
  
    
    }
  };
  