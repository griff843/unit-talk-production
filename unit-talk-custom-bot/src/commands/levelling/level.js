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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Views a member level in this server.')
        .addUserOption((option) => option.setName('user').setDescription(`Select a user`).setRequired(false)),
    async execute(interaction, client) {


        const { user, guild } = interaction;

        const member = interaction.options.getUser(`user`) || user;
        const memberId = await interaction.guild.members.cache.get(member.id);
        const icon = member.displayAvatarURL();
        const tag = member.tag

        const mysqlData = await mysql.queryExecute(`SELECT * FROM Level WHERE Guild_id = ? AND User_id =?`, [guild.id, member.id])
        const mysqlGuildData = await mysql.queryExecute(`SELECT * FROM Level WHERE Guild_id = ${guild.id}`)

        if (mysqlData.length === 0) return interaction.reply({ content: `${member} has not earned any XP in this server and does not have any level data in this server.` })

        mysqlGuildData.sort((a, b) => {
            if (a.Level === b.Level) {
                return b.XP - a.XP;
            } else {
                return b.Level - a.Level;
            }
        });
        let currentRank = mysqlGuildData.findIndex((lvl) => lvl.User_id === member.id) + 1;

        function getLevelFromXp(xp) {
            return Math.floor(Math.sqrt(xp / 100));
        }

        function calculateTotalXp(level) {
            return 100 * Math.pow(level, 2);
        }

        const XpForNextLevel = calculateTotalXp(mysqlData[0].Level + 1);

        const profileEmbed = new EmbedBuilder()
            .setColor(`Blue`)
            .setAuthor({ name: `${tag}'s level data on ${interaction.guild.name}`, iconURL: interaction.guild.iconURL() })
            .setThumbnail(icon)
            .addFields({ name: `Info`, value: `_ _\nUser tag: ${member}\nJoined: <t:${parseInt(memberId.joinedAt / 1000)}:R>` })
            .addFields({ name: `Level`, value: `_ _\n${backtick}${backtick}${backtick}Level: ${mysqlData[0].Level} \nXP Progress: ${mysqlData[0].XP} / ${XpForNextLevel} \nRank: #${currentRank}\n ${backtick}${backtick}${backtick}` })

        return interaction.reply({ embeds: [profileEmbed] });

    }
}