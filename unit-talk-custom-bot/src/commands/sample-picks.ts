import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getUserTier } from '../utils/roleUtils';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('sample-picks')
  .setDescription('View sample picks to get a taste of our premium content');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member;
    if (!member) {
      await interaction.editReply('❌ Unable to determine your membership status.');
      return;
    }

    const userTier = getUserTier(member as any);

    // Sample picks data (this would normally come from database)
    const samplePicks = [
      {
        sport: "🏀 NBA",
        game: "Lakers vs Warriors",
        pick: "Lakers +3.5",
        confidence: "High",
        analysis: "Lakers have covered the spread in 7 of their last 10 games...",
        capper: "ProCapper1"
      },
      {
        sport: "🏈 NFL",
        game: "Chiefs vs Bills",
        pick: "Over 52.5",
        confidence: "Medium",
        analysis: "Both teams average 28+ points per game...",
        capper: "EliteAnalyst"
      },
      {
        sport: "⚾ MLB",
        game: "Yankees vs Red Sox",
        pick: "Yankees ML",
        confidence: "High",
        analysis: "Yankees starting pitcher has 2.1 ERA vs Red Sox...",
        capper: "BaseballGuru"
      }
    ];

    const embed = new EmbedBuilder()
      .setTitle('📊 Sample Picks Preview')
      .setDescription('Here\'s a taste of the quality picks our VIP members receive daily!')
      .setColor(0x7289DA)
      .setTimestamp();

    // Add sample picks as fields
    samplePicks.forEach((pick, index) => {
      embed.addFields({
        name: `${pick.sport} - ${pick.game}`,
        value: `**Pick:** ${pick.pick}\n**Confidence:** ${pick.confidence}\n**Capper:** ${pick.capper}\n**Analysis:** ${pick.analysis.substring(0, 50)}...`,
        inline: false
      });
    });

    // Add upgrade prompt for non-VIP users
    if (userTier === 'member' || userTier === 'trial') {
      embed.addFields({
        name: '🚀 Want More?',
        value: 'Upgrade to VIP for:\n• 10-15 daily picks\n• Full analysis & reasoning\n• Live updates & alerts\n• Capper performance tracking',
        inline: false
      });
    }

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('upgrade_to_vip')
          .setLabel('Upgrade to VIP')
          .setStyle(ButtonStyle.Success)
          .setEmoji('⭐'),
        new ButtonBuilder()
          .setCustomId('view_faq')
          .setLabel('Learn More')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❓')
      );

    await interaction.editReply({ 
      embeds: [embed], 
      components: [actionRow]
    });

    logger.info(`Sample picks viewed by ${interaction.user.tag} (${userTier})`);

  } catch (error) {
    logger.error('Error in sample-picks command:', error);
    await interaction.editReply('❌ An error occurred while fetching sample picks.');
  }
}