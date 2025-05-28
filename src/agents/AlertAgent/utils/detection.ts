import { buildUnitTalkEmbed } from './embedBuilder';
import { OpenAI } from 'openai'; // adjust import if using a helper
import { TextChannel } from 'discord.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }); // adjust for your setup
async function getUnitTalkAdvice(eventSummary: string): Promise<string> {
  const prompt = `You are an elite sports betting advisor for a Fortune 100-level betting group. Given this scenario, provide clear, actionable advice as if you are a top-tier human capper (never mention AI or automation):

${eventSummary}

Respond with one concise paragraph.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: prompt }],
    max_tokens: 120,
    temperature: 0.6,
  });
  return response.choices[0].message.content?.trim() || '';
}
export async function detectInjuryImpact(ctx: any, channel: TextChannel) {
  if (!ctx.injury) return false;
  const advice = await getUnitTalkAdvice(
    `A key player (${ctx.injury.player}) is ${ctx.injury.status}. Opponent: ${ctx.injury.opponent}. Current line: ${ctx.line}.`
  );
  const embed = buildUnitTalkEmbed({
    title: 'Injury Alert',
    description: `🚑 **${ctx.injury.player}** is now **${ctx.injury.status}**.\nImpact: ${ctx.injury.impact || 'Unknown'}.\nGame: ${ctx.matchup || ''}`,
    advice,
    emoji: '🚑',
    fields: [
      { name: 'Matchup', value: ctx.matchup || 'N/A', inline: true },
      { name: 'Old Line', value: ctx.lineOld || 'N/A', inline: true },
      { name: 'New Line', value: ctx.line || 'N/A', inline: true },
    ],
    color: 0xFF0000,
  });
  await channel.send({ embeds: [embed] });
  return true;
}

export async function detectSignificantLineMove(ctx: any, channel: TextChannel) {
  if (!ctx.lineMove || Math.abs(ctx.lineMove) < 0.5) return false;
  const advice = await getUnitTalkAdvice(
    `A betting line has moved by ${ctx.lineMove}. Market: ${ctx.market}. Direction: ${ctx.lineMove > 0 ? 'Up' : 'Down'}. New line: ${ctx.line}.`
  );
  const embed = buildUnitTalkEmbed({
    title: 'Line Movement Alert',
    description: `📈 **Line moved ${ctx.lineMove > 0 ? 'UP' : 'DOWN'}** by ${ctx.lineMove} on ${ctx.market}.\nNew Line: ${ctx.line}`,
    advice,
    emoji: ctx.lineMove > 0 ? '📈' : '📉',
    fields: [
      { name: 'Market', value: ctx.market || 'N/A', inline: true },
      { name: 'Old Line', value: ctx.lineOld || 'N/A', inline: true },
      { name: 'New Line', value: ctx.line || 'N/A', inline: true },
    ],
    color: 0xFF9900,
  });
  await channel.send({ embeds: [embed] });
  return true;
}

export async function detectHedgeOpportunity(ctx: any, channel: TextChannel) {
  if (!ctx.hedge || !ctx.hedge.opportunity) return false;
  const advice = await getUnitTalkAdvice(
    `There is a hedge opportunity between ${ctx.hedge.bookA} and ${ctx.hedge.bookB}. Market: ${ctx.hedge.market}. Range: ${ctx.hedge.range}.`
  );
  const embed = buildUnitTalkEmbed({
    title: 'Hedge Opportunity',
    description: `🛡️ **Hedge opportunity detected!**\n${ctx.hedge.description || ''}`,
    advice,
    emoji: '🛡️',
    fields: [
      { name: 'Market', value: ctx.hedge.market || 'N/A', inline: true },
      { name: 'Books', value: `${ctx.hedge.bookA} vs ${ctx.hedge.bookB}`, inline: true },
      { name: 'Range', value: ctx.hedge.range || 'N/A', inline: true },
    ],
    color: 0x3366FF,
  });
  await channel.send({ embeds: [embed] });
  return true;
}

export async function detectSteamMove(ctx: any, channel: TextChannel) {
  if (!ctx.steam || !ctx.steam.isSteam) return false;
  const advice = await getUnitTalkAdvice(
    `Steam move detected for ${ctx.steam.market}. Details: ${ctx.steam.details || 'N/A'}.`
  );
  const embed = buildUnitTalkEmbed({
    title: 'Steam Move Alert',
    description: `🔥 **Steam move detected!**\n${ctx.steam.details || ''}`,
    advice,
    emoji: '🔥',
    fields: [
      { name: 'Market', value: ctx.steam.market || 'N/A', inline: true },
      { name: 'Trigger', value: ctx.steam.trigger || 'N/A', inline: true },
      { name: 'Time', value: ctx.steam.time || 'N/A', inline: true },
    ],
    color: 0xFF6600,
  });
  await channel.send({ embeds: [embed] });
  return true;
}

export async function detectStaleLine(ctx: any, channel: TextChannel) {
  if (!ctx.stale || !ctx.stale.isStale) return false;
  const advice = await getUnitTalkAdvice(
    `A stale line has been detected on ${ctx.stale.market}. Current value: ${ctx.stale.value}.`
  );
  const embed = buildUnitTalkEmbed({
    title: 'Stale Line Alert',
    description: `⏳ **Stale line detected!**\n${ctx.stale.details || ''}`,
    advice,
    emoji: '⏳',
    fields: [
      { name: 'Market', value: ctx.stale.market || 'N/A', inline: true },
      { name: 'Value', value: ctx.stale.value || 'N/A', inline: true },
      { name: 'Age', value: ctx.stale.age || 'N/A', inline: true },
    ],
    color: 0x999999,
  });
  await channel.send({ embeds: [embed] });
  return true;
}

export async function detectMiddlingOpportunity(ctx: any, channel: TextChannel) {
  if (!ctx.middle || !ctx.middle.opportunity) return false;
  const advice = await getUnitTalkAdvice(
    `A middling opportunity is available on ${ctx.middle.market} between ${ctx.middle.bookA} and ${ctx.middle.bookB}.`
  );
  const embed = buildUnitTalkEmbed({
    title: 'Middling Opportunity',
    description: `🔁 **Middling opportunity detected!**\n${ctx.middle.description || ''}`,
    advice,
    emoji: '🔁',
    fields: [
      { name: 'Market', value: ctx.middle.market || 'N/A', inline: true },
      { name: 'Books', value: `${ctx.middle.bookA} vs ${ctx.middle.bookB}`, inline: true },
      { name: 'Spread', value: ctx.middle.spread || 'N/A', inline: true },
    ],
    color: 0xAA00FF,
  });
  await channel.send({ embeds: [embed] });
  return true;
}
export async function dispatchUnitTalkAlerts(context: any, discordChannel: TextChannel) {
  let alertSent = false;
  alertSent ||= await detectInjuryImpact(context, discordChannel);
  alertSent ||= await detectSignificantLineMove(context, discordChannel);
  alertSent ||= await detectHedgeOpportunity(context, discordChannel);
  alertSent ||= await detectSteamMove(context, discordChannel);
  alertSent ||= await detectStaleLine(context, discordChannel);
  alertSent ||= await detectMiddlingOpportunity(context, discordChannel);
  return alertSent;
}
