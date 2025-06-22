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

        cron.schedule('30 20 * * *', async() => {  // 8:30 PM (IST) -> 10 AM EST    30 20 * * *
            const data = await mysql.queryExecute(`SELECT * FROM DailyQues WHERE Active = TRUE`)
            const question = data[0].Question;
            const dailyChannel = await client.channels.cache.get(config.dailyChannel)

            const embed = new EmbedBuilder()
            .setTitle(`Daily question`)
            .setDescription(`${question}`)
            .setColor(`Blue`)
        
             await dailyChannel.send({embeds:[embed]})

            await mysql.queryExecute(`SET @nextId = (
                SELECT COALESCE(
                    (SELECT MIN(Id) FROM DailyQues WHERE Id > (SELECT Id FROM DailyQues WHERE Active = 1)),
                    (SELECT MIN(Id) FROM DailyQues)
                )
            );`)
                    await mysql.queryExecute(`UPDATE DailyQues
            SET Active = CASE 
                WHEN Id = @nextId THEN 1
                ELSE 0
            END;`)
        });
    },
};