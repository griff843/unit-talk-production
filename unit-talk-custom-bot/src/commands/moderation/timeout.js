const {
  Client,
  Interaction,
  ApplicationCommandOptionType,
  PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ComponentType
} = require('discord.js');
const fs = require('fs')
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const backtickmulti = ("```");
const backtick = ("`");
const ms = require(`ms`);
const mysql = require(`${config.directory}/data/mysql`)
const fetch = require('node-fetch');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeouts a member from this server.')
    .addUserOption((option) => option.setName('user').setDescription(`Select the user to timeout`).setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Enter the reason to timeout the user').setRequired(true))
    .addStringOption((option) => option.setName('duration').setDescription(`Enter the timeout duration (30m, 1h, 1 day)`).setRequired(true)),
  async execute(interaction, client) {

    const mentionable = interaction.options.getUser('user')
    const duration = interaction.options.getString('duration') // 1d, 1 day, 1s 5s, 5m
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const server = interaction.guild.name;
    const moderator = interaction.user.tag;
    const { ViewChannel, SendMessages, ManageChannels, ReadMessageHistory, ManageMessages, Administrator, BanMembers, KickMembers, ModerateMembers } = PermissionFlagsBits;

    const nopermEmbed = new EmbedBuilder()
      .setDescription(`You don't have permissions to run this command. You need \`Moderate Members\` permission to run this command!`)
      .setColor(`Red`)

    if (!interaction.member.permissions.has(ModerateMembers)) {
      interaction.reply({ embeds: [nopermEmbed] })
      return;
    }


    const timeoutUser = await interaction.guild.members.fetch(mentionable);
    if (!timeoutUser) {
      await interaction.reply({ content: `That user doesn't exist in this server.` });
      return;
    }

    const msDuration = ms(duration);
    if (isNaN(msDuration)) {
      await interaction.reply({ content: `Please provide a valid timeout duration.` });
      return;
    }

    if (msDuration < 5000 || msDuration > 2.419e9) {
      await interaction.reply({ content: `Timeout duration cannot be less than 5 seconds or more than 28 days.` });
      return;
    }

    const timeoutUserRolePosition = timeoutUser.roles.highest.position; // Highest role of the target user
    const requestUserRolePosition = interaction.member.roles.highest.position; // Highest role of the user running the cmd
    const botRolePosition = interaction.guild.members.me.roles.highest.position; // Highest role of the bot

    if (timeoutUserRolePosition >= requestUserRolePosition) {
      await interaction.reply({ content: `You can't timeout that user because they have the same/higher role than you.` });
      return;
    }

    if (timeoutUserRolePosition >= botRolePosition) {
      await interaction.reply({ content: `I can't timeout that user because they have the same/higher role than me.` });
      return;
    }

    // Timeout the user
    try {
      const { default: prettyMs } = await import('pretty-ms');

      const timeoutembed = new EmbedBuilder()
        .setTitle(`Success`)
        .setDescription(`Punishment type: Timeout \nDuration: ${prettyMs(msDuration, { verbose: true })} \nUser: ${timeoutUser} \nModerator: ${interaction.user} \nReason: ${reason}`)
        .setColor(`Blue`)

      const dmembed = new EmbedBuilder()
        .setTitle(`Punishment received`)
        .setDescription(`Punishment received in: ${server} \nPunishment type: Timeout \nDuration: ${prettyMs(msDuration, { verbose: true })} \nReason: ${reason}`)
        .setColor(`Blue`)
        .setTimestamp();

      const logembed = new EmbedBuilder()
        .setTitle(`Punishment issued`)
        .setDescription(`Punishment type: Time out \nModerator: ${moderator} \nUser: ${timeoutUser} \nDuration: ${prettyMs(msDuration, { verbose: true })} \nReason: ${reason}`)
        .setColor(`Blue`)
        .setTimestamp();

      if (timeoutUser.isCommunicationDisabled()) {
        await mysql.queryExecute(`INSERT INTO Modlogs(Guild_id, User_id,Moderator_id,Punishment_type,Reason, Timestamp) VALUES (?,?,?,?,?,?)`, [interaction.guild.id, mentionable.id, interaction.user.id, `Timeout [${prettyMs(msDuration, { verbose: true })}]`, reason, Math.floor(Date.now() / 1000)])

        await timeoutUser.timeout(msDuration, reason);
        await interaction.reply(`${timeoutUser}'s timeout has been updated to ${prettyMs(msDuration, { verbose: true })}\nReason: ${reason}`);
        await client.channels.cache.get(config.modlogs).send({ embeds: [logembed] });
        return;
      }

      try {
        await timeoutUser.send({ embeds: [dmembed] });
      } catch (err) {
        console.log(`I can't dm the user!`)
      }

      await mysql.queryExecute(`INSERT INTO Modlogs(Guild_id, User_id,Moderator_id,Punishment_type,Reason, Timestamp) VALUES (?,?,?,?,?,?)`, [interaction.guild.id, mentionable.id, interaction.user.id, `Timeout [${prettyMs(msDuration, { verbose: true })}]`, reason, Math.floor(Date.now() / 1000)])

      await timeoutUser.timeout(msDuration, reason);
      await interaction.reply({ embeds: [timeoutembed], });

      await client.channels.cache.get(config.modlogs).send({ embeds: [logembed] });

    } catch (error) {
      console.log(`There was an error when timing out: ${error}`);
    }
  },
};