const {
    Client,
    Interaction,
    ApplicationCommandOptionType,
    PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ComponentType
} = require('discord.js');
const fs = require('fs')
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const mysql = require(`${config.directory}/data/mysql`)

module.exports = {
    data: new SlashCommandBuilder()
        .setName('level-role')
        .setDescription('Setup role for a specific level')
        .addStringOption((option) => option.setName(`operation`).setDescription(`Select an operation`).setRequired(true).addChoices({
            name: `Add`, value: `add`
        }, { name: `Remove`, value: `remove` }, {
            name: `List`, value: `list`
        }))
        .addRoleOption((option) => option.setName('role').setDescription(`Select a role`).setRequired(false))
        .addIntegerOption((option) => option.setName('level').setDescription(`Enter a level`).setRequired(false)),

    async execute(interaction, client) {

        const { user, guild } = interaction;

        const operation = interaction.options.getString(`operation`)
        const role = interaction.options.getRole(`role`) || null
        const level = interaction.options.getInteger(`level`) || null


        if (operation === 'add') {
            if (!role || !level) return interaction.reply({ content: `Please provide a role and level` })
            const data = await mysql.queryExecute(`SELECT * FROM LevelRoles WHERE Guild_id = ? AND Level = ?`, [guild.id, level])
            if (data.length) return interaction.reply({ content: `There is already a role setup for level ${level}` })
            await mysql.queryExecute(`INSERT INTO LevelRoles VALUES (?, ?, ?)`, [guild.id, level, role.id])
            return interaction.reply({ content: `Role ${role} has been setup for level ${level}` });
        
        } else if (operation === 'remove') {
            if (!level) return interaction.reply({ content: `Please provide a level` })
            const data = await mysql.queryExecute(`SELECT * FROM LevelRoles WHERE Guild_id = ? AND Level = ?`, [guild.id, level])
            if (!data.length) return interaction.reply({ content: `There is no role setup for level ${level}` })
            await mysql.queryExecute(`DELETE FROM LevelRoles WHERE Guild_id = ? AND Level = ?`, [guild.id, level])
            return interaction.reply({ content: `Role has been removed for level ${level}` });
        }
       
        else if (operation === 'list') {
            const data = await mysql.queryExecute(`SELECT * FROM LevelRoles WHERE Guild_id = ?`, [guild.id])
            if (!data.length) return interaction.reply({ content: `There are no roles setup for any level in this server` })
            const roles = data.map((role) => `<@&${role.Role_id}> - Level ${role.Level}`)
            const rolesEmbed = new EmbedBuilder()
                .setTitle(`Level roles configured in this server`)
                .setAuthor({ name: `${interaction.guild.name}`, iconURL: interaction.guild.iconURL() })
                .setColor(`Blue`)
                .setDescription(roles.join(`\n`))
            return interaction.reply({ embeds: [rolesEmbed] })
        }

    }
}