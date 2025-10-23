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
export declare function buildUnitTalkEmbed({ title, description, advice, fields, emoji, color, // lime green
footer, }: UnitTalkEmbedOptions): EmbedBuilder;
export {};
//# sourceMappingURL=embedBuilder.d.ts.map