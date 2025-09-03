import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, EmbedBuilder } from 'discord.js';
import { VIP_PLUS_MARKETING_CONFIG } from '../config/commands';

export const data = new SlashCommandBuilder()
  .setName('upgrade')
  .setDescription('View upgrade options and pricing');

export async function execute(interaction: CommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('VIP+ Elite - The Ultimate Edge')
    .setDescription(
      'Join the top 1% of sports intelligence professionals. Where legends are made and fortunes are built.'
    )
    .addFields([
      {
        name: '💎 VIP+ Elite Exclusive Features',
        value: VIP_PLUS_MARKETING_CONFIG.features
          .map(f => `• **${f.title}** - ${f.description}`)
          .join('\n'),
      },
      {
        name: '📊 VIP+ Elite Performance',
        value: [
          `• **${VIP_PLUS_MARKETING_CONFIG.winRate} Win Rate** - On VIP+ exclusive plays`,
          `• **${VIP_PLUS_MARKETING_CONFIG.unitsWeekly} Units Weekly** - Average member performance`,
          `• **${VIP_PLUS_MARKETING_CONFIG.weeklyProfits} Weekly Profits** - Based on $100/unit betting`,
          '• **Personal Success Manager** - Dedicated account management',
        ].join('\n'),
      },
      {
        name: '⚡ Exclusive VIP+ Offer',
        value: `First Month 50% Off - Price: ${VIP_PLUS_MARKETING_CONFIG.price}. Limited availability - VIP+ is capped at ${VIP_PLUS_MARKETING_CONFIG.memberLimit} members.`,
      },
    ])
    .setFooter({
      text: `VIP+ Elite - The Ultimate Edge | Limited to ${VIP_PLUS_MARKETING_CONFIG.memberLimit} Members Worldwide`,
    });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
