const {
    Client,
    Interaction,
    ApplicationCommandOptionType,
    PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, MessageActionRow, MessageButton, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ComponentType
} = require('discord.js');
const fs = require('fs')
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const backtickmulti = ("```")
const backtick = ("`")
const { info } = require('console');
const page = require(`${config.directory}/manager/pagination`)
const moment = require('moment-timezone');
const mysql = require(`${config.directory}/data/mysql`)


module.exports = {
    data: new SlashCommandBuilder()
        .setName('modlogs')
        .setDescription('Displays the punishment history of a user')
        .addUserOption((option) => option.setName('user').setDescription(`User to display the punishment history`).setRequired(true)),

    async execute(interaction, client) {

        const { ViewChannel, SendMessages, ManageChannels, ReadMessageHistory, ManageMessages, Administrator, BanMembers, KickMembers, ModerateMembers } = PermissionFlagsBits;

        const nopermEmbed = new EmbedBuilder()
            .setDescription(`You don't have permissions to run this command. You need \`Manage Channels\` permission to run this command!`)
            .setColor(`Red`)

        if (!interaction.member.permissions.has(ManageChannels)) {
            interaction.reply({ embeds: [nopermEmbed] })
            return;
        }



        const target = interaction.options.getUser('user');
        const mysqlData = await mysql.queryExecute(`SELECT * FROM Modlogs WHERE Guild_id = ? AND User_id = ?`, [interaction.guild.id, target.id])

        if (mysqlData.length === 0) {
            const noinfoEmbed = new EmbedBuilder()
                .setDescription(`No punishment history logs found for ${target}`)
                .setColor(`Red`)

            await interaction.reply({ embeds: [noinfoEmbed] })
        }
        else {
            let reply = ""
            a = 0
            const pageSize = 5          // 5
            const pages = []

            for (const result of mysqlData) {
                a += 1
                const timestamp = `<t:${result.Timestamp}:f>`;
                reply += `${a}. Punishment type: ${result.Punishment_type}\nReason: ${result.Reason}\nTime: ${timestamp}\nModerator: <@${result.Moderator_id}>\n\n`

                if (a % pageSize === 0) {
                    reply = reply.trim(); // Remove trailing whitespace

                    pages.push({
                        title: `Punishment log history of ${target.username}`,
                        description: reply,
                        color: 0xFFA500,
                    });
                    reply = ""; // Reset reply for the next page
                }
            }
            if (reply) {
                reply = reply.trim(); // Remove trailing whitespace
                pages.push({
                    title: `Punishment log history of ${target.username}`,
                    description: reply,
                    color: 0xFFA500,
                });
            }
            page(interaction, pages)
        }

    }
}
