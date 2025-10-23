require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const cfg = {
  token: process.env.DISCORD_TOKEN,
  guildId: process.env.GUILD_ID,
  free: process.env.CHANNEL_FREE_ID,
  recaps: process.env.CHANNEL_RECAPS_ID,
  winwall: process.env.CHANNEL_WINWALL_ID,
  news: process.env.CHANNEL_NEWS_ID,
  announcements: process.env.CHANNEL_ANNOUNCEMENTS_ID,
  caps: {
    newsDay: Number(process.env.NEWS_MAX_PER_DAY || 12),
    newsBurst: Number(process.env.NEWS_BURST_PER_15M || 3),
    winwallDay: Number(process.env.WINWALL_MAX_PER_DAY || 4),
  }
};

if (!cfg.token || !cfg.guildId) {
  console.error("❌ Missing DISCORD_TOKEN or GUILD_ID in .env");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
function iso(){ return new Date().toISOString(); }
async function ch(id){ return client.channels.fetch(id); }

function freePickPayload(){
  return {
    content: "🎁 **Free Pick of the Day**",
    embeds: [ new EmbedBuilder()
      .setTitle("NFL · A.J. Brown o79.5 REC Yds (−115)")
      .setDescription("Why: matchup GREEN (DVP), sharp buy, pace boost. Enter ≤ −120.")
      .addFields(
        { name: "Books", value: "FD −115 → −122 (7m) · DK −110" },
        { name: "Confidence", value: "88%", inline: true },
        { name: "Risk", value: "1.0U; pass if line ≥ 82.5", inline: true }
      )
      .setFooter({ text: "Idem: free_ajb_test" })
      .setTimestamp(new Date())
    ],
    components: [ new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("vip_info").setLabel("See VIP Benefits").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("vip_upgrade").setLabel("Upgrade to VIP").setStyle(ButtonStyle.Success)
    )]
  };
}

function recapPayload(){
  return {
    content: "📅 **Daily Recap — Test Run**",
    embeds: [ new EmbedBuilder()
      .setTitle("NFL/NCAAF — Summary")
      .addFields(
        { name: "Server Total", value: "+5.8U (54–41–3)" },
        { name: "Top 3 Cappers", value: "Capper A +3.1U • Capper B +2.4U • Capper C +1.6U" },
        { name: "Highlights", value: "5 CLV wins • 2 hedge locks" }
      )
      .setFooter({ text: "Links: VIP Best Bets, Win-Wall, Trader Insights" })
      .setTimestamp(new Date())
    ]
  };
}

function winwallPayload(){
  return {
    content: "🏆 **Win-Wall**",
    embeds: [ new EmbedBuilder()
      .setTitle("CLV Beat + Closed Winner")
      .setImage("https://dummyimage.com/800x400/1e1e1e/ffffff&text=Ticket+Screenshot")
      .addFields(
        { name: "Play", value: "Mostert Rush Yds o58.5 (−110) → closed 65.5" },
        { name: "Result", value: "WIN +1.0U • CLV +7.0%" }
      )
      .setFooter({ text: "Auto-curated • Idem: win_test" })
      .setTimestamp(new Date())
    ]
  };
}

function newsPayload(headline){
  return {
    content: `📰 **${headline}**`,
    embeds: [ new EmbedBuilder()
      .setDescription("Status: headline-only. (No betting advice here.)")
      .setTimestamp(new Date())
    ]
  };
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function main(){
  await client.login(cfg.token);
  console.log("✅ Connected as", client.user.tag);

  const chFree = await ch(cfg.free);
  const chRecap = await ch(cfg.recaps);
  const chWin = await ch(cfg.winwall);
  const chNews = await ch(cfg.news);

  // 1) Free pick with buttons
  await chFree.send(freePickPayload());
  console.log("✅ Free Daily Pick posted");

  // 2) Recap
  await chRecap.send(recapPayload());
  console.log("✅ Recap posted");

  // 3) Win-Wall
  await chWin.send(winwallPayload());
  console.log("✅ Win-Wall posted");

  // 4) Sports-News burst (visual verification; prod limiter should cap 3 per 15m, 12/day)
  const headlines = [
    "ESPN: Bengals rule out Tee Higgins (hamstring)",
    "Schefter: Trade finalized — Edge rusher to AFC contender",
    "Rapoport: QB limited in practice; game-time decision",
    "Extra Headline (should be rate-limited in prod)"
  ];
  for (const h of headlines){
    await chNews.send(newsPayload(h));
    console.log("📰 News posted:", h);
    await sleep(300); // tiny spacing for readability
  }

  // Button echo (ephemeral)
  client.on('interactionCreate', async (i)=>{
    if (!i.isButton()) return;
    if (i.customId === 'vip_info') {
      await i.reply({ ephemeral: true, content: "VIP Benefits: real-time alerts, curated feed, Best Bets (VIP+), deep analysis, Strategy Room." });
    } else if (i.customId === 'vip_upgrade') {
      await i.reply({ ephemeral: true, content: "Upgrade: https://your-upgrade-url.example 🎉" });
    }
  });

  console.log("\n🎉 Public Edge test messages sent. Verify in Discord:");
  console.log(" - 🎁 free-daily-picks: embed + two working buttons (ephemeral replies)");
  console.log(" - 📅 recaps: one recap card");
  console.log(" - 🏆 win-wall: one proof card");
  console.log(" - 📰 sports-news: 3–4 headlines (your prod limiter should enforce caps)\n");
}

main().catch(e=>{ console.error("❌ Test failed:", e); process.exit(1); });
