"use strict";
// src/agents/AlertAgent/utils/embedBuilder.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildUnitTalkEmbed = buildUnitTalkEmbed;
const discord_js_1 = require("discord.js");
function buildUnitTalkEmbed({ title, description, advice, fields = [], emoji = '🔥', color = 0x00ff99, // lime green
footer = 'Unit Talk • Elite Betting Alerts', }) {
    return new discord_js_1.EmbedBuilder()
        .setTitle(`${emoji} ${title}`)
        .setDescription(description)
        .setColor(color)
        .addFields(fields)
        .setFooter({ text: footer })
        .addFields({ name: '🧠 Unit Talk Advice', value: advice });
}
