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

  const keywords = ["VIP", "odds boost"];
 
  if (keywords.some(keyword => message.content.includes(keyword))) {
    const embed = new EmbedBuilder()
    .setDescription(`Curious about VIP or boosted odds? \nFull details are pinned in #upgrade-to-vip - you'll want in before tonight's games!`)
    .setColor(`Blue`)

    return message.reply({embeds:[embed]})
}
    
 }
}