// src/agents/AlertAgent/utils/embedBuilder.ts

import { EmbedBuilder } from 'discord.js';

export function buildUnitTalkEmbed({
  title,
  description,
  advice,
  fields = [],
  emoji = '🔥',
  color = 0x00ff99, // lime green
  footer = 'Unit Talk • Elite Betting Alerts',
}) {
  return new EmbedBuilder()
    .setTitle(`${emoji} ${title}`)
    .setDescription(description)
    .setColor(color)
    .addFields(fields)
    .setFooter({ text: footer })
    .addFields({ name: '🧠 Unit Talk Advice', value: advice });
}
