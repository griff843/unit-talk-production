const chalk = require("chalk");
const { Discord, EmbedBuilder, MessageMentions, Collection, ChannelType, ThreadAutoArchiveDuration, ActivityType } = require('discord.js');
const moment = require('moment');
const fs = require(`fs`);
const { createTranscript } = require("discord-html-transcripts")
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const mysql = require(`${config.directory}/data/mysql`)
const axios = require(`axios`)
const cron = require("node-cron");
const { DateTime } = require("luxon");

module.exports = {
    name: "ready",
    once: true,
    async execute(client) {

        async function liveSportsChecker() {

            const BASE_URL = "https://api.the-odds-api.com/v4/sports";
            async function getLiveOdds(sport, region = "us") {
                try {
                    const response = await axios.get(`${BASE_URL}/${sport}/odds`, {
                        params: {
                            apiKey: config.api.oddsApi,
                            regions: region,
                            markets: "h2h,spreads,totals",
                            oddsFormat: "decimal"
                        }
                    });
                    return response.data;
                } catch (error) {
                    console.error("Error fetching data:", error.response ? error.response.data : error.message);
                }
            }

            async function InsertData(gameData) {
                for (const game of gameData) {
                    const data = await mysql.queryExecute(`SELECT * FROM LiveSports WHERE Id = ?`, [game.id])
                    if (data.length > 0) return;
                    let unixTimestamp = DateTime.fromISO(game.commence_time, { zone: "utc" }).toSeconds();
                    await mysql.queryExecute(`INSERT INTO LiveSports (Id, Sport_key, Home_team, Away_team, BookMakers, Commence_time)
            VALUES (?, ?, ?, ?, ?, ?)`, [game.id, game.sport_key, game.home_team, game.away_team, JSON.stringify(game.bookmakers), unixTimestamp])

                    unixTimestamp15MinsBefore = unixTimestamp - 900;
                    let targetTime = DateTime.fromSeconds(unixTimestamp15MinsBefore).setZone("Asia/Kolkata");
                    let cronExpression = `${targetTime.minute} ${targetTime.hour} ${targetTime.day} ${targetTime.month} *`;

                    cron.schedule(cronExpression, async () => { // 15 minutes before the commence time
                        console.log(`Running 15 minutes before commence time for ${game.id}`);

                        const threadChannel = await guild.channels.cache.get(config.threadChannel.basketball)
                        let usDate = DateTime.fromISO(game.commence_time, { zone: "utc" }).toFormat("MM/dd/yyyy");
                        const Thread = await threadChannel.threads.create({
                            name: `${game.home_team} VS ${game.away_team} - ${usDate}`,
                            reason: `Live game channel created`,
                            type: ChannelType.PublicThread,
                            autoArchiveDuration: 2880,
                        })
                        const startEmbed = new EmbedBuilder()
                        .setDescription(`Heads up! The thread for [Team ${game.home_team} vs Team ${game.away_team}] is now open.\nJoin the convo and drop your picks before tipoff!`)
                        .setColor(`Blue`)
                        Thread.send({embeds:[startEmbed]})
                        await mysql.queryExecute(`UPDATE LiveSports SET ThreadId = ? WHERE Id = ?`, [Thread.id, game.id])
                    });

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

                    unixTimestamp3HoursAfter = unixTimestamp + 10800;
                    targetTime = DateTime.fromSeconds(unixTimestamp3HoursAfter).setZone("Asia/Kolkata");
                    cronExpression = `${targetTime.minute} ${targetTime.hour} ${targetTime.day} ${targetTime.month} *`;

                    cron.schedule(cronExpression, async () => {  // After 3 hours from commence time

                        console.log(`Running 3 hours after commence time for ${game.id}`);
                        const data = await mysql.queryExecute(`SELECT * FROM LiveSports WHERE Id = ?`, [game.id])
                        if (!data) return;
                        const threadChannel = await client.channels.fetch(data[0].ThreadId).catch(() => null);
                        await threadChannel.setLocked(false);
                    })
                }
            }

            const basketballData = await getLiveOdds("basketball_nba")
            const baseballData = await getLiveOdds("baseball_mlb")
            const icehockeyData = await getLiveOdds("icehockey_nhl")
            await InsertData(basketballData)
            await InsertData(baseballData)
            await InsertData(icehockeyData)

        }
        // Run the check every 30 minutes
        setInterval(liveSportsChecker,5 * 60 * 1000);
    },
};