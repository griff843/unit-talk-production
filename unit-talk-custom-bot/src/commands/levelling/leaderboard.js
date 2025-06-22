const {
    Client,                                             // Command by Rudi
    Interaction,
    ApplicationCommandOptionType,
    PermissionFlagsBits,EmbedBuilder,Discord,ActionRowBuilder,ButtonBuilder, ButtonStyle,SlashCommandBuilder,MessageEmbed, ComponentType, Embed
  } = require('discord.js');
  const fs = require('fs')
  const configFile = fs.readFileSync(`config.json`);
  const config = JSON.parse(configFile)
  const page = require(`${config.directory}/manager/pagination`)
  const mysql = require(`${config.directory}/data/mysql`)
 
  module.exports = {
    data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display leaderboard of top EXP users'),
    async execute(interaction,client)  {
       
        const {guild} = interaction;
        let text = "";
        const leaderboard =  await mysql.queryExecute(`SELECT * FROM Level WHERE Guild_id = ?`, [guild.id])

        if (leaderboard.length === 0) {
          return interaction.reply({content:`❌ There is no users on leaderboard on exp system`})
        }
        const sortedLeaderboard = leaderboard.sort((a,b) => b.XP - a.XP) 

  const pageSize = 10;
const pages = [];
 text = "";

for (let i = 0; i < sortedLeaderboard.length; i++) {
  const user = sortedLeaderboard[i];
  const OkMember = await client.users.fetch(user.User_id);
  text += `#${i + 1}: ${OkMember.username} | Level: ${user.Level} | XP: ${user.XP}\n`;

  if ((i + 1) % pageSize === 0 || i === sortedLeaderboard.length - 1) {
    text = text.trim();

    pages.push({
      title: `🏆 Leaderboard of top XP users 🏆`,
      description: `\`\`\`${text}\`\`\``,
      color: 0xFFA500,
    });

    text = ""; 
  }
}

page(interaction, pages);

}
    };