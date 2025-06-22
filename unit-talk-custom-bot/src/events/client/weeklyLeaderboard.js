const chalk = require("chalk");
const { Discord, EmbedBuilder, MessageMentions, Collection, ActivityType } = require('discord.js');
const fs = require(`fs`);
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const cron = require (`node-cron`)
const mysql = require(`${config.directory}/data/mysql`)

module.exports = { 
    name: "ready",
    once: true,
    async execute(client) {

        cron.schedule('30 22 * * 1', async() => {  // 10:30 PM (IST) -> 12 PM EST    30 22 * * 1
            
            const data = await mysql.queryExecute(`SELECT * FROM EngagmentStats`)
            const leaderboard = data
            .sort((a, b) => (b.Messages + b.Reactions) - (a.Messages + a.Reactions)) // Sort in descending order
            .slice(0, 5);

            let leaderboardText = "";
            leaderboard.forEach((user, index) => {
                leaderboardText += `**${index + 1}.** <@${user.User_id}> - **${user.Messages + user.Reactions}** points\n`;
            });

            const leaderboardEmbed = new EmbedBuilder()
            .setTitle(`Leaderboard for top engagment`)
            .setDescription(leaderboardText)
            .setColor(`Blue`)

            const leaderboardChannel = await client.channels.cache.get(config.engagmentLeaderboard)
            leaderboardChannel.send({embeds:[leaderboardEmbed]})

        });
    },
};