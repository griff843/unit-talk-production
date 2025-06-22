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

  if (message.channel.id !== config.firstTimePost) return
  const data = await mysql.queryExecute(`SELECT * FROM FirstTimePost WHERE Guild_id = ? AND User_id = ?`,[message.guild.id,message.author.id]);
  if (data.length === 0) {
    await mysql.queryExecute(`INSERT INTO FirstTimePost VALUES(?,?,?)`,[message.guild.id,message.author.id, false])
    const embed = new EmbedBuilder()
    .setDescription(`Welcome to the convo! \nDon't forget to check out today's game threads and drop your picks.\nLooking for exclusive plays? Tap into the VIP section anytime.`)
    .setColor(`Blue`)

    await message.reply({embeds:[embed]})

  }  else if (data.length !== 0) return;
  
 
 }
}