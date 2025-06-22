const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const mysql = require(`${config.directory}/data/mysql`)

module.exports = { 
    name: "messageReactionAdd",
    async execute(reaction, user, client) {
        if (user.bot) return;

        try {
            if (reaction.partial) await reaction.fetch();
            const data = await mysql.queryExecute(`SELECT * FROM EngagmentStats WHERE Guild_id = ? AND User_id = ?`,[reaction.message.guildId,user.id])
  
            if (data.length === 0) {
               await mysql.queryExecute(`INSERT INTO EngagmentStats VALUES(?,?,?,?)`,[reaction.message.guildId,user.id, 0, 1])
            } else if (data.length !== 0) {
              await mysql.queryExecute(`UPDATE EngagmentStats SET Reactions = Reactions + 1 WHERE Guild_id = ? AND User_id = ?`,[reaction.message.guildId,user.id])
            }


        } catch (error) {
            console.error("Error handling reaction:", error);
        }
    }
};
