const {Client, Message,EmbedBuilder, Collection} = require(`discord.js`);
const fs = require('fs');
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const mysql = require(`${config.directory}/data/mysql`)

module.exports = {
  name: `messageCreate`,

  /** 
   * @param {Message} message
   * @param {Client} client 
  */
 async execute(message,client) {

  const {author,guild} = message
  if (!guild || author.bot) return;

  const data = await mysql.queryExecute(`SELECT * FROM EngagmentStats WHERE Guild_id = ? AND User_id = ?`,[message.guild.id,message.author.id])
  
  if (data.length === 0) {
     await mysql.queryExecute(`INSERT INTO EngagmentStats VALUES(?,?,?,?)`,[message.guild.id,message.author.id, 1, 0])
  } else if (data.length !== 0) {
    await mysql.queryExecute(`UPDATE EngagmentStats SET Messages = Messages + 1 WHERE Guild_id = ? AND User_id = ?`,[message.guild.id,message.author.id])
  }

 }
}