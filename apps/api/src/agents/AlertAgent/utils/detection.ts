import { TextChannel } from 'discord.js';
import { OpenAI } from 'openai'; // adjust import if using a helper

import { buildUnitTalkEmbed } from './embedBuilder';
// import { env } from '../../../config/env';

// SPRINT-SCHEMA-ENV-GATES-002: Lazy env access
function getOpenAIApiKey(): string {
  return process.env.OPENAI_API_KEY || '';
}

let _openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openaiClient) {
    _openaiClient = new OpenAI({ apiKey: getOpenAIApiKey() });
  }
  return _openaiClient;
}
async function getUnitTalkAdvice(eventSummary: string): Promise<string> {
  const prompt = `You are an elite sports betting advisor for a Fortune 100-level betting group. Given this scenario, provide clear, actionable advice as if you are a top-tier human capper (never mention AI or automation):

${eventSummary}

Respond with one concise paragraph.`;

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: prompt }],
    max_tokens: 120,
    temperature: 0.6,
  });
  return response.choices?.[0]?.message?.content?.trim() || '';
}
export async function detectInjuryImpact(ctx: any, channel: TextChannel) {
  if (!ctx.injury) {
    return false;
  }
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
    color: 0xff0000,
  });
  await channel.send({ embeds: [embed] });
  return true;
}

export async function detectSignificantLineMove(ctx: any, channel: TextChannel) {
  if (!ctx.lineMove || Math.abs(ctx.lineMove) < 0.5) {
    return false;
  }
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
    color: 0xff9900,
  });
  await channel.send({ embeds: [embed] });
  return true;
}

export async function detectHedgeOpportunity(ctx: any, channel: TextChannel) {
  if (!ctx.hedge || !ctx.hedge.opportunity) {
    return false;
  }
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
    color: 0x3366ff,
  });
  await channel.send({ embeds: [embed] });
  return true;
}

export async function detectSteamMove(ctx: any, channel: TextChannel) {
  if (!ctx.steam || !ctx.steam.isSteam) {
    return false;
  }
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
    color: 0xff6600,
  });
  await channel.send({ embeds: [embed] });
  return true;
}

export async function detectStaleLine(ctx: any, channel: TextChannel) {
  if (!ctx.stale || !ctx.stale.isStale) {
    return false;
  }
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
  if (!ctx.middle || !ctx.middle.opportunity) {
    return false;
  }
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
    color: 0xaa00ff,
  });
  await channel.send({ embeds: [embed] });
  return true;
}

export async function detectReverseLineMovement(ctx: any, channel: TextChannel) {
  if (!ctx.rlm || !ctx.rlm.detected) {
    return false;
  }
  const advice = await getUnitTalkAdvice(
    `Reverse line movement detected: ${ctx.rlm.publicPercentage}% of bets on ${ctx.rlm.publicSide} but line moved from ${ctx.rlm.openLine} to ${ctx.rlm.currentLine}. Sharp money likely on ${ctx.rlm.sharpSide}.`
  );
  const embed = buildUnitTalkEmbed({
    title: 'Reverse Line Movement Alert',
    description: `🔄 **Sharp money detected!**\n${ctx.rlm.publicPercentage}% of public on ${ctx.rlm.publicSide} but line moved opposite direction`,
    advice,
    emoji: '🔄',
    fields: [
      {
        name: 'Public %',
        value: `${ctx.rlm.publicPercentage}% on ${ctx.rlm.publicSide}`,
        inline: true,
      },
      { name: 'Line Move', value: `${ctx.rlm.openLine} → ${ctx.rlm.currentLine}`, inline: true },
      { name: 'Sharp Side', value: ctx.rlm.sharpSide || 'N/A', inline: true },
    ],
    color: 0x00ff00,
  });
  await channel.send({ embeds: [embed] });
  return true;
}

export async function detectClosingLineValue(ctx: any, channel: TextChannel) {
  if (!ctx.clv || Math.abs(ctx.clv.value) < 0.5) {
    return false;
  }
  const advice = await getUnitTalkAdvice(
    `Closing line value of ${ctx.clv.value > 0 ? '+' : ''}${ctx.clv.value} detected on ${ctx.clv.market}. Entry: ${ctx.clv.entryLine}, Current: ${ctx.clv.currentLine}. ${ctx.clv.value > 0 ? 'Positive CLV indicates sharp pick.' : 'Negative CLV suggests line moved against position.'}`
  );
  const embed = buildUnitTalkEmbed({
    title: 'Closing Line Value Alert',
    description: `📊 **CLV: ${ctx.clv.value > 0 ? '+' : ''}${ctx.clv.value}**\n${ctx.clv.value > 0 ? 'Beating the closing line!' : 'Line moved against position'}`,
    advice,
    emoji: ctx.clv.value > 0 ? '✅' : '⚠️',
    fields: [
      { name: 'Market', value: ctx.clv.market || 'N/A', inline: true },
      { name: 'Entry Line', value: ctx.clv.entryLine || 'N/A', inline: true },
      { name: 'Current Line', value: ctx.clv.currentLine || 'N/A', inline: true },
    ],
    color: ctx.clv.value > 0 ? 0x00ff00 : 0xffff00,
  });
  await channel.send({ embeds: [embed] });
  return true;
}

export async function detectSharpConsensus(ctx: any, channel: TextChannel) {
  if (!ctx.sharpConsensus || ctx.sharpConsensus.agreement < 80) {
    return false;
  }
  const advice = await getUnitTalkAdvice(
    `${ctx.sharpConsensus.agreement}% of sharp books agree on ${ctx.sharpConsensus.side} for ${ctx.sharpConsensus.market}. Sharp books: ${ctx.sharpConsensus.books.join(', ')}. This indicates strong sharp money consensus.`
  );
  const embed = buildUnitTalkEmbed({
    title: 'Sharp Consensus Alert',
    description: `🎯 **${ctx.sharpConsensus.agreement}% Sharp Agreement**\nMultiple sharp books aligned on ${ctx.sharpConsensus.side}`,
    advice,
    emoji: '🎯',
    fields: [
      { name: 'Market', value: ctx.sharpConsensus.market || 'N/A', inline: true },
      { name: 'Sharp Books', value: ctx.sharpConsensus.books.join(', ') || 'N/A', inline: true },
      { name: 'Consensus Side', value: ctx.sharpConsensus.side || 'N/A', inline: true },
    ],
    color: 0x00ffff,
  });
  await channel.send({ embeds: [embed] });
  return true;
}

export async function detectParlayHedgeOpportunity(ctx: any, channel: TextChannel) {
  if (!ctx.parlayHedge || !ctx.parlayHedge.opportunity) {
    return false;
  }
  const advice = await getUnitTalkAdvice(
    `Parlay hedge opportunity: ${ctx.parlayHedge.completedLegs} legs hit out of ${ctx.parlayHedge.totalLegs}. Current profit: $${ctx.parlayHedge.currentProfit}. Hedge for guaranteed profit of $${ctx.parlayHedge.guaranteedProfit} by betting $${ctx.parlayHedge.hedgeStake} on ${ctx.parlayHedge.hedgeSide}.`
  );
  const embed = buildUnitTalkEmbed({
    title: 'Parlay Hedge Alert',
    description: `💰 **${ctx.parlayHedge.completedLegs}/${ctx.parlayHedge.totalLegs} Legs Hit!**\nLock in guaranteed profit of $${ctx.parlayHedge.guaranteedProfit}`,
    advice,
    emoji: '💰',
    fields: [
      {
        name: 'Parlay Status',
        value: `${ctx.parlayHedge.completedLegs}/${ctx.parlayHedge.totalLegs} legs complete`,
        inline: true,
      },
      { name: 'Current Profit', value: `$${ctx.parlayHedge.currentProfit}`, inline: true },
      { name: 'Guaranteed Profit', value: `$${ctx.parlayHedge.guaranteedProfit}`, inline: true },
      {
        name: 'Hedge Details',
        value: `Bet $${ctx.parlayHedge.hedgeStake} on ${ctx.parlayHedge.hedgeSide}`,
        inline: false,
      },
      { name: 'Remaining Leg', value: ctx.parlayHedge.remainingLeg || 'N/A', inline: true },
      { name: 'Hedge Odds', value: ctx.parlayHedge.hedgeOdds || 'N/A', inline: true },
    ],
    color: 0x00ff00,
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
  alertSent ||= await detectReverseLineMovement(context, discordChannel);
  alertSent ||= await detectClosingLineValue(context, discordChannel);
  alertSent ||= await detectSharpConsensus(context, discordChannel);
  alertSent ||= await detectParlayHedgeOpportunity(context, discordChannel);
  return alertSent;
}
