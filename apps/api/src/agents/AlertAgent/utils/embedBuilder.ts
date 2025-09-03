// src/agents/AlertAgent/utils/embedBuilder.ts

import { EmbedBuilder, APIEmbedField } from 'discord.js';

interface UnitTalkEmbedOptions {
  title: string;
  description: string;
  advice: string;
  fields?: APIEmbedField[];
  emoji?: string;
  color?: number;
  footer?: string;
}

export function buildUnitTalkEmbed({
  title,
  description,
  advice,
  fields = [],
  emoji = '🔥',
  color = 0x00ff99, // lime green
  footer = 'Unit Talk • Elite Betting Alerts',
}: UnitTalkEmbedOptions) {
  return new EmbedBuilder()
    .setTitle(`${emoji} ${title}`)
    .setDescription(description)
    .setColor(color)
    .addFields(fields)
    .setFooter({ text: footer })
    .addFields({ name: '🧠 Unit Talk Advice', value: advice });
}
