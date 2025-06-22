const {
    Client,
    Interaction,
    ApplicationCommandOptionType,
    PermissionFlagsBits,EmbedBuilder,ActionRowBuilder,ButtonBuilder, ButtonStyle,SlashCommandBuilder, ComponentType
  } = require('discord.js');
  const fs = require('fs')
  const configFile = fs.readFileSync(`config.json`);
  const config = JSON.parse(configFile)
  const backtickmulti = ("```")
  const backtick = ("`")
  const fetch = require('node-fetch');
  const mysql = require(`${config.directory}/data/mysql`)
  
  module.exports = {
    data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bans a member from this server.')
    .addUserOption((option) => option.setName('user').setDescription(`Select the user to ban`).setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Enter the reason to ban the user').setRequired(true)),
  
    async execute(interaction,client)  {
  
  
      const target = interaction.options.getUser('user')
      const reason = interaction.options.getString("reason")
      const banhammer = await interaction.guild.members.fetch(target.id); // Ban command compatible User
      const moderator = interaction.user.tag
      const server = interaction.guild.name;
  
      const {ViewChannel, SendMessages,ManageChannels,ReadMessageHistory,ManageMessages, Administrator, BanMembers, KickMembers,ModerateMembers} = PermissionFlagsBits;
  
        const nopermEmbed = new EmbedBuilder()
        .setDescription(`You don't have permissions to run this command. You need \`Ban Members\` permission to run this command!`)
        .setColor(`Red`)
  
        if (!interaction.member.permissions.has(BanMembers)) {
        interaction.reply({embeds:[nopermEmbed]})
        return;}
  
        if (!interaction.guild.members.me.permissions.has(BanMembers)) {
          interaction.reply({content:`I don't have permission to ban user in this server.`})
        }
      
  
      // Self-ban 
      if (target.id === interaction.user.id) {
        return interaction.reply({ content: `${backtickmulti}yaml\n| You cannot ban yourself!${backtickmulti}`});
    }
     // Higher-role 
    
     const errEmbed = new EmbedBuilder()
     .setDescription(`You can't take action on ${backtick}${target.username}${backtick} since they have a higher role!`)
     .setColor("Red")
  
  
    //higher role
    if (banhammer.roles.highest.position >= interaction.member.roles.highest.position)
    return interaction.reply({ embeds: [errEmbed]});
  
  
     //check if bannable
     if (!banhammer.bannable) {
      return interaction.reply({ content: `I cannot ban this user! I do not have permissions or there might be a error`});
  }
    // Ban hammer 
    try {
  
      const dmembed = new EmbedBuilder()
      .setTitle(`Punishment received`)
      .setDescription(`Punishment received in: ${server}\nPunishment type: Ban \nReason: ${reason}`)
      .setColor(`Blue`)
      .setTimestamp();
  
  
      try{
      await banhammer.send({embeds: [dmembed]});
    } catch (err) {
      console.log(`I can't dm the user!`)
    }
  
      await mysql.queryExecute(`INSERT INTO Modlogs(Guild_id, User_id,Moderator_id,Punishment_type,Reason, Timestamp) VALUES (?,?,?,?,?,?)`,[interaction.guild.id,target.id,interaction.user.id,'Ban',reason,Math.floor(Date.now() / 1000)]) 
      await banhammer.ban({ reason });
      
      const banembed = new EmbedBuilder()
      .setTitle (`Success`)
      .setDescription(`Punishment type: Ban \nUser: ${banhammer} \nModerator: ${interaction.user} \nReason: ${reason}`)
      .setColor(`Blue`)
  
  
      const logembed = new EmbedBuilder()
      .setTitle(`Punishment issued`)
      .setDescription(`Punishment type: Ban \nModerator: ${moderator} \nUser: ${banhammer} \nReason: ${reason}`)
      .setColor(`Blue`)
      .setTimestamp();
      
      await interaction.reply(
        {embeds: [banembed]}
      );
  
      await client.channels.cache.get(config.modlogs).send({embeds: [logembed]});
    
    } catch (error) {
      console.log(`There was an error when banning: ${error}`);
    }
      } 
  };