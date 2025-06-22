const {
  Client,
  Interaction,
  ApplicationCommandOptionType,
  PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ComponentType
} = require('discord.js');
const fs = require('fs')
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const backtickmulti = ("```")
const backtick = ("`")
const mysql = require(`${config.directory}/data/mysql`)
const fetch = require('node-fetch');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kicks a member from this server.')
    .addUserOption((option) => option.setName('user').setDescription(`Select the user to kick`).setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Enter the reason to kick the user').setRequired(true)),

  async execute(interaction, client) {
    const kickUser = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const server = interaction.guild.name;
    const moderator = interaction.user.tag;

    if (!kickUser) {
      await interaction.reply({ content: `The user doesn't exist in this server.` });
      return;
    }

    if (kickUser.id === interaction.guild.ownerId) {
      await interaction.reply({
        content:
          `You can't kick that user because they're the server owner.`
      }
      );
      return;
    }

    const kickUserRolePosition = kickUser.roles.highest.position; // Highest role of the target user
    const requestUserRolePosition = interaction.member.roles.highest.position; // Highest role of the user running the cmd
    const botRolePosition = interaction.guild.members.me.roles.highest.position; // Highest role of the bot

    if (kickUserRolePosition >= requestUserRolePosition) {
      await interaction.reply({
        content:
          `You can't kick that user because they have the same/higher role than you.`
      }
      );
      return;
    }

    if (kickUserRolePosition >= botRolePosition) {
      await interaction.reply({
        content:
          `I can't kick that user because they have the same/higher role than me.`
      }
      );
      return;
    }

    // Kick the targetUser
    try {

      const dmembed = new EmbedBuilder()
        .setTitle(`Punishment received`)
        .setDescription(`Punishment received in: ${server}\nPunishment type: Kick \nReason: ${reason}`)
        .setColor(`Blue`)
        .setTimestamp();

      await mysql.queryExecute(`INSERT INTO Modlogs(Guild_id, User_id,Moderator_id,Punishment_type,Reason, Timestamp) VALUES (?,?,?,?,?,?)`,[interaction.guild.id,kickUser.id,interaction.user.id, 'Kick',reason,Math.floor(Date.now() / 1000)])

      await kickUser.kick({ reason });

      try {
        await kickUser.send({ embeds: [dmembed] });
      } catch (err) {
        console.log(`I can't dm the user!`)
      }

      const kickembed = new EmbedBuilder()
        .setTitle(`Success`)
        .setDescription(`Punishment type: Kick \nUser: ${kickUser} \nModerator: ${interaction.user} \nReason: ${reason}`)
        .setColor(`Blue`)

      const logembed = new EmbedBuilder()
        .setTitle(`Punishment issued`)
        .setDescription(`Punishment type: Kick \nModerator: ${moderator} \nUser: ${kickUser} \nReason: ${reason}`)
        .setColor(`Blue`)
        .setTimestamp();


      await interaction.reply(
        { embeds: [kickembed] }
      );

      await client.channels.cache.get(config.modlogs).send({embeds: [logembed]});
      
    } catch (error) {
      console.log(`There was an error when kicking: ${error}`);
    }


  }
};
