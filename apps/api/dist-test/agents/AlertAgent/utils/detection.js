"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectInjuryImpact = detectInjuryImpact;
exports.detectSignificantLineMove = detectSignificantLineMove;
exports.detectHedgeOpportunity = detectHedgeOpportunity;
exports.detectSteamMove = detectSteamMove;
exports.detectStaleLine = detectStaleLine;
exports.detectMiddlingOpportunity = detectMiddlingOpportunity;
exports.detectReverseLineMovement = detectReverseLineMovement;
exports.detectClosingLineValue = detectClosingLineValue;
exports.detectSharpConsensus = detectSharpConsensus;
exports.detectParlayHedgeOpportunity = detectParlayHedgeOpportunity;
exports.dispatchUnitTalkAlerts = dispatchUnitTalkAlerts;
const openai_1 = require("openai"); // adjust import if using a helper
const embedBuilder_1 = require("./embedBuilder");
// import { env } from '../../../config/env';
const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = new openai_1.OpenAI({ apiKey: openaiApiKey }); // adjust for your setup
async function getUnitTalkAdvice(eventSummary) {
    const prompt = `You are an elite sports betting advisor for a Fortune 100-level betting group. Given this scenario, provide clear, actionable advice as if you are a top-tier human capper (never mention AI or automation):

${eventSummary}

Respond with one concise paragraph.`;
    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: prompt }],
        max_tokens: 120,
        temperature: 0.6,
    });
    return response.choices?.[0]?.message?.content?.trim() || '';
}
async function detectInjuryImpact(ctx, channel) {
    if (!ctx.injury) {
        return false;
    }
    const advice = await getUnitTalkAdvice(`A key player (${ctx.injury.player}) is ${ctx.injury.status}. Opponent: ${ctx.injury.opponent}. Current line: ${ctx.line}.`);
    const embed = (0, embedBuilder_1.buildUnitTalkEmbed)({
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
async function detectSignificantLineMove(ctx, channel) {
    if (!ctx.lineMove || Math.abs(ctx.lineMove) < 0.5) {
        return false;
    }
    const advice = await getUnitTalkAdvice(`A betting line has moved by ${ctx.lineMove}. Market: ${ctx.market}. Direction: ${ctx.lineMove > 0 ? 'Up' : 'Down'}. New line: ${ctx.line}.`);
    const embed = (0, embedBuilder_1.buildUnitTalkEmbed)({
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
async function detectHedgeOpportunity(ctx, channel) {
    if (!ctx.hedge || !ctx.hedge.opportunity) {
        return false;
    }
    const advice = await getUnitTalkAdvice(`There is a hedge opportunity between ${ctx.hedge.bookA} and ${ctx.hedge.bookB}. Market: ${ctx.hedge.market}. Range: ${ctx.hedge.range}.`);
    const embed = (0, embedBuilder_1.buildUnitTalkEmbed)({
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
async function detectSteamMove(ctx, channel) {
    if (!ctx.steam || !ctx.steam.isSteam) {
        return false;
    }
    const advice = await getUnitTalkAdvice(`Steam move detected for ${ctx.steam.market}. Details: ${ctx.steam.details || 'N/A'}.`);
    const embed = (0, embedBuilder_1.buildUnitTalkEmbed)({
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
async function detectStaleLine(ctx, channel) {
    if (!ctx.stale || !ctx.stale.isStale) {
        return false;
    }
    const advice = await getUnitTalkAdvice(`A stale line has been detected on ${ctx.stale.market}. Current value: ${ctx.stale.value}.`);
    const embed = (0, embedBuilder_1.buildUnitTalkEmbed)({
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
async function detectMiddlingOpportunity(ctx, channel) {
    if (!ctx.middle || !ctx.middle.opportunity) {
        return false;
    }
    const advice = await getUnitTalkAdvice(`A middling opportunity is available on ${ctx.middle.market} between ${ctx.middle.bookA} and ${ctx.middle.bookB}.`);
    const embed = (0, embedBuilder_1.buildUnitTalkEmbed)({
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
async function detectReverseLineMovement(ctx, channel) {
    if (!ctx.rlm || !ctx.rlm.detected) {
        return false;
    }
    const advice = await getUnitTalkAdvice(`Reverse line movement detected: ${ctx.rlm.publicPercentage}% of bets on ${ctx.rlm.publicSide} but line moved from ${ctx.rlm.openLine} to ${ctx.rlm.currentLine}. Sharp money likely on ${ctx.rlm.sharpSide}.`);
    const embed = (0, embedBuilder_1.buildUnitTalkEmbed)({
        title: 'Reverse Line Movement Alert',
        description: `🔄 **Sharp money detected!**\n${ctx.rlm.publicPercentage}% of public on ${ctx.rlm.publicSide} but line moved opposite direction`,
        advice,
        emoji: '🔄',
        fields: [
            { name: 'Public %', value: `${ctx.rlm.publicPercentage}% on ${ctx.rlm.publicSide}`, inline: true },
            { name: 'Line Move', value: `${ctx.rlm.openLine} → ${ctx.rlm.currentLine}`, inline: true },
            { name: 'Sharp Side', value: ctx.rlm.sharpSide || 'N/A', inline: true },
        ],
        color: 0x00FF00,
    });
    await channel.send({ embeds: [embed] });
    return true;
}
async function detectClosingLineValue(ctx, channel) {
    if (!ctx.clv || Math.abs(ctx.clv.value) < 0.5) {
        return false;
    }
    const advice = await getUnitTalkAdvice(`Closing line value of ${ctx.clv.value > 0 ? '+' : ''}${ctx.clv.value} detected on ${ctx.clv.market}. Entry: ${ctx.clv.entryLine}, Current: ${ctx.clv.currentLine}. ${ctx.clv.value > 0 ? 'Positive CLV indicates sharp pick.' : 'Negative CLV suggests line moved against position.'}`);
    const embed = (0, embedBuilder_1.buildUnitTalkEmbed)({
        title: 'Closing Line Value Alert',
        description: `📊 **CLV: ${ctx.clv.value > 0 ? '+' : ''}${ctx.clv.value}**\n${ctx.clv.value > 0 ? 'Beating the closing line!' : 'Line moved against position'}`,
        advice,
        emoji: ctx.clv.value > 0 ? '✅' : '⚠️',
        fields: [
            { name: 'Market', value: ctx.clv.market || 'N/A', inline: true },
            { name: 'Entry Line', value: ctx.clv.entryLine || 'N/A', inline: true },
            { name: 'Current Line', value: ctx.clv.currentLine || 'N/A', inline: true },
        ],
        color: ctx.clv.value > 0 ? 0x00FF00 : 0xFFFF00,
    });
    await channel.send({ embeds: [embed] });
    return true;
}
async function detectSharpConsensus(ctx, channel) {
    if (!ctx.sharpConsensus || ctx.sharpConsensus.agreement < 80) {
        return false;
    }
    const advice = await getUnitTalkAdvice(`${ctx.sharpConsensus.agreement}% of sharp books agree on ${ctx.sharpConsensus.side} for ${ctx.sharpConsensus.market}. Sharp books: ${ctx.sharpConsensus.books.join(', ')}. This indicates strong sharp money consensus.`);
    const embed = (0, embedBuilder_1.buildUnitTalkEmbed)({
        title: 'Sharp Consensus Alert',
        description: `🎯 **${ctx.sharpConsensus.agreement}% Sharp Agreement**\nMultiple sharp books aligned on ${ctx.sharpConsensus.side}`,
        advice,
        emoji: '🎯',
        fields: [
            { name: 'Market', value: ctx.sharpConsensus.market || 'N/A', inline: true },
            { name: 'Sharp Books', value: ctx.sharpConsensus.books.join(', ') || 'N/A', inline: true },
            { name: 'Consensus Side', value: ctx.sharpConsensus.side || 'N/A', inline: true },
        ],
        color: 0x00FFFF,
    });
    await channel.send({ embeds: [embed] });
    return true;
}
async function detectParlayHedgeOpportunity(ctx, channel) {
    if (!ctx.parlayHedge || !ctx.parlayHedge.opportunity) {
        return false;
    }
    const advice = await getUnitTalkAdvice(`Parlay hedge opportunity: ${ctx.parlayHedge.completedLegs} legs hit out of ${ctx.parlayHedge.totalLegs}. Current profit: $${ctx.parlayHedge.currentProfit}. Hedge for guaranteed profit of $${ctx.parlayHedge.guaranteedProfit} by betting $${ctx.parlayHedge.hedgeStake} on ${ctx.parlayHedge.hedgeSide}.`);
    const embed = (0, embedBuilder_1.buildUnitTalkEmbed)({
        title: 'Parlay Hedge Alert',
        description: `💰 **${ctx.parlayHedge.completedLegs}/${ctx.parlayHedge.totalLegs} Legs Hit!**\nLock in guaranteed profit of $${ctx.parlayHedge.guaranteedProfit}`,
        advice,
        emoji: '💰',
        fields: [
            { name: 'Parlay Status', value: `${ctx.parlayHedge.completedLegs}/${ctx.parlayHedge.totalLegs} legs complete`, inline: true },
            { name: 'Current Profit', value: `$${ctx.parlayHedge.currentProfit}`, inline: true },
            { name: 'Guaranteed Profit', value: `$${ctx.parlayHedge.guaranteedProfit}`, inline: true },
            { name: 'Hedge Details', value: `Bet $${ctx.parlayHedge.hedgeStake} on ${ctx.parlayHedge.hedgeSide}`, inline: false },
            { name: 'Remaining Leg', value: ctx.parlayHedge.remainingLeg || 'N/A', inline: true },
            { name: 'Hedge Odds', value: ctx.parlayHedge.hedgeOdds || 'N/A', inline: true },
        ],
        color: 0x00FF00,
    });
    await channel.send({ embeds: [embed] });
    return true;
}
async function dispatchUnitTalkAlerts(context, discordChannel) {
    let alertSent = false;
    alertSent || (alertSent = await detectInjuryImpact(context, discordChannel));
    alertSent || (alertSent = await detectSignificantLineMove(context, discordChannel));
    alertSent || (alertSent = await detectHedgeOpportunity(context, discordChannel));
    alertSent || (alertSent = await detectSteamMove(context, discordChannel));
    alertSent || (alertSent = await detectStaleLine(context, discordChannel));
    alertSent || (alertSent = await detectMiddlingOpportunity(context, discordChannel));
    alertSent || (alertSent = await detectReverseLineMovement(context, discordChannel));
    alertSent || (alertSent = await detectClosingLineValue(context, discordChannel));
    alertSent || (alertSent = await detectSharpConsensus(context, discordChannel));
    alertSent || (alertSent = await detectParlayHedgeOpportunity(context, discordChannel));
    return alertSent;
}
