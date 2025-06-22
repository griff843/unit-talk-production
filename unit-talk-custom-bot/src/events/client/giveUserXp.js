const {Client, Message,EmbedBuilder, Collection} = require(`discord.js`);
const fs = require('fs');
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile)
const cooldowns = new Collection()
const mysql = require(`${config.directory}/data/mysql`)

module.exports = {
  name: `messageCreate`,

  /** 
   * @param {Message} message
   * @param {Client} client 
  */
 async execute(message,client) {

  const {author,guild} = message
  if (!guild || author.bot || cooldowns.has(message.author.id)) return;
 
  const mysqlData = await mysql.queryExecute(`SELECT * FROM Level WHERE Guild_id = ? AND User_id = ?`, [guild.id, author.id])
      
    if (mysqlData.length === 0) {
  await mysql.queryExecute(`INSERT INTO Level VALUES (?, ?, ?, ?)`, [guild.id, author.id, 0, 0])
  return;
    }
  
  let give = Math.floor(Math.random() * 4) + 4;     // [4,5,6,7]
  const channel = message.channel;

  if (config.booster.channelCat1.includes(channel.id)) {
    give *= 2;
   } else if (config.booster.channelCat2.includes(channel.id)) {
    give *= 1.5;
    give = Math.ceil(give)
   } 
   
  function calculateTotalXp(level) {
    return 100 * Math.pow(level, 2);
}
  const requiredXp = calculateTotalXp(mysqlData[0].Level + 1);


  if (mysqlData[0].XP + give>= requiredXp) {  // Level up
    await mysql.queryExecute(`UPDATE Level SET XP = ?, Level = ? WHERE Guild_id = ? AND User_id = ?`, [mysqlData[0].XP + give, mysqlData[0].Level + 1, guild.id, author.id])
    cooldowns.set(message.author.id);
    setTimeout(() => {
      cooldowns.delete(message.author.id);
    }, 60000);

    const levelRoles = await mysql.queryExecute(`SELECT * FROM LevelRoles WHERE Guild_id = ? AND Level = ?`, [guild.id, mysqlData[0].Level + 1]) 
    if (levelRoles.length !== 0) {
      const role = await guild.roles.fetch(levelRoles[0].Role_id).catch(() => null)
      if (role) {
        await message.member.roles.add(role)
    }  }
    
    if (!channel) return;
    const levelEmbed =new EmbedBuilder()
        .setColor("Green")
        .setDescription(`⚡ Congratulations <@${message.author.id}> , you have levelled up to **level ${mysqlData[0].Level + 1 }**`)

    message.reply({embeds:[levelEmbed]})
  }
   else {

    await mysql.queryExecute(`UPDATE Level SET XP = ? WHERE Guild_id = ? AND User_id = ?`, [mysqlData[0].XP + give, guild.id, author.id])
    cooldowns.set(message.author.id);
      setTimeout(() => {
        cooldowns.delete(message.author.id);
      }, 60000); 
    }
 }
}