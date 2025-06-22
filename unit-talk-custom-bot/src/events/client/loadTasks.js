const chalk = require("chalk");
const { Discord, EmbedBuilder, MessageMentions,ChannelType, Collection, ActivityType } = require('discord.js');
const moment = require('moment');
const fs = require(`fs`);
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const ms = require(`ms`)
const os = require('os');
const cron = require(`node-cron`)  
const { DateTime } = require("luxon");
const mysql = require(`${config.directory}/data/mysql`)

module.exports = {
    name: "ready",
    once: true,
    async execute(client) {

        const data = await mysql.queryExecute(`SELECT * FROM LiveSports`)

        for (const game of data) {
        
            let unixTimestamp = game.Commence_time - 900;
            let targetTime = DateTime.fromSeconds(unixTimestamp).setZone("Asia/Kolkata");
            let cronExpression = `${targetTime.minute} ${targetTime.hour} ${targetTime.day} ${targetTime.month} *`;
        
            cron.schedule(cronExpression, async () => { // 15 minutes before the commence time
                console.log(`Running 15 minutes before commence time for ${game.id}`);

                const threadChannel = await guild.channels.cache.get(config.threadChannel.basketball)
                let usDate = DateTime.fromISO(game.Commence_time, { zone: "utc" }).toFormat("MM/dd/yyyy");
                const Thread = await threadChannel.threads.create({
                    name: `${game.Home_team} VS ${game.Away_team} - ${usDate}`,
                    reason: `Live game channel created`,
                    type: ChannelType.PublicThread,
                    autoArchiveDuration: 2880,
                })
                const startEmbed = new EmbedBuilder()
                        .setDescription(`Heads up! The thread for [Team ${game.Home_team} vs Team ${game.Away_team}] is now open.\nJoin the convo and drop your picks before tipoff!`)
                        .setColor(`Blue`)
                        Thread.send({embeds:[startEmbed]})
                await mysql.queryExecute(`UPDATE LiveSports SET ThreadId = ? WHERE Id = ?`, [Thread.id, game.Id])
            });
 
            unixTimestamp = game.Commence_time;
            targetTime = DateTime.fromSeconds(unixTimestamp).setZone("Asia/Kolkata");
            cronExpression = `${targetTime.minute} ${targetTime.hour} ${targetTime.day} ${targetTime.month} *`;

            cron.schedule(cronExpression, async () => {  // On commence time
                console.log(`Running on commence time for ${game.id}`);

                const data = await mysql.queryExecute(`SELECT * FROM LiveSports WHERE Id = ?`, [game.id])
                if (!data) return;
                const threadChannel = await client.channels.fetch(data[0].ThreadId).catch(() => null);
                const embed = new EmbedBuilder()
                    .setTitle(`Live game started`)
                    .setDescription(`Sports: ${data[0].Sport_key} \nHome team: ${data[0].Home_team} \nAway team: ${data[0].Away_team}\n`)
                    .setColor(`Gold`)

                threadChannel.send({ embeds: [embed] })
                await threadChannel.setLocked(true)
            })

            unixTimestamp = game.Commence_time + 10800;
            targetTime = DateTime.fromSeconds(unixTimestamp).setZone("Asia/Kolkata");
            cronExpression = `${targetTime.minute} ${targetTime.hour} ${targetTime.day} ${targetTime.month} *`;

            cron.schedule(cronExpression, async () => {  // After 3 hours from commence time
                console.log(`Running 3 hours after commence time for ${game.id}`);
                const data = await mysql.queryExecute(`SELECT * FROM LiveSports WHERE Id = ?`, [game.Id])
                if (!data) return;
                const threadChannel = await client.channels.fetch(data[0].ThreadId).catch(() => null);
                await threadChannel.setLocked(false);
            })
        }

    },
};