const { PermissionFlagsBits, EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ComponentType } = require('discord.js');
const fs = require('fs');
const configFile = fs.readFileSync(`config.json`);
const config = JSON.parse(configFile);
const mysql = require(`${config.directory}/data/mysql`);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addpick')
    .setDescription('Add the sport pick')
    .addStringOption((option)=> option.setName(`sports`).setDescription(`Enter the sports`).setRequired(true).addChoices(
      {name:`NBA`,value:`nba`}, {name:`CBB`,value:`cbb`}, {name:`NFL`,value:`nfl`}, {name:`MLB`,value:`mlb`}, {name:`NHL`,value:`nhl`},{name:`WNBA`,value:`wnba`}, {name:`UFC`,value:`ufc`},
      {name:`Boxing`,value:`boxing`}, {name:`Tennis`,value:`tennis`}, {name:`Soccer`,value:`soccer`}, {name:`Golf`,value:`golf`}, {name:`otherVIP`,value:`othervip`}, {name:`FreePick`,value:`freepick`}
    ))
    .addStringOption((option)=> option.setName(`date`).setDescription(`Enter the date in YYYY-MM-DD format`).setRequired(true))
    .addStringOption((option)=> option.setName(`teams`).setDescription(`Enter the teams/matchup`).setRequired(true))
    .addStringOption((option)=> option.setName(`bet_type`).setDescription(`Enter the bet type`).setRequired(true).addChoices(
      {name:`Spread`,value:`spread`}, {name:`Total`,value:`total`}, {name:`ML`,value:`ml`}, {name:`Prop`,value:`prop`}, {name:`Parlay`,value:`parlay`}, {name:`Teaser`,value:`teaser`}, {name:`Round robin`,value:`round_robin`}
    ))
    .addStringOption((option)=> option.setName(`units`).setDescription(`Enter the units`).setRequired(true).addChoices(
      {name:`0.5`,value:`0.5`}, {name:`1`,value:`1`}, {name:`1.5`,value:`1.5`}, {name:`2`,value:`2`}, {name:`3`,value:`3`}, {name:`5`,value:`5`}
    ))
    .addStringOption((option)=> option.setName(`book`).setDescription(`Enter the book`).setRequired(true))
    .addStringOption((option)=> option.setName(`odds`).setDescription(`Enter the odds`).setRequired(true))
    .addStringOption((option)=> option.setName(`pick`).setDescription(`Enter the picknode `).setRequired(true))
    .addStringOption((option)=> option.setName(`notes`).setDescription(`Enter notes you wish to add`).setRequired(false)),


  async execute(interaction, client) {

    const sports = interaction.options.getString(`sports`)
    const date = interaction.options.getString(`date`);
    const teams = interaction.options.getString(`teams`)
    const pick = interaction.options.getString(`pick`)
    const units = interaction.options.getString(`units`)
    const book = interaction.options.getString(`book`)
    const odds = interaction.options.getString(`odds`)
    const bet_type = interaction.options.getString(`bet_type`)
    const notes = interaction.options.getString(`notes`) || 'No notes added';

    let accessTier = "free"
    let Channel = await client.channels.cache.get(config.freePicks)

     if (interaction.member.roles.cache.has(config.vipRole)) {
      accessTier = "vip";
      Channel = await client.channels.cache.get(config.vipPicks)
     }
     if (interaction.member.roles.cache.has(config.vipPlusRole)) {
      accessTier = "vip+";
      Channel = await client.channels.cache.get(config.vipPicks)
     }
 

    const data = await mysql.queryExecute(`INSERT INTO SportsPick (User_id, Sport, Teams, Pick, Book, Notes, Units, Odds, Bet_type, Date, Access_tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[interaction.user.id, sports, teams, pick, book, notes, units, odds, bet_type, date, accessTier])

    const embed = new EmbedBuilder()
    .setTitle(`Success`)
    .setDescription(`Your pick has been added to the database.`)
    .setColor(`Blue`)

    await interaction.reply({embeds:[embed]});

    const timestamp = Math.floor(Date.now() / 1000);
    const formattedTimestamp = `<t:${timestamp}:t>`;

    const pickEmbed = new EmbedBuilder()
    .setDescription(`**New pick Incoming from ${interaction.user}** \n\nSports: ${sports} \nGame date: ${date} \nMatchup: ${teams} \nPick: ${pick} \nUnits: ${units} \nBook: ${book} \nOdds: ${odds} \nBet type: ${bet_type}\nNotes: ${notes} \nAccess tier: ${accessTier} \n\nSubmitted: ${formattedTimestamp}`)
    .setColor(`Blue`)

    await Channel.send({embeds:[pickEmbed]})

  }
};
