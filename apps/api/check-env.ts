import 'dotenv/config';

console.log(JSON.stringify({
  wh: !!process.env.DISCORD_WEBHOOK_URL,
  bt: !!process.env.DISCORD_BOT_TOKEN,
  ch: !!process.env.DISCORD_CHANNEL_ID,
  sb: !!process.env.SUPABASE_URL
}, null, 2));